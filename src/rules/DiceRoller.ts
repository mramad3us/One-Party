import { SeededRNG } from '@/utils/SeededRNG';
import type { DieType, DamageRoll, DiceRollResult, AbilityScores } from '@/types';

export interface RollOptions {
  advantage?: boolean;
  disadvantage?: boolean;
  modifier?: number;
  critThreshold?: number;
}

/**
 * Core dice rolling engine with full logging.
 * Uses a SeededRNG for deterministic, reproducible rolls.
 */
export class DiceRoller {
  private rng: SeededRNG;

  constructor(rng: SeededRNG) {
    this.rng = rng;
  }

  /** Roll a single die of the given type (d4, d6, d8, d10, d12, d20, d100). */
  roll(die: DieType): number {
    return this.rng.nextInt(1, die);
  }

  /** Roll multiple dice of the same type. Returns array of individual results. */
  rollMultiple(count: number, die: DieType): number[] {
    const results: number[] = [];
    for (let i = 0; i < count; i++) {
      results.push(this.roll(die));
    }
    return results;
  }

  /**
   * Roll a d20 with optional advantage/disadvantage, modifier, and custom crit threshold.
   * Advantage: roll 2d20, take the higher.
   * Disadvantage: roll 2d20, take the lower.
   * If both advantage and disadvantage apply, they cancel out (standard roll).
   */
  rollD20(options: RollOptions = {}): DiceRollResult {
    const modifier = options.modifier ?? 0;
    const critThreshold = options.critThreshold ?? 20;

    // Advantage and disadvantage cancel each other out
    const hasAdvantage = (options.advantage ?? false) && !(options.disadvantage ?? false);
    const hasDisadvantage = (options.disadvantage ?? false) && !(options.advantage ?? false);

    let naturalRoll: number;
    const rolls: number[] = [];

    if (hasAdvantage || hasDisadvantage) {
      const roll1 = this.roll(20);
      const roll2 = this.roll(20);
      rolls.push(roll1, roll2);
      naturalRoll = hasAdvantage ? Math.max(roll1, roll2) : Math.min(roll1, roll2);
    } else {
      naturalRoll = this.roll(20);
      rolls.push(naturalRoll);
    }

    const total = naturalRoll + modifier;
    const isCritical = naturalRoll >= critThreshold;
    const isFumble = naturalRoll === 1;

    // Build description
    const parts: string[] = [];
    if (hasAdvantage) {
      parts.push(`d20(${rolls[0]},${rolls[1]})→${naturalRoll}`);
    } else if (hasDisadvantage) {
      parts.push(`d20(${rolls[0]},${rolls[1]})→${naturalRoll}`);
    } else {
      parts.push(`d20(${naturalRoll})`);
    }
    if (modifier !== 0) {
      parts.push(modifier > 0 ? `+${modifier}` : `${modifier}`);
    }
    parts.push(`= ${total}`);
    if (isCritical) parts.push('[CRITICAL]');
    if (isFumble) parts.push('[FUMBLE]');

    return {
      total,
      rolls,
      modifier,
      isCritical,
      isFumble,
      advantage: hasAdvantage,
      disadvantage: hasDisadvantage,
      description: parts.join(' '),
      dieType: 20,
    };
  }

  /**
   * Roll damage dice according to a DamageRoll specification.
   * Returns the total with individual die results logged.
   */
  rollDamage(damage: DamageRoll): DiceRollResult {
    const rolls = this.rollMultiple(damage.count, damage.die);
    const bonus = damage.bonus ?? 0;
    const diceTotal = rolls.reduce((sum, r) => sum + r, 0);
    const total = diceTotal + bonus;

    const diceStr = `${damage.count}d${damage.die}`;
    const rollsStr = `(${rolls.join('+')})`;
    const bonusStr = bonus !== 0 ? (bonus > 0 ? `+${bonus}` : `${bonus}`) : '';

    return {
      total,
      rolls,
      modifier: bonus,
      isCritical: false,
      isFumble: false,
      advantage: false,
      disadvantage: false,
      description: `${diceStr}${rollsStr}${bonusStr} = ${total} ${damage.type}`,
      dieType: damage.die,
    };
  }

  /**
   * Roll ability scores using the 4d6-drop-lowest method.
   * Rolls 4d6, drops the lowest die, 6 times, assigning to each ability.
   */
  rollAbilityScores(): AbilityScores {
    const abilities = [
      'strength',
      'dexterity',
      'constitution',
      'intelligence',
      'wisdom',
      'charisma',
    ] as const;

    const scores: Partial<AbilityScores> = {};

    for (const ability of abilities) {
      const rolls = this.rollMultiple(4, 6);
      rolls.sort((a, b) => a - b);
      // Drop the lowest (index 0), sum the rest
      const total = rolls[1] + rolls[2] + rolls[3];
      scores[ability] = total;
    }

    return scores as AbilityScores;
  }

  /**
   * Roll an ability check or saving throw against a DC.
   * Returns both the roll result and whether it succeeded.
   */
  rollCheck(
    modifier: number,
    dc: number,
    options: RollOptions = {},
  ): { result: DiceRollResult; success: boolean } {
    const result = this.rollD20({ ...options, modifier });
    // Natural 20 on attack rolls is auto-success, but for ability checks
    // RAW doesn't have auto-success on nat 20. We follow the total vs DC rule.
    const success = result.total >= dc;
    return { result, success };
  }
}
