import type {
  Ability,
  ConditionType,
  Coordinate,
  CreatureSize,
  DamageRoll,
  DamageType,
  Entity,
  EntityId,
  GameTime,
} from './core';
import type {
  AbilityScores,
  ActiveCondition,
  FeatureInstance,
  SpellcastingState,
} from './character';

/** Roles an NPC can fill in the world */
export type NPCRole =
  | 'innkeeper'
  | 'guard'
  | 'merchant'
  | 'quest_giver'
  | 'companion'
  | 'hostile'
  | 'commoner'
  | 'noble'
  | 'priest'
  | 'blacksmith';

/** A tracked goal for an NPC */
export type Goal = {
  id: string;
  description: string;
  priority: number;
  progress: number;
  completed: boolean;
};

/** How an NPC feels about other entities (-100 hostile to +100 friendly) */
export type DispositionMap = Map<EntityId, number>;

/** Something the NPC remembers */
export type NPCMemoryEntry = {
  timestamp: GameTime;
  event: string;
  sentiment: number;
  details: Record<string, unknown>;
};

/** How the NPC behaves in combat */
export type CombatPreferences = {
  /** 0 = defensive/cautious, 1 = reckless aggression */
  aggression: number;
  /** Prefer to attack already-damaged targets */
  focusDamaged: boolean;
  /** Position to protect allied combatants */
  protectAllies: boolean;
  /** Preferred engagement range */
  preferredRange: 'melee' | 'ranged' | 'mixed';
  /** How to prioritize spell selection */
  spellPriority: 'damage' | 'control' | 'support' | 'balanced';
};

/** Strategy for automatic level-up decisions */
export type LevelUpStrategy = {
  preferredAbilities: Ability[];
  preferredFeats: string[];
  spellPreference: 'offensive' | 'defensive' | 'utility' | 'balanced';
};

/** Data exclusive to companion NPCs */
export type CompanionData = {
  personality: {
    traits: string[];
    bonds: string[];
    ideals: string[];
    flaws: string[];
  };
  goals: {
    shortTerm: Goal[];
    longTerm: Goal[];
  };
  disposition: DispositionMap;
  memory: NPCMemoryEntry[];
  combatPreferences: CombatPreferences;
  levelUpStrategy: LevelUpStrategy;
};

/** A single attack a creature can make */
export type AttackDefinition = {
  name: string;
  toHitBonus: number;
  damage: DamageRoll;
  reach: number;
  rangeNormal?: number;
  rangeLong?: number;
  additionalEffects?: string[];
};

/** Full stat block for any creature (NPC or monster) */
export type CreatureStatBlock = {
  abilityScores: AbilityScores;
  maxHp: number;
  currentHp: number;
  armorClass: number;
  speed: number;
  level: number;
  attacks: AttackDefinition[];
  spellcasting: SpellcastingState | null;
  features: FeatureInstance[];
  conditions: ActiveCondition[];
  size: CreatureSize;
  resistances: DamageType[];
  immunities: DamageType[];
  vulnerabilities: DamageType[];
  conditionImmunities: ConditionType[];
};

/** A non-player character in the world */
export interface NPC extends Entity {
  type: 'npc';
  templateId: string;
  name: string;
  role: NPCRole;
  locationId: EntityId;
  isAwakened: boolean;
  stats: CreatureStatBlock;
  companion: CompanionData | null;
  position: Coordinate | null;
  initiative: number | null;
}
