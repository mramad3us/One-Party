import { SeededRNG } from '@/utils/SeededRNG';

export class WeightedSelector {
  constructor(private rng: SeededRNG) {}

  select<T>(items: T[], weights: number[]): T {
    if (items.length === 0) {
      throw new Error('Cannot select from empty array');
    }
    if (items.length !== weights.length) {
      throw new Error('Items and weights must have the same length');
    }

    return this.rng.weightedPick(items, weights);
  }

  selectMultiple<T>(
    items: T[],
    weights: number[],
    count: number,
    unique = false,
  ): T[] {
    if (items.length === 0) {
      throw new Error('Cannot select from empty array');
    }
    if (items.length !== weights.length) {
      throw new Error('Items and weights must have the same length');
    }
    if (unique && count > items.length) {
      throw new Error('Cannot select more unique items than available');
    }

    const result: T[] = [];

    if (unique) {
      const availableItems = [...items];
      const availableWeights = [...weights];

      for (let i = 0; i < count; i++) {
        const selected = this.rng.weightedPick(availableItems, availableWeights);
        result.push(selected);

        const idx = availableItems.indexOf(selected);
        availableItems.splice(idx, 1);
        availableWeights.splice(idx, 1);
      }
    } else {
      for (let i = 0; i < count; i++) {
        result.push(this.rng.weightedPick(items, weights));
      }
    }

    return result;
  }
}
