export interface EpicBoonDefinition {
  id: string;
  name: string;
  description: string;
  minLevel: number;
  prerequisites?: string[];
}

export const EPIC_BOONS: EpicBoonDefinition[] = [
  {
    id: 'boon_high_magic',
    name: 'Boon of High Magic',
    description: 'You gain one 9th-level spell slot, provided you already have at least one 9th-level spell slot.',
    minLevel: 21,
    prerequisites: ['spellcasting'],
  },
  {
    id: 'boon_combat_prowess',
    name: 'Boon of Combat Prowess',
    description: 'When you miss with a melee weapon attack, you can choose to hit instead. Once you use this boon, you can\'t use it again until you finish a short rest.',
    minLevel: 21,
  },
  {
    id: 'boon_spell_recall',
    name: 'Boon of Spell Recall',
    description: 'You can cast any spell you know or have prepared without expending a spell slot. Once you do so, you can\'t use this boon again until you finish a long rest.',
    minLevel: 21,
    prerequisites: ['spellcasting'],
  },
  {
    id: 'boon_fate',
    name: 'Boon of Fate',
    description: 'When another creature that you can see within 60 feet of you makes an ability check, an attack roll, or a saving throw, you can roll a d10 and apply the result as a bonus or penalty to the roll. Once you use this boon, you can\'t use it again until you finish a short rest.',
    minLevel: 21,
  },
  {
    id: 'boon_fortitude',
    name: 'Boon of Fortitude',
    description: 'Your hit point maximum increases by 40.',
    minLevel: 21,
  },
  {
    id: 'boon_dimensional_travel',
    name: 'Boon of Dimensional Travel',
    description: 'As an action, you can cast the misty step spell without expending a spell slot. Once you do so, you can\'t use this boon again until you finish a short rest.',
    minLevel: 25,
  },
  {
    id: 'boon_irresistible_offense',
    name: 'Boon of Irresistible Offense',
    description: 'You can bypass the damage resistances of any creature.',
    minLevel: 25,
  },
  {
    id: 'boon_immortality',
    name: 'Boon of Immortality',
    description: 'You stop aging. You are immune to any effect that would age you, and you can\'t die from old age.',
    minLevel: 30,
  },
  {
    id: 'boon_invincibility',
    name: 'Boon of Invincibility',
    description: 'When you take damage from any source, you can reduce that damage to 0. Once you use this boon, you can\'t use it again until you finish a short rest.',
    minLevel: 30,
  },
  {
    id: 'boon_perfect_health',
    name: 'Boon of Perfect Health',
    description: 'You are immune to all diseases and poisons, and you have advantage on Constitution saving throws.',
    minLevel: 25,
  },
];

/**
 * Get epic progression data for a given level (works for any level, but primarily for 21+).
 * Proficiency bonus continues the pattern: +7 at 21-24, +8 at 25-28, etc.
 * ASI every 4 levels (24, 28, 32, ...).
 * Epic boon every 5 levels (25, 30, 35, ...).
 */
export function getEpicProgressionForLevel(level: number): {
  proficiencyBonus: number;
  asiAvailable: boolean;
  boonAvailable: boolean;
} {
  const proficiencyBonus = Math.floor((level - 1) / 4) + 2;
  const asiAvailable = level >= 21 && level % 4 === 0;
  const boonAvailable = level >= 21 && level % 5 === 0;
  return { proficiencyBonus, asiAvailable, boonAvailable };
}

export function getAvailableBoons(level: number): EpicBoonDefinition[] {
  return EPIC_BOONS.filter((b) => b.minLevel <= level);
}
