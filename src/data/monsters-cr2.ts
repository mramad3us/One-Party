import type { MonsterDefinition } from './monsters';

/** CR 2 monsters (450 XP each) — excludes Ogre (already in base) */
export const CR2_MONSTERS: MonsterDefinition[] = [
  {
    id: 'monster_allosaurus', name: 'Allosaurus', size: 'large', type: 'beast', alignment: 'unaligned', cr: 2, xp: 450,
    description: 'A massive predatory dinosaur with powerful jaws and devastating charge attacks.',
    stats: { abilityScores: { strength: 19, dexterity: 13, constitution: 17, intelligence: 2, wisdom: 12, charisma: 5 }, maxHp: 51, currentHp: 51, armorClass: 13, speed: 60, level: 4, attacks: [
      { name: 'Bite', toHitBonus: 6, damage: { count: 2, die: 10, type: 'piercing', bonus: 4 }, reach: 5 },
      { name: 'Claw', toHitBonus: 6, damage: { count: 1, die: 8, type: 'slashing', bonus: 4 }, reach: 5 },
    ], spellcasting: null, features: [
      { id: 'pounce_allosaurus', name: 'Pounce', description: 'If the allosaurus moves at least 30 feet straight toward a creature and then hits it with a claw attack on the same turn, that target must succeed on a DC 13 Strength saving throw or be knocked prone. If the target is prone, the allosaurus can make one bite attack against it as a bonus action.', source: 'allosaurus' },
    ], conditions: [], size: 'large', resistances: [], immunities: [], vulnerabilities: [], conditionImmunities: [] },
  },
  {
    id: 'monster_ankheg', name: 'Ankheg', size: 'large', type: 'monstrosity', alignment: 'unaligned', cr: 2, xp: 450,
    description: 'A massive insectoid burrower that ambushes prey from underground with its acid spray.',
    stats: { abilityScores: { strength: 17, dexterity: 11, constitution: 13, intelligence: 1, wisdom: 13, charisma: 6 }, maxHp: 39, currentHp: 39, armorClass: 14, speed: 30, level: 4, attacks: [
      { name: 'Bite', toHitBonus: 5, damage: { count: 2, die: 6, type: 'slashing', bonus: 3 }, reach: 5, additionalEffects: ['Plus 1d6 acid damage. Target is grappled (escape DC 13).'] },
      { name: 'Acid Spray (Recharge 6)', toHitBonus: 0, damage: { count: 3, die: 6, type: 'acid' }, reach: 0, rangeNormal: 30, additionalEffects: ['30-foot line, 5 feet wide. DC 13 Dexterity saving throw.'] },
    ], spellcasting: null, features: [], conditions: [], size: 'large', resistances: [], immunities: [], vulnerabilities: [], conditionImmunities: [] },
  },
  {
    id: 'monster_awakened_tree', name: 'Awakened Tree', size: 'huge', type: 'plant', alignment: 'unaligned', cr: 2, xp: 450,
    description: 'A tree given sentience and mobility through druidic magic.',
    stats: { abilityScores: { strength: 19, dexterity: 6, constitution: 15, intelligence: 10, wisdom: 10, charisma: 7 }, maxHp: 59, currentHp: 59, armorClass: 13, speed: 20, level: 4, attacks: [
      { name: 'Slam', toHitBonus: 6, damage: { count: 3, die: 6, type: 'bludgeoning', bonus: 4 }, reach: 10 },
    ], spellcasting: null, features: [
      { id: 'false_appearance_awakened_tree', name: 'False Appearance', description: 'While the tree remains motionless, it is indistinguishable from a normal tree.', source: 'awakened_tree' },
    ], conditions: [], size: 'huge', resistances: ['bludgeoning', 'piercing'], immunities: [], vulnerabilities: ['fire'], conditionImmunities: [] },
  },
  {
    id: 'monster_bandit_captain', name: 'Bandit Captain', size: 'medium', type: 'humanoid', alignment: 'any non-lawful', cr: 2, xp: 450,
    description: 'A cunning and charismatic leader of a bandit gang, skilled with blade and crossbow.',
    stats: { abilityScores: { strength: 15, dexterity: 16, constitution: 14, intelligence: 14, wisdom: 11, charisma: 14 }, maxHp: 65, currentHp: 65, armorClass: 15, speed: 30, level: 4, attacks: [
      { name: 'Scimitar', toHitBonus: 5, damage: { count: 1, die: 6, type: 'slashing', bonus: 3 }, reach: 5 },
      { name: 'Dagger', toHitBonus: 5, damage: { count: 1, die: 4, type: 'piercing', bonus: 3 }, reach: 5, rangeNormal: 20, rangeLong: 60 },
    ], spellcasting: null, features: [
      { id: 'multiattack_bandit_captain', name: 'Multiattack', description: 'The captain makes three melee attacks: two with its scimitar and one with its dagger.', source: 'bandit_captain' },
      { id: 'parry_bandit_captain', name: 'Parry', description: 'The captain adds 2 to its AC against one melee attack that would hit it. To do so, the captain must see the attacker and be wielding a melee weapon.', source: 'bandit_captain' },
    ], conditions: [], size: 'medium', resistances: [], immunities: [], vulnerabilities: [], conditionImmunities: [] },
  },
  {
    id: 'monster_berserker', name: 'Berserker', size: 'medium', type: 'humanoid', alignment: 'any chaotic', cr: 2, xp: 450,
    description: 'A fierce warrior who fights with reckless abandon, trading defense for overwhelming offense.',
    stats: { abilityScores: { strength: 16, dexterity: 12, constitution: 17, intelligence: 9, wisdom: 11, charisma: 9 }, maxHp: 67, currentHp: 67, armorClass: 13, speed: 30, level: 4, attacks: [
      { name: 'Greataxe', toHitBonus: 5, damage: { count: 1, die: 12, type: 'slashing', bonus: 3 }, reach: 5 },
    ], spellcasting: null, features: [
      { id: 'reckless_berserker', name: 'Reckless', description: 'At the start of its turn, the berserker can gain advantage on all melee weapon attack rolls during that turn, but attack rolls against it have advantage until the start of its next turn.', source: 'berserker' },
    ], conditions: [], size: 'medium', resistances: [], immunities: [], vulnerabilities: [], conditionImmunities: [] },
  },
  {
    id: 'monster_carrion_crawler', name: 'Carrion Crawler', size: 'large', type: 'monstrosity', alignment: 'unaligned', cr: 2, xp: 450,
    description: 'A massive centipede-like creature that paralyzes prey with its tentacles before devouring them.',
    stats: { abilityScores: { strength: 14, dexterity: 13, constitution: 16, intelligence: 1, wisdom: 12, charisma: 5 }, maxHp: 51, currentHp: 51, armorClass: 13, speed: 30, level: 4, attacks: [
      { name: 'Tentacles', toHitBonus: 8, damage: { count: 1, die: 4, type: 'poison', bonus: 2 }, reach: 10, additionalEffects: ['Target must succeed on a DC 13 Constitution saving throw or be poisoned for 1 minute. Until this poison ends, the target is paralyzed. The target can repeat the saving throw at the end of each of its turns.'] },
      { name: 'Bite', toHitBonus: 4, damage: { count: 2, die: 4, type: 'piercing', bonus: 2 }, reach: 5 },
    ], spellcasting: null, features: [
      { id: 'keen_smell_carrion_crawler', name: 'Keen Smell', description: 'The carrion crawler has advantage on Wisdom (Perception) checks that rely on smell.', source: 'carrion_crawler' },
      { id: 'spider_climb_carrion_crawler', name: 'Spider Climb', description: 'The crawler can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check.', source: 'carrion_crawler' },
      { id: 'multiattack_carrion_crawler', name: 'Multiattack', description: 'The carrion crawler makes two attacks: one with its tentacles and one with its bite.', source: 'carrion_crawler' },
    ], conditions: [], size: 'large', resistances: [], immunities: [], vulnerabilities: [], conditionImmunities: [] },
  },
  {
    id: 'monster_centaur', name: 'Centaur', size: 'large', type: 'monstrosity', alignment: 'neutral good', cr: 2, xp: 450,
    description: 'A creature with the upper body of a humanoid and the lower body of a horse, known for wisdom and archery.',
    stats: { abilityScores: { strength: 18, dexterity: 14, constitution: 14, intelligence: 9, wisdom: 13, charisma: 11 }, maxHp: 45, currentHp: 45, armorClass: 12, speed: 50, level: 4, attacks: [
      { name: 'Pike', toHitBonus: 6, damage: { count: 1, die: 10, type: 'piercing', bonus: 4 }, reach: 10 },
      { name: 'Hooves', toHitBonus: 6, damage: { count: 2, die: 6, type: 'bludgeoning', bonus: 4 }, reach: 5 },
      { name: 'Longbow', toHitBonus: 4, damage: { count: 1, die: 8, type: 'piercing', bonus: 2 }, reach: 0, rangeNormal: 150, rangeLong: 600 },
    ], spellcasting: null, features: [
      { id: 'charge_centaur', name: 'Charge', description: 'If the centaur moves at least 30 feet straight toward a target and then hits it with a pike attack on the same turn, the target takes an extra 3d6 piercing damage.', source: 'centaur' },
      { id: 'multiattack_centaur', name: 'Multiattack', description: 'The centaur makes two attacks: one with its pike and one with its hooves or two with its longbow.', source: 'centaur' },
    ], conditions: [], size: 'large', resistances: [], immunities: [], vulnerabilities: [], conditionImmunities: [] },
  },
  {
    id: 'monster_cult_fanatic', name: 'Cult Fanatic', size: 'medium', type: 'humanoid', alignment: 'any non-good', cr: 2, xp: 450,
    description: 'A zealous cultist who uses dark magic and fanatical devotion to further their cult\'s goals.',
    stats: { abilityScores: { strength: 11, dexterity: 14, constitution: 12, intelligence: 10, wisdom: 13, charisma: 14 }, maxHp: 33, currentHp: 33, armorClass: 13, speed: 30, level: 4, attacks: [
      { name: 'Dagger', toHitBonus: 4, damage: { count: 1, die: 4, type: 'piercing', bonus: 2 }, reach: 5, rangeNormal: 20, rangeLong: 60 },
    ], spellcasting: null, features: [
      { id: 'dark_devotion_cult_fanatic', name: 'Dark Devotion', description: 'The fanatic has advantage on saving throws against being charmed or frightened.', source: 'cult_fanatic' },
      { id: 'spellcasting_cult_fanatic', name: 'Spellcasting', description: 'The fanatic is a 4th-level spellcaster (spell save DC 11, +3 to hit). Cantrips: Light, Sacred Flame, Thaumaturgy. 1st level (4 slots): Command, Inflict Wounds, Shield of Faith. 2nd level (3 slots): Hold Person, Spiritual Weapon.', source: 'cult_fanatic' },
      { id: 'multiattack_cult_fanatic', name: 'Multiattack', description: 'The fanatic makes two melee attacks.', source: 'cult_fanatic' },
    ], conditions: [], size: 'medium', resistances: [], immunities: [], vulnerabilities: [], conditionImmunities: [] },
  },
  {
    id: 'monster_ettercap', name: 'Ettercap', size: 'medium', type: 'monstrosity', alignment: 'neutral evil', cr: 2, xp: 450,
    description: 'A spider-like humanoid that spins deadly traps and commands giant spiders.',
    stats: { abilityScores: { strength: 14, dexterity: 15, constitution: 13, intelligence: 7, wisdom: 12, charisma: 8 }, maxHp: 44, currentHp: 44, armorClass: 13, speed: 30, level: 4, attacks: [
      { name: 'Bite', toHitBonus: 4, damage: { count: 1, die: 8, type: 'piercing', bonus: 2 }, reach: 5, additionalEffects: ['Plus 1d8 poison damage. Target must succeed on a DC 11 Constitution saving throw or be poisoned for 1 minute.'] },
      { name: 'Claws', toHitBonus: 4, damage: { count: 2, die: 4, type: 'slashing', bonus: 2 }, reach: 5 },
    ], spellcasting: null, features: [
      { id: 'spider_climb_ettercap', name: 'Spider Climb', description: 'The ettercap can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check.', source: 'ettercap' },
      { id: 'web_sense_ettercap', name: 'Web Sense', description: 'While in contact with a web, the ettercap knows the exact location of any other creature in contact with the same web.', source: 'ettercap' },
      { id: 'web_walker_ettercap', name: 'Web Walker', description: 'The ettercap ignores movement restrictions caused by webbing.', source: 'ettercap' },
      { id: 'multiattack_ettercap', name: 'Multiattack', description: 'The ettercap makes two attacks: one with its bite and one with its claws.', source: 'ettercap' },
    ], conditions: [], size: 'medium', resistances: [], immunities: [], vulnerabilities: [], conditionImmunities: [] },
  },
  {
    id: 'monster_gargoyle', name: 'Gargoyle', size: 'medium', type: 'elemental', alignment: 'chaotic evil', cr: 2, xp: 450,
    description: 'A stone elemental that disguises itself as a building ornament, swooping down to attack the unsuspecting.',
    stats: { abilityScores: { strength: 15, dexterity: 11, constitution: 16, intelligence: 6, wisdom: 11, charisma: 7 }, maxHp: 52, currentHp: 52, armorClass: 15, speed: 60, level: 4, attacks: [
      { name: 'Bite', toHitBonus: 4, damage: { count: 1, die: 6, type: 'piercing', bonus: 2 }, reach: 5 },
      { name: 'Claws', toHitBonus: 4, damage: { count: 1, die: 6, type: 'slashing', bonus: 2 }, reach: 5 },
    ], spellcasting: null, features: [
      { id: 'false_appearance_gargoyle', name: 'False Appearance', description: 'While the gargoyle remains motionless, it is indistinguishable from an inanimate statue.', source: 'gargoyle' },
      { id: 'multiattack_gargoyle', name: 'Multiattack', description: 'The gargoyle makes two attacks: one with its bite and one with its claws.', source: 'gargoyle' },
    ], conditions: [], size: 'medium', resistances: ['bludgeoning', 'piercing', 'slashing'], immunities: ['poison'], vulnerabilities: [], conditionImmunities: ['exhaustion', 'petrified', 'poisoned'] },
  },
  {
    id: 'monster_gelatinous_cube', name: 'Gelatinous Cube', size: 'large', type: 'ooze', alignment: 'unaligned', cr: 2, xp: 450,
    description: 'A transparent cube of corrosive jelly that engulfs everything in its path through dungeon corridors.',
    stats: { abilityScores: { strength: 14, dexterity: 3, constitution: 20, intelligence: 1, wisdom: 6, charisma: 1 }, maxHp: 84, currentHp: 84, armorClass: 6, speed: 15, level: 4, attacks: [
      { name: 'Pseudopod', toHitBonus: 4, damage: { count: 3, die: 6, type: 'acid' }, reach: 5 },
    ], spellcasting: null, features: [
      { id: 'ooze_cube_gelatinous', name: 'Ooze Cube', description: 'The cube takes up its entire space. Other creatures can enter the space, but a creature that does so is subjected to the cube\'s Engulf and has disadvantage on the saving throw. A creature can see the cube only if it succeeds on a DC 15 Wisdom (Perception) check.', source: 'gelatinous_cube' },
      { id: 'engulf_gelatinous', name: 'Engulf', description: 'The cube moves up to its speed. While doing so, it can enter Large or smaller creatures\' spaces. Whenever the cube enters a creature\'s space, the creature must make a DC 12 Dexterity saving throw. On a success, the creature can choose to be pushed 5 feet back or to the side. On a failure, the cube enters the creature\'s space, and the creature takes 3d6 acid damage and is engulfed.', source: 'gelatinous_cube' },
      { id: 'transparent_gelatinous', name: 'Transparent', description: 'Even when the cube is in plain sight, it takes a successful DC 15 Wisdom (Perception) check to spot a cube that has neither moved nor attacked.', source: 'gelatinous_cube' },
    ], conditions: [], size: 'large', resistances: [], immunities: [], vulnerabilities: [], conditionImmunities: ['blinded', 'charmed', 'deafened', 'exhaustion', 'frightened', 'prone'] },
  },
  {
    id: 'monster_ghast', name: 'Ghast', size: 'medium', type: 'undead', alignment: 'chaotic evil', cr: 2, xp: 450,
    description: 'A more powerful ghoul whose stench can sicken the living and whose claws paralyze even elves.',
    stats: { abilityScores: { strength: 16, dexterity: 17, constitution: 10, intelligence: 11, wisdom: 10, charisma: 8 }, maxHp: 36, currentHp: 36, armorClass: 13, speed: 30, level: 4, attacks: [
      { name: 'Bite', toHitBonus: 3, damage: { count: 2, die: 8, type: 'piercing', bonus: 3 }, reach: 5 },
      { name: 'Claws', toHitBonus: 5, damage: { count: 2, die: 6, type: 'slashing', bonus: 3 }, reach: 5, additionalEffects: ['Target must succeed on a DC 10 Constitution saving throw or be paralyzed for 1 minute. The target can repeat the saving throw at the end of each of its turns.'] },
    ], spellcasting: null, features: [
      { id: 'stench_ghast', name: 'Stench', description: 'Any creature that starts its turn within 5 feet of the ghast must succeed on a DC 10 Constitution saving throw or be poisoned until the start of its next turn.', source: 'ghast' },
      { id: 'turning_defiance_ghast', name: 'Turning Defiance', description: 'The ghast and any ghouls within 30 feet of it have advantage on saving throws against effects that turn undead.', source: 'ghast' },
    ], conditions: [], size: 'medium', resistances: [], immunities: ['poison'], vulnerabilities: [], conditionImmunities: ['charmed', 'exhaustion', 'poisoned'] },
  },
  {
    id: 'monster_giant_boar', name: 'Giant Boar', size: 'large', type: 'beast', alignment: 'unaligned', cr: 2, xp: 450,
    description: 'A massive wild boar with devastating tusks and relentless aggression.',
    stats: { abilityScores: { strength: 17, dexterity: 10, constitution: 16, intelligence: 2, wisdom: 7, charisma: 5 }, maxHp: 42, currentHp: 42, armorClass: 12, speed: 40, level: 4, attacks: [
      { name: 'Tusk', toHitBonus: 5, damage: { count: 2, die: 6, type: 'slashing', bonus: 3 }, reach: 5 },
    ], spellcasting: null, features: [
      { id: 'charge_giant_boar', name: 'Charge', description: 'If the boar moves at least 20 feet straight toward a target and then hits it with a tusk attack on the same turn, the target takes an extra 2d6 slashing damage. If the target is a creature, it must succeed on a DC 13 Strength saving throw or be knocked prone.', source: 'giant_boar' },
      { id: 'relentless_giant_boar', name: 'Relentless (Recharges after a Short or Long Rest)', description: 'If the boar takes 10 damage or less that would reduce it to 0 hit points, it is reduced to 1 hit point instead.', source: 'giant_boar' },
    ], conditions: [], size: 'large', resistances: [], immunities: [], vulnerabilities: [], conditionImmunities: [] },
  },
  {
    id: 'monster_giant_constrictor_snake', name: 'Giant Constrictor Snake', size: 'huge', type: 'beast', alignment: 'unaligned', cr: 2, xp: 450,
    description: 'An enormous serpent capable of crushing even large creatures in its coils.',
    stats: { abilityScores: { strength: 19, dexterity: 14, constitution: 12, intelligence: 1, wisdom: 10, charisma: 3 }, maxHp: 60, currentHp: 60, armorClass: 12, speed: 30, level: 4, attacks: [
      { name: 'Bite', toHitBonus: 6, damage: { count: 2, die: 6, type: 'piercing', bonus: 4 }, reach: 10 },
      { name: 'Constrict', toHitBonus: 6, damage: { count: 2, die: 8, type: 'bludgeoning', bonus: 4 }, reach: 5, additionalEffects: ['Target is grappled (escape DC 16). Until this grapple ends, the creature is restrained.'] },
    ], spellcasting: null, features: [], conditions: [], size: 'huge', resistances: [], immunities: [], vulnerabilities: [], conditionImmunities: [] },
  },
  {
    id: 'monster_giant_elk', name: 'Giant Elk', size: 'huge', type: 'beast', alignment: 'unaligned', cr: 2, xp: 450,
    description: 'A magnificent elk of enormous proportions, considered sacred by many woodland peoples.',
    stats: { abilityScores: { strength: 19, dexterity: 16, constitution: 14, intelligence: 7, wisdom: 14, charisma: 10 }, maxHp: 42, currentHp: 42, armorClass: 14, speed: 60, level: 4, attacks: [
      { name: 'Ram', toHitBonus: 6, damage: { count: 2, die: 6, type: 'bludgeoning', bonus: 4 }, reach: 10 },
      { name: 'Hooves', toHitBonus: 6, damage: { count: 4, die: 8, type: 'bludgeoning', bonus: 4 }, reach: 5 },
    ], spellcasting: null, features: [
      { id: 'charge_giant_elk', name: 'Charge', description: 'If the elk moves at least 20 feet straight toward a target and then hits it with a ram attack on the same turn, the target takes an extra 2d6 bludgeoning damage. If the target is a creature, it must succeed on a DC 14 Strength saving throw or be knocked prone.', source: 'giant_elk' },
    ], conditions: [], size: 'huge', resistances: [], immunities: [], vulnerabilities: [], conditionImmunities: [] },
  },
  {
    id: 'monster_gibbering_mouther', name: 'Gibbering Mouther', size: 'medium', type: 'aberration', alignment: 'neutral', cr: 2, xp: 450,
    description: 'A horrifying blob of flesh, eyes, and mouths that babbles incessantly, driving those who hear it mad.',
    stats: { abilityScores: { strength: 10, dexterity: 8, constitution: 16, intelligence: 3, wisdom: 10, charisma: 6 }, maxHp: 67, currentHp: 67, armorClass: 9, speed: 10, level: 4, attacks: [
      { name: 'Bites', toHitBonus: 2, damage: { count: 5, die: 6, type: 'piercing' }, reach: 5, additionalEffects: ['If the target is Medium or smaller, it must succeed on a DC 10 Strength saving throw or be knocked prone. If the target is killed, it is absorbed into the mouther.'] },
    ], spellcasting: null, features: [
      { id: 'aberrant_ground_mouther', name: 'Aberrant Ground', description: 'The ground in a 10-foot radius around the mouther is dough-like difficult terrain. Each creature that starts its turn in that area must succeed on a DC 10 Strength saving throw or have its speed reduced to 0 until the start of its next turn.', source: 'gibbering_mouther' },
      { id: 'gibbering_mouther_feature', name: 'Gibbering', description: 'The mouther babbles incoherently while it can see any creature and isn\'t incapacitated. Each creature that starts its turn within 20 feet of the mouther and can hear the gibbering must succeed on a DC 10 Wisdom saving throw. On a failure, the creature can\'t take reactions until the start of its next turn and rolls a d8 to determine what it does during its turn.', source: 'gibbering_mouther' },
    ], conditions: [], size: 'medium', resistances: [], immunities: [], vulnerabilities: [], conditionImmunities: ['prone'] },
  },
  {
    id: 'monster_griffon', name: 'Griffon', size: 'large', type: 'monstrosity', alignment: 'unaligned', cr: 2, xp: 450,
    description: 'A powerful flying predator with the body of a lion and the head and wings of an eagle.',
    stats: { abilityScores: { strength: 18, dexterity: 15, constitution: 16, intelligence: 2, wisdom: 13, charisma: 8 }, maxHp: 59, currentHp: 59, armorClass: 12, speed: 80, level: 4, attacks: [
      { name: 'Beak', toHitBonus: 6, damage: { count: 1, die: 8, type: 'piercing', bonus: 4 }, reach: 5 },
      { name: 'Claws', toHitBonus: 6, damage: { count: 2, die: 6, type: 'slashing', bonus: 4 }, reach: 5 },
    ], spellcasting: null, features: [
      { id: 'keen_sight_griffon', name: 'Keen Sight', description: 'The griffon has advantage on Wisdom (Perception) checks that rely on sight.', source: 'griffon' },
      { id: 'multiattack_griffon', name: 'Multiattack', description: 'The griffon makes two attacks: one with its beak and one with its claws.', source: 'griffon' },
    ], conditions: [], size: 'large', resistances: [], immunities: [], vulnerabilities: [], conditionImmunities: [] },
  },
  {
    id: 'monster_guard_drake', name: 'Guard Drake', size: 'medium', type: 'dragon', alignment: 'unaligned', cr: 2, xp: 450,
    description: 'A reptilian creature bred by dragonborn to serve as a loyal guardian.',
    stats: { abilityScores: { strength: 16, dexterity: 11, constitution: 16, intelligence: 4, wisdom: 10, charisma: 7 }, maxHp: 52, currentHp: 52, armorClass: 14, speed: 30, level: 4, attacks: [
      { name: 'Bite', toHitBonus: 5, damage: { count: 1, die: 8, type: 'piercing', bonus: 3 }, reach: 5 },
      { name: 'Tail', toHitBonus: 5, damage: { count: 1, die: 6, type: 'bludgeoning', bonus: 3 }, reach: 5 },
    ], spellcasting: null, features: [
      { id: 'multiattack_guard_drake', name: 'Multiattack', description: 'The guard drake makes two attacks: one with its bite and one with its tail.', source: 'guard_drake' },
    ], conditions: [], size: 'medium', resistances: [], immunities: [], vulnerabilities: [], conditionImmunities: [] },
  },
  {
    id: 'monster_hunter_shark', name: 'Hunter Shark', size: 'large', type: 'beast', alignment: 'unaligned', cr: 2, xp: 450,
    description: 'A large, aggressive shark that attacks with relentless ferocity.',
    stats: { abilityScores: { strength: 18, dexterity: 13, constitution: 15, intelligence: 1, wisdom: 10, charisma: 4 }, maxHp: 45, currentHp: 45, armorClass: 12, speed: 40, level: 4, attacks: [
      { name: 'Bite', toHitBonus: 6, damage: { count: 2, die: 8, type: 'piercing', bonus: 4 }, reach: 5 },
    ], spellcasting: null, features: [
      { id: 'blood_frenzy_hunter_shark', name: 'Blood Frenzy', description: 'The shark has advantage on melee attack rolls against any creature that doesn\'t have all its hit points.', source: 'hunter_shark' },
      { id: 'water_breathing_hunter_shark', name: 'Water Breathing', description: 'The shark can breathe only underwater.', source: 'hunter_shark' },
    ], conditions: [], size: 'large', resistances: [], immunities: [], vulnerabilities: [], conditionImmunities: [] },
  },
  {
    id: 'monster_lizardfolk_shaman', name: 'Lizardfolk Shaman', size: 'medium', type: 'humanoid', alignment: 'neutral', cr: 2, xp: 450,
    description: 'A lizardfolk spellcaster who channels the primal magic of their swamp homeland.',
    stats: { abilityScores: { strength: 15, dexterity: 10, constitution: 13, intelligence: 10, wisdom: 15, charisma: 8 }, maxHp: 27, currentHp: 27, armorClass: 13, speed: 30, level: 4, attacks: [
      { name: 'Bite', toHitBonus: 4, damage: { count: 1, die: 6, type: 'piercing', bonus: 2 }, reach: 5 },
      { name: 'Club', toHitBonus: 4, damage: { count: 1, die: 6, type: 'bludgeoning', bonus: 2 }, reach: 5 },
    ], spellcasting: null, features: [
      { id: 'spellcasting_lizardfolk_shaman', name: 'Spellcasting', description: 'The shaman is a 5th-level spellcaster (spell save DC 12, +4 to hit). Cantrips: Druidcraft, Produce Flame, Thorn Whip. 1st level (4 slots): Entangle, Fog Cloud. 2nd level (3 slots): Heat Metal, Spike Growth. 3rd level (2 slots): Conjure Animals, Plant Growth.', source: 'lizardfolk_shaman' },
      { id: 'multiattack_lizardfolk_shaman', name: 'Multiattack', description: 'The shaman makes two attacks: one with its bite and one with its club.', source: 'lizardfolk_shaman' },
    ], conditions: [], size: 'medium', resistances: [], immunities: [], vulnerabilities: [], conditionImmunities: [] },
  },
  {
    id: 'monster_merrow', name: 'Merrow', size: 'large', type: 'monstrosity', alignment: 'chaotic evil', cr: 2, xp: 450,
    description: 'Aquatic ogre-like creatures corrupted by abyssal influence, preying upon coastal settlements.',
    stats: { abilityScores: { strength: 18, dexterity: 10, constitution: 15, intelligence: 8, wisdom: 10, charisma: 9 }, maxHp: 45, currentHp: 45, armorClass: 13, speed: 40, level: 4, attacks: [
      { name: 'Bite', toHitBonus: 6, damage: { count: 1, die: 8, type: 'piercing', bonus: 4 }, reach: 5 },
      { name: 'Claws', toHitBonus: 6, damage: { count: 2, die: 4, type: 'slashing', bonus: 4 }, reach: 5 },
      { name: 'Harpoon', toHitBonus: 6, damage: { count: 2, die: 6, type: 'piercing', bonus: 4 }, reach: 5, rangeNormal: 20, rangeLong: 60 },
    ], spellcasting: null, features: [
      { id: 'amphibious_merrow', name: 'Amphibious', description: 'The merrow can breathe air and water.', source: 'merrow' },
      { id: 'multiattack_merrow', name: 'Multiattack', description: 'The merrow makes two attacks: one with its bite and one with its claws or harpoon.', source: 'merrow' },
    ], conditions: [], size: 'large', resistances: [], immunities: [], vulnerabilities: [], conditionImmunities: [] },
  },
  {
    id: 'monster_mimic', name: 'Mimic', size: 'medium', type: 'monstrosity', alignment: 'neutral', cr: 2, xp: 450,
    description: 'A shapeshifting predator that disguises itself as an object such as a chest to lure unwary prey.',
    stats: { abilityScores: { strength: 17, dexterity: 12, constitution: 15, intelligence: 5, wisdom: 13, charisma: 8 }, maxHp: 58, currentHp: 58, armorClass: 12, speed: 15, level: 4, attacks: [
      { name: 'Pseudopod', toHitBonus: 5, damage: { count: 1, die: 8, type: 'bludgeoning', bonus: 3 }, reach: 5 },
      { name: 'Bite', toHitBonus: 5, damage: { count: 1, die: 8, type: 'piercing', bonus: 3 }, reach: 5, additionalEffects: ['Plus 1d8 acid damage.'] },
    ], spellcasting: null, features: [
      { id: 'shapechanger_mimic', name: 'Shapechanger', description: 'The mimic can use its action to polymorph into an object or back into its true, amorphous form. Its statistics are the same in each form.', source: 'mimic' },
      { id: 'adhesive_mimic', name: 'Adhesive (Object Form Only)', description: 'The mimic adheres to anything that touches it. A Huge or smaller creature adhered to the mimic is also grappled by it (escape DC 13). Ability checks made to escape this grapple have disadvantage.', source: 'mimic' },
      { id: 'false_appearance_mimic', name: 'False Appearance (Object Form Only)', description: 'While the mimic remains motionless, it is indistinguishable from an ordinary object.', source: 'mimic' },
      { id: 'grappler_mimic', name: 'Grappler', description: 'The mimic has advantage on attack rolls against any creature grappled by it.', source: 'mimic' },
    ], conditions: [], size: 'medium', resistances: [], immunities: ['acid'], vulnerabilities: [], conditionImmunities: ['prone'] },
  },
  {
    id: 'monster_minotaur_skeleton', name: 'Minotaur Skeleton', size: 'large', type: 'undead', alignment: 'lawful evil', cr: 2, xp: 450,
    description: 'The animated skeleton of a minotaur, retaining its brutish strength and charging capability.',
    stats: { abilityScores: { strength: 18, dexterity: 11, constitution: 15, intelligence: 6, wisdom: 8, charisma: 5 }, maxHp: 67, currentHp: 67, armorClass: 12, speed: 40, level: 4, attacks: [
      { name: 'Greataxe', toHitBonus: 6, damage: { count: 2, die: 12, type: 'slashing', bonus: 4 }, reach: 5 },
      { name: 'Gore', toHitBonus: 6, damage: { count: 2, die: 8, type: 'piercing', bonus: 4 }, reach: 5 },
    ], spellcasting: null, features: [
      { id: 'charge_minotaur_skeleton', name: 'Charge', description: 'If the skeleton moves at least 10 feet straight toward a target and then hits it with a gore attack on the same turn, the target takes an extra 2d8 piercing damage. If the target is a creature, it must succeed on a DC 14 Strength saving throw or be pushed up to 10 feet away and knocked prone.', source: 'minotaur_skeleton' },
    ], conditions: [], size: 'large', resistances: [], immunities: ['poison'], vulnerabilities: ['bludgeoning'], conditionImmunities: ['exhaustion', 'poisoned'] },
  },
  {
    id: 'monster_ochre_jelly', name: 'Ochre Jelly', size: 'large', type: 'ooze', alignment: 'unaligned', cr: 2, xp: 450,
    description: 'A yellowish ooze that splits into smaller copies when struck by lightning or slashing damage.',
    stats: { abilityScores: { strength: 15, dexterity: 6, constitution: 14, intelligence: 2, wisdom: 6, charisma: 1 }, maxHp: 45, currentHp: 45, armorClass: 8, speed: 10, level: 4, attacks: [
      { name: 'Pseudopod', toHitBonus: 4, damage: { count: 2, die: 6, type: 'bludgeoning', bonus: 2 }, reach: 5, additionalEffects: ['Plus 1d6 acid damage.'] },
    ], spellcasting: null, features: [
      { id: 'amorphous_ochre_jelly', name: 'Amorphous', description: 'The jelly can move through a space as narrow as 1 inch wide without squeezing.', source: 'ochre_jelly' },
      { id: 'spider_climb_ochre_jelly', name: 'Spider Climb', description: 'The jelly can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check.', source: 'ochre_jelly' },
      { id: 'split_ochre_jelly', name: 'Split', description: 'When a jelly that is Medium or larger is subjected to lightning or slashing damage, it splits into two new jellies if it has at least 10 hit points. Each new jelly has hit points equal to half the original jelly\'s, rounded down. New jellies are one size smaller than the original jelly.', source: 'ochre_jelly' },
    ], conditions: [], size: 'large', resistances: ['acid'], immunities: ['lightning', 'slashing'], vulnerabilities: [], conditionImmunities: ['blinded', 'charmed', 'deafened', 'exhaustion', 'frightened', 'prone'] },
  },
  {
    id: 'monster_pegasus', name: 'Pegasus', size: 'large', type: 'celestial', alignment: 'chaotic good', cr: 2, xp: 450,
    description: 'A magnificent winged horse that serves as a mount for heroes and celestial beings.',
    stats: { abilityScores: { strength: 18, dexterity: 15, constitution: 16, intelligence: 10, wisdom: 15, charisma: 13 }, maxHp: 59, currentHp: 59, armorClass: 12, speed: 90, level: 4, attacks: [
      { name: 'Hooves', toHitBonus: 6, damage: { count: 2, die: 6, type: 'bludgeoning', bonus: 4 }, reach: 5 },
    ], spellcasting: null, features: [], conditions: [], size: 'large', resistances: [], immunities: [], vulnerabilities: [], conditionImmunities: [] },
  },
  {
    id: 'monster_plesiosaurus', name: 'Plesiosaurus', size: 'large', type: 'beast', alignment: 'unaligned', cr: 2, xp: 450,
    description: 'A large aquatic reptile with a long neck and powerful flippers.',
    stats: { abilityScores: { strength: 18, dexterity: 15, constitution: 16, intelligence: 2, wisdom: 12, charisma: 5 }, maxHp: 68, currentHp: 68, armorClass: 13, speed: 40, level: 4, attacks: [
      { name: 'Bite', toHitBonus: 6, damage: { count: 3, die: 6, type: 'piercing', bonus: 4 }, reach: 10 },
    ], spellcasting: null, features: [
      { id: 'hold_breath_plesiosaurus', name: 'Hold Breath', description: 'The plesiosaurus can hold its breath for 1 hour.', source: 'plesiosaurus' },
    ], conditions: [], size: 'large', resistances: [], immunities: [], vulnerabilities: [], conditionImmunities: [] },
  },
  {
    id: 'monster_polar_bear', name: 'Polar Bear', size: 'large', type: 'beast', alignment: 'unaligned', cr: 2, xp: 450,
    description: 'A massive white bear adapted to arctic environments, an apex predator of the frozen north.',
    stats: { abilityScores: { strength: 20, dexterity: 10, constitution: 16, intelligence: 2, wisdom: 13, charisma: 7 }, maxHp: 42, currentHp: 42, armorClass: 12, speed: 40, level: 4, attacks: [
      { name: 'Bite', toHitBonus: 7, damage: { count: 1, die: 8, type: 'piercing', bonus: 5 }, reach: 5 },
      { name: 'Claws', toHitBonus: 7, damage: { count: 2, die: 6, type: 'slashing', bonus: 5 }, reach: 5 },
    ], spellcasting: null, features: [
      { id: 'keen_smell_polar_bear', name: 'Keen Smell', description: 'The bear has advantage on Wisdom (Perception) checks that rely on smell.', source: 'polar_bear' },
      { id: 'multiattack_polar_bear', name: 'Multiattack', description: 'The bear makes two attacks: one with its bite and one with its claws.', source: 'polar_bear' },
    ], conditions: [], size: 'large', resistances: [], immunities: [], vulnerabilities: [], conditionImmunities: [] },
  },
  {
    id: 'monster_priest', name: 'Priest', size: 'medium', type: 'humanoid', alignment: 'any alignment', cr: 2, xp: 450,
    description: 'A divine spellcaster who serves a deity, wielding holy magic to heal allies and smite foes.',
    stats: { abilityScores: { strength: 10, dexterity: 10, constitution: 12, intelligence: 13, wisdom: 16, charisma: 13 }, maxHp: 27, currentHp: 27, armorClass: 13, speed: 30, level: 4, attacks: [
      { name: 'Mace', toHitBonus: 2, damage: { count: 1, die: 6, type: 'bludgeoning' }, reach: 5 },
    ], spellcasting: null, features: [
      { id: 'divine_eminence_priest', name: 'Divine Eminence', description: 'As a bonus action, the priest can expend a spell slot to cause its melee weapon attacks to magically deal an extra 3d6 radiant damage to a target on a hit (1st-level slot) or more for higher slots.', source: 'priest' },
      { id: 'spellcasting_priest', name: 'Spellcasting', description: 'The priest is a 5th-level spellcaster (spell save DC 13, +5 to hit). Cantrips: Light, Sacred Flame, Thaumaturgy. 1st level (4 slots): Cure Wounds, Guiding Bolt, Sanctuary. 2nd level (3 slots): Lesser Restoration, Spiritual Weapon. 3rd level (2 slots): Dispel Magic, Spirit Guardians.', source: 'priest' },
    ], conditions: [], size: 'medium', resistances: [], immunities: [], vulnerabilities: [], conditionImmunities: [] },
  },
  {
    id: 'monster_quaggoth', name: 'Quaggoth', size: 'medium', type: 'humanoid', alignment: 'chaotic neutral', cr: 2, xp: 450,
    description: 'A hulking, shaggy humanoid of the Underdark that fights with berserk fury.',
    stats: { abilityScores: { strength: 17, dexterity: 12, constitution: 16, intelligence: 6, wisdom: 12, charisma: 7 }, maxHp: 45, currentHp: 45, armorClass: 13, speed: 30, level: 4, attacks: [
      { name: 'Claw', toHitBonus: 5, damage: { count: 1, die: 6, type: 'slashing', bonus: 3 }, reach: 5 },
    ], spellcasting: null, features: [
      { id: 'wounded_fury_quaggoth', name: 'Wounded Fury', description: 'While it has 10 hit points or fewer, the quaggoth has advantage on attack rolls. In addition, it deals an extra 2d6 damage to any target it hits with a melee attack.', source: 'quaggoth' },
      { id: 'multiattack_quaggoth', name: 'Multiattack', description: 'The quaggoth makes two claw attacks.', source: 'quaggoth' },
    ], conditions: [], size: 'medium', resistances: [], immunities: ['poison'], vulnerabilities: [], conditionImmunities: ['poisoned'] },
  },
  {
    id: 'monster_rhinoceros', name: 'Rhinoceros', size: 'large', type: 'beast', alignment: 'unaligned', cr: 2, xp: 450,
    description: 'A massive, thick-skinned herbivore with a devastating horn charge.',
    stats: { abilityScores: { strength: 21, dexterity: 8, constitution: 15, intelligence: 2, wisdom: 12, charisma: 6 }, maxHp: 45, currentHp: 45, armorClass: 11, speed: 40, level: 4, attacks: [
      { name: 'Gore', toHitBonus: 7, damage: { count: 2, die: 8, type: 'bludgeoning', bonus: 5 }, reach: 5 },
    ], spellcasting: null, features: [
      { id: 'charge_rhinoceros', name: 'Charge', description: 'If the rhinoceros moves at least 20 feet straight toward a target and then hits it with a gore attack on the same turn, the target takes an extra 2d8 bludgeoning damage. If the target is a creature, it must succeed on a DC 15 Strength saving throw or be knocked prone.', source: 'rhinoceros' },
    ], conditions: [], size: 'large', resistances: [], immunities: [], vulnerabilities: [], conditionImmunities: [] },
  },
  {
    id: 'monster_rug_of_smothering', name: 'Rug of Smothering', size: 'large', type: 'construct', alignment: 'unaligned', cr: 2, xp: 450,
    description: 'An animated rug that wraps around victims and suffocates them.',
    stats: { abilityScores: { strength: 17, dexterity: 14, constitution: 10, intelligence: 1, wisdom: 3, charisma: 1 }, maxHp: 33, currentHp: 33, armorClass: 12, speed: 10, level: 4, attacks: [
      { name: 'Smother', toHitBonus: 5, damage: { count: 2, die: 6, type: 'bludgeoning', bonus: 3 }, reach: 5, additionalEffects: ['Target is grappled (escape DC 13). Until this grapple ends, the target is restrained, blinded, and at risk of suffocating.'] },
    ], spellcasting: null, features: [
      { id: 'antimagic_susceptibility_rug', name: 'Antimagic Susceptibility', description: 'The rug is incapacitated while in the area of an antimagic field.', source: 'rug_of_smothering' },
      { id: 'damage_transfer_rug', name: 'Damage Transfer', description: 'While it is grappling a creature, the rug takes only half the damage dealt to it, and the creature grappled by the rug takes the other half.', source: 'rug_of_smothering' },
      { id: 'false_appearance_rug', name: 'False Appearance', description: 'While the rug remains motionless, it is indistinguishable from a normal rug.', source: 'rug_of_smothering' },
    ], conditions: [], size: 'large', resistances: [], immunities: ['poison', 'psychic'], vulnerabilities: [], conditionImmunities: ['blinded', 'charmed', 'deafened', 'frightened', 'paralyzed', 'petrified', 'poisoned'] },
  },
  {
    id: 'monster_saber_toothed_tiger', name: 'Saber-Toothed Tiger', size: 'large', type: 'beast', alignment: 'unaligned', cr: 2, xp: 450,
    description: 'A massive prehistoric cat with enormous fangs that can bring down the largest prey.',
    stats: { abilityScores: { strength: 18, dexterity: 14, constitution: 15, intelligence: 3, wisdom: 12, charisma: 8 }, maxHp: 52, currentHp: 52, armorClass: 12, speed: 40, level: 4, attacks: [
      { name: 'Bite', toHitBonus: 6, damage: { count: 1, die: 10, type: 'piercing', bonus: 5 }, reach: 5 },
      { name: 'Claw', toHitBonus: 6, damage: { count: 2, die: 6, type: 'slashing', bonus: 5 }, reach: 5 },
    ], spellcasting: null, features: [
      { id: 'keen_smell_saber_tooth', name: 'Keen Smell', description: 'The tiger has advantage on Wisdom (Perception) checks that rely on smell.', source: 'saber_toothed_tiger' },
      { id: 'pounce_saber_tooth', name: 'Pounce', description: 'If the tiger moves at least 20 feet straight toward a creature and then hits it with a claw attack on the same turn, that target must succeed on a DC 14 Strength saving throw or be knocked prone. If the target is prone, the tiger can make one bite attack against it as a bonus action.', source: 'saber_toothed_tiger' },
    ], conditions: [], size: 'large', resistances: [], immunities: [], vulnerabilities: [], conditionImmunities: [] },
  },
  {
    id: 'monster_sea_hag', name: 'Sea Hag', size: 'medium', type: 'fey', alignment: 'chaotic evil', cr: 2, xp: 450,
    description: 'A hideous fey creature that dwells in underwater caves, using its horrific appearance to frighten victims to death.',
    stats: { abilityScores: { strength: 16, dexterity: 13, constitution: 16, intelligence: 12, wisdom: 12, charisma: 13 }, maxHp: 52, currentHp: 52, armorClass: 14, speed: 40, level: 4, attacks: [
      { name: 'Claws', toHitBonus: 5, damage: { count: 2, die: 6, type: 'slashing', bonus: 3 }, reach: 5 },
    ], spellcasting: null, features: [
      { id: 'amphibious_sea_hag', name: 'Amphibious', description: 'The hag can breathe air and water.', source: 'sea_hag' },
      { id: 'horrific_appearance_sea_hag', name: 'Horrific Appearance', description: 'Any humanoid that starts its turn within 30 feet of the hag and can see the hag\'s true form must make a DC 11 Wisdom saving throw. On a failed save, the creature is frightened for 1 minute.', source: 'sea_hag' },
      { id: 'death_glare_sea_hag', name: 'Death Glare', description: 'If a frightened creature starts its turn within 30 feet of the hag and can see the hag, the hag can force it to make a DC 11 Wisdom saving throw. If the saving throw fails by 5 or more, the creature drops to 0 hit points. Otherwise, it takes 3d6 psychic damage.', source: 'sea_hag' },
    ], conditions: [], size: 'medium', resistances: [], immunities: [], vulnerabilities: [], conditionImmunities: [] },
  },
  {
    id: 'monster_swarm_of_poisonous_snakes', name: 'Swarm of Poisonous Snakes', size: 'medium', type: 'beast', alignment: 'unaligned', cr: 2, xp: 450,
    description: 'A writhing mass of venomous snakes that overwhelms prey with dozens of toxic bites.',
    stats: { abilityScores: { strength: 8, dexterity: 18, constitution: 11, intelligence: 1, wisdom: 10, charisma: 3 }, maxHp: 36, currentHp: 36, armorClass: 14, speed: 30, level: 4, attacks: [
      { name: 'Bites', toHitBonus: 6, damage: { count: 2, die: 6, type: 'piercing' }, reach: 0, additionalEffects: ['Or 1d6 piercing damage if the swarm has half of its hit points or fewer. Target must make a DC 10 Constitution saving throw, taking 4d6 poison damage on a failed save, or half on a success.'] },
    ], spellcasting: null, features: [
      { id: 'swarm_snakes', name: 'Swarm', description: 'The swarm can occupy another creature\'s space and vice versa, and the swarm can move through any opening large enough for a Tiny snake. The swarm can\'t regain hit points or gain temporary hit points.', source: 'swarm_of_poisonous_snakes' },
    ], conditions: [], size: 'medium', resistances: ['bludgeoning', 'piercing', 'slashing'], immunities: [], vulnerabilities: [], conditionImmunities: ['charmed', 'frightened', 'grappled', 'paralyzed', 'petrified', 'prone', 'restrained', 'stunned'] },
  },
  {
    id: 'monster_wererat', name: 'Wererat', size: 'medium', type: 'humanoid', alignment: 'lawful evil', cr: 2, xp: 450,
    description: 'A lycanthrope that can shift between human, rat, and hybrid forms, skulking in sewers and criminal underworlds.',
    stats: { abilityScores: { strength: 10, dexterity: 15, constitution: 12, intelligence: 11, wisdom: 10, charisma: 8 }, maxHp: 33, currentHp: 33, armorClass: 12, speed: 30, level: 4, attacks: [
      { name: 'Bite (Rat or Hybrid Form)', toHitBonus: 4, damage: { count: 1, die: 4, type: 'piercing', bonus: 2 }, reach: 5, additionalEffects: ['If the target is a humanoid, it must succeed on a DC 11 Constitution saving throw or be cursed with wererat lycanthropy.'] },
      { name: 'Shortsword (Humanoid or Hybrid Form)', toHitBonus: 4, damage: { count: 1, die: 6, type: 'piercing', bonus: 2 }, reach: 5 },
      { name: 'Hand Crossbow (Humanoid or Hybrid Form)', toHitBonus: 4, damage: { count: 1, die: 6, type: 'piercing', bonus: 2 }, reach: 0, rangeNormal: 30, rangeLong: 120 },
    ], spellcasting: null, features: [
      { id: 'shapechanger_wererat', name: 'Shapechanger', description: 'The wererat can use its action to polymorph into a rat-humanoid hybrid or into a giant rat, or back into its true form, which is humanoid.', source: 'wererat' },
      { id: 'keen_smell_wererat', name: 'Keen Smell', description: 'The wererat has advantage on Wisdom (Perception) checks that rely on smell.', source: 'wererat' },
      { id: 'multiattack_wererat', name: 'Multiattack (Humanoid or Hybrid Form)', description: 'The wererat makes two attacks, one of which can be a bite.', source: 'wererat' },
    ], conditions: [], size: 'medium', resistances: ['bludgeoning', 'piercing', 'slashing'], immunities: [], vulnerabilities: [], conditionImmunities: [] },
  },
  {
    id: 'monster_will_o_wisp', name: 'Will-o\'-Wisp', size: 'tiny', type: 'undead', alignment: 'chaotic evil', cr: 2, xp: 450,
    description: 'A ghostly ball of light that lures travelers into deadly traps, feeding on their dying despair.',
    stats: { abilityScores: { strength: 1, dexterity: 28, constitution: 10, intelligence: 13, wisdom: 14, charisma: 11 }, maxHp: 22, currentHp: 22, armorClass: 19, speed: 50, level: 4, attacks: [
      { name: 'Shock', toHitBonus: 4, damage: { count: 2, die: 8, type: 'lightning' }, reach: 5 },
    ], spellcasting: null, features: [
      { id: 'consume_life_will_o_wisp', name: 'Consume Life', description: 'As a bonus action, the will-o\'-wisp can target one creature it can see within 5 feet of it that has 0 hit points and is still alive. The target must succeed on a DC 10 Constitution saving throw against this magic or die. If the target dies, the will-o\'-wisp regains 3d6 hit points.', source: 'will_o_wisp' },
      { id: 'ephemeral_will_o_wisp', name: 'Ephemeral', description: 'The will-o\'-wisp can\'t wear or carry anything.', source: 'will_o_wisp' },
      { id: 'incorporeal_movement_will_o_wisp', name: 'Incorporeal Movement', description: 'The will-o\'-wisp can move through other creatures and objects as if they were difficult terrain. It takes 1d10 force damage if it ends its turn inside an object.', source: 'will_o_wisp' },
      { id: 'variable_illumination_will_o_wisp', name: 'Variable Illumination', description: 'The will-o\'-wisp sheds bright light in a 5- to 20-foot radius and dim light for an additional number of feet equal to the chosen radius. The will-o\'-wisp can alter the radius as a bonus action.', source: 'will_o_wisp' },
      { id: 'invisibility_will_o_wisp', name: 'Invisibility', description: 'The will-o\'-wisp and its light magically become invisible until it attacks or uses its Consume Life, or until its concentration ends.', source: 'will_o_wisp' },
    ], conditions: [], size: 'tiny', resistances: ['acid', 'cold', 'fire', 'necrotic', 'thunder', 'bludgeoning', 'piercing', 'slashing'], immunities: ['lightning', 'poison'], vulnerabilities: [], conditionImmunities: ['exhaustion', 'grappled', 'paralyzed', 'poisoned', 'prone', 'restrained', 'unconscious'] },
  },
];
