import type { GameEngine, GameSystem } from '@/engine/GameEngine';
import type {
  Character,
  Coordinate,
  DiceRollResult,
  DieType,
  EntityId,
  Item,
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
import { getBonusAction } from '@/data/bonusActions';

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
  /** Deferred completion — called by UI after summary modal is dismissed. */
  private pendingCombatComplete: (() => void) | null = null;

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

    // Sync concentration state to real character when concentration breaks
    engine.events.on('combat:concentration_broken', (e) => {
      if (!this.active) return;
      const { isPlayer } = e.data as { entityId: EntityId; isPlayer: boolean };
      if (isPlayer) {
        const character = this.engine.entities.getAll<Character>('character')[0];
        if (character?.spellcasting) {
          character.spellcasting.concentration = null;
        }
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
   * Called by UI after the combat summary modal is dismissed.
   * This triggers the deferred onComplete callback, resuming travel if needed.
   */
  dismissCombatSummary(): void {
    if (this.pendingCombatComplete) {
      this.pendingCombatComplete();
    }
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

  /**
   * Start combat on an existing exploration grid (no throwaway combat map).
   * Enemies are already placed on the grid — we just need to register them
   * as combat participants and start the fight.
   */
  startExplorationEncounter(
    character: Character,
    encounter: ResolvedEvent,
    existingGrid: import('@/grid/Grid').Grid,
    playerPos: Coordinate,
    enemyNpcs: { npc: NPC; monsterDef: MonsterDefinition; position: Coordinate }[],
    onComplete: (result: CombatResult) => void,
  ): void {
    this.currentEncounter = encounter;
    this.onComplete = onComplete;
    this.spawnedMonsters = [];
    this.monsterMap.clear();
    this.ready = false;
    this.pendingNPCTurns = [];
    this.active = true;

    const placements = new Map<EntityId, Coordinate>();
    const playerParticipant = this.buildPlayerParticipant(character);
    placements.set(character.id, playerPos);

    const npcParticipants: CombatParticipant[] = [];
    for (const { npc, monsterDef, position } of enemyNpcs) {
      this.spawnedMonsters.push(monsterDef);
      this.monsterMap.set(npc.id, monsterDef);

      const participant: CombatParticipant = {
        entityId: npc.id,
        isPlayer: false,
        isAlly: false,
        stats: { ...npc.stats },
        initiative: 0,
        npc,
      };
      npcParticipants.push(participant);
      placements.set(npc.id, position);
    }

    const allParticipants = [playerParticipant, ...npcParticipants];

    // Emit with explorationCombat flag so UI keeps the current grid
    this.engine.events.emit({
      type: 'combat:encounter_started',
      category: 'combat',
      data: {
        encounter,
        explorationCombat: true,
        participants: allParticipants,
        placements,
      },
    });

    // Start combat using the existing exploration grid
    this.combatManager.startCombatWithGrid(allParticipants, existingGrid, placements);

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

    // Defer events so dice animations play before log/damage visuals
    this.combatManager.deferEvents = true;
    const result = this.combatManager.executeAttack(entityId, targetId);
    this.combatManager.deferEvents = false;

    // Critical hit — dramatic overlay + screen shake
    const attackRoll = result.rolls[0];
    if (attackRoll?.isCritical && result.success && this.spellAnimations) {
      await this.spellAnimations.showCriticalHit();
    }

    // Show attack roll, then damage roll sequentially
    for (const roll of result.rolls) {
      await this.showRoll(roll);
    }

    // Now flush deferred events (log, damage numbers, kill notifications)
    this.combatManager.flushDeferredEvents();
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

    // Build targeting: for area spells, compute all entities within radius
    let targets: SpellTargeting;
    const isAreaSpell = spell && (spell.targetType === 'sphere' || spell.targetType === 'cone' ||
      spell.targetType === 'line' || spell.targetType === 'cube' ||
      spell.targetType === 'cylinder' || spell.targetType === 'area');

    if (isAreaSpell && spell && grid && targetId) {
      // Compute area cells around the target
      const targetPos = grid.getEntityPosition(targetId);
      if (targetPos) {
        const areaSize = spell.effects.find(e => e.areaSize)?.areaSize ?? 20;
        const radiusCells = Math.ceil(areaSize / 5); // Convert feet to grid cells (5ft per cell)
        const areaCells: import('@/types').Coordinate[] = [];
        for (let dy = -radiusCells; dy <= radiusCells; dy++) {
          for (let dx = -radiusCells; dx <= radiusCells; dx++) {
            const dist = Math.abs(dx) + Math.abs(dy); // Manhattan distance
            if (dist <= radiusCells) {
              areaCells.push({ x: targetPos.x + dx, y: targetPos.y + dy });
            }
          }
        }
        // Get all entities in the area (excluding the caster for offensive spells)
        const entitiesInArea = this.combatManager.getTargeting()?.getEntitiesInArea(areaCells) ?? [];
        const hasHealing = spell.effects.some(e => e.healing);
        const filtered = hasHealing
          ? entitiesInArea
          : entitiesInArea.filter(eid => eid !== entityId); // Don't hit yourself
        targets = { targetEntities: filtered.length > 0 ? filtered : [targetId], targetArea: areaCells };
      } else {
        targets = { targetEntities: [targetId] };
      }
    } else if (targetId) {
      targets = { targetEntities: [targetId] };
    } else {
      targets = { targetEntities: [entityId] }; // self-target for healing
    }

    // Defer events so dice animations play before log/damage visuals
    this.combatManager.deferEvents = true;
    const result = this.combatManager.executeCastSpell(entityId, spellId, slotLevel, targets);
    this.combatManager.deferEvents = false;

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

    // Sync concentration state back to real character
    {
      const character = this.engine.entities.getAll<Character>('character')[0];
      const participant = this.combatManager.getParticipant(entityId);
      if (character?.spellcasting && participant?.stats.spellcasting) {
        character.spellcasting.concentration = participant.stats.spellcasting.concentration;
      }
    }

    // Critical hit on spell attack — dramatic overlay
    const attackRoll = result.rolls[0];
    if (attackRoll?.isCritical && result.success && this.spellAnimations) {
      await this.spellAnimations.showCriticalHit();
    }

    // Show dice rolls — full-screen for player rolls, mini for NPC/companion saves
    for (const roll of result.rolls) {
      if (roll.rollerEntityId && roll.rollerEntityId !== entityId) {
        // This is an NPC/companion saving throw — show mini on their initiative icon
        await this.showRollOnInitiative(roll.rollerEntityId, roll);
      } else {
        await this.showRoll(roll);
      }
    }

    // Now flush deferred events (log, damage numbers, kill notifications)
    this.combatManager.flushDeferredEvents();
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

  async playerBonusAction(bonusActionId: string): Promise<void> {
    if (!this.active) return;
    const entityId = this.combatManager.getCurrentTurnEntity();
    if (!this.combatManager.isPlayerTurn()) return;

    this.combatManager.deferEvents = true;
    const result = this.combatManager.executeBonusAction(entityId, bonusActionId);
    this.combatManager.deferEvents = false;

    // Show dice rolls (e.g. Second Wind healing)
    for (const roll of result.rolls) {
      await this.showRoll(roll);
    }

    // Sync healing back to real character entity
    if (result.healing) {
      const character = this.engine.entities.getAll<Character>('character')[0];
      if (character) {
        character.currentHp = Math.min(character.maxHp, character.currentHp + result.healing);
      }
    }

    // Sync feature usage back to real character
    const def = getBonusAction(bonusActionId);
    if (def && def.usesPerRest > 0) {
      const character = this.engine.entities.getAll<Character>('character')[0];
      if (character) {
        const feat = character.features.find(f => f.id === def.featureId);
        if (feat && feat.usesRemaining !== undefined) {
          feat.usesRemaining = Math.max(0, feat.usesRemaining - 1);
        }
      }
    }

    this.combatManager.flushDeferredEvents();
  }

  playerActionSurge(): void {
    if (!this.active) return;
    const entityId = this.combatManager.getCurrentTurnEntity();
    if (!this.combatManager.isPlayerTurn()) return;

    const result = this.combatManager.executeActionSurge(entityId);

    // Sync feature usage back to real character
    if (result.success) {
      const character = this.engine.entities.getAll<Character>('character')[0];
      if (character) {
        const feat = character.features.find(f => f.id === 'feature_action_surge');
        if (feat && feat.usesRemaining !== undefined) {
          feat.usesRemaining = Math.max(0, feat.usesRemaining - 1);
        }
      }
    }
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

    // Defer events so dice animations play before log/damage visuals
    this.combatManager.deferEvents = true;
    const { movementPath, results } = this.combatManager.planAndExecuteNPCTurn(entityId);
    this.combatManager.deferEvents = false;

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

      // Show dice rolls — mini on NPC initiative icon, but full-screen if it's the player's save
      for (const roll of result.rolls) {
        if (roll.rollerEntityId) {
          const roller = this.combatManager.getParticipant(roll.rollerEntityId);
          if (roller?.isPlayer) {
            // Player's saving throw — show full-screen
            await this.showRoll(roll);
          } else {
            await this.showRollOnInitiative(roll.rollerEntityId, roll);
          }
        } else {
          await this.showRollOnInitiative(entityId, roll);
        }
        if (!this.active) return;
      }

      // Flush deferred events for this result (log, damage numbers, kill)
      this.combatManager.flushDeferredEvents();

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
    const coinLoot = { gold: 0, silver: 0, copper: 0 };
    const enemiesDefeated: string[] = [];
    for (const [npcId, monsterDef] of this.monsterMap) {
      if (result.casualties.includes(npcId)) {
        enemiesDefeated.push(monsterDef.name);
        const rng = new SeededRNG(npcId.length * 31 + xpEarned);

        // Item drops
        if (monsterDef.lootTable) {
          for (const drop of monsterDef.lootTable) {
            if (rng.next() < drop.chance) {
              loot.push({
                itemId: drop.itemId,
                quantity: drop.quantity ?? 1,
              });
            }
          }
        }

        // Coin drops based on CR — only for creature types that plausibly carry money
        const COIN_CARRYING_TYPES = new Set([
          'humanoid', 'dragon', 'fiend', 'undead', 'giant', 'monstrosity', 'aberration', 'construct',
        ]);
        const monsterType = monsterDef.type.toLowerCase().split(' ')[0]; // e.g. "beast" from "beast (wolf)"
        if (COIN_CARRYING_TYPES.has(monsterType)) {
          const cr = monsterDef.cr;
          if (cr <= 4) {
            coinLoot.copper += Math.floor(rng.next() * 50);
            coinLoot.silver += Math.floor(rng.next() * 20);
            coinLoot.gold += Math.floor(rng.next() * 8);
          } else if (cr <= 10) {
            coinLoot.copper += Math.floor(rng.next() * 50);
            coinLoot.silver += Math.floor(rng.next() * 100);
            coinLoot.gold += Math.floor(rng.next() * 200);
          } else {
            coinLoot.copper += Math.floor(rng.next() * 100);
            coinLoot.silver += Math.floor(rng.next() * 500);
            coinLoot.gold += Math.floor(rng.next() * 2000);
          }
        }
      }
    }

    // Clean up spawned NPC entities
    for (const npcId of this.monsterMap.keys()) {
      this.engine.entities.remove(npcId);
    }

    // Store pending completion — will be triggered when UI dismisses the summary modal
    const pendingResult = result;
    const pendingCallback = this.onComplete;
    this.onComplete = null;
    this.pendingCombatComplete = () => {
      this.pendingCombatComplete = null;
      if (pendingCallback) pendingCallback(pendingResult);
    };

    this.engine.events.emit({
      type: 'combat:encounter_ended',
      category: 'combat',
      data: {
        result,
        encounter: this.currentEncounter,
        xpEarned,
        loot,
        coinLoot,
        enemiesDefeated,
      },
    });

    this.currentEncounter = null;
    this.monsterMap.clear();
    this.spawnedMonsters = [];
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

    // Feature-based attacks (e.g. Naelia's Slap) — used when no weapon equipped
    // Slap: +49 to hit, 1d4+23 necrotic, DC 64 CON save or reduced to 0 HP
    if (attacks.length === 0) {
      const slapFeature = character.features.find(f => f.id === 'slap');
      if (slapFeature) {
        attacks.push({
          name: 'Slap',
          toHitBonus: 49,
          damage: { count: 1, die: 4 as DieType, type: 'necrotic' as import('@/types').DamageType, bonus: 23 },
          reach: 5,
        });
      }
    }

    // Fighting Style: Defense — +1 AC while wearing armor
    let armorClass = character.armorClass;
    const hasFightingStyle = character.features.some(f => f.id === 'feature_fighting_style');
    const hasArmorEquipped = character.equipment.armor !== null;
    if (hasFightingStyle && hasArmorEquipped) {
      armorClass += 1;
    }

    // Build equipped weapons list for Sneak Attack checks
    const equippedWeapons: Item[] = [];
    if (mainWeaponId) {
      const w = getItem(mainWeaponId);
      if (w) equippedWeapons.push(w);
    }

    return {
      entityId: character.id,
      isPlayer: true,
      isAlly: true,
      stats: {
        abilityScores: { ...character.abilityScores },
        maxHp: character.maxHp,
        currentHp: character.currentHp,
        armorClass,
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
      equipment: {
        weapons: equippedWeapons,
        armor: [],
      },
      initiative: 0,
      savingThrowProficiencies: [...character.proficiencies.savingThrows],
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
      merchantInventory: null,
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
