import type { AbilityScores, CreatureSize, Skill } from '@/types';

export interface RaceDefinition {
  id: string;
  name: string;
  description: string;
  abilityBonuses: Partial<AbilityScores>;
  speed: number;
  size: CreatureSize;
  languages: string[];
  traits: { name: string; description: string }[];
  proficiencies?: {
    weapons?: string[];
    armor?: string[];
    skills?: Skill[];
    tools?: string[];
  };
}

export const SRD_RACES: RaceDefinition[] = [
  {
    id: 'human',
    name: 'Human',
    description:
      'Humans are the most adaptable and ambitious people among the common races. Whatever drives them, humans are the innovators, the achievers, and the pioneers of the worlds.',
    abilityBonuses: {
      strength: 1,
      dexterity: 1,
      constitution: 1,
      intelligence: 1,
      wisdom: 1,
      charisma: 1,
    },
    speed: 30,
    size: 'medium',
    languages: ['Common', 'one additional language'],
    traits: [
      {
        name: 'Versatile',
        description: 'Humans gain +1 to all ability scores.',
      },
    ],
  },
  {
    id: 'elf',
    name: 'Elf (High)',
    description:
      'Elves are a magical people of otherworldly grace, living in the world but not entirely part of it. High elves have a keen mind and a mastery of at least the basics of magic.',
    abilityBonuses: {
      dexterity: 2,
      intelligence: 1,
    },
    speed: 30,
    size: 'medium',
    languages: ['Common', 'Elvish'],
    traits: [
      {
        name: 'Darkvision',
        description:
          'You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light.',
      },
      {
        name: 'Keen Senses',
        description: 'You have proficiency in the Perception skill.',
      },
      {
        name: 'Fey Ancestry',
        description:
          'You have advantage on saving throws against being charmed, and magic can\'t put you to sleep.',
      },
      {
        name: 'Trance',
        description:
          'Elves do not need to sleep. Instead, they meditate deeply for 4 hours a day. After resting in this way, you gain the same benefit that a human does from 8 hours of sleep.',
      },
      {
        name: 'Cantrip',
        description:
          'You know one cantrip of your choice from the wizard spell list. Intelligence is your spellcasting ability for it.',
      },
    ],
    proficiencies: {
      weapons: ['longsword', 'shortsword', 'shortbow', 'longbow'],
      skills: ['perception'],
    },
  },
  {
    id: 'dwarf',
    name: 'Dwarf (Hill)',
    description:
      'Bold and hardy, dwarves are known as skilled warriors, miners, and workers of stone and metal. Hill dwarves have keen senses, deep intuition, and remarkable resilience.',
    abilityBonuses: {
      constitution: 2,
      wisdom: 1,
    },
    speed: 25,
    size: 'medium',
    languages: ['Common', 'Dwarvish'],
    traits: [
      {
        name: 'Darkvision',
        description:
          'You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light.',
      },
      {
        name: 'Dwarven Resilience',
        description:
          'You have advantage on saving throws against poison, and you have resistance against poison damage.',
      },
      {
        name: 'Stonecunning',
        description:
          'Whenever you make an Intelligence (History) check related to the origin of stonework, you are considered proficient and add double your proficiency bonus.',
      },
      {
        name: 'Dwarven Toughness',
        description:
          'Your hit point maximum increases by 1, and it increases by 1 every time you gain a level.',
      },
    ],
    proficiencies: {
      weapons: ['battleaxe', 'handaxe', 'light hammer', 'warhammer'],
      tools: ["smith's tools", "brewer's supplies", "mason's tools"],
    },
  },
  {
    id: 'halfling',
    name: 'Halfling (Lightfoot)',
    description:
      'The diminutive halflings survive in a world full of larger creatures by avoiding notice or, barring that, avoiding offense. Lightfoot halflings are adept at blending into the crowd.',
    abilityBonuses: {
      dexterity: 2,
      charisma: 1,
    },
    speed: 25,
    size: 'small',
    languages: ['Common', 'Halfling'],
    traits: [
      {
        name: 'Lucky',
        description:
          'When you roll a 1 on the d20 for an attack roll, ability check, or saving throw, you can reroll the die and must use the new roll.',
      },
      {
        name: 'Brave',
        description: 'You have advantage on saving throws against being frightened.',
      },
      {
        name: 'Halfling Nimbleness',
        description:
          'You can move through the space of any creature that is of a size larger than yours.',
      },
      {
        name: 'Naturally Stealthy',
        description:
          'You can attempt to hide even when you are obscured only by a creature that is at least one size larger than you.',
      },
    ],
  },
  {
    id: 'half_orc',
    name: 'Half-Orc',
    description:
      'Half-orcs\' grayish pigmentation, sloping foreheads, jutting jaws, prominent teeth, and towering builds make their orcish heritage plain for all to see. They combine the best qualities of humans and orcs.',
    abilityBonuses: {
      strength: 2,
      constitution: 1,
    },
    speed: 30,
    size: 'medium',
    languages: ['Common', 'Orc'],
    traits: [
      {
        name: 'Darkvision',
        description:
          'You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light.',
      },
      {
        name: 'Menacing',
        description: 'You gain proficiency in the Intimidation skill.',
      },
      {
        name: 'Relentless Endurance',
        description:
          'When you are reduced to 0 hit points but not killed outright, you can drop to 1 hit point instead. You can\'t use this feature again until you finish a long rest.',
      },
      {
        name: 'Savage Attacks',
        description:
          'When you score a critical hit with a melee weapon attack, you can roll one of the weapon\'s damage dice one additional time and add it to the extra damage of the critical hit.',
      },
    ],
    proficiencies: {
      skills: ['intimidation'],
    },
  },
];

export function getRace(id: string): RaceDefinition | undefined {
  return SRD_RACES.find((r) => r.id === id);
}
