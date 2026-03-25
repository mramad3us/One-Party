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
];

/** Get all bonus action definitions for a given class at a given level. */
export function getBonusActionsForClass(classId: string, level: number): ClassBonusActionDef[] {
  return CLASS_BONUS_ACTIONS.filter(ba => ba.classId === classId && ba.minLevel <= level);
}

/** Get a single bonus action definition by id. */
export function getBonusAction(id: string): ClassBonusActionDef | undefined {
  return CLASS_BONUS_ACTIONS.find(ba => ba.id === id);
}
