import type {
  Character,
  EntityId,
  Location,
  NarrativeHint,
  ResolvedEvent,
  SubLocation,
} from '@/types';
import { SeededRNG } from '@/utils/SeededRNG';
import { abilityModifier } from '@/utils/math';

export interface ExplorationResult {
  discovered: string[];
  encounters: ResolvedEvent[];
  narrative: NarrativeHint[];
  timeElapsed: number;
}

export interface SearchResult {
  found: boolean;
  items?: EntityId[];
  secrets?: string[];
  narrative: NarrativeHint[];
}

const EXPLORATION_DISCOVERIES = [
  'a set of old footprints leading deeper inside',
  'scratch marks on the walls, as if something clawed its way through',
  'a faded map carved into the stone floor',
  'the remains of a previous explorer\'s campfire',
  'strange glowing mushrooms growing in a dark corner',
  'a hidden alcove behind a loose stone',
  'old bones scattered across the ground',
  'a tattered journal page fluttering in a draft',
  'claw marks scarring the doorframe',
  'a faint magical glow emanating from deeper within',
];

const EXPLORATION_NARRATIVES_DUNGEON = [
  'You press deeper into the darkness, torchlight flickering against damp stone walls.',
  'The air grows colder as you explore further, your breath misting before you.',
  'Distant dripping echoes through the corridors as you cautiously advance.',
  'Cobwebs brush your face as you push through a narrow passage.',
];

const EXPLORATION_NARRATIVES_WILDERNESS = [
  'You push through the undergrowth, searching for anything of interest.',
  'The terrain grows rougher as you venture off the beaten path.',
  'You scan the area carefully, looking for signs of activity.',
  'The wind rustles through the trees as you explore the surroundings.',
];

const EXPLORATION_NARRATIVES_VILLAGE = [
  'You wander the village streets, taking in the sights and sounds of daily life.',
  'Locals glance at you curiously as you explore the settlement.',
  'The smell of baking bread and wood smoke fills the air as you look around.',
];

const SEARCH_FLAVOR_FOUND = [
  'Your keen eye catches something hidden from casual observation.',
  'After careful investigation, you discover something concealed.',
  'You notice something unusual that others might have overlooked.',
  'A thorough search reveals a hidden find.',
];

const SEARCH_FLAVOR_NOTHING = [
  'Despite a thorough search, you find nothing of note.',
  'You search carefully but come up empty-handed.',
  'The area yields no secrets to your investigation.',
  'After looking around, you determine there is nothing hidden here.',
];

export class ExplorationSystem {
  constructor(private rng: SeededRNG) {}

  explore(location: Location): ExplorationResult {
    const discovered: string[] = [];
    const encounters: ResolvedEvent[] = [];
    const narrative: NarrativeHint[] = [];

    // Pick exploration narrative based on location type
    let narrativePool: string[];
    switch (location.locationType) {
      case 'dungeon':
      case 'cave':
      case 'ruins':
        narrativePool = EXPLORATION_NARRATIVES_DUNGEON;
        break;
      case 'village':
      case 'town':
      case 'city':
        narrativePool = EXPLORATION_NARRATIVES_VILLAGE;
        break;
      default:
        narrativePool = EXPLORATION_NARRATIVES_WILDERNESS;
    }

    narrative.push({
      key: 'exploration_description',
      tone: 'atmospheric',
      context: {
        location: location.name,
        description: this.rng.pick(narrativePool),
      },
    });

    // Chance to discover something interesting (40%)
    if (this.rng.next() < 0.4) {
      const discovery = this.rng.pick(EXPLORATION_DISCOVERIES);
      discovered.push(discovery);
      narrative.push({
        key: 'exploration_discovery',
        tone: 'intriguing',
        context: { discovery },
      });
    }

    // Chance of an encounter while exploring (15% in wilderness/dungeon, 5% in village)
    const encounterChance = ['dungeon', 'cave', 'wilderness', 'ruins'].includes(location.locationType)
      ? 0.15
      : 0.05;
    if (this.rng.next() < encounterChance) {
      encounters.push({
        templateId: 'exploration_encounter',
        type: 'encounter',
        timestamp: { totalRounds: 0 },
        resolvedData: {
          locationType: location.locationType,
          locationName: location.name,
        },
        narrativeHints: [{
          key: 'encounter_while_exploring',
          tone: 'tense',
          context: {
            description: 'You are not alone here...',
          },
        }],
      });
    }

    // Discover undiscovered sub-locations
    for (const [, sub] of location.subLocations) {
      if (!sub.discovered && this.rng.next() < 0.5) {
        sub.discovered = true;
        discovered.push(sub.name);
        narrative.push({
          key: 'sublocation_discovered',
          tone: 'discovery',
          context: {
            name: sub.name,
            type: sub.subType,
          },
        });
      }
    }

    // Exploration takes about 10 minutes = 100 rounds
    const timeElapsed = 100;

    return { discovered, encounters, narrative, timeElapsed };
  }

  enterSubLocation(subLocation: SubLocation): ExplorationResult {
    const discovered: string[] = [];
    const encounters: ResolvedEvent[] = [];
    const narrative: NarrativeHint[] = [];

    subLocation.discovered = true;

    narrative.push({
      key: 'enter_sublocation',
      tone: 'atmospheric',
      context: {
        name: subLocation.name,
        type: subLocation.subType,
        interior: subLocation.interiorType,
      },
    });

    // Dungeon rooms have higher encounter chance
    if (subLocation.subType === 'dungeon_room' && this.rng.next() < 0.3) {
      encounters.push({
        templateId: 'room_encounter',
        type: 'encounter',
        timestamp: { totalRounds: 0 },
        resolvedData: {
          subLocationType: subLocation.subType,
          subLocationName: subLocation.name,
        },
        narrativeHints: [{
          key: 'room_encounter',
          tone: 'danger',
          context: {
            description: 'Creatures lurk within this chamber!',
          },
        }],
      });
    }

    return {
      discovered,
      encounters,
      narrative,
      timeElapsed: 10, // ~1 minute to enter
    };
  }

  searchArea(character: Character, dc?: number): SearchResult {
    const searchDC = dc ?? this.rng.nextInt(10, 18);
    const perceptionMod = abilityModifier(character.abilityScores.wisdom);
    const profBonus = character.proficiencies.skills.includes('perception')
      ? character.proficiencyBonus
      : 0;
    const roll = this.rng.nextInt(1, 20);
    const total = roll + perceptionMod + profBonus;

    const found = total >= searchDC;
    const narrative: NarrativeHint[] = [];

    if (found) {
      narrative.push({
        key: 'search_success',
        tone: 'positive',
        context: {
          description: this.rng.pick(SEARCH_FLAVOR_FOUND),
          roll: String(total),
          dc: String(searchDC),
        },
      });

      // Determine what was found
      const items: EntityId[] = [];
      const secrets: string[] = [];

      if (this.rng.next() < 0.5) {
        // Found an item
        const possibleItems = [
          'item_healing_potion',
          'item_torch',
          'item_rations',
          'item_dagger',
          'item_rope',
        ];
        items.push(this.rng.pick(possibleItems));
      } else {
        // Found a secret
        const possibleSecrets = [
          'A hidden passage behind a false wall.',
          'A concealed lever that opens a secret door.',
          'Ancient writing on the wall that reads: "Beware the guardian below."',
          'A loose stone concealing a small cache.',
          'Faint magical runes etched into the floor.',
        ];
        secrets.push(this.rng.pick(possibleSecrets));
      }

      return { found: true, items, secrets, narrative };
    }

    narrative.push({
      key: 'search_failure',
      tone: 'neutral',
      context: {
        description: this.rng.pick(SEARCH_FLAVOR_NOTHING),
        roll: String(total),
        dc: String(searchDC),
      },
    });

    return { found: false, narrative };
  }
}
