import type { Location } from '@/types/world';
import type { World } from '@/types';
import type { GameTime } from '@/types/core';
import { ROUNDS_PER_DAY } from '@/types/time';

/**
 * Decay thresholds in game days.
 *
 * - populated: townsfolk clean up quickly
 * - wilderness: nature slowly reclaims
 * - dungeon: creatures move back in over weeks
 * - fortified: stone structures resist decay longest
 */
const DECAY_DAYS: Record<string, number> = {
  village: 1,
  town: 1,
  city: 1,
  wilderness: 7,
  camp: 5,
  cave: 14,
  dungeon: 14,
  ruins: 21,
  castle: 21,
  temple: 28,
};

/** After this many days unvisited, clear ALL modifications (full reset). */
const FULL_RESET_DAYS: Record<string, number> = {
  village: 3,
  town: 3,
  city: 3,
  wilderness: 14,
  camp: 10,
  cave: 30,
  dungeon: 30,
  ruins: 45,
  castle: 45,
  temple: 60,
};

export interface DecayResult {
  /** Locations that had their modifications trimmed. */
  trimmed: string[];
  /** Locations that were fully reset (all mods cleared). */
  reset: string[];
  /** Total bytes estimated to have been freed. */
  estimatedBytesSaved: number;
}

/**
 * Process world decay — nature reclaiming unvisited areas.
 *
 * Called during travel to keep save sizes bounded.
 * Preserves fog of war (exploredCells) and playerStart;
 * only clears grid modifications and the deprecated full-grid field.
 *
 * Returns a summary of what was cleaned up.
 */
export function processWorldDecay(world: World, currentTime: GameTime): DecayResult {
  const result: DecayResult = { trimmed: [], reset: [], estimatedBytesSaved: 0 };

  for (const [, region] of world.regions) {
    for (const [, location] of region.locations) {
      processLocationDecay(location, currentTime, result);
    }
  }

  return result;
}

function processLocationDecay(
  location: Location,
  currentTime: GameTime,
  result: DecayResult,
): void {
  if (!location.localMap) return;
  if (!location.lastVisited) return;

  const roundsAway = currentTime.totalRounds - location.lastVisited.totalRounds;
  if (roundsAway <= 0) return;

  const daysAway = roundsAway / ROUNDS_PER_DAY;
  const locType = location.locationType;

  const fullResetThreshold = FULL_RESET_DAYS[locType] ?? FULL_RESET_DAYS.wilderness;
  const decayThreshold = DECAY_DAYS[locType] ?? DECAY_DAYS.wilderness;

  // Full reset: clear all modifications, drop legacy grid
  if (daysAway >= fullResetThreshold) {
    const hadMods = (location.localMap.modifications?.length ?? 0) > 0;
    const hadGrid = !!location.localMap.grid;

    if (hadMods || hadGrid) {
      // Estimate bytes saved (rough: ~100 bytes per mod entry, grid ~175KB)
      if (hadGrid) {
        result.estimatedBytesSaved += 175_000;
      }
      result.estimatedBytesSaved += (location.localMap.modifications?.length ?? 0) * 100;

      location.localMap.modifications = [];
      delete location.localMap.grid;
      result.reset.push(location.name);
    }
    return;
  }

  // Partial decay: for now, trim the deprecated full grid if present
  // (future: could selectively remove corpse/item mods while keeping door state)
  if (daysAway >= decayThreshold && location.localMap.grid) {
    result.estimatedBytesSaved += 175_000;
    delete location.localMap.grid;
    location.localMap.modifications = [];
    result.trimmed.push(location.name);
  }
}

/**
 * Stamp the current time on a location as "last visited".
 */
export function markLocationVisited(location: Location, time: GameTime): void {
  location.lastVisited = { totalRounds: time.totalRounds };
}
