import type { Location, NarrativeHint, ResolvedEvent } from '@/types';
import { ROUNDS_PER_HOUR } from '@/types/time';
import { SeededRNG } from '@/utils/SeededRNG';
import { distance } from '@/utils/math';

export interface TravelResult {
  arrived: boolean;
  timeElapsed: number; // Rounds
  encounters: ResolvedEvent[];
  narrative: NarrativeHint[];
}

const TRAVEL_NARRATIVES: string[][] = [
  // Forest travel
  [
    'The trail winds through the trees, dappled sunlight filtering through the canopy above.',
    'You follow a narrow path between towering oaks, the forest floor carpeted with fallen leaves.',
    'Birds call overhead as you make your way through the woodland, the scent of pine and earth filling the air.',
  ],
  // Generic travel
  [
    'The road stretches ahead, the landscape slowly changing as you press onward.',
    'You travel in silence, alert for any sign of danger on the road.',
    'The journey passes without incident, though you remain watchful.',
    'Your footsteps echo as you make your way along the path.',
  ],
];

export class TravelSystem {
  constructor(private rng: SeededRNG) {}

  canTravel(from: Location, to: Location): boolean {
    return from.connections.includes(to.id);
  }

  getTravelTime(from: Location, to: Location): number {
    // Base travel time based on coordinate distance, minimum 1 hour
    const dist = distance(from.coordinates, to.coordinates);
    const baseHours = Math.max(1, Math.round(dist));

    // Dungeons/caves take longer to approach
    const destinationMultiplier =
      to.locationType === 'dungeon' || to.locationType === 'cave' ? 1.5 : 1.0;

    return Math.round(baseHours * destinationMultiplier * ROUNDS_PER_HOUR);
  }

  travel(from: Location, to: Location): TravelResult {
    if (!this.canTravel(from, to)) {
      return {
        arrived: false,
        timeElapsed: 0,
        encounters: [],
        narrative: [{
          key: 'travel_blocked',
          tone: 'warning',
          context: { from: from.name, to: to.name },
        }],
      };
    }

    const timeElapsed = this.getTravelTime(from, to);
    const encounters: ResolvedEvent[] = [];
    const narrative: NarrativeHint[] = [];

    // Pick a travel narrative
    const travelTexts = this.rng.pick(TRAVEL_NARRATIVES);
    const travelText = this.rng.pick(travelTexts);

    narrative.push({
      key: 'travel_description',
      tone: 'atmospheric',
      context: {
        from: from.name,
        to: to.name,
        description: travelText,
      },
    });

    // Check for random encounters during travel (20% base chance)
    const encounterChance = 0.2;
    if (this.rng.next() < encounterChance) {
      // Generate a travel encounter event
      const encounter: ResolvedEvent = {
        templateId: 'travel_random_encounter',
        type: 'encounter',
        timestamp: { totalRounds: 0 },
        resolvedData: {
          locationType: 'wilderness',
          difficulty: Math.max(1, (from.tags.includes('starting_location') ? 1 : 2)),
        },
        narrativeHints: [{
          key: 'encounter_on_road',
          tone: 'tense',
          context: {
            description: 'Something stirs in the undergrowth ahead...',
          },
        }],
      };
      encounters.push(encounter);
    }

    // Arrival narrative
    narrative.push({
      key: 'travel_arrival',
      tone: 'neutral',
      context: {
        destination: to.name,
        locationType: to.locationType,
        description: to.description,
      },
    });

    return {
      arrived: true,
      timeElapsed,
      encounters,
      narrative,
    };
  }
}
