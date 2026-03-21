import type { Coordinate, EntityId, GameTime } from './core';
import type { GridCell, GridDefinition, GridEntityPlacement } from './grid';

/** Biome classification for regions */
export type BiomeType =
  | 'forest'
  | 'mountain'
  | 'desert'
  | 'swamp'
  | 'plains'
  | 'coast'
  | 'tundra'
  | 'volcanic'
  | 'underdark'
  | 'urban';

/** Primary location classification */
export type LocationType =
  | 'village'
  | 'town'
  | 'city'
  | 'dungeon'
  | 'wilderness'
  | 'ruins'
  | 'castle'
  | 'cave'
  | 'temple'
  | 'camp';

/** Interior location classification */
export type SubLocationType =
  | 'tavern'
  | 'shop'
  | 'blacksmith'
  | 'temple'
  | 'dungeon_room'
  | 'clearing'
  | 'house'
  | 'hall'
  | 'tower'
  | 'cellar'
  | 'market'
  | 'barracks';

/** Ambient lighting */
export type LightingLevel = 'bright' | 'dim' | 'dark';

/** A notable event in world history */
export type HistoryEntry = {
  timestamp: GameTime;
  event: string;
  category: string;
  details: Record<string, unknown>;
};

/** The entire game world */
export type World = {
  id: EntityId;
  name: string;
  seed: number;
  regions: Map<EntityId, Region>;
  time: GameTime;
  history: HistoryEntry[];
};

/** A large area of the world map */
export type Region = {
  id: EntityId;
  name: string;
  biome: BiomeType;
  description: string;
  coordinates: Coordinate;
  /** Difficulty scaling factor (higher = harder encounters) */
  difficulty: number;
  locations: Map<EntityId, Location>;
  /** IDs of adjacent regions */
  connections: EntityId[];
  discovered: boolean;
};

/** A specific place within a region */
export type Location = {
  id: EntityId;
  regionId: EntityId;
  name: string;
  locationType: LocationType;
  coordinates: Coordinate;
  description: string;
  subLocations: Map<EntityId, SubLocation>;
  npcs: EntityId[];
  items: EntityId[];
  discovered: boolean;
  lastVisited: GameTime | null;
  /** IDs of connected locations for travel */
  connections: EntityId[];
  tags: string[];
  /** Persisted local map state — uses delta storage for efficiency.
   *  The base grid is regenerated from the world seed + tile coordinates;
   *  only cells that differ from the base are stored in `modifications`. */
  localMap?: {
    playerStart: Coordinate;
    exploredCells: string[];
    /** Sparse list of [x, y, cell] tuples for cells modified since generation. */
    modifications: [number, number, GridCell][];
    /** @deprecated Full grid from old saves — used only for backward compat. */
    grid?: GridDefinition;
  };
};

/** A room or area within a location */
export type SubLocation = {
  id: EntityId;
  locationId: EntityId;
  name: string;
  subType: SubLocationType;
  coordinates: Coordinate;
  spaces: Map<EntityId, Space>;
  npcs: EntityId[];
  items: EntityId[];
  discovered: boolean;
  interiorType: 'interior' | 'exterior';
};

/** A tactical space with a grid for combat or exploration */
export type Space = {
  id: EntityId;
  subLocationId: EntityId;
  name: string;
  grid: GridDefinition;
  terrain: string;
  interiorType: 'interior' | 'exterior';
  lighting: LightingLevel;
  entities: GridEntityPlacement[];
  /** Cells the player has explored (persisted fog of war) — "x,y" keys */
  exploredCells?: string[];
  /** Default player start position for this space */
  playerStart?: Coordinate;
};
