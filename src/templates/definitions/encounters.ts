import type { Template } from '@/types';

export const ENCOUNTER_TEMPLATES: Template[] = [
  {
    id: 'encounter_goblin_ambush',
    type: 'encounter',
    tags: ['wilderness', 'forest', 'combat', 'low_level'],
    weight: 10,
    conditions: [
      { type: 'partyLevel', operator: 'gte', value: 1 },
      { type: 'partyLevel', operator: 'lte', value: 5 },
    ],
    variables: [
      {
        name: 'enemyCount',
        source: 'computed',
        compute: 'partySize + 1',
      },
      {
        name: 'monsterId',
        source: 'state',
        path: 'monsters.goblin',
      },
    ],
    data: {
      name: 'Goblin Ambush',
      description: 'A band of goblins springs from the underbrush, weapons drawn!',
      monsterIds: ['monster_goblin'],
      minEnemies: 2,
      maxEnemies: 6,
      crRange: [0.25, 3],
      lootTableId: 'loot_low',
      narrativeHints: [
        { key: 'ambush', tone: 'tense', context: { description: 'High-pitched cackling erupts from the bushes as small, green-skinned figures leap into view, brandishing rusty scimitars.' } },
      ],
    },
  },
  {
    id: 'encounter_skeleton_patrol',
    type: 'encounter',
    tags: ['dungeon', 'ruins', 'combat', 'undead', 'low_level'],
    weight: 10,
    conditions: [
      { type: 'partyLevel', operator: 'gte', value: 1 },
      { type: 'partyLevel', operator: 'lte', value: 5 },
    ],
    variables: [
      {
        name: 'enemyCount',
        source: 'computed',
        compute: 'partySize',
      },
    ],
    data: {
      name: 'Skeleton Patrol',
      description: 'The clatter of bones echoes through the corridor as undead sentinels approach.',
      monsterIds: ['monster_skeleton'],
      minEnemies: 2,
      maxEnemies: 5,
      crRange: [0.25, 3],
      lootTableId: 'loot_low',
      narrativeHints: [
        { key: 'undead', tone: 'eerie', context: { description: 'Bony fingers clutch rusted weapons as skeletal figures march toward you with empty, lifeless eye sockets.' } },
      ],
    },
  },
  {
    id: 'encounter_wolf_pack',
    type: 'encounter',
    tags: ['wilderness', 'forest', 'combat', 'beast', 'low_level'],
    weight: 8,
    conditions: [
      { type: 'partyLevel', operator: 'gte', value: 1 },
      { type: 'partyLevel', operator: 'lte', value: 3 },
    ],
    variables: [
      {
        name: 'enemyCount',
        source: 'computed',
        compute: 'partySize + 1',
      },
    ],
    data: {
      name: 'Wolf Pack',
      description: 'A pack of wolves circles you, their eyes gleaming in the dim light.',
      monsterIds: ['monster_wolf'],
      minEnemies: 3,
      maxEnemies: 6,
      crRange: [0.25, 2],
      lootTableId: null,
      narrativeHints: [
        { key: 'predators', tone: 'tense', context: { description: 'Low growls rumble from the shadows as a pack of wolves emerges, their silver fur bristling and fangs bared.' } },
      ],
    },
  },
  {
    id: 'encounter_bandit_roadblock',
    type: 'encounter',
    tags: ['road', 'wilderness', 'combat', 'humanoid', 'low_level'],
    weight: 8,
    conditions: [
      { type: 'partyLevel', operator: 'gte', value: 1 },
      { type: 'partyLevel', operator: 'lte', value: 4 },
    ],
    variables: [
      {
        name: 'enemyCount',
        source: 'computed',
        compute: 'partySize',
      },
    ],
    data: {
      name: 'Bandit Roadblock',
      description: 'Armed figures block the path ahead, demanding payment for passage.',
      monsterIds: ['monster_bandit'],
      minEnemies: 2,
      maxEnemies: 5,
      crRange: [0.125, 2],
      lootTableId: 'loot_low',
      narrativeHints: [
        { key: 'bandits', tone: 'threatening', context: { description: '"Your gold or your life!" snarls the lead bandit, stepping forward with a drawn blade.' } },
      ],
    },
  },
  {
    id: 'encounter_spider_nest',
    type: 'encounter',
    tags: ['cave', 'dungeon', 'combat', 'beast', 'mid_level'],
    weight: 7,
    conditions: [
      { type: 'partyLevel', operator: 'gte', value: 2 },
      { type: 'partyLevel', operator: 'lte', value: 6 },
    ],
    variables: [
      {
        name: 'enemyCount',
        source: 'computed',
        compute: 'Math.max(1, partySize - 1)',
      },
    ],
    data: {
      name: 'Spider Nest',
      description: 'Thick webs coat the walls and ceiling. You\'ve stumbled into a spider\'s lair.',
      monsterIds: ['monster_giant_spider'],
      minEnemies: 1,
      maxEnemies: 3,
      crRange: [1, 4],
      lootTableId: 'loot_low',
      narrativeHints: [
        { key: 'webbed', tone: 'creepy', context: { description: 'Sticky strands of webbing cling to everything. From above, multiple sets of gleaming eyes descend on silken threads.' } },
      ],
    },
  },
  {
    id: 'encounter_ogre_lair',
    type: 'encounter',
    tags: ['cave', 'wilderness', 'combat', 'giant', 'mid_level'],
    weight: 6,
    conditions: [
      { type: 'partyLevel', operator: 'gte', value: 3 },
      { type: 'partyLevel', operator: 'lte', value: 7 },
    ],
    variables: [
      {
        name: 'enemyCount',
        source: 'random',
        options: [1, 2],
      },
    ],
    data: {
      name: 'Ogre Lair',
      description: 'The stench of rotting meat fills the air. Something large lurks in the shadows.',
      monsterIds: ['monster_ogre'],
      minEnemies: 1,
      maxEnemies: 2,
      crRange: [2, 5],
      lootTableId: 'loot_mid',
      narrativeHints: [
        { key: 'ogre', tone: 'danger', context: { description: 'A massive, hulking form rises from behind a pile of gnawed bones. The ogre roars with fury at the intrusion.' } },
      ],
    },
  },
  {
    id: 'encounter_owlbear_territory',
    type: 'encounter',
    tags: ['forest', 'wilderness', 'combat', 'monstrosity', 'mid_level'],
    weight: 5,
    conditions: [
      { type: 'partyLevel', operator: 'gte', value: 3 },
      { type: 'partyLevel', operator: 'lte', value: 7 },
    ],
    variables: [
      {
        name: 'enemyCount',
        source: 'random',
        options: [1, 2],
      },
    ],
    data: {
      name: 'Owlbear Territory',
      description: 'A terrible screech pierces the air. You have entered an owlbear\'s hunting ground.',
      monsterIds: ['monster_owlbear'],
      minEnemies: 1,
      maxEnemies: 2,
      crRange: [3, 5],
      lootTableId: null,
      narrativeHints: [
        { key: 'owlbear', tone: 'danger', context: { description: 'With a screech that echoes through the trees, a feathered behemoth crashes through the undergrowth — part bear, part owl, and entirely furious.' } },
      ],
    },
  },
  {
    id: 'encounter_troll_bridge',
    type: 'encounter',
    tags: ['any', 'combat', 'giant', 'high_level'],
    weight: 4,
    conditions: [
      { type: 'partyLevel', operator: 'gte', value: 5 },
      { type: 'partyLevel', operator: 'lte', value: 10 },
    ],
    variables: [
      {
        name: 'enemyCount',
        source: 'random',
        options: [1],
      },
    ],
    data: {
      name: 'Troll Bridge',
      description: 'A bridge spans a dark chasm. Its self-appointed guardian demands tribute.',
      monsterIds: ['monster_troll'],
      minEnemies: 1,
      maxEnemies: 1,
      crRange: [5, 7],
      lootTableId: 'loot_mid',
      narrativeHints: [
        { key: 'troll', tone: 'menacing', context: { description: 'A towering troll rises from beneath the bridge, its rubbery green skin already healing from old wounds. "None shall pass," it growls, drool dripping from its fangs.' } },
      ],
    },
  },
  {
    id: 'encounter_bandit_captain',
    type: 'encounter',
    tags: ['road', 'wilderness', 'combat', 'humanoid', 'mid_level'],
    weight: 5,
    conditions: [
      { type: 'partyLevel', operator: 'gte', value: 3 },
      { type: 'partyLevel', operator: 'lte', value: 6 },
    ],
    variables: [
      {
        name: 'enemyCount',
        source: 'computed',
        compute: 'partySize + 2',
      },
    ],
    data: {
      name: 'Bandit Ambush',
      description: 'A well-organized band of bandits has set a cunning trap.',
      monsterIds: ['monster_bandit'],
      minEnemies: 3,
      maxEnemies: 8,
      crRange: [0.125, 4],
      lootTableId: 'loot_low',
      narrativeHints: [
        { key: 'organized_bandits', tone: 'threatening', context: { description: 'Figures emerge from concealment on all sides. This is no ragtag group — these bandits move with military precision.' } },
      ],
    },
  },
  {
    id: 'encounter_mixed_undead',
    type: 'encounter',
    tags: ['dungeon', 'ruins', 'cave', 'combat', 'undead', 'mid_level'],
    weight: 6,
    conditions: [
      { type: 'partyLevel', operator: 'gte', value: 2 },
      { type: 'partyLevel', operator: 'lte', value: 6 },
    ],
    variables: [
      {
        name: 'enemyCount',
        source: 'computed',
        compute: 'partySize + 1',
      },
    ],
    data: {
      name: 'Restless Dead',
      description: 'The dead do not rest easy in this forsaken place.',
      monsterIds: ['monster_skeleton'],
      minEnemies: 3,
      maxEnemies: 6,
      crRange: [0.25, 4],
      lootTableId: 'loot_low',
      narrativeHints: [
        { key: 'rising_dead', tone: 'horror', context: { description: 'The ground shifts and cracks. Skeletal hands claw their way free from the earth as the dead rise to defend their resting place.' } },
      ],
    },
  },
  {
    id: 'encounter_rat_swarm',
    type: 'encounter',
    tags: ['dungeon', 'cave', 'combat', 'beast', 'low_level'],
    weight: 8,
    conditions: [
      { type: 'partyLevel', operator: 'gte', value: 1 },
      { type: 'partyLevel', operator: 'lte', value: 3 },
    ],
    variables: [
      {
        name: 'enemyCount',
        source: 'computed',
        compute: 'partySize + 2',
      },
    ],
    data: {
      name: 'Rat Swarm',
      description: 'Dozens of red eyes gleam from the darkness as a swarm of giant rats surges forward.',
      monsterIds: ['monster_giant_rat'],
      minEnemies: 4,
      maxEnemies: 6,
      crRange: [0.125, 1],
      lootTableId: null,
      narrativeHints: [
        { key: 'rats', tone: 'disgust', context: { description: 'The chittering grows deafening as mangy, oversized rats pour from cracks in the walls, their yellowed teeth snapping with ravenous hunger.' } },
      ],
    },
  },
  {
    id: 'encounter_kobold_scouts',
    type: 'encounter',
    tags: ['cave', 'wilderness', 'dungeon', 'combat', 'humanoid', 'low_level'],
    weight: 8,
    conditions: [
      { type: 'partyLevel', operator: 'gte', value: 1 },
      { type: 'partyLevel', operator: 'lte', value: 3 },
    ],
    variables: [
      {
        name: 'enemyCount',
        source: 'computed',
        compute: 'partySize + 1',
      },
    ],
    data: {
      name: 'Kobold Scouts',
      description: 'Small, reptilian figures scurry between the rocks, hissing commands in Draconic.',
      monsterIds: ['monster_kobold'],
      minEnemies: 3,
      maxEnemies: 5,
      crRange: [0.125, 1],
      lootTableId: 'loot_low',
      narrativeHints: [
        { key: 'kobolds', tone: 'tense', context: { description: 'A high-pitched war cry echoes off the stone as scaly kobolds spring from their hiding places, their crude weapons raised with surprising coordination.' } },
      ],
    },
  },
  {
    id: 'encounter_walking_dead',
    type: 'encounter',
    tags: ['ruins', 'dungeon', 'combat', 'undead', 'low_level'],
    weight: 8,
    conditions: [
      { type: 'partyLevel', operator: 'gte', value: 1 },
      { type: 'partyLevel', operator: 'lte', value: 4 },
    ],
    variables: [
      {
        name: 'enemyCount',
        source: 'computed',
        compute: 'partySize',
      },
    ],
    data: {
      name: 'Walking Dead',
      description: 'The stench of decay fills the air as shambling corpses lurch from the shadows.',
      monsterIds: ['monster_zombie'],
      minEnemies: 2,
      maxEnemies: 4,
      crRange: [0.25, 2],
      lootTableId: null,
      narrativeHints: [
        { key: 'zombies', tone: 'horror', context: { description: 'A low, guttural moan rises from the darkness. Rotting hands drag decayed bodies forward — the dead walk, and they are hungry.' } },
      ],
    },
  },
];
