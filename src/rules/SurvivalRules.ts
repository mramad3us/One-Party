import type {
  SurvivalState,
  HungerThreshold,
  ThirstThreshold,
  FatigueThreshold,
} from '@/types';
import type { ConsumableProperties } from '@/types/item';

// Rates: value increase per round
// Hunger: reaches 50 at ~12 hours (7200 rounds) → ~0.00694/round
// Thirst: reaches 50 at ~8 hours (4800 rounds) → ~0.01042/round
// Fatigue: reaches 50 at ~16 hours (9600 rounds) → ~0.00521/round
const HUNGER_RATE = 50 / 7200;
const THIRST_RATE = 50 / 4800;
const FATIGUE_RATE = 50 / 9600;

const HUNGER_THRESHOLDS: [number, HungerThreshold][] = [
  [0, 'satiated'],
  [16, 'comfortable'],
  [31, 'peckish'],
  [46, 'hungry'],
  [61, 'very_hungry'],
  [76, 'famished'],
  [91, 'starving'],
];

const THIRST_THRESHOLDS: [number, ThirstThreshold][] = [
  [0, 'quenched'],
  [16, 'hydrated'],
  [31, 'mild_thirst'],
  [46, 'thirsty'],
  [61, 'very_thirsty'],
  [76, 'parched'],
  [91, 'dehydrated'],
];

const FATIGUE_THRESHOLDS: [number, FatigueThreshold][] = [
  [0, 'rested'],
  [16, 'alert'],
  [31, 'tired'],
  [46, 'weary'],
  [61, 'exhausted'],
  [76, 'delirious'],
];

function getThreshold<T>(value: number, thresholds: [number, T][]): T {
  let result = thresholds[0][1];
  for (const [min, label] of thresholds) {
    if (value >= min) result = label;
    else break;
  }
  return result;
}

export interface ConsumptionResult {
  track: 'hunger' | 'thirst';
  before: number;
  after: number;
  thresholdBefore: string;
  thresholdAfter: string;
}

export interface SurvivalTickResult {
  hungerCrossing: { from: HungerThreshold; to: HungerThreshold } | null;
  thirstCrossing: { from: ThirstThreshold; to: ThirstThreshold } | null;
  fatigueCrossing: { from: FatigueThreshold; to: FatigueThreshold } | null;
}

/**
 * Pure logic for survival mechanics.
 * All methods are static — no instance state.
 */
export class SurvivalRules {
  /** Advance survival values by elapsed rounds. Returns threshold crossings. */
  static tick(survival: SurvivalState, roundsElapsed: number): SurvivalTickResult {
    const hungerBefore = SurvivalRules.getHungerThreshold(survival.hunger);
    const thirstBefore = SurvivalRules.getThirstThreshold(survival.thirst);
    const fatigueBefore = SurvivalRules.getFatigueThreshold(survival.fatigue);

    survival.hunger = Math.min(100, survival.hunger + HUNGER_RATE * roundsElapsed);
    survival.thirst = Math.min(100, survival.thirst + THIRST_RATE * roundsElapsed);
    survival.fatigue = Math.min(100, survival.fatigue + FATIGUE_RATE * roundsElapsed);

    const hungerAfter = SurvivalRules.getHungerThreshold(survival.hunger);
    const thirstAfter = SurvivalRules.getThirstThreshold(survival.thirst);
    const fatigueAfter = SurvivalRules.getFatigueThreshold(survival.fatigue);

    survival.exhaustionLevel = SurvivalRules.calculateExhaustion(survival);

    return {
      hungerCrossing: hungerBefore !== hungerAfter ? { from: hungerBefore, to: hungerAfter } : null,
      thirstCrossing: thirstBefore !== thirstAfter ? { from: thirstBefore, to: thirstAfter } : null,
      fatigueCrossing: fatigueBefore !== fatigueAfter ? { from: fatigueBefore, to: fatigueAfter } : null,
    };
  }

  /** Consume a food/drink item. Returns what changed. */
  static consume(survival: SurvivalState, properties: ConsumableProperties): ConsumptionResult[] {
    const results: ConsumptionResult[] = [];

    if (properties.hungerReduction && properties.hungerReduction > 0) {
      const before = survival.hunger;
      survival.hunger = Math.max(0, survival.hunger - properties.hungerReduction);
      results.push({
        track: 'hunger',
        before,
        after: survival.hunger,
        thresholdBefore: SurvivalRules.getHungerThreshold(before),
        thresholdAfter: SurvivalRules.getHungerThreshold(survival.hunger),
      });
    }

    if (properties.thirstReduction && properties.thirstReduction > 0) {
      const before = survival.thirst;
      survival.thirst = Math.max(0, survival.thirst - properties.thirstReduction);
      results.push({
        track: 'thirst',
        before,
        after: survival.thirst,
        thresholdBefore: SurvivalRules.getThirstThreshold(before),
        thresholdAfter: SurvivalRules.getThirstThreshold(survival.thirst),
      });
    }

    survival.exhaustionLevel = SurvivalRules.calculateExhaustion(survival);
    return results;
  }

  /** Long rest resets fatigue. */
  static rest(survival: SurvivalState): void {
    survival.fatigue = 0;
    survival.exhaustionLevel = SurvivalRules.calculateExhaustion(survival);
  }

  static getHungerThreshold(value: number): HungerThreshold {
    return getThreshold(value, HUNGER_THRESHOLDS);
  }

  static getThirstThreshold(value: number): ThirstThreshold {
    return getThreshold(value, THIRST_THRESHOLDS);
  }

  static getFatigueThreshold(value: number): FatigueThreshold {
    return getThreshold(value, FATIGUE_THRESHOLDS);
  }

  /** Map worst survival track to D&D 5e exhaustion (0-6). */
  static calculateExhaustion(survival: SurvivalState): number {
    const worst = Math.max(survival.hunger, survival.thirst, survival.fatigue);
    if (worst >= 91) return 4;
    if (worst >= 76) return 3;
    if (worst >= 61) return 2;
    if (worst >= 46) return 1;
    return 0;
  }

  /** Format a threshold name for display. */
  static formatThreshold(threshold: string): string {
    return threshold.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
}
