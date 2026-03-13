import type { Ability, Character, Skill } from '@/types';
import { abilityModifier } from '@/utils/math';
import { SKILL_ABILITY_MAP } from '@/rules/AbilityChecks';

export class CharacterSheet {
  /** Standard 5e ability modifier: floor((score - 10) / 2). */
  static getModifier(score: number): number {
    return abilityModifier(score);
  }

  /** All six ability modifiers at once. */
  static getAbilityModifiers(scores: Record<Ability, number>): Record<Ability, number> {
    return {
      strength: abilityModifier(scores.strength),
      dexterity: abilityModifier(scores.dexterity),
      constitution: abilityModifier(scores.constitution),
      intelligence: abilityModifier(scores.intelligence),
      wisdom: abilityModifier(scores.wisdom),
      charisma: abilityModifier(scores.charisma),
    };
  }

  /** Skill modifier = ability mod + proficiency bonus if proficient. */
  static getSkillModifier(character: Character, skill: Skill): number {
    const ability = SKILL_ABILITY_MAP[skill];
    const mod = abilityModifier(character.abilityScores[ability]);
    const proficient = character.proficiencies.skills.includes(skill);
    return mod + (proficient ? character.proficiencyBonus : 0);
  }

  /** Saving throw modifier = ability mod + proficiency bonus if proficient. */
  static getSavingThrowModifier(character: Character, ability: Ability): number {
    const mod = abilityModifier(character.abilityScores[ability]);
    const proficient = character.proficiencies.savingThrows.includes(ability);
    return mod + (proficient ? character.proficiencyBonus : 0);
  }

  /** Passive Perception = 10 + Wisdom mod + proficiency (if proficient in Perception). */
  static getPassivePerception(character: Character): number {
    return 10 + CharacterSheet.getSkillModifier(character, 'perception');
  }

  /** Initiative modifier = Dexterity modifier. */
  static getInitiativeModifier(character: Character): number {
    return abilityModifier(character.abilityScores.dexterity);
  }

  /** Spell save DC = 8 + proficiency bonus + spellcasting ability modifier. */
  static getSpellSaveDC(character: Character): number {
    if (!character.spellcasting) return 0;
    const abilityScore = character.abilityScores[character.spellcasting.ability];
    return 8 + character.proficiencyBonus + abilityModifier(abilityScore);
  }

  /** Spell attack bonus = proficiency bonus + spellcasting ability modifier. */
  static getSpellAttackBonus(character: Character): number {
    if (!character.spellcasting) return 0;
    const abilityScore = character.abilityScores[character.spellcasting.ability];
    return character.proficiencyBonus + abilityModifier(abilityScore);
  }

  /** Carrying capacity = Strength score * 15. */
  static getCarryingCapacity(character: Character): number {
    return character.abilityScores.strength * 15;
  }
}
