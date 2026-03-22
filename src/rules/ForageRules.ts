import type { BiomeType } from '@/types/world';
import type { Character, DiceRollResult, Skill } from '@/types';
import { AbilityChecks } from './AbilityChecks';

export type ForageAction = 'forage' | 'hunt' | 'fish';

export interface ForageOption {
  action: ForageAction;
  label: string;
  description: string;
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

/** Biome DC modifiers — negative = easier, positive = harder. */
const BIOME_DC_MOD: Record<BiomeType, number> = {
  forest: -3,     // abundant flora and fauna
  swamp: -1,      // plenty of life, harder to move through
  plains: 0,      // open grassland, moderate
  coast: 0,       // moderate
  mountain: 1,    // sparse but possible
  tundra: 2,      // harsh, little grows
  desert: 4,      // barren, very difficult
  volcanic: 5,    // near-impossible
  underdark: 3,   // alien environment, little familiar food
  urban: 2,       // not much to forage in a town
};

/** Biomes where fishing is available. */
const FISH_BIOMES: Set<BiomeType> = new Set([
  'coast', 'swamp', 'forest', 'plains', 'mountain', 'tundra',
]);

export class ForageRules {
  /**
   * Determine which forage/hunt/fish actions are available in this biome.
   * Actions are map-wide — the party explores the area, not a single tile.
   */
  static getAvailableActions(biome: BiomeType): ForageOption[] {
    const options: ForageOption[] = [];

    // Forage — always available (DC varies by biome)
    options.push({
      action: 'forage',
      label: 'Forage',
      description: 'Search the area for edible plants, berries, and herbs. (Nature)',
      possibleItems: [{ itemId: 'item_trail_mix', minQty: 1, maxQty: 1 }],
    });

    // Hunt — always available
    options.push({
      action: 'hunt',
      label: 'Hunt',
      description: 'Track and hunt game across the surrounding land. (Survival)',
      possibleItems: [{ itemId: 'item_dried_meat', minQty: 1, maxQty: 2 }],
    });

    // Fish — only in biomes with water
    if (FISH_BIOMES.has(biome)) {
      options.push({
        action: 'fish',
        label: 'Fish',
        description: 'Find water and cast a line or fashion a spear. (Survival)',
        possibleItems: [{ itemId: 'item_dried_meat', minQty: 1, maxQty: 1 }],
      });
    }

    return options;
  }

  /** Which skill governs this action? */
  static getSkillForAction(action: ForageAction): Skill {
    return action === 'forage' ? 'nature' : 'survival';
  }

  /** Calculate the base DC for a forage action in this biome. */
  static getBaseDC(action: ForageAction, biome: BiomeType): number {
    let dc = 12;
    dc += BIOME_DC_MOD[biome] ?? 0;
    if (action === 'hunt') dc += 1;  // hunting is slightly harder
    if (action === 'fish') dc -= 1;  // fishing is slightly easier
    return Math.max(6, Math.min(18, dc));
  }

  /** Create a forage plan from an option and biome context. */
  static createPlan(
    option: ForageOption,
    hours: number,
    biome: BiomeType,
  ): ForagePlan {
    return {
      action: option.action,
      skill: ForageRules.getSkillForAction(option.action),
      baseDC: ForageRules.getBaseDC(option.action, biome),
      hoursPlanned: hours,
      possibleItems: option.possibleItems,
      label: option.label,
    };
  }

  /** Resolve one hour of a forage activity via skill check. */
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
}
