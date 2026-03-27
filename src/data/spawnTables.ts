/**
 * Location-based spawn tables.
 *
 * Each table has tags that match against Location.tags + locationType + biome.
 * The lookup merges all matching tables and does a weighted pick.
 *
 * Design: the world spawns threats first. Quests are assigned later.
 * A lich exists in a crypt whether or not anyone told you about it.
 */

import type { BiomeType, LocationType } from '@/types/world';

// ── Types ──

export type SpawnEntry = {
  monsterId: string;
  /** Relative weight within this table (higher = more likely). */
  weight: number;
  /** Min group size when this monster is picked. Default 1. */
  minCount?: number;
  /** Max group size when this monster is picked. Default 1. */
  maxCount?: number;
};

export type SpawnTable = {
  /** Tags to match against (locationType, biome, or custom location tags). */
  tags: string[];
  /** Monster entries with weighted probabilities. */
  entries: SpawnEntry[];
  /**
   * Spawn density 0.0–1.0. Controls how many monsters appear.
   * 0.0 = never, 0.02 = rare (villages), 0.5 = dense (dungeons).
   * For travel encounters: density maps to encounter DC.
   */
  density: number;
};

// ── Spawn Tables ──

const SPAWN_TABLES: SpawnTable[] = [
  // ── Settlements (very low density) ──
  {
    tags: ['village'],
    density: 0.02,
    entries: [
      { monsterId: 'monster_rat', weight: 8 },
      { monsterId: 'monster_giant_rat', weight: 3 },
      { monsterId: 'monster_spider', weight: 2 },
    ],
  },
  {
    tags: ['town'],
    density: 0.03,
    entries: [
      { monsterId: 'monster_rat', weight: 6 },
      { monsterId: 'monster_giant_rat', weight: 4 },
      { monsterId: 'monster_thug', weight: 2 },
      { monsterId: 'monster_bandit', weight: 1 },
    ],
  },
  {
    tags: ['city'],
    density: 0.03,
    entries: [
      { monsterId: 'monster_rat', weight: 5 },
      { monsterId: 'monster_thug', weight: 3 },
      { monsterId: 'monster_spy', weight: 2 },
      { monsterId: 'monster_bandit', weight: 2 },
    ],
  },

  // ── Wilderness by biome ──
  {
    tags: ['wilderness', 'forest'],
    density: 0.15,
    entries: [
      { monsterId: 'monster_wolf', weight: 10, minCount: 2, maxCount: 4 },
      { monsterId: 'monster_goblin', weight: 8, minCount: 2, maxCount: 5 },
      { monsterId: 'monster_giant_spider', weight: 5 },
      { monsterId: 'monster_boar', weight: 4 },
      { monsterId: 'monster_brown_bear', weight: 3 },
      { monsterId: 'monster_owlbear', weight: 2 },
      { monsterId: 'monster_bugbear', weight: 2 },
      { monsterId: 'monster_dryad', weight: 1 },
    ],
  },
  {
    tags: ['wilderness', 'plains'],
    density: 0.10,
    entries: [
      { monsterId: 'monster_wolf', weight: 8, minCount: 2, maxCount: 4 },
      { monsterId: 'monster_bandit', weight: 6, minCount: 2, maxCount: 4 },
      { monsterId: 'monster_gnoll', weight: 5, minCount: 2, maxCount: 3 },
      { monsterId: 'monster_hyena', weight: 5, minCount: 2, maxCount: 4 },
      { monsterId: 'monster_giant_eagle', weight: 2 },
      { monsterId: 'monster_hippogriff', weight: 1 },
      { monsterId: 'monster_griffon', weight: 1 },
    ],
  },
  {
    tags: ['wilderness', 'mountain'],
    density: 0.12,
    entries: [
      { monsterId: 'monster_kobold', weight: 8, minCount: 3, maxCount: 5 },
      { monsterId: 'monster_giant_goat', weight: 5 },
      { monsterId: 'monster_ogre', weight: 4 },
      { monsterId: 'monster_harpy', weight: 3, minCount: 1, maxCount: 3 },
      { monsterId: 'monster_griffon', weight: 2 },
      { monsterId: 'monster_troll', weight: 1 },
    ],
  },
  {
    tags: ['wilderness', 'desert'],
    density: 0.08,
    entries: [
      { monsterId: 'monster_scorpion', weight: 8 },
      { monsterId: 'monster_giant_poisonous_snake', weight: 6 },
      { monsterId: 'monster_gnoll', weight: 5, minCount: 2, maxCount: 4 },
      { monsterId: 'monster_vulture', weight: 4, minCount: 2, maxCount: 3 },
      { monsterId: 'monster_dust_mephit', weight: 2 },
    ],
  },
  {
    tags: ['wilderness', 'swamp'],
    density: 0.18,
    entries: [
      { monsterId: 'monster_lizardfolk', weight: 7, minCount: 2, maxCount: 4 },
      { monsterId: 'monster_giant_frog', weight: 6, minCount: 1, maxCount: 3 },
      { monsterId: 'monster_crocodile', weight: 5 },
      { monsterId: 'monster_ghoul', weight: 4 },
      { monsterId: 'monster_swarm_of_insects', weight: 4 },
      { monsterId: 'monster_shadow', weight: 2 },
      { monsterId: 'monster_will_o_wisp', weight: 1 },
    ],
  },
  {
    tags: ['wilderness', 'coast'],
    density: 0.08,
    entries: [
      { monsterId: 'monster_giant_crab', weight: 7, minCount: 1, maxCount: 3 },
      { monsterId: 'monster_sahuagin', weight: 5, minCount: 2, maxCount: 4 },
      { monsterId: 'monster_bandit', weight: 4, minCount: 2, maxCount: 3 },
      { monsterId: 'monster_harpy', weight: 2 },
      { monsterId: 'monster_merrow', weight: 1 },
    ],
  },
  {
    tags: ['wilderness', 'tundra'],
    density: 0.10,
    entries: [
      { monsterId: 'monster_wolf', weight: 10, minCount: 3, maxCount: 5 },
      { monsterId: 'monster_dire_wolf', weight: 4, minCount: 1, maxCount: 2 },
      { monsterId: 'monster_polar_bear', weight: 3 },
      { monsterId: 'monster_ice_mephit', weight: 2 },
      { monsterId: 'monster_ogre', weight: 2 },
      { monsterId: 'monster_troll', weight: 1 },
    ],
  },
  {
    tags: ['wilderness', 'volcanic'],
    density: 0.15,
    entries: [
      { monsterId: 'monster_magmin', weight: 6, minCount: 2, maxCount: 4 },
      { monsterId: 'monster_fire_snake', weight: 5, minCount: 1, maxCount: 3 },
      { monsterId: 'monster_magma_mephit', weight: 4 },
      { monsterId: 'monster_steam_mephit', weight: 3 },
      { monsterId: 'monster_smoke_mephit', weight: 3 },
    ],
  },

  // ── Dungeons (high density) ──
  {
    tags: ['dungeon'],
    density: 0.40,
    entries: [
      { monsterId: 'monster_skeleton', weight: 10, minCount: 2, maxCount: 4 },
      { monsterId: 'monster_zombie', weight: 8, minCount: 1, maxCount: 3 },
      { monsterId: 'monster_giant_rat', weight: 7, minCount: 2, maxCount: 5 },
      { monsterId: 'monster_kobold', weight: 6, minCount: 3, maxCount: 5 },
      { monsterId: 'monster_giant_spider', weight: 5 },
      { monsterId: 'monster_gelatinous_cube', weight: 2 },
      { monsterId: 'monster_mimic', weight: 1 },
    ],
  },
  // Undead-themed dungeon overlay (stacks with base dungeon)
  {
    tags: ['undead'],
    density: 0.50,
    entries: [
      { monsterId: 'monster_skeleton', weight: 10, minCount: 2, maxCount: 5 },
      { monsterId: 'monster_zombie', weight: 8, minCount: 2, maxCount: 4 },
      { monsterId: 'monster_ghoul', weight: 6, minCount: 1, maxCount: 3 },
      { monsterId: 'monster_ghast', weight: 4, minCount: 1, maxCount: 2 },
      { monsterId: 'monster_specter', weight: 3 },
      { monsterId: 'monster_shadow', weight: 3 },
      { monsterId: 'monster_minotaur_skeleton', weight: 2 },
    ],
  },

  // ── Caves ──
  {
    tags: ['cave'],
    density: 0.30,
    entries: [
      { monsterId: 'monster_giant_spider', weight: 8, minCount: 1, maxCount: 3 },
      { monsterId: 'monster_giant_bat', weight: 7, minCount: 2, maxCount: 4 },
      { monsterId: 'monster_giant_rat', weight: 6, minCount: 2, maxCount: 5 },
      { monsterId: 'monster_darkmantle', weight: 4 },
      { monsterId: 'monster_stirge', weight: 5, minCount: 2, maxCount: 4 },
      { monsterId: 'monster_gray_ooze', weight: 2 },
      { monsterId: 'monster_carrion_crawler', weight: 2 },
      { monsterId: 'monster_rust_monster', weight: 1 },
    ],
  },

  // ── Ruins ──
  {
    tags: ['ruins'],
    density: 0.25,
    entries: [
      { monsterId: 'monster_bandit', weight: 7, minCount: 2, maxCount: 4 },
      { monsterId: 'monster_skeleton', weight: 6, minCount: 2, maxCount: 3 },
      { monsterId: 'monster_kobold', weight: 5, minCount: 3, maxCount: 5 },
      { monsterId: 'monster_giant_spider', weight: 4 },
      { monsterId: 'monster_gargoyle', weight: 3 },
      { monsterId: 'monster_animated_armor', weight: 2 },
      { monsterId: 'monster_ettercap', weight: 2 },
    ],
  },

  // ── Temple ──
  {
    tags: ['temple'],
    density: 0.30,
    entries: [
      { monsterId: 'monster_acolyte', weight: 6, minCount: 2, maxCount: 3 },
      { monsterId: 'monster_cult_fanatic', weight: 4 },
      { monsterId: 'monster_animated_armor', weight: 3 },
      { monsterId: 'monster_specter', weight: 3 },
      { monsterId: 'monster_gargoyle', weight: 3 },
      { monsterId: 'monster_ghoul', weight: 2, minCount: 1, maxCount: 3 },
    ],
  },

  // ── Castle ──
  {
    tags: ['castle'],
    density: 0.20,
    entries: [
      { monsterId: 'monster_guard', weight: 8, minCount: 2, maxCount: 4 },
      { monsterId: 'monster_animated_armor', weight: 5 },
      { monsterId: 'monster_gargoyle', weight: 3 },
      { monsterId: 'monster_rug_of_smothering', weight: 2 },
      { monsterId: 'monster_mimic', weight: 1 },
    ],
  },

  // ── Camp ──
  {
    tags: ['camp'],
    density: 0.20,
    entries: [
      { monsterId: 'monster_bandit', weight: 10, minCount: 2, maxCount: 5 },
      { monsterId: 'monster_bandit_captain', weight: 3 },
      { monsterId: 'monster_thug', weight: 5, minCount: 1, maxCount: 3 },
      { monsterId: 'monster_mastiff', weight: 4, minCount: 1, maxCount: 2 },
      { monsterId: 'monster_scout', weight: 3 },
    ],
  },

  // ── Underdark ──
  {
    tags: ['underdark'],
    density: 0.45,
    entries: [
      { monsterId: 'monster_giant_spider', weight: 8, minCount: 1, maxCount: 3 },
      { monsterId: 'monster_darkmantle', weight: 6, minCount: 1, maxCount: 2 },
      { monsterId: 'monster_quaggoth', weight: 5 },
      { monsterId: 'monster_gray_ooze', weight: 4 },
      { monsterId: 'monster_ochre_jelly', weight: 3 },
      { monsterId: 'monster_gelatinous_cube', weight: 2 },
      { monsterId: 'monster_gibbering_mouther', weight: 2 },
      { monsterId: 'monster_carrion_crawler', weight: 3 },
    ],
  },

  // ── Tag overlays (stack with location type tables) ──
  {
    tags: ['goblin_lair'],
    density: 0.50,
    entries: [
      { monsterId: 'monster_goblin', weight: 12, minCount: 3, maxCount: 6 },
      { monsterId: 'monster_hobgoblin', weight: 5, minCount: 1, maxCount: 3 },
      { monsterId: 'monster_bugbear', weight: 3 },
      { monsterId: 'monster_worg', weight: 2 },
    ],
  },
  {
    tags: ['spider_nest'],
    density: 0.45,
    entries: [
      { monsterId: 'monster_giant_spider', weight: 10, minCount: 2, maxCount: 4 },
      { monsterId: 'monster_giant_wolf_spider', weight: 7, minCount: 1, maxCount: 3 },
      { monsterId: 'monster_ettercap', weight: 4 },
      { monsterId: 'monster_spider', weight: 8, minCount: 3, maxCount: 6 },
    ],
  },
  {
    tags: ['dragon_lair'],
    density: 0.35,
    entries: [
      { monsterId: 'monster_kobold', weight: 10, minCount: 3, maxCount: 6 },
      { monsterId: 'monster_guard_drake', weight: 4, minCount: 1, maxCount: 2 },
    ],
  },
];

// ── Lookup ──

/**
 * Get the merged spawn pool for a location.
 * Matches against locationType, biome, and any custom tags on the location.
 * Multiple matching tables are merged: entries are concatenated, density is max.
 */
export function getSpawnPool(
  locationType: LocationType,
  tags: string[],
  biome?: BiomeType,
): { entries: SpawnEntry[]; density: number } | null {
  // Collect all tags to match against
  const matchTags = new Set([locationType, ...tags]);
  if (biome) matchTags.add(biome);

  // Find all tables where ANY tag overlaps
  const matched = SPAWN_TABLES.filter(table =>
    table.tags.some(t => matchTags.has(t)),
  );

  // Prefer tables that match MORE tags (specificity)
  // e.g. ['wilderness', 'forest'] beats ['wilderness'] for a forest wilderness tile
  const scored = matched.map(table => ({
    table,
    score: table.tags.filter(t => matchTags.has(t)).length,
  }));

  if (scored.length === 0) return null;

  // Merge: combine entries from all matched tables, take max density
  const entries: SpawnEntry[] = [];
  let density = 0;
  for (const { table, score } of scored) {
    // Weight entries by specificity score so more-specific tables contribute more
    for (const entry of table.entries) {
      entries.push({ ...entry, weight: entry.weight * score });
    }
    density = Math.max(density, table.density);
  }

  return { entries, density };
}

/**
 * Pick a random monster from a spawn pool using weighted selection.
 * Returns the entry (monsterId + count range) or null if pool is empty.
 */
export function pickFromPool(
  entries: SpawnEntry[],
  random: () => number,
): SpawnEntry | null {
  if (entries.length === 0) return null;

  const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0);
  let roll = random() * totalWeight;

  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) return entry;
  }

  return entries[entries.length - 1];
}

/**
 * Convert spawn density to a d20 encounter DC.
 * Higher density → lower DC → more encounters.
 * density 0.0 → DC 21 (impossible)
 * density 0.5 → DC 10 (55% chance)
 * density 1.0 → DC 1 (guaranteed)
 */
export function densityToEncounterDC(density: number): number {
  return Math.max(1, Math.round(20 * (1 - density)));
}
