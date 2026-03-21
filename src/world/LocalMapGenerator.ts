import type { Coordinate, GridCell, GridDefinition, CellTerrain, CellFeature } from '@/types';
import type { LocationType, BiomeType } from '@/types/world';
import type { OverworldTerrain } from '@/types/overworld';
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
 * Derive a deterministic seed for a specific overworld tile.
 * Same world seed + same coordinates = same local map every time.
 */
function tileSeed(worldSeed: number, x: number, y: number): number {
  // Mix coordinates into seed using large primes to avoid patterns
  let h = worldSeed ^ 0x9e3779b9;
  h = Math.imul(h ^ x, 0x85ebca6b);
  h = Math.imul(h ^ y, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * Generates detailed local maps for different location types.
 * Each map is a GridDefinition with terrain, features, and a player start position.
 *
 * For overworld tiles, use `generateFromTerrain()` with a world seed and
 * tile coordinates to get deterministic, unique maps per tile.
 */
export class LocalMapGenerator {
  private rng: SeededRNG;

  constructor(rng: SeededRNG) {
    this.rng = rng;
  }

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

  /**
   * Generate a local map for an overworld tile.
   * Uses a deterministic per-tile seed so the same tile always produces
   * the same map regardless of visit order.
   */
  generateFromTerrain(
    terrain: OverworldTerrain,
    hasRiver: boolean,
    worldSeed: number,
    tileX: number,
    tileY: number,
  ): MapResult {
    // Create a tile-specific RNG — deterministic per position
    const savedRng = this.rng;
    this.rng = new SeededRNG(tileSeed(worldSeed, tileX, tileY));

    const biomeMap: Record<OverworldTerrain, BiomeType> = {
      deep_water: 'coast',
      shallow_water: 'coast',
      beach: 'coast',
      plains: 'plains',
      forest: 'forest',
      dense_forest: 'forest',
      hills: 'mountain',
      mountain: 'mountain',
      peak: 'mountain',
      snow: 'tundra',
      desert: 'desert',
      swamp: 'swamp',
      tundra: 'tundra',
      volcanic: 'volcanic',
    };

    const biome = biomeMap[terrain];
    let result: MapResult;

    switch (terrain) {
      case 'mountain':
        result = this.generateCave();
        break;
      case 'beach':
      case 'shallow_water':
        result = this.generateCoast(hasRiver);
        break;
      case 'dense_forest':
        result = this.generateDenseForest();
        break;
      case 'hills':
        result = this.generateHills();
        break;
      case 'swamp':
        result = this.generateSwamp();
        break;
      case 'desert':
        result = this.generateDesert();
        break;
      case 'volcanic':
        result = this.generateVolcanic();
        break;
      default:
        result = this.generateWilderness(biome);
        break;
    }

    // Restore the original RNG
    this.rng = savedRng;
    return result;
  }

  // ── Coast (50x50) ──────────────────────────────────────────

  private generateCoast(hasRiver: boolean): MapResult {
    const w = 50, h = 50;
    const cells = this.fillGrid(w, h, 'sand');

    // Randomize which side the water is on (N/S/E/W)
    const side = Math.floor(this.rng.next() * 4); // 0=west, 1=east, 2=north, 3=south
    const waterDepth = 0.2 + this.rng.next() * 0.2; // 20-40% water coverage
    const waveFreq = 0.1 + this.rng.next() * 0.3;   // Wave frequency
    const waveAmp = 2 + Math.floor(this.rng.next() * 4); // Wave amplitude

    for (let a = 0; a < h; a++) {
      const edgeBase = Math.floor((side < 2 ? w : h) * waterDepth);
      const edgeVariation = edgeBase + Math.floor(Math.sin(a * waveFreq) * waveAmp);
      for (let b = 0; b < edgeVariation; b++) {
        let x: number, y: number;
        if (side === 0)      { x = b; y = a; }           // Water on west
        else if (side === 1) { x = w - 1 - b; y = a; }   // Water on east
        else if (side === 2) { x = a; y = b; }            // Water on north
        else                 { x = a; y = h - 1 - b; }   // Water on south
        if (x >= 0 && x < w && y >= 0 && y < h) {
          cells[y][x] = makeCell('water', 2, false);
        }
      }
    }

    // Driftwood and rocks on beach edge
    for (let a = 0; a < (side < 2 ? h : w); a++) {
      const edgeBase = Math.floor((side < 2 ? w : h) * waterDepth);
      for (let offset = 0; offset < 5; offset++) {
        const b = edgeBase + offset;
        let x: number, y: number;
        if (side === 0)      { x = b; y = a; }
        else if (side === 1) { x = w - 1 - b; y = a; }
        else if (side === 2) { x = a; y = b; }
        else                 { x = a; y = h - 1 - b; }
        if (x >= 0 && x < w && y >= 0 && y < h && this.rng.next() < 0.04) {
          cells[y][x] = makeCell('sand', 1, false, ['chest']);
        }
      }
    }

    // Some grass inland
    const grassStart = 0.55 + this.rng.next() * 0.15;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (cells[y][x].terrain !== 'water') {
          // Distance from water edge determines grass probability
          let inlandDist: number;
          if (side === 0) inlandDist = x / w;
          else if (side === 1) inlandDist = (w - 1 - x) / w;
          else if (side === 2) inlandDist = y / h;
          else inlandDist = (h - 1 - y) / h;
          if (inlandDist > grassStart && this.rng.next() < 0.5) {
            cells[y][x] = floorCell('grass');
          }
        }
      }
    }

    if (hasRiver) {
      // River perpendicular to the coast
      const isHoriz = side >= 2;
      let pos = Math.floor((isHoriz ? h : w) * (0.3 + this.rng.next() * 0.4));
      const len = isHoriz ? w : h;
      for (let i = 0; i < len; i++) {
        pos += Math.floor(this.rng.next() * 3) - 1;
        pos = Math.max(2, Math.min((isHoriz ? h : w) - 3, pos));
        const x = isHoriz ? i : pos;
        const y = isHoriz ? pos : i;
        if (x >= 0 && x < w && y >= 0 && y < h) {
          cells[y][x] = makeCell('water', 2, false);
        }
      }
    }

    // Player starts inland
    const sx = side === 0 ? Math.floor(w * 0.7) : side === 1 ? Math.floor(w * 0.3) : Math.floor(w / 2);
    const sy = side === 2 ? Math.floor(h * 0.7) : side === 3 ? Math.floor(h * 0.3) : Math.floor(h / 2);
    const start = this.findOpenCell(cells, w, h, sx, sy);
    return { grid: { width: w, height: h, cells }, playerStart: start };
  }

  // ── Dense Forest (50x50) ────────────────────────────────────

  private generateDenseForest(): MapResult {
    const w = 50, h = 50;
    const cells = this.fillGrid(w, h, 'grass');

    // Vary tree density per tile
    const density = 0.45 + this.rng.next() * 0.2; // 45-65%
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (this.rng.next() < density) {
          cells[y][x] = wallCell();
        }
      }
    }

    // Cellular automata iterations (2-4)
    const iterations = 2 + Math.floor(this.rng.next() * 3);
    const threshold = 3 + Math.floor(this.rng.next() * 2); // 3-4
    for (let iter = 0; iter < iterations; iter++) {
      const next = this.fillGrid(w, h, 'grass');
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const wallCount = this.countWallNeighbors(cells, x, y);
          next[y][x] = wallCount >= threshold ? wallCell() : floorCell('grass');
        }
      }
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          cells[y][x] = next[y][x];
        }
      }
    }

    // Winding path — random direction (horizontal or vertical, or diagonal)
    const pathDir = Math.floor(this.rng.next() * 3); // 0=horiz, 1=vert, 2=diagonal
    if (pathDir === 0) {
      let py = Math.floor(h * (0.3 + this.rng.next() * 0.4));
      for (let px = 0; px < w; px++) {
        cells[py][px] = floorCell('grass');
        if (py > 1 && py < h - 2) cells[py + 1][px] = floorCell('grass');
        py += Math.floor(this.rng.next() * 3) - 1;
        py = Math.max(1, Math.min(h - 2, py));
      }
    } else if (pathDir === 1) {
      let px = Math.floor(w * (0.3 + this.rng.next() * 0.4));
      for (let py = 0; py < h; py++) {
        cells[py][px] = floorCell('grass');
        if (px > 1 && px < w - 2) cells[py][px + 1] = floorCell('grass');
        px += Math.floor(this.rng.next() * 3) - 1;
        px = Math.max(1, Math.min(w - 2, px));
      }
    } else {
      let px = 0, py = 0;
      while (px < w && py < h) {
        cells[py][px] = floorCell('grass');
        if (px + 1 < w) cells[py][px + 1] = floorCell('grass');
        px++;
        py += this.rng.next() < 0.7 ? 1 : 0;
        py = Math.min(h - 1, py);
      }
    }

    // Optional small clearings
    const clearingCount = Math.floor(this.rng.next() * 3);
    for (let i = 0; i < clearingCount; i++) {
      const cx = 5 + Math.floor(this.rng.next() * (w - 10));
      const cy = 5 + Math.floor(this.rng.next() * (h - 10));
      const r = 2 + Math.floor(this.rng.next() * 2);
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy <= r * r) {
            const px = cx + dx, py = cy + dy;
            if (px > 0 && px < w - 1 && py > 0 && py < h - 1) {
              cells[py][px] = floorCell('grass');
            }
          }
        }
      }
    }

    const start = this.findOpenCell(cells, w, h, Math.floor(w / 2), Math.floor(h / 2));
    return { grid: { width: w, height: h, cells }, playerStart: start };
  }

  // ── Hills (50x50) ──────────────────────────────────────────

  private generateHills(): MapResult {
    const w = 50, h = 50;
    const cells = this.fillGrid(w, h, 'grass');

    // Vary outcrop count and size range
    const outcropCount = 8 + Math.floor(this.rng.next() * 15); // 8-22
    for (let i = 0; i < outcropCount; i++) {
      const cx = 3 + Math.floor(this.rng.next() * (w - 6));
      const cy = 3 + Math.floor(this.rng.next() * (h - 6));
      const r = 1 + Math.floor(this.rng.next() * 4); // 1-4
      const fillRate = 0.4 + this.rng.next() * 0.4;  // 40-80% fill
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy <= r * r && this.rng.next() < fillRate) {
            const px = cx + dx, py = cy + dy;
            if (px > 0 && px < w - 1 && py > 0 && py < h - 1) {
              cells[py][px] = makeCell('stone', 2, true);
            }
          }
        }
      }
    }

    // Trail — random orientation and wave
    const trailDir = this.rng.next() < 0.6 ? 'horiz' : 'vert';
    const trailOffset = 0.3 + this.rng.next() * 0.4; // Position 30-70%
    const waveFreq = 0.08 + this.rng.next() * 0.15;
    const waveAmp = 3 + Math.floor(this.rng.next() * 5);

    if (trailDir === 'horiz') {
      const baseY = Math.floor(h * trailOffset);
      for (let x = 0; x < w; x++) {
        const ty = baseY + Math.floor(Math.sin(x * waveFreq) * waveAmp);
        if (ty >= 0 && ty < h) {
          cells[ty][x] = floorCell('stone');
          if (ty + 1 < h) cells[ty + 1][x] = floorCell('stone');
        }
      }
    } else {
      const baseX = Math.floor(w * trailOffset);
      for (let y = 0; y < h; y++) {
        const tx = baseX + Math.floor(Math.sin(y * waveFreq) * waveAmp);
        if (tx >= 0 && tx < w) {
          cells[y][tx] = floorCell('stone');
          if (tx + 1 < w) cells[y][tx + 1] = floorCell('stone');
        }
      }
    }

    // Occasional grass patches among stone
    for (let i = 0; i < 5; i++) {
      const cx = 5 + Math.floor(this.rng.next() * (w - 10));
      const cy = 5 + Math.floor(this.rng.next() * (h - 10));
      const r = 2 + Math.floor(this.rng.next() * 3);
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy <= r * r) {
            const px = cx + dx, py = cy + dy;
            if (px > 0 && px < w - 1 && py > 0 && py < h - 1 && cells[py][px].terrain !== 'stone') {
              // Leave as grass (don't overwrite stone outcrops)
            }
          }
        }
      }
    }

    const start = this.findOpenCell(cells, w, h, Math.floor(w / 2), Math.floor(h / 2));
    return { grid: { width: w, height: h, cells }, playerStart: start };
  }

  // ── Swamp (50x50) ──────────────────────────────────────────

  private generateSwamp(): MapResult {
    const w = 50, h = 50;
    const cells = this.fillGrid(w, h, 'mud');

    // Vary water coverage
    const waterDensity = 0.15 + this.rng.next() * 0.2; // 15-35%
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (this.rng.next() < waterDensity) {
          cells[y][x] = makeCell('water', 3, false);
        }
      }
    }

    // Cellular automata for natural pools (vary iterations and threshold)
    const iterations = 1 + Math.floor(this.rng.next() * 3); // 1-3
    const poolThreshold = 4 + Math.floor(this.rng.next() * 2); // 4-5
    for (let iter = 0; iter < iterations; iter++) {
      const next = this.fillGrid(w, h, 'mud');
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          let waterCount = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (cells[y + dy][x + dx].terrain === 'water') waterCount++;
            }
          }
          next[y][x] = waterCount >= poolThreshold
            ? makeCell('water', 3, false)
            : makeCell('mud', 2, false);
        }
      }
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          cells[y][x] = next[y][x];
        }
      }
    }

    // Dead trees — vary count
    const treeCount = 15 + Math.floor(this.rng.next() * 30); // 15-44
    for (let i = 0; i < treeCount; i++) {
      const tx = Math.floor(this.rng.next() * (w - 2)) + 1;
      const ty = Math.floor(this.rng.next() * (h - 2)) + 1;
      if (cells[ty][tx].terrain === 'mud') {
        cells[ty][tx] = wallCell();
      }
    }

    // Optional raised mud islands (dry patches)
    const islandCount = Math.floor(this.rng.next() * 4);
    for (let i = 0; i < islandCount; i++) {
      const cx = 5 + Math.floor(this.rng.next() * (w - 10));
      const cy = 5 + Math.floor(this.rng.next() * (h - 10));
      const r = 2 + Math.floor(this.rng.next() * 3);
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy <= r * r) {
            const px = cx + dx, py = cy + dy;
            if (px > 0 && px < w - 1 && py > 0 && py < h - 1) {
              cells[py][px] = makeCell('mud', 2, false);
            }
          }
        }
      }
    }

    const start = this.findOpenCell(cells, w, h, Math.floor(w / 2), Math.floor(h / 2));
    return { grid: { width: w, height: h, cells }, playerStart: start };
  }

  // ── Desert (50x50) ─────────────────────────────────────────

  private generateDesert(): MapResult {
    const w = 50, h = 50;
    const cells = this.fillGrid(w, h, 'sand');

    // Dune ridges — vary count and orientation
    const duneCount = 4 + Math.floor(this.rng.next() * 8); // 4-11
    const duneHoriz = this.rng.next() < 0.5;

    for (let i = 0; i < duneCount; i++) {
      if (duneHoriz) {
        let dy = Math.floor(this.rng.next() * h);
        for (let x = 0; x < w; x++) {
          dy += Math.floor(this.rng.next() * 3) - 1;
          dy = Math.max(0, Math.min(h - 1, dy));
          if (this.rng.next() < 0.65) {
            cells[dy][x] = makeCell('sand', Infinity, true);
          }
        }
      } else {
        let dx = Math.floor(this.rng.next() * w);
        for (let y = 0; y < h; y++) {
          dx += Math.floor(this.rng.next() * 3) - 1;
          dx = Math.max(0, Math.min(w - 1, dx));
          if (this.rng.next() < 0.65) {
            cells[y][dx] = makeCell('sand', Infinity, true);
          }
        }
      }
    }

    // Oasis — vary count (0-2) and position
    const oasisCount = Math.floor(this.rng.next() * 3); // 0-2
    for (let i = 0; i < oasisCount; i++) {
      const ox = 8 + Math.floor(this.rng.next() * (w - 16));
      const oy = 8 + Math.floor(this.rng.next() * (h - 16));
      const oasisR = 2 + Math.floor(this.rng.next() * 3); // 2-4
      for (let dy = -oasisR; dy <= oasisR; dy++) {
        for (let dx = -oasisR; dx <= oasisR; dx++) {
          if (dx * dx + dy * dy <= oasisR * oasisR) {
            const px = ox + dx, py = oy + dy;
            if (px >= 0 && px < w && py >= 0 && py < h) {
              cells[py][px] = makeCell('water', 1, false);
            }
          }
        }
      }
      // Vegetation ring around oasis
      const vegR = oasisR + 2;
      for (let dy = -vegR; dy <= vegR; dy++) {
        for (let dx = -vegR; dx <= vegR; dx++) {
          const d2 = dx * dx + dy * dy;
          if (d2 > oasisR * oasisR && d2 <= vegR * vegR && this.rng.next() < 0.25) {
            const px = ox + dx, py = oy + dy;
            if (px >= 0 && px < w && py >= 0 && py < h && cells[py][px].terrain === 'sand' && cells[py][px].movementCost < Infinity) {
              cells[py][px] = floorCell('grass');
            }
          }
        }
      }
    }

    // Scattered rocks
    const rockCount = Math.floor(this.rng.next() * 12);
    for (let i = 0; i < rockCount; i++) {
      const rx = 2 + Math.floor(this.rng.next() * (w - 4));
      const ry = 2 + Math.floor(this.rng.next() * (h - 4));
      if (cells[ry][rx].terrain === 'sand' && cells[ry][rx].movementCost < Infinity) {
        cells[ry][rx] = makeCell('stone', 2, true);
      }
    }

    const start = this.findOpenCell(cells, w, h, Math.floor(w / 2), Math.floor(h / 2));
    return { grid: { width: w, height: h, cells }, playerStart: start };
  }

  // ── Volcanic (50x50) ───────────────────────────────────────

  private generateVolcanic(): MapResult {
    const w = 50, h = 50;
    const cells = this.fillGrid(w, h, 'stone');

    // Lava pools — vary initial density
    const lavaDensity = 0.04 + this.rng.next() * 0.08; // 4-12%
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (this.rng.next() < lavaDensity) {
          cells[y][x] = makeCell('water', Infinity, false); // lava = deadly water
        }
      }
    }

    // Cellular automata for lava pools
    const iterations = 1 + Math.floor(this.rng.next() * 3); // 1-3
    const lavaThreshold = 4 + Math.floor(this.rng.next() * 2); // 4-5
    for (let iter = 0; iter < iterations; iter++) {
      const next = this.fillGrid(w, h, 'stone');
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          let lavaCount = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (cells[y + dy][x + dx].terrain === 'water') lavaCount++;
            }
          }
          next[y][x] = lavaCount >= lavaThreshold
            ? makeCell('water', Infinity, false)
            : makeCell('stone', 1, false);
        }
      }
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          cells[y][x] = next[y][x];
        }
      }
    }

    // Rock formations — vary count
    const rockCount = 10 + Math.floor(this.rng.next() * 25); // 10-34
    for (let i = 0; i < rockCount; i++) {
      const rx = Math.floor(this.rng.next() * (w - 2)) + 1;
      const ry = Math.floor(this.rng.next() * (h - 2)) + 1;
      if (cells[ry][rx].terrain === 'stone') {
        cells[ry][rx] = wallCell();
        // Occasional cluster
        if (this.rng.next() < 0.3) {
          const dx = Math.floor(this.rng.next() * 3) - 1;
          const dy = Math.floor(this.rng.next() * 3) - 1;
          const nx = rx + dx, ny = ry + dy;
          if (nx > 0 && nx < w - 1 && ny > 0 && ny < h - 1 && cells[ny][nx].terrain === 'stone') {
            cells[ny][nx] = wallCell();
          }
        }
      }
    }

    // Lava rivers (0-2)
    const lavaRivers = Math.floor(this.rng.next() * 3);
    for (let r = 0; r < lavaRivers; r++) {
      const isHoriz = this.rng.next() < 0.5;
      let pos = Math.floor(this.rng.next() * (isHoriz ? h : w));
      const len = isHoriz ? w : h;
      for (let i = 0; i < len; i++) {
        pos += Math.floor(this.rng.next() * 3) - 1;
        pos = Math.max(1, Math.min((isHoriz ? h : w) - 2, pos));
        const x = isHoriz ? i : pos;
        const y = isHoriz ? pos : i;
        cells[y][x] = makeCell('water', Infinity, false);
      }
    }

    const start = this.findOpenCell(cells, w, h, Math.floor(w / 2), Math.floor(h / 2));
    return { grid: { width: w, height: h, cells }, playerStart: start };
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

    // Place buildings in quadrants — vary sizes
    const buildingSpots = [
      { x: 5, y: 5, bw: 6 + Math.floor(this.rng.next() * 4), bh: 5 + Math.floor(this.rng.next() * 3) },
      { x: 27, y: 5, bw: 6 + Math.floor(this.rng.next() * 4), bh: 5 + Math.floor(this.rng.next() * 3) },
      { x: 5, y: 28, bw: 6 + Math.floor(this.rng.next() * 4), bh: 5 + Math.floor(this.rng.next() * 3) },
      { x: 27, y: 28, bw: 6 + Math.floor(this.rng.next() * 4), bh: 5 + Math.floor(this.rng.next() * 3) },
      { x: 5, y: 15, bw: 5 + Math.floor(this.rng.next() * 3), bh: 4 + Math.floor(this.rng.next() * 3) },
      { x: 29, y: 15, bw: 5 + Math.floor(this.rng.next() * 3), bh: 4 + Math.floor(this.rng.next() * 3) },
      { x: 15, y: 5, bw: 4 + Math.floor(this.rng.next() * 3), bh: 4 + Math.floor(this.rng.next() * 3) },
      { x: 15, y: 30, bw: 4 + Math.floor(this.rng.next() * 3), bh: 4 + Math.floor(this.rng.next() * 3) },
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

    // Vary initial open density
    const openDensity = 0.38 + this.rng.next() * 0.14; // 38-52%
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (this.rng.next() < openDensity) {
          cells[y][x] = floorCell('stone');
        }
      }
    }

    // Cellular automata smoothing (3-5 iterations)
    const iterations = 3 + Math.floor(this.rng.next() * 3);
    for (let iter = 0; iter < iterations; iter++) {
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

    // Place water pools — vary density
    const poolChance = 0.01 + this.rng.next() * 0.03; // 1-4%
    for (let y = 2; y < h - 2; y++) {
      for (let x = 2; x < w - 2; x++) {
        if (cells[y][x].terrain === 'stone' && this.rng.next() < poolChance) {
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

    // Vary tree/obstacle count based on biome + randomness
    const baseTreeCount = biome === 'forest' ? 120 : biome === 'plains' ? 20 : 60;
    const treeCount = Math.floor(baseTreeCount * (0.6 + this.rng.next() * 0.8)); // 60-140% of base
    for (let i = 0; i < treeCount; i++) {
      const tx = Math.floor(this.rng.next() * (w - 4)) + 2;
      const ty = Math.floor(this.rng.next() * (h - 4)) + 2;
      cells[ty][tx] = wallCell();
      // Cluster size varies
      const clusterSize = Math.floor(this.rng.next() * 3); // 0-2 extra
      for (let c = 0; c < clusterSize; c++) {
        const dx = Math.floor(this.rng.next() * 3) - 1;
        const dy = Math.floor(this.rng.next() * 3) - 1;
        const nx = tx + dx, ny = ty + dy;
        if (nx > 0 && nx < w - 1 && ny > 0 && ny < h - 1) {
          cells[ny][nx] = wallCell();
        }
      }
    }

    // Path — random direction
    const pathDir = Math.floor(this.rng.next() * 4); // 0=EW, 1=NS, 2=NW-SE, 3=NE-SW
    const pathOffset = 0.3 + this.rng.next() * 0.4;
    const pathWave = 0.1 + this.rng.next() * 0.4;

    if (pathDir === 0) {
      const pathY = Math.floor(h * pathOffset);
      for (let x = 0; x < w; x++) {
        const py = pathY + Math.floor(Math.sin(x * pathWave) * 3);
        if (py >= 0 && py < h) {
          cells[py][x] = floorCell('stone');
          if (py + 1 < h) cells[py + 1][x] = floorCell('stone');
        }
      }
    } else if (pathDir === 1) {
      const pathX = Math.floor(w * pathOffset);
      for (let y = 0; y < h; y++) {
        const px = pathX + Math.floor(Math.sin(y * pathWave) * 3);
        if (px >= 0 && px < w) {
          cells[y][px] = floorCell('stone');
          if (px + 1 < w) cells[y][px + 1] = floorCell('stone');
        }
      }
    } else {
      // Diagonal path
      const startX = pathDir === 2 ? 0 : w - 1;
      let px = startX, py = 0;
      const stepX = pathDir === 2 ? 1 : -1;
      while (py < h && px >= 0 && px < w) {
        cells[py][px] = floorCell('stone');
        if (px + 1 < w && px + 1 >= 0) cells[py][px + stepX > 0 ? px + 1 : px - 1 < 0 ? px : px - 1] = floorCell('stone');
        py++;
        px += this.rng.next() < 0.6 ? stepX : 0;
        px = Math.max(0, Math.min(w - 1, px));
      }
    }

    // Stream — vary presence and direction
    if (this.rng.next() < 0.5) {
      const streamDir = this.rng.next() < 0.5; // true=vertical, false=horizontal
      if (streamDir) {
        let sx = Math.floor(this.rng.next() * w);
        for (let y = 0; y < h; y++) {
          sx += Math.floor(this.rng.next() * 3) - 1;
          sx = Math.max(0, Math.min(w - 1, sx));
          cells[y][sx] = makeCell('water', 2, false);
        }
      } else {
        let sy = Math.floor(this.rng.next() * h);
        for (let x = 0; x < w; x++) {
          sy += Math.floor(this.rng.next() * 3) - 1;
          sy = Math.max(0, Math.min(h - 1, sy));
          cells[sy][x] = makeCell('water', 2, false);
        }
      }
    }

    // Clearing — vary position and size
    const cx = Math.floor(w * (0.2 + this.rng.next() * 0.6));
    const cy = Math.floor(h * (0.2 + this.rng.next() * 0.6));
    const clearingRadius = 2 + Math.floor(this.rng.next() * 4);
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

    // Vary number of ruined buildings
    const ruinCount = 3 + Math.floor(this.rng.next() * 6); // 3-8
    for (let i = 0; i < ruinCount; i++) {
      const bx = 3 + Math.floor(this.rng.next() * (w - 12));
      const by = 3 + Math.floor(this.rng.next() * (h - 12));
      const bw = 5 + Math.floor(this.rng.next() * 4);
      const bh = 4 + Math.floor(this.rng.next() * 3);
      const decay = 0.5 + this.rng.next() * 0.3; // 50-80% walls remaining

      for (let y = by; y < by + bh && y < h; y++) {
        for (let x = bx; x < bx + bw && x < w; x++) {
          if (y === by || y === by + bh - 1 || x === bx || x === bx + bw - 1) {
            if (this.rng.next() < decay) {
              cells[y][x] = wallCell();
            }
          } else {
            cells[y][x] = floorCell('stone');
          }
        }
      }
    }

    // Scatter some chests among ruins
    const chestCount = 1 + Math.floor(this.rng.next() * 4); // 1-4
    for (let i = 0; i < chestCount; i++) {
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
