import type { Coordinate } from '@/types';
import { coordToKey } from '@/utils/math';
import { Grid } from './Grid';

/**
 * Line of sight and field of view calculations.
 *
 * Uses recursive shadowcasting for FOV (produces clean circular
 * visibility) and Bresenham for point-to-point LoS checks.
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
   * Get all cells visible from an origin within a given range.
   * Uses recursive shadowcasting across 8 octants for a clean circular FOV.
   * Returns a set of "x,y" coordinate keys.
   */
  static getVisibleCells(grid: Grid, from: Coordinate, range: number): Set<string> {
    const visible = new Set<string>();
    visible.add(coordToKey(from));

    // Cast shadows in all 8 octants
    for (let octant = 0; octant < 8; octant++) {
      castShadow(grid, from, range, octant, 1, 1.0, 0.0, visible);
    }

    return visible;
  }
}

// ── Recursive shadowcasting (Björn Bergström's algorithm) ──────

// Octant transforms: each octant maps (row, col) to (dx, dy)
const OCTANT_TRANSFORMS: [number, number, number, number][] = [
  [ 1,  0,  0,  1], // octant 0: E  → SE
  [ 0,  1,  1,  0], // octant 1: SE → S
  [ 0, -1,  1,  0], // octant 2: S  → SW
  [-1,  0,  0,  1], // octant 3: SW → W
  [-1,  0,  0, -1], // octant 4: W  → NW
  [ 0, -1, -1,  0], // octant 5: NW → N
  [ 0,  1, -1,  0], // octant 6: N  → NE
  [ 1,  0,  0, -1], // octant 7: NE → E
];

function castShadow(
  grid: Grid,
  origin: Coordinate,
  range: number,
  octant: number,
  row: number,
  startSlope: number,
  endSlope: number,
  visible: Set<string>,
): void {
  if (startSlope < endSlope) return;

  const [xx, xy, yx, yy] = OCTANT_TRANSFORMS[octant];
  let nextStartSlope = startSlope;

  for (let r = row; r <= range; r++) {
    let blocked = false;

    for (let col = Math.floor(r * endSlope - 0.5); col <= Math.ceil(r * startSlope + 0.5); col++) {
      // Map octant-local (row, col) to grid coordinates
      const gx = origin.x + col * xx + r * yx;
      const gy = origin.y + col * xy + r * yy;

      // Distance check (circular FOV)
      const dist2 = (gx - origin.x) * (gx - origin.x) + (gy - origin.y) * (gy - origin.y);
      if (dist2 > range * range) continue;

      if (!grid.isValidPosition(gx, gy)) continue;

      const leftSlope = (col - 0.5) / (r + 0.5);
      const rightSlope = (col + 0.5) / (r - 0.5);

      if (rightSlope < endSlope) continue;
      if (leftSlope > startSlope) continue;

      // This cell is visible
      visible.add(coordToKey({ x: gx, y: gy }));

      const cell = grid.getCell(gx, gy);
      const isBlocking = !cell || cell.blocksLoS;

      if (blocked) {
        if (isBlocking) {
          // Still in shadow — narrow the beam
          nextStartSlope = rightSlope;
        } else {
          // Exiting shadow — start a new scan
          blocked = false;
          startSlope = nextStartSlope;
        }
      } else if (isBlocking && r < range) {
        // Entering shadow — recurse with narrowed beam, then track shadow
        blocked = true;
        castShadow(grid, origin, range, octant, r + 1, startSlope, leftSlope, visible);
        nextStartSlope = rightSlope;
      }
    }

    if (blocked) break;
  }
}
