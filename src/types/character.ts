import type {
  Ability,
  ConditionType,
  Coordinate,
  DieType,
  Entity,
  EntityId,
  Skill,
} from './core';

/** All six ability scores mapped to their values */
export type AbilityScores = Record<Ability, number>;

/** Race identifier (e.g. 'human', 'elf', 'dwarf') */
export type RaceId = string;

/** Class identifier (e.g. 'fighter', 'wizard', 'rogue') */
export type ClassId = string;

/** Armor categories */
export type ArmorType = 'light' | 'medium' | 'heavy' | 'shield';

/** Weapon proficiency categories */
export type WeaponCategory = 'simple' | 'martial';

/** A single feature or trait granted by race, class, or feat */
export type FeatureInstance = {
  id: string;
  name: string;
  description: string;
  source: string;
  usesRemaining?: number;
  usesMax?: number;
  rechargeOn?: 'shortRest' | 'longRest';
};

/** A condition currently affecting a creature */
export type ActiveCondition = {
  type: ConditionType;
  duration?: number;
  source?: EntityId;
};

/** Epic boon gained at levels beyond 20 */
export type EpicBoon = {
  id: string;
  name: string;
  description: string;
  level: number;
};

/** Equipment slots a character can wear/wield */
export type EquipmentSlots = {
  mainHand: EntityId | null;
  offHand: EntityId | null;
  armor: EntityId | null;
  helmet: EntityId | null;
  cloak: EntityId | null;
  gloves: EntityId | null;
  boots: EntityId | null;
  ring1: EntityId | null;
  ring2: EntityId | null;
  amulet: EntityId | null;
  belt: EntityId | null;
};

/** Coins stored inside a container (purse, pouch, chest) */
export type PurseContents = {
  gold: number;
  silver: number;
  copper: number;
};

/** A single inventory stack */
export type InventoryEntry = {
  itemId: EntityId;
  quantity: number;
  /** Current charges for refillable items (e.g. waterskin) */
  charges?: number;
  /** Coins stored inside this container item */
  coins?: PurseContents;
};

/** Full inventory state */
export type Inventory = {
  items: InventoryEntry[];
  capacity: number;
  currentWeight: number;
  gold: number;
  silver: number;
  copper: number;
};

/** Spellcasting state for caster classes */
export type SpellcastingState = {
  ability: Ability;
  spellSlots: Record<number, { current: number; max: number }>;
  knownSpells: string[];
  preparedSpells: string[];
  concentration: string | null;
  cantripsKnown: string[];
};

/** Survival hunger thresholds */
export type HungerThreshold = 'satiated' | 'comfortable' | 'peckish' | 'hungry' | 'very_hungry' | 'famished' | 'starving';

/** Survival thirst thresholds */
export type ThirstThreshold = 'quenched' | 'hydrated' | 'mild_thirst' | 'thirsty' | 'very_thirsty' | 'parched' | 'dehydrated';

/** Survival fatigue thresholds */
export type FatigueThreshold = 'rested' | 'alert' | 'tired' | 'weary' | 'exhausted' | 'delirious';

/** Physical survival state tracking */
export type SurvivalState = {
  hunger: number;           // 0 (full) to 100 (starving)
  thirst: number;           // 0 (quenched) to 100 (dehydrated)
  fatigue: number;          // 0 (rested) to 100 (delirious)
  exhaustionLevel: number;  // 0-6, maps to D&D 5e exhaustion
};

/** The player character */
export interface Character extends Entity {
  type: 'character';
  name: string;
  race: RaceId;
  class: ClassId;
  level: number;
  xp: number;
  abilityScores: AbilityScores;
  maxHp: number;
  currentHp: number;
  tempHp: number;
  hitDice: {
    current: number;
    max: number;
    die: DieType;
  };
  armorClass: number;
  speed: number;
  proficiencyBonus: number;
  proficiencies: {
    skills: Skill[];
    savingThrows: Ability[];
    armor: ArmorType[];
    weapons: (WeaponCategory | string)[];
    tools: string[];
    languages: string[];
  };
  features: FeatureInstance[];
  inventory: Inventory;
  equipment: EquipmentSlots;
  /** Remaining charges for equipped charge-based items (e.g. torch in offHand). */
  equipmentCharges: Partial<Record<keyof EquipmentSlots, number>>;
  spellcasting: SpellcastingState | null;
  conditions: ActiveCondition[];
  deathSaves: {
    successes: number;
    failures: number;
  };
  position: Coordinate | null;
  initiative: number | null;
  epicBoons: EpicBoon[];
  survival: SurvivalState;
  /** Game round when the last long rest was completed (for 24-hour cooldown). */
  lastLongRestRound?: number;
  /** Set of item IDs whose curse has been revealed to this character */
  cursedItemsRevealed?: Record<EntityId, boolean>;
}
