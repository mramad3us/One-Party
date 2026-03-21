import type { OverworldTile } from '@/types/overworld';
import type { Coordinate } from '@/types';
import { isTraversable } from '@/world/OverworldBridge';

/**
 * A* pathfinder on the overworld tile grid.
 * 8-directional movement, Chebyshev heuristic, uniform cost.
 * Only considers terrain traversability — no entity blocking.
 */
export function findOverworldPath(
  tiles: OverworldTile[][],
  width: number,
  height: number,
  start: Coordinate,
  goal: Coordinate,
): { path: Coordinate[]; found: boolean } {
  if (start.x === goal.x && start.y === goal.y) {
    return { path: [], found: true };
  }

  // Check goal is traversable
  if (!isTraversable(tiles[goal.y][goal.x].terrain)) {
    return { path: [], found: false };
  }

  const key = (x: number, y: number) => y * width + x;
  const goalKey = key(goal.x, goal.y);

  // Precompute the ideal straight-line direction for tie-breaking.
  // We add a tiny cost based on perpendicular distance from the ideal line,
  // so A* prefers paths that track the straight line instead of making L-shapes.
  const ldx = goal.x - start.x;
  const ldy = goal.y - start.y;
  const lineLen = Math.sqrt(ldx * ldx + ldy * ldy) || 1;

  /** Perpendicular distance from point (px,py) to the start→goal line, normalized to [0,1). */
  function crossTrackCost(px: number, py: number): number {
    const cross = Math.abs((px - start.x) * ldy - (py - start.y) * ldx) / lineLen;
    // Scale down so it only breaks ties — never exceeds 1 step of real cost
    return cross * 0.001;
  }

  // Open set as sorted array (small maps, simple is fine)
  type Node = { x: number; y: number; g: number; f: number };
  const open: Node[] = [{ x: start.x, y: start.y, g: 0, f: heuristic(start, goal) }];
  const cameFrom = new Map<number, number>();
  const gScore = new Map<number, number>();
  gScore.set(key(start.x, start.y), 0);

  const dirs = [
    { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
    { dx: -1, dy:  0 },                     { dx: 1, dy:  0 },
    { dx: -1, dy:  1 }, { dx: 0, dy:  1 }, { dx: 1, dy:  1 },
  ];

  while (open.length > 0) {
    // Pop lowest f-score
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestIdx].f) bestIdx = i;
    }
    const current = open[bestIdx];
    open.splice(bestIdx, 1);

    const currentKey = key(current.x, current.y);
    if (currentKey === goalKey) {
      return { path: reconstructPath(cameFrom, currentKey, width), found: true };
    }

    for (const d of dirs) {
      const nx = current.x + d.dx;
      const ny = current.y + d.dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      if (!isTraversable(tiles[ny][nx].terrain)) continue;

      const nKey = key(nx, ny);
      const tentativeG = current.g + 1; // uniform cost

      const existingG = gScore.get(nKey);
      if (existingG !== undefined && tentativeG >= existingG) continue;

      gScore.set(nKey, tentativeG);
      cameFrom.set(nKey, currentKey);

      // Tie-break: prefer nodes closer to the ideal straight line
      const f = tentativeG + heuristic({ x: nx, y: ny }, goal) + crossTrackCost(nx, ny);
      open.push({ x: nx, y: ny, g: tentativeG, f });
    }
  }

  return { path: [], found: false };
}

function heuristic(a: Coordinate, b: Coordinate): number {
  // Chebyshev distance (8-directional)
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function reconstructPath(
  cameFrom: Map<number, number>,
  goalKey: number,
  width: number,
): Coordinate[] {
  const path: Coordinate[] = [];
  let current = goalKey;
  while (cameFrom.has(current)) {
    path.push({ x: current % width, y: Math.floor(current / width) });
    current = cameFrom.get(current)!;
  }
  path.reverse();
  return path;
}
