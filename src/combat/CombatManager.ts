import type {
  ActionResult,
  AvailableActions,
  BonusActionOption,
  CombatState,
  ConditionType,
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
import {
  ConditionRules,
  ATTACK_DISADVANTAGE_CONDITIONS,
  ADVANTAGE_AGAINST_CONDITIONS,
  DEX_SAVE_DISADVANTAGE_CONDITIONS,
  STR_SAVE_DISADVANTAGE_CONDITIONS,
} from '@/rules/ConditionRules';
import { EventBus, type GameEvent } from '@/engine/EventBus';
import { Grid } from '@/grid/Grid';
import { Pathfinder } from '@/grid/Pathfinder';
import { InitiativeTracker } from './InitiativeTracker';
import { TurnManager } from './TurnManager';
import { TargetingSystem } from './TargetingSystem';
import { CombatAI } from './CombatAI';
import { getSpell } from '@/data/spells';
import { CLASS_BONUS_ACTIONS, getBonusAction, type ClassBonusActionDef } from '@/data/bonusActions';

import {
  narrateAttack,
  narrateSlapSave,
  narrateSpellSave,
  narrateSpellAttack,
  narrateSpellAutoHit,
  narrateHealing,
  narrateBuff,
  narrateOpportunityAttack,
  narrateUnarmedStrike,
  narrateFeatureHealing,
  narrateDivineOracleAttack,
  narrateDivineOracleSave,
  narrateGreaterMagicImmunity,
} from './CombatNarration';

/** Active spell buff/debuff on a combat participant. */
export type SpellBuff = {
  spellId: string;
  casterId: EntityId;
  /** AC modifier (positive = buff, negative = debuff) */
  acMod?: number;
  /** AC floor (Barkskin: AC can't be less than this) */
  acFloor?: number;
  /** Attack roll modifier */
  attackMod?: number;
  /** Save roll modifier */
  saveMod?: number;
  /** Disadvantage on all saves (Bestow Curse) */
  saveDisadvantage?: boolean;
  /** Speed multiplier (2 = doubled, 0.5 = halved) */
  speedMult?: number;
  /** Attacks against this entity have disadvantage (Blur) */
  attackDisadvantageAgainst?: boolean;
  /** Mirror Image charges remaining */
  mirrorImageCharges?: number;
  /** Duration in rounds (decremented each turn start) */
  duration: number;
  /** Linked to concentration (removed when caster's concentration breaks) */
  concentration?: boolean;
  /** On removal, apply this condition for N rounds (Haste lethargy) */
  onRemoveCondition?: { condition: import('@/types').ConditionType; duration: number };
};

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
  /** Saving throw proficiencies (from Character — NPCs typically don't have these) */
  savingThrowProficiencies?: string[];
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

  /** Entities that have taken the Dodge action (lasts until the start of their next turn). */
  private dodgingEntities: Set<EntityId> = new Set();

  /** Concentration spell remaining duration in rounds. Decremented each turn start. */
  private concentrationDurations: Map<EntityId, number> = new Map();

  /** Active spell buffs/debuffs per entity. Keyed by entity ID. */
  private spellBuffs: Map<EntityId, SpellBuff[]> = new Map();

  /** Add a spell buff/debuff to a participant. */
  private addSpellBuff(entityId: EntityId, buff: SpellBuff): void {
    if (!this.spellBuffs.has(entityId)) this.spellBuffs.set(entityId, []);
    this.spellBuffs.get(entityId)!.push(buff);
  }

  /** Remove all buffs from a specific caster (used when concentration breaks). */
  private removeConcentrationBuffs(casterId: EntityId): void {
    for (const [entityId, buffs] of this.spellBuffs) {
      const remaining: SpellBuff[] = [];
      for (const buff of buffs) {
        if (buff.casterId === casterId && buff.concentration) {
          // Trigger on-remove effects (e.g. Haste lethargy)
          if (buff.onRemoveCondition) {
            const target = this.participants.get(entityId);
            if (target) {
              this.applyConditionToParticipant(target, buff.onRemoveCondition.condition, buff.onRemoveCondition.duration, casterId);
            }
          }
        } else {
          remaining.push(buff);
        }
      }
      this.spellBuffs.set(entityId, remaining);
    }
  }

  /** Get total AC modifier from all active buffs on an entity. */
  private getBuffACModifier(entityId: EntityId): number {
    const buffs = this.spellBuffs.get(entityId) ?? [];
    return buffs.reduce((sum, b) => sum + (b.acMod ?? 0), 0);
  }

  /** Get AC floor from buffs (Barkskin). Returns 0 if no floor. */
  private getBuffACFloor(entityId: EntityId): number {
    const buffs = this.spellBuffs.get(entityId) ?? [];
    return Math.max(0, ...buffs.map(b => b.acFloor ?? 0));
  }

  /** Get total attack modifier from buffs. */
  private getBuffAttackMod(entityId: EntityId): number {
    const buffs = this.spellBuffs.get(entityId) ?? [];
    return buffs.reduce((sum, b) => sum + (b.attackMod ?? 0), 0);
  }

  /** Get total save modifier from buffs. */
  private getBuffSaveMod(entityId: EntityId): number {
    const buffs = this.spellBuffs.get(entityId) ?? [];
    return buffs.reduce((sum, b) => sum + (b.saveMod ?? 0), 0);
  }

  /** Check if any buff grants save disadvantage. */
  private hasBuffSaveDisadvantage(entityId: EntityId): boolean {
    const buffs = this.spellBuffs.get(entityId) ?? [];
    return buffs.some(b => b.saveDisadvantage);
  }

  /** Get speed multiplier from buffs. */
  private getBuffSpeedMult(entityId: EntityId): number {
    const buffs = this.spellBuffs.get(entityId) ?? [];
    let mult = 1;
    for (const b of buffs) {
      if (b.speedMult) mult *= b.speedMult;
    }
    return mult;
  }

  /** Check if attacks against this entity have disadvantage from buffs (Blur). */
  private hasBuffAttackDisadvantageAgainst(entityId: EntityId): boolean {
    const buffs = this.spellBuffs.get(entityId) ?? [];
    return buffs.some(b => b.attackDisadvantageAgainst);
  }

  /** Try to absorb an attack with Mirror Image. Returns true if a duplicate was hit instead. */
  private tryMirrorImageAbsorb(targetId: EntityId): boolean {
    const buffs = this.spellBuffs.get(targetId) ?? [];
    const mirror = buffs.find(b => b.mirrorImageCharges && b.mirrorImageCharges > 0);
    if (!mirror) return false;
    // Each remaining charge has 25% chance to intercept
    const interceptChance = mirror.mirrorImageCharges! * 0.25;
    if (Math.random() < interceptChance) {
      mirror.mirrorImageCharges!--;
      if (mirror.mirrorImageCharges! <= 0) {
        // Remove exhausted mirror image buff
        const idx = buffs.indexOf(mirror);
        if (idx !== -1) buffs.splice(idx, 1);
      }
      return true;
    }
    return false;
  }

  /** Tick buff durations at turn start. Remove expired ones. */
  private tickSpellBuffs(entityId: EntityId): void {
    const buffs = this.spellBuffs.get(entityId);
    if (!buffs) return;
    for (let i = buffs.length - 1; i >= 0; i--) {
      buffs[i].duration--;
      if (buffs[i].duration <= 0) {
        const removed = buffs.splice(i, 1)[0];
        if (removed.onRemoveCondition) {
          const target = this.participants.get(entityId);
          if (target) {
            this.applyConditionToParticipant(target, removed.onRemoveCondition.condition, removed.onRemoveCondition.duration, removed.casterId);
          }
        }
      }
    }
  }

  /** Apply a condition to a combat participant's stats (bypasses Entity type requirement). */
  private applyConditionToParticipant(
    target: CombatParticipant,
    condition: import('@/types').ConditionType,
    duration: number,
    source: EntityId,
  ): void {
    const existing = target.stats.conditions.find(c => c.type === condition);
    if (existing) return; // Don't stack same condition
    target.stats.conditions.push({ type: condition, duration, source });
  }

  /** When true, combat events are queued instead of emitted immediately. */
  deferEvents = false;
  private deferredEventQueue: GameEvent[] = [];

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

  /** Emit an event immediately, or queue it if deferEvents is on. */
  private emitOrDefer(event: GameEvent): void {
    if (this.deferEvents) {
      this.deferredEventQueue.push(event);
    } else {
      this.events.emit(event);
    }
  }

  /** Flush all queued events (in order). */
  flushDeferredEvents(): void {
    const queued = this.deferredEventQueue.splice(0);
    for (const event of queued) {
      this.events.emit(event);
    }
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
    this.dodgingEntities.clear();
    this.concentrationDurations.clear();
    this.spellBuffs.clear();

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
    this.dodgingEntities.clear();

    return result;
  }

  // ── State ────────────────────────────────────────────────────

  getState(): CombatState {
    return { ...this.state };
  }

  getGrid(): Grid | null {
    return this.grid;
  }

  getTargeting(): TargetingSystem | null {
    return this.targeting;
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
        validBonusActions: [],
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

    // Resolve class-feature bonus actions from participant's features
    const validBonusActions: BonusActionOption[] = [];
    if (!turnState.bonusActionUsed) {
      for (const feature of p.stats.features) {
        const defs = CLASS_BONUS_ACTIONS.filter(ba => ba.featureId === feature.id);
        for (const def of defs) {
          const hasUses = def.usesPerRest < 0 || (feature.usesRemaining ?? 0) > 0;
          validBonusActions.push({
            id: def.id,
            name: def.name,
            description: def.description,
            enabled: hasUses,
            disabledReason: hasUses
              ? undefined
              : `Used (recharges on ${def.rechargeOn === 'shortRest' ? 'short' : 'long'} rest)`,
          });
        }
      }
    }

    // canAction is true if action is unused OR if there are Extra Attack strikes remaining
    const canAction = !turnState.actionUsed || (turnState.attacksUsed > 0 && turnState.attacksUsed < turnState.maxAttacks);

    // Action Surge: available if the entity has the feature with uses remaining and action is already used
    const actionSurgeFeature = p.stats.features.find(f => f.id === 'feature_action_surge');
    const actionSurgeAvailable = !!(actionSurgeFeature && (actionSurgeFeature.usesRemaining ?? 0) > 0 && turnState.actionUsed);

    return {
      canMove: remaining > 0,
      remainingMovement: remaining,
      canAction,
      canBonusAction: !turnState.bonusActionUsed,
      canReaction: !turnState.reactionUsed,
      validAttackTargets: attackTargets,
      validSpells,
      validMoveCells: new Set(reachable.keys()),
      validBonusActions,
      actionSurgeAvailable,
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

    // Allow attack if action is available OR if there are Extra Attack strikes remaining
    const canAttack = this.turnManager.canAction() || this.turnManager.hasAttacksRemaining();
    if (!p || !target || !canAttack) {
      return this.failResult(entityId, 'attack', 'Cannot attack.');
    }

    // Use one attack (only marks action used when all attacks are spent)
    this.turnManager.useAttack();

    // Pick the best attack based on distance to target
    const dist = this.grid ? this.grid.getEntityDistance(entityId, targetId) : 5;
    let attack: (typeof p.stats.attacks)[number] | null = p.stats.attacks[0] ?? null;

    // If target is beyond melee reach, prefer a ranged attack
    if (p.stats.attacks.length > 0) {
      const meleeAttacks = p.stats.attacks.filter(a => !a.rangeNormal || a.rangeNormal === 0);
      const rangedAttacks = p.stats.attacks.filter(a => a.rangeNormal && a.rangeNormal > 0);

      if (dist <= (attack?.reach ?? 5)) {
        // In melee — prefer melee weapon
        attack = meleeAttacks[0] ?? rangedAttacks[0] ?? attack;
      } else {
        // At range — use ranged weapon, validate range
        const validRanged = rangedAttacks.find(a => dist <= (a.rangeLong ?? a.rangeNormal ?? 0));
        attack = validRanged ?? null;
      }
    }

    let result: ActionResult;

    // Compute advantage/disadvantage from conditions (5e rules)
    const isMelee = !attack?.rangeNormal || attack.rangeNormal === 0;
    const { advantage: hasAdvantage, disadvantage: hasDisadvantage } =
      this.computeAttackAdvantage(p, target, isMelee);

    if (attack) {
      // Mirror Image: check if a duplicate absorbs the attack
      if (this.tryMirrorImageAbsorb(targetId)) {
        const mirrorResult: ActionResult = {
          success: false, type: 'attack', actorId: entityId, targetId,
          description: 'The attack strikes an illusory duplicate, which shatters and vanishes!',
          rolls: [],
        };
        this.emitOrDefer({ type: 'combat:action_result', category: 'combat', data: { result: mirrorResult } });
        return mirrorResult;
      }

      // Use raw attack data from stat block + buff modifiers
      const attackBuffMod = this.getBuffAttackMod(entityId);
      const rollResult = this.dice.rollD20({
        modifier: attack.toHitBonus + attackBuffMod,
        advantage: hasAdvantage,
        disadvantage: hasDisadvantage,
      });
      // AC includes buff modifiers (Shield, Shield of Faith, Haste, etc.)
      const baseAC = target.stats.armorClass;
      const buffedAC = Math.max(baseAC + this.getBuffACModifier(targetId), this.getBuffACFloor(targetId));
      const ac = Math.max(baseAC, buffedAC);
      const hit = rollResult.isCritical || (!rollResult.isFumble && rollResult.total >= ac);

      let damage = 0;
      const rolls = [rollResult];

      if (hit) {
        const dmgResult = this.combatRules.rollDamage(attack.damage, rollResult.isCritical);
        rolls.push(dmgResult);
        damage = Math.max(0, dmgResult.total);

        // Sneak Attack: once per turn, finesse/ranged weapon, advantage or ally adjacent
        const sneakDamage = this.applySneakAttack(entityId, targetId, p, attack, rollResult.isCritical, hasAdvantage);
        if (sneakDamage > 0) {
          damage += sneakDamage;
        }
      }

      result = {
        success: hit,
        type: 'attack',
        actorId: entityId,
        targetId,
        damage: hit ? damage : undefined,
        damageType: hit ? attack.damage.type : undefined,
        description: narrateAttack(attack.name, hit, damage, attack.damage.type, rollResult.total, ac),
        rolls,
      };

      // Apply damage
      if (hit && damage > 0) {
        this.applyDamageToParticipant(targetId, damage, attack.damage.type);

        // Slap save-or-die: DC 64 CON save or reduced to 0 HP
        // Note: save roll is NOT added to result.rolls to avoid triggering
        // the player dice animation — it's the monster's save, shown in text only.
        if (attack.name === 'Slap' && target.stats.currentHp > 0) {
          const conMod = abilityModifier(target.stats.abilityScores.constitution);
          const saveRoll = this.dice.rollD20({ modifier: conMod });
          const saved = saveRoll.total >= 64;
          if (!saved) {
            const overkill = target.stats.currentHp;
            this.applyDamageToParticipant(targetId, overkill, 'necrotic');
          }
          result.description += narrateSlapSave(saved, saveRoll.total);
        }
      }
    } else {
      // Unarmed strike fallback
      const strMod = abilityModifier(p.stats.abilityScores.strength);
      const prof = Math.floor((p.stats.level - 1) / 4) + 2;
      const rollResult = this.dice.rollD20({
        modifier: strMod + prof,
        advantage: hasAdvantage,
        disadvantage: hasDisadvantage,
      });
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
        description: narrateUnarmedStrike(hit, damage, rollResult.total, ac),
        rolls: [rollResult],
      };

      if (hit && damage > 0) {
        this.applyDamageToParticipant(targetId, damage, 'bludgeoning');
      }
    }

    // Prepend Divine Oracle flavor when Naelia is attacked and the feature triggers
    if (this.participantHasFeature(target, 'divine_oracle') && !result.success) {
      result.description = narrateDivineOracleAttack() + ' ' + result.description;
    }

    this.emitOrDefer({
      type: 'combat:attack',
      category: 'combat',
      data: { result },
    });

    this.checkCombatEnd();
    return result;
  }

  executeCastSpell(entityId: EntityId, spellId: string, slotLevel: number, targets: SpellTargeting): ActionResult {
    const p = this.participants.get(entityId);
    const spell = getSpell(spellId);

    if (!p || !this.grid || !this.targeting || !spell) {
      return this.failResult(entityId, 'cast_spell', 'Cannot cast spell.');
    }

    // Consume action or bonus action based on casting time
    const isBonusAction = spell.castingTime === '1 bonus action';
    if (isBonusAction) {
      if (!this.turnManager.canBonusAction()) {
        return this.failResult(entityId, 'cast_spell', 'No bonus action available.');
      }
      this.turnManager.useBonusAction();
    } else {
      if (!this.turnManager.canAction()) {
        return this.failResult(entityId, 'cast_spell', 'No action available.');
      }
      this.turnManager.useAction();
    }

    // Consume spell slot (on participant stats copy — controller syncs to real character)
    if (slotLevel > 0 && p.stats.spellcasting?.spellSlots[slotLevel]) {
      p.stats.spellcasting.spellSlots[slotLevel].current =
        Math.max(0, p.stats.spellcasting.spellSlots[slotLevel].current - 1);
    }

    // Handle concentration: if the new spell requires concentration,
    // break any existing concentration first, then set the new one
    if (spell.duration.type === 'concentration' && p.stats.spellcasting) {
      if (p.stats.spellcasting.concentration) {
        this.breakConcentration(entityId);
      }
      p.stats.spellcasting.concentration = spellId;
      // Track concentration duration (rounds) so it expires naturally
      if (spell.duration.value) {
        const durationRounds = spell.duration.value;
        this.concentrationDurations.set(entityId, durationRounds);
      }
    }

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

    // ── Compute caster stats ──
    const castingAbility = p.stats.spellcasting?.ability ?? 'intelligence';
    const castMod = abilityModifier(p.stats.abilityScores[castingAbility]);
    const prof = Math.floor((p.stats.level - 1) / 4) + 2;
    const spellSaveDC = 8 + prof + castMod;

    // ── Higher-level scaling ──
    // Clone effects and scale damage/effects for upcasting
    let scaledEffects = [...spell.effects];
    const levelDiff = slotLevel - spell.level;
    if (levelDiff > 0 && spell.higherLevelScaling) {
      const scaling = spell.higherLevelScaling;
      if (scaling.extraDicePerLevel) {
        // Add extra dice to the first damage/healing effect
        scaledEffects = scaledEffects.map((eff, i) => {
          if (i === 0 && eff.damage) {
            return { ...eff, damage: { ...eff.damage, count: eff.damage.count + (scaling.extraDicePerLevel! * levelDiff) } };
          }
          if (i === 0 && eff.healing) {
            return { ...eff, healing: { ...eff.healing, count: eff.healing.count + (scaling.extraDicePerLevel! * levelDiff) } };
          }
          return eff;
        });
      }
      if (scaling.extraEffectsPerLevel) {
        // Duplicate the first effect N times (Magic Missile darts, Scorching Ray rays)
        const template = scaledEffects[0];
        if (template) {
          for (let i = 0; i < scaling.extraEffectsPerLevel * levelDiff; i++) {
            scaledEffects.push({ ...template });
          }
        }
      }
    }

    // ── Determine spell category ──
    const hasSavingThrow = scaledEffects.some(e => e.savingThrow);
    const hasDamage = scaledEffects.some(e => e.damage);
    const hasHealing = scaledEffects.some(e => e.healing);
    const hasCondition = scaledEffects.some(e => e.condition);
    const isAutoHit = spell.id === 'spell_magic_missile' || spell.id === 'spell_guardian_of_faith';
    const isAreaSpell = spell.targetType === 'area' || spell.targetType === 'cone' ||
      spell.targetType === 'line' || spell.targetType === 'cube' ||
      spell.targetType === 'sphere' || spell.targetType === 'cylinder';

    const rolls: ActionResult['rolls'] = [];
    let totalDamage = 0;
    let totalHealing = 0;
    let damageType: string | undefined;
    let hit = true;
    let description = '';
    const conditionsApplied: string[] = [];

    const primaryTarget = affectedEntities[0] ? this.participants.get(affectedEntities[0]) : null;

    // ── Special-case spells with unique mechanics ──

    // Sleep / Color Spray: HP-pool mechanic (no save, affects weakest first)
    if (spell.id === 'spell_sleep' || spell.id === 'spell_color_spray') {
      const isSleep = spell.id === 'spell_sleep';
      const dieFace = isSleep ? 8 : 10;
      const baseDice = isSleep ? 5 : 6;
      const extraDice = spell.higherLevelScaling?.extraDicePerLevel
        ? spell.higherLevelScaling.extraDicePerLevel * Math.max(0, slotLevel - spell.level)
        : 0;
      const totalDice = baseDice + extraDice;

      // Roll HP pool
      const poolRoll = this.dice.rollDamage({ count: totalDice, die: dieFace as import('@/types').DieType, type: 'psychic' as import('@/types').DamageType });
      const hpPool = poolRoll.total;
      poolRoll.description = `${totalDice}d${dieFace} = ${hpPool} HP pool`;
      rolls.push(poolRoll);

      // Sort targets by current HP ascending
      const sortedTargets = affectedEntities
        .map(id => ({ id, hp: this.participants.get(id)?.stats.currentHp ?? Infinity }))
        .filter(t => t.hp > 0 && !this.casualties.includes(t.id))
        .sort((a, b) => a.hp - b.hp);

      const affected: string[] = [];
      let remaining = hpPool;
      for (const t of sortedTargets) {
        if (remaining <= 0) break;
        if (t.hp > remaining) break; // Can't affect creatures with HP > remaining pool
        remaining -= t.hp;
        const target = this.participants.get(t.id);
        if (target) {
          const condition = isSleep ? 'unconscious' : 'blinded';
          this.applyConditionToParticipant(target, condition as import('@/types').ConditionType, isSleep ? 100 : 1, entityId);
          affected.push(target.npc?.name ?? t.id);
          conditionsApplied.push(condition);
        }
      }

      const conditionName = isSleep ? 'sleep' : 'blindness';
      description = affected.length > 0
        ? (isSleep
          ? `A wave of magical drowsiness sweeps outward — ${affected.join(', ')} ${affected.length > 1 ? 'succumb' : 'succumbs'} to enchanted slumber. (${hpPool} HP pool)`
          : `A dazzling burst of color erupts — ${affected.join(', ')} ${affected.length > 1 ? 'are' : 'is'} blinded by the kaleidoscope of light. (${hpPool} HP pool)`)
        : `The ${conditionName} magic washes over the area, but no creature is weak enough to be affected. (${hpPool} HP pool)`;

      const result: ActionResult = {
        success: affected.length > 0, type: 'cast_spell', actorId: entityId,
        targetId: affectedEntities[0], description, rolls,
      };
      this.emitOrDefer({ type: 'combat:spell', category: 'combat', data: { entityId, spellId, targets, result } });
      this.emitOrDefer({ type: 'combat:action_result', category: 'combat', data: { result } });
      this.checkCombatEnd();
      return result;
    }

    // Power Word Stun: stun if HP ≤ 150, no save, 3 rounds
    if (spell.id === 'spell_power_word_stun' && primaryTarget) {
      if (primaryTarget.stats.currentHp <= 150) {
        this.applyConditionToParticipant(primaryTarget, 'stunned', 3, entityId);
        description = `A single word of absolute power reverberates through the air — the target is stunned, their mind overwhelmed. (HP ${primaryTarget.stats.currentHp} ≤ 150)`;
        hit = true;
      } else {
        description = `The word of power echoes, but the target's vitality is too great to be overcome. (HP ${primaryTarget.stats.currentHp} > 150)`;
        hit = false;
      }
      const result: ActionResult = {
        success: hit, type: 'cast_spell', actorId: entityId,
        targetId: affectedEntities[0], description, rolls,
      };
      this.emitOrDefer({ type: 'combat:spell', category: 'combat', data: { entityId, spellId, targets, result } });
      this.emitOrDefer({ type: 'combat:action_result', category: 'combat', data: { result } });
      return result;
    }

    // Power Word Kill: kill if HP ≤ 100, no save
    if (spell.id === 'spell_power_word_kill' && primaryTarget) {
      if (primaryTarget.stats.currentHp <= 100) {
        this.applyDamageToParticipant(affectedEntities[0], primaryTarget.stats.currentHp, 'necrotic');
        description = 'A single word of absolute power is spoken. The target simply... dies. No save. No resistance. Just silence.';
        hit = true;
      } else {
        description = `The word of killing reverberates, but the target's life force burns too strongly to be snuffed out. (HP ${primaryTarget.stats.currentHp} > 100)`;
        hit = false;
      }
      const result: ActionResult = {
        success: hit, type: 'cast_spell', actorId: entityId,
        targetId: affectedEntities[0], description, rolls,
      };
      this.emitOrDefer({ type: 'combat:spell', category: 'combat', data: { entityId, spellId, targets, result } });
      this.emitOrDefer({ type: 'combat:action_result', category: 'combat', data: { result } });
      this.checkCombatEnd();
      return result;
    }

    // Contagion: simplified — poisoned for 10 rounds on melee spell attack hit
    if (spell.id === 'spell_contagion' && primaryTarget) {
      const attackBonus = castMod + prof;
      const ac = primaryTarget.stats.armorClass;
      const attackRoll = this.dice.rollD20({ modifier: attackBonus });
      rolls.push(attackRoll);
      hit = attackRoll.isCritical || (!attackRoll.isFumble && attackRoll.total >= ac);
      if (hit) {
        this.applyConditionToParticipant(primaryTarget, 'poisoned', 10, entityId);
        description = `A diseased hand reaches out and touches the target — virulent plague seeps into their body, poisoning them from within. (${attackRoll.total} vs AC ${ac})`;
      } else {
        description = `The plague-bearing hand reaches out but misses — the disease finds no purchase. (${attackRoll.total} vs AC ${ac})`;
      }
      const result: ActionResult = {
        success: hit, type: 'cast_spell', actorId: entityId,
        targetId: affectedEntities[0], description, rolls,
      };
      this.emitOrDefer({ type: 'combat:spell', category: 'combat', data: { entityId, spellId, targets, result } });
      this.emitOrDefer({ type: 'combat:action_result', category: 'combat', data: { result } });
      return result;
    }

    // ── Standard spell paths ──

    if (hasSavingThrow && (primaryTarget || isAreaSpell)) {
      // ── Saving throw spell ──
      // Per-entity saves for area spells (D&D 5e: each creature rolls individually)
      const saveEffect = scaledEffects.find(e => e.savingThrow)!;
      const saveAbility = saveEffect.savingThrow!.ability;

      // Roll damage once (shared across all targets)
      let baseDamage = 0;
      for (const effect of scaledEffects) {
        if (effect.damage) {
          const dmgResult = this.combatRules.rollDamage(effect.damage, false);
          rolls.push(dmgResult);
          baseDamage += Math.max(0, dmgResult.total);
          damageType = effect.damage.type;
        }
      }

      // Each entity rolls their own save
      const perEntityResults: { id: EntityId; saved: boolean; damage: number; saveTotal: number }[] = [];
      for (const targetId of affectedEntities) {
        const target = this.participants.get(targetId);
        if (!target) continue;

        const targetMod = abilityModifier(target.stats.abilityScores[saveAbility]);
        // Add saving throw proficiency if applicable
        let saveProfBonus = 0;
        if (target.savingThrowProficiencies?.includes(saveAbility)) {
          saveProfBonus = Math.floor((target.stats.level - 1) / 4) + 2;
        }

        const { advantage: saveAdv, disadvantage: saveDisadv } =
          this.computeSaveAdvantage(target, saveAbility);
        const saveRoll = this.dice.rollD20({
          modifier: targetMod + saveProfBonus + this.getBuffSaveMod(targetId),
          advantage: saveAdv,
          disadvantage: saveDisadv,
        });
        // Only push the first save roll to avoid UI clutter
        saveRoll.rollerEntityId = targetId;
        if (perEntityResults.length === 0) rolls.push(saveRoll);
        const saved = saveRoll.total >= spellSaveDC;
        const entityDamage = saved ? Math.floor(baseDamage / 2) : baseDamage;

        perEntityResults.push({ id: targetId, saved, damage: entityDamage, saveTotal: saveRoll.total });

        // Apply conditions on failed save
        if (!saved && hasCondition) {
          for (const effect of scaledEffects) {
            if (effect.condition) {
              const condDuration = spell.duration.value ?? 10; // Default 10 rounds for concentration
              this.applyConditionToParticipant(target, effect.condition, condDuration, entityId);
              conditionsApplied.push(effect.condition);
            }
          }
        }
      }

      // Compute total damage (sum across entities for display)
      totalDamage = perEntityResults.length === 1
        ? perEntityResults[0].damage
        : baseDamage; // Show base damage for area spells

      // Apply damage per-entity
      for (const er of perEntityResults) {
        if (er.damage > 0) {
          this.applyDamageToParticipant(er.id, er.damage, damageType ?? 'force');
        }
      }

      // Narrate based on primary target's result
      const primary = perEntityResults[0];
      if (primary) {
        const primaryTarget_ = this.participants.get(primary.id);
        // Prepend divine feature flavor when Naelia saves
        let featureFlavor = '';
        if (primary.saved && primaryTarget_) {
          if (this.participantHasFeature(primaryTarget_, 'divine_oracle')) {
            featureFlavor = narrateDivineOracleSave() + ' ';
          } else if (this.participantHasFeature(primaryTarget_, 'greater_magic_immunity')) {
            featureFlavor = narrateGreaterMagicImmunity() + ' ';
          }
        }
        description = featureFlavor + narrateSpellSave(spell.name, primary.saved, primary.damage, damageType ?? 'magical', primary.saveTotal, spellSaveDC);
        if (conditionsApplied.length > 0 && !primary.saved) {
          description += ` (${conditionsApplied.join(', ')} applied)`;
        }
      } else {
        description = narrateBuff(spell.name);
      }

    } else if (isAutoHit) {
      // ── Auto-hit spell (Magic Missile, Guardian of Faith) ──
      for (const effect of scaledEffects) {
        if (effect.damage) {
          const dmgResult = this.combatRules.rollDamage(effect.damage, false);
          rolls.push(dmgResult);
          totalDamage += Math.max(0, dmgResult.total);
          damageType = effect.damage.type;
        }
      }
      description = narrateSpellAutoHit(spell.name, totalDamage, damageType ?? 'force');

    } else if (hasDamage && primaryTarget) {
      // ── Spell attack roll (Fire Bolt, Ray of Frost, Scorching Ray) ──
      const attackBonus = castMod + prof;
      const ac = primaryTarget.stats.armorClass;

      const { advantage: spellAdv, disadvantage: spellDisadv } =
        this.computeAttackAdvantage(p, primaryTarget, /* isMelee */ false);
      const attackRoll = this.dice.rollD20({
        modifier: attackBonus,
        advantage: spellAdv,
        disadvantage: spellDisadv,
      });
      rolls.push(attackRoll);
      hit = attackRoll.isCritical || (!attackRoll.isFumble && attackRoll.total >= ac);

      if (hit) {
        for (const effect of scaledEffects) {
          if (effect.damage) {
            const dmgResult = this.combatRules.rollDamage(effect.damage, attackRoll.isCritical);
            rolls.push(dmgResult);
            totalDamage += Math.max(0, dmgResult.total);
            damageType = effect.damage.type;
          }
        }
        // Apply conditions on hit (spell attacks that also apply conditions)
        if (hasCondition) {
          for (const effect of scaledEffects) {
            if (effect.condition) {
              const condDuration = spell.duration.value ?? 1;
              this.applyConditionToParticipant(primaryTarget, effect.condition, condDuration, entityId);
              conditionsApplied.push(effect.condition);
            }
          }
        }
      }

      description = narrateSpellAttack(spell.name, hit, totalDamage, damageType ?? 'magical', attackRoll.total, ac);
      if (hit && conditionsApplied.length > 0) {
        description += ` (${conditionsApplied.join(', ')} applied)`;
      }

    } else if (hasHealing) {
      // ── Healing spell (Cure Wounds, Healing Word) ──
      for (const effect of scaledEffects) {
        if (effect.healing) {
          const healResult = this.dice.rollDamage(effect.healing);
          rolls.push(healResult);
          totalHealing += Math.max(0, healResult.total + castMod);
        }
      }
      description = narrateHealing(spell.name, totalHealing);

    } else if (hasCondition) {
      // ── Condition-only spell with saving throw (Hold Person, Blindness) ──
      // These have conditions but no damage
      const saveEffect = scaledEffects.find(e => e.savingThrow);
      if (saveEffect && primaryTarget) {
        const saveAbility = saveEffect.savingThrow!.ability;
        const targetMod = abilityModifier(primaryTarget.stats.abilityScores[saveAbility]);
        const { advantage: saveAdv, disadvantage: saveDisadv } =
          this.computeSaveAdvantage(primaryTarget, saveAbility);
        const saveRoll = this.dice.rollD20({
          modifier: targetMod,
          advantage: saveAdv,
          disadvantage: saveDisadv,
        });
        saveRoll.rollerEntityId = affectedEntities[0];
        rolls.push(saveRoll);
        const saved = saveRoll.total >= spellSaveDC;

        if (!saved) {
          for (const effect of scaledEffects) {
            if (effect.condition) {
              const condDuration = spell.duration.value ?? 10;
              this.applyConditionToParticipant(primaryTarget, effect.condition, condDuration, entityId);
              conditionsApplied.push(effect.condition);
            }
          }
        }

        description = narrateSpellSave(spell.name, saved, 0, 'magical', saveRoll.total, spellSaveDC);
        if (!saved && conditionsApplied.length > 0) {
          description += ` (${conditionsApplied.join(', ')} applied)`;
        }
        hit = !saved;
      } else {
        // No save — apply conditions directly (buffs like Invisibility on self)
        const target = primaryTarget ?? p;
        for (const effect of scaledEffects) {
          if (effect.condition) {
            const condDuration = spell.duration.value ?? 10;
            this.applyConditionToParticipant(target, effect.condition, condDuration, entityId);
            conditionsApplied.push(effect.condition);
          }
        }
        description = narrateBuff(spell.name);
        if (conditionsApplied.length > 0) {
          description += ` (${conditionsApplied.join(', ')} applied)`;
        }
      }

    } else {
      // ── Utility / buff spell — apply specific mechanics ──
      const isConc = spell.duration.type === 'concentration';
      const buffDuration = spell.duration.value ?? (isConc ? 100 : 1); // 100 rounds for long-duration concentration

      switch (spell.id) {
        case 'spell_bless': {
          // +2 flat to attacks and saves for up to 3 allies
          const targets = affectedEntities.length > 0 ? affectedEntities : [entityId];
          for (const tid of targets.slice(0, 3)) {
            this.addSpellBuff(tid, { spellId: spell.id, casterId: entityId, attackMod: 2, saveMod: 2, duration: buffDuration, concentration: isConc });
          }
          break;
        }
        case 'spell_bane': {
          // -2 to attacks and saves (targets make CHA save)
          for (const tid of affectedEntities.slice(0, 3)) {
            const t = this.participants.get(tid);
            if (!t) continue;
            const chaMod = abilityModifier(t.stats.abilityScores.charisma);
            const saveRoll = this.dice.rollD20({ modifier: chaMod });
            if (saveRoll.total < spellSaveDC) {
              this.addSpellBuff(tid, { spellId: spell.id, casterId: entityId, attackMod: -2, saveMod: -2, duration: buffDuration, concentration: isConc });
            }
          }
          break;
        }
        case 'spell_shield': {
          // +5 AC until start of next turn (1 round)
          this.addSpellBuff(entityId, { spellId: spell.id, casterId: entityId, acMod: 5, duration: 1 });
          break;
        }
        case 'spell_shield_of_faith': {
          // +2 AC, concentration
          const shieldTarget = affectedEntities[0] ?? entityId;
          this.addSpellBuff(shieldTarget, { spellId: spell.id, casterId: entityId, acMod: 2, duration: buffDuration, concentration: isConc });
          break;
        }
        case 'spell_mage_armor': {
          // Set AC to 13 + DEX if higher
          const maTarget = affectedEntities[0] ?? entityId;
          const maParticipant = this.participants.get(maTarget);
          if (maParticipant) {
            const dexMod = abilityModifier(maParticipant.stats.abilityScores.dexterity);
            const mageAC = 13 + dexMod;
            if (mageAC > maParticipant.stats.armorClass) {
              maParticipant.stats.armorClass = mageAC;
            }
          }
          break;
        }
        case 'spell_barkskin': {
          // AC floor of 16
          const barkTarget = affectedEntities[0] ?? entityId;
          this.addSpellBuff(barkTarget, { spellId: spell.id, casterId: entityId, acFloor: 16, duration: buffDuration, concentration: isConc });
          break;
        }
        case 'spell_haste': {
          // +2 AC, double speed. On removal: stunned 1 round
          const hasteTarget = affectedEntities[0] ?? entityId;
          this.addSpellBuff(hasteTarget, {
            spellId: spell.id, casterId: entityId,
            acMod: 2, speedMult: 2,
            duration: buffDuration, concentration: isConc,
            onRemoveCondition: { condition: 'stunned', duration: 1 },
          });
          break;
        }
        case 'spell_blur': {
          // Attacks against caster have disadvantage
          this.addSpellBuff(entityId, { spellId: spell.id, casterId: entityId, attackDisadvantageAgainst: true, duration: buffDuration, concentration: isConc });
          break;
        }
        case 'spell_mirror_image': {
          // 3 duplicates, each can absorb a hit
          this.addSpellBuff(entityId, { spellId: spell.id, casterId: entityId, mirrorImageCharges: 3, duration: buffDuration });
          break;
        }
        case 'spell_slow': {
          // Halve speed, -2 AC (WIS save to resist)
          for (const tid of affectedEntities.slice(0, 6)) {
            const t = this.participants.get(tid);
            if (!t) continue;
            const wisMod = abilityModifier(t.stats.abilityScores.wisdom);
            const saveRoll = this.dice.rollD20({ modifier: wisMod });
            if (saveRoll.total < spellSaveDC) {
              this.addSpellBuff(tid, { spellId: spell.id, casterId: entityId, acMod: -2, speedMult: 0.5, duration: buffDuration, concentration: isConc });
            }
          }
          break;
        }
        case 'spell_bestow_curse': {
          // Disadvantage on all saves (WIS save to resist)
          if (primaryTarget) {
            const wisMod = abilityModifier(primaryTarget.stats.abilityScores.wisdom);
            const saveRoll = this.dice.rollD20({ modifier: wisMod });
            if (saveRoll.total < spellSaveDC) {
              this.addSpellBuff(affectedEntities[0], { spellId: spell.id, casterId: entityId, saveDisadvantage: true, duration: buffDuration, concentration: isConc });
            }
          }
          break;
        }
        default:
          break;
      }

      description = narrateBuff(spell.name);
    }

    const result: ActionResult = {
      success: hit,
      type: 'cast_spell',
      actorId: entityId,
      targetId: affectedEntities[0],
      damage: totalDamage > 0 ? totalDamage : undefined,
      damageType: damageType as ActionResult['damageType'],
      healing: totalHealing > 0 ? totalHealing : undefined,
      description,
      rolls,
    };

    // Emit spell event BEFORE applying damage so narrative order is correct
    this.emitOrDefer({
      type: 'combat:spell',
      category: 'combat',
      data: { entityId, spellId, targets, result },
    });

    this.emitOrDefer({
      type: 'combat:action_result',
      category: 'combat',
      data: { result },
    });

    // Apply damage for auto-hit and spell attacks (save spells already applied above)
    if (!hasSavingThrow && hit && totalDamage > 0) {
      for (const targetId of affectedEntities) {
        this.applyDamageToParticipant(targetId, totalDamage, damageType ?? 'force');
      }
    }

    // Apply healing
    if (totalHealing > 0) {
      const healTarget = affectedEntities[0] ?? entityId;
      const hp = this.participants.get(healTarget);
      if (hp) {
        hp.stats.currentHp = Math.min(hp.stats.maxHp, hp.stats.currentHp + totalHealing);
      }
    }

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

    // Track dodge status: attacks against this entity have disadvantage,
    // and it has advantage on Dex saves. Lasts until start of its next turn.
    this.dodgingEntities.add(entityId);

    const result: ActionResult = {
      success: true,
      type: 'dodge',
      actorId: entityId,
      description: 'Takes the Dodge action. Attacks against have disadvantage, advantage on Dex saves.',
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

    this.turnManager.disengage();

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

  // ── Action Surge ────────────────────────────────────────────

  /**
   * Execute Action Surge: reset the action for this turn (granting an additional action).
   * This is a free action, not a bonus action.
   */
  executeActionSurge(entityId: EntityId): ActionResult {
    const p = this.participants.get(entityId);
    if (!p) return this.failResult(entityId, 'class_feature', 'Cannot use Action Surge.');

    const feature = p.stats.features.find(f => f.id === 'feature_action_surge');
    if (!feature || (feature.usesRemaining ?? 0) <= 0) {
      return this.failResult(entityId, 'class_feature', 'Action Surge already used.');
    }

    // Decrement uses on the combat participant's copy
    feature.usesRemaining = (feature.usesRemaining ?? 0) - 1;

    // Reset the action (and attack counter) — grants another full action
    this.turnManager.resetAction();

    const result: ActionResult = {
      success: true,
      type: 'class_feature',
      actorId: entityId,
      description: 'Action Surge! You push beyond your limits, gaining an additional action.',
      rolls: [],
    };

    this.emitOrDefer({
      type: 'combat:action',
      category: 'combat',
      data: { entityId, action: 'action_surge', result },
    });

    return result;
  }

  // ── Sneak Attack ───────────────────────────────────────────

  /**
   * Check and apply Sneak Attack damage if conditions are met.
   * Returns the extra damage dealt (0 if conditions not met).
   */
  private applySneakAttack(
    attackerId: EntityId,
    targetId: EntityId,
    attacker: CombatParticipant,
    attack: { rangeNormal?: number; reach?: number },
    isCritical: boolean,
    hadAdvantage = false,
  ): number {
    // Must have sneak attack feature and not have used it this turn
    const sneakFeature = attacker.stats.features.find(f => f.id === 'feature_sneak_attack');
    if (!sneakFeature || this.turnManager.sneakAttackUsed) return 0;

    // Check weapon: must be finesse or ranged
    const isRanged = (attack.rangeNormal ?? 0) > 0;

    // For melee attacks, check if the weapon is finesse by looking at participant equipment
    let isFinesse = false;
    if (attacker.equipment?.weapons) {
      for (const weapon of attacker.equipment.weapons) {
        if (weapon.itemType === 'weapon' && weapon.properties) {
          const props = weapon.properties as { tags?: string[] };
          if (props.tags?.includes('finesse')) {
            isFinesse = true;
            break;
          }
        }
      }
    }
    // Entities with Sneak Attack typically use finesse weapons (rapier, dagger).
    // When equipment data isn't available on the participant, assume melee attacks
    // from sneak-attack-capable entities use finesse weapons.
    if (!isFinesse && !isRanged) {
      isFinesse = true;
    }

    if (!isRanged && !isFinesse) return 0;

    // Check condition: advantage OR ally adjacent to target
    const allies = this.getAlliesOf(attackerId);
    let hasAdjacentAlly = false;
    if (this.grid) {
      for (const allyId of allies) {
        const dist = this.grid.getEntityDistance(allyId, targetId);
        if (dist <= 5) {
          hasAdjacentAlly = true;
          break;
        }
      }
    }

    // Per 5e: Sneak Attack triggers with advantage OR adjacent ally
    if (!hasAdjacentAlly && !hadAdvantage) return 0;

    // Calculate sneak attack dice: Math.ceil(level / 2) d6
    const sneakDice = Math.ceil(attacker.stats.level / 2);
    let sneakDamage = 0;
    const diceCount = isCritical ? sneakDice * 2 : sneakDice;
    for (let i = 0; i < diceCount; i++) {
      sneakDamage += this.dice.roll(6);
    }

    this.turnManager.useSneakAttack();

    this.emitOrDefer({
      type: 'combat:action',
      category: 'combat',
      data: { entityId: attackerId, action: 'sneak_attack', sneakDamage, sneakDice },
    });

    return sneakDamage;
  }

  // ── Class-Feature Bonus Actions ─────────────────────────────

  executeBonusAction(entityId: EntityId, bonusActionId: string): ActionResult {
    const p = this.participants.get(entityId);
    if (!p || !this.turnManager.canBonusAction()) {
      return this.failResult(entityId, 'class_feature', 'No bonus action available.');
    }

    const def = getBonusAction(bonusActionId);
    if (!def) return this.failResult(entityId, 'class_feature', 'Unknown bonus action.');

    // Check limited uses
    const feature = p.stats.features.find(f => f.id === def.featureId);
    if (def.usesPerRest > 0) {
      if (!feature || (feature.usesRemaining ?? 0) <= 0) {
        return this.failResult(entityId, 'class_feature', `${def.name} already used.`);
      }
    }

    // Consume the use (if limited)
    if (def.usesPerRest > 0 && feature) {
      feature.usesRemaining = (feature.usesRemaining ?? 0) - 1;
    }

    // Execute effect
    switch (def.effect.type) {
      case 'heal':
        return this.executeBonusHeal(entityId, def, p);
      case 'grant_action':
        return this.executeBonusGrantAction(entityId, def);
    }
  }

  private executeBonusHeal(
    entityId: EntityId,
    def: ClassBonusActionDef,
    p: CombatParticipant,
  ): ActionResult {
    this.turnManager.useBonusAction();

    const eff = def.effect as import('@/data/bonusActions').HealEffect;
    const bonus = eff.bonusPerLevel ? p.stats.level : 0;
    const die = eff.dice.die;
    const rolls = this.dice.rollMultiple(eff.dice.count, die);
    const total = rolls.reduce((s, r) => s + r, 0) + bonus;
    const healing = Math.max(0, total);

    const oldHp = p.stats.currentHp;
    p.stats.currentHp = Math.min(p.stats.maxHp, p.stats.currentHp + healing);
    const actualHealing = p.stats.currentHp - oldHp;

    const rollResult: import('@/types').DiceRollResult = {
      total: healing,
      rolls,
      modifier: bonus,
      isCritical: false,
      isFumble: false,
      advantage: false,
      disadvantage: false,
      description: `${eff.dice.count}d${die}(${rolls.join('+')})${bonus ? `+${bonus}` : ''} = ${healing} healing`,
      dieType: die,
    };

    const result: ActionResult = {
      success: true,
      type: 'class_feature',
      actorId: entityId,
      healing: actualHealing,
      description: narrateFeatureHealing(def.name, actualHealing),
      rolls: [rollResult],
    };

    this.emitOrDefer({
      type: 'combat:bonus_action',
      category: 'combat',
      data: { entityId, bonusActionId: def.id, result },
    });

    return result;
  }

  private executeBonusGrantAction(
    entityId: EntityId,
    def: ClassBonusActionDef,
  ): ActionResult {
    const eff = def.effect as { type: 'grant_action'; grantedAction: string };

    switch (eff.grantedAction) {
      case 'dash':
        this.turnManager.bonusDash();
        break;
      case 'disengage':
        this.turnManager.bonusDisengage();
        break;
      case 'hide':
        // Consume bonus action; hide condition is a stub for now
        this.turnManager.useBonusAction();
        break;
      default:
        this.turnManager.useBonusAction();
    }

    const result: ActionResult = {
      success: true,
      type: 'class_feature',
      actorId: entityId,
      description: def.description,
      rolls: [],
    };

    this.emitOrDefer({
      type: 'combat:bonus_action',
      category: 'combat',
      data: { entityId, bonusActionId: def.id, result },
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
    const { movementPath, results } = this.planAndExecuteNPCTurn(entityId);
    void movementPath; // movement already executed
    return results;
  }

  /**
   * Plan an NPC turn: returns the movement path (for animation) and
   * executes movement + actions, returning results.
   */
  planAndExecuteNPCTurn(entityId: EntityId): { movementPath: Coordinate[]; results: ActionResult[] } {
    const results: ActionResult[] = [];
    const p = this.participants.get(entityId);
    if (!p || !this.combatAI || !this.grid) return { movementPath: [], results };

    const available = this.getAvailableActions(entityId);
    const enemies = this.getEnemiesOf(entityId);
    const allies = this.getAlliesOf(entityId);

    // Get NPC data for AI
    const npc = p.npc;
    if (!npc) {
      // Simple monster: plan movement + attack
      return this.planSimpleMonsterTurn(entityId, available, enemies);
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

    const movementPath = plan.movement && plan.movement.length > 1 ? plan.movement : [];
    this.executePlan(entityId, plan, results);
    return { movementPath, results };
  }

  /**
   * Execute only the attack/action part of an NPC turn (movement done separately).
   */
  executeNPCActions(entityId: EntityId, plan: { action?: { type: string; targetId?: EntityId }; bonusAction?: { type: string; targetId?: EntityId } }): ActionResult[] {
    const results: ActionResult[] = [];
    if (plan.action) {
      const r = this.executeAction(entityId, plan.action);
      if (r) results.push(r);
    }
    if (plan.bonusAction) {
      const r = this.executeAction(entityId, plan.bonusAction);
      if (r) results.push(r);
    }
    return results;
  }

  private planSimpleMonsterTurn(
    entityId: EntityId,
    available: AvailableActions,
    enemies: EntityId[],
  ): { movementPath: Coordinate[]; results: ActionResult[] } {
    const results: ActionResult[] = [];
    let movementPath: Coordinate[] = [];
    if (!this.grid) return { movementPath, results };

    const p = this.participants.get(entityId);
    if (!p) return { movementPath, results };

    const pos = this.grid.getEntityPosition(entityId);
    if (!pos) return { movementPath, results };

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

    if (!nearestEnemy) return { movementPath, results };

    const targetPos = this.grid.getEntityPosition(nearestEnemy);
    if (!targetPos) return { movementPath, results };

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
        movementPath = path.path;
        const moveResult = this.executeMove(entityId, path.path);
        results.push(...moveResult.opportunityAttacks);
      }
    }

    // Recompute valid targets after movement (position changed)
    const updatedActions = this.getAvailableActions(entityId);

    // Attack if in range
    if (updatedActions.canAction && updatedActions.validAttackTargets.includes(nearestEnemy)) {
      const attackResult = this.executeAttack(entityId, nearestEnemy);
      results.push(attackResult);
    } else if (updatedActions.canAction) {
      // Dash toward target if can't reach
      const dashResult = this.executeDash(entityId);
      results.push(dashResult);
    }

    return { movementPath, results };
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

    // Recompute valid targets after movement (position changed)
    const updatedActions = this.getAvailableActions(entityId);

    // Action — revalidate attack target is in range after movement
    if (plan.action) {
      if (plan.action.type === 'attack' && plan.action.targetId) {
        if (updatedActions.validAttackTargets.includes(plan.action.targetId)) {
          const actionResult = this.executeAction(entityId, plan.action);
          if (actionResult) results.push(actionResult);
        }
        // If target no longer in range, skip the attack
      } else {
        const actionResult = this.executeAction(entityId, plan.action);
        if (actionResult) results.push(actionResult);
      }
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

    // Disengage prevents opportunity attacks for this turn
    if (this.turnManager.disengaged) return results;

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
        description: narrateOpportunityAttack(attack.name, hit, damage),
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

    // Apply speed from conditions and spell buffs
    let speed = p.stats.speed;
    if (p.npc) {
      speed = Math.floor(speed * this.conditionRules.getSpeedMultiplier(p.npc));
    }
    speed = Math.floor(speed * this.getBuffSpeedMult(current.entityId));

    this.turnManager.startTurn(current.entityId, speed);

    // Dodge expires at the start of the dodging creature's next turn
    this.dodgingEntities.delete(current.entityId);

    // Tick concentration duration — break if expired
    const concDuration = this.concentrationDurations.get(current.entityId);
    if (concDuration !== undefined) {
      const remaining = concDuration - 1;
      if (remaining <= 0) {
        this.concentrationDurations.delete(current.entityId);
        this.breakConcentration(current.entityId);
      } else {
        this.concentrationDurations.set(current.entityId, remaining);
      }
    }

    // Tick conditions (decrement durations, remove expired)
    const conditions = p.stats.conditions;
    for (let i = conditions.length - 1; i >= 0; i--) {
      const cond = conditions[i];
      if (cond.duration !== undefined) {
        cond.duration--;
        if (cond.duration <= 0) {
          conditions.splice(i, 1);
        }
      }
    }

    // Tick spell buff durations
    this.tickSpellBuffs(current.entityId);

    // Set max attacks based on Extra Attack feature
    const hasExtraAttack = p.stats.features.some(f => f.id === 'feature_extra_attack');
    this.turnManager.setMaxAttacks(hasExtraAttack ? 2 : 1);

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

    this.emitOrDefer({
      type: 'combat:damage',
      category: 'combat',
      data: { targetId, damage, damageType, remainingHp: newHp },
    });

    // Concentration check: if the damaged entity is concentrating, they must save
    if (newHp > 0) {
      this.checkConcentrationOnDamage(targetId, damage);
    }
  }

  private handleDeath(entityId: EntityId): void {
    if (this.casualties.includes(entityId)) return;

    // Break concentration on death
    this.breakConcentration(entityId);
    // Clear dodge status on death
    this.dodgingEntities.delete(entityId);

    this.casualties.push(entityId);

    // Remove from grid
    this.grid?.removeEntity(entityId);
    this.initiative.removeCombatant(entityId);

    this.emitOrDefer({
      type: 'combat:kill',
      category: 'combat',
      data: { entityId },
    });
  }

  /**
   * Break concentration for a participant.
   * Clears the concentration spell, emits an event, and removes any
   * spell-applied conditions that were sourced from the concentration spell.
   */
  private breakConcentration(entityId: EntityId): void {
    const p = this.participants.get(entityId);
    if (!p || !p.stats.spellcasting?.concentration) return;

    const spellId = p.stats.spellcasting.concentration;
    const spell = getSpell(spellId);
    const spellName = spell?.name ?? spellId;

    p.stats.spellcasting.concentration = null;

    // Remove any conditions applied by this concentration spell
    // (e.g. Shield of Faith applies an AC buff tracked as a condition)
    if (spell) {
      for (const effect of spell.effects) {
        if (effect.condition) {
          // Remove the condition from all participants that have it sourced from this caster
          for (const [, target] of this.participants) {
            const condIdx = target.stats.conditions.findIndex(
              c => c.type === effect.condition && c.source === entityId,
            );
            if (condIdx !== -1) {
              target.stats.conditions.splice(condIdx, 1);
            }
          }
        }
      }
    }

    // Remove spell buffs from this caster's concentration (triggers on-remove effects like Haste lethargy)
    this.removeConcentrationBuffs(entityId);

    this.emitOrDefer({
      type: 'combat:concentration_broken',
      category: 'combat',
      data: { entityId, spellId, spellName, isPlayer: p.isPlayer },
    });
  }

  /**
   * Roll a Constitution saving throw to maintain concentration after taking damage.
   * DC = max(10, floor(damage / 2)) per 5e rules.
   */
  private checkConcentrationOnDamage(entityId: EntityId, damage: number): void {
    const p = this.participants.get(entityId);
    if (!p || !p.stats.spellcasting?.concentration) return;

    const dc = Math.max(10, Math.floor(damage / 2));
    const conMod = abilityModifier(p.stats.abilityScores.constitution);

    // Check if this participant is proficient in CON saves
    const hasProficiency = p.savingThrowProficiencies?.includes('constitution') ?? false;
    const prof = hasProficiency ? Math.floor((p.stats.level - 1) / 4) + 2 : 0;
    const totalMod = conMod + prof;

    const { result, success } = this.dice.rollCheck(totalMod, dc);

    const spellId = p.stats.spellcasting.concentration;
    const spell = getSpell(spellId);
    const spellName = spell?.name ?? spellId;

    this.emitOrDefer({
      type: 'combat:concentration_check',
      category: 'combat',
      data: {
        entityId,
        spellName,
        dc,
        roll: result,
        success,
        isPlayer: p.isPlayer,
      },
    });

    if (!success) {
      this.breakConcentration(entityId);
    }
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

  private getValidSpellOptions(entityId: EntityId, p: CombatParticipant): SpellOption[] {
    const sc = p.stats.spellcasting;
    if (!sc) return [];

    const turnState = this.turnManager.getTurnState();
    const canAction = !turnState.actionUsed;
    const canBonus = !turnState.bonusActionUsed;

    // Collect all castable spell IDs: cantrips + prepared spells
    const allSpellIds = [...(sc.cantripsKnown ?? []), ...(sc.preparedSpells ?? [])];
    const options: SpellOption[] = [];
    const enemies = this.getEnemiesOf(entityId);
    const pos = this.grid?.getEntityPosition(entityId);

    for (const spellId of allSpellIds) {
      const spell = getSpell(spellId);
      if (!spell) continue;

      // Skip non-combat spells — must have mechanical effects or be a known combat buff
      const hasCombatEffect = spell.effects.some(e => e.damage || e.healing || e.condition);
      const isKnownBuff = ['spell_bless', 'spell_bane', 'spell_shield', 'spell_shield_of_faith',
        'spell_mage_armor', 'spell_barkskin', 'spell_haste', 'spell_blur', 'spell_mirror_image',
        'spell_slow', 'spell_bestow_curse', 'spell_sleep', 'spell_color_spray',
        'spell_expeditious_retreat', 'spell_longstrider', 'spell_protection_from_evil_and_good',
        'spell_sanctuary', 'spell_warding_bond', 'spell_spirit_guardians',
        'spell_death_ward', 'spell_freedom_of_movement', 'spell_stoneskin',
        'spell_true_seeing', 'spell_globe_of_invulnerability', 'spell_antimagic_field',
        'spell_foresight', 'spell_true_strike'].includes(spell.id);
      if (!hasCombatEffect && !isKnownBuff) continue;

      // Skip spells that aren't verified to work in combat
      const DISABLED_SPELLS = new Set([
        'spell_maze', 'spell_mislead', 'spell_dominate_beast', 'spell_dominate_person',
        'spell_dominate_monster', 'spell_geas', 'spell_modify_memory',
        'spell_raise_dead', 'spell_resurrection', 'spell_true_resurrection',
        'spell_revivify', 'spell_goodberry', 'spell_mass_suggestion',
        'spell_animal_friendship', 'spell_crown_of_madness', 'spell_eyebite',
        'spell_flesh_to_stone',
      ]);
      if (DISABLED_SPELLS.has(spell.id)) continue;

      const isCantrip = spell.level === 0;
      const isBonusAction = spell.castingTime === '1 bonus action';

      // Check action economy
      if (isBonusAction && !canBonus) continue;
      if (!isBonusAction && !canAction) continue;

      // Check spell slot availability for leveled spells
      let slotLevel = spell.level;
      if (!isCantrip) {
        const slot = sc.spellSlots[slotLevel];
        if (!slot || slot.current <= 0) continue;
      } else {
        slotLevel = 0;
      }

      // Determine valid targets based on spell type
      const validTargets: EntityId[] = [];
      const hasHealing = spell.effects.some(e => e.healing);

      if (hasHealing) {
        // Healing spells target self in solo play
        validTargets.push(entityId);
      } else if (spell.targetType === 'self' || spell.range === 0) {
        // Self/area spells — valid if any enemies exist
        if (enemies.length > 0) validTargets.push(...enemies);
      } else {
        // Targeted spells — check range
        const spellRange = spell.range > 0 ? spell.range : 5; // touch = 5ft
        if (pos && this.grid) {
          for (const enemyId of enemies) {
            if (this.casualties.includes(enemyId)) continue;
            const enemyPos = this.grid.getEntityPosition(enemyId);
            if (!enemyPos) continue;
            const dist = (Math.abs(pos.x - enemyPos.x) + Math.abs(pos.y - enemyPos.y)) * 5; // grid units to feet
            if (dist <= spellRange) {
              validTargets.push(enemyId);
            }
          }
        }
      }

      // Buff spells that target self are always valid
      const isSelfBuff = spell.targetType === 'self' || spell.range === 0;
      if (validTargets.length === 0 && !hasHealing && !isSelfBuff) continue;
      // Self-targeting buffs without enemies: still valid
      if (validTargets.length === 0 && isSelfBuff) validTargets.push(entityId);

      options.push({
        spellId,
        slotLevel,
        minSlotLevel: spell.level,
        maxSlotLevel: Math.max(slotLevel, ...Object.keys(p.stats.spellcasting?.spellSlots ?? {}).map(Number).filter(l => l >= spell.level && (p.stats.spellcasting?.spellSlots?.[l]?.current ?? 0) > 0)),
        validTargets,
        validCells: [],
      });
    }

    return options;
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

  /**
   * Check if a participant has a specific condition by inspecting its stat block.
   */
  private participantHasCondition(p: CombatParticipant, condition: ConditionType): boolean {
    return p.stats.conditions.some(c => c.type === condition);
  }

  /** Check if a participant has a specific feature by ID. */
  private participantHasFeature(p: CombatParticipant, featureId: string): boolean {
    return p.stats.features.some(f => f.id === featureId);
  }

  /**
   * Compute whether an attack roll has advantage and/or disadvantage
   * based on attacker/target conditions and dodge status (5e rules).
   *
   * Per 5e: if you have any source of advantage AND any source of disadvantage,
   * they cancel out completely (straight roll), regardless of how many of each.
   * The DiceRoller.rollD20() already handles this cancellation.
   */
  private computeAttackAdvantage(
    attacker: CombatParticipant,
    target: CombatParticipant,
    isMelee: boolean,
  ): { advantage: boolean; disadvantage: boolean } {
    let advantage = false;
    let disadvantage = false;

    // --- Sources of ADVANTAGE for the attacker ---

    // Target has a condition that grants attackers advantage
    for (const cond of ADVANTAGE_AGAINST_CONDITIONS) {
      if (this.participantHasCondition(target, cond)) {
        advantage = true;
        break;
      }
    }

    // Target is prone and attacker is within melee range (5e: melee attacks
    // against prone targets have advantage)
    if (isMelee && this.participantHasCondition(target, 'prone')) {
      advantage = true;
    }

    // Attacker is invisible (grants advantage on attacks)
    if (this.participantHasCondition(attacker, 'invisible')) {
      advantage = true;
    }

    // --- Sources of DISADVANTAGE for the attacker ---

    // Attacker has a condition that imposes disadvantage on its own attacks
    for (const cond of ATTACK_DISADVANTAGE_CONDITIONS) {
      if (this.participantHasCondition(attacker, cond)) {
        disadvantage = true;
        break;
      }
    }

    // Target has Dodge action active — attacks against them have disadvantage
    if (this.dodgingEntities.has(target.entityId)) {
      disadvantage = true;
    }

    // Ranged attack against prone target has disadvantage
    if (!isMelee && this.participantHasCondition(target, 'prone')) {
      disadvantage = true;
    }

    // Target has Blur active — attacks against them have disadvantage
    if (this.hasBuffAttackDisadvantageAgainst(target.entityId)) {
      disadvantage = true;
    }

    // Divine Oracle: any creature attacking Naelia does so with disadvantage
    if (this.participantHasFeature(target, 'divine_oracle')) {
      disadvantage = true;
    }

    return { advantage, disadvantage };
  }

  /**
   * Compute whether a saving throw has advantage/disadvantage
   * based on the entity's conditions and dodge status (5e rules).
   */
  private computeSaveAdvantage(
    participant: CombatParticipant,
    saveAbility: string,
  ): { advantage: boolean; disadvantage: boolean } {
    let advantage = false;
    let disadvantage = false;

    // Dodge grants advantage on Dex saves
    if (saveAbility === 'dexterity' && this.dodgingEntities.has(participant.entityId)) {
      advantage = true;
    }

    // Conditions that impose disadvantage on Dex saves
    if (saveAbility === 'dexterity') {
      for (const cond of DEX_SAVE_DISADVANTAGE_CONDITIONS) {
        if (this.participantHasCondition(participant, cond)) {
          disadvantage = true;
          break;
        }
      }
    }

    // Conditions that impose disadvantage on Str saves
    if (saveAbility === 'strength') {
      for (const cond of STR_SAVE_DISADVANTAGE_CONDITIONS) {
        if (this.participantHasCondition(participant, cond)) {
          disadvantage = true;
          break;
        }
      }
    }

    // Bestow Curse: disadvantage on all saves
    if (this.hasBuffSaveDisadvantage(participant.entityId)) {
      disadvantage = true;
    }

    // Divine Oracle: advantage on ALL saving throws
    if (this.participantHasFeature(participant, 'divine_oracle')) {
      advantage = true;
    }

    // Greater Magic Immunity: advantage on saves vs spells level 6+
    // (This is checked here generically — the save is always from a spell in combat)
    if (this.participantHasFeature(participant, 'greater_magic_immunity')) {
      advantage = true;
    }

    return { advantage, disadvantage };
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
