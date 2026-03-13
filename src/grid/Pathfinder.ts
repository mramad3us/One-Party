import type { Coordinate, PathResult } from '@/types';
import { coordToKey } from '@/utils/math';
import { Grid } from './Grid';

interface PathNode {
  x: number;
  y: number;
  g: number;  // Cost from start in feet
  f: number;  // g + heuristic
  parent: PathNode | null;
}

/**
 * A* pathfinding with terrain costs and creature size awareness.
 * All costs are in feet (1 cell = 5ft base).
 */
export class Pathfinder {
  /** All 8 directions: cardinals + diagonals */
  private static readonly DIRECTIONS: Coordinate[] = [
    { x: 0, y: -1 },  // N
    { x: 1, y: 0 },   // E
    { x: 0, y: 1 },   // S
    { x: -1, y: 0 },  // W
    { x: 1, y: -1 },  // NE
    { x: 1, y: 1 },   // SE
    { x: -1, y: 1 },  // SW
    { x: -1, y: -1 }, // NW
  ];

  /**
   * Find a path from `from` to `to` using A*.
   * @param grid The grid to search
   * @param from Start coordinate
   * @param to Target coordinate
   * @param size Creature footprint (1 = Medium, 2 = Large, etc.)
   * @param maxCostFeet Maximum movement budget in feet
   * @param passableEntities Entity IDs whose cells can be walked through (allies)
   */
  findPath(
    grid: Grid,
    from: Coordinate,
    to: Coordinate,
    size: number,
    maxCostFeet: number,
    passableEntities: Set<string> = new Set(),
  ): PathResult {
    const openList: PathNode[] = [];
    const closedSet = new Set<string>();
    const gScores = new Map<string, number>();

    const startNode: PathNode = {
      x: from.x,
      y: from.y,
      g: 0,
      f: this.heuristic(from, to),
      parent: null,
    };

    openList.push(startNode);
    gScores.set(coordToKey(from), 0);

    while (openList.length > 0) {
      // Find node with lowest f-score (simple min search)
      let bestIdx = 0;
      for (let i = 1; i < openList.length; i++) {
        if (openList[i].f < openList[bestIdx].f) bestIdx = i;
      }
      const current = openList[bestIdx];
      openList.splice(bestIdx, 1);

      const currentKey = `${current.x},${current.y}`;

      if (current.x === to.x && current.y === to.y) {
        // Reconstruct path
        const path = this.reconstructPath(current);
        return { path, totalCost: current.g, reachable: true };
      }

      if (closedSet.has(currentKey)) continue;
      closedSet.add(currentKey);

      for (const dir of Pathfinder.DIRECTIONS) {
        const nx = current.x + dir.x;
        const ny = current.y + dir.y;
        const neighborKey = `${nx},${ny}`;

        if (closedSet.has(neighborKey)) continue;

        // Check if the creature can occupy this position
        if (!this.canCreatureOccupy(grid, { x: nx, y: ny }, size, passableEntities)) continue;

        // Movement cost: 5ft * terrain cost. Diagonals same cost (simplified D&D rule).
        const terrainCost = this.getMaxTerrainCost(grid, { x: nx, y: ny }, size);
        if (terrainCost >= Infinity) continue;

        const moveCost = 5 * terrainCost;
        const newG = current.g + moveCost;

        if (newG > maxCostFeet) continue;

        const existingG = gScores.get(neighborKey);
        if (existingG !== undefined && newG >= existingG) continue;

        gScores.set(neighborKey, newG);

        const node: PathNode = {
          x: nx,
          y: ny,
          g: newG,
          f: newG + this.heuristic({ x: nx, y: ny }, to),
          parent: current,
        };

        openList.push(node);
      }
    }

    // No path found
    return { path: [], totalCost: 0, reachable: false };
  }

  /**
   * Get all cells reachable within a movement budget.
   * Returns a map of "x,y" -> cost to reach that cell.
   */
  getReachableCells(
    grid: Grid,
    from: Coordinate,
    size: number,
    maxCostFeet: number,
    passableEntities: Set<string> = new Set(),
  ): Map<string, number> {
    const reachable = new Map<string, number>();
    const openList: PathNode[] = [];
    const visited = new Set<string>();

    const startKey = coordToKey(from);
    openList.push({ x: from.x, y: from.y, g: 0, f: 0, parent: null });
    reachable.set(startKey, 0);

    while (openList.length > 0) {
      // Find node with lowest g-score (Dijkstra)
      let bestIdx = 0;
      for (let i = 1; i < openList.length; i++) {
        if (openList[i].g < openList[bestIdx].g) bestIdx = i;
      }
      const current = openList[bestIdx];
      openList.splice(bestIdx, 1);

      const currentKey = `${current.x},${current.y}`;
      if (visited.has(currentKey)) continue;
      visited.add(currentKey);

      for (const dir of Pathfinder.DIRECTIONS) {
        const nx = current.x + dir.x;
        const ny = current.y + dir.y;
        const neighborKey = `${nx},${ny}`;

        if (visited.has(neighborKey)) continue;
        if (!this.canCreatureOccupy(grid, { x: nx, y: ny }, size, passableEntities)) continue;

        const terrainCost = this.getMaxTerrainCost(grid, { x: nx, y: ny }, size);
        if (terrainCost >= Infinity) continue;

        const moveCost = 5 * terrainCost;
        const newG = current.g + moveCost;
        if (newG > maxCostFeet) continue;

        const existingG = reachable.get(neighborKey);
        if (existingG !== undefined && newG >= existingG) continue;

        reachable.set(neighborKey, newG);
        openList.push({ x: nx, y: ny, g: newG, f: 0, parent: null });
      }
    }

    return reachable;
  }

  /**
   * Return all cells a path passes through (for opportunity attack checks).
   */
  getPathCells(path: Coordinate[]): Coordinate[] {
    return [...path];
  }

  // ── Private helpers ──────────────────────────────────────────

  /** Heuristic: Chebyshev distance * 5 (admissible for grid movement). */
  private heuristic(a: Coordinate, b: Coordinate): number {
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) * 5;
  }

  /** Reconstruct path from goal node back to start. */
  private reconstructPath(node: PathNode): Coordinate[] {
    const path: Coordinate[] = [];
    let current: PathNode | null = node;
    while (current) {
      path.unshift({ x: current.x, y: current.y });
      current = current.parent;
    }
    return path;
  }

  /**
   * Check if a creature of given size can occupy a position.
   * All cells must be valid, passable, and not occupied by non-passable entities.
   */
  private canCreatureOccupy(
    grid: Grid,
    position: Coordinate,
    size: number,
    passableEntities: Set<string>,
  ): boolean {
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const cx = position.x + dx;
        const cy = position.y + dy;
        if (!grid.isValidPosition(cx, cy)) return false;
        if (!grid.isPassable(cx, cy)) return false;

        const occupant = grid.getEntityAt({ x: cx, y: cy });
        if (occupant && !passableEntities.has(occupant)) return false;
      }
    }
    return true;
  }

  /**
   * Get the maximum terrain cost across all cells a creature would occupy.
   * Used so large creatures respect difficult terrain in any cell they cover.
   */
  private getMaxTerrainCost(grid: Grid, position: Coordinate, size: number): number {
    let maxCost = 0;
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const cost = grid.getMovementCost(position.x + dx, position.y + dy);
        if (cost > maxCost) maxCost = cost;
      }
    }
    return maxCost;
  }
}
