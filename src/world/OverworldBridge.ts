import type {
  EntityId,
  Location,
  LocationType,
  NPC,
  Region,
  World,
} from '@/types';
import type { BiomeType } from '@/types/world';
import type { OverworldData, OverworldRegion, OverworldTerrain, SettlementType } from '@/types/overworld';
import { SeededRNG } from '@/utils/SeededRNG';
import { generateId } from '@/engine/IdGenerator';
import { WorldGenerator } from './WorldGenerator';

// ── Settlement → LocationType mapping ───────────────────────────────

const SETTLEMENT_TO_LOCATION: Record<SettlementType, LocationType> = {
  village: 'village',
  town: 'town',
  city: 'city',
  fortress: 'castle',
  ruins: 'ruins',
  temple: 'temple',
};

// ── Biome descriptions (for regions) ────────────────────────────────

const BIOME_DESCRIPTIONS: Record<BiomeType, string> = {
  forest: 'Ancient trees stretch toward the sky, their canopy filtering light into emerald dapples across the forest floor.',
  mountain: 'Jagged peaks pierce the clouds, their slopes carved by wind and time into treacherous passes.',
  desert: 'Endless dunes shift under a merciless sun, hiding forgotten secrets beneath the sands.',
  swamp: 'Murky waters and twisted roots make every step treacherous in this waterlogged expanse.',
  plains: 'Rolling grasslands stretch to the horizon, stirred by winds that carry the scent of wildflowers.',
  coast: 'Salt-sprayed cliffs overlook the churning sea, where gulls wheel above crashing waves.',
  tundra: 'A frozen wasteland of permafrost and howling wind, where survival is its own reward.',
  volcanic: 'Blackened earth and sulfurous vents mark this land scarred by the fury of the deep.',
  underdark: 'Vast caverns stretch into darkness, lit only by strange fungi and glowing crystals.',
  urban: 'A sprawling settlement of stone and timber, alive with the noise of commerce and daily life.',
};

/**
 * Convert an OverworldData into the existing World/Region/Location hierarchy
 * that GameState expects. Each overworld region becomes a game Region,
 * and each settlement becomes a Location with sub-locations.
 *
 * Returns { world, startLocationId, npcs } — the starting location and all generated NPCs.
 */
export function overworldToWorld(
  overworld: OverworldData,
  rng: SeededRNG,
): { world: World; startLocationId: EntityId; npcs: NPC[] } {
  const worldGen = new WorldGenerator(rng);

  const world: World = {
    id: generateId(),
    name: overworld.name,
    seed: overworld.seed,
    regions: new Map(),
    time: { totalRounds: 0 },
    history: overworld.history.map(h => ({
      timestamp: { totalRounds: h.year * 52560 }, // ~1 year in 6-sec rounds
      event: h.event,
      category: 'world',
      details: { year: h.year },
    })),
  };

  let startLocationId: EntityId | null = null;
  let bestHabitability = -Infinity;

  // Process each overworld region
  for (const owRegion of overworld.regions) {
    const regionId = owRegion.id;

    const region: Region = {
      id: regionId,
      name: owRegion.name,
      biome: owRegion.biome,
      description: BIOME_DESCRIPTIONS[owRegion.biome] ?? BIOME_DESCRIPTIONS.plains,
      coordinates: { x: owRegion.centerX, y: owRegion.centerY },
      difficulty: 1 + Math.floor(rng.nextFloat(0, 2)),
      locations: new Map(),
      connections: [],
      discovered: false,
    };

    // Collect settlements in this region
    const settlements: {
      x: number;
      y: number;
      type: SettlementType;
      name: string;
      habitability: number;
    }[] = [];

    for (let y = 0; y < overworld.height; y++) {
      for (let x = 0; x < overworld.width; x++) {
        const tile = overworld.tiles[y][x];
        if (tile.regionId !== regionId || !tile.settlement || !tile.settlementName) continue;

        const habitability = tile.moisture * 0.3 +
          (255 - Math.abs(tile.temperature - 140)) * 0.3 -
          tile.elevation * 0.1 +
          (tile.river ? 50 : 0);

        settlements.push({
          x, y,
          type: tile.settlement,
          name: tile.settlementName,
          habitability,
        });
      }
    }

    // Create Location for each settlement
    const locations: Location[] = [];
    for (const s of settlements) {
      const locationType = SETTLEMENT_TO_LOCATION[s.type];
      const difficulty = region.difficulty + (locationType === 'ruins' ? 2 : 0);

      // Use WorldGenerator's sub-location creation
      const location = worldGen.generateLocation(regionId, locationType, difficulty);
      // Override the generated name with the overworld name
      location.name = s.name;
      location.coordinates = { x: s.x, y: s.y };

      // Mark villages as discovered
      if (s.type === 'village') {
        location.discovered = true;
        location.tags.push('starting_location');
      }

      locations.push(location);
      region.locations.set(location.id, location);

      // Track best starting location
      if (s.type === 'village' && s.habitability > bestHabitability) {
        bestHabitability = s.habitability;
        startLocationId = location.id;
        region.discovered = true;
      }
    }

    // Connect nearby locations within the region
    connectLocationsByDistance(locations);

    // Add region-level connections (adjacent regions)
    const adjacentRegions = findAdjacentRegions(owRegion, overworld);
    region.connections = adjacentRegions;

    world.regions.set(regionId, region);
  }

  // Fallback: if no village found, pick first location of first region
  if (!startLocationId) {
    for (const [, region] of world.regions) {
      for (const [locId, loc] of region.locations) {
        loc.discovered = true;
        region.discovered = true;
        startLocationId = locId;
        break;
      }
      if (startLocationId) break;
    }
  }

  if (!startLocationId) {
    throw new Error('World has no locations — generation failed');
  }

  return { world, startLocationId, npcs: worldGen.getGeneratedNPCs() };
}

/** Connect locations within a region based on geographic proximity. */
function connectLocationsByDistance(locations: Location[]): void {
  if (locations.length < 2) return;

  // Connect each location to its 2-3 nearest neighbors
  for (const loc of locations) {
    const sorted = locations
      .filter(other => other !== loc)
      .map(other => ({
        other,
        dist: Math.hypot(other.coordinates.x - loc.coordinates.x, other.coordinates.y - loc.coordinates.y),
      }))
      .sort((a, b) => a.dist - b.dist);

    const connectCount = Math.min(3, sorted.length);
    for (let i = 0; i < connectCount; i++) {
      const other = sorted[i].other;
      if (!loc.connections.includes(other.id)) {
        loc.connections.push(other.id);
      }
      if (!other.connections.includes(loc.id)) {
        other.connections.push(loc.id);
      }
    }
  }
}

/** Find region IDs that are adjacent to a given overworld region. */
function findAdjacentRegions(
  region: OverworldRegion,
  overworld: OverworldData,
): EntityId[] {
  const adjacent = new Set<string>();
  const radius = 5;

  // Check tiles near the region center for different region IDs
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const y = region.centerY + dy;
      const x = region.centerX + dx;
      if (y < 0 || y >= overworld.height || x < 0 || x >= overworld.width) continue;
      const otherId = overworld.tiles[y][x].regionId;
      if (otherId && otherId !== region.id) {
        adjacent.add(otherId);
      }
    }
  }

  return [...adjacent];
}

// ── Terrain → LocationType mapping for non-settlement tiles ──────────

const TERRAIN_TO_LOCATION_TYPE: Record<OverworldTerrain, LocationType> = {
  deep_water: 'wilderness',
  shallow_water: 'wilderness',
  beach: 'wilderness',
  plains: 'wilderness',
  forest: 'wilderness',
  dense_forest: 'wilderness',
  hills: 'wilderness',
  mountain: 'cave',
  peak: 'wilderness',
  snow: 'wilderness',
  desert: 'wilderness',
  swamp: 'wilderness',
  tundra: 'wilderness',
  volcanic: 'wilderness',
};

const TERRAIN_TO_BIOME: Record<OverworldTerrain, BiomeType> = {
  deep_water: 'coast',
  shallow_water: 'coast',
  beach: 'coast',
  plains: 'plains',
  forest: 'forest',
  dense_forest: 'forest',
  hills: 'mountain',
  mountain: 'mountain',
  peak: 'mountain',
  snow: 'tundra',
  desert: 'desert',
  swamp: 'swamp',
  tundra: 'tundra',
  volcanic: 'volcanic',
};

const TERRAIN_NAMES: Record<OverworldTerrain, string> = {
  deep_water: 'Open Sea',
  shallow_water: 'Coastal Waters',
  beach: 'Sandy Shore',
  plains: 'Open Plains',
  forest: 'Woodland',
  dense_forest: 'Dense Forest',
  hills: 'Rolling Hills',
  mountain: 'Mountain Pass',
  peak: 'Mountain Peak',
  snow: 'Snowfield',
  desert: 'Desert Sands',
  swamp: 'Marshlands',
  tundra: 'Frozen Tundra',
  volcanic: 'Scorched Earth',
};

/** Terrains that cannot be entered on foot. */
const IMPASSABLE_TERRAIN: Set<OverworldTerrain> = new Set([
  'deep_water',
  'shallow_water',
  'peak',
]);

/** Check if a tile terrain is traversable on foot. */
export function isTraversable(terrain: OverworldTerrain): boolean {
  return !IMPASSABLE_TERRAIN.has(terrain);
}

/** Get a human-readable name for a terrain type. */
export function getTerrainName(terrain: OverworldTerrain): string {
  return TERRAIN_NAMES[terrain] ?? terrain;
}

/** Get the biome for a given overworld terrain. */
export function getTerrainBiome(terrain: OverworldTerrain): BiomeType {
  return TERRAIN_TO_BIOME[terrain];
}

/** Get the location type for a given overworld terrain. */
export function getTerrainLocationType(terrain: OverworldTerrain): LocationType {
  return TERRAIN_TO_LOCATION_TYPE[terrain];
}

// Cache of tile-coordinate → locationId for on-demand created locations
const tileLocationCache = new Map<string, EntityId>();

/** Clear the tile location cache (e.g. on world delete). */
export function clearTileLocationCache(): void {
  tileLocationCache.clear();
}

/**
 * Get or create a Location for a specific overworld tile.
 * Settlement tiles return their existing Location.
 * Non-settlement tiles get a wilderness Location created on demand.
 */
export function getOrCreateTileLocation(
  overworld: OverworldData,
  x: number,
  y: number,
  world: World,
  rng: SeededRNG,
): { location: Location; region: Region; created: boolean; npcs: NPC[] } {
  const tile = overworld.tiles[y][x];
  const regionId = tile.regionId;
  const region = world.regions.get(regionId);

  if (!region) {
    throw new Error(`Region ${regionId} not found for tile (${x}, ${y})`);
  }

  // If settlement tile, find existing location by coordinates
  if (tile.settlement) {
    for (const [, loc] of region.locations) {
      if (loc.coordinates.x === x && loc.coordinates.y === y) {
        return { location: loc, region, created: false, npcs: [] };
      }
    }
  }

  // Check cache
  const cacheKey = `${x},${y}`;
  const cachedId = tileLocationCache.get(cacheKey);
  if (cachedId) {
    const existing = region.locations.get(cachedId);
    if (existing) {
      return { location: existing, region, created: false, npcs: [] };
    }
  }

  // Create new wilderness location for this tile
  const worldGen = new WorldGenerator(rng);
  const locationType = TERRAIN_TO_LOCATION_TYPE[tile.terrain];
  const location = worldGen.generateLocation(regionId, locationType, region.difficulty);

  // Override with terrain-appropriate name and data
  location.name = TERRAIN_NAMES[tile.terrain];
  location.coordinates = { x, y };
  location.discovered = true;
  location.description = BIOME_DESCRIPTIONS[TERRAIN_TO_BIOME[tile.terrain]] ?? BIOME_DESCRIPTIONS.plains;

  // Collect any NPCs created for this location
  const npcs = worldGen.getGeneratedNPCs();

  // Add to region
  region.locations.set(location.id, location);
  tileLocationCache.set(cacheKey, location.id);

  return { location, region, created: true, npcs };
}
