import type { Coordinate, GridCell, GridDefinition, CellTerrain, CellFeature } from '@/types';
import type { OverworldTerrain } from '@/types/overworld';
import { SeededRNG } from '@/utils/SeededRNG';

/** Small throwaway grid for encounter combat. */
export interface CombatMap {
  grid: GridDefinition;
  playerStart: Coordinate;
  enemyPositions: Coordinate[];
}

const MAP_SIZE = 14; // 14×14 = 70ft × 70ft

function makeCell(
  terrain: CellTerrain,
  movementCost = 1,
  blocksLoS = false,
  features: CellFeature[] = [],
): GridCell {
  return { terrain, movementCost, blocksLoS, elevation: 0, features };
}

/**
 * Generate a small combat map appropriate for the terrain type.
 * Player starts south-center, enemy positions spread across the north half.
 */
export function generateCombatMap(
  terrain: OverworldTerrain,
  enemyCount: number,
  rng: SeededRNG,
): CombatMap {
  const cells: GridCell[][] = [];
  const { floor, obstacles } = getTerrainConfig(terrain);

  // Fill base terrain
  for (let y = 0; y < MAP_SIZE; y++) {
    const row: GridCell[] = [];
    for (let x = 0; x < MAP_SIZE; x++) {
      row.push(makeCell(floor));
    }
    cells.push(row);
  }

  // Scatter obstacles — avoid player start area (bottom 3 rows) and enemy zone (top 3 rows)
  const obstacleCount = 4 + rng.nextInt(0, 4);
  for (let i = 0; i < obstacleCount; i++) {
    const ox = rng.nextInt(1, MAP_SIZE - 2);
    const oy = rng.nextInt(3, MAP_SIZE - 4);
    const obstacle = obstacles[rng.nextInt(0, obstacles.length - 1)];
    cells[oy][ox] = obstacle();
  }

  // Player starts south-center
  const playerStart: Coordinate = { x: Math.floor(MAP_SIZE / 2), y: MAP_SIZE - 2 };

  // Spread enemies across north half with spacing
  const enemyPositions: Coordinate[] = [];
  const usedKeys = new Set<string>();
  usedKeys.add(`${playerStart.x},${playerStart.y}`);

  for (let i = 0; i < enemyCount; i++) {
    let placed = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      const ex = rng.nextInt(2, MAP_SIZE - 3);
      const ey = rng.nextInt(1, Math.floor(MAP_SIZE / 2));
      const key = `${ex},${ey}`;
      const cell = cells[ey][ex];
      if (!usedKeys.has(key) && cell.movementCost < Infinity && !cell.blocksLoS) {
        enemyPositions.push({ x: ex, y: ey });
        usedKeys.add(key);
        placed = true;
        break;
      }
    }
    // Fallback: place in a guaranteed open spot
    if (!placed) {
      const ex = 2 + (i * 2) % (MAP_SIZE - 4);
      const ey = 2;
      enemyPositions.push({ x: ex, y: ey });
    }
  }

  return {
    grid: { width: MAP_SIZE, height: MAP_SIZE, cells },
    playerStart,
    enemyPositions,
  };
}

interface TerrainConfig {
  floor: CellTerrain;
  obstacles: (() => GridCell)[];
}

function getTerrainConfig(terrain: OverworldTerrain): TerrainConfig {
  switch (terrain) {
    case 'forest':
    case 'dense_forest':
      return {
        floor: 'grass',
        obstacles: [
          () => makeCell('grass', Infinity, true, ['tree']),
          () => makeCell('grass', Infinity, true, ['tree']),
          () => makeCell('grass', 2, false, ['rock']),
        ],
      };
    case 'plains':
    case 'beach':
      return {
        floor: 'grass',
        obstacles: [
          () => makeCell('grass', 2, false, ['rock']),
        ],
      };
    case 'hills':
    case 'mountain':
    case 'peak':
      return {
        floor: 'stone',
        obstacles: [
          () => makeCell('stone', Infinity, true, ['rock']),
          () => makeCell('stone', Infinity, true, ['rock']),
          () => makeCell('stone', 2, false),
        ],
      };
    case 'swamp':
      return {
        floor: 'mud',
        obstacles: [
          () => makeCell('water', Infinity, false),
          () => makeCell('mud', 2, false),
          () => makeCell('grass', Infinity, true, ['tree']),
        ],
      };
    case 'desert':
      return {
        floor: 'sand',
        obstacles: [
          () => makeCell('sand', Infinity, true, ['rock']),
        ],
      };
    case 'tundra':
    case 'snow':
      return {
        floor: 'ice',
        obstacles: [
          () => makeCell('ice', Infinity, true, ['rock']),
          () => makeCell('ice', 2, false),
        ],
      };
    case 'volcanic':
      return {
        floor: 'stone',
        obstacles: [
          () => makeCell('lava', Infinity, false),
          () => makeCell('stone', Infinity, true, ['rock']),
        ],
      };
    default:
      return {
        floor: 'grass',
        obstacles: [
          () => makeCell('grass', 2, false, ['rock']),
          () => makeCell('grass', Infinity, true, ['tree']),
        ],
      };
  }
}
