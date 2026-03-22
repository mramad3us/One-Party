import type { GameEngine, GameSystem } from '@/engine/GameEngine';
import type {
  Character,
  Coordinate,
  DiceRollResult,
  EntityId,
  ResolvedEvent,
  Item,
  NPC,
} from '@/types';
import type { OverworldTerrain } from '@/types/overworld';
import type { WeaponProperties } from '@/types/item';
import type { CombatParticipant, CombatResult } from './CombatManager';
import { CombatManager } from './CombatManager';
import { generateCombatMap } from './CombatMapGenerator';
import { DiceDisplay } from '@/ui/widgets/DiceDisplay';
import { getMonster, type MonsterDefinition } from '@/data/monsters';
import { SeededRNG } from '@/utils/SeededRNG';
import { abilityModifier } from '@/utils/math';

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

  /** Container element for dice roll animations (set by UI layer). */
  private diceContainer: HTMLElement | null = null;

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
        this.driveNPCTurn(entityId);
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

    // Show attack roll, then damage roll sequentially
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

  /** Show a dice roll animation. Returns when the animation is complete. */
  private async showRoll(result: DiceRollResult): Promise<void> {
    if (!this.diceContainer || !this.active) return;
    await DiceDisplay.showRoll(this.diceContainer, result, this.engine);
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
      await this.showRoll(contextRoll);
    }

    // Small pause after all initiative rolls before the first turn
    await this.delay(300);
  }

  // ── NPC turn driver ───────────────────────────────────────────

  /**
   * Drive an NPC's turn step-by-step with animation delays and dice rolls.
   */
  private async driveNPCTurn(entityId: EntityId): Promise<void> {
    // Small initial delay so the UI can show "NPC's turn"
    await this.delay(400);
    if (!this.active) return;

    // Execute the full NPC turn (movement + attack already happen inside)
    const results = this.combatManager.processNPCTurn(entityId);

    // Show each result with dice animations
    for (const result of results) {
      if (!this.active) return;

      // Show dice rolls for this action
      for (const roll of result.rolls) {
        await this.showRoll(roll);
        if (!this.active) return;
      }

      this.engine.events.emit({
        type: 'combat:action_result',
        category: 'combat',
        data: { result },
      });

      await this.delay(300);
    }

    if (!this.active) return;

    // Check if combat ended during this turn (e.g. player died from an attack)
    if (this.combatManager.checkCombatEnd()) {
      this.finishCombat();
      return;
    }

    // Small pause before ending the turn
    await this.delay(300);
    if (!this.active) return;

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
      const weapon = this.engine.entities.get<Item>(mainWeaponId);
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

        attacks.push({
          name: weapon.name,
          toHitBonus: abilityMod + character.proficiencyBonus,
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

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
