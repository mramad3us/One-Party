import type {
  BiomeType,
  EntityId,
  Location,
  LocationType,
  NPC,
  NPCRole,
  Region,
  SubLocation,
  SubLocationType,
  World,
} from '@/types';
import { SeededRNG } from '@/utils/SeededRNG';
import { generateId } from '@/engine/IdGenerator';
import { NPCFactory } from '@/npc/NPCFactory';

// ── Name generation tables ──────────────────────────────────────────

const PREFIXES = [
  'Shadow', 'Iron', 'Storm', 'Silver', 'Dragon', 'Raven', 'Frost', 'Ember',
  'Thorn', 'Golden', 'Dark', 'Bright', 'Crimson', 'Ash', 'Stone', 'Wolf',
  'Oak', 'Moss', 'Mist', 'Dusk', 'Dawn', 'Star', 'Moon', 'Sun', 'Black',
  'White', 'Red', 'Green', 'Deep', 'High', 'Old', 'Wild', 'Hollow', 'Bone',
];

const LOCATION_SUFFIXES = [
  'haven', 'hold', 'dale', 'crest', 'hollow', 'peak', 'ford', 'march',
  'fell', 'keep', 'shire', 'vale', 'gate', 'watch', 'bridge', 'grove',
  'wood', 'field', 'stead', 'moor', 'glen', 'brook', 'ridge', 'stone',
];

const DUNGEON_ADJECTIVES = [
  'Forgotten', 'Whispering', 'Cursed', 'Sunken', 'Ruined', 'Haunted',
  'Ancient', 'Silent', 'Blighted', 'Shattered', 'Forsaken', 'Festering',
  'Crumbling', 'Twisted', 'Echoing', 'Frozen',
];

const DUNGEON_NOUNS = [
  'Crypts', 'Caves', 'Depths', 'Tunnels', 'Vaults', 'Catacombs',
  'Chambers', 'Ruins', 'Pits', 'Halls', 'Warren', 'Labyrinth',
  'Lair', 'Tombs', 'Sanctum', 'Passage',
];

const WILDERNESS_NAMES = [
  'Darkwood Trail', 'Winding Path', 'Overgrown Road', 'Forest Edge',
  'Bramble Thicket', 'Mossy Ravine', 'Rocky Outcrop', 'Misty Glade',
  'Thornbriar Pass', 'Ancient Grove', 'Fallen Bridge', 'Riverbank Crossing',
  'Windswept Ridge', 'Foggy Hollow', 'Sunlit Meadow', 'Stone Circle',
];

const REGION_NAMES = [
  'Elderwood', 'Greenvale', 'Mistreach', 'Thornhaven',
  'Shadowglen', 'Ashfield', 'Stormhollow', 'Silverdale',
  'Deepwood', 'Mossreach', 'Ironvale', 'Ravencrest',
];

const BIOME_DESCRIPTIONS: Record<BiomeType, string[]> = {
  forest: [
    'A dense woodland where ancient trees blot out the sun and mossy paths wind between gnarled roots.',
    'Towering oaks and whispering pines form a canopy so thick that only dappled light reaches the forest floor.',
    'A primeval forest where birdsong mixes with the distant howl of wolves and the creak of ancient wood.',
  ],
  mountain: [
    'Jagged peaks rise above the clouds, their slopes dotted with hardy pines and treacherous scree.',
    'Wind-blasted crags and narrow passes define this mountainous terrain.',
  ],
  desert: [
    'Endless dunes stretch to the horizon under a merciless sun.',
    'Sun-scorched sands and rocky mesas mark this arid expanse.',
  ],
  swamp: [
    'Fetid pools and twisted mangroves make every step treacherous in this waterlogged land.',
    'Mist clings to the brackish waters and gnarled trees of this dismal swampland.',
  ],
  plains: [
    'Rolling grasslands stretch as far as the eye can see, broken only by the occasional copse of trees.',
    'Windswept fields of tall grass ripple like a golden sea under the open sky.',
  ],
  coast: [
    'Salt-sprayed cliffs overlook crashing waves and sandy coves.',
    'The tang of brine fills the air along this rugged stretch of coastline.',
  ],
  tundra: [
    'A frozen wasteland of permafrost and biting winds, where only the hardiest creatures survive.',
    'Ice-crusted plains stretch endlessly beneath a pale, cold sun.',
  ],
  volcanic: [
    'Blackened earth and rivers of molten rock paint a hellish landscape beneath an ash-choked sky.',
    'Sulfurous vents and obsidian formations mark this volcanically active region.',
  ],
  underdark: [
    'Vast caverns stretch into impenetrable darkness, lit only by bioluminescent fungi and glowing crystals.',
    'Twisting tunnels and yawning chasms define this sunless realm beneath the earth.',
  ],
  urban: [
    'Crowded streets and towering buildings form a maze of commerce, intrigue, and opportunity.',
    'A sprawling settlement of stone and timber, bustling with life and activity.',
  ],
};

const LOCATION_DESCRIPTIONS: Record<LocationType, string[]> = {
  village: [
    'A small settlement of thatch-roofed cottages clustered around a central well.',
    'A humble hamlet where farmers and craftfolk go about their daily lives.',
    'A quiet village where the smell of baking bread mingles with woodsmoke.',
  ],
  town: [
    'A bustling market town with cobblestone streets and a busy town square.',
    'A prosperous settlement ringed by a low stone wall, with shops lining the main road.',
  ],
  city: [
    'A sprawling city of towering spires and winding alleys, alive with commerce and intrigue.',
  ],
  dungeon: [
    'Dark corridors stretch into the earth, their walls slick with moisture and ancient grime.',
    'A forbidding underground complex where danger lurks in every shadow.',
    'Crumbling stone passages descend into the darkness below.',
  ],
  wilderness: [
    'Untamed land where nature reigns supreme and civilization is but a memory.',
    'A stretch of wild country, beautiful yet dangerous for the unprepared.',
    'An expanse of natural terrain, far from the safety of settled lands.',
  ],
  ruins: [
    'Crumbling walls and toppled columns mark where a great structure once stood.',
    'The remnants of a forgotten civilization, slowly being reclaimed by nature.',
    'Moss-covered stones and weathered carvings hint at past grandeur.',
  ],
  castle: [
    'A fortified stronghold of thick stone walls and imposing towers.',
    'A once-grand castle, its battlements still standing against the test of time.',
  ],
  cave: [
    'A natural cavern with dripping stalactites and echoing chambers.',
    'A dark opening in the rock face leads into a network of underground passages.',
    'Damp stone walls and the sound of dripping water mark this subterranean space.',
  ],
  temple: [
    'A sacred structure dedicated to powers both divine and arcane.',
    'Carved pillars and faded frescoes adorn this ancient place of worship.',
  ],
  camp: [
    'A makeshift encampment of tents and campfires.',
    'A temporary camp set up by travelers, offering basic shelter from the elements.',
  ],
};

const SUB_LOCATION_DESCRIPTIONS: Record<SubLocationType, string[]> = {
  tavern: [
    'A warm, dimly lit taproom where ale flows and stories are shared.',
    'The common room of the local inn, smelling of hearth-fire and roasted meat.',
  ],
  shop: [
    'Shelves lined with goods and wares, a shopkeeper watching from behind the counter.',
    'A modest general store stocked with supplies for travelers and locals alike.',
  ],
  blacksmith: [
    'The ring of hammer on anvil fills the air, heat radiating from the forge.',
    'A soot-stained workshop where weapons and armor are crafted with skill.',
  ],
  temple: [
    'A serene chamber lit by candles, with an altar at its center.',
    'A quiet place of devotion, its walls adorned with religious iconography.',
  ],
  dungeon_room: [
    'A dark, musty chamber deep underground.',
    'A stone room with worn flagstones and ancient sconces on the walls.',
    'A dank chamber where shadows pool in the corners.',
  ],
  clearing: [
    'A natural opening in the canopy where sunlight streams down.',
    'A peaceful glade surrounded by towering trees.',
  ],
  house: [
    'A modest dwelling with simple furnishings.',
    'A timber-framed house with a thatched roof and a small hearth.',
  ],
  hall: [
    'A grand hall with vaulted ceilings and long tables.',
    'A spacious chamber meant for gatherings and feasts.',
  ],
  tower: [
    'A narrow, winding staircase leads up through this stone tower.',
    'A tall structure offering commanding views of the surrounding area.',
  ],
  cellar: [
    'A damp underground storage room smelling of old wood and earth.',
    'A cool, dark cellar lined with barrels and crates.',
  ],
  market: [
    'An open area bustling with vendors hawking their wares.',
    'Colorful stalls and the clamor of haggling fill this marketplace.',
  ],
  barracks: [
    'Rows of bunks line the walls of this military quarters.',
    'A spartan room filled with weapon racks and sleeping pallets.',
  ],
};

// ── Sub-location configurations per location type ──────────────────

type SubLocationConfig = {
  subType: SubLocationType;
  interiorType: 'interior' | 'exterior';
  required?: boolean;
};

const VILLAGE_SUBS: SubLocationConfig[] = [
  { subType: 'tavern', interiorType: 'interior', required: true },
  { subType: 'shop', interiorType: 'interior', required: true },
  { subType: 'house', interiorType: 'interior' },
  { subType: 'house', interiorType: 'interior' },
  { subType: 'blacksmith', interiorType: 'interior' },
  { subType: 'temple', interiorType: 'interior' },
  { subType: 'market', interiorType: 'exterior' },
];

const DUNGEON_SUBS: SubLocationConfig[] = [
  { subType: 'dungeon_room', interiorType: 'interior', required: true },
  { subType: 'dungeon_room', interiorType: 'interior', required: true },
  { subType: 'dungeon_room', interiorType: 'interior' },
  { subType: 'dungeon_room', interiorType: 'interior' },
  { subType: 'hall', interiorType: 'interior' },
  { subType: 'cellar', interiorType: 'interior' },
];

const WILDERNESS_SUBS: SubLocationConfig[] = [
  { subType: 'clearing', interiorType: 'exterior', required: true },
  { subType: 'clearing', interiorType: 'exterior' },
  { subType: 'clearing', interiorType: 'exterior' },
];

const RUINS_SUBS: SubLocationConfig[] = [
  { subType: 'hall', interiorType: 'interior', required: true },
  { subType: 'dungeon_room', interiorType: 'interior' },
  { subType: 'cellar', interiorType: 'interior' },
  { subType: 'tower', interiorType: 'interior' },
];

const CAVE_SUBS: SubLocationConfig[] = [
  { subType: 'dungeon_room', interiorType: 'interior', required: true },
  { subType: 'dungeon_room', interiorType: 'interior' },
  { subType: 'dungeon_room', interiorType: 'interior' },
  { subType: 'hall', interiorType: 'interior' },
];

// ── Sub-location → NPC role mapping ─────────────────────────────────

/** Maps a sub-location type to the NPC role that should inhabit it, or null if none */
const SUB_LOCATION_NPC_ROLES: Partial<Record<SubLocationType, NPCRole>> = {
  tavern: 'innkeeper',
  shop: 'merchant',
  blacksmith: 'blacksmith',
  temple: 'priest',
  market: 'merchant',
  barracks: 'guard',
};

/** Settlement location types that should have NPCs generated */
const SETTLEMENT_TYPES: LocationType[] = ['village', 'town', 'city'];

function getSubLocationConfigs(locType: LocationType): SubLocationConfig[] {
  switch (locType) {
    case 'village': return VILLAGE_SUBS;
    case 'town': return VILLAGE_SUBS;
    case 'dungeon': return DUNGEON_SUBS;
    case 'wilderness': return WILDERNESS_SUBS;
    case 'ruins': return RUINS_SUBS;
    case 'cave': return CAVE_SUBS;
    case 'castle': return RUINS_SUBS;
    case 'temple': return RUINS_SUBS;
    case 'camp': return WILDERNESS_SUBS;
    case 'city': return VILLAGE_SUBS;
    default: return WILDERNESS_SUBS;
  }
}

/** Result from world generation, including both the world and all generated NPCs */
export type WorldGenerationResult = {
  world: World;
  npcs: NPC[];
};

export class WorldGenerator {
  private npcFactory: NPCFactory;
  /** NPCs created during generation, collected for external registration */
  private generatedNPCs: NPC[] = [];
  /** Biome of the current region being generated (used for merchant inventory) */
  private currentBiome: BiomeType = 'plains';

  constructor(private rng: SeededRNG) {
    this.npcFactory = new NPCFactory(rng);
  }

  generateWorld(seed: number): WorldGenerationResult {
    const worldRng = new SeededRNG(seed);
    this.rng = worldRng;
    this.npcFactory = new NPCFactory(worldRng);
    this.generatedNPCs = [];

    const worldId = generateId();
    const world: World = {
      id: worldId,
      name: this.rng.pick(REGION_NAMES) + ' Realm',
      seed,
      regions: new Map(),
      time: { totalRounds: 0 },
      history: [],
    };

    // Generate the starting region
    const startRegion = this.generateRegion(1, 'forest');
    world.regions.set(startRegion.id, startRegion);

    return { world, npcs: this.generatedNPCs };
  }

  /** Retrieve all NPCs generated since last reset (useful when calling generateLocation directly) */
  getGeneratedNPCs(): NPC[] {
    return [...this.generatedNPCs];
  }

  /** Clear the list of generated NPCs (call after retrieving them) */
  clearGeneratedNPCs(): void {
    this.generatedNPCs = [];
  }

  generateRegion(difficulty: number, biome?: BiomeType): Region {
    const selectedBiome = biome ?? this.rng.pick<BiomeType>([
      'forest', 'mountain', 'plains', 'swamp', 'coast',
    ]);
    this.currentBiome = selectedBiome;
    const regionId = generateId();
    const regionName = this.rng.pick(PREFIXES) + this.rng.pick(LOCATION_SUFFIXES);

    const region: Region = {
      id: regionId,
      name: regionName,
      biome: selectedBiome,
      description: this.rng.pick(BIOME_DESCRIPTIONS[selectedBiome]),
      coordinates: { x: 0, y: 0 },
      difficulty,
      locations: new Map(),
      connections: [],
      discovered: true,
    };

    // Generate locations: 1 village (start), 1 dungeon, 2-3 wilderness, 1 ruins or cave
    const locationCount = this.rng.nextInt(5, 8);
    const locationTypes: LocationType[] = ['village', 'dungeon'];

    // Add wilderness areas
    const wildernessCount = this.rng.nextInt(2, 3);
    for (let i = 0; i < wildernessCount; i++) {
      locationTypes.push('wilderness');
    }

    // Add ruins or cave
    locationTypes.push(this.rng.pick<LocationType>(['ruins', 'cave']));

    // Fill remaining slots
    const extraTypes: LocationType[] = ['cave', 'ruins', 'camp', 'temple'];
    while (locationTypes.length < locationCount) {
      locationTypes.push(this.rng.pick(extraTypes));
    }

    // Generate each location
    const locations: Location[] = [];
    for (let i = 0; i < locationTypes.length; i++) {
      const locDifficulty = locationTypes[i] === 'village'
        ? difficulty
        : difficulty + this.rng.nextInt(0, 2);
      const location = this.generateLocation(regionId, locationTypes[i], locDifficulty);

      // Spread locations around in a rough circle
      const angle = (i / locationTypes.length) * Math.PI * 2;
      const dist = locationTypes[i] === 'village' ? 0 : this.rng.nextInt(2, 5);
      location.coordinates = {
        x: Math.round(Math.cos(angle) * dist),
        y: Math.round(Math.sin(angle) * dist),
      };

      // Mark village as discovered and starting point
      if (locationTypes[i] === 'village') {
        location.discovered = true;
        location.tags.push('starting_location');
      }

      locations.push(location);
      region.locations.set(location.id, location);
    }

    // Connect locations logically
    this.connectLocations(locations);

    return region;
  }

  generateLocation(
    regionId: EntityId,
    locationType: LocationType,
    difficulty: number,
  ): Location {
    const locationId = generateId();
    const name = this.generateLocationName(locationType);

    const location: Location = {
      id: locationId,
      regionId,
      name,
      locationType,
      coordinates: { x: 0, y: 0 },
      description: this.rng.pick(LOCATION_DESCRIPTIONS[locationType]),
      subLocations: new Map(),
      npcs: [],
      items: [],
      discovered: false,
      lastVisited: null,
      connections: [],
      tags: [locationType, `difficulty_${difficulty}`],
    };

    // Generate sub-locations
    const configs = getSubLocationConfigs(locationType);
    const required = configs.filter((c) => c.required);
    const optional = configs.filter((c) => !c.required);

    const subCount = this.rng.nextInt(2, 4);
    const selectedConfigs = [
      ...required,
      ...this.rng.shuffle(optional).slice(0, Math.max(0, subCount - required.length)),
    ];

    const isSettlement = SETTLEMENT_TYPES.includes(locationType);

    for (let i = 0; i < selectedConfigs.length; i++) {
      const config = selectedConfigs[i];
      const subLocation = this.generateSubLocation(
        locationId,
        config.subType,
        config.interiorType,
      );
      subLocation.coordinates = { x: i, y: 0 };
      location.subLocations.set(subLocation.id, subLocation);

      // Create NPCs for settlement sub-locations
      if (isSettlement) {
        const npc = this.createNPCForSubLocation(
          subLocation,
          locationId,
          difficulty,
        );
        if (npc) {
          subLocation.npcs.push(npc.id);
          location.npcs.push(npc.id);
          this.generatedNPCs.push(npc);
        }
      }
    }

    return location;
  }

  generateSubLocation(
    locationId: EntityId,
    subType: SubLocationType,
    interiorType: 'interior' | 'exterior',
  ): SubLocation {
    const subId = generateId();
    const descriptions = SUB_LOCATION_DESCRIPTIONS[subType];
    const name = this.generateSubLocationName(subType);

    const subLocation: SubLocation = {
      id: subId,
      locationId,
      name,
      subType,
      coordinates: { x: 0, y: 0 },
      spaces: new Map(),
      npcs: [],
      items: [],
      discovered: false,
      interiorType,
    };

    // Void usage lint
    void descriptions;

    return subLocation;
  }

  /**
   * Create an NPC for a settlement sub-location based on its type.
   * Returns null if the sub-location type doesn't warrant an NPC
   * (e.g. houses have only a 50% chance of spawning a commoner).
   */
  private createNPCForSubLocation(
    subLocation: SubLocation,
    locationId: EntityId,
    difficulty: number,
  ): NPC | null {
    const subType = subLocation.subType;

    // Houses have a 50% chance of a commoner NPC
    if (subType === 'house') {
      if (this.rng.next() < 0.5) {
        return this.npcFactory.createFromTemplate('commoner', 1, locationId, {
          biome: this.currentBiome,
          difficulty,
        });
      }
      return null;
    }

    // Look up the NPC role for this sub-location type
    const role = SUB_LOCATION_NPC_ROLES[subType];
    if (!role) return null;

    // NPC level scales slightly with difficulty
    const npcLevel = Math.max(1, difficulty);

    return this.npcFactory.createFromTemplate(role, npcLevel, locationId, {
      biome: this.currentBiome,
      difficulty,
    });
  }

  private generateLocationName(locType: LocationType): string {
    switch (locType) {
      case 'village':
      case 'town':
      case 'city':
        return this.rng.pick(PREFIXES) + this.rng.pick(LOCATION_SUFFIXES);
      case 'dungeon':
        return `The ${this.rng.pick(DUNGEON_ADJECTIVES)} ${this.rng.pick(DUNGEON_NOUNS)}`;
      case 'wilderness':
        return this.rng.pick(WILDERNESS_NAMES);
      case 'ruins':
        return `${this.rng.pick(PREFIXES)} Ruins`;
      case 'cave':
        return `The ${this.rng.pick(DUNGEON_ADJECTIVES)} ${this.rng.pick(['Cave', 'Cavern', 'Grotto', 'Den'])}`;
      case 'castle':
        return `${this.rng.pick(PREFIXES)} ${this.rng.pick(['Castle', 'Fortress', 'Citadel'])}`;
      case 'temple':
        return `Temple of the ${this.rng.pick(PREFIXES)} ${this.rng.pick(['Light', 'Dawn', 'Star', 'Moon', 'Sun'])}`;
      case 'camp':
        return `${this.rng.pick(PREFIXES)} Camp`;
      default:
        return this.rng.pick(PREFIXES) + this.rng.pick(LOCATION_SUFFIXES);
    }
  }

  private generateSubLocationName(subType: SubLocationType): string {
    switch (subType) {
      case 'tavern':
        return `The ${this.rng.pick(PREFIXES)} ${this.rng.pick(['Flagon', 'Tankard', 'Goblet', 'Barrel', 'Hearth', 'Stag', 'Dragon', 'Griffin'])}`;
      case 'shop':
        return `${this.rng.pick(PREFIXES)} ${this.rng.pick(['Goods', 'Supplies', 'Wares', 'Emporium', 'Trading Post'])}`;
      case 'blacksmith':
        return `The ${this.rng.pick(['Anvil', 'Forge', 'Hammer', 'Bellows'])} & ${this.rng.pick(['Steel', 'Iron', 'Blade', 'Flame'])}`;
      case 'dungeon_room':
        return `${this.rng.pick(DUNGEON_ADJECTIVES)} Chamber`;
      case 'clearing':
        return `${this.rng.pick(['Sunlit', 'Mossy', 'Hidden', 'Shaded', 'Quiet'])} Clearing`;
      case 'house':
        return `${this.rng.pick(['Cottage', 'Dwelling', 'House', 'Homestead'])}`;
      case 'hall':
        return `${this.rng.pick(DUNGEON_ADJECTIVES)} Hall`;
      case 'tower':
        return `${this.rng.pick(PREFIXES)} Tower`;
      case 'cellar':
        return `${this.rng.pick(['Damp', 'Dark', 'Cold', 'Dusty'])} Cellar`;
      case 'market':
        return `${this.rng.pick(PREFIXES)} Market`;
      case 'barracks':
        return `${this.rng.pick(['Guard', 'Militia', 'Watch', 'Garrison'])} Barracks`;
      case 'temple':
        return `${this.rng.pick(['Sacred', 'Holy', 'Blessed', 'Divine'])} Shrine`;
    }
  }

  private connectLocations(locations: Location[]): void {
    if (locations.length === 0) return;

    // Find the village (starting location)
    const village = locations.find((l) => l.locationType === 'village');
    const others = locations.filter((l) => l !== village);

    if (!village) {
      // Fallback: chain connect all locations
      for (let i = 0; i < locations.length - 1; i++) {
        this.connectTwo(locations[i], locations[i + 1]);
      }
      return;
    }

    // Connect village to wilderness locations
    const wilderness = others.filter((l) => l.locationType === 'wilderness');
    const dungeons = others.filter((l) =>
      l.locationType === 'dungeon' || l.locationType === 'cave',
    );
    const rest = others.filter(
      (l) => l.locationType !== 'wilderness' && l.locationType !== 'dungeon' && l.locationType !== 'cave',
    );

    // Village connects to all wilderness and ruins/camp
    for (const w of wilderness) {
      this.connectTwo(village, w);
    }
    for (const r of rest) {
      this.connectTwo(village, r);
    }

    // Wilderness connects to dungeons/caves
    for (const d of dungeons) {
      if (wilderness.length > 0) {
        const nearestWild = this.rng.pick(wilderness);
        this.connectTwo(nearestWild, d);
      } else {
        this.connectTwo(village, d);
      }
    }

    // Ensure full connectivity — connect any isolated nodes
    for (const loc of others) {
      if (loc.connections.length === 0) {
        this.connectTwo(village, loc);
      }
    }
  }

  private connectTwo(a: Location, b: Location): void {
    if (!a.connections.includes(b.id)) {
      a.connections.push(b.id);
    }
    if (!b.connections.includes(a.id)) {
      b.connections.push(a.id);
    }
  }
}
