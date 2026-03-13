import type { Template } from '@/types';

export const EVENT_TEMPLATES: Template[] = [
  {
    id: 'event_strange_sounds',
    type: 'event',
    tags: ['exploration', 'wilderness', 'dungeon', 'perception'],
    weight: 10,
    conditions: [],
    variables: [
      {
        name: 'perceptionDC',
        source: 'random',
        options: [10, 12, 14, 16],
      },
    ],
    data: {
      name: 'Strange Sounds',
      description: 'Unusual sounds echo from somewhere nearby.',
      outcomes: {
        success: {
          description: 'You identify the source of the noise.',
          possibleResults: ['encounter', 'loot', 'nothing'],
          weights: [0.3, 0.4, 0.3],
        },
        failure: {
          description: 'The sounds fade before you can pinpoint their origin.',
          possibleResults: ['ambush', 'nothing'],
          weights: [0.3, 0.7],
        },
      },
      narrativeHints: [
        { key: 'strange_sounds', tone: 'mysterious', context: { description: 'A faint scratching echoes from the darkness ahead. It could be anything — rodents, or something far worse.' } },
        { key: 'strange_sounds', tone: 'mysterious', context: { description: 'An eerie whistling sound drifts through the air, seeming to come from everywhere and nowhere at once.' } },
      ],
    },
  },
  {
    id: 'event_traveling_merchant',
    type: 'event',
    tags: ['travel', 'road', 'social', 'trade'],
    weight: 8,
    conditions: [],
    variables: [
      {
        name: 'merchantName',
        source: 'random',
        options: ['Barnabas the Peddler', 'Silk Mara', 'Old Gorm', 'Zara of the Road'],
      },
    ],
    data: {
      name: 'Traveling Merchant',
      description: 'A merchant with a laden pack mule approaches on the road.',
      interaction: 'trade',
      merchantInventory: ['item_healing_potion', 'item_torch', 'item_rations', 'item_rope'],
      priceMultiplier: 1.2,
      narrativeHints: [
        { key: 'merchant_arrives', tone: 'friendly', context: { description: '"Well met, traveler!" calls a figure leading a heavily laden mule. "Care to browse my wares? I carry supplies from distant lands."' } },
        { key: 'merchant_arrives', tone: 'friendly', context: { description: 'The jingle of bells announces a traveling merchant approaching from the opposite direction, their cart piled high with goods.' } },
      ],
    },
  },
  {
    id: 'event_weather_change',
    type: 'event',
    tags: ['travel', 'exploration', 'atmosphere'],
    weight: 12,
    conditions: [],
    variables: [
      {
        name: 'weatherType',
        source: 'random',
        options: ['rain', 'fog', 'wind', 'clear', 'storm', 'snow'],
      },
    ],
    data: {
      name: 'Weather Change',
      description: 'The weather shifts.',
      effects: {
        rain: { visibility: -1, mood: 'somber' },
        fog: { visibility: -2, mood: 'eerie' },
        wind: { visibility: 0, mood: 'restless' },
        clear: { visibility: 1, mood: 'hopeful' },
        storm: { visibility: -3, mood: 'ominous', hazard: true },
        snow: { visibility: -2, mood: 'bleak', hazard: true },
      },
      narrativeHints: [
        { key: 'weather_rain', tone: 'atmospheric', context: { description: 'Dark clouds gather overhead and a steady rain begins to fall, turning the trail to mud beneath your feet.' } },
        { key: 'weather_fog', tone: 'eerie', context: { description: 'A thick fog rolls in, reducing visibility to just a few yards and muffling all sound.' } },
        { key: 'weather_clear', tone: 'hopeful', context: { description: 'The clouds part and warm sunlight bathes the land. A gentle breeze carries the scent of wildflowers.' } },
        { key: 'weather_storm', tone: 'ominous', context: { description: 'Thunder rumbles in the distance as black clouds race across the sky. A storm is coming, and it will be fierce.' } },
      ],
    },
  },
  {
    id: 'event_ruins_discovered',
    type: 'event',
    tags: ['exploration', 'wilderness', 'discovery'],
    weight: 5,
    conditions: [],
    variables: [
      {
        name: 'ruinType',
        source: 'random',
        options: ['collapsed tower', 'overgrown foundation', 'ancient well', 'crumbling shrine'],
      },
    ],
    data: {
      name: 'Ruins Discovered',
      description: 'You stumble upon forgotten ruins half-hidden by vegetation.',
      reveals: 'sublocation',
      possibleContents: ['treasure', 'trap', 'creature', 'nothing'],
      narrativeHints: [
        { key: 'ruins', tone: 'discovery', context: { description: 'Pushing through thick brambles, you discover the crumbling remains of an ancient structure. Moss-covered stones and weathered carvings hint at a forgotten age.' } },
        { key: 'ruins', tone: 'discovery', context: { description: 'Hidden beneath centuries of overgrowth, the remnants of a once-proud building emerge from the forest floor. Who built this place, and why was it abandoned?' } },
      ],
    },
  },
  {
    id: 'event_wounded_traveler',
    type: 'event',
    tags: ['travel', 'road', 'social', 'moral_choice'],
    weight: 6,
    conditions: [],
    variables: [
      {
        name: 'travelerName',
        source: 'random',
        options: ['a wounded soldier', 'a battered merchant', 'a limping pilgrim', 'a bleeding scout'],
      },
    ],
    data: {
      name: 'Wounded Traveler',
      description: 'A wounded figure stumbles onto the road, calling for help.',
      choices: {
        help: {
          description: 'You stop to tend their wounds.',
          reward: 'information',
          dispositionChange: 5,
          timesCost: 100,
        },
        ignore: {
          description: 'You pass by without stopping.',
          reward: null,
          dispositionChange: -2,
        },
        rob: {
          description: 'You take advantage of their weakness.',
          reward: 'gold',
          dispositionChange: -10,
        },
      },
      narrativeHints: [
        { key: 'wounded', tone: 'sympathetic', context: { description: '"Please... help me," gasps a figure slumped against a tree, clutching a bloodied side. "Bandits... they took everything."' } },
        { key: 'wounded', tone: 'suspicious', context: { description: 'A figure staggers into view, covered in blood. They reach toward you with trembling hands. Is this a genuine plea for help, or a cleverly laid trap?' } },
      ],
    },
  },
  {
    id: 'event_ancient_shrine',
    type: 'event',
    tags: ['exploration', 'wilderness', 'divine', 'risk_reward'],
    weight: 5,
    conditions: [],
    variables: [
      {
        name: 'deity',
        source: 'random',
        options: ['a forgotten sun god', 'a nature spirit', 'an ancient war deity', 'a trickster god'],
      },
    ],
    data: {
      name: 'Ancient Shrine',
      description: 'An ancient shrine stands in a clearing, still radiating faint power.',
      interaction: 'pray',
      outcomes: {
        pray: {
          blessing: { effect: 'temporary_hp', amount: 5, description: 'A warm light washes over you, filling you with renewed vigor.' },
          curse: { effect: 'disadvantage_next', description: 'A chill runs down your spine. The deity is not pleased with your offering.' },
          blessingChance: 0.7,
        },
        ignore: {
          description: 'You leave the shrine undisturbed.',
        },
      },
      narrativeHints: [
        { key: 'shrine', tone: 'mystical', context: { description: 'Weathered stone pillars surround a mossy altar where faded offerings of flowers and coin still lie. A faint hum of power lingers in the air, as if the old gods still watch this place.' } },
        { key: 'shrine', tone: 'divine', context: { description: 'A shaft of golden light illuminates an ancient stone altar carved with symbols you cannot quite decipher. The air feels charged, as if awaiting a prayer.' } },
      ],
    },
  },
  {
    id: 'event_natural_hazard',
    type: 'event',
    tags: ['travel', 'exploration', 'hazard'],
    weight: 7,
    conditions: [],
    variables: [
      {
        name: 'hazardType',
        source: 'random',
        options: ['rockslide', 'quicksand', 'fallen tree', 'sinkhole'],
      },
      {
        name: 'saveDC',
        source: 'random',
        options: [10, 12, 14],
      },
    ],
    data: {
      name: 'Natural Hazard',
      description: 'A natural hazard blocks or threatens your path.',
      saveType: 'dexterity',
      failureDamage: { count: 1, die: 6, type: 'bludgeoning' },
      narrativeHints: [
        { key: 'hazard', tone: 'danger', context: { description: 'The ground shifts beneath your feet! Loose rocks tumble from above as the earth gives way.' } },
        { key: 'hazard', tone: 'warning', context: { description: 'You notice the ground ahead looks unstable. One wrong step could spell disaster.' } },
      ],
    },
  },
  {
    id: 'event_campfire_remains',
    type: 'event',
    tags: ['exploration', 'wilderness', 'clue'],
    weight: 8,
    conditions: [],
    variables: [
      {
        name: 'age',
        source: 'random',
        options: ['fresh', 'recent', 'old', 'ancient'],
      },
    ],
    data: {
      name: 'Abandoned Campfire',
      description: 'The remains of a campfire mark where someone stopped to rest.',
      investigation: {
        dc: 12,
        successInfo: 'You can determine who was here and when.',
        failureInfo: 'The remains tell you little.',
      },
      narrativeHints: [
        { key: 'campfire', tone: 'curious', context: { description: 'A ring of stones surrounds the charred remains of a campfire. Nearby, you spot bootprints in the soft earth.' } },
      ],
    },
  },
];
