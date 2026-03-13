import type { Ability, Character, DiceRollResult, Skill } from '@/types';
import { abilityModifier } from '@/utils/math';
import { DiceRoller, type RollOptions } from './DiceRoller';

/** Maps each skill to its governing ability. */
const SKILL_ABILITY_MAP: Record<Skill, Ability> = {
  acrobatics: 'dexterity',
  animal_handling: 'wisdom',
  arcana: 'intelligence',
  athletics: 'strength',
  deception: 'charisma',
  history: 'intelligence',
  insight: 'wisdom',
  intimidation: 'charisma',
  investigation: 'intelligence',
  medicine: 'wisdom',
  nature: 'intelligence',
  perception: 'wisdom',
  performance: 'charisma',
  persuasion: 'charisma',
  religion: 'intelligence',
  sleight_of_hand: 'dexterity',
  stealth: 'dexterity',
  survival: 'wisdom',
};

export { SKILL_ABILITY_MAP };

export class AbilityChecks {
  constructor(private dice: DiceRoller) {}

  /** Generic ability check: d20 + ability modifier (+ proficiency if proficient) vs DC. */
  abilityCheck(
    score: number,
    proficient: boolean,
    proficiencyBonus: number,
    dc: number,
    options?: RollOptions,
  ): { result: DiceRollResult; success: boolean } {
    const mod = abilityModifier(score) + (proficient ? proficiencyBonus : 0);
    return this.dice.rollCheck(mod, dc, options);
  }

  /** Skill check for a character, automatically resolving the governing ability. */
  skillCheck(
    character: Character,
    skill: Skill,
    dc: number,
    options?: RollOptions,
  ): { result: DiceRollResult; success: boolean } {
    const ability = SKILL_ABILITY_MAP[skill];
    const score = character.abilityScores[ability];
    const proficient = character.proficiencies.skills.includes(skill);
    return this.abilityCheck(score, proficient, character.proficiencyBonus, dc, options);
  }

  /** Saving throw for a character against a given ability. */
  savingThrow(
    character: Character,
    ability: Ability,
    dc: number,
    options?: RollOptions,
  ): { result: DiceRollResult; success: boolean } {
    const score = character.abilityScores[ability];
    const proficient = character.proficiencies.savingThrows.includes(ability);
    return this.abilityCheck(score, proficient, character.proficiencyBonus, dc, options);
  }

  /** Opposed ability check between two contestants. Attacker wins ties. */
  contestedCheck(
    attacker: { score: number; proficient: boolean; bonus: number },
    defender: { score: number; proficient: boolean; bonus: number },
  ): {
    attackerResult: DiceRollResult;
    defenderResult: DiceRollResult;
    attackerWins: boolean;
  } {
    const attackerMod =
      abilityModifier(attacker.score) + (attacker.proficient ? attacker.bonus : 0);
    const defenderMod =
      abilityModifier(defender.score) + (defender.proficient ? defender.bonus : 0);

    const attackerResult = this.dice.rollD20({ modifier: attackerMod });
    const defenderResult = this.dice.rollD20({ modifier: defenderMod });

    return {
      attackerResult,
      defenderResult,
      attackerWins: attackerResult.total >= defenderResult.total,
    };
  }

  /** Passive score = 10 + ability modifier + proficiency bonus (if proficient). */
  passiveScore(score: number, proficient: boolean, proficiencyBonus: number): number {
    return 10 + abilityModifier(score) + (proficient ? proficiencyBonus : 0);
  }
}
