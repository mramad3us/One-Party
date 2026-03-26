import type { GameEngine, GameSystem } from './GameEngine';
import type { Coordinate, EntityId, Character, CellFeature, FogState, GridDefinition } from '@/types';
import type { LightingLevel } from '@/types/world';
import type { GameState } from '@/state/GameState';
import type { NarrativeBlock } from '@/types/narrative';
import { Grid } from '@/grid/Grid';
import { FogOfWar } from '@/grid/FogOfWar';
import { LineOfSight } from '@/grid/LineOfSight';
import { MovementTracker } from './MovementTracker';
import { SurvivalRules } from '@/rules/SurvivalRules';
import { SurvivalNarrator } from '@/narrative/SurvivalNarrator';
import { ForageRules } from '@/rules/ForageRules';
import type { ForageOption } from '@/rules/ForageRules';
import { getItem } from '@/data/items';
import { gameTimeToCalendar } from '@/types/time';

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
  torch_wall: [
    'A torch burns in an iron sconce on the wall, casting flickering shadows across the stone.',
    'Firelight dances from a wall-mounted torch, its flame guttering in an unseen draft.',
  ],
  torch_wall_spent: [
    'An empty iron sconce juts from the wall, its torch long since burned to ash. Soot stains the stone above it like a black tongue.',
    'A spent torch hangs limp in its bracket, nothing but a charred stub. This place has been dark a long time.',
    'The remains of a wall torch — a blackened stick in a rusted sconce. Whoever lit it last never came back.',
  ],
  brazier: [
    'A large brazier crackles with burning coals, its warmth radiating outward in waves. The fire pit lights the chamber with a deep orange glow.',
    'An iron brazier stands here, its bed of embers painting the surrounding stone in shades of amber and crimson.',
  ],
  table: [
    'A sturdy wooden table stands here, its surface scarred by years of use.',
    'A well-crafted table occupies this space, its planks worn smooth by countless meals and meetings.',
  ],
  chair: [
    'A simple wooden chair sits here, waiting for someone to rest their weary bones.',
  ],
  bed: [
    'A bed with rumpled linens offers the promise of rest in this unforgiving place.',
    'A sleeping pallet lies here, its blankets still bearing the impression of whoever last sought respite.',
  ],
  shelf: [
    'A tall wooden shelf looms here, its boards sagging under the weight of accumulated goods.',
    'Shelves line the wall, cluttered with dusty odds and ends.',
  ],
  counter: [
    'A polished wooden counter stretches across the space, its surface worn by years of commerce.',
  ],
  anvil: [
    'A heavy iron anvil squats on a thick stump, its face pitted from a thousand hammer blows.',
    'An anvil stands here, dark and massive. The ring of steel on iron still seems to hang in the air.',
  ],
  barrel: [
    'A stout wooden barrel stands here, its staves bound with iron bands.',
    'A barrel rests against the wall. Something sloshes faintly within.',
  ],
  crate: [
    'A wooden crate sits here, its planks nailed shut. Whatever is inside was meant to stay there.',
    'A sturdy shipping crate occupies this corner, its contents a mystery.',
  ],
  bookshelf: [
    'A towering bookshelf reaches toward the ceiling, its shelves crammed with leather-bound volumes.',
    'Books of every size and color crowd these shelves. The scent of old parchment fills the air.',
  ],
  rug: [
    'A richly woven rug covers the floor, its patterns faded but still beautiful.',
    'A decorative rug lies underfoot, its crimson and gold threads speaking of distant lands.',
  ],
  banner: [
    'A fabric banner hangs from the wall, its colors faded but its heraldry still legible.',
    'A tattered banner sways in a draft you cannot feel, bearing symbols of an age gone by.',
  ],
  well: [
    'A stone well rises from the ground, its rope and bucket still intact. Dark water gleams far below.',
    'You peer into a deep well. The water at the bottom reflects a perfect circle of light.',
  ],
  market_stall: [
    'A vendor\'s stall stands here, its colorful awning shading a counter of wares.',
    'A market stall displays its goods beneath a bright canopy, awaiting customers.',
  ],
  sign: [
    'A wooden signpost juts from the ground, its painted letters pointing the way.',
    'A weathered sign hangs here, its message still readable despite the elements.',
  ],
  candle: [
    'A lone candle flickers in a holder, its small flame casting a warm circle of light.',
    'A candle gutters here, its wax pooling in a brass dish. The flame dances with each breath of air.',
  ],
  chandelier: [
    'An ornate chandelier hangs overhead, its many candles bathing the room in warm, golden light.',
    'A brass chandelier sways gently above, its flames casting shifting shadows across the walls.',
  ],
  weapon_rack: [
    'A wooden rack displays an array of weapons — blades, hafts, and points gleaming in the dim light.',
    'Weapons of various make hang from a sturdy rack, ready to be claimed by willing hands.',
  ],
  hearth: [
    'A stone hearth crackles with a welcoming fire, its warmth seeping into your bones.',
    'A fireplace dominates the wall, its flames licking at blackened stones. The scent of woodsmoke fills the air.',
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
    this.interiorTiles = null;
    this.discoveredFeatures = new Set();
    this.movesSinceLastFlavor = 0;

    // Place player on grid
    grid.placeEntity(playerEntityId, startPosition, 1);

    // Calculate initial FOV + lighting
    this.refreshVision(startPosition);

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

    // Update FOV + lighting
    this.refreshVision(target);

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

    // Update FOV + lighting
    this.refreshVision(this.playerPosition);

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

    // Door state changed — recompute interior map and refresh vision
    this.clearInteriorCache();
    if (this.fog && this.playerPosition) {
      this.refreshVision(this.playerPosition);
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
      this.engine.events.emit({
        type: 'exploration:waterskin_refilled',
        category: 'world',
        data: {},
      });
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
    if (!this.gameState) return;

    const biome = this.gameState.getCurrentRegion().biome;
    const options = ForageRules.getAvailableActions(biome);

    if (options.length === 1) {
      this.executeForageAction(options[0]);
    } else {
      this.engine.events.emit({
        type: 'forage:menu',
        category: 'ui',
        data: { options },
      });
    }
  }

  executeForageAction(option: ForageOption): void {
    if (!this.gameState) return;

    const biome = this.gameState.getCurrentRegion().biome;
    this.engine.events.emit({
      type: 'forage:pick_duration',
      category: 'ui',
      data: { option, biome },
    });
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

  /** Recalculate vision range, FOV, and per-tile lighting in one pass. */
  refreshVision(pos?: Coordinate): void {
    const p = pos ?? this.playerPosition;
    if (!this.fog || !this.grid || !p) return;
    this.visionRange = this.getVisionRange();
    this.fog.updateVisibility(this.grid, this.buildObservers(p));
    this.computeTileLighting(p);
  }

  // ── Per-tile lighting system ─────────────────────────────────

  /**
   * Get the ambient light level (1–10) for outdoor tiles based on time of day.
   * Peak (10) between 8am–5pm, linear dimming outside that window.
   * Night floor is 1.
   */
  private getAmbientLight(): number {
    if (this.lighting === 'dark') return 1;
    if (this.lighting === 'dim') return 5;

    // Outdoor 'bright' locations vary with time of day
    if (!this.gameState) return 10;
    const cal = gameTimeToCalendar(this.gameState.world.time);
    const h = cal.hour + cal.minute / 60;

    // 8:00–17:00 = peak daylight (10)
    if (h >= 8 && h <= 17) return 10;
    // 17:00–24:00 = linear dim from 10→1 over 7 hours
    if (h > 17) return Math.max(1, Math.round(10 - (h - 17) * (9 / 7)));
    // 0:00–5:00 = deep night (1)
    if (h < 5) return 1;
    // 5:00–8:00 = dawn brightening from 1→10 over 3 hours
    return Math.max(1, Math.round(1 + (h - 5) * (9 / 3)));
  }

  /**
   * Get the player's personal light radius in cells.
   * Torch in off hand = 6 cells. No light = 0.
   */
  private getPersonalLightRange(): number {
    const character = this.getCharacter?.();
    if (!character) return 0;

    if (character.equipment.offHand === 'item_torch') {
      const charges = character.equipmentCharges.offHand ?? 0;
      if (charges > 0) return 6;
    }
    return 0;
  }

  /**
   * Compute the effective FOV range based on ambient light + personal light.
   * Quadratic curve so darkness is felt strongly:
   *   light 1 → 2 cells (player + immediate neighbors)
   *   light 3 → 4 cells
   *   light 5 → 6 cells
   *   light 10 → 12 cells
   */
  /** Get the effective ambient light at the player's current position. */
  private getEffectiveAmbient(): number {
    const ambient = this.getAmbientLight();
    // Interior tiles (enclosed by walls) are always dark regardless of time of day
    if (this.playerPosition) {
      const interior = this.computeInteriorTiles();
      if (interior.has(`${this.playerPosition.x},${this.playerPosition.y}`)) return 1;
    }
    return ambient;
  }

  private getVisionRange(): number {
    const ambient = this.getEffectiveAmbient();
    const personalRange = this.getPersonalLightRange();

    // Quadratic: 2 + 10 * ((ambient-1)/9)^1.5  — darkness bites hard
    const t = (ambient - 1) / 9;
    const ambientRange = Math.round(2 + 10 * Math.pow(t, 1.5));
    return Math.max(ambientRange, personalRange);
  }

  /**
   * Build the full list of vision observers: player + map light sources in dark conditions.
   */
  private buildObservers(playerPos: Coordinate): { position: Coordinate; range: number }[] {
    const observers: { position: Coordinate; range: number }[] = [
      { position: playerPos, range: this.visionRange },
    ];

    // When effective ambient is low, add map light sources as independent observers.
    // Skip sources on wall tiles — wall torches illuminate via computeTileLighting,
    // not by acting as FOV origins (which would let them see through walls).
    const ambient = this.getEffectiveAmbient();
    if (ambient <= 3 && this.grid) {
      const sources = this.grid.getLightSources();
      for (const src of sources) {
        const cell = this.grid.getCell(src.position.x, src.position.y);
        if (cell && !cell.blocksLoS) {
          observers.push({ position: src.position, range: Math.ceil(src.range * 0.6) });
        }
      }
    }

    return observers;
  }

  /**
   * After FOV is computed, assign per-tile lighting values to the fog.
   * Ambient light sets the base, then light sources and player torch add local brightness.
   */
  /** Cached set of "x,y" keys for tiles detected as interior (enclosed by walls). */
  private interiorTiles: Set<string> | null = null;

  /**
   * Flood-fill from all map edges to find outdoor tiles.
   * Any passable tile NOT reachable from an edge without crossing a wall is interior.
   * Cached per grid — call clearInteriorCache() when the grid changes.
   */
  private computeInteriorTiles(): Set<string> {
    if (this.interiorTiles) return this.interiorTiles;
    if (!this.grid) return new Set();

    const w = this.grid.getWidth();
    const h = this.grid.getHeight();
    const outdoor = new Set<string>();
    const queue: Coordinate[] = [];

    // Seed with all passable edge tiles
    for (let x = 0; x < w; x++) {
      for (const y of [0, h - 1]) {
        const cell = this.grid.getCell(x, y);
        if (cell && !cell.blocksLoS && cell.terrain !== 'wall') {
          const key = `${x},${y}`;
          if (!outdoor.has(key)) { outdoor.add(key); queue.push({ x, y }); }
        }
      }
    }
    for (let y = 1; y < h - 1; y++) {
      for (const x of [0, w - 1]) {
        const cell = this.grid.getCell(x, y);
        if (cell && !cell.blocksLoS && cell.terrain !== 'wall') {
          const key = `${x},${y}`;
          if (!outdoor.has(key)) { outdoor.add(key); queue.push({ x, y }); }
        }
      }
    }

    // BFS flood-fill — walls and closed doors block the flood
    const dirs = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];
    while (queue.length > 0) {
      const pos = queue.shift()!;
      for (const { dx, dy } of dirs) {
        const nx = pos.x + dx;
        const ny = pos.y + dy;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        const key = `${nx},${ny}`;
        if (outdoor.has(key)) continue;
        const cell = this.grid.getCell(nx, ny);
        if (!cell || cell.terrain === 'wall') continue;
        // Closed doors block the flood (blocksLoS = true when closed)
        if (cell.features.includes('door') && cell.blocksLoS) continue;
        outdoor.add(key);
        queue.push({ x: nx, y: ny });
      }
    }

    // Interior = all passable tiles NOT reached by the flood
    const interior = new Set<string>();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const cell = this.grid.getCell(x, y);
        if (!cell || cell.terrain === 'wall') continue;
        const key = `${x},${y}`;
        if (!outdoor.has(key)) interior.add(key);
      }
    }

    this.interiorTiles = interior;
    return interior;
  }

  /** Clear cached interior tiles (call when doors open/close or grid changes). */
  clearInteriorCache(): void {
    this.interiorTiles = null;
  }

  private computeTileLighting(playerPos: Coordinate): void {
    if (!this.fog || !this.grid) return;

    const ambient = this.getAmbientLight();
    const w = this.grid.getWidth();
    const h = this.grid.getHeight();
    const interior = this.computeInteriorTiles();

    // Set ambient level on all visible tiles
    // Interior tiles (enclosed by walls) are always dark — only light sources illuminate them
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!this.fog.isVisible(x, y)) continue;
        const tileAmbient = interior.has(`${x},${y}`) ? 1 : ambient;
        this.fog.setLightLevel(x, y, tileAmbient);
      }
    }

    // Outdoor light leaks through open doors into interior tiles.
    // Each open door adjacent to an outdoor tile acts as a light source
    // casting along its LoS path into the interior.
    if (ambient > 1) {
      this.castDoorLight(ambient, w, h);
    }

    // Map light sources boost nearby visible tiles (with LoS so light doesn't bleed through walls)
    const sources = this.grid.getLightSources();
    for (const src of sources) {
      const radius = src.range;
      // For wall-mounted sources, find the open side to cast from
      const srcCell = this.grid.getCell(src.position.x, src.position.y);
      const srcOnWall = srcCell?.blocksLoS ?? false;

      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx === 0 && dy === 0) {
            // Light the source tile itself
            this.fog.setLightLevel(src.position.x, src.position.y, 10);
            continue;
          }
          const tx = src.position.x + dx;
          const ty = src.position.y + dy;
          if (!this.fog.isVisible(tx, ty)) continue;
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          if (dist > radius) continue;
          // LoS check — light doesn't pass through walls
          // For wall sources, skip the LoS origin-cell block check by testing
          // from each adjacent open tile instead
          let hasLos = false;
          if (srcOnWall) {
            // Check LoS from each non-blocking cardinal neighbor of the source
            const cardinals = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];
            for (const c of cardinals) {
              const ax = src.position.x + c.x;
              const ay = src.position.y + c.y;
              const adj = this.grid.getCell(ax, ay);
              if (adj && !adj.blocksLoS) {
                if (LineOfSight.hasLineOfSight(this.grid, { x: ax, y: ay }, { x: tx, y: ty })) {
                  hasLos = true;
                  break;
                }
              }
            }
          } else {
            hasLos = LineOfSight.hasLineOfSight(this.grid, src.position, { x: tx, y: ty });
          }
          if (!hasLos) continue;
          // Light falls off linearly from 10 at source to 1 at edge
          const falloff = 1 - dist / (radius + 1);
          const boost = Math.round(10 * falloff);
          this.fog.setLightLevel(tx, ty, boost);
        }
      }
    }

    // Player torch boosts tiles around the player
    const torchRange = this.getPersonalLightRange();
    if (torchRange > 0) {
      for (let dy = -torchRange; dy <= torchRange; dy++) {
        for (let dx = -torchRange; dx <= torchRange; dx++) {
          const tx = playerPos.x + dx;
          const ty = playerPos.y + dy;
          if (!this.fog.isVisible(tx, ty)) continue;
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          if (dist > torchRange) continue;
          const falloff = 1 - dist / (torchRange + 1);
          const boost = Math.round(10 * falloff);
          this.fog.setLightLevel(tx, ty, boost);
        }
      }
    }
  }

  /**
   * Cast outdoor ambient light through open doors into interior tiles.
   * For each open door that borders an outdoor tile, light fans inward
   * along line-of-sight with linear falloff over ~4 cells.
   */
  private castDoorLight(ambient: number, w: number, h: number): void {
    if (!this.fog || !this.grid) return;

    const interior = this.computeInteriorTiles();
    const DOOR_LIGHT_RANGE = 4;
    const dirs = [
      { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
      { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
    ];

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const cell = this.grid.getCell(x, y);
        if (!cell) continue;
        // Must be an open door (has door feature, doesn't block LoS)
        if (!cell.features.includes('door') || cell.blocksLoS) continue;

        // Check if any cardinal neighbor is an outdoor tile
        for (const { dx, dy } of dirs) {
          const ox = x + dx;
          const oy = y + dy;
          if (ox < 0 || ox >= w || oy < 0 || oy >= h) continue;
          if (interior.has(`${ox},${oy}`)) continue;

          // This neighbor is outdoor — light leaks in the opposite direction (into interior)
          // The door tile itself gets full ambient
          this.fog.setLightLevel(x, y, ambient);

          // Cast a cone of light inward from the door
          const inDx = -dx;
          const inDy = -dy;
          for (let depth = 1; depth <= DOOR_LIGHT_RANGE; depth++) {
            // Fan out perpendicular to the light direction
            const spread = Math.ceil(depth * 0.6);
            for (let s = -spread; s <= spread; s++) {
              const tx = x + inDx * depth + (inDy === 0 ? 0 : s);
              const ty = y + inDy * depth + (inDx === 0 ? 0 : s);
              if (tx < 0 || tx >= w || ty < 0 || ty >= h) continue;
              if (!this.fog.isVisible(tx, ty)) continue;
              if (!interior.has(`${tx},${ty}`)) continue;
              // Check LoS from door to this tile
              if (!LineOfSight.hasLineOfSight(this.grid, { x, y }, { x: tx, y: ty })) continue;
              const falloff = 1 - depth / (DOOR_LIGHT_RANGE + 1);
              const boost = Math.max(1, Math.round(ambient * falloff));
              this.fog.setLightLevel(tx, ty, boost);
            }
          }
        }
      }
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
      torch_wall: 'a wall torch',
      torch_wall_spent: 'a spent torch',
      brazier: 'a brazier',
      table: 'a wooden table',
      chair: 'a chair',
      bed: 'a bed',
      shelf: 'a shelf',
      counter: 'a counter',
      anvil: 'an anvil',
      barrel: 'a barrel',
      crate: 'a crate',
      bookshelf: 'a bookshelf',
      rug: 'a decorative rug',
      banner: 'a hanging banner',
      well: 'a stone well',
      market_stall: 'a market stall',
      sign: 'a signpost',
      candle: 'a candle',
      chandelier: 'a chandelier',
      weapon_rack: 'a weapon rack',
      hearth: 'a hearth',
    };
    return descriptions[feature] ?? 'something';
  }
}
