import type { GameEngine, GameSystem } from '@/engine/GameEngine';
import type {
  Character,
  Coordinate,
  DiceRollResult,
  EntityId,
  ResolvedEvent,
  NPC,
} from '@/types';
import type { OverworldTerrain } from '@/types/overworld';
import type { WeaponProperties } from '@/types/item';
import type { CombatParticipant, CombatResult, SpellTargeting } from './CombatManager';
import { CombatManager } from './CombatManager';
import { generateCombatMap } from './CombatMapGenerator';
import { DiceDisplay } from '@/ui/widgets/DiceDisplay';
import { getMonster, type MonsterDefinition } from '@/data/monsters';
import { getItem } from '@/data/items';
import { getSpell } from '@/data/spells';
import { SeededRNG } from '@/utils/SeededRNG';
import { abilityModifier } from '@/utils/math';
import { isDevMode } from '@/utils/devmode';
import { SpellAnimationSystem, type GridToScreen } from '@/ui/combat/SpellAnimations';

/**
 * Orchestrates the full combat lifecycle.
 *
 * Sits between the UI layer and CombatManager: receives encounter events,
 * builds the combat map, creates NPC entities, drives NPC turns with animation
 * delays, shows dice roll animations, and handles post-combat XP/loot.
 */
export class CombatController implements GameSystem {
  readonly name = 'CombatController';
  readonly priority = 50;

  private engine!: GameEngine;
  private combatManager!: CombatManager;
  private active = false;
  /** True once initiative rolls have been shown and turns can proceed. */
  private ready = false;
  /** Queue of NPC entityIds whose turns arrived before we were ready. */
  private pendingNPCTurns: EntityId[] = [];

  /** Container element for dice roll animations (set by UI layer). */
  private diceContainer: HTMLElement | null = null;
  /** Serializes dice roll animations so only one shows at a time. */
  private rollQueue: Promise<void> = Promise.resolve();
  /** Spell animation system for visual effects during casting. */
  private spellAnimations: SpellAnimationSystem | null = null;
  /** Getter for initiative bar element by entity ID (for mini NPC dice). */
  private getInitiativeEl: ((id: EntityId) => HTMLElement | null) | null = null;

  /** The encounter that triggered the current combat. */
  private currentEncounter: ResolvedEvent | null = null;
  /** Monsters spawned for the current fight (for XP / loot). */
  private spawnedMonsters: MonsterDefinition[] = [];
  /** Map from NPC entityId → MonsterDefinition for loot. */
  private monsterMap: Map<EntityId, MonsterDefinition> = new Map();
  /** Callback invoked when combat ends so the caller can resume. */
  private onComplete: ((result: CombatResult) => void) | null = null;

  // ── GameSystem lifecycle ──────────────────────────────────────

  init(engine: GameEngine): void {
    this.engine = engine;

    // Listen for NPC turns so we can drive them with delays
    engine.events.on('combat:turn_start', (e) => {
      const { entityId, isPlayer } = e.data as {
        entityId: EntityId;
        isPlayer: boolean;
      };
      if (!isPlayer && this.active) {
        if (this.ready) {
          this.driveNPCTurn(entityId);
        } else {
          // Queue — initiative rolls are still being shown
          this.pendingNPCTurns.push(entityId);
        }
      }
    });

    // Listen for combat end trigger
    engine.events.on('combat:kill', () => {
      if (!this.active) return;
      if (this.combatManager.checkCombatEnd()) {
        this.finishCombat();
      }
    });
  }

  // ── Public API ────────────────────────────────────────────────

  setCombatManager(cm: CombatManager): void {
    this.combatManager = cm;
  }

  /** Set the container where dice roll animations will be shown. */
  setDiceContainer(el: HTMLElement): void {
    this.diceContainer = el;
  }

  /** Set the getter for initiative bar elements (for mini NPC dice overlays). */
  setInitiativeElGetter(fn: (id: EntityId) => HTMLElement | null): void {
    this.getInitiativeEl = fn;
  }

  /** Set up the spell animation system with its overlay container, shake target, and coord converter. */
  setSpellAnimations(container: HTMLElement, screenEl: HTMLElement, gridToScreen: GridToScreen): void {
    this.spellAnimations = new SpellAnimationSystem(container, screenEl, gridToScreen);
  }

  isActive(): boolean {
    return this.active;
  }

  /**
   * Start a combat encounter.
   *
   * @param character  The player character
   * @param encounter  Resolved encounter event (from EncounterResolver)
   * @param terrain    Overworld terrain at the encounter location
   * @param onComplete Called when combat ends — receives the CombatResult
   */
  startEncounter(
    character: Character,
    encounter: ResolvedEvent,
    terrain: OverworldTerrain,
    onComplete: (result: CombatResult) => void,
  ): void {
    this.currentEncounter = encounter;
    this.onComplete = onComplete;
    this.spawnedMonsters = [];
    this.monsterMap.clear();
    this.ready = false;
    this.pendingNPCTurns = [];

    const data = encounter.resolvedData;
    const monsterIds = (data['monsterIds'] as string[]) ?? [];
    const enemyCount = (data['actualEnemyCount'] as number) ?? 2;

    // Seed RNG deterministically from encounter template + game time
    const seed = encounter.templateId.length * 1000 + encounter.timestamp.totalRounds;
    const rng = new SeededRNG(seed);

    // 1. Generate combat map
    const combatMap = generateCombatMap(terrain, enemyCount, rng);

    // 2. Build NPC entities from monster definitions
    const npcParticipants: CombatParticipant[] = [];
    const placements = new Map<EntityId, Coordinate>();

    // Place player
    const playerEntityId = character.id;
    const playerParticipant = this.buildPlayerParticipant(character);
    placements.set(playerEntityId, combatMap.playerStart);

    // Place enemies
    for (let i = 0; i < enemyCount; i++) {
      const monsterId = monsterIds[i % monsterIds.length];
      const monsterDef = getMonster(monsterId);
      if (!monsterDef) continue;

      this.spawnedMonsters.push(monsterDef);

      const npc = this.createCombatNPC(monsterDef, i, rng);
      const npcId = npc.id;
      this.monsterMap.set(npcId, monsterDef);

      // Register NPC entity
      this.engine.entities.add(npc);

      const participant: CombatParticipant = {
        entityId: npcId,
        isPlayer: false,
        isAlly: false,
        stats: { ...npc.stats },
        initiative: 0, // rolled by CombatManager
        npc,
      };
      npcParticipants.push(participant);

      if (combatMap.enemyPositions[i]) {
        placements.set(npcId, combatMap.enemyPositions[i]);
      }
    }

    // 3. Emit encounter_started so UI can switch to combat mode
    const allParticipants = [playerParticipant, ...npcParticipants];
    this.active = true;

    this.engine.events.emit({
      type: 'combat:encounter_started',
      category: 'combat',
      data: {
        encounter,
        terrain,
        grid: combatMap.grid,
        playerStart: combatMap.playerStart,
        enemyPositions: combatMap.enemyPositions,
        participants: allParticipants,
        placements,
      },
    });

    // 4. Start combat — initiative rolls + first turn happen inside
    //    Then show initiative rolls with dice animations
    this.combatManager.startCombat(allParticipants, combatMap.grid, placements);

    // Show initiative roll animations sequentially
    this.showInitiativeRolls();
  }

  // ── Player actions (called from UI) ───────────────────────────

  playerMove(path: Coordinate[]): void {
    if (!this.active) return;
    const entityId = this.combatManager.getCurrentTurnEntity();
    if (!this.combatManager.isPlayerTurn()) return;
    this.combatManager.executeMove(entityId, path);
  }

  async playerAttack(targetId: EntityId): Promise<void> {
    if (!this.active) return;
    const entityId = this.combatManager.getCurrentTurnEntity();
    if (!this.combatManager.isPlayerTurn()) return;
    const result = this.combatManager.executeAttack(entityId, targetId);

    // Critical hit — dramatic overlay + screen shake
    const attackRoll = result.rolls[0];
    if (attackRoll?.isCritical && result.success && this.spellAnimations) {
      await this.spellAnimations.showCriticalHit();
    }

    // Show attack roll, then damage roll sequentially
    for (const roll of result.rolls) {
      await this.showRoll(roll);
    }
  }

  async playerCastSpell(spellId: string, targetId: EntityId | null, slotLevel: number): Promise<void> {
    if (!this.active) return;
    const entityId = this.combatManager.getCurrentTurnEntity();
    if (!this.combatManager.isPlayerTurn()) return;

    // Play spell animation BEFORE executing (visual first, then mechanics)
    const spell = getSpell(spellId);
    const grid = this.combatManager.getGrid();
    if (spell && grid && this.spellAnimations) {
      const casterPos = grid.getEntityPosition(entityId);
      const tPos = targetId ? grid.getEntityPosition(targetId) ?? null : null;
      if (casterPos) {
        await this.spellAnimations.playSpellCast(spell, casterPos, tPos, slotLevel || spell.level);
      }
    }

    const targets: SpellTargeting = targetId
      ? { targetEntities: [targetId] }
      : { targetEntities: [entityId] }; // self-target for healing

    const result = this.combatManager.executeCastSpell(entityId, spellId, slotLevel, targets);

    // Sync spell slot consumption to the real character entity
    if (slotLevel > 0) {
      const character = this.engine.entities.getAll<Character>('character')[0];
      if (character?.spellcasting?.spellSlots[slotLevel]) {
        character.spellcasting.spellSlots[slotLevel].current =
          Math.max(0, character.spellcasting.spellSlots[slotLevel].current - 1);
      }
    }

    // Sync HP changes (healing) back to real character
    if (result.healing) {
      const character = this.engine.entities.getAll<Character>('character')[0];
      if (character) {
        character.currentHp = Math.min(character.maxHp, character.currentHp + result.healing);
      }
    }

    // Critical hit on spell attack — dramatic overlay
    const attackRoll = result.rolls[0];
    if (attackRoll?.isCritical && result.success && this.spellAnimations) {
      await this.spellAnimations.showCriticalHit();
    }

    // Show dice rolls
    for (const roll of result.rolls) {
      await this.showRoll(roll);
    }
  }

  playerDash(): void {
    if (!this.active) return;
    const entityId = this.combatManager.getCurrentTurnEntity();
    if (!this.combatManager.isPlayerTurn()) return;
    this.combatManager.executeDash(entityId);
  }

  playerDodge(): void {
    if (!this.active) return;
    const entityId = this.combatManager.getCurrentTurnEntity();
    if (!this.combatManager.isPlayerTurn()) return;
    this.combatManager.executeDodge(entityId);
  }

  playerDisengage(): void {
    if (!this.active) return;
    const entityId = this.combatManager.getCurrentTurnEntity();
    if (!this.combatManager.isPlayerTurn()) return;
    this.combatManager.executeDisengage(entityId);
  }

  playerEndTurn(): void {
    if (!this.active) return;
    const entityId = this.combatManager.getCurrentTurnEntity();
    if (!this.combatManager.isPlayerTurn()) return;
    this.combatManager.executeEndTurn(entityId);
  }

  getAvailableActions() {
    if (!this.active) return null;
    const entityId = this.combatManager.getCurrentTurnEntity();
    return this.combatManager.getAvailableActions(entityId);
  }

  // ── Dice roll display ─────────────────────────────────────────

  /** Show a full-screen dice roll animation (player rolls). Serialized so only one plays at a time. */
  private showRoll(result: DiceRollResult): Promise<void> {
    if (!this.diceContainer || !this.active) return Promise.resolve();
    const container = this.diceContainer;
    this.rollQueue = this.rollQueue.then(async () => {
      if (!this.active) return;
      // Clear any leftover elements before showing the next roll
      container.innerHTML = '';
      await DiceDisplay.showRoll(container, result, this.engine);
    });
    return this.rollQueue;
  }

  /** Show a mini dice roll on an NPC's initiative bar icon. */
  private showRollOnInitiative(entityId: EntityId, result: DiceRollResult): Promise<void> {
    const anchor = this.getInitiativeEl?.(entityId);
    if (!anchor || !this.active) {
      // Fallback to full display if no initiative element found
      return this.showRoll(result);
    }
    this.rollQueue = this.rollQueue.then(async () => {
      if (!this.active) return;
      await DiceDisplay.showRollMini(anchor, result, this.engine);
    });
    return this.rollQueue;
  }

  /** Show all initiative rolls sequentially after combat starts. */
  private async showInitiativeRolls(): Promise<void> {
    const rolls = this.combatManager.getInitiativeRolls();
    if (rolls.length === 0) return;

    for (const entry of rolls) {
      if (!this.active) return;

      // Add context to the roll description
      const p = this.combatManager.getParticipant(entry.entityId);
      const name = p?.npc?.name ?? (entry.isPlayer ? 'You' : 'Ally');
      const contextRoll: DiceRollResult = {
        ...entry.rollResult,
        description: `${name} — Initiative`,
      };

      if (entry.isPlayer) {
        await this.showRoll(contextRoll);
      } else {
        await this.showRollOnInitiative(entry.entityId, contextRoll);
      }
    }

    // Small pause after all initiative rolls before the first turn
    await this.delay(300);

    // Mark ready and flush any queued NPC turns
    this.ready = true;
    if (this.pendingNPCTurns.length > 0) {
      const firstNPC = this.pendingNPCTurns.shift()!;
      this.pendingNPCTurns = []; // only drive the first; endTurn will trigger the next
      this.driveNPCTurn(firstNPC);
    }
  }

  // ── NPC turn driver ───────────────────────────────────────────

  /**
   * Drive an NPC's turn step-by-step with animation delays and dice rolls.
   */
  private async driveNPCTurn(entityId: EntityId): Promise<void> {
    // Small initial delay so the UI can show "NPC's turn"
    await this.delay(400);
    if (!this.active) return;

    // Plan and execute the NPC turn (returns movement path for animation)
    const { movementPath, results } = this.combatManager.planAndExecuteNPCTurn(entityId);

    // Animate movement step-by-step: entity is already at final grid position,
    // so we visually walk it back through each cell for the animation.
    if (movementPath.length > 1) {
      const grid = this.combatManager.getGrid();
      if (grid) {
        const finalPos = movementPath[movementPath.length - 1];

        // Move entity back to start position for visual stepping
        grid.moveEntity(entityId, movementPath[0]);
        this.emitMoveRefresh();

        // Step through each intermediate cell
        for (let i = 1; i < movementPath.length; i++) {
          if (!this.active) return;
          await this.delay(120);
          grid.moveEntity(entityId, movementPath[i]);
          this.emitMoveRefresh();
        }

        // Ensure we're at the correct final position
        grid.moveEntity(entityId, finalPos);
        this.emitMoveRefresh();
        await this.delay(200);
      }
    }

    if (!this.active) return;

    // Show each action result with mini dice on initiative bar
    for (const result of results) {
      if (!this.active) return;

      // NPC critical hit — show dramatic overlay
      const npcAttackRoll = result.rolls[0];
      if (npcAttackRoll?.isCritical && result.success && this.spellAnimations) {
        await this.spellAnimations.showCriticalHit();
      }

      // Show dice rolls as mini overlays on the NPC's initiative icon
      for (const roll of result.rolls) {
        await this.showRollOnInitiative(entityId, roll);
        if (!this.active) return;
      }

      this.engine.events.emit({
        type: 'combat:action_result',
        category: 'combat',
        data: { result },
      });

      await this.delay(150);
    }

    if (!this.active) return;

    // Check if combat ended during this turn (e.g. player died from an attack)
    if (this.combatManager.checkCombatEnd()) {
      this.finishCombat();
      return;
    }

    // Brief pause before ending the turn
    await this.delay(200);
    if (!this.active) return;

    // Clear any lingering dice display elements before next turn
    if (this.diceContainer) this.diceContainer.innerHTML = '';

    // End the NPC's turn
    this.combatManager.executeEndTurn(entityId);
  }

  // ── Post-combat ───────────────────────────────────────────────

  private finishCombat(): void {
    if (!this.active) return;
    this.active = false;

    const result = this.combatManager.endCombat();

    // Calculate XP from monster definitions (more accurate than level-based estimate)
    let xpEarned = 0;
    for (const monster of this.spawnedMonsters) {
      xpEarned += monster.xp;
    }
    result.xpEarned = xpEarned;

    // Roll loot from defeated monsters
    const loot: { itemId: string; quantity: number }[] = [];
    for (const [npcId, monsterDef] of this.monsterMap) {
      if (result.casualties.includes(npcId) && monsterDef.lootTable) {
        const rng = new SeededRNG(npcId.length * 31 + xpEarned);
        for (const drop of monsterDef.lootTable) {
          if (rng.next() < drop.chance) {
            loot.push({
              itemId: drop.itemId,
              quantity: drop.quantity ?? 1,
            });
          }
        }
      }
    }

    // Clean up spawned NPC entities
    for (const npcId of this.monsterMap.keys()) {
      this.engine.entities.remove(npcId);
    }

    this.engine.events.emit({
      type: 'combat:encounter_ended',
      category: 'combat',
      data: {
        result,
        encounter: this.currentEncounter,
        xpEarned,
        loot,
      },
    });

    this.currentEncounter = null;
    this.monsterMap.clear();
    this.spawnedMonsters = [];

    if (this.onComplete) {
      const cb = this.onComplete;
      this.onComplete = null;
      cb(result);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────

  private buildPlayerParticipant(character: Character): CombatParticipant {
    // Build AttackDefinition from equipped weapon
    const attacks = [];
    const mainWeaponId = character.equipment.mainHand;
    if (mainWeaponId) {
      const weapon = getItem(mainWeaponId);
      if (weapon && weapon.itemType === 'weapon') {
        const props = weapon.properties as WeaponProperties;
        const strMod = abilityModifier(character.abilityScores.strength);
        const dexMod = abilityModifier(character.abilityScores.dexterity);
        const isFinesse = props.tags?.includes('finesse') ?? false;
        const isRanged = (props.rangeNormal ?? 0) > 0;
        const abilityMod = isFinesse
          ? Math.max(strMod, dexMod)
          : isRanged
            ? dexMod
            : strMod;

        const devBonus = isDevMode() ? 8 : 0;
        attacks.push({
          name: weapon.name,
          toHitBonus: abilityMod + character.proficiencyBonus + devBonus,
          damage: props.damage,
          reach: props.reach ?? 5,
          rangeNormal: props.rangeNormal,
          rangeLong: props.rangeLong,
        });
      }
    }

    return {
      entityId: character.id,
      isPlayer: true,
      isAlly: true,
      stats: {
        abilityScores: { ...character.abilityScores },
        maxHp: character.maxHp,
        currentHp: character.currentHp,
        armorClass: character.armorClass,
        speed: character.speed,
        level: character.level,
        attacks,
        spellcasting: character.spellcasting,
        features: [...character.features],
        conditions: [...character.conditions],
        size: 'medium',
        resistances: [],
        immunities: [],
        vulnerabilities: [],
        conditionImmunities: [],
      },
      initiative: 0,
    };
  }

  private createCombatNPC(
    monsterDef: MonsterDefinition,
    index: number,
    rng: SeededRNG,
  ): NPC {
    const id = `combat_npc_${monsterDef.id}_${index}_${rng.nextInt(1000, 9999)}`;
    return {
      id,
      type: 'npc',
      templateId: monsterDef.id,
      name: index === 0 ? monsterDef.name : `${monsterDef.name} ${index + 1}`,
      role: 'hostile',
      locationId: '',
      isAwakened: false,
      stats: {
        ...monsterDef.stats,
        currentHp: monsterDef.stats.maxHp,
        conditions: [],
        features: [...monsterDef.stats.features],
        attacks: monsterDef.stats.attacks.map((a) => ({ ...a, damage: { ...a.damage } })),
      },
      companion: null,
      position: null,
      initiative: null,
    };
  }

  /** Emit a combat:move event to trigger entity position refresh in the UI. */
  private emitMoveRefresh(): void {
    this.engine.events.emit({
      type: 'combat:move',
      category: 'combat',
      data: {},
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
