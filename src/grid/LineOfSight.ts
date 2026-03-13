import type { Coordinate } from '@/types';
import { coordToKey } from '@/utils/math';
import { Grid } from './Grid';

/**
 * Bresenham-based line of sight calculations.
 * A cell blocks LoS if its `blocksLoS` property is true (walls, pillars).
 */
export class LineOfSight {
  /**
   * Check if there is an unobstructed line of sight between two cells.
   * The start cell is never considered blocking; the end cell is included.
   */
  static hasLineOfSight(grid: Grid, from: Coordinate, to: Coordinate): boolean {
    const ray = LineOfSight.getRayPath(from, to);

    // Skip the first cell (observer's position) and the last cell (target).
    // Only intermediate cells can block LoS.
    for (let i = 1; i < ray.length - 1; i++) {
      const cell = grid.getCell(ray[i].x, ray[i].y);
      if (!cell || cell.blocksLoS) return false;
    }

    return true;
  }

  /**
   * Get all cells along a ray from `from` to `to` using Bresenham's line algorithm.
   * Returns an array of coordinates including both endpoints.
   */
  static getRayPath(from: Coordinate, to: Coordinate): Coordinate[] {
    const path: Coordinate[] = [];

    let x0 = from.x;
    let y0 = from.y;
    const x1 = to.x;
    const y1 = to.y;

    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      path.push({ x: x0, y: y0 });

      if (x0 === x1 && y0 === y1) break;

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }

    return path;
  }

  /**
   * Get all cells visible from an origin within a given range (in cells, not feet).
   * Uses raycasting to each cell on the perimeter and all intermediate cells.
   * Returns a set of "x,y" coordinate keys.
   */
  static getVisibleCells(grid: Grid, from: Coordinate, range: number): Set<string> {
    const visible = new Set<string>();
    visible.add(coordToKey(from));

    // Cast rays to every cell within range
    for (let dy = -range; dy <= range; dy++) {
      for (let dx = -range; dx <= range; dx++) {
        // Only cast to cells within circular range
        if (dx * dx + dy * dy > range * range) continue;

        const tx = from.x + dx;
        const ty = from.y + dy;

        if (!grid.isValidPosition(tx, ty)) continue;

        const ray = LineOfSight.getRayPath(from, { x: tx, y: ty });

        for (let i = 0; i < ray.length; i++) {
          const cell = grid.getCell(ray[i].x, ray[i].y);

          // Add this cell as visible
          visible.add(coordToKey(ray[i]));

          // If it blocks LoS, stop the ray (but the blocking cell itself is visible)
          if (i > 0 && cell && cell.blocksLoS) break;
        }
      }
    }

    return visible;
  }
}
