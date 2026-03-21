import type { BiomeType } from './world';

/** Macro-scale terrain for overworld tiles */
export type OverworldTerrain =
  | 'deep_water'
  | 'shallow_water'
  | 'beach'
  | 'plains'
  | 'forest'
  | 'dense_forest'
  | 'hills'
  | 'mountain'
  | 'peak'
  | 'snow'
  | 'desert'
  | 'swamp'
  | 'tundra'
  | 'volcanic';

/** Settlement types that can appear on the overworld */
export type SettlementType =
  | 'village'
  | 'town'
  | 'city'
  | 'fortress'
  | 'ruins'
  | 'temple';

/** World size presets */
export type WorldSize = 'small' | 'medium' | 'large';

export const WORLD_SIZES: Record<WorldSize, { width: number; height: number; label: string }> = {
  small:  { width: 64,  height: 64,  label: 'Small (64\u00d764)' },
  medium: { width: 128, height: 128, label: 'Medium (128\u00d7128)' },
  large:  { width: 256, height: 256, label: 'Large (256\u00d7256)' },
};

/** A single tile in the overworld grid */
export type OverworldTile = {
  elevation: number;
  temperature: number;
  moisture: number;
  biome: BiomeType;
  terrain: OverworldTerrain;
  river: boolean;
  settlement: SettlementType | null;
  settlementName: string | null;
  discovered: boolean;
  regionId: string;
};

/** A named region on the overworld (biome cluster) */
export type OverworldRegion = {
  id: string;
  name: string;
  biome: BiomeType;
  centerX: number;
  centerY: number;
  tileCount: number;
};

/** A historical event in the world's past */
export type OverworldHistoryEntry = {
  year: number;
  event: string;
};

/** Complete overworld data — the persistent world record */
export type OverworldData = {
  id: string;
  name: string;
  seed: number;
  width: number;
  height: number;
  tiles: OverworldTile[][];
  regions: OverworldRegion[];
  history: OverworldHistoryEntry[];
  createdAt: number;
};

/** Progress callback for world generation steps */
export type GenerationCallback = (message: string, progress: number) => void;
