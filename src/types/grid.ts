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
  | 'running_water';

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
