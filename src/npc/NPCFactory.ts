import type {
  AbilityScores,
  CompanionData,
  EntityId,
  NPC,
  NPCRole,
} from '@/types';
import { SeededRNG } from '@/utils/SeededRNG';
import { generateId } from '@/engine/IdGenerator';
import { proficiencyBonus } from '@/utils/math';

// ── Name tables ──────────────────────────────────────────────────────

const HUMAN_FIRST_NAMES = [
  'Aldric', 'Elara', 'Theron', 'Lyanna', 'Gareth', 'Miriel', 'Roderic',
  'Sybil', 'Calder', 'Isadora', 'Marcus', 'Helena', 'Dorian', 'Rowena',
  'Bran', 'Yvette', 'Cedric', 'Fiona', 'Willem', 'Astrid',
];

const ELF_FIRST_NAMES = [
  'Aelindra', 'Thalion', 'Caelynn', 'Faenor', 'Ilyana', 'Sylvaris',
  'Elowen', 'Galadhon', 'Liriel', 'Vaeris', 'Aranel', 'Thaelar',
  'Nimue', 'Eryndor', 'Sariel', 'Arandil', 'Ithilwen', 'Celeborn',
];

const DWARF_FIRST_NAMES = [
  'Thorin', 'Bruni', 'Grilda', 'Durin', 'Helga', 'Balin',
  'Kira', 'Gimrek', 'Hilda', 'Dain', 'Bera', 'Nori',
  'Dagni', 'Thrain', 'Agna', 'Bombur', 'Frera', 'Gloin',
];

const HALFLING_FIRST_NAMES = [
  'Pippin', 'Rosie', 'Milo', 'Tansy', 'Corrin', 'Lidda',
  'Jasper', 'Daisy', 'Merric', 'Poppy', 'Finnan', 'Lavinia',
  'Osborn', 'Marigold', 'Roscoe', 'Cora', 'Eldon', 'Lily',
];

const SURNAMES = [
  'Ashford', 'Blackwood', 'Copperfield', 'Dunstan', 'Everett',
  'Fairbanks', 'Greystone', 'Hawthorne', 'Ironforge', 'Kestrel',
  'Lightfoot', 'Moorland', 'Nightingale', 'Oakheart', 'Proudfoot',
  'Ravencroft', 'Silverhand', 'Thornwall', 'Underhill', 'Wyrmwood',
];

const NAME_POOLS: Record<string, string[]> = {
  human: HUMAN_FIRST_NAMES,
  elf: ELF_FIRST_NAMES,
  half_elf: [...HUMAN_FIRST_NAMES, ...ELF_FIRST_NAMES],
  dwarf: DWARF_FIRST_NAMES,
  halfling: HALFLING_FIRST_NAMES,
  gnome: HALFLING_FIRST_NAMES,
  dragonborn: HUMAN_FIRST_NAMES,
  tiefling: HUMAN_FIRST_NAMES,
  half_orc: HUMAN_FIRST_NAMES,
};

// ── Stat templates by role ───────────────────────────────────────────

function commmonerStats(level: number): AbilityScores {
  void level;
  return { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 };
}

function merchantStats(_level: number): AbilityScores {
  void _level;
  return { strength: 8, dexterity: 10, constitution: 10, intelligence: 14, wisdom: 12, charisma: 14 };
}

function guardStats(_level: number): AbilityScores {
  void _level;
  return { strength: 14, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 12, charisma: 10 };
}

function companionStats(level: number): AbilityScores {
  const base = 10 + Math.min(level, 5);
  return {
    strength: base,
    dexterity: base,
    constitution: base,
    intelligence: base,
    wisdom: base,
    charisma: base,
  };
}

function getAbilityScoresForRole(role: NPCRole, level: number): AbilityScores {
  switch (role) {
    case 'guard':
      return guardStats(level);
    case 'merchant':
    case 'innkeeper':
    case 'blacksmith':
      return merchantStats(level);
    case 'companion':
      return companionStats(level);
    case 'hostile':
      return guardStats(level);
    case 'noble':
      return { strength: 10, dexterity: 12, constitution: 10, intelligence: 14, wisdom: 14, charisma: 16 };
    case 'priest':
      return { strength: 10, dexterity: 10, constitution: 12, intelligence: 12, wisdom: 16, charisma: 14 };
    case 'quest_giver':
      return merchantStats(level);
    case 'commoner':
    default:
      return commmonerStats(level);
  }
}

function getHpForRole(role: NPCRole, level: number, conMod: number): number {
  const hitDie = role === 'guard' || role === 'hostile' || role === 'companion' ? 10 : 6;
  return Math.max(1, Math.floor((hitDie / 2 + 1 + conMod) * level));
}

function getACForRole(role: NPCRole): number {
  switch (role) {
    case 'guard':
    case 'hostile':
      return 16;
    case 'companion':
      return 14;
    default:
      return 10;
  }
}

// ── Personality generation ──────────────────────────────────────────

const PERSONALITY_TRAITS = [
  'Always speaks in a measured, thoughtful tone.',
  'Quick to laugh and quicker to anger.',
  'Cautious to a fault, always looking over their shoulder.',
  'Fiercely loyal to those who earn their trust.',
  'Has a habit of humming old battle songs.',
  'Speaks plainly and dislikes deception.',
  'Easily distracted by shiny objects.',
  'Never turns down a challenge.',
  'Has a dry, sardonic sense of humor.',
  'Quietly observant, rarely speaks unless asked.',
];

const BONDS = [
  'Swore an oath to protect the innocent.',
  'Seeks to avenge a fallen comrade.',
  'Carries a family heirloom of great significance.',
  'Owes a life debt to a powerful figure.',
  'Will do anything to protect their homeland.',
  'Searches for a lost sibling.',
];

const IDEALS = [
  'Honor above all else.',
  'Freedom is the highest virtue.',
  'Knowledge is the greatest treasure.',
  'The strong must protect the weak.',
  'Everyone deserves a second chance.',
  'Power is the only path to safety.',
];

const FLAWS = [
  'Cannot resist a wager.',
  'Trusts too easily.',
  'Holds grudges far too long.',
  'Tends to act before thinking.',
  'Has a weakness for fine ale.',
  'Struggles to admit when they are wrong.',
];

const SHORT_TERM_GOALS = [
  'Find steady work.',
  'Pay off a debt.',
  'Learn a new skill.',
  'Win an upcoming competition.',
];

const LONG_TERM_GOALS = [
  'Build a home for their family.',
  'Master their chosen craft.',
  'Find redemption for past mistakes.',
  'Discover the truth about their origins.',
];

export class NPCFactory {
  constructor(private rng: SeededRNG) {}

  createFromTemplate(role: NPCRole, level: number, locationId: EntityId): NPC {
    const name = this.generateName();
    const abilityScores = getAbilityScoresForRole(role, level);
    const conMod = Math.floor((abilityScores.constitution - 10) / 2);
    const maxHp = getHpForRole(role, level, conMod);

    const npc: NPC = {
      id: generateId(),
      type: 'npc',
      templateId: `npc_${role}`,
      name,
      role,
      locationId,
      isAwakened: role === 'companion',
      stats: {
        abilityScores,
        maxHp,
        currentHp: maxHp,
        armorClass: getACForRole(role),
        speed: 30,
        level,
        attacks: this.getDefaultAttacks(role),
        spellcasting: role === 'priest' ? {
          ability: 'wisdom',
          spellSlots: { 1: { current: 2, max: 2 } },
          knownSpells: [],
          preparedSpells: [],
          concentration: null,
          cantripsKnown: [],
        } : null,
        features: [],
        conditions: [],
        size: 'medium',
        resistances: [],
        immunities: [],
        vulnerabilities: [],
        conditionImmunities: [],
      },
      companion: null,
      position: null,
      initiative: null,
    };

    return npc;
  }

  createCompanion(
    name: string,
    classId: string,
    raceId: string,
    level: number,
    locationId: EntityId,
  ): NPC {
    const abilityScores = companionStats(level);
    const conMod = Math.floor((abilityScores.constitution - 10) / 2);
    const maxHp = getHpForRole('companion', level, conMod);
    const profBonus = proficiencyBonus(level);

    const companionData: CompanionData = {
      personality: {
        traits: [this.rng.pick(PERSONALITY_TRAITS), this.rng.pick(PERSONALITY_TRAITS)],
        bonds: [this.rng.pick(BONDS)],
        ideals: [this.rng.pick(IDEALS)],
        flaws: [this.rng.pick(FLAWS)],
      },
      goals: {
        shortTerm: [{
          id: generateId(),
          description: this.rng.pick(SHORT_TERM_GOALS),
          priority: 1,
          progress: 0,
          completed: false,
        }],
        longTerm: [{
          id: generateId(),
          description: this.rng.pick(LONG_TERM_GOALS),
          priority: 1,
          progress: 0,
          completed: false,
        }],
      },
      disposition: new Map(),
      memory: [],
      combatPreferences: {
        aggression: this.rng.nextFloat(0.3, 0.7),
        focusDamaged: this.rng.next() > 0.5,
        protectAllies: this.rng.next() > 0.3,
        preferredRange: this.rng.pick(['melee', 'ranged', 'mixed']),
        spellPriority: this.rng.pick(['damage', 'control', 'support', 'balanced']),
      },
      levelUpStrategy: {
        preferredAbilities: ['strength', 'dexterity'],
        preferredFeats: [],
        spellPreference: 'balanced',
      },
    };

    // Void unused vars for lint
    void classId;
    void raceId;
    void profBonus;

    const npc: NPC = {
      id: generateId(),
      type: 'npc',
      templateId: `companion_${classId}`,
      name,
      role: 'companion',
      locationId,
      isAwakened: true,
      stats: {
        abilityScores,
        maxHp,
        currentHp: maxHp,
        armorClass: 14,
        speed: 30,
        level,
        attacks: [
          {
            name: 'Longsword',
            toHitBonus: Math.floor((abilityScores.strength - 10) / 2) + proficiencyBonus(level),
            damage: { count: 1, die: 8, type: 'slashing', bonus: Math.floor((abilityScores.strength - 10) / 2) },
            reach: 5,
          },
        ],
        spellcasting: null,
        features: [],
        conditions: [],
        size: 'medium',
        resistances: [],
        immunities: [],
        vulnerabilities: [],
        conditionImmunities: [],
      },
      companion: companionData,
      position: null,
      initiative: null,
    };

    return npc;
  }

  generateName(race?: string): string {
    const pool = NAME_POOLS[race ?? 'human'] ?? HUMAN_FIRST_NAMES;
    const firstName = this.rng.pick(pool);
    const surname = this.rng.pick(SURNAMES);
    return `${firstName} ${surname}`;
  }

  private getDefaultAttacks(role: NPCRole) {
    switch (role) {
      case 'guard':
      case 'hostile':
        return [{
          name: 'Longsword',
          toHitBonus: 4,
          damage: { count: 1, die: 8 as const, type: 'slashing' as const, bonus: 2 },
          reach: 5,
        }];
      case 'companion':
        return [{
          name: 'Longsword',
          toHitBonus: 4,
          damage: { count: 1, die: 8 as const, type: 'slashing' as const, bonus: 2 },
          reach: 5,
        }];
      default:
        return [{
          name: 'Dagger',
          toHitBonus: 2,
          damage: { count: 1, die: 4 as const, type: 'piercing' as const },
          reach: 5,
        }];
    }
  }
}
