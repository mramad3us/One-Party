import type { CellTerrain, CellFeature } from '@/types/grid';
import type { Character, DiceRollResult, Skill } from '@/types';
import { ROUNDS_PER_HOUR } from '@/types/time';
import { AbilityChecks } from './AbilityChecks';

export type ForageAction = 'forage' | 'hunt' | 'fish' | 'set_trap';

export interface ForageOption {
  action: ForageAction;
  label: string;
  description: string;
  timeRounds: number;
  /** Base success chance (still used for set_trap which doesn't use skill checks) */
  successChance: number;
  possibleItems: { itemId: string; minQty: number; maxQty: number }[];
}

/** Plan for a timed forage activity (hourly skill checks). */
export interface ForagePlan {
  action: ForageAction;
  skill: Skill;
  baseDC: number;
  hoursPlanned: number;
  possibleItems: { itemId: string; minQty: number; maxQty: number }[];
  label: string;
}

/** Result of a single hour's forage check. */
export interface ForageHourResult {
  hour: number;
  rollResult: DiceRollResult;
  success: boolean;
  dc: number;
  itemId: string | null;
  quantity: number;
}

export class ForageRules {
  /**
   * Determine which forage actions are available at the current position.
   */
  static getAvailableActions(
    terrain: CellTerrain,
    features: CellFeature[],
    adjacentTerrains: CellTerrain[],
    adjacentFeatures: CellFeature[],
  ): ForageOption[] {
    const options: ForageOption[] = [];
    const hasTrees = features.includes('tree') || adjacentFeatures.includes('tree');
    const hasWater = terrain === 'water' || adjacentTerrains.includes('water');
    const hasRunningWater = features.includes('running_water') || adjacentFeatures.includes('running_water');
    const isNatural = terrain === 'grass' || terrain === 'wood' || terrain === 'mud';

    // Forage — Nature check
    if ((isNatural || hasTrees) && terrain !== 'wall' && terrain !== 'lava') {
      options.push({
        action: 'forage',
        label: 'Forage',
        description: 'Search for edible plants, berries, and herbs. (Nature)',
        timeRounds: Math.floor(ROUNDS_PER_HOUR * 1),
        successChance: hasTrees ? 0.60 : 0.45,
        possibleItems: [{ itemId: 'item_trail_mix', minQty: 1, maxQty: 1 }],
      });
    }

    // Hunt — Survival check
    if (isNatural || hasTrees || terrain === 'stone') {
      options.push({
        action: 'hunt',
        label: 'Hunt',
        description: 'Track and hunt game. Yields meat. (Survival)',
        timeRounds: Math.floor(ROUNDS_PER_HOUR * 3),
        successChance: hasTrees ? 0.40 : 0.30,
        possibleItems: [{ itemId: 'item_dried_meat', minQty: 1, maxQty: 2 }],
      });
    }

    // Fish — Survival check
    if (hasWater || hasRunningWater) {
      options.push({
        action: 'fish',
        label: 'Fish',
        description: 'Cast a line or fashion a spear. (Survival)',
        timeRounds: Math.floor(ROUNDS_PER_HOUR * 1.5),
        successChance: hasRunningWater ? 0.50 : 0.35,
        possibleItems: [{ itemId: 'item_dried_meat', minQty: 1, maxQty: 1 }],
      });
    }

    // Set trap — instant placement, no hourly checks
    if (terrain !== 'water' && terrain !== 'lava' && terrain !== 'pit' && terrain !== 'ice') {
      options.push({
        action: 'set_trap',
        label: 'Set Trap',
        description: 'Lay a simple snare. Return later to check.',
        timeRounds: Math.floor(ROUNDS_PER_HOUR * 1),
        successChance: 0.40,
        possibleItems: [{ itemId: 'item_dried_meat', minQty: 1, maxQty: 1 }],
      });
    }

    return options;
  }

  /** Which skill governs this action? */
  static getSkillForAction(action: ForageAction): Skill {
    return action === 'forage' ? 'nature' : 'survival';
  }

  /** Calculate the base DC for a forage action at this terrain. */
  static getBaseDC(
    action: ForageAction,
    terrain: CellTerrain,
    features: CellFeature[],
  ): number {
    let dc = 13;
    if (features.includes('tree')) dc -= 2;        // easier in forests
    if (features.includes('running_water') && action === 'fish') dc -= 2;
    if (terrain === 'stone' || terrain === 'sand') dc += 2;
    if (action === 'hunt') dc += 1;                // hunting is harder
    return Math.max(8, Math.min(18, dc));
  }

  /**
   * Create a forage plan from an option and terrain context.
   */
  static createPlan(
    option: ForageOption,
    hours: number,
    terrain: CellTerrain,
    features: CellFeature[],
  ): ForagePlan {
    return {
      action: option.action,
      skill: ForageRules.getSkillForAction(option.action),
      baseDC: ForageRules.getBaseDC(option.action, terrain, features),
      hoursPlanned: hours,
      possibleItems: option.possibleItems,
      label: option.label,
    };
  }

  /**
   * Resolve one hour of a forage activity via skill check.
   */
  static resolveHour(
    plan: ForagePlan,
    hourIndex: number,
    character: Character,
    abilityChecks: AbilityChecks,
  ): ForageHourResult {
    const { result, success } = abilityChecks.skillCheck(
      character, plan.skill, plan.baseDC,
    );
    // Ensure dieType is set for display
    result.dieType = 20;

    let itemId: string | null = null;
    let quantity = 0;
    if (success && plan.possibleItems.length > 0) {
      const reward = plan.possibleItems[Math.floor(Math.random() * plan.possibleItems.length)];
      quantity = reward.minQty + Math.floor(Math.random() * (reward.maxQty - reward.minQty + 1));
      itemId = reward.itemId;
    }

    return { hour: hourIndex, rollResult: result, success, dc: plan.baseDC, itemId, quantity };
  }

  /**
   * Check a previously set trap. Success improves with elapsed time.
   */
  static checkTrap(elapsedRounds: number, rng: () => number): { success: boolean; itemId: string | null; quantity: number } {
    const hoursElapsed = elapsedRounds / ROUNDS_PER_HOUR;
    const chance = Math.min(0.70, 0.20 + hoursElapsed * 0.10);
    const success = rng() < chance;
    if (!success) return { success: false, itemId: null, quantity: 0 };
    return { success: true, itemId: 'item_dried_meat', quantity: 1 };
  }
}
