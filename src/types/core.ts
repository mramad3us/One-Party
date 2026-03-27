// Core primitives used everywhere

/** Unique identifier generated via crypto.randomUUID() */
export type EntityId = string;

/** 2D coordinate on a grid */
export type Coordinate = { x: number; y: number };

/** Atomic time unit — 1 round = 6 seconds */
export type GameTime = { totalRounds: number };

/** Derived time breakdown from GameTime */
export type DerivedTime = {
  days: number;
  hours: number;
  minutes: number;
  rounds: number;
};

/** Time scale determines how many rounds pass per logical turn */
export type TimeScale = 'combat' | 'exploration' | 'travel' | 'rest';

/** Rounds per logical turn at each time scale */
export const TIME_SCALE_ROUNDS: Record<TimeScale, number> = {
  combat: 1,        // 6 seconds
  exploration: 100,  // 10 minutes
  travel: 6000,      // 1 hour
  rest: 48000,       // 8 hours
} as const;

/** Discriminated union for fallible operations */
export type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/** Standard polyhedral dice */
export type DieType = 4 | 6 | 8 | 10 | 12 | 20 | 100;

/** All 5e damage types */
export type DamageType =
  | 'slashing'
  | 'piercing'
  | 'bludgeoning'
  | 'fire'
  | 'cold'
  | 'lightning'
  | 'thunder'
  | 'poison'
  | 'acid'
  | 'necrotic'
  | 'radiant'
  | 'force'
  | 'psychic';

/** 5e creature sizes */
export type CreatureSize = 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';

/** The six ability scores */
export type Ability =
  | 'strength'
  | 'dexterity'
  | 'constitution'
  | 'intelligence'
  | 'wisdom'
  | 'charisma';

/** All 18 skills in 5e */
export type Skill =
  | 'acrobatics'
  | 'animal_handling'
  | 'arcana'
  | 'athletics'
  | 'deception'
  | 'history'
  | 'insight'
  | 'intimidation'
  | 'investigation'
  | 'medicine'
  | 'nature'
  | 'perception'
  | 'performance'
  | 'persuasion'
  | 'religion'
  | 'sleight_of_hand'
  | 'stealth'
  | 'survival';

/** All 5e conditions */
export type ConditionType =
  | 'blinded'
  | 'charmed'
  | 'deafened'
  | 'frightened'
  | 'grappled'
  | 'incapacitated'
  | 'invisible'
  | 'paralyzed'
  | 'petrified'
  | 'poisoned'
  | 'prone'
  | 'restrained'
  | 'stunned'
  | 'unconscious'
  | 'exhaustion';

/** Dice expression for damage */
export type DamageRoll = {
  count: number;
  die: DieType;
  type: DamageType;
  bonus?: number;
};

/** Entity classification */
export type EntityType = 'character' | 'npc' | 'item' | 'location' | 'quest';

/** Base interface for all identifiable game objects */
export interface Entity {
  id: EntityId;
  type: EntityType;
}

/** Callback to remove a subscription */
export type Unsubscribe = () => void;

/** Coin purse representation */
export type CoinValue = {
  gold: number;
  silver: number;
  copper: number;
};

/** In-game calendar for tracking time of day, date, etc. */
export type Calendar = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

/** Result of a dice roll with full detail */
export type DiceRollResult = {
  total: number;
  rolls: number[];
  modifier: number;
  isCritical: boolean;
  isFumble: boolean;
  advantage: boolean;
  disadvantage: boolean;
  description: string;
  /** Which die was rolled, for display (defaults to d20). */
  dieType?: DieType;
  /** Entity who made this roll — used to decide full-screen vs mini dice display. */
  rollerEntityId?: EntityId;
};
