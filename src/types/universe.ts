import type { OverworldData } from './overworld';
import type { GridCell } from './grid';
import type { Coordinate } from './core';

// ── Universe Hierarchy ──────────────────────────────────────────

/** Top-level container: the entire game multiverse. */
export type Universe = {
  id: string;
  name: string;
  description: string;
  planes: PlaneRef[];
  history: UniverseHistoryEntry[];
  meta: UniverseMeta;
};

export type UniverseMeta = {
  author: string;
  createdAt: number;
  lastModified: number;
  formatVersion: number;
};

// ── Planes ──────────────────────────────────────────────────────

export type PlaneType =
  | 'material'
  | 'underdark'
  | 'feywild'
  | 'shadowfell'
  | 'elemental'
  | 'astral'
  | 'ethereal'
  | 'outer';

export type PlaneRef = {
  id: string;
  name: string;
  planeType: PlaneType;
  inline?: Plane;
};

export type Plane = {
  id: string;
  name: string;
  planeType: PlaneType;
  description: string;
  continents: ContinentRef[];
  properties?: PlaneProperties;
};

export type PlaneProperties = {
  lighting?: 'bright' | 'dim' | 'dark';
  gravity?: number;
  magicModifier?: number;
  hazards?: string[];
};

// ── Continents ──────────────────────────────────────────────────

export type ContinentRef = {
  id: string;
  name: string;
  inline?: Continent;
};

export type Continent = {
  id: string;
  name: string;
  description: string;
  regions: WorldRegionRef[];
};

// ── Regions (world-level, not game-level) ───────────────────────

export type WorldRegionRef = {
  id: string;
  name: string;
  inline?: WorldRegion;
};

export type WorldRegion = {
  id: string;
  name: string;
  description: string;
  climate: string;
  countries: CountryRef[];
};

// ── Countries ───────────────────────────────────────────────────

export type CountryRef = {
  id: string;
  name: string;
  inline?: Country;
};

/**
 * A country is the gameplay leaf — it wraps an OverworldData tile grid
 * that the game engine can directly consume. LocationOverrides let
 * handcrafted content enrich or replace procedural generation.
 */
export type Country = {
  id: string;
  name: string;
  description: string;
  government: string;
  overworld: OverworldData;
  locationOverrides: LocationOverride[];
};

// ── Location Overrides ──────────────────────────────────────────

/** Handcrafted detail that overrides procedural generation for a tile. */
export type LocationOverride = {
  tileX: number;
  tileY: number;
  /** If provided, replaces the procedural POI map */
  handcraftedMap?: HandcraftedMap;
  /** Named NPCs to place at this location */
  npcs?: HandcraftedNPC[];
  /** Override description for the tile */
  description?: string;
  /** Points of interest within the tile */
  pointsOfInterest?: HandcraftedPOI[];
};

export type HandcraftedMap = {
  width: number;
  height: number;
  /** Sparse cell overrides — only non-default cells stored as [x, y, cell] */
  cells: [number, number, GridCell][];
  playerStart: Coordinate;
};

export type HandcraftedNPC = {
  id?: string;
  name: string;
  role: string;
  race?: string;
  description?: string;
  dialogue?: Record<string, string>;
  inventory?: string[];
  position?: Coordinate;
};

export type HandcraftedPOI = {
  name: string;
  type: string;
  tileX: number;
  tileY: number;
  description: string;
};

// ── History ─────────────────────────────────────────────────────

export type UniverseHistoryEntry = {
  era: string;
  year: number;
  event: string;
  scope: 'universe' | 'plane' | 'continent' | 'region' | 'country';
  scopeId?: string;
};

// ── Helpers ─────────────────────────────────────────────────────

/** Extract the active OverworldData from a Universe by country ID. */
export function getCountryOverworld(universe: Universe, countryId: string): OverworldData | null {
  for (const planeRef of universe.planes) {
    const plane = planeRef.inline;
    if (!plane) continue;
    for (const contRef of plane.continents) {
      const cont = contRef.inline;
      if (!cont) continue;
      for (const regRef of cont.regions) {
        const reg = regRef.inline;
        if (!reg) continue;
        for (const countryRef of reg.countries) {
          const country = countryRef.inline;
          if (country && country.id === countryId) {
            return country.overworld;
          }
        }
      }
    }
  }
  return null;
}

/** Get the first country in the universe (for starting a new game). */
export function getFirstCountry(universe: Universe): Country | null {
  for (const planeRef of universe.planes) {
    const plane = planeRef.inline;
    if (!plane) continue;
    for (const contRef of plane.continents) {
      const cont = contRef.inline;
      if (!cont) continue;
      for (const regRef of cont.regions) {
        const reg = regRef.inline;
        if (!reg) continue;
        for (const countryRef of reg.countries) {
          if (countryRef.inline) return countryRef.inline;
        }
      }
    }
  }
  return null;
}

/** Get all LocationOverrides for a specific tile in a country. */
export function getLocationOverride(
  universe: Universe,
  countryId: string,
  tileX: number,
  tileY: number,
): LocationOverride | undefined {
  for (const planeRef of universe.planes) {
    const plane = planeRef.inline;
    if (!plane) continue;
    for (const contRef of plane.continents) {
      const cont = contRef.inline;
      if (!cont) continue;
      for (const regRef of cont.regions) {
        const reg = regRef.inline;
        if (!reg) continue;
        for (const countryRef of reg.countries) {
          const country = countryRef.inline;
          if (country && country.id === countryId) {
            return country.locationOverrides.find(
              lo => lo.tileX === tileX && lo.tileY === tileY,
            );
          }
        }
      }
    }
  }
  return undefined;
}

/**
 * Wrap a legacy OverworldData into the new Universe hierarchy.
 * This allows old procedural worlds to work with the v2 system.
 */
export function wrapLegacyOverworld(overworld: OverworldData): Universe {
  const countryId = `country_${overworld.id}`;
  const regionId = `region_${overworld.id}`;
  const continentId = `continent_${overworld.id}`;
  const planeId = `plane_${overworld.id}`;

  return {
    id: `universe_${overworld.id}`,
    name: overworld.name,
    description: 'Procedurally generated world',
    planes: [{
      id: planeId,
      name: 'Material Plane',
      planeType: 'material',
      inline: {
        id: planeId,
        name: 'Material Plane',
        planeType: 'material',
        description: 'The prime material plane where mortal beings dwell.',
        continents: [{
          id: continentId,
          name: overworld.name,
          inline: {
            id: continentId,
            name: overworld.name,
            description: 'The known world.',
            regions: [{
              id: regionId,
              name: overworld.name,
              inline: {
                id: regionId,
                name: overworld.name,
                description: 'The known lands.',
                climate: 'temperate',
                countries: [{
                  id: countryId,
                  name: overworld.name,
                  inline: {
                    id: countryId,
                    name: overworld.name,
                    description: '',
                    government: 'unknown',
                    overworld,
                    locationOverrides: [],
                  },
                }],
              },
            }],
          },
        }],
      },
    }],
    history: [],
    meta: {
      author: 'procedural',
      createdAt: overworld.createdAt,
      lastModified: Date.now(),
      formatVersion: 2,
    },
  };
}
