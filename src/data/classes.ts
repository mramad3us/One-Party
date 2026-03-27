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
    /** For known-spells casters (bard, sorcerer, warlock, ranger): fixed spells known per level. */
    spellsKnown?: number[];
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
      { level: 4, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 6, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 8, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 9, name: 'Indomitable', description: 'You can reroll a saving throw that you fail. If you do so, you must use the new roll. You can use this feature once between long rests. You gain additional uses at 13th and 17th level.' },
      { level: 12, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 14, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 16, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 19, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
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
      { level: 4, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 8, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 12, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 16, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 19, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
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
      { level: 4, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 7, name: 'Evasion', description: 'When you are subjected to an effect that allows you to make a Dexterity saving throw to take only half damage, you instead take no damage if you succeed on the saving throw, and only half damage if you fail.' },
      { level: 8, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 10, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 12, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 14, name: 'Blindsense', description: 'If you are able to hear, you are aware of the location of any hidden or invisible creature within 10 feet of you.' },
      { level: 16, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 19, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
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
      { level: 4, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 5, name: 'Destroy Undead', description: 'When an undead fails its saving throw against your Turn Undead feature, the creature is instantly destroyed if its challenge rating is at or below a certain threshold (CR 1/2 at 5th level, CR 1 at 8th, CR 2 at 11th, CR 3 at 14th, CR 4 at 17th).' },
      { level: 8, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 10, name: 'Divine Intervention', description: 'You can call on your deity to intervene on your behalf when your need is great. You must use your action. Roll a d100. If the number is equal to or lower than your cleric level, your deity intervenes. If successful, you can\'t use this feature again for 7 days.' },
      { level: 12, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 16, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 19, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
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

  // ── Barbarian ──────────────────────────────────────────────────
  {
    id: 'barbarian',
    name: 'Barbarian',
    description:
      'A fierce warrior of primitive background who can enter a battle rage. Barbarians thrive in the chaos of battle, shrugging off blows that would fell lesser combatants.',
    hitDie: 12,
    primaryAbility: 'strength',
    savingThrows: ['strength', 'constitution'],
    armorProficiencies: ['light', 'medium', 'shield'],
    weaponProficiencies: ['simple', 'martial'],
    skillChoices: {
      choose: 2,
      from: ['animal_handling', 'athletics', 'intimidation', 'nature', 'perception', 'survival'],
    },
    startingEquipment: ['item_greataxe', 'item_handaxe', 'item_handaxe', 'item_explorers_pack', 'item_javelin'],
    features: [
      { level: 1, name: 'Rage', description: 'In battle, you fight with primal ferocity. On your turn, you can enter a rage as a bonus action. While raging, you gain advantage on Strength checks and saving throws, a bonus to melee damage (+2, increasing to +3 at 9th and +4 at 16th level), and resistance to bludgeoning, piercing, and slashing damage. You can rage a number of times between long rests: 2 at 1st level, increasing to 3 at 3rd, 4 at 6th, 5 at 12th, 6 at 17th, and unlimited at 20th.' },
      { level: 1, name: 'Unarmored Defense', description: 'While you are not wearing any armor, your Armor Class equals 10 + your Dexterity modifier + your Constitution modifier. You can use a shield and still gain this benefit.' },
      { level: 2, name: 'Reckless Attack', description: 'When you make your first attack on your turn, you can decide to attack recklessly. Doing so gives you advantage on melee weapon attack rolls using Strength during this turn, but attack rolls against you have advantage until your next turn.' },
      { level: 2, name: 'Danger Sense', description: 'You have advantage on Dexterity saving throws against effects that you can see, such as traps and spells. You do not gain this benefit if you are blinded, deafened, or incapacitated.' },
      { level: 3, name: 'Primal Path', description: 'You choose a path that shapes the nature of your rage, such as the Path of the Berserker.' },
      { level: 4, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 5, name: 'Extra Attack', description: 'You can attack twice, instead of once, whenever you take the Attack action on your turn.' },
      { level: 5, name: 'Fast Movement', description: 'Your speed increases by 10 feet while you aren\'t wearing heavy armor.' },
      { level: 7, name: 'Feral Instinct', description: 'You have advantage on initiative rolls. Additionally, if you are surprised at the beginning of combat and aren\'t incapacitated, you can act normally on your first turn if you enter your rage before doing anything else.' },
      { level: 8, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 9, name: 'Brutal Critical', description: 'You can roll one additional weapon damage die when determining the extra damage for a critical hit with a melee attack. This increases to two additional dice at 13th level and three additional dice at 17th level.' },
      { level: 11, name: 'Relentless Rage', description: 'Your rage can keep you fighting despite grievous wounds. If you drop to 0 hit points while you\'re raging and don\'t die outright, you can make a DC 10 Constitution saving throw. If you succeed, you drop to 1 hit point instead. Each time you use this feature after the first, the DC increases by 5. The DC resets to 10 after a short or long rest.' },
      { level: 12, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 15, name: 'Persistent Rage', description: 'Your rage is so fierce that it ends early only if you fall unconscious or if you choose to end it.' },
      { level: 16, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 18, name: 'Indomitable Might', description: 'If your total for a Strength check is less than your Strength score, you can use that score in place of the total.' },
      { level: 19, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 20, name: 'Primal Champion', description: 'You embody the power of the wilds. Your Strength and Constitution scores each increase by 4. Your maximum for those scores is now 24.' },
    ],
  },

  // ── Bard ──────────────────────────────────────────────────────
  {
    id: 'bard',
    name: 'Bard',
    description:
      'An inspiring magician whose power echoes the music of creation. Bards use words of power, music, and the magic woven into their performances to inspire allies and demoralize foes.',
    hitDie: 8,
    primaryAbility: 'charisma',
    savingThrows: ['dexterity', 'charisma'],
    armorProficiencies: ['light'],
    weaponProficiencies: ['simple'],
    skillChoices: {
      choose: 3,
      from: [
        'acrobatics', 'animal_handling', 'arcana', 'athletics', 'deception',
        'history', 'insight', 'intimidation', 'investigation', 'medicine',
        'nature', 'perception', 'performance', 'persuasion', 'religion',
        'sleight_of_hand', 'stealth', 'survival',
      ],
    },
    startingEquipment: ['item_rapier', 'item_leather', 'item_dagger', 'item_backpack'],
    features: [
      { level: 1, name: 'Bardic Inspiration', description: 'You can inspire others through stirring words or music. As a bonus action, choose one creature other than yourself within 60 feet who can hear you. That creature gains a Bardic Inspiration die (d6). Once within the next 10 minutes, the creature can roll the die and add it to one ability check, attack roll, or saving throw. The die increases to d8 at 5th level, d10 at 10th, and d12 at 15th. You can use this feature a number of times equal to your Charisma modifier (minimum once), regaining all uses after a long rest. Starting at 5th level, you regain uses on a short or long rest.' },
      { level: 2, name: 'Jack of All Trades', description: 'You can add half your proficiency bonus, rounded down, to any ability check you make that doesn\'t already include your proficiency bonus.' },
      { level: 2, name: 'Song of Rest', description: 'You can use soothing music or oration to help revitalize your wounded allies during a short rest. If you or any friendly creatures who can hear your performance regain hit points at the end of the short rest by spending one or more Hit Dice, each of those creatures regains an extra 1d6 hit points. The extra hit points increase to 1d8 at 9th level, 1d10 at 13th, and 1d12 at 17th.' },
      { level: 3, name: 'Bard College', description: 'You choose a bard college that shapes your use of knowledge and magic, such as the College of Lore.' },
      { level: 3, name: 'Expertise', description: 'Choose two of your skill proficiencies. Your proficiency bonus is doubled for any ability check you make that uses either of the chosen proficiencies. At 10th level, you choose two more proficiencies to gain this benefit.' },
      { level: 4, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 6, name: 'Countercharm', description: 'You gain the ability to use musical notes or words of power to disrupt mind-influencing effects. As an action, you can start a performance that lasts until the end of your next turn. During that time, you and any friendly creatures within 30 feet have advantage on saving throws against being frightened or charmed.' },
      { level: 8, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 10, name: 'Magical Secrets', description: 'You have plundered magical knowledge from a wide spectrum of disciplines. Choose two spells from any class\'s spell list. The chosen spells count as bard spells for you. You learn two additional spells at 14th and 18th level.' },
      { level: 12, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 16, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 19, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 20, name: 'Superior Inspiration', description: 'When you roll initiative and have no uses of Bardic Inspiration left, you regain one use.' },
    ],
    spellcasting: {
      ability: 'charisma',
      cantripsKnown: [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
      spellsKnown: [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22],
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

  // ── Druid ─────────────────────────────────────────────────────
  {
    id: 'druid',
    name: 'Druid',
    description:
      'A priest of the Old Faith, wielding the powers of nature and adopting animal forms. Druids revere nature above all, drawing their magic from the force of nature itself.',
    hitDie: 8,
    primaryAbility: 'wisdom',
    savingThrows: ['intelligence', 'wisdom'],
    armorProficiencies: ['light', 'medium', 'shield'],
    weaponProficiencies: ['simple'],
    skillChoices: {
      choose: 2,
      from: ['arcana', 'animal_handling', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival'],
    },
    startingEquipment: ['item_leather', 'item_shield', 'item_scimitar', 'item_explorers_pack'],
    features: [
      { level: 1, name: 'Druidic', description: 'You know Druidic, the secret language of druids. You can speak the language and use it to leave hidden messages.' },
      { level: 2, name: 'Wild Shape', description: 'You can use your action to magically assume the shape of a beast that you have seen before. You can use this feature twice between short or long rests. Your druid level determines the beasts you can transform into: CR 1/4 at 2nd level (no flying or swimming), CR 1/2 at 4th level (no flying), CR 1 at 8th level (no restrictions).' },
      { level: 2, name: 'Druid Circle', description: 'You choose a circle of druids to identify with, such as the Circle of the Land.' },
      { level: 4, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 8, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 12, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 16, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 18, name: 'Timeless Body', description: 'The primal magic that you wield causes you to age more slowly. For every 10 years that pass, your body ages only 1 year.' },
      { level: 18, name: 'Beast Spells', description: 'You can cast many of your druid spells in any shape you assume using Wild Shape. You can perform the somatic and verbal components of a druid spell while in a beast shape, but you aren\'t able to provide material components.' },
      { level: 19, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 20, name: 'Archdruid', description: 'You can use your Wild Shape an unlimited number of times. Additionally, you can ignore the verbal and somatic components of your druid spells, as well as any material components that lack a cost and aren\'t consumed by a spell.' },
    ],
    spellcasting: {
      ability: 'wisdom',
      cantripsKnown: [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
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

  // ── Monk ──────────────────────────────────────────────────────
  {
    id: 'monk',
    name: 'Monk',
    description:
      'A master of martial arts, harnessing the power of the body in pursuit of physical and spiritual perfection. Monks use ki to fuel supernatural speed, resilience, and devastating strikes.',
    hitDie: 8,
    primaryAbility: 'dexterity',
    savingThrows: ['strength', 'dexterity'],
    armorProficiencies: [],
    weaponProficiencies: ['simple'],
    skillChoices: {
      choose: 2,
      from: ['acrobatics', 'athletics', 'history', 'insight', 'religion', 'stealth'],
    },
    startingEquipment: ['item_shortsword', 'item_dart', 'item_dart', 'item_dart', 'item_dart', 'item_dart', 'item_explorers_pack'],
    features: [
      { level: 1, name: 'Unarmored Defense', description: 'While you are wearing no armor and not wielding a shield, your AC equals 10 + your Dexterity modifier + your Wisdom modifier.' },
      { level: 1, name: 'Martial Arts', description: 'Your practice of martial arts gives you mastery of combat styles that use unarmed strikes and monk weapons. You gain benefits: use Dexterity instead of Strength for monk weapons and unarmed strikes, roll a d4 in place of normal damage (increases to d6 at 5th, d8 at 11th, d10 at 17th), and when you use the Attack action with a monk weapon or unarmed strike, you can make one unarmed strike as a bonus action.' },
      { level: 2, name: 'Ki', description: 'Your training allows you to harness the mystic energy of ki. You have a number of ki points equal to your monk level. You can spend these points to fuel ki features: Flurry of Blows (2 unarmed strikes as bonus action for 1 ki), Patient Defense (Dodge as bonus action for 1 ki), Step of the Wind (Disengage or Dash as bonus action for 1 ki, jump distance doubled). You regain all ki points on a short or long rest.' },
      { level: 2, name: 'Unarmored Movement', description: 'Your speed increases by 10 feet while you are not wearing armor or wielding a shield. This bonus increases at higher levels: +15 ft at 6th, +20 ft at 10th, +25 ft at 14th, +30 ft at 18th. At 9th level, you gain the ability to move along vertical surfaces and across liquids on your turn without falling.' },
      { level: 3, name: 'Monastic Tradition', description: 'You choose a monastic tradition to emulate, such as the Way of the Open Hand.' },
      { level: 3, name: 'Deflect Missiles', description: 'You can use your reaction to deflect or catch the missile when you are hit by a ranged weapon attack. The damage is reduced by 1d10 + your Dexterity modifier + your monk level. If you reduce the damage to 0, you can catch the missile and spend 1 ki point to make a ranged attack with it as part of the same reaction.' },
      { level: 4, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 4, name: 'Slow Fall', description: 'You can use your reaction when you fall to reduce any falling damage you take by an amount equal to five times your monk level.' },
      { level: 5, name: 'Extra Attack', description: 'You can attack twice, instead of once, whenever you take the Attack action on your turn.' },
      { level: 5, name: 'Stunning Strike', description: 'When you hit another creature with a melee weapon attack, you can spend 1 ki point to attempt a stunning strike. The target must succeed on a Constitution saving throw or be stunned until the end of your next turn.' },
      { level: 6, name: 'Ki-Empowered Strikes', description: 'Your unarmed strikes count as magical for the purpose of overcoming resistance and immunity to nonmagical attacks and damage.' },
      { level: 7, name: 'Evasion', description: 'When you are subjected to an effect that allows you to make a Dexterity saving throw to take only half damage, you instead take no damage if you succeed, and only half damage if you fail.' },
      { level: 7, name: 'Stillness of Mind', description: 'You can use your action to end one effect on yourself that is causing you to be charmed or frightened.' },
      { level: 8, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 10, name: 'Purity of Body', description: 'Your mastery of the ki flowing through you makes you immune to disease and poison.' },
      { level: 12, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 13, name: 'Tongue of the Sun and Moon', description: 'You learn to touch the ki of other minds so that you understand all spoken languages. Moreover, any creature that can understand a language can understand what you say.' },
      { level: 14, name: 'Diamond Soul', description: 'Your mastery of ki grants you proficiency in all saving throws. Additionally, whenever you make a saving throw and fail, you can spend 1 ki point to reroll it and take the second result.' },
      { level: 15, name: 'Timeless Body', description: 'Your ki sustains you so that you suffer none of the frailty of old age, and you can\'t be aged magically. You can still die of old age, however. You no longer need food or water.' },
      { level: 16, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 18, name: 'Empty Body', description: 'You can use your action to spend 4 ki points to become invisible for 1 minute. During that time, you also have resistance to all damage but force damage. Additionally, you can spend 8 ki points to cast the astral projection spell, without needing material components.' },
      { level: 19, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 20, name: 'Perfect Self', description: 'When you roll initiative and have no ki points remaining, you regain 4 ki points.' },
    ],
  },

  // ── Paladin ───────────────────────────────────────────────────
  {
    id: 'paladin',
    name: 'Paladin',
    description:
      'A holy warrior bound to a sacred oath. Paladins combine martial prowess with divine magic, smiting evil and protecting the innocent with the power of their conviction.',
    hitDie: 10,
    primaryAbility: 'strength',
    savingThrows: ['wisdom', 'charisma'],
    armorProficiencies: ['light', 'medium', 'heavy', 'shield'],
    weaponProficiencies: ['simple', 'martial'],
    skillChoices: {
      choose: 2,
      from: ['athletics', 'insight', 'intimidation', 'medicine', 'persuasion', 'religion'],
    },
    startingEquipment: ['item_chain_mail', 'item_longsword', 'item_shield', 'item_javelin', 'item_backpack'],
    features: [
      { level: 1, name: 'Divine Sense', description: 'As an action, you can detect the presence of any celestial, fiend, or undead within 60 feet that is not behind total cover. You know the type but not the identity. You can use this feature a number of times equal to 1 + your Charisma modifier, regaining all uses after a long rest.' },
      { level: 1, name: 'Lay on Hands', description: 'You have a pool of healing power that replenishes on a long rest. With your pool, you can restore a total number of hit points equal to your paladin level x 5. As an action, you can touch a creature and draw power from the pool to restore hit points. Alternatively, you can expend 5 hit points from your pool to cure one disease or neutralize one poison.' },
      { level: 2, name: 'Fighting Style', description: 'You adopt a particular style of fighting as your specialty. Choose one: Defense (+1 AC in armor), Dueling (+2 damage one-handed), Great Weapon Fighting (reroll 1s and 2s on two-handed damage), or Protection (impose disadvantage on attacks against adjacent allies using your reaction and a shield).' },
      { level: 2, name: 'Divine Smite', description: 'When you hit a creature with a melee weapon attack, you can expend one spell slot to deal radiant damage to the target, in addition to the weapon\'s damage. The extra damage is 2d8 for a 1st-level slot, plus 1d8 for each spell level higher than 1st, to a maximum of 5d8. The damage increases by 1d8 if the target is an undead or a fiend.' },
      { level: 3, name: 'Divine Health', description: 'The divine magic flowing through you makes you immune to disease.' },
      { level: 3, name: 'Sacred Oath', description: 'You swear the oath that binds you as a paladin forever, such as the Oath of Devotion.' },
      { level: 4, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 5, name: 'Extra Attack', description: 'You can attack twice, instead of once, whenever you take the Attack action on your turn.' },
      { level: 6, name: 'Aura of Protection', description: 'Whenever you or a friendly creature within 10 feet of you must make a saving throw, the creature gains a bonus to the saving throw equal to your Charisma modifier (minimum +1). You must be conscious to grant this bonus. At 18th level, the range increases to 30 feet.' },
      { level: 8, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 10, name: 'Aura of Courage', description: 'You and friendly creatures within 10 feet of you can\'t be frightened while you are conscious. At 18th level, the range increases to 30 feet.' },
      { level: 11, name: 'Improved Divine Smite', description: 'Whenever you hit a creature with a melee weapon, the creature takes an extra 1d8 radiant damage.' },
      { level: 12, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 14, name: 'Cleansing Touch', description: 'You can use your action to end one spell on yourself or on one willing creature that you touch. You can use this feature a number of times equal to your Charisma modifier (minimum once), regaining all uses after a long rest.' },
      { level: 16, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 19, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
    ],
    spellcasting: {
      ability: 'charisma',
      // Paladins don't get cantrips
      cantripsKnown: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      // Half-caster spell slots (start at level 2)
      spellSlots: {
        1:  [0, 2, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
        2:  [0, 0, 0, 0, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
        3:  [0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
        4:  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 3, 3],
        5:  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 2],
      },
    },
  },

  // ── Ranger ────────────────────────────────────────────────────
  {
    id: 'ranger',
    name: 'Ranger',
    description:
      'A warrior who combats threats on the edges of civilization. Rangers use martial prowess and nature magic to hunt the most dangerous enemies and protect the borderlands.',
    hitDie: 10,
    primaryAbility: 'dexterity',
    savingThrows: ['strength', 'dexterity'],
    armorProficiencies: ['light', 'medium', 'shield'],
    weaponProficiencies: ['simple', 'martial'],
    skillChoices: {
      choose: 3,
      from: ['animal_handling', 'athletics', 'insight', 'investigation', 'nature', 'perception', 'stealth', 'survival'],
    },
    startingEquipment: ['item_scale_mail', 'item_longbow', 'item_shortsword', 'item_shortsword', 'item_explorers_pack'],
    features: [
      { level: 1, name: 'Favored Enemy', description: 'You have significant experience studying, tracking, hunting, and even talking to a certain type of enemy. Choose a type of favored enemy: aberrations, beasts, celestials, constructs, dragons, elementals, fey, fiends, giants, monstrosities, oozes, plants, or undead. You have advantage on Wisdom (Survival) checks to track your favored enemies, as well as on Intelligence checks to recall information about them. You choose one additional favored enemy at 6th and 14th level.' },
      { level: 1, name: 'Natural Explorer', description: 'You are a master of navigating the natural world. Choose one type of favored terrain: arctic, coast, desert, forest, grassland, mountain, swamp, or underdark. While traveling in your favored terrain, you gain several benefits including difficult terrain not slowing your group, you can\'t become lost except by magical means, and doubled proficiency bonus for Intelligence and Wisdom checks related to the terrain. You choose additional terrains at 6th and 10th level.' },
      { level: 2, name: 'Fighting Style', description: 'You adopt a particular style of fighting as your specialty. Choose one: Archery (+2 bonus to ranged attack rolls), Defense (+1 AC in armor), Dueling (+2 damage one-handed), or Two-Weapon Fighting (add ability modifier to off-hand damage).' },
      { level: 3, name: 'Ranger Archetype', description: 'You choose an archetype to emulate, such as the Hunter.' },
      { level: 3, name: 'Primeval Awareness', description: 'You can use your action and expend one ranger spell slot to focus your awareness on the region around you. For 1 minute per level of the spell slot, you can sense whether aberrations, celestials, dragons, elementals, fey, fiends, and undead are present within 1 mile (or 6 miles in favored terrain).' },
      { level: 4, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 5, name: 'Extra Attack', description: 'You can attack twice, instead of once, whenever you take the Attack action on your turn.' },
      { level: 8, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 8, name: 'Land\'s Stride', description: 'Moving through nonmagical difficult terrain costs you no extra movement. You can also pass through nonmagical plants without being slowed by them and without taking damage from thorns, spines, or similar hazards. You also have advantage on saving throws against magically created or manipulated plants.' },
      { level: 10, name: 'Hide in Plain Sight', description: 'You can spend 1 minute creating camouflage for yourself. You must have access to fresh mud, dirt, plants, soot, and other naturally occurring materials. Once camouflaged, you can try to hide by pressing yourself up against a solid surface that is at least as tall and wide as you are. You gain a +10 bonus to Dexterity (Stealth) checks as long as you remain there without moving or taking actions.' },
      { level: 12, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 14, name: 'Vanish', description: 'You can use the Hide action as a bonus action on your turn. Also, you can\'t be tracked by nonmagical means, unless you choose to leave a trail.' },
      { level: 16, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 18, name: 'Feral Senses', description: 'You gain preternatural senses that help you fight creatures you can\'t see. When you attack a creature you can\'t see, your inability to see it doesn\'t impose disadvantage on your attack rolls. You are also aware of the location of any invisible creature within 30 feet of you, provided that the creature isn\'t hidden from you and you aren\'t blinded or deafened.' },
      { level: 19, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 20, name: 'Foe Slayer', description: 'You become an unparalleled hunter of your enemies. Once on each of your turns, you can add your Wisdom modifier to the attack roll or the damage roll of an attack you make against one of your favored enemies.' },
    ],
    spellcasting: {
      ability: 'wisdom',
      // Rangers don't get cantrips
      cantripsKnown: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      spellsKnown: [0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11],
      // Half-caster spell slots (start at level 2)
      spellSlots: {
        1:  [0, 2, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
        2:  [0, 0, 0, 0, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
        3:  [0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
        4:  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 3, 3],
        5:  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 2],
      },
    },
  },

  // ── Sorcerer ──────────────────────────────────────────────────
  {
    id: 'sorcerer',
    name: 'Sorcerer',
    description:
      'A spellcaster who draws on inherent magic from a gift or bloodline. Sorcerers carry a magical birthright conferred upon them by an exotic origin, some otherworldly influence, or exposure to unknown cosmic forces.',
    hitDie: 6,
    primaryAbility: 'charisma',
    savingThrows: ['constitution', 'charisma'],
    armorProficiencies: [],
    weaponProficiencies: ['simple'],
    skillChoices: {
      choose: 2,
      from: ['arcana', 'deception', 'insight', 'intimidation', 'persuasion', 'religion'],
    },
    startingEquipment: ['item_light_crossbow', 'item_dagger', 'item_dagger', 'item_backpack'],
    features: [
      { level: 1, name: 'Sorcerous Origin', description: 'Choose a sorcerous origin, which describes the source of your innate magical power, such as Draconic Bloodline.' },
      { level: 2, name: 'Font of Magic', description: 'You tap into a deep wellspring of magic within yourself. You have a number of sorcery points equal to your sorcerer level. You can use sorcery points to gain additional spell slots or sacrifice spell slots to gain additional sorcery points as a bonus action.' },
      { level: 3, name: 'Metamagic', description: 'You gain the ability to twist your spells to suit your needs. You gain two Metamagic options of your choice (e.g. Careful Spell, Distant Spell, Empowered Spell, Extended Spell, Heightened Spell, Quickened Spell, Subtle Spell, Twinned Spell). You gain another at 10th and 17th level.' },
      { level: 4, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 8, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 12, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 16, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 19, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 20, name: 'Sorcerous Restoration', description: 'You regain 4 expended sorcery points whenever you finish a short rest.' },
    ],
    spellcasting: {
      ability: 'charisma',
      cantripsKnown: [4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
      spellsKnown: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15],
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

  // ── Warlock ───────────────────────────────────────────────────
  {
    id: 'warlock',
    name: 'Warlock',
    description:
      'A wielder of magic derived from a bargain with an extraplanar entity. Warlocks are seekers of the knowledge that lies hidden in the fabric of the multiverse, piecing together arcane secrets to bolster their own power.',
    hitDie: 8,
    primaryAbility: 'charisma',
    savingThrows: ['wisdom', 'charisma'],
    armorProficiencies: ['light'],
    weaponProficiencies: ['simple'],
    skillChoices: {
      choose: 2,
      from: ['arcana', 'deception', 'history', 'intimidation', 'investigation', 'nature', 'religion'],
    },
    startingEquipment: ['item_light_crossbow', 'item_leather', 'item_dagger', 'item_dagger', 'item_backpack'],
    features: [
      { level: 1, name: 'Otherworldly Patron', description: 'You have struck a bargain with an otherworldly being of your choice, such as The Fiend. Your choice grants you features at 1st level and again at 6th, 10th, and 14th level.' },
      { level: 1, name: 'Pact Magic', description: 'Your arcane research and the magic bestowed on you by your patron have given you facility with spells. You have a limited number of spell slots that are all the same level and recharge on a short rest. Slot level: 1st at levels 1-2, 2nd at 3-4, 3rd at 5-6, 4th at 7-8, 5th at 9+. Number of slots: 1 at level 1, 2 at level 2, 3 at level 11, 4 at level 17.' },
      { level: 2, name: 'Eldritch Invocations', description: 'In your study of occult lore, you have unearthed eldritch invocations, fragments of forbidden knowledge that imbue you with an abiding magical ability. You gain two eldritch invocations of your choice. When you gain certain warlock levels, you gain additional invocations: 3 at 5th, 4 at 7th, 5 at 9th, 6 at 12th, 7 at 15th, 8 at 18th.' },
      { level: 3, name: 'Pact Boon', description: 'Your otherworldly patron bestows a gift upon you. Choose one: Pact of the Chain (find familiar with enhanced forms), Pact of the Blade (create a magical weapon), or Pact of the Tome (Book of Shadows with three cantrips from any class).' },
      { level: 4, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 8, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 11, name: 'Mystic Arcanum (6th level)', description: 'Your patron bestows upon you a magical secret called an arcanum. Choose one 6th-level spell from the warlock spell list as this arcanum. You can cast it once without expending a spell slot. You must finish a long rest before you can do so again.' },
      { level: 12, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 13, name: 'Mystic Arcanum (7th level)', description: 'Choose one 7th-level spell from the warlock spell list. You can cast it once without expending a spell slot, regaining the ability after a long rest.' },
      { level: 15, name: 'Mystic Arcanum (8th level)', description: 'Choose one 8th-level spell from the warlock spell list. You can cast it once without expending a spell slot, regaining the ability after a long rest.' },
      { level: 16, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 17, name: 'Mystic Arcanum (9th level)', description: 'Choose one 9th-level spell from the warlock spell list. You can cast it once without expending a spell slot, regaining the ability after a long rest.' },
      { level: 19, name: 'Ability Score Improvement', description: 'You can increase one ability score by 2, or two ability scores by 1 each.' },
      { level: 20, name: 'Eldritch Master', description: 'You can draw on your inner reserve of mystical power while entreating your patron to regain expended spell slots. You can spend 1 minute entreating your patron for aid to regain all your expended Pact Magic spell slots. Once you regain spell slots with this feature, you must finish a long rest before you can do so again.' },
    ],
    spellcasting: {
      ability: 'charisma',
      cantripsKnown: [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
      spellsKnown: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
      // Warlock Pact Magic: all slots are same level, recharge on short rest
      // Stored as slot level keys with array of slots-per-level
      // At any given level, only ONE key will be non-zero (the current pact slot level)
      spellSlots: {
        1:  [1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        2:  [0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        3:  [0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        4:  [0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        5:  [0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4],
      },
    },
  },
  // ── Special: God ──
  {
    id: 'god',
    name: 'God',
    description:
      'A divine being whose powers have matured beyond mortal comprehension. Your magic transcends the nine circles of conventional spellcraft, drawing upon divine reserves that echo through the fabric of reality itself.',
    hitDie: 8,
    primaryAbility: 'charisma',
    savingThrows: ['dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'],
    armorProficiencies: ['light', 'medium', 'heavy', 'shield'],
    weaponProficiencies: ['simple', 'martial'],
    skillChoices: {
      choose: 0,
      from: [],
    },
    startingEquipment: [],
    features: [
      { level: 1, name: 'Slap', description: 'Melee Spell Attack: +49 to hit, reach 5 ft. Hit: 1d4 + 23 necrotic damage. Target must succeed on a DC 64 CON save or be reduced to 0 HP.' },
      { level: 1, name: 'Healing Touch', description: 'Touch a creature to restore 8d8 + 4 HP and free them from any curse, disease, poison, blindness, or deafness. 5 uses per round.' },
      { level: 1, name: 'Innate Spellcasting', description: 'At Will: Wish. 5/Round: True Resurrection, True Polymorph, Time Stop, Power Word Kill, Meteor Swarm, Mass Heal, Gate, Astral Projection.' },
      { level: 1, name: 'Divine Magic', description: 'Spend divine points to cast spells at Epic Levels (10th-12th). You have 12 divine points, recharged on long rest.' },
      { level: 1, name: 'Superior Shield', description: 'Create a 20-ft radius sphere that absorbs up to 120 damage of any kind and gives creatures inside full cover from outside attacks.' },
      { level: 1, name: 'Magical Superiority', description: 'As a reaction when a creature casts a spell: Counterspell (DC 64 save or silenced), Antimagic Area (30-ft radius), or Superior Shield.' },
      { level: 1, name: 'Teleport', description: 'Magically teleport up to 120 feet to an unoccupied space you can see. Usable as a legendary action.' },
    ],
    spellcasting: {
      ability: 'charisma',
      cantripsKnown: Array(20).fill(20),
      spellSlots: {
        1: Array(20).fill(99),
        2: Array(20).fill(99),
        3: Array(20).fill(99),
        4: Array(20).fill(99),
        5: Array(20).fill(99),
        6: Array(20).fill(99),
        7: Array(20).fill(99),
        8: Array(20).fill(99),
        9: Array(20).fill(99),
      },
    },
  },
];

export function getClass(id: string): ClassDefinition | undefined {
  return SRD_CLASSES.find((c) => c.id === id);
}
