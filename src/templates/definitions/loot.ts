import type { Template } from '@/types';

export const LOOT_TEMPLATES: Template[] = [
  {
    id: 'loot_low',
    type: 'loot',
    tags: ['low_level', 'cr0_4'],
    weight: 10,
    conditions: [
      { type: 'crRange', operator: 'gte', value: 0 },
      { type: 'crRange', operator: 'lte', value: 4 },
    ],
    variables: [
      {
        name: 'goldAmount',
        source: 'random',
        options: [0, 1, 2, 3, 5, 8],
      },
      {
        name: 'silverAmount',
        source: 'random',
        options: [0, 2, 5, 10, 15, 20],
      },
      {
        name: 'copperAmount',
        source: 'random',
        options: [0, 5, 10, 15, 20, 30, 50],
      },
    ],
    data: {
      name: 'Low-Level Loot',
      description: 'A modest collection of coins and perhaps a useful item.',
      coinRanges: {
        gold: { min: 0, max: 10 },
        silver: { min: 0, max: 30 },
        copper: { min: 0, max: 50 },
      },
      itemPool: [
        { itemId: 'item_healing_potion', chance: 0.15, maxQuantity: 1 },
        { itemId: 'item_torch', chance: 0.3, maxQuantity: 3 },
        { itemId: 'item_rations', chance: 0.25, maxQuantity: 2 },
        { itemId: 'item_dagger', chance: 0.1, maxQuantity: 1 },
        { itemId: 'item_shortsword', chance: 0.05, maxQuantity: 1 },
        { itemId: 'item_rope', chance: 0.1, maxQuantity: 1 },
      ],
      rarityWeights: {
        common: 85,
        uncommon: 14,
        rare: 1,
        very_rare: 0,
        legendary: 0,
      },
      narrativeHints: [
        { key: 'loot_found', tone: 'positive', context: { description: 'Among the remains you find a small cache of coins and supplies.' } },
        { key: 'loot_found', tone: 'positive', context: { description: 'A quick search yields a handful of coins and a few useful items.' } },
      ],
    },
  },
  {
    id: 'loot_mid',
    type: 'loot',
    tags: ['mid_level', 'cr5_10'],
    weight: 8,
    conditions: [
      { type: 'crRange', operator: 'gte', value: 5 },
      { type: 'crRange', operator: 'lte', value: 10 },
    ],
    variables: [
      {
        name: 'goldAmount',
        source: 'random',
        options: [10, 20, 30, 50, 75, 100],
      },
      {
        name: 'silverAmount',
        source: 'random',
        options: [10, 20, 30, 50],
      },
    ],
    data: {
      name: 'Mid-Level Loot',
      description: 'A respectable haul of gold and possibly an uncommon magic item.',
      coinRanges: {
        gold: { min: 10, max: 200 },
        silver: { min: 0, max: 100 },
        copper: { min: 0, max: 50 },
      },
      itemPool: [
        { itemId: 'item_healing_potion', chance: 0.3, maxQuantity: 2 },
        { itemId: 'item_greater_healing_potion', chance: 0.1, maxQuantity: 1 },
        { itemId: 'item_longsword', chance: 0.1, maxQuantity: 1 },
        { itemId: 'item_chain_shirt', chance: 0.05, maxQuantity: 1 },
        { itemId: 'item_studded_leather', chance: 0.08, maxQuantity: 1 },
        { itemId: 'item_rapier', chance: 0.07, maxQuantity: 1 },
      ],
      rarityWeights: {
        common: 50,
        uncommon: 35,
        rare: 14,
        very_rare: 1,
        legendary: 0,
      },
      narrativeHints: [
        { key: 'loot_found', tone: 'rewarding', context: { description: 'The creature\'s hoard contains a satisfying pile of gold coins and several items of quality.' } },
        { key: 'loot_found', tone: 'rewarding', context: { description: 'A thorough search reveals a well-hidden stash of valuables.' } },
      ],
    },
  },
  {
    id: 'loot_high',
    type: 'loot',
    tags: ['high_level', 'cr11_plus'],
    weight: 5,
    conditions: [
      { type: 'crRange', operator: 'gte', value: 11 },
    ],
    variables: [
      {
        name: 'goldAmount',
        source: 'random',
        options: [100, 200, 500, 750, 1000],
      },
    ],
    data: {
      name: 'High-Level Loot',
      description: 'A magnificent treasure hoard worthy of legend.',
      coinRanges: {
        gold: { min: 100, max: 2000 },
        silver: { min: 50, max: 500 },
        copper: { min: 0, max: 100 },
      },
      itemPool: [
        { itemId: 'item_greater_healing_potion', chance: 0.4, maxQuantity: 3 },
        { itemId: 'item_plate', chance: 0.05, maxQuantity: 1 },
        { itemId: 'item_greatsword', chance: 0.08, maxQuantity: 1 },
        { itemId: 'item_half_plate', chance: 0.07, maxQuantity: 1 },
      ],
      rarityWeights: {
        common: 20,
        uncommon: 30,
        rare: 35,
        very_rare: 12,
        legendary: 3,
      },
      narrativeHints: [
        { key: 'loot_found', tone: 'awe', context: { description: 'A king\'s ransom glitters before you — piles of gold, gleaming weapons, and items radiating palpable magical energy.' } },
        { key: 'loot_found', tone: 'triumph', context: { description: 'The treasure hoard is magnificent. Gold coins spill from overflowing chests, and rare magical items rest upon velvet cushions.' } },
      ],
    },
  },
];
