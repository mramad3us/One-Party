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
      castShadow(grid, from.x, from.y, range, octant, 1, 1.0, 0.0, visible);
    }

    return visible;
  }
}

// ── Recursive shadowcasting ──────────────────────────────────────
//
// Each octant multiplier maps (depth, lateral) → (dx, dy).
// depth = distance from origin along primary axis
// lateral = offset along secondary axis
//
const MULT: number[][] = [
  // xx  xy  yx  yy
  [ 1,  0,  0,  1],
  [ 0,  1,  1,  0],
  [ 0, -1,  1,  0],
  [-1,  0,  0,  1],
  [-1,  0,  0, -1],
  [ 0, -1, -1,  0],
  [ 0,  1, -1,  0],
  [ 1,  0,  0, -1],
];

function castShadow(
  grid: Grid,
  ox: number,
  oy: number,
  range: number,
  oct: number,
  depth: number,
  startSlope: number,
  endSlope: number,
  visible: Set<string>,
): void {
  if (startSlope < endSlope) return;

  const [xx, xy, yx, yy] = MULT[oct];
  const rangeSquared = range * range;

  let start = startSlope;

  for (let d = depth; d <= range; d++) {
    let prevBlocked = false;

    // Scan columns from the one nearest startSlope down to endSlope
    // (high col → low col so shadow transitions work correctly)
    const maxCol = Math.floor(d * start + 0.5);
    const minCol = Math.ceil(d * endSlope - 0.5);

    for (let col = maxCol; col >= minCol; col--) {
      const gx = ox + col * xx + d * yx;
      const gy = oy + col * xy + d * yy;

      // Out of grid
      if (!grid.isValidPosition(gx, gy)) {
        prevBlocked = true;
        continue;
      }

      // Circular range check
      const ddx = gx - ox;
      const ddy = gy - oy;
      if (ddx * ddx + ddy * ddy > rangeSquared) {
        prevBlocked = false;
        continue;
      }

      // Slopes for this cell's edges
      const leftSlope  = (col - 0.5) / (d + 0.5);
      const rightSlope = (col + 0.5) / (d - 0.5 || 1); // avoid /0 at d=0

      if (rightSlope < endSlope) continue;
      if (leftSlope > start) continue;

      // Mark visible
      visible.add(coordToKey({ x: gx, y: gy }));

      const cell = grid.getCell(gx, gy);
      const blocking = !cell || cell.blocksLoS;

      if (blocking) {
        if (!prevBlocked) {
          // Transitioning open → blocked: recurse for the open wedge
          // that ended just before this cell
          castShadow(grid, ox, oy, range, oct, d + 1, start, (col + 0.5) / d, visible);
        }
        prevBlocked = true;
        // Narrow the start slope past this blocker
        start = (col - 0.5) / d;
      } else {
        prevBlocked = false;
      }
    }

    // If the last cell in the row was blocked, the whole remaining
    // beam is in shadow — stop scanning further rows.
    if (prevBlocked) break;
  }
}
