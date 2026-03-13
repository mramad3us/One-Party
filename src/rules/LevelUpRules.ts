import type { AbilityScores, Character } from '@/types';
import { abilityModifier, proficiencyBonus } from '@/utils/math';
import { DiceRoller } from './DiceRoller';
import type { ClassDefinition } from '@/data/classes';
import { getEpicProgressionForLevel } from '@/data/epic-progression';

/** Standard 5e XP thresholds for levels 2-20. Index 0 = XP needed for level 2. */
const XP_THRESHOLDS: number[] = [
  300,     // Level 2
  900,     // Level 3
  2700,    // Level 4
  6500,    // Level 5
  14000,   // Level 6
  23000,   // Level 7
  34000,   // Level 8
  48000,   // Level 9
  64000,   // Level 10
  85000,   // Level 11
  100000,  // Level 12
  120000,  // Level 13
  140000,  // Level 14
  165000,  // Level 15
  195000,  // Level 16
  225000,  // Level 17
  265000,  // Level 18
  305000,  // Level 19
  355000,  // Level 20
];

export class LevelUpRules {
  constructor(private dice: DiceRoller) {}

  /** Get the total XP required to reach the next level from the current level. */
  xpForNextLevel(currentLevel: number): number {
    if (currentLevel < 1) return 0;
    if (currentLevel <= 19) {
      return XP_THRESHOLDS[currentLevel - 1];
    }
    // Epic levels: each level after 20 requires an additional 30000 XP
    const level20Xp = XP_THRESHOLDS[18]; // 355000
    return level20Xp + (currentLevel - 19) * 30000;
  }

  /** Whether the character has enough XP to level up. */
  canLevelUp(character: Character): boolean {
    return character.xp >= this.xpForNextLevel(character.level);
  }

  /** Get proficiency bonus for any level (1-100+). */
  getProficiencyBonus(level: number): number {
    return proficiencyBonus(level);
  }

  /**
   * Level up a character. Increases level, HP, proficiency bonus.
   * Applies ASI choices if provided. Returns summary of changes.
   */
  levelUp(
    character: Character,
    classData: ClassDefinition,
    choices?: { asi?: Partial<AbilityScores>; feat?: string },
  ): {
    newLevel: number;
    hpGained: number;
    featuresGained: string[];
    newSpellSlots?: Record<number, number>;
  } {
    const newLevel = character.level + 1;
    character.level = newLevel;

    // HP: roll hit die + Con modifier (min 1)
    const conMod = abilityModifier(character.abilityScores.constitution);
    const hpRoll = this.dice.roll(classData.hitDie);
    const hpGained = Math.max(1, hpRoll + conMod);
    character.maxHp += hpGained;
    character.currentHp += hpGained;

    // Hit dice
    character.hitDice.max = newLevel;
    character.hitDice.current = Math.min(character.hitDice.current + 1, newLevel);

    // Proficiency bonus
    character.proficiencyBonus = proficiencyBonus(newLevel);

    // Features gained at this level
    const featuresGained: string[] = [];
    for (const feature of classData.features) {
      if (feature.level === newLevel) {
        featuresGained.push(feature.name);
        character.features.push({
          id: `feature_${feature.name.toLowerCase().replace(/\s+/g, '_')}`,
          name: feature.name,
          description: feature.description,
          source: classData.name,
        });
      }
    }

    // ASI at levels 4, 8, 12, 16, 19 (standard 5e), and every 4 levels for epic
    const standardASILevels = [4, 8, 12, 16, 19];
    const epicProgression = newLevel > 20 ? getEpicProgressionForLevel(newLevel) : null;
    const isASILevel = standardASILevels.includes(newLevel) || (epicProgression?.asiAvailable ?? false);

    if (isASILevel && choices?.asi) {
      for (const [ability, increase] of Object.entries(choices.asi)) {
        if (increase) {
          const key = ability as keyof AbilityScores;
          character.abilityScores[key] = Math.min(30, character.abilityScores[key] + increase);
        }
      }
      featuresGained.push('Ability Score Improvement');
    }

    // Epic boon
    if (epicProgression?.boonAvailable) {
      featuresGained.push('Epic Boon available');
    }

    // Spell slots
    let newSpellSlots: Record<number, number> | undefined;
    if (classData.spellcasting && character.spellcasting && newLevel <= 20) {
      newSpellSlots = {};
      const levelIndex = newLevel - 1;

      // Update cantrips known count
      const cantripsCount = classData.spellcasting.cantripsKnown[levelIndex];
      if (cantripsCount !== undefined) {
        // cantripsKnown is a string array on Character, count is managed externally
      }

      // Update spell slots
      for (const [slotLevelStr, slotsPerLevel] of Object.entries(classData.spellcasting.spellSlots)) {
        const slotLevel = Number(slotLevelStr);
        const maxSlots = slotsPerLevel[levelIndex] ?? 0;
        if (maxSlots > 0) {
          const current = character.spellcasting.spellSlots[slotLevel];
          if (current) {
            const gained = maxSlots - current.max;
            current.max = maxSlots;
            current.current += Math.max(0, gained);
          } else {
            character.spellcasting.spellSlots[slotLevel] = {
              current: maxSlots,
              max: maxSlots,
            };
          }
          newSpellSlots[slotLevel] = maxSlots;
        }
      }
    }

    return { newLevel, hpGained, featuresGained, newSpellSlots };
  }
}
