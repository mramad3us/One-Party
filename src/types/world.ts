import type { Coordinate, EntityId, GameTime } from './core';
import type { GridDefinition, GridEntityPlacement } from './grid';

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
};
