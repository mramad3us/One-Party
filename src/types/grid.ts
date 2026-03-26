import type { Coordinate, EntityId } from './core';

/** Terrain type for a single grid cell */
export type CellTerrain =
  | 'floor'
  | 'wall'
  | 'water'
  | 'lava'
  | 'pit'
  | 'grass'
  | 'stone'
  | 'ice'
  | 'mud'
  | 'sand'
  | 'wood';

/** Interactive features that can exist on a cell */
export type CellFeature =
  | 'door'
  | 'door_locked'
  | 'trap'
  | 'chest'
  | 'fire'
  | 'altar'
  | 'stairs_up'
  | 'stairs_down'
  | 'fountain'
  | 'pillar'
  | 'tree'
  | 'rock'
  | 'running_water'
  | 'torch_wall'
  | 'torch_wall_spent'
  | 'brazier'
  | 'table'
  | 'chair'
  | 'bed'
  | 'shelf'
  | 'counter'
  | 'anvil'
  | 'barrel'
  | 'crate'
  | 'bookshelf'
  | 'rug'
  | 'banner'
  | 'well'
  | 'market_stall'
  | 'sign'
  | 'candle'
  | 'chandelier'
  | 'weapon_rack'
  | 'hearth';

/**
 * Physical properties for features — determines passability and LoS blocking.
 * Features not listed here default to passable + transparent.
 */
export const FEATURE_PHYSICS: Partial<Record<CellFeature, { blocks: boolean; blocksLoS: boolean }>> = {
  // Solid furniture — impassable, blocks LoS
  tree:         { blocks: true, blocksLoS: true },
  rock:         { blocks: true, blocksLoS: true },
  pillar:       { blocks: true, blocksLoS: true },
  counter:      { blocks: true, blocksLoS: true },
  shelf:        { blocks: true, blocksLoS: true },
  bookshelf:    { blocks: true, blocksLoS: true },
  barrel:       { blocks: true, blocksLoS: true },
  crate:        { blocks: true, blocksLoS: true },
  bed:          { blocks: true, blocksLoS: false },
  well:         { blocks: true, blocksLoS: false },
  anvil:        { blocks: true, blocksLoS: false },
  weapon_rack:  { blocks: true, blocksLoS: true },
  market_stall: { blocks: true, blocksLoS: true },
  chest:        { blocks: true, blocksLoS: false },
  hearth:       { blocks: true, blocksLoS: false },
  fountain:     { blocks: true, blocksLoS: false },
  door_locked:  { blocks: true, blocksLoS: true },
  // Passable — can walk through
  // door, table, chair, rug, banner, candle, fire, altar, stairs_up, stairs_down,
  // torch_wall, torch_wall_spent, brazier, chandelier, sign, running_water, trap
};

/** Features that emit light and their radius in grid cells (1 cell = 5ft) */
export const LIGHT_SOURCE_RADIUS: Partial<Record<CellFeature, number>> = {
  torch_wall: 5,   // 25ft — wall sconce
  brazier: 6,      // 30ft — large fire pit
  fire: 5,         // 25ft — campfire
  fountain: 3,     // 15ft — faint magical glow
  candle: 2,       // 10ft — small flame
  chandelier: 5,   // 25ft — overhead light
  hearth: 4,       // 20ft — fireplace glow
};

/** A single cell in the tactical grid */
export type GridCell = {
  terrain: CellTerrain;
  /** 1 = normal, 2 = difficult terrain, Infinity = impassable */
  movementCost: number;
  /** Whether this cell blocks line of sight */
  blocksLoS: boolean;
  /** Elevation in feet relative to ground level */
  elevation: number;
  /** Interactive features on this cell */
  features: CellFeature[];
};

/** Full grid layout — row-major indexing: cells[y][x] */
export type GridDefinition = {
  width: number;
  height: number;
  cells: GridCell[][];
};

/** An entity placed on the grid */
export type GridEntityPlacement = {
  entityId: EntityId;
  position: Coordinate;
  /** Grid footprint: 1 = Medium (1x1), 2 = Large (2x2), 3 = Huge (3x3), 4 = Gargantuan (4x4) */
  size: number;
};

/** Result of an A* pathfinding query */
export type PathResult = {
  path: Coordinate[];
  /** Total movement cost in feet */
  totalCost: number;
  reachable: boolean;
};

/** Fog of war state — keys are "x,y" coordinate strings */
export type FogState = {
  /** Cells the player has seen at some point */
  explored: Set<string>;
  /** Cells currently visible */
  visible: Set<string>;
};
