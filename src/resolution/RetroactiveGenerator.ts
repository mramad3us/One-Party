import type {
  EntityId,
  GameTime,
  Location,
  NarrativeHint,
  NPC,
  ResolvedEvent,
} from '@/types';
import { Resolver } from './Resolver';
import { SeededRNG } from '@/utils/SeededRNG';
import { ROUNDS_PER_DAY } from '@/types/time';

export interface RetroactiveResult {
  events: ResolvedEvent[];
  npcChanges: { npcId: EntityId; changes: Partial<NPC> }[];
  locationChanges: Partial<Location>;
  narrative: NarrativeHint[];
}

const RETROACTIVE_EVENTS = [
  'A merchant caravan passed through.',
  'A group of travelers stopped to rest.',
  'Local guards drove off a pack of wild animals.',
  'A wandering bard performed for the locals.',
  'Storm damage was repaired by the townsfolk.',
  'A minor dispute between villagers was settled.',
  'New goods arrived at the local shop.',
  'A traveling healer treated the sick.',
  'The local militia conducted training exercises.',
  'Hunters returned with game from the surrounding wilderness.',
];

const RETROACTIVE_NPC_ACTIONS = [
  'went about their daily routine',
  'chatted with other residents',
  'tended to their work',
  'rested and recovered',
  'prepared supplies for travelers',
  'heard rumors from passing merchants',
];

export class RetroactiveGenerator {
  constructor(
    private resolver: Resolver,
    private rng: SeededRNG,
  ) {}

  generate(
    location: Location,
    npcs: NPC[],
    currentTime: GameTime,
  ): RetroactiveResult {
    const events: ResolvedEvent[] = [];
    const npcChanges: { npcId: EntityId; changes: Partial<NPC> }[] = [];
    const narrative: NarrativeHint[] = [];

    // Determine how long the player has been away
    const lastVisited = location.lastVisited;
    if (!lastVisited) {
      // Never visited — nothing happened
      return { events, npcChanges, locationChanges: {}, narrative };
    }

    const roundsAway = currentTime.totalRounds - lastVisited.totalRounds;
    if (roundsAway <= 0) {
      return { events, npcChanges, locationChanges: {}, narrative };
    }

    const daysAway = Math.floor(roundsAway / ROUNDS_PER_DAY);

    // Generate 0-2 events per day away (max 5 total)
    const eventCount = Math.min(5, Math.floor(daysAway * this.rng.nextFloat(0, 2)));

    for (let i = 0; i < eventCount; i++) {
      const eventDescription = this.rng.pick(RETROACTIVE_EVENTS);
      const eventTime: GameTime = {
        totalRounds: lastVisited.totalRounds +
          Math.floor(this.rng.next() * roundsAway),
      };

      // Try to resolve from templates
      const eligible = this.resolver.findEligibleTemplates('event', {
        locationType: location.locationType,
        partyLevel: 1,
        totalRounds: eventTime.totalRounds,
      });

      if (eligible.length > 0 && this.rng.next() < 0.3) {
        const template = this.rng.pick(eligible);
        const resolved = this.resolver.resolve(template, {
          totalRounds: eventTime.totalRounds,
        });
        events.push(resolved);
      } else {
        events.push({
          templateId: 'retroactive_generic',
          type: 'event',
          timestamp: eventTime,
          resolvedData: {
            description: eventDescription,
            locationType: location.locationType,
          },
          narrativeHints: [{
            key: 'retroactive',
            tone: 'informative',
            context: {
              description: eventDescription,
              timeAgo: `${daysAway} day${daysAway !== 1 ? 's' : ''} ago`,
            },
          }],
        });
      }
    }

    // NPC changes during absence
    for (const npc of npcs) {
      if (npc.locationId !== location.id) continue;

      const action = this.rng.pick(RETROACTIVE_NPC_ACTIONS);

      // NPCs heal over time if damaged
      if (npc.stats.currentHp < npc.stats.maxHp && daysAway >= 1) {
        const healAmount = Math.min(
          npc.stats.maxHp - npc.stats.currentHp,
          daysAway * Math.max(1, npc.stats.level),
        );

        npcChanges.push({
          npcId: npc.id,
          changes: {
            stats: {
              ...npc.stats,
              currentHp: npc.stats.currentHp + healAmount,
            },
          } as Partial<NPC>,
        });
      }

      narrative.push({
        key: 'npc_retroactive',
        tone: 'informative',
        context: {
          npcName: npc.name,
          action,
        },
      });
    }

    // Location changes
    const locationChanges: Partial<Location> = {};

    // Small flavor: add returning narrative
    if (daysAway >= 1) {
      narrative.push({
        key: 'return_to_location',
        tone: 'atmospheric',
        context: {
          location: location.name,
          daysAway: String(daysAway),
          summary: daysAway === 1
            ? 'A day has passed since your last visit.'
            : `${daysAway} days have passed since you were last here.`,
        },
      });
    }

    return { events, npcChanges, locationChanges, narrative };
  }
}
