import type {
  CoinValue,
  DamageRoll,
  Entity,
} from './core';
import type { ArmorType, WeaponCategory } from './character';

/** Item classification */
export type ItemType =
  | 'weapon'
  | 'armor'
  | 'potion'
  | 'scroll'
  | 'mundane'
  | 'wondrous'
  | 'ammunition'
  | 'tool'
  | 'food'
  | 'drink';

/** Magic item rarity tiers */
export type Rarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'very_rare'
  | 'legendary'
  | 'artifact';

/** Special weapon properties */
export type WeaponTag =
  | 'finesse'
  | 'light'
  | 'heavy'
  | 'two_handed'
  | 'versatile'
  | 'reach'
  | 'thrown'
  | 'loading'
  | 'ammunition'
  | 'special';

/** Properties specific to weapons */
export type WeaponProperties = {
  damage: DamageRoll;
  weaponType: WeaponCategory;
  range: 'melee' | 'ranged';
  reach: number;
  rangeNormal?: number;
  rangeLong?: number;
  tags: WeaponTag[];
  versatileDamage?: DamageRoll;
};

/** Properties specific to armor */
export type ArmorProperties = {
  baseAC: number;
  armorType: ArmorType;
  stealthDisadvantage: boolean;
  strengthRequired?: number;
  maxDexBonus?: number;
};

/** Properties specific to potions */
export type PotionProperties = {
  effect: string;
  healing?: DamageRoll;
};

/** Properties specific to consumables (food/drink) */
export type ConsumableProperties = {
  hungerReduction?: number;
  thirstReduction?: number;
  description?: string;
};

/** Union of all item-specific property types */
export type ItemProperties =
  | WeaponProperties
  | ArmorProperties
  | PotionProperties
  | ConsumableProperties
  | Record<string, unknown>;

/** A game item — weapon, armor, potion, or other object */
export interface Item extends Entity {
  type: 'item';
  name: string;
  itemType: ItemType;
  rarity: Rarity;
  weight: number;
  value: CoinValue;
  description: string;
  properties: ItemProperties;
  stackable: boolean;
  requiresAttunement: boolean;
}
