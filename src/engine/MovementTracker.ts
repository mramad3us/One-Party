/**
 * Tracks accumulated movement cost in feet and converts to elapsed rounds
 * per D&D 5e rules. Speed N means N feet of movement per round (6 seconds).
 * Each tile is 5ft. Difficult terrain doubles the cost.
 */
export class MovementTracker {
  private accumulatedFeet = 0;

  constructor(private speed: number) {}

  /**
   * Add movement cost and return the number of complete rounds elapsed.
   * @param costFeet Movement cost in feet (typically 5 * terrainCost)
   * @returns Number of full rounds that have elapsed
   */
  addMovement(costFeet: number): number {
    this.accumulatedFeet += costFeet;
    let rounds = 0;
    while (this.accumulatedFeet >= this.speed) {
      this.accumulatedFeet -= this.speed;
      rounds++;
    }
    return rounds;
  }

  /** Wait action: completes the current round. Returns 1 round. */
  wait(): number {
    this.accumulatedFeet = 0;
    return 1;
  }

  setSpeed(speed: number): void {
    this.speed = speed;
  }

  getSpeed(): number {
    return this.speed;
  }

  getAccumulatedFeet(): number {
    return this.accumulatedFeet;
  }

  getRemainingFeet(): number {
    return Math.max(0, this.speed - this.accumulatedFeet);
  }

  reset(): void {
    this.accumulatedFeet = 0;
  }
}
