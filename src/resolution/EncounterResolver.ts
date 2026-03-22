import type { Location, ResolvedEvent } from '@/types';
import { Resolver } from './Resolver';
import { SeededRNG } from '@/utils/SeededRNG';
import { isDevMode } from '@/utils/devmode';

export class EncounterResolver {
  constructor(
    private resolver: Resolver,
    private rng: SeededRNG,
  ) {}

  generateEncounter(
    location: Location,
    partyLevel: number,
    partySize: number,
  ): ResolvedEvent | null {
    // Build state for template matching
    // In dev mode the character is level 20, but encounter templates cap at ~10.
    // Use a clamped level so templates still match.
    const effectiveLevel = isDevMode() ? Math.min(partyLevel, 5) : partyLevel;
    const state: Record<string, unknown> = {
      partyLevel: effectiveLevel,
      partySize,
      locationType: location.locationType,
      locationTags: location.tags,
      totalRounds: 0,
    };

    // Find eligible encounter templates
    const eligible = this.resolver.findEligibleTemplates('encounter', state);

    if (eligible.length === 0) return null;

    // Filter by location tags
    const locationMatches = eligible.filter((t) =>
      t.tags.includes(location.locationType) || t.tags.includes('any'),
    );

    const pool = locationMatches.length > 0 ? locationMatches : eligible;

    // Weighted random selection
    const weights = pool.map((t) => t.weight);
    const template = this.rng.weightedPick(pool, weights);

    // Resolve the template
    const event = this.resolver.resolve(template, state);

    // Determine actual enemy count from template data
    const minEnemies = (template.data['minEnemies'] as number) ?? 1;
    const maxEnemies = (template.data['maxEnemies'] as number) ?? 3;
    const enemyCount = this.rng.nextInt(
      Math.max(1, minEnemies),
      Math.min(maxEnemies, partySize + 2),
    );

    event.resolvedData['actualEnemyCount'] = enemyCount;
    event.resolvedData['encounterDifficulty'] = this.getEncounterDifficulty(partyLevel, partySize);

    return event;
  }

  shouldEncounter(location: Location, travelDistance?: number): boolean {
    // Base encounter chance varies by location type
    let baseChance: number;
    switch (location.locationType) {
      case 'dungeon':
      case 'cave':
        baseChance = 0.35;
        break;
      case 'wilderness':
      case 'ruins':
        baseChance = 0.20;
        break;
      case 'village':
      case 'town':
      case 'city':
        baseChance = 0.05;
        break;
      default:
        baseChance = 0.15;
    }

    // Travel distance increases encounter chance
    if (travelDistance !== undefined && travelDistance > 0) {
      baseChance += Math.min(0.3, travelDistance * 0.05);
    }

    return this.rng.next() < baseChance;
  }

  getEncounterDifficulty(
    partyLevel: number,
    partySize: number,
  ): 'easy' | 'medium' | 'hard' | 'deadly' {
    // Weight toward medium encounters, with occasional easy/hard/deadly
    const roll = this.rng.next();
    const levelFactor = Math.min(1, partyLevel / 10);

    // Higher level parties get harder encounters more often
    const adjustedRoll = roll + levelFactor * 0.1;

    // Smaller parties get easier encounters
    const sizeAdjustment = partySize <= 1 ? -0.1 : (partySize >= 4 ? 0.1 : 0);
    const finalRoll = adjustedRoll + sizeAdjustment;

    if (finalRoll < 0.25) return 'easy';
    if (finalRoll < 0.60) return 'medium';
    if (finalRoll < 0.85) return 'hard';
    return 'deadly';
  }
}
