import type { GameEngine, GameSystem } from './GameEngine';
import type { Coordinate, EntityId, Character, CellFeature, FogState, GridDefinition } from '@/types';
import type { LightingLevel } from '@/types/world';
import type { GameState } from '@/state/GameState';
import type { NarrativeBlock } from '@/types/narrative';
import { Grid } from '@/grid/Grid';
import { FogOfWar } from '@/grid/FogOfWar';
import { MovementTracker } from './MovementTracker';
import { SurvivalRules } from '@/rules/SurvivalRules';
import { SurvivalNarrator } from '@/narrative/SurvivalNarrator';
import { ForageRules } from '@/rules/ForageRules';
import type { ForageOption } from '@/rules/ForageRules';
import { getItem } from '@/data/items';

/** Descriptions for bumping into impassable terrain */
const BUMP_NARRATIVES: Record<string, string[]> = {
  wall: [
    'You press your palm against cold, unyielding stone. There is no passage here.',
    'The wall looms before you, ancient and immovable. You must find another way.',
    'Your fingers trace the rough surface of the wall. It offers no secrets, no hidden doors — only stone.',
  ],
  water: [
    'Dark water laps at the edge. You\'d rather not wade in without good reason.',
    'The water looks deep and cold. Best to find a way around.',
  ],
  lava: [
    'The scorching heat drives you back before you even get close. Certain death lies that way.',
  ],
  pit: [
    'A yawning pit opens at your feet. One more step and you\'d have tumbled into the darkness below.',
  ],
  default: [
    'You cannot pass that way.',
    'Something blocks your path.',
  ],
};

/** Movement flavor text, shown rarely for atmosphere */
const MOVE_FLAVORS: string[] = [
  'A faint breeze carries the scent of damp stone and old earth.',
  'Something skitters away in the darkness beyond your sight.',
  'You pause for a heartbeat, listening. Only silence answers.',
  'The weight of the silence here is almost physical.',
  'A distant drip of water echoes through the stillness.',
  'The air changes — thicker, colder. You press on.',
  'Your shadow stretches long before you, a dark companion on this road.',
  'The ground shifts underfoot, loose and treacherous.',
  'You catch the faintest whiff of smoke on the air. Old, cold smoke.',
  'For a moment, you could swear you heard voices. But there is nothing.',
  'The walls press closer here, narrowing the path ahead.',
  'A cold draft brushes your neck like the touch of spectral fingers.',
  'You mark your path in memory — these passages all look the same.',
  'The oppressive quiet makes your own breathing sound thunderous.',
  'Cobwebs cling to your arms as you push through a narrow gap.',
];

/** Feature discovery narratives */
const FEATURE_NARRATIVES: Record<CellFeature, string[]> = {
  door: [
    'A heavy wooden door stands here, its iron handle worn smooth by countless hands.',
    'You notice a door set into the wall. It looks like it could be opened.',
  ],
  door_locked: [
    'A sturdy door bars the way. The lock gleams — it won\'t yield without a key or clever fingers.',
    'An iron-banded door stands sealed. You\'ll need to find a way to open it.',
  ],
  chest: [
    'A wooden chest sits in the corner, its lid firmly shut. Something glints between the slats.',
    'You spot a chest half-hidden in the shadows. Who knows what treasures it holds?',
  ],
  trap: [
    'Your eye catches something — a thin wire stretched across the floor. A trap!',
    'A subtle discoloration in the stone betrays a pressure plate. Someone doesn\'t want you here.',
  ],
  fire: [
    'Flames crackle and dance, casting long shadows across the walls. The warmth is welcome, but the fire blocks the way.',
  ],
  altar: [
    'An ancient stone altar rises from the floor, its surface carved with worn symbols. You feel a faint thrum of old power.',
  ],
  stairs_up: [
    'Stone steps spiral upward into darkness. Whatever lies above, it awaits your arrival.',
    'A staircase leads up, its steps worn smooth by ages of passage.',
  ],
  stairs_down: [
    'Steps descend into deeper shadow. The air rising from below is cool and carries a faint musty scent.',
    'A stairway plunges downward. The lower depths await.',
  ],
  fountain: [
    'A stone fountain bubbles with clear water. The sound is oddly soothing in this place.',
    'Cool water wells up from a carved basin, catching the light. It looks safe to drink.',
  ],
  pillar: [
    'A thick stone pillar supports the ceiling here, carved with faded patterns.',
  ],
  tree: [
    'A gnarled tree spreads its branches overhead, roots gripping the earth like claws.',
    'An ancient tree stands here, its bark scarred by wind and time.',
  ],
  rock: [
    'A weathered boulder juts from the ground, its surface pocked and cracked.',
    'A large stone rests here, half-buried and stubborn as the mountains that spawned it.',
  ],
  running_water: [
    'A stream flows here, swift and clear over smooth stones. The water looks safe to drink.',
    'Running water courses along a natural channel, glinting in the light. You could refill your waterskin here.',
  ],
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Core exploration state machine. Handles keyboard-driven movement,
 * time advancement, fog of war updates, and feature interaction.
 */
export class ExplorationController implements GameSystem {
  readonly name = 'exploration';
  readonly priority = 10;

  private engine!: GameEngine;

  // Active exploration state — null when not in local mode
  private grid: Grid | null = null;
  private fog: FogOfWar | null = null;
  private playerEntityId: EntityId | null = null;
  private playerPosition: Coordinate | null = null;
  private movementTracker: MovementTracker | null = null;
  private visionRange = 12;
  private lighting: LightingLevel = 'bright';
  private active = false;

  // External references set by main.ts
  private gameState: GameState | null = null;
  private getCharacter: (() => Character | null) | null = null;

  // Track discovered features to avoid repeating narratives
  private discoveredFeatures: Set<string> = new Set();

  // Throttle movement flavor text
  private movesSinceLastFlavor = 0;

  // Look mode cursor
  private lookCursor: Coordinate | null = null;
  private lookMode = false;

  // Active traps: key = "x,y", value = round when placed
  private activeTraps: Map<string, number> = new Map();

  init(engine: GameEngine): void {
    this.engine = engine;

    // Listen for movement input
    engine.events.on('input:move', (event) => {
      if (!this.active) return;
      const { dx, dy } = event.data as { dx: number; dy: number };
      this.handleMove(dx, dy);
    });

    engine.events.on('input:wait', () => {
      if (!this.active) return;
      this.handleWait();
    });

    engine.events.on('input:interact', () => {
      if (!this.active) return;
      this.handleInteract();
    });

    engine.events.on('input:look', () => {
      if (!this.active) return;
      this.handleLook();
    });

    engine.events.on('input:descend', () => {
      if (!this.active) return;
      this.handleStairs('stairs_down');
    });

    engine.events.on('input:ascend', () => {
      if (!this.active) return;
      this.handleStairs('stairs_up');
    });

    engine.events.on('input:look_move', (event) => {
      if (!this.active || !this.lookMode) return;
      const { dx, dy } = event.data as { dx: number; dy: number };
      this.handleLookMove(dx, dy);
    });

    engine.events.on('input:look_exit', () => {
      if (!this.active || !this.lookMode) return;
      this.handleLookExit();
    });

    engine.events.on('input:forage', () => {
      if (!this.active) return;
      this.handleForage();
    });

    // Escape also exits look mode (via global cancel)
    engine.events.on('input:cancel', () => {
      if (this.lookMode) {
        this.handleLookExit();
      }
    });
  }

  /** Configure external dependencies. */
  configure(opts: {
    gameState: GameState;
    getCharacter: () => Character | null;
  }): void {
    this.gameState = opts.gameState;
    this.getCharacter = opts.getCharacter;
  }

  /** Enter a local space and begin exploration. */
  enterSpace(
    grid: Grid,
    fog: FogOfWar,
    playerEntityId: EntityId,
    startPosition: Coordinate,
    speed: number,
    lighting: LightingLevel = 'bright',
  ): void {
    this.grid = grid;
    this.fog = fog;
    this.playerEntityId = playerEntityId;
    this.playerPosition = { ...startPosition };
    this.movementTracker = new MovementTracker(speed);
    this.lighting = lighting;
    this.discoveredFeatures = new Set();
    this.movesSinceLastFlavor = 0;

    // Set vision range based on lighting
    this.visionRange = this.getVisionRange();

    // Place player on grid
    grid.placeEntity(playerEntityId, startPosition, 1);

    // Calculate initial FOV
    fog.updateVisibility(grid, [{ position: startPosition, range: this.visionRange }]);

    this.active = true;

    // Emit initial state
    this.engine.events.emit({
      type: 'exploration:entered',
      category: 'world',
      data: { position: startPosition },
    });
  }

  /** Leave local exploration mode. */
  exitSpace(): void {
    if (this.grid && this.playerEntityId) {
      this.grid.removeEntity(this.playerEntityId);
    }
    this.grid = null;
    this.fog = null;
    this.playerEntityId = null;
    this.playerPosition = null;
    this.movementTracker = null;
    this.active = false;
  }

  isActive(): boolean {
    return this.active;
  }

  getPlayerPosition(): Coordinate | null {
    return this.playerPosition ? { ...this.playerPosition } : null;
  }

  getGrid(): Grid | null {
    return this.grid;
  }

  getFog(): FogOfWar | null {
    return this.fog;
  }

  getFogState(): FogState | null {
    return this.fog?.getState() ?? null;
  }

  getGridDefinition(): GridDefinition | null {
    return this.grid?.getDefinition() ?? null;
  }

  /**
   * Check whether the player can currently see the edge of the map
   * in the given cardinal/diagonal direction.
   * Used to gate overworld travel — the party must reach the map edge to leave.
   *
   * Direction: dx/dy relative to current overworld tile
   * (e.g. dx=0,dy=-1 = north, dx=1,dy=1 = southeast)
   */
  canSeeMapEdge(dx: number, dy: number): boolean {
    if (!this.grid || !this.fog) return false;

    const fogState = this.fog.getState();
    const w = this.grid.getWidth();
    const h = this.grid.getHeight();

    // For each direction component, check if any cell along that edge is visible
    // North edge (dy < 0): row 0
    // South edge (dy > 0): row h-1
    // West edge (dx < 0): col 0
    // East edge (dx > 0): col w-1

    if (dy < 0) {
      // Must see north edge
      let found = false;
      for (let x = 0; x < w; x++) {
        if (fogState.visible.has(`${x},0`)) { found = true; break; }
      }
      if (!found) return false;
    }
    if (dy > 0) {
      let found = false;
      for (let x = 0; x < w; x++) {
        if (fogState.visible.has(`${x},${h - 1}`)) { found = true; break; }
      }
      if (!found) return false;
    }
    if (dx < 0) {
      let found = false;
      for (let y = 0; y < h; y++) {
        if (fogState.visible.has(`0,${y}`)) { found = true; break; }
      }
      if (!found) return false;
    }
    if (dx > 0) {
      let found = false;
      for (let y = 0; y < h; y++) {
        if (fogState.visible.has(`${w - 1},${y}`)) { found = true; break; }
      }
      if (!found) return false;
    }

    return true;
  }

  // ── Movement ──────────────────────────────────────────────

  private handleMove(dx: number, dy: number): void {
    if (!this.grid || !this.fog || !this.playerEntityId || !this.playerPosition || !this.movementTracker) return;

    const target: Coordinate = {
      x: this.playerPosition.x + dx,
      y: this.playerPosition.y + dy,
    };

    // Validate position
    if (!this.grid.isValidPosition(target.x, target.y)) {
      this.emitNarrative('You stand at the edge of the known world. There is nothing beyond.', 'system');
      return;
    }

    // Check passability
    if (!this.grid.isPassable(target.x, target.y)) {
      const cell = this.grid.getCell(target.x, target.y);
      const terrain = cell?.terrain ?? 'default';
      const narratives = BUMP_NARRATIVES[terrain] ?? BUMP_NARRATIVES['default'];
      this.emitNarrative(pick(narratives), 'description');
      return;
    }

    // Check for blocking entity
    const blockingEntity = this.grid.getEntityAt(target);
    if (blockingEntity && blockingEntity !== this.playerEntityId) {
      this.engine.events.emit({
        type: 'exploration:bump_entity',
        category: 'world',
        data: { entityId: blockingEntity, position: target },
      });
      return;
    }

    // Execute move
    this.grid.moveEntity(this.playerEntityId, target);
    this.playerPosition = { ...target };

    // Calculate time cost
    const terrainCost = this.grid.getMovementCost(target.x, target.y);
    const movementFeet = 5 * terrainCost;
    const roundsElapsed = this.movementTracker.addMovement(movementFeet);

    // Advance time
    if (roundsElapsed > 0) {
      this.advanceTimeAndTick(roundsElapsed);
    }

    // Update FOV
    this.fog.updateVisibility(this.grid, [{ position: target, range: this.visionRange }]);

    // Occasional movement flavor text
    this.movesSinceLastFlavor++;
    if (this.movesSinceLastFlavor >= 20 + Math.floor(Math.random() * 15)) {
      this.emitNarrative(pick(MOVE_FLAVORS), 'description');
      this.movesSinceLastFlavor = 0;
    }

    // Check features at new position
    this.checkFeatures(target);

    // Emit moved event for UI (camera follow, entity update)
    this.engine.events.emit({
      type: 'exploration:moved',
      category: 'world',
      data: { position: target, roundsElapsed },
    });
  }

  private handleWait(): void {
    if (!this.movementTracker || !this.fog || !this.grid || !this.playerPosition) return;

    const rounds = this.movementTracker.wait();
    this.advanceTimeAndTick(rounds);

    // Update FOV (in case things changed)
    this.fog.updateVisibility(this.grid, [{ position: this.playerPosition, range: this.visionRange }]);

    this.emitNarrative(
      'You stand still, listening. The world moves around you — the faint drip of water, the whisper of air through unseen passages. A moment passes.',
      'description',
    );

    this.engine.events.emit({
      type: 'exploration:waited',
      category: 'world',
      data: { position: this.playerPosition, roundsElapsed: rounds },
    });
  }

  // ── Interaction ───────────────────────────────────────────

  /** Interaction option for the picker */
  private static readonly INTERACTION_LABELS: Record<string, { label: string; icon: string }> = {
    door: { label: 'Open Door', icon: '🚪' },
    door_locked: { label: 'Try Locked Door', icon: '🔒' },
    chest: { label: 'Open Chest', icon: '📦' },
    fountain_drink: { label: 'Drink from Fountain', icon: '⛲' },
    fountain_refill: { label: 'Refill Waterskin', icon: '💧' },
    running_water_drink: { label: 'Drink from Stream', icon: '🌊' },
    running_water_refill: { label: 'Refill Waterskin', icon: '💧' },
    altar: { label: 'Touch Altar', icon: '🗿' },
    stagnant_water: { label: 'Inspect Stagnant Water', icon: '💧' },
  };

  /** Check if inventory has a waterskin that isn't full. */
  private hasEmptyWaterskin(): boolean {
    const character = this.getCharacter?.();
    if (!character) return false;
    for (const entry of character.inventory.items) {
      const item = getItem(entry.itemId);
      if (item && item.maxCharges != null && item.maxCharges > 0) {
        const curC = entry.charges ?? item.charges ?? 0;
        if (curC < item.maxCharges) return true;
      }
    }
    return false;
  }

  private handleInteract(): void {
    if (!this.grid || !this.playerPosition) return;

    const directions = [
      { dx: 0, dy: -1 }, { dx: 1, dy: -1 }, { dx: 1, dy: 0 }, { dx: 1, dy: 1 },
      { dx: 0, dy: 1 }, { dx: -1, dy: 1 }, { dx: -1, dy: 0 }, { dx: -1, dy: -1 },
    ];

    const cellsToCheck: Coordinate[] = [this.playerPosition];
    for (const d of directions) {
      cellsToCheck.push({ x: this.playerPosition.x + d.dx, y: this.playerPosition.y + d.dy });
    }

    // Collect all available interactions
    const interactions: { key: string; coord: Coordinate; feature?: CellFeature }[] = [];
    const seen = new Set<string>();

    for (const coord of cellsToCheck) {
      const cell = this.grid.getCell(coord.x, coord.y);
      if (!cell) continue;

      for (const feature of cell.features) {
        if (feature === 'door' || feature === 'door_locked' || feature === 'chest' || feature === 'altar') {
          if (!seen.has(feature)) {
            seen.add(feature);
            interactions.push({ key: feature, coord, feature });
          }
        }

        // Water sources → split into drink + refill options
        if ((feature === 'fountain' || feature === 'running_water') && !seen.has(feature)) {
          seen.add(feature);
          interactions.push({ key: `${feature}_drink`, coord, feature });
          if (this.hasEmptyWaterskin()) {
            interactions.push({ key: `${feature}_refill`, coord, feature });
          }
        }
      }

      // Standing water
      if (cell.terrain === 'water' && !cell.features.includes('running_water') && !seen.has('stagnant_water')) {
        seen.add('stagnant_water');
        interactions.push({ key: 'stagnant_water', coord });
      }
    }

    if (interactions.length === 0) {
      this.emitNarrative('There is nothing nearby to interact with.', 'system');
      return;
    }

    // Single interaction — execute immediately
    if (interactions.length === 1) {
      this.executeInteraction(interactions[0]);
      return;
    }

    // Multiple interactions — emit picker event
    this.engine.events.emit({
      type: 'exploration:interact_picker',
      category: 'ui',
      data: {
        options: interactions.map(i => ({
          key: i.key,
          label: ExplorationController.INTERACTION_LABELS[i.key]?.label ?? i.key,
          icon: ExplorationController.INTERACTION_LABELS[i.key]?.icon ?? '❓',
        })),
        onSelect: (key: string) => {
          const interaction = interactions.find(i => i.key === key);
          if (interaction) this.executeInteraction(interaction);
        },
      },
    });
  }

  private executeInteraction(interaction: { key: string; coord: Coordinate; feature?: CellFeature }): void {
    const { key, coord, feature } = interaction;
    switch (key) {
      case 'door':
      case 'door_locked':
        this.interactDoor(coord, feature!);
        break;
      case 'chest':
        this.interactChest(coord);
        break;
      case 'fountain_drink':
        this.drinkFromWaterSource('fountain');
        break;
      case 'running_water_drink':
        this.drinkFromWaterSource('stream');
        break;
      case 'fountain_refill':
      case 'running_water_refill':
        this.refillWaterskins();
        break;
      case 'altar':
        this.emitNarrative(
          'You lay your hands upon the ancient altar. The carved symbols seem to pulse faintly beneath your touch, but whatever power once resided here has long since faded — or perhaps it merely sleeps, waiting for the right offering.',
          'description',
        );
        break;
      case 'stagnant_water':
        this.emitNarrative(
          'The water is dark and still, its surface slick with a faint oily sheen. You would not drink from this — stagnant water breeds sickness.',
          'description',
        );
        break;
    }
  }

  private interactDoor(coord: Coordinate, feature: CellFeature): void {
    if (!this.grid) return;
    const cell = this.grid.getCell(coord.x, coord.y);
    if (!cell) return;

    if (feature === 'door_locked') {
      this.emitNarrative(
        'You try the door, but it holds fast. The lock is solid — you\'ll need a key, or perhaps a more creative approach.',
        'action',
      );
      return;
    }

    // Toggle door: make passable/impassable
    if (cell.movementCost === Infinity) {
      // Door is closed → open it
      cell.movementCost = 1;
      cell.blocksLoS = false;
      this.emitNarrative(
        'The door swings open with a groan of old hinges, revealing the space beyond.',
        'action',
      );
    } else {
      // Door is open → close it
      cell.movementCost = Infinity;
      cell.blocksLoS = true;
      this.emitNarrative(
        'You pull the door shut. It closes with a heavy thud that echoes through the corridors.',
        'action',
      );
    }

    // Update FOV since LoS may have changed
    if (this.fog && this.playerPosition) {
      this.fog.updateVisibility(this.grid, [{ position: this.playerPosition, range: this.visionRange }]);
    }

    this.engine.events.emit({
      type: 'exploration:interacted',
      category: 'world',
      data: { feature: 'door', position: coord },
    });
  }

  private interactChest(_coord: Coordinate): void {
    this.emitNarrative(
      'You kneel beside the chest and carefully lift the lid. The hinges protest, releasing a puff of stale air. Inside you find...',
      'action',
    );
    // Future: emit loot event for item generation
    this.engine.events.emit({
      type: 'exploration:chest_opened',
      category: 'world',
      data: {},
    });
  }

  private drinkFromWaterSource(source: 'fountain' | 'stream'): void {
    const character = this.getCharacter?.();
    if (!character) return;

    const thirstBefore = character.survival.thirst;
    SurvivalRules.consume(character.survival, { thirstReduction: 30 });

    const desc = source === 'fountain'
      ? 'You cup your hands and drink deeply from the fountain. The water is cold and pure, carrying the faintest mineral sweetness.'
      : 'You kneel by the flowing water and drink deeply. The current is swift and clean, carrying the taste of mountain stone.';

    this.emitNarrative(
      SurvivalNarrator.describeDrinking(thirstBefore, character.survival.thirst, desc).text,
      'action',
    );

    this.engine.events.emit({
      type: source === 'fountain' ? 'exploration:fountain_used' : 'exploration:water_used',
      category: 'world',
      data: {},
    });
  }

  private refillWaterskins(): void {
    const character = this.getCharacter?.();
    if (!character) return;

    let refilled = false;
    for (const entry of character.inventory.items) {
      const item = getItem(entry.itemId);
      if (item && item.maxCharges != null && item.maxCharges > 0) {
        const curC = entry.charges ?? item.charges ?? 0;
        if (curC < item.maxCharges) {
          entry.charges = item.maxCharges;
          refilled = true;
        }
      }
    }

    if (refilled) {
      this.emitNarrative(
        'You hold your waterskin beneath the flow and watch it fill. The leather swells with cool, clean water — enough to see you through the dark hours ahead.',
        'action',
      );
    } else {
      this.emitNarrative(
        'Your waterskin is already full.',
        'system',
      );
    }
  }

  private handleStairs(type: 'stairs_up' | 'stairs_down'): void {
    if (!this.grid || !this.playerPosition) return;

    const cell = this.grid.getCell(this.playerPosition.x, this.playerPosition.y);
    if (!cell || !cell.features.includes(type)) {
      this.emitNarrative(
        type === 'stairs_down'
          ? 'There are no stairs leading down here.'
          : 'There are no stairs leading up here.',
        'system',
      );
      return;
    }

    this.engine.events.emit({
      type: `exploration:${type === 'stairs_down' ? 'descend' : 'ascend'}`,
      category: 'world',
      data: { position: this.playerPosition },
    });
  }

  // ── Forage / Hunt / Fish / Trap ──────────────────────────

  private handleForage(): void {
    if (!this.grid || !this.playerPosition) return;

    const cell = this.grid.getCell(this.playerPosition.x, this.playerPosition.y);
    if (!cell) return;

    // Gather adjacent terrain and features
    const dirs = [
      { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 },
      { dx: 1, dy: -1 }, { dx: 1, dy: 1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 },
    ];
    const adjTerrains: import('@/types/grid').CellTerrain[] = [];
    const adjFeatures: import('@/types/grid').CellFeature[] = [];
    for (const d of dirs) {
      const ac = this.grid.getCell(this.playerPosition.x + d.dx, this.playerPosition.y + d.dy);
      if (ac) {
        adjTerrains.push(ac.terrain);
        for (const f of ac.features) adjFeatures.push(f);
      }
    }

    // Check for active trap at this position
    const trapKey = `${this.playerPosition.x},${this.playerPosition.y}`;
    if (this.activeTraps.has(trapKey)) {
      this.checkTrap(trapKey);
      return;
    }
    // Also check adjacent cells for traps
    for (const d of dirs) {
      const tk = `${this.playerPosition.x + d.dx},${this.playerPosition.y + d.dy}`;
      if (this.activeTraps.has(tk)) {
        this.checkTrap(tk);
        return;
      }
    }

    const options = ForageRules.getAvailableActions(cell.terrain, cell.features, adjTerrains, adjFeatures);

    if (options.length === 0) {
      this.emitNarrative('There is nothing to forage, hunt, or fish for here.', 'system');
      return;
    }

    if (options.length === 1) {
      this.executeForageAction(options[0]);
    } else {
      // Emit menu event for main.ts to show a modal
      this.engine.events.emit({
        type: 'forage:menu',
        category: 'ui',
        data: { options },
      });
    }
  }

  executeForageAction(option: ForageOption): void {
    const character = this.getCharacter?.();
    if (!character || !this.playerPosition || !this.grid) return;

    // Set trap is special — place it and return later (no hourly loop)
    if (option.action === 'set_trap') {
      const trapKey = `${this.playerPosition.x},${this.playerPosition.y}`;
      this.activeTraps.set(trapKey, this.gameState?.world.time.totalRounds ?? 0);
      this.advanceTimeAndTick(option.timeRounds);
      this.emitNarrative(
        SurvivalNarrator.describeForageAttempt('set_trap', true).text,
        'action',
      );
      return;
    }

    // For forage/hunt/fish — emit event so main.ts shows duration picker + TimeActivity
    const cell = this.grid.getCell(this.playerPosition.x, this.playerPosition.y);
    this.engine.events.emit({
      type: 'forage:pick_duration',
      category: 'ui',
      data: {
        option,
        terrain: cell?.terrain ?? 'grass',
        features: cell?.features ?? [],
      },
    });
  }

  private checkTrap(trapKey: string): void {
    const character = this.getCharacter?.();
    if (!character) return;

    const placedRound = this.activeTraps.get(trapKey);
    if (placedRound === undefined) return;

    const currentRound = this.gameState?.world.time.totalRounds ?? 0;
    const elapsed = currentRound - placedRound;

    // Remove the trap regardless of outcome
    this.activeTraps.delete(trapKey);

    const result = ForageRules.checkTrap(elapsed, Math.random);
    const itemDef = result.itemId ? getItem(result.itemId) : null;
    const itemName = itemDef?.name ?? 'meat';

    const narrative = SurvivalNarrator.describeForageAttempt('check_trap', result.success, itemName);
    this.emitNarrative(narrative.text, narrative.category);

    if (result.success && result.itemId) {
      const existingEntry = character.inventory.items.find(e => e.itemId === result.itemId);
      if (existingEntry) {
        existingEntry.quantity += result.quantity;
      } else {
        character.inventory.items.push({ itemId: result.itemId, quantity: result.quantity });
      }
      this.emitNarrative(`Gained ${result.quantity}× ${itemName}.`, 'loot');
    }
  }

  private handleLook(): void {
    if (!this.grid || !this.playerPosition || !this.fog) return;

    // Enter look mode with cursor at player position
    this.lookMode = true;
    this.lookCursor = { ...this.playerPosition };

    // Push look context onto keyboard input
    this.engine.events.emit({
      type: 'exploration:look_enter',
      category: 'ui',
      data: { position: this.lookCursor },
    });

    this.emitNarrative('Look mode — move cursor with hjkl, press x or Esc to exit.', 'system');
    this.describeCellAt(this.lookCursor.x, this.lookCursor.y);
  }

  private handleLookMove(dx: number, dy: number): void {
    if (!this.grid || !this.fog || !this.lookCursor) return;

    const nx = this.lookCursor.x + dx;
    const ny = this.lookCursor.y + dy;

    // Only allow movement within visible cells
    if (!this.fog.isVisible(nx, ny)) return;

    this.lookCursor = { x: nx, y: ny };

    this.engine.events.emit({
      type: 'exploration:look_move',
      category: 'ui',
      data: { position: this.lookCursor },
    });

    this.describeCellAt(nx, ny);
  }

  private handleLookExit(): void {
    this.lookMode = false;
    this.lookCursor = null;

    this.engine.events.emit({
      type: 'exploration:look_exit',
      category: 'ui',
      data: {},
    });
  }

  /** Whether look mode is currently active. */
  isLookMode(): boolean {
    return this.lookMode;
  }

  private describeCellAt(x: number, y: number): void {
    if (!this.grid) return;

    const cell = this.grid.getCell(x, y);
    if (!cell) return;

    const isPlayer = this.playerPosition?.x === x && this.playerPosition?.y === y;
    let description = isPlayer
      ? `You stand on ${this.describesTerrain(cell.terrain)}.`
      : `You see ${this.describesTerrain(cell.terrain)}.`;

    if (cell.features.length > 0) {
      const featureDescs = cell.features.map(f => this.describeFeature(f));
      description += ' There is ' + featureDescs.join(', ') + '.';
    }

    // Check for entities at this position
    const entityId = this.grid.getEntityAt({ x, y });
    if (entityId && entityId !== this.playerEntityId) {
      description += ' A creature stands here.';
    }

    this.emitNarrative(description, 'description');
  }

  // ── Helpers ───────────────────────────────────────────────

  private advanceTimeAndTick(rounds: number): void {
    if (!this.gameState) return;
    this.gameState.advanceTime(rounds);

    const character = this.getCharacter?.();
    if (!character) return;

    const result = SurvivalRules.tick(character.survival, rounds);

    if (result.hungerCrossing) {
      const block = SurvivalNarrator.describeHungerCrossing(result.hungerCrossing.to);
      this.emitNarrative(block.text, block.category);
    }
    if (result.thirstCrossing) {
      const block = SurvivalNarrator.describeThirstCrossing(result.thirstCrossing.to);
      this.emitNarrative(block.text, block.category);
    }
    if (result.fatigueCrossing) {
      const block = SurvivalNarrator.describeFatigueCrossing(result.fatigueCrossing.to);
      this.emitNarrative(block.text, block.category);
    }

    this.engine.events.emit({
      type: 'time:advanced',
      category: 'time',
      data: { rounds },
    });
  }

  private checkFeatures(position: Coordinate): void {
    if (!this.grid) return;
    const cell = this.grid.getCell(position.x, position.y);
    if (!cell || cell.features.length === 0) return;

    const key = `${position.x},${position.y}`;
    if (this.discoveredFeatures.has(key)) return;
    this.discoveredFeatures.add(key);

    for (const feature of cell.features) {
      const narratives = FEATURE_NARRATIVES[feature];
      if (narratives) {
        this.emitNarrative(pick(narratives), 'description');
      }
    }
  }

  private emitNarrative(text: string, category: NarrativeBlock['category']): void {
    this.engine.events.emit({
      type: 'narrative:exploration',
      category: 'narrative',
      data: {
        block: { text, category } as NarrativeBlock,
      },
    });
  }

  private getVisionRange(): number {
    switch (this.lighting) {
      case 'bright': return 12;
      case 'dim': return 6;
      case 'dark': return 0;
      default: return 12;
    }
  }

  private describesTerrain(terrain: string): string {
    const descriptions: Record<string, string> = {
      floor: 'worn stone flooring',
      wall: 'solid stone',
      grass: 'soft grass',
      water: 'shallow water',
      lava: 'molten rock',
      stone: 'rough stone ground',
      ice: 'treacherous ice',
      mud: 'thick, sucking mud',
      sand: 'fine sand',
      wood: 'creaking wooden planks',
      pit: 'the edge of a dark pit',
    };
    return descriptions[terrain] ?? 'uncertain ground';
  }

  private describeFeature(feature: CellFeature): string {
    const descriptions: Record<CellFeature, string> = {
      door: 'a door',
      door_locked: 'a locked door',
      chest: 'a chest',
      trap: 'a trap',
      fire: 'a fire',
      altar: 'an altar',
      stairs_up: 'stairs leading up',
      stairs_down: 'stairs leading down',
      fountain: 'a fountain',
      pillar: 'a stone pillar',
      tree: 'a gnarled tree',
      rock: 'a large rock',
      running_water: 'flowing water',
    };
    return descriptions[feature] ?? 'something';
  }
}
