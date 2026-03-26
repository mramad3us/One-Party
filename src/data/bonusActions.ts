import type { DieType } from '@/types';

// ── Effect types ────────────────────────────────────────────────

export type HealEffect = {
  type: 'heal';
  dice: { count: number; die: DieType };
  /** If true, add entity level as bonus to the roll. */
  bonusPerLevel: boolean;
};

export type GrantActionEffect = {
  type: 'grant_action';
  /** Which action(s) this grants as a bonus action. */
  grantedAction: 'dash' | 'disengage' | 'hide';
};

export type BonusActionEffect = HealEffect | GrantActionEffect;

// ── Definition ──────────────────────────────────────────────────

/**
 * Static, data-driven definition of a class-granted bonus action.
 *
 * Each entry maps 1-to-1 with a FeatureInstance on the character.
 * Multiple entries can share the same `featureId` (e.g. Cunning Action
 * produces three separate bonus actions from one feature).
 */
export interface ClassBonusActionDef {
  /** Unique id for this specific bonus action (e.g. 'second_wind'). */
  id: string;
  /** Must match the FeatureInstance.id on the character. */
  featureId: string;
  name: string;
  description: string;
  /** Class that grants this. */
  classId: string;
  /** Minimum class level to gain this. */
  minLevel: number;
  /** How many times per rest (-1 = unlimited, per-turn). */
  usesPerRest: number;
  rechargeOn: 'shortRest' | 'longRest';
  effect: BonusActionEffect;
}

// ── Registry ────────────────────────────────────────────────────

export const CLASS_BONUS_ACTIONS: ClassBonusActionDef[] = [
  // ── Fighter ───────────────────────────────────────────────────
  {
    id: 'second_wind',
    featureId: 'feature_second_wind',
    name: 'Second Wind',
    description: 'Regain 1d10 + fighter level hit points.',
    classId: 'fighter',
    minLevel: 1,
    usesPerRest: 1,
    rechargeOn: 'shortRest',
    effect: { type: 'heal', dice: { count: 1, die: 10 }, bonusPerLevel: true },
  },

  // ── Rogue — Cunning Action ────────────────────────────────────
  {
    id: 'cunning_action_dash',
    featureId: 'feature_cunning_action',
    name: 'Cunning Action: Dash',
    description: 'Use your bonus action to Dash.',
    classId: 'rogue',
    minLevel: 2,
    usesPerRest: -1,
    rechargeOn: 'shortRest',
    effect: { type: 'grant_action', grantedAction: 'dash' },
  },
  {
    id: 'cunning_action_disengage',
    featureId: 'feature_cunning_action',
    name: 'Cunning Action: Disengage',
    description: 'Use your bonus action to Disengage.',
    classId: 'rogue',
    minLevel: 2,
    usesPerRest: -1,
    rechargeOn: 'shortRest',
    effect: { type: 'grant_action', grantedAction: 'disengage' },
  },
  {
    id: 'cunning_action_hide',
    featureId: 'feature_cunning_action',
    name: 'Cunning Action: Hide',
    description: 'Use your bonus action to Hide.',
    classId: 'rogue',
    minLevel: 2,
    usesPerRest: -1,
    rechargeOn: 'shortRest',
    effect: { type: 'grant_action', grantedAction: 'hide' },
  },

  // ── Barbarian — Rage ────────────────────────────────────────
  {
    id: 'rage',
    featureId: 'feature_rage',
    name: 'Rage',
    description: 'Enter a rage as a bonus action, gaining bonus melee damage, advantage on Strength checks/saves, and resistance to bludgeoning, piercing, and slashing damage.',
    classId: 'barbarian',
    minLevel: 1,
    usesPerRest: 2,       // 2 at level 1; increases at 3/6/12/17/20 — tracked via FeatureInstance.usesMax
    rechargeOn: 'longRest',
    effect: { type: 'grant_action', grantedAction: 'dash' }, // placeholder effect; rage is handled by combat system
  },

  // ── Bard — Bardic Inspiration ───────────────────────────────
  {
    id: 'bardic_inspiration',
    featureId: 'feature_bardic_inspiration',
    name: 'Bardic Inspiration',
    description: 'As a bonus action, grant one creature within 60 feet a Bardic Inspiration die they can add to an ability check, attack roll, or saving throw within the next 10 minutes.',
    classId: 'bard',
    minLevel: 1,
    usesPerRest: 1,       // CHA modifier uses; tracked via FeatureInstance.usesMax
    rechargeOn: 'longRest',
    effect: { type: 'grant_action', grantedAction: 'dash' }, // placeholder; inspiration is handled by combat system
  },

  // ── Monk — Flurry of Blows ──────────────────────────────────
  {
    id: 'flurry_of_blows',
    featureId: 'feature_ki',
    name: 'Flurry of Blows',
    description: 'Immediately after you take the Attack action, spend 1 ki point to make two unarmed strikes as a bonus action.',
    classId: 'monk',
    minLevel: 2,
    usesPerRest: -1,      // limited by ki points, not flat uses
    rechargeOn: 'shortRest',
    effect: { type: 'grant_action', grantedAction: 'dash' }, // placeholder; handled by combat system
  },
  {
    id: 'patient_defense',
    featureId: 'feature_ki',
    name: 'Patient Defense',
    description: 'Spend 1 ki point to take the Dodge action as a bonus action on your turn.',
    classId: 'monk',
    minLevel: 2,
    usesPerRest: -1,
    rechargeOn: 'shortRest',
    effect: { type: 'grant_action', grantedAction: 'disengage' }, // placeholder
  },
  {
    id: 'step_of_the_wind',
    featureId: 'feature_ki',
    name: 'Step of the Wind',
    description: 'Spend 1 ki point to take the Disengage or Dash action as a bonus action on your turn, and your jump distance is doubled for the turn.',
    classId: 'monk',
    minLevel: 2,
    usesPerRest: -1,
    rechargeOn: 'shortRest',
    effect: { type: 'grant_action', grantedAction: 'dash' },
  },

  // ── Monk — Martial Arts bonus unarmed strike ────────────────
  {
    id: 'martial_arts_strike',
    featureId: 'feature_martial_arts',
    name: 'Martial Arts: Unarmed Strike',
    description: 'When you use the Attack action with a monk weapon or unarmed strike, you can make one unarmed strike as a bonus action.',
    classId: 'monk',
    minLevel: 1,
    usesPerRest: -1,
    rechargeOn: 'shortRest',
    effect: { type: 'grant_action', grantedAction: 'dash' }, // placeholder
  },

  // ── Paladin — Lay on Hands (as bonus-action-like quick heal) is NOT a bonus action in 5e SRD; it's an action.
  // No standard paladin bonus actions beyond spells.

  // ── Ranger — Vanish ─────────────────────────────────────────
  {
    id: 'vanish',
    featureId: 'feature_vanish',
    name: 'Vanish',
    description: 'You can use the Hide action as a bonus action on your turn.',
    classId: 'ranger',
    minLevel: 14,
    usesPerRest: -1,
    rechargeOn: 'shortRest',
    effect: { type: 'grant_action', grantedAction: 'hide' },
  },

  // ── Sorcerer — Font of Magic (bonus action to convert slots/points) ─
  {
    id: 'font_of_magic_create_slot',
    featureId: 'feature_font_of_magic',
    name: 'Font of Magic: Create Spell Slot',
    description: 'As a bonus action, expend sorcery points to create a spell slot (2 points for 1st, 3 for 2nd, 5 for 3rd, 6 for 4th, 7 for 5th).',
    classId: 'sorcerer',
    minLevel: 2,
    usesPerRest: -1,
    rechargeOn: 'longRest',
    effect: { type: 'grant_action', grantedAction: 'dash' }, // placeholder
  },
  {
    id: 'font_of_magic_create_points',
    featureId: 'feature_font_of_magic',
    name: 'Font of Magic: Convert Spell Slot',
    description: 'As a bonus action, expend a spell slot to gain a number of sorcery points equal to the slot\'s level.',
    classId: 'sorcerer',
    minLevel: 2,
    usesPerRest: -1,
    rechargeOn: 'longRest',
    effect: { type: 'grant_action', grantedAction: 'dash' }, // placeholder
  },
];

/** Get all bonus action definitions for a given class at a given level. */
export function getBonusActionsForClass(classId: string, level: number): ClassBonusActionDef[] {
  return CLASS_BONUS_ACTIONS.filter(ba => ba.classId === classId && ba.minLevel <= level);
}

/** Get a single bonus action definition by id. */
export function getBonusAction(id: string): ClassBonusActionDef | undefined {
  return CLASS_BONUS_ACTIONS.find(ba => ba.id === id);
}
