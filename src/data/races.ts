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
  {
    id: 'half_elf',
    name: 'Half-Elf',
    description:
      'Half-elves combine what some say are the best qualities of their elf and human parents: human curiosity, inventiveness, and ambition tempered by the refined senses, love of nature, and artistic tastes of the elves.',
    abilityBonuses: {
      charisma: 2,
    },
    speed: 30,
    size: 'medium',
    languages: ['Common', 'Elvish', 'one additional language'],
    traits: [
      {
        name: 'Darkvision',
        description:
          'You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light.',
      },
      {
        name: 'Fey Ancestry',
        description:
          'You have advantage on saving throws against being charmed, and magic can\'t put you to sleep.',
      },
      {
        name: 'Skill Versatility',
        description:
          'You gain proficiency in two skills of your choice.',
      },
      {
        name: 'Ability Score Increase',
        description:
          'In addition to Charisma +2, two other ability scores of your choice each increase by 1.',
      },
    ],
  },
  {
    id: 'gnome',
    name: 'Gnome (Rock)',
    description:
      'A gnome\'s energy and enthusiasm for living shines through every inch of his or her tiny body. Rock gnomes are natural inventors and tinkerers, with a love for knowledge and discovery.',
    abilityBonuses: {
      intelligence: 2,
      constitution: 1,
    },
    speed: 25,
    size: 'small',
    languages: ['Common', 'Gnomish'],
    traits: [
      {
        name: 'Darkvision',
        description:
          'You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light.',
      },
      {
        name: 'Gnome Cunning',
        description:
          'You have advantage on all Intelligence, Wisdom, and Charisma saving throws against magic.',
      },
      {
        name: "Artificer's Lore",
        description:
          'Whenever you make an Intelligence (History) check related to magic items, alchemical objects, or technological devices, you can add twice your proficiency bonus, instead of any proficiency bonus you normally apply.',
      },
      {
        name: 'Tinker',
        description:
          'You have proficiency with artisan\'s tools (tinker\'s tools). Using those tools, you can spend 1 hour and 10 gp worth of materials to construct a Tiny clockwork device (AC 5, 1 hp).',
      },
    ],
    proficiencies: {
      tools: ["tinker's tools"],
    },
  },
  {
    id: 'dragonborn',
    name: 'Dragonborn',
    description:
      'Born of dragons, as their name proclaims, the dragonborn walk proudly through a world that greets them with fearful incomprehension. Shaped by draconic gods or the dragons themselves, dragonborn originally hatched from dragon eggs.',
    abilityBonuses: {
      strength: 2,
      charisma: 1,
    },
    speed: 30,
    size: 'medium',
    languages: ['Common', 'Draconic'],
    traits: [
      {
        name: 'Draconic Ancestry',
        description:
          'You have draconic ancestry. Choose one type of dragon from the Draconic Ancestry table. Your breath weapon and damage resistance are determined by the dragon type.',
      },
      {
        name: 'Breath Weapon',
        description:
          'You can use your action to exhale destructive energy. Your draconic ancestry determines the size, shape, and damage type of the exhalation. Each creature in the area must make a saving throw (DC = 8 + your Constitution modifier + your proficiency bonus). A creature takes 2d6 damage on a failed save, and half as much on a successful one. The damage increases to 3d6 at 6th level, 4d6 at 11th level, and 5d6 at 16th level. You can use this once per short or long rest.',
      },
      {
        name: 'Damage Resistance',
        description:
          'You have resistance to the damage type associated with your draconic ancestry.',
      },
    ],
  },
  {
    id: 'tiefling',
    name: 'Tiefling',
    description:
      'To be greeted with stares and whispers, to suffer violence and insult on the street, to see mistrust and fear in every eye: this is the lot of the tiefling. Their infernal heritage has left a clear imprint on their appearance.',
    abilityBonuses: {
      charisma: 2,
      intelligence: 1,
    },
    speed: 30,
    size: 'medium',
    languages: ['Common', 'Infernal'],
    traits: [
      {
        name: 'Darkvision',
        description:
          'You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light.',
      },
      {
        name: 'Hellish Resistance',
        description: 'You have resistance to fire damage.',
      },
      {
        name: 'Infernal Legacy',
        description:
          'You know the thaumaturgy cantrip. When you reach 3rd level, you can cast the hellish rebuke spell as a 2nd-level spell once with this trait and regain the ability to do so when you finish a long rest. When you reach 5th level, you can cast the darkness spell once with this trait and regain the ability to do so when you finish a long rest. Charisma is your spellcasting ability for these spells.',
      },
    ],
  },
];

export function getRace(id: string): RaceDefinition | undefined {
  return SRD_RACES.find((r) => r.id === id);
}
