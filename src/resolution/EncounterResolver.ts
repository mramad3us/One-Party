import type { Location, ResolvedEvent, BiomeType } from '@/types';
import { Resolver } from './Resolver';
import { SeededRNG } from '@/utils/SeededRNG';
import { getSpawnPool, pickFromPool, densityToEncounterDC } from '@/data/spawnTables';
import { getMonster } from '@/data/monsters';

export class EncounterResolver {
  constructor(
    private resolver: Resolver,
    private rng: SeededRNG,
  ) {}

  /**
   * Generate an encounter using location-based spawn tables.
   * Picks thematic monsters from the spawn pool for this location/biome.
   * Returns a ResolvedEvent compatible with CombatController.startEncounter().
   */
  generateEncounter(
    location: Location,
    _partyLevel: number,
    _partySize: number,
    biome?: BiomeType,
  ): ResolvedEvent | null {
    const pool = getSpawnPool(location.locationType, location.tags, biome);
    if (!pool || pool.entries.length === 0) {
      // Fallback to template-based generation
      return this.generateFromTemplates(location, _partyLevel, _partySize);
    }

    // Pick a monster from the weighted pool
    const pick = pickFromPool(pool.entries, () => this.rng.next());
    if (!pick) return null;

    // Determine group size
    const minCount = pick.minCount ?? 1;
    const maxCount = pick.maxCount ?? 1;
    const enemyCount = this.rng.nextInt(minCount, maxCount);

    // Look up the monster for narrative info
    const monster = getMonster(pick.monsterId);
    const monsterName = monster?.name ?? 'enemies';
    const plural = enemyCount > 1;

    // Build encounter description
    const descriptions = [
      `${plural ? `A group of ${monsterName}s` : `A ${monsterName}`} blocks your path!`,
      `You stumble upon ${plural ? `${enemyCount} ${monsterName}s` : `a ${monsterName}`}!`,
      `${plural ? `${monsterName}s` : `A ${monsterName}`} ${plural ? 'emerge' : 'emerges'} from the shadows!`,
      `An ambush! ${plural ? `${monsterName}s` : `A ${monsterName}`} ${plural ? 'attack' : 'attacks'}!`,
    ];
    const description = descriptions[this.rng.nextInt(0, descriptions.length - 1)];

    // Construct ResolvedEvent matching the shape CombatController expects
    const event: ResolvedEvent = {
      templateId: `spawn_${pick.monsterId}`,
      type: 'encounter',
      timestamp: { totalRounds: 0 },
      resolvedData: {
        name: `${monsterName} Encounter`,
        description,
        monsterIds: [pick.monsterId],
        actualEnemyCount: enemyCount,
        encounterDifficulty: monster ? this.crToDifficulty(monster.cr) : 'medium',
      },
      narrativeHints: [],
    };

    return event;
  }

  /**
   * Get the encounter DC for a location based on its spawn table density.
   * Higher density → lower DC → more encounters.
   * Returns 21 (impossible) if no spawn table exists for this location.
   */
  getEncounterDC(
    location: Location,
    biome?: BiomeType,
    travelDistanceBonus?: number,
  ): number {
    const pool = getSpawnPool(location.locationType, location.tags, biome);
    if (!pool) return 21; // No spawns possible

    let density = pool.density;
    // Travel distance increases encounter chance
    if (travelDistanceBonus !== undefined && travelDistanceBonus > 0) {
      density = Math.min(1, density + travelDistanceBonus);
    }

    return densityToEncounterDC(density);
  }

  /**
   * Map monster CR to encounter difficulty label.
   * This is based on the monster's threat, not the party's level.
   */
  private crToDifficulty(cr: number): 'easy' | 'medium' | 'hard' | 'deadly' {
    if (cr <= 0.5) return 'easy';
    if (cr <= 2) return 'medium';
    if (cr <= 5) return 'hard';
    return 'deadly';
  }

  // ── Legacy template-based fallback ──

  /** Fallback: generate encounter from templates (for locations without spawn tables). */
  private generateFromTemplates(
    location: Location,
    partyLevel: number,
    partySize: number,
  ): ResolvedEvent | null {
    const effectiveLevel = Math.min(partyLevel, 5);
    const state: Record<string, unknown> = {
      partyLevel: effectiveLevel,
      partySize,
      locationType: location.locationType,
      locationTags: location.tags,
      totalRounds: 0,
    };

    const eligible = this.resolver.findEligibleTemplates('encounter', state);
    if (eligible.length === 0) return null;

    const locationMatches = eligible.filter((t) =>
      t.tags.includes(location.locationType) || t.tags.includes('any'),
    );
    const pool = locationMatches.length > 0 ? locationMatches : eligible;

    const weights = pool.map((t) => t.weight);
    const template = this.rng.weightedPick(pool, weights);
    const event = this.resolver.resolve(template, state);

    const minEnemies = (template.data['minEnemies'] as number) ?? 1;
    const maxEnemies = (template.data['maxEnemies'] as number) ?? 3;
    const enemyCount = this.rng.nextInt(
      Math.max(1, minEnemies),
      Math.min(maxEnemies, partySize + 2),
    );

    event.resolvedData['actualEnemyCount'] = enemyCount;
    event.resolvedData['encounterDifficulty'] = 'medium';

    return event;
  }
}
