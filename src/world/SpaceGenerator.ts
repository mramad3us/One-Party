import type {
  CellFeature,
  CellTerrain,
  GridCell,
  GridDefinition,
  Space,
  SubLocation,
} from '@/types';
import { SeededRNG } from '@/utils/SeededRNG';
import { generateId } from '@/engine/IdGenerator';

function makeCell(
  terrain: CellTerrain,
  movementCost = 1,
  blocksLoS = false,
  features: CellFeature[] = [],
): GridCell {
  return { terrain, movementCost, blocksLoS, elevation: 0, features };
}

function createGrid(width: number, height: number, fill: CellTerrain): GridCell[][] {
  const cells: GridCell[][] = [];
  for (let y = 0; y < height; y++) {
    const row: GridCell[] = [];
    for (let x = 0; x < width; x++) {
      row.push(makeCell(fill));
    }
    cells.push(row);
  }
  return cells;
}

function addWalls(cells: GridCell[][], width: number, height: number): void {
  for (let x = 0; x < width; x++) {
    cells[0][x] = makeCell('wall', Infinity, true);
    cells[height - 1][x] = makeCell('wall', Infinity, true);
  }
  for (let y = 0; y < height; y++) {
    cells[y][0] = makeCell('wall', Infinity, true);
    cells[y][width - 1] = makeCell('wall', Infinity, true);
  }
}

export class SpaceGenerator {
  constructor(private rng: SeededRNG) {}

  generateSpace(subLocation: SubLocation, spaceName: string): Space {
    let grid: GridDefinition;

    switch (subLocation.subType) {
      case 'tavern':
        grid = this.generateTavernInterior();
        break;
      case 'dungeon_room':
        grid = this.generateDungeonRoom();
        break;
      case 'clearing':
        grid = this.generateForestClearing();
        break;
      case 'cellar':
      case 'hall':
        grid = this.generateCaveRoom();
        break;
      default:
        if (subLocation.interiorType === 'interior') {
          grid = this.generateDungeonRoom();
        } else {
          grid = this.generateOpenField();
        }
        break;
    }

    return {
      id: generateId(),
      subLocationId: subLocation.id,
      name: spaceName,
      grid,
      terrain: subLocation.subType,
      interiorType: subLocation.interiorType,
      lighting: subLocation.interiorType === 'interior' ? 'dim' : 'bright',
      entities: [],
    };
  }

  generateDungeonRoom(width?: number, height?: number): GridDefinition {
    const w = width ?? this.rng.nextInt(6, 12);
    const h = height ?? this.rng.nextInt(6, 12);
    const cells = createGrid(w, h, 'stone');

    // Walls around edges
    addWalls(cells, w, h);

    // Add 1-3 pillars
    const pillarCount = this.rng.nextInt(1, 3);
    for (let i = 0; i < pillarCount; i++) {
      const px = this.rng.nextInt(2, w - 3);
      const py = this.rng.nextInt(2, h - 3);
      cells[py][px] = makeCell('stone', Infinity, true, ['pillar']);
    }

    // Add a door on a random wall
    const doorWall = this.rng.nextInt(0, 3);
    switch (doorWall) {
      case 0: // North wall
        cells[0][this.rng.nextInt(1, w - 2)] = makeCell('stone', 1, false, ['door']);
        break;
      case 1: // East wall
        cells[this.rng.nextInt(1, h - 2)][w - 1] = makeCell('stone', 1, false, ['door']);
        break;
      case 2: // South wall
        cells[h - 1][this.rng.nextInt(1, w - 2)] = makeCell('stone', 1, false, ['door']);
        break;
      case 3: // West wall
        cells[this.rng.nextInt(1, h - 2)][0] = makeCell('stone', 1, false, ['door']);
        break;
    }

    // Possibly add a trap
    if (this.rng.next() < 0.3) {
      const tx = this.rng.nextInt(2, w - 3);
      const ty = this.rng.nextInt(2, h - 3);
      cells[ty][tx] = makeCell('stone', 1, false, ['trap']);
    }

    // Possibly add a chest
    if (this.rng.next() < 0.4) {
      const cx = this.rng.nextInt(1, w - 2);
      const cy = this.rng.nextInt(1, h - 2);
      if (cells[cy][cx].features.length === 0 && cells[cy][cx].movementCost < Infinity) {
        cells[cy][cx] = makeCell('stone', 1, false, ['chest']);
      }
    }

    return { width: w, height: h, cells };
  }

  generateTavernInterior(): GridDefinition {
    const w = this.rng.nextInt(8, 10);
    const h = this.rng.nextInt(8, 10);
    const cells = createGrid(w, h, 'wood');

    // Walls
    addWalls(cells, w, h);

    // Door on south wall
    cells[h - 1][Math.floor(w / 2)] = makeCell('wood', 1, false, ['door']);

    // Bar area along the north wall (interior)
    for (let x = 2; x < w - 2; x++) {
      cells[1][x] = makeCell('wood', 2, false); // Bar counter = difficult terrain
    }

    // Tables (2-3 tables, each a 2x1 block of difficult terrain)
    const tableCount = this.rng.nextInt(2, 3);
    for (let i = 0; i < tableCount; i++) {
      const tx = this.rng.nextInt(2, w - 4);
      const ty = this.rng.nextInt(3, h - 3);
      if (cells[ty][tx].movementCost < 2 && cells[ty][tx + 1].movementCost < 2) {
        cells[ty][tx] = makeCell('wood', 2, false);
        cells[ty][tx + 1] = makeCell('wood', 2, false);
      }
    }

    // Fireplace on the east or west wall
    const fireSide = this.rng.nextInt(0, 1);
    const fy = this.rng.nextInt(2, h - 3);
    if (fireSide === 0) {
      cells[fy][1] = makeCell('wood', Infinity, false, ['fire']);
    } else {
      cells[fy][w - 2] = makeCell('wood', Infinity, false, ['fire']);
    }

    return { width: w, height: h, cells };
  }

  generateForestClearing(): GridDefinition {
    const w = this.rng.nextInt(10, 16);
    const h = this.rng.nextInt(10, 16);
    const cells = createGrid(w, h, 'grass');

    // Trees around edges (not solid wall, but partial coverage)
    for (let x = 0; x < w; x++) {
      if (this.rng.next() < 0.7) {
        cells[0][x] = makeCell('grass', Infinity, true); // Dense tree
      }
      if (this.rng.next() < 0.7) {
        cells[h - 1][x] = makeCell('grass', Infinity, true);
      }
    }
    for (let y = 1; y < h - 1; y++) {
      if (this.rng.next() < 0.7) {
        cells[y][0] = makeCell('grass', Infinity, true);
      }
      if (this.rng.next() < 0.7) {
        cells[y][w - 1] = makeCell('grass', Infinity, true);
      }
    }

    // Scatter a few interior trees
    const treeCount = this.rng.nextInt(2, 5);
    for (let i = 0; i < treeCount; i++) {
      const tx = this.rng.nextInt(2, w - 3);
      const ty = this.rng.nextInt(2, h - 3);
      cells[ty][tx] = makeCell('grass', Infinity, true);
    }

    // Maybe a stream cutting through
    if (this.rng.next() < 0.4) {
      const streamX = this.rng.nextInt(3, w - 4);
      for (let y = 1; y < h - 1; y++) {
        const sx = streamX + (this.rng.next() < 0.3 ? this.rng.nextInt(-1, 1) : 0);
        if (sx >= 1 && sx < w - 1) {
          cells[y][sx] = makeCell('water', 2, false); // Water = difficult terrain
        }
      }
    }

    // Ensure at least one path from top area to bottom area
    const midX = Math.floor(w / 2);
    for (let y = 1; y < h - 1; y++) {
      if (cells[y][midX].movementCost === Infinity) {
        cells[y][midX] = makeCell('grass');
      }
    }
    // Open entry points
    cells[0][midX] = makeCell('grass');
    cells[h - 1][midX] = makeCell('grass');

    return { width: w, height: h, cells };
  }

  generateCaveRoom(): GridDefinition {
    const w = this.rng.nextInt(8, 14);
    const h = this.rng.nextInt(8, 14);
    const cells = createGrid(w, h, 'stone');

    // Irregular walls around edges
    for (let x = 0; x < w; x++) {
      cells[0][x] = makeCell('wall', Infinity, true);
      cells[h - 1][x] = makeCell('wall', Infinity, true);
    }
    for (let y = 0; y < h; y++) {
      cells[y][0] = makeCell('wall', Infinity, true);
      cells[y][w - 1] = makeCell('wall', Infinity, true);
    }

    // Irregular wall protrusions (make it feel cave-like)
    const protrusions = this.rng.nextInt(3, 6);
    for (let i = 0; i < protrusions; i++) {
      const edge = this.rng.nextInt(0, 3);
      switch (edge) {
        case 0: { // From north
          const px = this.rng.nextInt(1, w - 2);
          cells[1][px] = makeCell('wall', Infinity, true);
          break;
        }
        case 1: { // From east
          const py = this.rng.nextInt(1, h - 2);
          cells[py][w - 2] = makeCell('wall', Infinity, true);
          break;
        }
        case 2: { // From south
          const px = this.rng.nextInt(1, w - 2);
          cells[h - 2][px] = makeCell('wall', Infinity, true);
          break;
        }
        case 3: { // From west
          const py = this.rng.nextInt(1, h - 2);
          cells[py][1] = makeCell('wall', Infinity, true);
          break;
        }
      }
    }

    // Stalagmites (pillars)
    const stalagmiteCount = this.rng.nextInt(1, 4);
    for (let i = 0; i < stalagmiteCount; i++) {
      const sx = this.rng.nextInt(2, w - 3);
      const sy = this.rng.nextInt(2, h - 3);
      if (cells[sy][sx].movementCost < Infinity) {
        cells[sy][sx] = makeCell('stone', Infinity, true, ['pillar']);
      }
    }

    // Possible water pool
    if (this.rng.next() < 0.3) {
      const poolX = this.rng.nextInt(2, w - 4);
      const poolY = this.rng.nextInt(2, h - 4);
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          if (cells[poolY + dy][poolX + dx].movementCost < Infinity) {
            cells[poolY + dy][poolX + dx] = makeCell('water', 2, false);
          }
        }
      }
    }

    // Door entrance
    cells[h - 1][Math.floor(w / 2)] = makeCell('stone', 1, false, ['door']);

    // Ensure center path is walkable
    const cx = Math.floor(w / 2);
    const cy = Math.floor(h / 2);
    if (cells[cy][cx].movementCost === Infinity) {
      cells[cy][cx] = makeCell('stone');
    }

    return { width: w, height: h, cells };
  }

  generateOpenField(): GridDefinition {
    const w = this.rng.nextInt(12, 20);
    const h = this.rng.nextInt(12, 20);
    const cells = createGrid(w, h, 'grass');

    // Scatter a few rocks
    const rockCount = this.rng.nextInt(2, 5);
    for (let i = 0; i < rockCount; i++) {
      const rx = this.rng.nextInt(1, w - 2);
      const ry = this.rng.nextInt(1, h - 2);
      cells[ry][rx] = makeCell('stone', 2, false); // Rocks = difficult terrain
    }

    // Maybe a small cluster of bushes
    if (this.rng.next() < 0.5) {
      const bx = this.rng.nextInt(3, w - 4);
      const by = this.rng.nextInt(3, h - 4);
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          cells[by + dy][bx + dx] = makeCell('grass', 2, false);
        }
      }
    }

    return { width: w, height: h, cells };
  }
}
