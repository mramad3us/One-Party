import type { Ability, ArmorType, DieType, Skill, WeaponCategory } from '@/types';

export interface ClassDefinition {
  id: string;
  name: string;
  description: string;
  hitDie: DieType;
  primaryAbility: Ability;
  savingThrows: Ability[];
  armorProficiencies: ArmorType[];
  weaponProficiencies: WeaponCategory[];
  skillChoices: { choose: number; from: Skill[] };
  startingEquipment: string[];
  features: { level: number; name: string; description: string }[];
  spellcasting?: {
    ability: Ability;
    cantripsKnown: number[];
    spellSlots: Record<number, number[]>;
  };
}

export const SRD_CLASSES: ClassDefinition[] = [
  {
    id: 'fighter',
    name: 'Fighter',
    description:
      'A master of martial combat, skilled with a variety of weapons and armor. Fighters learn the basics of all combat styles and can use any weapon or armor.',
    hitDie: 10,
    primaryAbility: 'strength',
    savingThrows: ['strength', 'constitution'],
    armorProficiencies: ['light', 'medium', 'heavy', 'shield'],
    weaponProficiencies: ['simple', 'martial'],
    skillChoices: {
      choose: 2,
      from: [
        'acrobatics', 'animal_handling', 'athletics', 'history',
        'insight', 'intimidation', 'perception', 'survival',
      ],
    },
    startingEquipment: ['item_chain_mail', 'item_longsword', 'item_shield', 'item_light_crossbow', 'item_backpack'],
    features: [
      { level: 1, name: 'Fighting Style', description: 'You adopt a particular style of fighting as your specialty. Choose one: Defense (+1 AC in armor), Dueling (+2 damage one-handed), Great Weapon Fighting (reroll 1s and 2s on damage with two-handed), or Two-Weapon Fighting (add ability modifier to off-hand damage).' },
      { level: 1, name: 'Second Wind', description: 'You have a limited well of stamina. On your turn, you can use a bonus action to regain hit points equal to 1d10 + your fighter level. Once you use this feature, you must finish a short or long rest before you can use it again.' },
      { level: 2, name: 'Action Surge', description: 'You can push yourself beyond your normal limits for a moment. On your turn, you can take one additional action. Once you use this feature, you must finish a short or long rest before you can use it again. Starting at 17th level, you can use it twice before a rest.' },
      { level: 3, name: 'Martial Archetype', description: 'You choose an archetype that you strive to emulate in your combat styles and techniques, such as Champion.' },
      { level: 5, name: 'Extra Attack', description: 'You can attack twice, instead of once, whenever you take the Attack action on your turn. The number of attacks increases to three at 11th level and four at 20th level.' },
      { level: 9, name: 'Indomitable', description: 'You can reroll a saving throw that you fail. If you do so, you must use the new roll. You can use this feature once between long rests. You gain additional uses at 13th and 17th level.' },
    ],
  },
  {
    id: 'wizard',
    name: 'Wizard',
    description:
      'A scholarly magic-user capable of manipulating the structures of reality. Wizards are supreme magic-users, defined and united as a class by the spells they cast.',
    hitDie: 6,
    primaryAbility: 'intelligence',
    savingThrows: ['intelligence', 'wisdom'],
    armorProficiencies: [],
    weaponProficiencies: ['simple'],
    skillChoices: {
      choose: 2,
      from: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'religion'],
    },
    startingEquipment: ['item_quarterstaff', 'item_backpack'],
    features: [
      { level: 1, name: 'Arcane Recovery', description: 'Once per day when you finish a short rest, you can choose expended spell slots to recover. The spell slots can have a combined level that is equal to or less than half your wizard level (rounded up), and none of the slots can be 6th level or higher.' },
      { level: 2, name: 'Arcane Tradition', description: 'You choose an arcane tradition, shaping your practice of magic, such as the School of Evocation.' },
      { level: 18, name: 'Spell Mastery', description: 'You have achieved such mastery over certain spells that you can cast them at will. Choose a 1st-level and a 2nd-level wizard spell. You can cast those spells at their lowest level without expending a spell slot.' },
      { level: 20, name: 'Signature Spells', description: 'You always have two 3rd-level wizard spells prepared. They don\'t count against your number of prepared spells. You can cast each of them once at 3rd level without expending a spell slot.' },
    ],
    spellcasting: {
      ability: 'intelligence',
      // Index = level - 1. Cantrips known by level.
      cantripsKnown: [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
      spellSlots: {
        1:  [2, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
        2:  [0, 0, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
        3:  [0, 0, 0, 0, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
        4:  [0, 0, 0, 0, 0, 0, 1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
        5:  [0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3],
        6:  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2],
        7:  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 2],
        8:  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1],
        9:  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
      },
    },
  },
  {
    id: 'rogue',
    name: 'Rogue',
    description:
      'A scoundrel who uses stealth and trickery to overcome obstacles and enemies. Rogues rely on skill, stealth, and their foes\' vulnerabilities to get the upper hand.',
    hitDie: 8,
    primaryAbility: 'dexterity',
    savingThrows: ['dexterity', 'intelligence'],
    armorProficiencies: ['light'],
    weaponProficiencies: ['simple'],
    skillChoices: {
      choose: 4,
      from: [
        'acrobatics', 'athletics', 'deception', 'insight',
        'intimidation', 'investigation', 'perception', 'performance',
        'persuasion', 'sleight_of_hand', 'stealth',
      ],
    },
    startingEquipment: ['item_rapier', 'item_shortbow', 'item_leather', 'item_dagger', 'item_dagger', 'item_backpack'],
    features: [
      { level: 1, name: 'Expertise', description: 'Choose two of your skill proficiencies, or one of your skill proficiencies and your proficiency with thieves\' tools. Your proficiency bonus is doubled for any ability check you make that uses either of the chosen proficiencies.' },
      { level: 1, name: 'Sneak Attack', description: 'Once per turn, you can deal an extra 1d6 damage to one creature you hit with an attack if you have advantage on the attack roll. The attack must use a finesse or a ranged weapon. The extra damage increases as you gain levels: 2d6 at 3rd, 3d6 at 5th, and so on up to 10d6 at 19th.' },
      { level: 1, name: 'Thieves\' Cant', description: 'You have learned a secret mix of dialect, jargon, and code that allows you to hide messages in seemingly normal conversation.' },
      { level: 2, name: 'Cunning Action', description: 'You can take a bonus action on each of your turns in combat to Dash, Disengage, or Hide.' },
      { level: 5, name: 'Uncanny Dodge', description: 'When an attacker that you can see hits you with an attack, you can use your reaction to halve the attack\'s damage against you.' },
      { level: 7, name: 'Evasion', description: 'When you are subjected to an effect that allows you to make a Dexterity saving throw to take only half damage, you instead take no damage if you succeed on the saving throw, and only half damage if you fail.' },
      { level: 14, name: 'Blindsense', description: 'If you are able to hear, you are aware of the location of any hidden or invisible creature within 10 feet of you.' },
      { level: 20, name: 'Stroke of Luck', description: 'If your attack misses a target within range, you can turn the miss into a hit. Alternatively, if you fail an ability check, you can treat the d20 roll as a 20.' },
    ],
  },
  {
    id: 'cleric',
    name: 'Cleric',
    description:
      'A priestly champion who wields divine magic in service of a higher power. Clerics are intermediaries between the mortal world and the distant planes of the gods.',
    hitDie: 8,
    primaryAbility: 'wisdom',
    savingThrows: ['wisdom', 'charisma'],
    armorProficiencies: ['light', 'medium', 'shield'],
    weaponProficiencies: ['simple'],
    skillChoices: {
      choose: 2,
      from: ['history', 'insight', 'medicine', 'persuasion', 'religion'],
    },
    startingEquipment: ['item_mace', 'item_chain_shirt', 'item_shield', 'item_light_crossbow', 'item_backpack'],
    features: [
      { level: 1, name: 'Divine Domain', description: 'Choose one domain related to your deity. Your choice grants you domain spells and other features at various levels.' },
      { level: 2, name: 'Channel Divinity', description: 'You gain the ability to channel divine energy directly from your deity, using that energy to fuel magical effects. You start with Turn Undead and one effect determined by your domain. You can use Channel Divinity once between rests. Starting at 6th level, you can use it twice, and at 18th level, three times.' },
      { level: 2, name: 'Turn Undead', description: 'As an action, you present your holy symbol and speak a prayer censuring the undead. Each undead within 30 feet that can see or hear you must make a Wisdom saving throw. On a failed save, it is turned for 1 minute or until it takes damage.' },
      { level: 5, name: 'Destroy Undead', description: 'When an undead fails its saving throw against your Turn Undead feature, the creature is instantly destroyed if its challenge rating is at or below a certain threshold (CR 1/2 at 5th level, CR 1 at 8th, CR 2 at 11th, CR 3 at 14th, CR 4 at 17th).' },
      { level: 10, name: 'Divine Intervention', description: 'You can call on your deity to intervene on your behalf when your need is great. You must use your action. Roll a d100. If the number is equal to or lower than your cleric level, your deity intervenes. If successful, you can\'t use this feature again for 7 days.' },
    ],
    spellcasting: {
      ability: 'wisdom',
      cantripsKnown: [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
      spellSlots: {
        1:  [2, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
        2:  [0, 0, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
        3:  [0, 0, 0, 0, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
        4:  [0, 0, 0, 0, 0, 0, 1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
        5:  [0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3],
        6:  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2],
        7:  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 2],
        8:  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1],
        9:  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
      },
    },
  },
];

export function getClass(id: string): ClassDefinition | undefined {
  return SRD_CLASSES.find((c) => c.id === id);
}
