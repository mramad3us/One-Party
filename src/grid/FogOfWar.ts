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
  /** Per-tile lighting level (1–10). Only set for currently visible tiles. */
  private lightLevel: Map<string, number> = new Map();

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
    this.lightLevel.clear();

    for (const observer of observers) {
      const visibleFromHere = LineOfSight.getVisibleCells(grid, observer.position, observer.range);
      for (const key of visibleFromHere) {
        this.visible.add(key);
        this.explored.add(key);
      }
    }
  }

  /** Set the lighting level for a tile (1 = near-dark, 10 = full daylight). */
  setLightLevel(x: number, y: number, level: number): void {
    const key = coordToKey({ x, y });
    const current = this.lightLevel.get(key) ?? 0;
    // Keep the brightest contribution
    if (level > current) {
      this.lightLevel.set(key, Math.min(10, Math.max(1, level)));
    }
  }

  /** Get the lighting level for a tile (1–10). Returns 0 for non-visible tiles. */
  getLightLevel(x: number, y: number): number {
    return this.lightLevel.get(coordToKey({ x, y })) ?? 0;
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
