import type { Coordinate, FogState } from '@/types';
import { coordToKey } from '@/utils/math';
import { Grid } from './Grid';
import { LineOfSight } from './LineOfSight';

/**
 * Vision system tracking explored and currently visible cells.
 * Uses LineOfSight for visibility calculations.
 */
export class FogOfWar {
  private explored: Set<string> = new Set();
  private visible: Set<string> = new Set();

  constructor() {}

  /**
   * Recalculate visibility from a set of observers.
   * Each observer has a position and a vision range (in cells).
   * Previously visible cells become explored-but-not-visible.
   */
  updateVisibility(
    grid: Grid,
    observers: { position: Coordinate; range: number }[],
  ): void {
    this.visible.clear();

    for (const observer of observers) {
      const visibleFromHere = LineOfSight.getVisibleCells(grid, observer.position, observer.range);
      for (const key of visibleFromHere) {
        this.visible.add(key);
        this.explored.add(key);
      }
    }
  }

  isVisible(x: number, y: number): boolean {
    return this.visible.has(coordToKey({ x, y }));
  }

  isExplored(x: number, y: number): boolean {
    return this.explored.has(coordToKey({ x, y }));
  }

  getState(): FogState {
    return {
      explored: new Set(this.explored),
      visible: new Set(this.visible),
    };
  }

  setState(state: FogState): void {
    this.explored = new Set(state.explored);
    this.visible = new Set(state.visible);
  }

  revealAll(): void {
    // Copy visible into explored — caller should populate visible first
    for (const key of this.visible) {
      this.explored.add(key);
    }
  }
}
