import type {
  Ability,
  ConditionType,
  DamageRoll,
} from './core';

/** Schools of magic */
export type SpellSchool =
  | 'abjuration'
  | 'conjuration'
  | 'divination'
  | 'enchantment'
  | 'evocation'
  | 'illusion'
  | 'necromancy'
  | 'transmutation';

/** Verbal, Somatic, Material components */
export type SpellComponent = 'V' | 'S' | 'M';

/** How a spell selects its targets */
export type SpellTargetType =
  | 'self'
  | 'touch'
  | 'single'
  | 'area'
  | 'cone'
  | 'line'
  | 'cube'
  | 'sphere'
  | 'cylinder';

/** How long a spell lasts */
export type SpellDuration = {
  type: 'instantaneous' | 'rounds' | 'minutes' | 'hours' | 'concentration';
  value?: number;
};

/** Mechanical effects of a spell */
export type SpellEffect = {
  damage?: DamageRoll;
  healing?: DamageRoll;
  condition?: ConditionType;
  savingThrow?: { ability: Ability; dc: number };
  areaSize?: number;
};

/** A spell definition from the SRD */
export type Spell = {
  id: string;
  name: string;
  /** 0 = cantrip, 1-9 = spell level */
  level: number;
  school: SpellSchool;
  castingTime: string;
  /** Range in feet. 0 = self, -1 = touch */
  range: number;
  components: SpellComponent[];
  materialComponent?: string;
  duration: SpellDuration;
  description: string;
  targetType: SpellTargetType;
  effects: SpellEffect[];
  ritual: boolean;
  /** Class names that have this spell on their list */
  classes: string[];
};
