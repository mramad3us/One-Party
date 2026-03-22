import type {
  ActionResult,
  AvailableActions,
  CombatState,
  Coordinate,
  CreatureStatBlock,
  EntityId,
  GridDefinition,
  Item,
  NPC,
  PlannedTurn,
  SpellOption,
} from '@/types';
import { abilityModifier } from '@/utils/math';
import { DiceRoller } from '@/rules/DiceRoller';
import { CombatRules } from '@/rules/CombatRules';
import { ConditionRules } from '@/rules/ConditionRules';
import { EventBus } from '@/engine/EventBus';
import { Grid } from '@/grid/Grid';
import { Pathfinder } from '@/grid/Pathfinder';
import { InitiativeTracker } from './InitiativeTracker';
import { TurnManager } from './TurnManager';
import { TargetingSystem } from './TargetingSystem';
import { CombatAI } from './CombatAI';

/** Everything needed to add a participant to combat. */
export interface CombatParticipant {
  entityId: EntityId;
  isPlayer: boolean;
  isAlly: boolean;
  stats: CreatureStatBlock;
  initiative: number;
  equipment?: { weapons: Item[]; armor: Item[] };
  /** Optional NPC data for AI-controlled combatants */
  npc?: NPC;
}

/** Targeting info for spell casting. */
export interface SpellTargeting {
  targetEntities?: EntityId[];
  targetCell?: Coordinate;
  targetArea?: Coordinate[];
}

/** Result of a movement action. */
export interface MoveResult {
  path: Coordinate[];
  distanceMoved: number;
  opportunityAttacks: ActionResult[];
}

/** Final result when combat ends. */
export interface CombatResult {
  victory: boolean;
  rounds: number;
  xpEarned: number;
  casualties: EntityId[];
  survivors: EntityId[];
}

/**
 * The master combat controller.
 *
 * Manages the full combat lifecycle: initiative, turns, actions,
 * movement, opportunity attacks, conditions, and NPC AI.
 */
export class CombatManager {
  private state: CombatState;
  private grid: Grid | null = null;
  private initiative: InitiativeTracker;
  private turnManager: TurnManager;
  private targeting: TargetingSystem | null = null;
  private combatAI: CombatAI | null = null;
  private pathfinder: Pathfinder;

  /** Lookup table: entityId -> participant data */
  private participants: Map<EntityId, CombatParticipant> = new Map();
  private casualties: EntityId[] = [];

  constructor(
    private combatRules: CombatRules,
    private conditionRules: ConditionRules,
    private events: EventBus,
    private dice: DiceRoller,
  ) {
    this.state = {
      phase: 'idle',
      combatants: [],
      currentTurnIndex: 0,
      round: 1,
      gridId: '',
    };
    this.initiative = new InitiativeTracker();
    this.turnManager = new TurnManager();
    this.pathfinder = new Pathfinder();
  }

  // ── Lifecycle ────────────────────────────────────────────────

  /**
   * Start a combat encounter.
   * Rolls initiative, places entities on the grid, and begins the first turn.
   */
  startCombat(
    participants: CombatParticipant[],
    gridDef: GridDefinition,
    placements: Map<EntityId, Coordinate>,
  ): void {
    // Build grid
    this.grid = new Grid(gridDef);
    this.targeting = new TargetingSystem(this.grid);
    this.combatAI = new CombatAI(this.grid, this.targeting);

    // Store participants
    this.participants.clear();
    this.casualties = [];

    for (const p of participants) {
      this.participants.set(p.entityId, p);
    }

    // Place entities on grid
    for (const [entityId, coord] of placements) {
      const p = this.participants.get(entityId);
      const size = p ? this.getSizeInCells(p.stats.size) : 1;
      this.grid.placeEntity(entityId, coord, size);
    }

    // Roll initiative
    const initiativeEntries = participants.map((p) => ({
      entityId: p.entityId,
      modifier: abilityModifier(p.stats.abilityScores.dexterity),
      isPlayer: p.isPlayer,
      isAlly: p.isAlly,
    }));

    const combatants = this.initiative.rollInitiative(initiativeEntries, this.dice);

    this.state = {
      phase: 'turn_start',
      combatants,
      currentTurnIndex: 0,
      round: 1,
      gridId: '',
    };

    this.events.emit({
      type: 'combat:start',
      category: 'combat',
      data: {
        participants: participants.map((p) => p.entityId),
        initiative: combatants,
      },
    });

    // Start first turn
    this.beginTurn();
  }

  /**
   * End combat and return the result.
   */
  endCombat(): CombatResult {
    const allEnemies = Array.from(this.participants.values()).filter(
      (p) => !p.isPlayer && !p.isAlly,
    );
    const victory = allEnemies.every(
      (p) => this.casualties.includes(p.entityId) || p.stats.currentHp <= 0,
    );

    const survivors = Array.from(this.participants.keys()).filter(
      (id) => !this.casualties.includes(id),
    );

    // Simple XP calculation: sum of CR-based XP for defeated enemies
    let xpEarned = 0;
    for (const id of this.casualties) {
      const p = this.participants.get(id);
      if (p && !p.isPlayer && !p.isAlly) {
        xpEarned += this.estimateXP(p.stats.level);
      }
    }

    const result: CombatResult = {
      victory,
      rounds: this.initiative.getRound(),
      xpEarned,
      casualties: [...this.casualties],
      survivors,
    };

    this.state.phase = 'resolution';

    this.events.emit({
      type: 'combat:end',
      category: 'combat',
      data: { result },
    });

    // Reset
    this.state.phase = 'idle';
    this.grid = null;
    this.targeting = null;
    this.combatAI = null;
    this.initiative.reset();

    return result;
  }

  // ── State ────────────────────────────────────────────────────

  getState(): CombatState {
    return { ...this.state };
  }

  getGrid(): Grid | null {
    return this.grid;
  }

  getCurrentTurnEntity(): EntityId {
    return this.initiative.getCurrentCombatant().entityId;
  }

  isPlayerTurn(): boolean {
    const current = this.initiative.getCurrentCombatant();
    return current.isPlayer;
  }

  getRound(): number {
    return this.initiative.getRound();
  }

  getParticipant(entityId: EntityId): CombatParticipant | undefined {
    return this.participants.get(entityId);
  }

  getInitiativeOrder(): { entityId: EntityId; initiative: number; isPlayer: boolean }[] {
    return this.initiative.getOrder();
  }

  getInitiativeRolls() {
    return this.initiative.lastInitiativeRolls;
  }

  // ── Available Actions ────────────────────────────────────────

  getAvailableActions(entityId: EntityId): AvailableActions {
    const p = this.participants.get(entityId);
    if (!p || !this.grid || !this.targeting) {
      return {
        canMove: false,
        remainingMovement: 0,
        canAction: false,
        canBonusAction: false,
        canReaction: false,
        validAttackTargets: [],
        validSpells: [],
        validMoveCells: new Set(),
      };
    }

    const turnState = this.turnManager.getTurnState();
    const remaining = this.turnManager.getRemainingMovement();
    const size = this.getSizeInCells(p.stats.size);

    // Calculate reachable cells
    const reachable = remaining > 0
      ? this.pathfinder.getReachableCells(
          this.grid,
          this.grid.getEntityPosition(entityId) ?? { x: 0, y: 0 },
          size,
          remaining,
          new Set([entityId]),
        )
      : new Map<string, number>();

    // Calculate valid attack targets
    const attackTargets = this.getValidAttackTargets(entityId, p);

    // Calculate valid spells
    const validSpells = this.getValidSpellOptions(entityId, p);

    return {
      canMove: remaining > 0,
      remainingMovement: remaining,
      canAction: !turnState.actionUsed,
      canBonusAction: !turnState.bonusActionUsed,
      canReaction: !turnState.reactionUsed,
      validAttackTargets: attackTargets,
      validSpells,
      validMoveCells: new Set(reachable.keys()),
    };
  }

  // ── Player Actions ───────────────────────────────────────────

  executeMove(entityId: EntityId, path: Coordinate[]): MoveResult {
    if (!this.grid) {
      return { path: [], distanceMoved: 0, opportunityAttacks: [] };
    }

    const p = this.participants.get(entityId);
    if (!p) return { path: [], distanceMoved: 0, opportunityAttacks: [] };

    // Check for opportunity attacks along the path
    const oaResults = this.handleOpportunityAttacks(entityId, path);

    // Calculate distance moved
    let distanceMoved = 0;
    for (let i = 1; i < path.length; i++) {
      const cost = this.grid.getMovementCost(path[i].x, path[i].y) * 5;
      distanceMoved += cost;
    }

    // Use movement
    this.turnManager.useMovement(distanceMoved);

    // Move entity on grid
    const finalPos = path[path.length - 1];
    if (finalPos) {
      this.grid.moveEntity(entityId, finalPos);
    }

    this.events.emit({
      type: 'combat:move',
      category: 'combat',
      data: { entityId, path, distance: distanceMoved },
    });

    return { path, distanceMoved, opportunityAttacks: oaResults };
  }

  executeAttack(entityId: EntityId, targetId: EntityId, _weaponId?: EntityId): ActionResult {
    const p = this.participants.get(entityId);
    const target = this.participants.get(targetId);

    if (!p || !target || !this.turnManager.canAction()) {
      return this.failResult(entityId, 'attack', 'Cannot attack.');
    }

    this.turnManager.useAction();

    // Use the first available attack from the stat block
    const attack = p.stats.attacks[0];
    let result: ActionResult;

    if (attack) {
      // Use raw attack data from stat block
      const rollResult = this.dice.rollD20({ modifier: attack.toHitBonus });
      const ac = target.stats.armorClass;
      const hit = rollResult.isCritical || (!rollResult.isFumble && rollResult.total >= ac);

      let damage = 0;
      const rolls = [rollResult];

      if (hit) {
        const dmgResult = this.combatRules.rollDamage(attack.damage, rollResult.isCritical);
        rolls.push(dmgResult);
        damage = Math.max(0, dmgResult.total);
      }

      result = {
        success: hit,
        type: 'attack',
        actorId: entityId,
        targetId,
        damage: hit ? damage : undefined,
        damageType: hit ? attack.damage.type : undefined,
        description: hit
          ? `${attack.name} hits for ${damage} ${attack.damage.type} damage.`
          : `${attack.name} misses (${rollResult.total} vs AC ${ac}).`,
        rolls,
      };

      // Apply damage
      if (hit && damage > 0) {
        this.applyDamageToParticipant(targetId, damage, attack.damage.type);
      }

      // Handle multiattack: if creature has multiple attacks, execute remaining ones
      for (let i = 1; i < p.stats.attacks.length; i++) {
        const extraAttack = p.stats.attacks[i];
        const extraRoll = this.dice.rollD20({ modifier: extraAttack.toHitBonus });
        const extraHit = extraRoll.isCritical || (!extraRoll.isFumble && extraRoll.total >= ac);

        if (extraHit) {
          const extraDmg = this.combatRules.rollDamage(extraAttack.damage, extraRoll.isCritical);
          const extraDamage = Math.max(0, extraDmg.total);
          this.applyDamageToParticipant(targetId, extraDamage, extraAttack.damage.type);
        }
      }
    } else {
      // Unarmed strike fallback
      const strMod = abilityModifier(p.stats.abilityScores.strength);
      const prof = Math.floor((p.stats.level - 1) / 4) + 2;
      const rollResult = this.dice.rollD20({ modifier: strMod + prof });
      const ac = target.stats.armorClass;
      const hit = rollResult.isCritical || (!rollResult.isFumble && rollResult.total >= ac);
      const damage = hit ? Math.max(0, 1 + strMod) : 0;

      result = {
        success: hit,
        type: 'attack',
        actorId: entityId,
        targetId,
        damage: hit ? damage : undefined,
        damageType: hit ? 'bludgeoning' : undefined,
        description: hit
          ? `Unarmed strike hits for ${damage} bludgeoning damage.`
          : `Unarmed strike misses (${rollResult.total} vs AC ${ac}).`,
        rolls: [rollResult],
      };

      if (hit && damage > 0) {
        this.applyDamageToParticipant(targetId, damage, 'bludgeoning');
      }
    }

    this.events.emit({
      type: 'combat:attack',
      category: 'combat',
      data: { result },
    });

    this.checkCombatEnd();
    return result;
  }

  executeCastSpell(entityId: EntityId, spellId: string, targets: SpellTargeting): ActionResult {
    const p = this.participants.get(entityId);

    if (!p || !this.turnManager.canAction() || !this.grid || !this.targeting) {
      return this.failResult(entityId, 'cast_spell', 'Cannot cast spell.');
    }

    this.turnManager.useAction();

    // For now, we apply spell effects to targeted entities
    const description = `Casts ${spellId}.`;
    const rolls: ActionResult['rolls'] = [];
    let totalDamage = 0;
    let totalHealing = 0;

    // Determine affected entities
    const affectedEntities: EntityId[] = [];
    if (targets.targetEntities) {
      affectedEntities.push(...targets.targetEntities);
    } else if (targets.targetArea) {
      affectedEntities.push(...this.targeting.getEntitiesInArea(targets.targetArea));
    } else if (targets.targetCell) {
      const eid = this.grid.getEntityAt(targets.targetCell);
      if (eid) affectedEntities.push(eid);
    }

    const result: ActionResult = {
      success: affectedEntities.length > 0,
      type: 'cast_spell',
      actorId: entityId,
      targetId: affectedEntities[0],
      damage: totalDamage > 0 ? totalDamage : undefined,
      healing: totalHealing > 0 ? totalHealing : undefined,
      description,
      rolls,
    };

    this.events.emit({
      type: 'combat:spell',
      category: 'combat',
      data: { entityId, spellId, targets, result },
    });

    this.checkCombatEnd();
    return result;
  }

  executeDash(entityId: EntityId): ActionResult {
    if (!this.turnManager.canAction()) {
      return this.failResult(entityId, 'dash', 'No action available.');
    }

    this.turnManager.dash();

    const result: ActionResult = {
      success: true,
      type: 'dash',
      actorId: entityId,
      description: 'Takes the Dash action, doubling movement.',
      rolls: [],
    };

    this.events.emit({
      type: 'combat:action',
      category: 'combat',
      data: { entityId, action: 'dash' },
    });

    return result;
  }

  executeDodge(entityId: EntityId): ActionResult {
    if (!this.turnManager.canAction()) {
      return this.failResult(entityId, 'dodge', 'No action available.');
    }

    this.turnManager.useAction();

    // TODO: Apply dodge status (advantage on Dex saves, attacks against have disadvantage)

    const result: ActionResult = {
      success: true,
      type: 'dodge',
      actorId: entityId,
      description: 'Takes the Dodge action.',
      rolls: [],
    };

    this.events.emit({
      type: 'combat:action',
      category: 'combat',
      data: { entityId, action: 'dodge' },
    });

    return result;
  }

  executeDisengage(entityId: EntityId): ActionResult {
    if (!this.turnManager.canAction()) {
      return this.failResult(entityId, 'disengage', 'No action available.');
    }

    this.turnManager.useAction();
    // Disengage flag prevents opportunity attacks for this turn
    // (handled in movement processing)

    const result: ActionResult = {
      success: true,
      type: 'disengage',
      actorId: entityId,
      description: 'Takes the Disengage action. Movement does not provoke opportunity attacks.',
      rolls: [],
    };

    this.events.emit({
      type: 'combat:action',
      category: 'combat',
      data: { entityId, action: 'disengage' },
    });

    return result;
  }

  executeEndTurn(entityId: EntityId): void {
    if (this.getCurrentTurnEntity() !== entityId) return;

    this.applyEndOfTurnEffects(entityId);
    this.turnManager.endTurn();

    this.events.emit({
      type: 'combat:turn_end',
      category: 'combat',
      data: { entityId, round: this.initiative.getRound() },
    });

    // Advance to next combatant
    this.initiative.nextTurn();
    this.state.currentTurnIndex = this.initiative.getCurrentIndex();
    this.state.round = this.initiative.getRound();

    if (!this.checkCombatEnd()) {
      this.beginTurn();
    }
  }

  // ── Internal ─────────────────────────────────────────────────

  /**
   * Process an NPC's turn automatically using the combat AI.
   */
  /** Process an NPC's turn using the combat AI. Returns action results. */
  processNPCTurn(entityId: EntityId): ActionResult[] {
    const results: ActionResult[] = [];
    const p = this.participants.get(entityId);
    if (!p || !this.combatAI || !this.grid) return results;

    const available = this.getAvailableActions(entityId);
    const enemies = this.getEnemiesOf(entityId);
    const allies = this.getAlliesOf(entityId);

    // Get NPC data for AI
    const npc = p.npc;
    if (!npc) {
      // Simple AI for monsters without full NPC data: move toward nearest enemy and attack
      this.simpleMonsterTurn(entityId, available, enemies, results);
      return results;
    }

    const plan = this.combatAI.decideTurn(
      npc,
      this.state,
      available,
      allies,
      enemies,
      (id) => {
        const pp = this.participants.get(id);
        const pos = this.grid?.getEntityPosition(id);
        if (!pp || !pos) return undefined;
        return {
          hp: pp.stats.currentHp,
          maxHp: pp.stats.maxHp,
          position: pos,
          ac: pp.stats.armorClass,
        };
      },
    );

    // Execute the planned turn
    this.executePlan(entityId, plan, results);

    return results;
  }

  /**
   * Simple AI for basic monsters without companion data.
   */
  private simpleMonsterTurn(
    entityId: EntityId,
    available: AvailableActions,
    enemies: EntityId[],
    results: ActionResult[],
  ): void {
    if (!this.grid) return;

    const p = this.participants.get(entityId);
    if (!p) return;

    const pos = this.grid.getEntityPosition(entityId);
    if (!pos) return;

    // Find nearest enemy
    let nearestEnemy: EntityId | null = null;
    let nearestDist = Infinity;

    for (const eid of enemies) {
      const dist = this.grid.getEntityDistance(entityId, eid);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestEnemy = eid;
      }
    }

    if (!nearestEnemy) return;

    const targetPos = this.grid.getEntityPosition(nearestEnemy);
    if (!targetPos) return;

    // Move toward target if not in melee range
    if (available.canMove && nearestDist > 5) {
      const size = this.getSizeInCells(p.stats.size);
      const path = this.pathfinder.findPath(
        this.grid,
        pos,
        targetPos,
        size,
        available.remainingMovement,
        new Set([entityId]),
      );

      if (path.reachable && path.path.length > 1) {
        const moveResult = this.executeMove(entityId, path.path);
        results.push(...moveResult.opportunityAttacks);
      }
    }

    // Attack if in range
    if (available.canAction && available.validAttackTargets.includes(nearestEnemy)) {
      const attackResult = this.executeAttack(entityId, nearestEnemy);
      results.push(attackResult);
    } else if (available.canAction && nearestDist > 5) {
      // Dash toward target if can't reach
      const dashResult = this.executeDash(entityId);
      results.push(dashResult);
    }
  }

  /**
   * Execute a planned turn (from AI).
   */
  private executePlan(entityId: EntityId, plan: PlannedTurn, results: ActionResult[]): void {
    // Movement
    if (plan.movement && plan.movement.length > 1) {
      const moveResult = this.executeMove(entityId, plan.movement);
      results.push(...moveResult.opportunityAttacks);
    }

    // Action
    if (plan.action) {
      const actionResult = this.executeAction(entityId, plan.action);
      if (actionResult) results.push(actionResult);
    }

    // Bonus action
    if (plan.bonusAction) {
      const bonusResult = this.executeAction(entityId, plan.bonusAction);
      if (bonusResult) results.push(bonusResult);
    }
  }

  private executeAction(entityId: EntityId, action: { type: string; targetId?: EntityId }): ActionResult | null {
    switch (action.type) {
      case 'attack':
        if (action.targetId) return this.executeAttack(entityId, action.targetId);
        return null;
      case 'dash':
        return this.executeDash(entityId);
      case 'dodge':
        return this.executeDodge(entityId);
      case 'disengage':
        return this.executeDisengage(entityId);
      default:
        return null;
    }
  }

  /**
   * Check if combat should end. Returns true if combat is over.
   */
  /** Check if combat should end (one side eliminated). */
  checkCombatEnd(): boolean {
    const playerSide = Array.from(this.participants.values())
      .filter((p) => (p.isPlayer || p.isAlly) && !this.casualties.includes(p.entityId));
    const enemySide = Array.from(this.participants.values())
      .filter((p) => !p.isPlayer && !p.isAlly && !this.casualties.includes(p.entityId));

    const playerAlive = playerSide.some((p) => p.stats.currentHp > 0);
    const enemyAlive = enemySide.some((p) => p.stats.currentHp > 0);

    if (!playerAlive || !enemyAlive) {
      this.state.phase = 'check_end';
      return true;
    }

    return false;
  }

  /**
   * Handle opportunity attacks along a movement path.
   */
  private handleOpportunityAttacks(entityId: EntityId, path: Coordinate[]): ActionResult[] {
    const results: ActionResult[] = [];
    if (!this.targeting) return results;

    // TODO: Check disengage status
    const enemies = this.getEnemiesOf(entityId);
    const triggers = this.targeting.leavesThreatenedArea(entityId, path, enemies);

    for (const trigger of triggers) {
      const enemyP = this.participants.get(trigger.triggeredBy);
      if (!enemyP) continue;

      // Enemy uses reaction to make an opportunity attack
      const attack = enemyP.stats.attacks[0];
      if (!attack) continue;

      const rollResult = this.dice.rollD20({ modifier: attack.toHitBonus });
      const targetP = this.participants.get(entityId);
      if (!targetP) continue;

      const ac = targetP.stats.armorClass;
      const hit = rollResult.isCritical || (!rollResult.isFumble && rollResult.total >= ac);

      let damage = 0;
      if (hit) {
        const dmgResult = this.combatRules.rollDamage(attack.damage, rollResult.isCritical);
        damage = Math.max(0, dmgResult.total);
        this.applyDamageToParticipant(entityId, damage, attack.damage.type);
      }

      const result: ActionResult = {
        success: hit,
        type: 'attack',
        actorId: trigger.triggeredBy,
        targetId: entityId,
        damage: hit ? damage : undefined,
        damageType: hit ? attack.damage.type : undefined,
        description: hit
          ? `Opportunity attack! ${attack.name} hits for ${damage} damage.`
          : `Opportunity attack! ${attack.name} misses.`,
        rolls: [rollResult],
      };

      results.push(result);

      this.events.emit({
        type: 'combat:attack',
        category: 'combat',
        data: { result, opportunityAttack: true },
      });
    }

    return results;
  }

  /**
   * Apply start-of-turn effects for a combatant.
   */
  private applyStartOfTurnEffects(entityId: EntityId): void {
    const p = this.participants.get(entityId);
    if (!p) return;

    // Build a minimal entity-like object for ConditionRules
    // ConditionRules works with Character | NPC, but we can use the NPC if available
    if (p.npc) {
      const speedMult = this.conditionRules.getSpeedMultiplier(p.npc);
      if (speedMult === 0) {
        // Can't move this turn — handled by TurnManager getting 0 speed
      }
    }
  }

  /**
   * Apply end-of-turn effects for a combatant.
   */
  private applyEndOfTurnEffects(entityId: EntityId): void {
    const p = this.participants.get(entityId);
    if (!p) return;

    if (p.npc) {
      const removed = this.conditionRules.tickConditions(p.npc);
      if (removed.length > 0) {
        this.events.emit({
          type: 'combat:conditions_expired',
          category: 'combat',
          data: { entityId, conditions: removed },
        });
      }
    }
  }

  /**
   * Begin processing a turn for the current combatant.
   */
  private beginTurn(): void {
    const current = this.initiative.getCurrentCombatant();
    const p = this.participants.get(current.entityId);
    if (!p) return;

    this.state.phase = 'turn_start';

    // Apply speed from conditions
    let speed = p.stats.speed;
    if (p.npc) {
      speed = Math.floor(speed * this.conditionRules.getSpeedMultiplier(p.npc));
    }

    this.turnManager.startTurn(current.entityId, speed);
    this.applyStartOfTurnEffects(current.entityId);

    this.state.phase = 'turn_active';

    this.events.emit({
      type: 'combat:turn_start',
      category: 'combat',
      data: {
        entityId: current.entityId,
        isPlayer: current.isPlayer,
        round: this.initiative.getRound(),
      },
    });

    // Both player and NPC turns wait for external driver (CombatController).
    // CombatController calls processNPCTurn() for NPCs with animation delays,
    // or waits for player input for the player's turn.
  }

  // ── Helpers ──────────────────────────────────────────────────

  private applyDamageToParticipant(targetId: EntityId, damage: number, damageType: string): void {
    const p = this.participants.get(targetId);
    if (!p) return;

    const newHp = Math.max(0, p.stats.currentHp - damage);
    p.stats.currentHp = newHp;

    if (newHp <= 0) {
      this.handleDeath(targetId);
    }

    this.events.emit({
      type: 'combat:damage',
      category: 'combat',
      data: { targetId, damage, damageType, remainingHp: newHp },
    });
  }

  private handleDeath(entityId: EntityId): void {
    if (this.casualties.includes(entityId)) return;
    this.casualties.push(entityId);

    // Remove from grid
    this.grid?.removeEntity(entityId);
    this.initiative.removeCombatant(entityId);

    this.events.emit({
      type: 'combat:kill',
      category: 'combat',
      data: { entityId },
    });
  }

  private getEnemiesOf(entityId: EntityId): EntityId[] {
    const p = this.participants.get(entityId);
    if (!p) return [];

    const isPlayerSide = p.isPlayer || p.isAlly;
    return Array.from(this.participants.entries())
      .filter(([id, pp]) => {
        if (id === entityId) return false;
        if (this.casualties.includes(id)) return false;
        const otherIsPlayerSide = pp.isPlayer || pp.isAlly;
        return isPlayerSide !== otherIsPlayerSide;
      })
      .map(([id]) => id);
  }

  private getAlliesOf(entityId: EntityId): EntityId[] {
    const p = this.participants.get(entityId);
    if (!p) return [];

    const isPlayerSide = p.isPlayer || p.isAlly;
    return Array.from(this.participants.entries())
      .filter(([id, pp]) => {
        if (id === entityId) return false;
        if (this.casualties.includes(id)) return false;
        const otherIsPlayerSide = pp.isPlayer || pp.isAlly;
        return isPlayerSide === otherIsPlayerSide;
      })
      .map(([id]) => id);
  }

  private getValidAttackTargets(entityId: EntityId, p: CombatParticipant): EntityId[] {
    if (!this.targeting) return [];

    const enemies = this.getEnemiesOf(entityId);
    const targets = new Set<EntityId>();

    // Melee targets
    for (const attack of p.stats.attacks) {
      if (!attack.rangeNormal || attack.rangeNormal === 0) {
        const melee = this.targeting.getValidMeleeTargets(entityId, attack.reach || 5);
        for (const t of melee) {
          if (enemies.includes(t)) targets.add(t);
        }
      }
    }

    // Ranged targets
    for (const attack of p.stats.attacks) {
      if (attack.rangeNormal && attack.rangeNormal > 0) {
        const ranged = this.targeting.getValidRangedTargets(
          entityId,
          attack.rangeNormal,
          attack.rangeLong ?? attack.rangeNormal,
        );
        for (const t of ranged) {
          if (enemies.includes(t)) targets.add(t);
        }
      }
    }

    // If no attacks defined, check for unarmed melee
    if (p.stats.attacks.length === 0) {
      const melee = this.targeting.getValidMeleeTargets(entityId, 5);
      for (const t of melee) {
        if (enemies.includes(t)) targets.add(t);
      }
    }

    return Array.from(targets);
  }

  private getValidSpellOptions(_entityId: EntityId, _p: CombatParticipant): SpellOption[] {
    // TODO: Implement full spell option calculation
    return [];
  }

  private getSizeInCells(size: string): number {
    switch (size) {
      case 'tiny':
      case 'small':
      case 'medium':
        return 1;
      case 'large':
        return 2;
      case 'huge':
        return 3;
      case 'gargantuan':
        return 4;
      default:
        return 1;
    }
  }

  private estimateXP(level: number): number {
    // Simple CR-to-XP mapping for common CRs
    const xpTable: Record<number, number> = {
      0: 10, 1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800,
      6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900,
      11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000,
      16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000,
    };
    return xpTable[level] ?? level * 1000;
  }

  private failResult(entityId: EntityId, type: ActionResult['type'], description: string): ActionResult {
    return {
      success: false,
      type,
      actorId: entityId,
      description,
      rolls: [],
    };
  }
}
