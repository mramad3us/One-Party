import type { Character } from '@/types';
import { getItem } from '@/data/items';
import type { ConsumableProperties } from '@/types/item';

/** Average hours per overworld tile during fast travel (midpoint of 2-4h range). */
const AVG_HOURS_PER_TILE = 3;

/** Survival accumulation rates per hour. */
const HUNGER_PER_HOUR = 50 / 12;   // ~4.17 — reaches 50 at 12 hours
const THIRST_PER_HOUR = 50 / 8;    // ~6.25 — reaches 50 at 8 hours

export interface SupplyRange {
  totalFoodValue: number;
  totalWaterValue: number;
  foodHours: number;
  waterHours: number;
  sustainableHours: number;
  maxTiles: number;
}

export class TravelRules {
  /**
   * Calculate how far the party can travel with current supplies.
   * Accounts for current hunger/thirst levels and all consumable inventory.
   */
  static calculateSupplyRange(character: Character): SupplyRange {
    let totalFoodValue = 0;
    let totalWaterValue = 0;

    for (const entry of character.inventory.items) {
      const item = getItem(entry.itemId);
      if (!item) continue;

      const props = item.properties as ConsumableProperties | undefined;
      if (!props) continue;

      if (props.hungerReduction) {
        // Charged items use charges; stackable items use quantity
        const uses = entry.charges !== undefined ? entry.charges : entry.quantity;
        totalFoodValue += props.hungerReduction * uses;
      }

      if (props.thirstReduction) {
        const uses = entry.charges !== undefined ? entry.charges : entry.quantity;
        totalWaterValue += props.thirstReduction * uses;
      }
    }

    // Buffer from current survival state (how far from critical = 100)
    const hungerBuffer = Math.max(0, 100 - character.survival.hunger);
    const thirstBuffer = Math.max(0, 100 - character.survival.thirst);

    const foodHours = (totalFoodValue + hungerBuffer) / HUNGER_PER_HOUR;
    const waterHours = (totalWaterValue + thirstBuffer) / THIRST_PER_HOUR;
    const sustainableHours = Math.min(foodHours, waterHours);
    const maxTiles = Math.max(0, Math.floor(sustainableHours / AVG_HOURS_PER_TILE));

    return {
      totalFoodValue,
      totalWaterValue,
      foodHours,
      waterHours,
      sustainableHours,
      maxTiles,
    };
  }

  /**
   * Check if the party can sustain a journey of the given tile count.
   */
  static canSustainJourney(character: Character, tiles: number): {
    sufficient: boolean;
    range: SupplyRange;
    limitingFactor: 'food' | 'water' | null;
  } {
    const range = this.calculateSupplyRange(character);
    const sufficient = tiles <= range.maxTiles;
    const limitingFactor = !sufficient
      ? (range.foodHours < range.waterHours ? 'food' : 'water')
      : null;
    return { sufficient, range, limitingFactor };
  }
}
