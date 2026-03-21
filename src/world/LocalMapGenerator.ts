import type { Coordinate, GridCell, GridDefinition, CellTerrain, CellFeature } from '@/types';
import type { LocationType, BiomeType } from '@/types/world';
import { SeededRNG } from '@/utils/SeededRNG';

interface MapResult {
  grid: GridDefinition;
  playerStart: Coordinate;
}

function makeCell(
  terrain: CellTerrain,
  movementCost = 1,
  blocksLoS = false,
  features: CellFeature[] = [],
): GridCell {
  return { terrain, movementCost, blocksLoS, elevation: 0, features };
}

function wallCell(): GridCell {
  return makeCell('wall', Infinity, true);
}

function floorCell(terrain: CellTerrain = 'floor'): GridCell {
  return makeCell(terrain);
}

/**
 * Generates detailed local maps for different location types.
 * Each map is a GridDefinition with terrain, features, and a player start position.
 */
export class LocalMapGenerator {
  constructor(private rng: SeededRNG) {}

  generate(locationType: LocationType, biome: BiomeType = 'forest'): MapResult {
    switch (locationType) {
      case 'village':
      case 'town':
      case 'city':
        return this.generateTown();
      case 'dungeon':
        return this.generateDungeon();
      case 'cave':
        return this.generateCave();
      case 'wilderness':
      case 'camp':
        return this.generateWilderness(biome);
      case 'ruins':
        return this.generateRuins();
      case 'castle':
        return this.generateCastle();
      case 'temple':
        return this.generateTemple();
      default:
        return this.generateWilderness(biome);
    }
  }

  // ── Town (40x40) ──────────────────────────────────────────

  private generateTown(): MapResult {
    const w = 40, h = 40;
    const cells = this.fillGrid(w, h, 'grass');

    // Lay down roads in a cross pattern
    const midX = Math.floor(w / 2);
    const midY = Math.floor(h / 2);

    // Main road east-west
    for (let x = 2; x < w - 2; x++) {
      cells[midY][x] = floorCell('stone');
      cells[midY - 1][x] = floorCell('stone');
    }
    // Main road north-south
    for (let y = 2; y < h - 2; y++) {
      cells[y][midX] = floorCell('stone');
      cells[y][midX + 1] = floorCell('stone');
    }

    // Town square / market in center
    for (let y = midY - 3; y <= midY + 2; y++) {
      for (let x = midX - 3; x <= midX + 4; x++) {
        if (x >= 0 && x < w && y >= 0 && y < h) {
          cells[y][x] = floorCell('stone');
        }
      }
    }

    // Fountain in center
    cells[midY][midX] = makeCell('stone', 1, false, ['fountain']);

    // Place buildings in quadrants
    const buildingSpots = [
      { x: 5, y: 5, bw: 8, bh: 6 },    // NW
      { x: 27, y: 5, bw: 8, bh: 6 },   // NE
      { x: 5, y: 28, bw: 8, bh: 6 },   // SW
      { x: 27, y: 28, bw: 8, bh: 6 },  // SE
      { x: 5, y: 15, bw: 6, bh: 5 },   // W
      { x: 29, y: 15, bw: 6, bh: 5 },  // E
      { x: 15, y: 5, bw: 5, bh: 5 },   // N
      { x: 15, y: 30, bw: 5, bh: 5 },  // S
    ];

    for (const spot of buildingSpots) {
      this.placeBuilding(cells, w, h, spot.x, spot.y, spot.bw, spot.bh);
    }

    // Perimeter wall with gaps for entrances
    this.placePerimeter(cells, w, h, [
      { x: midX, y: 0 },      // North gate
      { x: midX + 1, y: 0 },
      { x: midX, y: h - 1 },  // South gate
      { x: midX + 1, y: h - 1 },
      { x: 0, y: midY },      // West gate
      { x: 0, y: midY - 1 },
      { x: w - 1, y: midY },  // East gate
      { x: w - 1, y: midY - 1 },
    ]);

    // Player starts at south gate
    return {
      grid: { width: w, height: h, cells },
      playerStart: { x: midX, y: h - 2 },
    };
  }

  // ── Dungeon (30x50) ───────────────────────────────────────

  private generateDungeon(): MapResult {
    const w = 30, h = 50;
    const cells = this.fillGrid(w, h, 'wall', Infinity, true);

    // Generate rooms using BSP-like approach
    const rooms: { x: number; y: number; w: number; h: number }[] = [];
    this.bspDivide(rooms, 1, 1, w - 2, h - 2, 0);

    // Carve rooms
    for (const room of rooms) {
      for (let y = room.y; y < room.y + room.h; y++) {
        for (let x = room.x; x < room.x + room.w; x++) {
          if (x > 0 && x < w - 1 && y > 0 && y < h - 1) {
            cells[y][x] = floorCell('stone');
          }
        }
      }
    }

    // Connect rooms with corridors
    for (let i = 0; i < rooms.length - 1; i++) {
      const a = { x: Math.floor(rooms[i].x + rooms[i].w / 2), y: Math.floor(rooms[i].y + rooms[i].h / 2) };
      const b = { x: Math.floor(rooms[i + 1].x + rooms[i + 1].w / 2), y: Math.floor(rooms[i + 1].y + rooms[i + 1].h / 2) };
      this.carveCorridor(cells, w, h, a, b);
    }

    // Place doors at room entrances (where corridor meets room edge)
    for (const room of rooms) {
      this.placeDoors(cells, w, h, room);
    }

    // Place features
    if (rooms.length > 0) {
      // Stairs up in first room (entrance)
      const firstRoom = rooms[0];
      const stairsUpX = Math.floor(firstRoom.x + firstRoom.w / 2);
      const stairsUpY = Math.floor(firstRoom.y + firstRoom.h / 2);
      cells[stairsUpY][stairsUpX] = makeCell('stone', 1, false, ['stairs_up']);

      // Stairs down in last room
      const lastRoom = rooms[rooms.length - 1];
      const stairsDownX = Math.floor(lastRoom.x + lastRoom.w / 2);
      const stairsDownY = Math.floor(lastRoom.y + lastRoom.h / 2);
      cells[stairsDownY][stairsDownX] = makeCell('stone', 1, false, ['stairs_down']);

      // Chests in some rooms
      for (let i = 1; i < rooms.length - 1; i++) {
        if (this.rng.next() < 0.3) {
          const rx = rooms[i].x + 1;
          const ry = rooms[i].y + 1;
          if (cells[ry][rx].terrain === 'stone') {
            cells[ry][rx] = makeCell('stone', 1, false, ['chest']);
          }
        }
      }

      // Traps in corridors
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          if (cells[y][x].terrain === 'stone' && cells[y][x].features.length === 0) {
            if (this.rng.next() < 0.01) {
              cells[y][x] = makeCell('stone', 1, false, ['trap']);
            }
          }
        }
      }
    }

    // Player starts at stairs up
    const startRoom = rooms[0] ?? { x: 1, y: 1, w: 5, h: 5 };
    return {
      grid: { width: w, height: h, cells },
      playerStart: { x: Math.floor(startRoom.x + startRoom.w / 2), y: Math.floor(startRoom.y + startRoom.h / 2) },
    };
  }

  // ── Cave (40x40) ──────────────────────────────────────────

  private generateCave(): MapResult {
    const w = 40, h = 40;
    // Start with random fill
    const cells = this.fillGrid(w, h, 'wall', Infinity, true);

    // Random initial open cells (45% chance)
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (this.rng.next() < 0.45) {
          cells[y][x] = floorCell('stone');
        }
      }
    }

    // Cellular automata smoothing (4 iterations)
    for (let iter = 0; iter < 4; iter++) {
      const next = this.fillGrid(w, h, 'wall', Infinity, true);
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const wallCount = this.countWallNeighbors(cells, x, y);
          if (wallCount >= 5) {
            next[y][x] = wallCell();
          } else {
            next[y][x] = floorCell('stone');
          }
        }
      }
      // Copy back
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          cells[y][x] = next[y][x];
        }
      }
    }

    // Ensure borders are walls
    for (let x = 0; x < w; x++) {
      cells[0][x] = wallCell();
      cells[h - 1][x] = wallCell();
    }
    for (let y = 0; y < h; y++) {
      cells[y][0] = wallCell();
      cells[y][w - 1] = wallCell();
    }

    // Place water pools
    for (let y = 2; y < h - 2; y++) {
      for (let x = 2; x < w - 2; x++) {
        if (cells[y][x].terrain === 'stone' && this.rng.next() < 0.02) {
          // Small water pool
          cells[y][x] = makeCell('water', 2, false);
          if (cells[y + 1][x].terrain === 'stone') cells[y + 1][x] = makeCell('water', 2, false);
          if (cells[y][x + 1].terrain === 'stone') cells[y][x + 1] = makeCell('water', 2, false);
        }
      }
    }

    // Find a valid start position (open cell near center)
    const start = this.findOpenCell(cells, w, h, Math.floor(w / 2), Math.floor(h / 2));

    return {
      grid: { width: w, height: h, cells },
      playerStart: start,
    };
  }

  // ── Wilderness (50x50) ────────────────────────────────────

  private generateWilderness(biome: BiomeType): MapResult {
    const w = 50, h = 50;
    const baseTerrain = this.biomeToTerrain(biome);
    const cells = this.fillGrid(w, h, baseTerrain);

    // Place tree clusters (walls that block LoS)
    const treeCount = biome === 'forest' ? 120 : biome === 'plains' ? 20 : 60;
    for (let i = 0; i < treeCount; i++) {
      const tx = Math.floor(this.rng.next() * (w - 4)) + 2;
      const ty = Math.floor(this.rng.next() * (h - 4)) + 2;
      cells[ty][tx] = wallCell(); // Tree = wall
      // Small cluster
      if (this.rng.next() < 0.5) {
        const dx = this.rng.next() < 0.5 ? 1 : -1;
        if (tx + dx > 0 && tx + dx < w - 1) {
          cells[ty][tx + dx] = wallCell();
        }
      }
    }

    // Paths (stone terrain, easier movement)
    const pathY = Math.floor(h / 2) + Math.floor(this.rng.next() * 6) - 3;
    for (let x = 0; x < w; x++) {
      const py = pathY + Math.floor(Math.sin(x * 0.3) * 2);
      if (py >= 0 && py < h) {
        cells[py][x] = floorCell('stone');
        if (py + 1 < h) cells[py + 1][x] = floorCell('stone');
      }
    }

    // Stream (water, difficult terrain)
    if (this.rng.next() < 0.6) {
      let sx = Math.floor(this.rng.next() * w);
      for (let y = 0; y < h; y++) {
        sx += Math.floor(this.rng.next() * 3) - 1;
        sx = Math.max(0, Math.min(w - 1, sx));
        cells[y][sx] = makeCell('water', 2, false);
      }
    }

    // Clearing in center area
    const cx = Math.floor(w / 2) + Math.floor(this.rng.next() * 8) - 4;
    const cy = Math.floor(h / 2) + Math.floor(this.rng.next() * 8) - 4;
    const clearingRadius = 3 + Math.floor(this.rng.next() * 3);
    for (let dy = -clearingRadius; dy <= clearingRadius; dy++) {
      for (let dx = -clearingRadius; dx <= clearingRadius; dx++) {
        if (dx * dx + dy * dy <= clearingRadius * clearingRadius) {
          const px = cx + dx;
          const py = cy + dy;
          if (px >= 0 && px < w && py >= 0 && py < h) {
            cells[py][px] = floorCell(baseTerrain);
          }
        }
      }
    }

    // Player starts in the clearing
    return {
      grid: { width: w, height: h, cells },
      playerStart: { x: cx, y: cy },
    };
  }

  // ── Ruins ─────────────────────────────────────────────────

  private generateRuins(): MapResult {
    const w = 40, h = 40;
    const cells = this.fillGrid(w, h, 'grass');

    // Scattered broken walls (partially destroyed buildings)
    for (let i = 0; i < 6; i++) {
      const bx = 3 + Math.floor(this.rng.next() * (w - 12));
      const by = 3 + Math.floor(this.rng.next() * (h - 12));
      const bw = 5 + Math.floor(this.rng.next() * 4);
      const bh = 4 + Math.floor(this.rng.next() * 3);

      // Place partial walls (gaps for "ruined" effect)
      for (let y = by; y < by + bh && y < h; y++) {
        for (let x = bx; x < bx + bw && x < w; x++) {
          if (y === by || y === by + bh - 1 || x === bx || x === bx + bw - 1) {
            if (this.rng.next() < 0.7) { // 30% chance of gap
              cells[y][x] = wallCell();
            }
          } else {
            cells[y][x] = floorCell('stone');
          }
        }
      }
    }

    // Scatter some chests among ruins
    for (let i = 0; i < 3; i++) {
      const rx = 3 + Math.floor(this.rng.next() * (w - 6));
      const ry = 3 + Math.floor(this.rng.next() * (h - 6));
      if (cells[ry][rx].terrain !== 'wall') {
        cells[ry][rx] = makeCell('stone', 1, false, ['chest']);
      }
    }

    const start = this.findOpenCell(cells, w, h, Math.floor(w / 2), Math.floor(h / 2));
    return {
      grid: { width: w, height: h, cells },
      playerStart: start,
    };
  }

  // ── Castle ────────────────────────────────────────────────

  private generateCastle(): MapResult {
    const w = 35, h = 35;
    const cells = this.fillGrid(w, h, 'stone');

    // Outer walls
    for (let x = 0; x < w; x++) {
      cells[0][x] = wallCell();
      cells[h - 1][x] = wallCell();
    }
    for (let y = 0; y < h; y++) {
      cells[y][0] = wallCell();
      cells[y][w - 1] = wallCell();
    }

    // Inner rooms (grid of 3x3 rooms)
    for (let ry = 0; ry < 3; ry++) {
      for (let rx = 0; rx < 3; rx++) {
        const roomX = 2 + rx * 10;
        const roomY = 2 + ry * 10;
        this.placeBuilding(cells, w, h, roomX, roomY, 8, 8);
      }
    }

    // Central hall (larger open area)
    for (let y = 12; y < 23; y++) {
      for (let x = 12; x < 23; x++) {
        cells[y][x] = floorCell('stone');
      }
    }

    // Altar in center
    cells[17][17] = makeCell('stone', 1, false, ['altar']);

    // Pillars in central hall
    for (const pos of [{ x: 14, y: 14 }, { x: 20, y: 14 }, { x: 14, y: 20 }, { x: 20, y: 20 }]) {
      cells[pos.y][pos.x] = makeCell('stone', Infinity, true, ['pillar']);
    }

    // Entrance at south
    cells[h - 1][Math.floor(w / 2)] = floorCell('stone');
    cells[h - 1][Math.floor(w / 2) + 1] = floorCell('stone');

    return {
      grid: { width: w, height: h, cells },
      playerStart: { x: Math.floor(w / 2), y: h - 2 },
    };
  }

  // ── Temple ────────────────────────────────────────────────

  private generateTemple(): MapResult {
    const w = 30, h = 40;
    const cells = this.fillGrid(w, h, 'wall', Infinity, true);

    // Central nave
    for (let y = 2; y < h - 2; y++) {
      for (let x = 8; x < 22; x++) {
        cells[y][x] = floorCell('stone');
      }
    }

    // Side aisles
    for (let y = 5; y < h - 5; y++) {
      for (let x = 4; x < 8; x++) cells[y][x] = floorCell('stone');
      for (let x = 22; x < 26; x++) cells[y][x] = floorCell('stone');
    }

    // Pillars along nave
    for (let y = 5; y < h - 5; y += 4) {
      cells[y][8] = makeCell('stone', Infinity, true, ['pillar']);
      cells[y][21] = makeCell('stone', Infinity, true, ['pillar']);
    }

    // Altar at far end
    cells[3][15] = makeCell('stone', 1, false, ['altar']);

    // Fountain near entrance
    cells[h - 4][15] = makeCell('stone', 1, false, ['fountain']);

    // Door at entrance
    cells[h - 2][15] = makeCell('stone', 1, false, ['door']);

    return {
      grid: { width: w, height: h, cells },
      playerStart: { x: 15, y: h - 3 },
    };
  }

  // ── Utility Methods ───────────────────────────────────────

  private fillGrid(
    w: number,
    h: number,
    terrain: CellTerrain,
    movementCost = 1,
    blocksLoS = false,
  ): GridCell[][] {
    const cells: GridCell[][] = [];
    for (let y = 0; y < h; y++) {
      cells[y] = [];
      for (let x = 0; x < w; x++) {
        cells[y][x] = makeCell(terrain, movementCost, blocksLoS);
      }
    }
    return cells;
  }

  private placeBuilding(
    cells: GridCell[][],
    gridW: number,
    gridH: number,
    bx: number,
    by: number,
    bw: number,
    bh: number,
  ): void {
    // Walls
    for (let y = by; y < by + bh && y < gridH; y++) {
      for (let x = bx; x < bx + bw && x < gridW; x++) {
        if (y === by || y === by + bh - 1 || x === bx || x === bx + bw - 1) {
          cells[y][x] = wallCell();
        } else {
          cells[y][x] = floorCell('wood');
        }
      }
    }

    // Door on south wall
    const doorX = bx + Math.floor(bw / 2);
    const doorY = by + bh - 1;
    if (doorX < gridW && doorY < gridH) {
      cells[doorY][doorX] = makeCell('wood', Infinity, true, ['door']);
    }
  }

  private placePerimeter(
    cells: GridCell[][],
    w: number,
    h: number,
    gaps: Coordinate[],
  ): void {
    const gapSet = new Set(gaps.map(g => `${g.x},${g.y}`));

    for (let x = 0; x < w; x++) {
      if (!gapSet.has(`${x},0`)) cells[0][x] = wallCell();
      if (!gapSet.has(`${x},${h - 1}`)) cells[h - 1][x] = wallCell();
    }
    for (let y = 0; y < h; y++) {
      if (!gapSet.has(`0,${y}`)) cells[y][0] = wallCell();
      if (!gapSet.has(`${w - 1},${y}`)) cells[y][w - 1] = wallCell();
    }
  }

  private bspDivide(
    rooms: { x: number; y: number; w: number; h: number }[],
    x: number, y: number,
    w: number, h: number,
    depth: number,
  ): void {
    const minSize = 5;
    const maxDepth = 4;

    if (depth >= maxDepth || w < minSize * 2 || h < minSize * 2) {
      // Create a room with some padding
      const roomW = Math.max(minSize, Math.floor(w * (0.6 + this.rng.next() * 0.3)));
      const roomH = Math.max(minSize, Math.floor(h * (0.6 + this.rng.next() * 0.3)));
      const roomX = x + Math.floor(this.rng.next() * Math.max(1, w - roomW));
      const roomY = y + Math.floor(this.rng.next() * Math.max(1, h - roomH));
      rooms.push({ x: roomX, y: roomY, w: roomW, h: roomH });
      return;
    }

    // Split horizontally or vertically
    if (this.rng.next() < 0.5 && w >= minSize * 2) {
      const split = Math.floor(minSize + this.rng.next() * (w - minSize * 2));
      this.bspDivide(rooms, x, y, split, h, depth + 1);
      this.bspDivide(rooms, x + split, y, w - split, h, depth + 1);
    } else if (h >= minSize * 2) {
      const split = Math.floor(minSize + this.rng.next() * (h - minSize * 2));
      this.bspDivide(rooms, x, y, w, split, depth + 1);
      this.bspDivide(rooms, x, y + split, w, h - split, depth + 1);
    } else {
      const roomW = Math.max(minSize, Math.floor(w * 0.8));
      const roomH = Math.max(minSize, Math.floor(h * 0.8));
      rooms.push({ x, y, w: roomW, h: roomH });
    }
  }

  private carveCorridor(
    cells: GridCell[][],
    w: number,
    h: number,
    from: Coordinate,
    to: Coordinate,
  ): void {
    let x = from.x;
    let y = from.y;

    // L-shaped corridor: horizontal then vertical
    while (x !== to.x) {
      if (x >= 0 && x < w && y >= 0 && y < h) {
        cells[y][x] = floorCell('stone');
      }
      x += x < to.x ? 1 : -1;
    }
    while (y !== to.y) {
      if (x >= 0 && x < w && y >= 0 && y < h) {
        cells[y][x] = floorCell('stone');
      }
      y += y < to.y ? 1 : -1;
    }
  }

  private placeDoors(
    cells: GridCell[][],
    w: number,
    h: number,
    room: { x: number; y: number; w: number; h: number },
  ): void {
    // Check edges for corridor connections and place doors
    const edges = [
      ...Array.from({ length: room.w }, (_, i) => ({ x: room.x + i, y: room.y })),
      ...Array.from({ length: room.w }, (_, i) => ({ x: room.x + i, y: room.y + room.h - 1 })),
      ...Array.from({ length: room.h }, (_, i) => ({ x: room.x, y: room.y + i })),
      ...Array.from({ length: room.h }, (_, i) => ({ x: room.x + room.w - 1, y: room.y + i })),
    ];

    for (const edge of edges) {
      if (edge.x <= 0 || edge.x >= w - 1 || edge.y <= 0 || edge.y >= h - 1) continue;
      const cell = cells[edge.y][edge.x];
      if (cell.terrain === 'stone' && cell.movementCost < Infinity) {
        // This edge cell is already open (corridor carved through)
        // Check if adjacent cells form a doorway (wall on both sides)
        const isHorizontalDoor =
          edge.y > 0 && edge.y < h - 1 &&
          cells[edge.y - 1][edge.x].terrain === 'wall' &&
          cells[edge.y + 1][edge.x].terrain === 'wall';
        const isVerticalDoor =
          edge.x > 0 && edge.x < w - 1 &&
          cells[edge.y][edge.x - 1].terrain === 'wall' &&
          cells[edge.y][edge.x + 1].terrain === 'wall';

        if ((isHorizontalDoor || isVerticalDoor) && this.rng.next() < 0.5) {
          cells[edge.y][edge.x] = makeCell('stone', Infinity, true, ['door']);
        }
      }
    }
  }

  private countWallNeighbors(cells: GridCell[][], x: number, y: number): number {
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (ny < 0 || ny >= cells.length || nx < 0 || nx >= cells[0].length) {
          count++; // Out of bounds counts as wall
        } else if (cells[ny][nx].movementCost === Infinity) {
          count++;
        }
      }
    }
    return count;
  }

  private findOpenCell(cells: GridCell[][], w: number, h: number, startX: number, startY: number): Coordinate {
    // Spiral outward from start position
    for (let radius = 0; radius < Math.max(w, h); radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
          const x = startX + dx;
          const y = startY + dy;
          if (x >= 0 && x < w && y >= 0 && y < h && cells[y][x].movementCost < Infinity) {
            return { x, y };
          }
        }
      }
    }
    return { x: startX, y: startY };
  }

  private biomeToTerrain(biome: BiomeType): CellTerrain {
    const map: Record<BiomeType, CellTerrain> = {
      forest: 'grass',
      mountain: 'stone',
      desert: 'sand',
      swamp: 'mud',
      plains: 'grass',
      coast: 'sand',
      tundra: 'ice',
      volcanic: 'stone',
      underdark: 'stone',
      urban: 'stone',
    };
    return map[biome] ?? 'grass';
  }
}
