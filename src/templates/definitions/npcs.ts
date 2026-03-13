import type { Template } from '@/types';

export const NPC_TEMPLATES: Template[] = [
  {
    id: 'npc_innkeeper',
    type: 'npc',
    tags: ['village', 'town', 'city', 'social', 'trade'],
    weight: 10,
    conditions: [],
    variables: [],
    data: {
      role: 'innkeeper',
      levelRange: [1, 3],
      defaultDisposition: 20,
      personality: {
        traits: ['Jovial and welcoming', 'Knows all the local gossip'],
        dialogue: {
          greeting: [
            'Welcome to my establishment! Sit down and rest your weary bones.',
            'Ah, a new face! What can I get for you, friend?',
          ],
          farewell: [
            'Come back anytime!',
            'Safe travels, friend.',
          ],
          topics: ['rumors', 'lodging', 'food', 'directions'],
        },
      },
      stats: {
        strength: 10,
        dexterity: 10,
        constitution: 12,
        intelligence: 11,
        wisdom: 13,
        charisma: 14,
      },
      services: ['rest', 'food', 'information'],
    },
  },
  {
    id: 'npc_guard',
    type: 'npc',
    tags: ['village', 'town', 'city', 'military'],
    weight: 10,
    conditions: [],
    variables: [],
    data: {
      role: 'guard',
      levelRange: [1, 5],
      defaultDisposition: 10,
      personality: {
        traits: ['Dutiful and alert', 'Suspicious of strangers'],
        dialogue: {
          greeting: [
            'Move along, citizen.',
            'Keep out of trouble.',
            'State your business, stranger.',
          ],
          farewell: [
            'Stay out of trouble.',
            'Keep to the main roads.',
          ],
          topics: ['directions', 'law', 'threats'],
        },
      },
      stats: {
        strength: 14,
        dexterity: 12,
        constitution: 14,
        intelligence: 10,
        wisdom: 12,
        charisma: 10,
      },
      equipment: ['longsword', 'chain_mail', 'shield'],
    },
  },
  {
    id: 'npc_merchant',
    type: 'npc',
    tags: ['village', 'town', 'city', 'trade'],
    weight: 10,
    conditions: [],
    variables: [],
    data: {
      role: 'merchant',
      levelRange: [1, 3],
      defaultDisposition: 20,
      personality: {
        traits: ['Shrewd and calculating', 'Always looking for a deal'],
        dialogue: {
          greeting: [
            'Fine wares for sale! Take a look!',
            'Looking to buy or sell? You\'ve come to the right place.',
          ],
          farewell: [
            'Pleasure doing business!',
            'Come back when your coin purse is heavier!',
          ],
          topics: ['trade', 'rumors', 'prices'],
        },
      },
      stats: {
        strength: 8,
        dexterity: 10,
        constitution: 10,
        intelligence: 14,
        wisdom: 12,
        charisma: 15,
      },
      services: ['buy', 'sell', 'appraise'],
    },
  },
  {
    id: 'npc_quest_giver',
    type: 'npc',
    tags: ['village', 'town', 'city', 'quest'],
    weight: 8,
    conditions: [],
    variables: [],
    data: {
      role: 'quest_giver',
      levelRange: [1, 5],
      defaultDisposition: 30,
      personality: {
        traits: ['Concerned about local troubles', 'Desperate for help'],
        dialogue: {
          greeting: [
            'You look capable. I might have work for you.',
            'Thank the gods — an adventurer! I need your help.',
          ],
          farewell: [
            'I\'m counting on you.',
            'May fortune favor you.',
          ],
          topics: ['quests', 'rewards', 'threats', 'history'],
        },
      },
      stats: {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 13,
        wisdom: 14,
        charisma: 12,
      },
      questTypes: ['fetch', 'kill', 'escort', 'investigate'],
    },
  },
  {
    id: 'npc_commoner',
    type: 'npc',
    tags: ['village', 'town', 'city', 'social'],
    weight: 15,
    conditions: [],
    variables: [],
    data: {
      role: 'commoner',
      levelRange: [1, 1],
      defaultDisposition: 10,
      personality: {
        traits: ['Going about daily life', 'Curious about adventurers'],
        dialogue: {
          greeting: [
            'Good day to you.',
            'Haven\'t seen you around here before.',
            'Beautiful day, isn\'t it?',
          ],
          farewell: [
            'Take care now.',
            'Gods be with you.',
          ],
          topics: ['rumors', 'weather', 'local_news'],
        },
      },
      stats: {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      },
    },
  },
  {
    id: 'npc_noble',
    type: 'npc',
    tags: ['town', 'city', 'castle', 'social', 'quest'],
    weight: 4,
    conditions: [],
    variables: [],
    data: {
      role: 'noble',
      levelRange: [1, 3],
      defaultDisposition: 0,
      personality: {
        traits: ['Haughty and self-important', 'Expects deference'],
        dialogue: {
          greeting: [
            'I trust you have business here?',
            'You may address me.',
          ],
          farewell: [
            'You are dismissed.',
            'Do try not to make a mess of things.',
          ],
          topics: ['politics', 'history', 'quests', 'trade'],
        },
      },
      stats: {
        strength: 10,
        dexterity: 12,
        constitution: 10,
        intelligence: 14,
        wisdom: 14,
        charisma: 16,
      },
    },
  },
  {
    id: 'npc_priest',
    type: 'npc',
    tags: ['village', 'town', 'city', 'temple', 'social', 'healing'],
    weight: 6,
    conditions: [],
    variables: [],
    data: {
      role: 'priest',
      levelRange: [2, 5],
      defaultDisposition: 30,
      personality: {
        traits: ['Serene and compassionate', 'Devoted to their faith'],
        dialogue: {
          greeting: [
            'May the light guide your path, child.',
            'Welcome to this sacred place. How may I serve you?',
          ],
          farewell: [
            'Go with the blessing of the divine.',
            'May your journey be watched over.',
          ],
          topics: ['healing', 'blessings', 'history', 'undead'],
        },
      },
      stats: {
        strength: 10,
        dexterity: 10,
        constitution: 12,
        intelligence: 12,
        wisdom: 16,
        charisma: 14,
      },
      services: ['healing', 'remove_curse', 'bless'],
    },
  },
  {
    id: 'npc_blacksmith',
    type: 'npc',
    tags: ['village', 'town', 'city', 'trade', 'crafting'],
    weight: 8,
    conditions: [],
    variables: [],
    data: {
      role: 'blacksmith',
      levelRange: [2, 4],
      defaultDisposition: 15,
      personality: {
        traits: ['Gruff but fair', 'Takes pride in craftsmanship'],
        dialogue: {
          greeting: [
            'Need something forged? You\'ve come to the right place.',
            'Step closer. What do you need?',
          ],
          farewell: [
            'Good steel keeps you alive. Remember that.',
            'Come back if anything needs mending.',
          ],
          topics: ['weapons', 'armor', 'repairs', 'trade'],
        },
      },
      stats: {
        strength: 16,
        dexterity: 10,
        constitution: 14,
        intelligence: 11,
        wisdom: 10,
        charisma: 10,
      },
      services: ['repair', 'buy_weapons', 'buy_armor', 'sell'],
    },
  },
];
