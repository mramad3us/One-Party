import type { AbilityScores, Character, Skill } from '@/types';
import { abilityModifier, proficiencyBonus } from '@/utils/math';
import { generateId } from '@/engine/IdGenerator';
import { DiceRoller } from '@/rules/DiceRoller';
import { getRace } from '@/data/races';
import { getClass } from '@/data/classes';
import { isDevMode } from '@/utils/devmode';

export interface CharacterCreateOptions {
  name: string;
  raceId: string;
  classId: string;
  abilityScores: AbilityScores;
  skills: Skill[];
  level?: number;
}

export class CharacterFactory {
  constructor(private dice: DiceRoller) {}

  /** Create a character from explicit options. */
  create(options: CharacterCreateOptions): Character {
    const race = getRace(options.raceId);
    const classData = getClass(options.classId);
    if (!race) throw new Error(`Unknown race: ${options.raceId}`);
    if (!classData) throw new Error(`Unknown class: ${options.classId}`);

    const level = options.level ?? 1;

    // Apply racial ability bonuses
    const abilityScores = { ...options.abilityScores };
    for (const [ability, bonus] of Object.entries(race.abilityBonuses)) {
      abilityScores[ability as keyof AbilityScores] += bonus as number;
    }

    // Calculate HP: max hit die at level 1, roll for subsequent
    const conMod = abilityModifier(abilityScores.constitution);
    let maxHp = classData.hitDie + conMod;
    for (let i = 2; i <= level; i++) {
      const roll = this.dice.roll(classData.hitDie);
      maxHp += Math.max(1, roll + conMod);
    }

    // Hill dwarf bonus HP
    if (options.raceId === 'dwarf') {
      maxHp += level;
    }

    // Dev mode: 1000 HP for testing combat
    if (isDevMode()) {
      maxHp = 1000;
    }

    const profBonus = proficiencyBonus(level);

    // Merge proficiencies
    const skills: Skill[] = [...options.skills];
    if (race.proficiencies?.skills) {
      for (const s of race.proficiencies.skills) {
        if (!skills.includes(s)) skills.push(s);
      }
    }

    const weaponProfs: (string)[] = [...classData.weaponProficiencies];
    if (race.proficiencies?.weapons) {
      for (const w of race.proficiencies.weapons) {
        if (!weaponProfs.includes(w)) weaponProfs.push(w);
      }
    }

    const armorProfs = [...classData.armorProficiencies];
    const toolProfs = race.proficiencies?.tools ? [...race.proficiencies.tools] : [];
    const languages = [...race.languages];

    // Set up spellcasting if applicable
    let spellcasting: Character['spellcasting'] = null;
    if (classData.spellcasting) {
      const levelIndex = level - 1;
      const spellSlots: Record<number, { current: number; max: number }> = {};
      for (const [slotLevelStr, slotsPerLevel] of Object.entries(classData.spellcasting.spellSlots)) {
        const slotLevel = Number(slotLevelStr);
        const maxSlots = slotsPerLevel[levelIndex] ?? 0;
        if (maxSlots > 0) {
          spellSlots[slotLevel] = { current: maxSlots, max: maxSlots };
        }
      }

      spellcasting = {
        ability: classData.spellcasting.ability,
        spellSlots,
        knownSpells: [],
        preparedSpells: [],
        concentration: null,
        cantripsKnown: [],
      };
    }

    // Starting equipment as inventory entries
    const inventoryItems: { itemId: string; quantity: number; charges?: number }[] = [];
    for (const itemId of classData.startingEquipment) {
      const existing = inventoryItems.find((e) => e.itemId === itemId);
      if (existing) {
        existing.quantity += 1;
      } else {
        inventoryItems.push({ itemId, quantity: 1 });
      }
    }

    // Add starting provisions
    inventoryItems.push({ itemId: 'item_rations', quantity: 3 });
    inventoryItems.push({ itemId: 'item_waterskin', quantity: 1 });
    inventoryItems.push({ itemId: 'item_torch', quantity: 1, charges: 6 });
    inventoryItems.push({ itemId: 'item_torch', quantity: 1, charges: 6 });

    // Build features list from class
    const features: Character['features'] = [];
    for (const feature of classData.features) {
      if (feature.level <= level) {
        features.push({
          id: `feature_${feature.name.toLowerCase().replace(/\s+/g, '_')}`,
          name: feature.name,
          description: feature.description,
          source: classData.name,
        });
      }
    }

    // Add racial traits as features
    for (const trait of race.traits) {
      features.push({
        id: `trait_${trait.name.toLowerCase().replace(/\s+/g, '_')}`,
        name: trait.name,
        description: trait.description,
        source: race.name,
      });
    }

    const character: Character = {
      id: generateId(),
      type: 'character',
      name: options.name,
      race: options.raceId,
      class: options.classId,
      level,
      xp: 0,
      abilityScores,
      maxHp,
      currentHp: maxHp,
      tempHp: 0,
      hitDice: {
        current: level,
        max: level,
        die: classData.hitDie,
      },
      armorClass: 10 + abilityModifier(abilityScores.dexterity),
      speed: race.speed,
      proficiencyBonus: profBonus,
      proficiencies: {
        skills,
        savingThrows: classData.savingThrows,
        armor: armorProfs,
        weapons: weaponProfs,
        tools: toolProfs,
        languages,
      },
      features,
      inventory: {
        items: inventoryItems,
        capacity: abilityScores.strength * 15,
        currentWeight: 0,
        gold: 0,
        silver: 0,
        copper: 0,
      },
      equipment: {
        mainHand: null,
        offHand: null,
        armor: null,
        helmet: null,
        cloak: null,
        gloves: null,
        boots: null,
        ring1: null,
        ring2: null,
        amulet: null,
        belt: null,
      },
      equipmentCharges: {},
      spellcasting,
      conditions: [],
      deathSaves: { successes: 0, failures: 0 },
      position: null,
      initiative: null,
      epicBoons: [],
      survival: { hunger: 10, thirst: 5, fatigue: 0, exhaustionLevel: 0 },
    };

    return character;
  }

  /** Create a character from a preset archetype. */
  createFromPreset(
    preset: 'warrior' | 'mage' | 'rogue' | 'healer',
    level?: number,
  ): Character {
    const presets: Record<
      string,
      { raceId: string; classId: string; scores: AbilityScores; skills: Skill[]; name: string }
    > = {
      warrior: {
        raceId: 'human',
        classId: 'fighter',
        scores: {
          strength: 16,
          dexterity: 13,
          constitution: 14,
          intelligence: 10,
          wisdom: 12,
          charisma: 8,
        },
        skills: ['athletics', 'perception'],
        name: 'Aldric',
      },
      mage: {
        raceId: 'elf',
        classId: 'wizard',
        scores: {
          strength: 8,
          dexterity: 14,
          constitution: 12,
          intelligence: 16,
          wisdom: 13,
          charisma: 10,
        },
        skills: ['arcana', 'investigation'],
        name: 'Elarion',
      },
      rogue: {
        raceId: 'halfling',
        classId: 'rogue',
        scores: {
          strength: 10,
          dexterity: 16,
          constitution: 12,
          intelligence: 13,
          wisdom: 8,
          charisma: 14,
        },
        skills: ['stealth', 'sleight_of_hand', 'perception', 'deception'],
        name: 'Pip',
      },
      healer: {
        raceId: 'dwarf',
        classId: 'cleric',
        scores: {
          strength: 14,
          dexterity: 10,
          constitution: 14,
          intelligence: 8,
          wisdom: 16,
          charisma: 12,
        },
        skills: ['medicine', 'insight'],
        name: 'Brunda',
      },
    };

    const p = presets[preset];
    return this.create({
      name: p.name,
      raceId: p.raceId,
      classId: p.classId,
      abilityScores: p.scores,
      skills: p.skills,
      level,
    });
  }
}
