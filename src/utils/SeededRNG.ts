/**
 * Mulberry32 seeded pseudo-random number generator.
 * Deterministic: same seed always produces the same sequence.
 */
export class SeededRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0;
  }

  /** Returns a float in [0, 1) using the Mulberry32 algorithm. */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns an integer in [min, max] (inclusive). */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Returns a float in [min, max). */
  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /** Picks a random element from the array. */
  pick<T>(array: T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot pick from an empty array');
    }
    return array[this.nextInt(0, array.length - 1)];
  }

  /** Returns a new shuffled copy of the array using Fisher-Yates. */
  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      const temp = result[i];
      result[i] = result[j];
      result[j] = temp;
    }
    return result;
  }

  /** Picks from items according to the given weights. */
  weightedPick<T>(items: T[], weights: number[]): T {
    if (items.length === 0 || weights.length === 0) {
      throw new Error('Cannot pick from empty arrays');
    }
    if (items.length !== weights.length) {
      throw new Error('Items and weights must have the same length');
    }

    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let roll = this.next() * totalWeight;

    for (let i = 0; i < items.length; i++) {
      roll -= weights[i];
      if (roll <= 0) {
        return items[i];
      }
    }

    // Fallback (shouldn't happen with valid weights)
    return items[items.length - 1];
  }

  /** Returns the current seed state. */
  getSeed(): number {
    return this.state;
  }
}
