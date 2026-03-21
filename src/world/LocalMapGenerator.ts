import type { Coordinate, GridCell, GridDefinition, CellTerrain, CellFeature } from '@/types';
import type { LocationType, BiomeType } from '@/types/world';
import type { OverworldTerrain } from '@/types/overworld';
import { SeededRNG } from '@/utils/SeededRNG';

interface MapResult {
  grid: GridDefinition;
  playerStart: Coordinate;
}

// ── Cell Helpers ──────────────────────────────────────────────

function makeCell(
  terrain: CellTerrain,
  movementCost = 1,
  blocksLoS = false,
  features: CellFeature[] = [],
): GridCell {
  return { terrain, movementCost, blocksLoS, elevation: 0, features };
}

/** Structural wall — use ONLY for buildings, dungeon walls, perimeters */
function wallCell(): GridCell {
  return makeCell('wall', Infinity, true);
}

function floorCell(terrain: CellTerrain = 'floor'): GridCell {
  return makeCell(terrain);
}

/** Tree on terrain — impassable, blocks LoS */
function treeCell(ground: CellTerrain = 'grass'): GridCell {
  return makeCell(ground, Infinity, true, ['tree']);
}

/** Large rock — impassable, blocks LoS */
function rockCell(ground: CellTerrain = 'stone'): GridCell {
  return makeCell(ground, Infinity, true, ['rock']);
}

/**
 * Derive a deterministic seed for a specific overworld tile.
 * Same world seed + same coordinates = same local map every time.
 */
export function tileSeed(worldSeed: number, x: number, y: number): number {
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

  /**
   * Run a generation function with a tile-specific deterministic RNG.
   * Same world seed + same coordinates = same map every time.
   */
  private withTileSeed<T>(worldSeed: number, tileX: number, tileY: number, fn: () => T): T {
    const saved = this.rng;
    this.rng = new SeededRNG(tileSeed(worldSeed, tileX, tileY));
    const result = fn();
    this.rng = saved;
    return result;
  }

  generate(
    locationType: LocationType,
    biome: BiomeType = 'forest',
    worldSeed?: number,
    tileX?: number,
    tileY?: number,
  ): MapResult {
    const doGenerate = () => {
      switch (locationType) {
        case 'village':
        case 'town':
        case 'city':
          return this.generateTown(biome, locationType);
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
    };

    if (worldSeed !== undefined && tileX !== undefined && tileY !== undefined) {
      return this.withTileSeed(worldSeed ^ 0x5e77_1e00, tileX, tileY, doGenerate);
    }
    return doGenerate();
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
    /** Bitmask of which sides have water: bit 0=north, 1=south, 2=west, 3=east */
    waterSides = 0,
  ): MapResult {
    return this.withTileSeed(worldSeed, tileX, tileY, () => {

    switch (terrain) {
      case 'mountain':
        return this.generateCave();
      case 'beach':
      case 'shallow_water':
        return this.generateCoast(hasRiver, waterSides);
      case 'dense_forest':
        return this.generateDenseForest();
      case 'hills':
        return this.generateHills();
      case 'swamp':
        return this.generateSwamp();
      case 'desert':
        return this.generateDesert();
      case 'volcanic':
        return this.generateVolcanic();
      case 'snow':
      case 'tundra':
        return this.generateTundra();
      case 'peak':
        return this.generatePeak();
      default:
        return this.generateWilderness(terrain === 'plains' ? 'plains' : 'forest');
    }
    });
  }

  // ── Coast (50x50) ──────────────────────────────────────────

  private generateCoast(hasRiver: boolean, waterSides: number): MapResult {
    const w = 50, h = 50;
    const cells = this.fillGrid(w, h, 'sand');

    const hasN = (waterSides & 1) !== 0;
    const hasS = (waterSides & 2) !== 0;
    const hasW = (waterSides & 4) !== 0;
    const hasE = (waterSides & 8) !== 0;
    const sideCount = +hasN + +hasS + +hasW + +hasE;

    let waterN = hasN, waterS = hasS, waterW = hasW, waterE = hasE;
    if (sideCount === 0) {
      const pick = Math.floor(this.rng.next() * 4);
      if (pick === 0) waterN = true;
      else if (pick === 1) waterS = true;
      else if (pick === 2) waterW = true;
      else waterE = true;
    }

    // Per-side water parameters — varying wave shapes
    const waveFreq = 0.08 + this.rng.next() * 0.12;
    const waveAmp = 2 + Math.floor(this.rng.next() * 4);
    const baseDepth = 0.22 + this.rng.next() * 0.13;

    const paintWaterEdge = (
      primary: 'x' | 'y',
      fromMax: boolean,
      length: number,
      span: number,
    ) => {
      const depth = Math.floor(span * baseDepth);
      for (let a = 0; a < length; a++) {
        const edge = depth + Math.floor(Math.sin(a * waveFreq) * waveAmp)
          + Math.floor(Math.sin(a * waveFreq * 2.3 + 1.7) * (waveAmp * 0.4));
        for (let b = 0; b < edge; b++) {
          let x: number, y: number;
          if (primary === 'y' && !fromMax)      { x = a; y = b; }
          else if (primary === 'y' && fromMax)   { x = a; y = span - 1 - b; }
          else if (primary === 'x' && !fromMax)  { x = b; y = a; }
          else                                    { x = span - 1 - b; y = a; }
          if (x >= 0 && x < w && y >= 0 && y < h) {
            cells[y][x] = makeCell('water', 2, false);
          }
        }
      }
    };

    if (waterN) paintWaterEdge('y', false, w, h);
    if (waterS) paintWaterEdge('y', true,  w, h);
    if (waterW) paintWaterEdge('x', false, h, w);
    if (waterE) paintWaterEdge('x', true,  h, w);

    // Transition zone: wet sand near water (movement cost 2)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (cells[y][x].terrain !== 'sand') continue;
        if (this.adjacentTo(cells, w, h, x, y, 'water')) {
          cells[y][x] = makeCell('sand', 2, false);
        }
      }
    }

    // Driftwood and tide pools along shore
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (cells[y][x].terrain !== 'sand') continue;
        if (!this.adjacentTo(cells, w, h, x, y, 'water')) continue;
        const r = this.rng.next();
        if (r < 0.012) {
          cells[y][x] = makeCell('sand', 1, false, ['chest']); // driftwood/debris
        }
      }
    }

    // Grass and vegetation inland
    const grassThreshold = 0.5 + this.rng.next() * 0.15;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (cells[y][x].terrain !== 'sand') continue;
        let inlandDist = 1;
        if (waterN) inlandDist = Math.min(inlandDist, y / h);
        if (waterS) inlandDist = Math.min(inlandDist, (h - 1 - y) / h);
        if (waterW) inlandDist = Math.min(inlandDist, x / w);
        if (waterE) inlandDist = Math.min(inlandDist, (w - 1 - x) / w);
        if (inlandDist > grassThreshold) {
          if (this.rng.next() < 0.6) cells[y][x] = floorCell('grass');
        } else if (inlandDist > grassThreshold * 0.8) {
          if (this.rng.next() < 0.25) cells[y][x] = floorCell('grass');
        }
      }
    }

    // Scattered trees in grassy areas
    for (let y = 2; y < h - 2; y++) {
      for (let x = 2; x < w - 2; x++) {
        if (cells[y][x].terrain === 'grass' && this.rng.next() < 0.04) {
          cells[y][x] = treeCell('grass');
        }
      }
    }

    // Rocks along the coastline
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (cells[y][x].terrain === 'sand' && this.rng.next() < 0.008) {
          if (this.adjacentTo(cells, w, h, x, y, 'water')) {
            cells[y][x] = rockCell('sand');
          }
        }
      }
    }

    if (hasRiver) {
      const primarySide = waterS ? 'S' : waterN ? 'N' : waterW ? 'W' : 'E';
      const isVert = primarySide === 'N' || primarySide === 'S';
      let pos = Math.floor((isVert ? w : h) * (0.3 + this.rng.next() * 0.4));
      const len = isVert ? h : w;
      for (let i = 0; i < len; i++) {
        pos += Math.floor(this.rng.next() * 3) - 1;
        pos = Math.max(2, Math.min((isVert ? w : h) - 3, pos));
        const x = isVert ? pos : i;
        const y = isVert ? i : pos;
        if (x >= 0 && x < w && y >= 0 && y < h) {
          cells[y][x] = makeCell('water', 2, false);
          // River is 2 tiles wide
          if (isVert && x + 1 < w) cells[y][x + 1] = makeCell('water', 2, false);
          else if (!isVert && y + 1 < h) cells[y + 1][x] = makeCell('water', 2, false);
        }
      }
    }

    // Player starts inland
    let sx = Math.floor(w / 2), sy = Math.floor(h / 2);
    if (waterN) sy = Math.max(sy, Math.floor(h * 0.7));
    if (waterS) sy = Math.min(sy, Math.floor(h * 0.3));
    if (waterW) sx = Math.max(sx, Math.floor(w * 0.7));
    if (waterE) sx = Math.min(sx, Math.floor(w * 0.3));
    const start = this.findOpenCell(cells, w, h, sx, sy);
    return { grid: { width: w, height: h, cells }, playerStart: start };
  }

  // ── Dense Forest (50x50) ────────────────────────────────────
  //
  // Thick old-growth forest. Trees placed via noise, not random scatter.
  // Winding animal trails connect clearings.

  private generateDenseForest(): MapResult {
    const w = 50, h = 50;
    const cells = this.fillGrid(w, h, 'grass');

    // Generate a noise field for tree placement (organic clumps)
    const noise = this.generateNoiseField(w, h, 0.12 + this.rng.next() * 0.06);
    const treeCutoff = 0.35 + this.rng.next() * 0.15; // 35-50% — high density

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (noise[y][x] > treeCutoff) {
          cells[y][x] = treeCell('grass');
        }
      }
    }

    // Carve 1-3 natural clearings (gathering spots, fallen trees, etc.)
    const clearingCount = 1 + Math.floor(this.rng.next() * 3);
    const clearings: Coordinate[] = [];
    for (let i = 0; i < clearingCount; i++) {
      const cx = 8 + Math.floor(this.rng.next() * (w - 16));
      const cy = 8 + Math.floor(this.rng.next() * (h - 16));
      const rx = 3 + Math.floor(this.rng.next() * 3);
      const ry = 2 + Math.floor(this.rng.next() * 3);
      clearings.push({ x: cx, y: cy });
      for (let dy = -ry; dy <= ry; dy++) {
        for (let dx = -rx; dx <= rx; dx++) {
          const dist = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
          if (dist <= 1) {
            const px = cx + dx, py = cy + dy;
            if (px >= 0 && px < w && py >= 0 && py < h) {
              cells[py][px] = floorCell('grass');
            }
          }
        }
      }
    }

    // Winding trails connecting clearings and map edges
    const trailPoints: Coordinate[] = [...clearings];
    // Add edge entry points
    const edgeCount = 2 + Math.floor(this.rng.next() * 2);
    for (let i = 0; i < edgeCount; i++) {
      const side = Math.floor(this.rng.next() * 4);
      if (side === 0) trailPoints.push({ x: Math.floor(this.rng.next() * w), y: 0 });
      else if (side === 1) trailPoints.push({ x: Math.floor(this.rng.next() * w), y: h - 1 });
      else if (side === 2) trailPoints.push({ x: 0, y: Math.floor(this.rng.next() * h) });
      else trailPoints.push({ x: w - 1, y: Math.floor(this.rng.next() * h) });
    }

    // Connect points with winding paths
    for (let i = 0; i < trailPoints.length - 1; i++) {
      this.carveWindingPath(cells, w, h, trailPoints[i], trailPoints[i + 1], 'grass', 1);
    }

    // Mushroom rings, fallen logs (features in clearings)
    for (const c of clearings) {
      if (this.rng.next() < 0.5) {
        cells[c.y][c.x] = makeCell('grass', 1, false, ['fire']); // campfire remains
      }
    }

    // Occasional stream through the forest
    if (this.rng.next() < 0.4) {
      this.carveStream(cells, w, h);
    }

    const start = clearings.length > 0
      ? this.findOpenCell(cells, w, h, clearings[0].x, clearings[0].y)
      : this.findOpenCell(cells, w, h, Math.floor(w / 2), Math.floor(h / 2));
    return { grid: { width: w, height: h, cells }, playerStart: start };
  }

  // ── Hills (50x50) ──────────────────────────────────────────
  //
  // Rolling terrain with rocky outcrops, switchback trails,
  // and grassy meadows between stone ridges.

  private generateHills(): MapResult {
    const w = 50, h = 50;
    const cells = this.fillGrid(w, h, 'grass');

    // Elevation noise — high areas become stone with rocks
    const elevation = this.generateNoiseField(w, h, 0.08 + this.rng.next() * 0.04);
    const stoneCutoff = 0.45 + this.rng.next() * 0.15;
    const rockCutoff = stoneCutoff + 0.15;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const e = elevation[y][x];
        if (e > rockCutoff && this.rng.next() < 0.5) {
          cells[y][x] = rockCell('stone');
        } else if (e > stoneCutoff) {
          cells[y][x] = makeCell('stone', 2, false); // rocky ground, difficult terrain
        }
      }
    }

    // Ridge lines — elongated rocky formations
    const ridgeCount = 1 + Math.floor(this.rng.next() * 3);
    for (let r = 0; r < ridgeCount; r++) {
      const startX = Math.floor(this.rng.next() * w);
      const startY = Math.floor(this.rng.next() * h);
      const angle = this.rng.next() * Math.PI;
      const len = 15 + Math.floor(this.rng.next() * 20);
      for (let i = 0; i < len; i++) {
        const rx = Math.floor(startX + Math.cos(angle) * i + (this.rng.next() - 0.5) * 2);
        const ry = Math.floor(startY + Math.sin(angle) * i + (this.rng.next() - 0.5) * 2);
        if (rx >= 0 && rx < w && ry >= 0 && ry < h) {
          cells[ry][rx] = rockCell('stone');
          // Ridge is slightly wider
          if (rx + 1 < w && this.rng.next() < 0.6) cells[ry][rx + 1] = makeCell('stone', 2, false);
        }
      }
    }

    // Winding trail through the hills
    const trailStart: Coordinate = this.rng.next() < 0.5
      ? { x: 0, y: Math.floor(h * (0.3 + this.rng.next() * 0.4)) }
      : { x: Math.floor(w * (0.3 + this.rng.next() * 0.4)), y: 0 };
    const trailEnd: Coordinate = this.rng.next() < 0.5
      ? { x: w - 1, y: Math.floor(h * (0.3 + this.rng.next() * 0.4)) }
      : { x: Math.floor(w * (0.3 + this.rng.next() * 0.4)), y: h - 1 };
    this.carveWindingPath(cells, w, h, trailStart, trailEnd, 'stone', 2);

    // Scattered trees in grassy meadows
    for (let y = 2; y < h - 2; y++) {
      for (let x = 2; x < w - 2; x++) {
        if (cells[y][x].terrain === 'grass' && this.rng.next() < 0.03) {
          cells[y][x] = treeCell('grass');
        }
      }
    }

    const start = this.findOpenCell(cells, w, h, Math.floor(w / 2), Math.floor(h / 2));
    return { grid: { width: w, height: h, cells }, playerStart: start };
  }

  // ── Swamp (50x50) ──────────────────────────────────────────
  //
  // Murky wetland. Interconnected pools, dead trees rising from mud,
  // moss-covered ground, and treacherous footing.

  private generateSwamp(): MapResult {
    const w = 50, h = 50;
    const cells = this.fillGrid(w, h, 'mud');

    // Water pools via cellular automata — organic shapes
    const waterSeed = 0.28 + this.rng.next() * 0.12;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (this.rng.next() < waterSeed) {
          cells[y][x] = makeCell('water', 3, false);
        }
      }
    }

    const iterations = 2 + Math.floor(this.rng.next() * 2);
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
          next[y][x] = waterCount >= 5
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

    // Dead trees — rise from mud, clustered in drier areas
    const treeNoise = this.generateNoiseField(w, h, 0.1 + this.rng.next() * 0.05);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (cells[y][x].terrain === 'mud' && treeNoise[y][x] > 0.55 && this.rng.next() < 0.3) {
          cells[y][x] = treeCell('mud');
        }
      }
    }

    // Dry islands — slightly raised areas of solid mud
    const islandCount = 1 + Math.floor(this.rng.next() * 3);
    for (let i = 0; i < islandCount; i++) {
      const cx = 8 + Math.floor(this.rng.next() * (w - 16));
      const cy = 8 + Math.floor(this.rng.next() * (h - 16));
      const r = 3 + Math.floor(this.rng.next() * 3);
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy <= r * r) {
            const px = cx + dx, py = cy + dy;
            if (px > 0 && px < w - 1 && py > 0 && py < h - 1) {
              cells[py][px] = makeCell('mud', 1, false); // solid, easier mud
            }
          }
        }
      }
    }

    // Winding path through the swamp (wooden boardwalk feel)
    const pathStart: Coordinate = { x: 0, y: Math.floor(h * (0.3 + this.rng.next() * 0.4)) };
    const pathEnd: Coordinate = { x: w - 1, y: Math.floor(h * (0.3 + this.rng.next() * 0.4)) };
    this.carveWindingPath(cells, w, h, pathStart, pathEnd, 'wood', 1);

    // Occasional stream connecting pools
    if (this.rng.next() < 0.5) {
      this.carveStream(cells, w, h);
    }

    const start = this.findOpenCell(cells, w, h, Math.floor(w / 2), Math.floor(h / 2));
    return { grid: { width: w, height: h, cells }, playerStart: start };
  }

  // ── Desert (50x50) ─────────────────────────────────────────
  //
  // Shifting dunes, cracked earth, scattered rocks.
  // Dunes are difficult terrain, not walls.

  private generateDesert(): MapResult {
    const w = 50, h = 50;
    const cells = this.fillGrid(w, h, 'sand');

    // Dune patterns via layered noise
    const duneNoise = this.generateNoiseField(w, h, 0.06 + this.rng.next() * 0.04);
    const duneCutoff = 0.5 + this.rng.next() * 0.15;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (duneNoise[y][x] > duneCutoff) {
          // High dunes — difficult terrain, blocks LoS
          cells[y][x] = makeCell('sand', 3, true);
        } else if (duneNoise[y][x] > duneCutoff - 0.1) {
          // Low dunes — difficult terrain
          cells[y][x] = makeCell('sand', 2, false);
        }
      }
    }

    // Rocky outcrops — sparse, clustered
    const rockClusters = 2 + Math.floor(this.rng.next() * 4);
    for (let i = 0; i < rockClusters; i++) {
      const cx = 5 + Math.floor(this.rng.next() * (w - 10));
      const cy = 5 + Math.floor(this.rng.next() * (h - 10));
      const count = 2 + Math.floor(this.rng.next() * 4);
      for (let j = 0; j < count; j++) {
        const rx = cx + Math.floor(this.rng.next() * 5) - 2;
        const ry = cy + Math.floor(this.rng.next() * 5) - 2;
        if (rx >= 0 && rx < w && ry >= 0 && ry < h) {
          cells[ry][rx] = rockCell('sand');
        }
      }
    }

    // Oasis (0-2) — water surrounded by vegetation
    const oasisCount = Math.floor(this.rng.next() * 3);
    for (let i = 0; i < oasisCount; i++) {
      const ox = 10 + Math.floor(this.rng.next() * (w - 20));
      const oy = 10 + Math.floor(this.rng.next() * (h - 20));
      const oasisR = 2 + Math.floor(this.rng.next() * 2);

      // Water center
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
      // Vegetation ring
      const vegR = oasisR + 2;
      for (let dy = -vegR; dy <= vegR; dy++) {
        for (let dx = -vegR; dx <= vegR; dx++) {
          const d2 = dx * dx + dy * dy;
          if (d2 > oasisR * oasisR && d2 <= vegR * vegR) {
            const px = ox + dx, py = oy + dy;
            if (px >= 0 && px < w && py >= 0 && py < h) {
              if (this.rng.next() < 0.4) cells[py][px] = floorCell('grass');
              else if (this.rng.next() < 0.15) cells[py][px] = treeCell('grass');
            }
          }
        }
      }
    }

    // Caravan trail — faint path across the desert
    const trailY = Math.floor(h * (0.3 + this.rng.next() * 0.4));
    for (let x = 0; x < w; x++) {
      const ty = trailY + Math.floor(Math.sin(x * 0.08) * 4 + (this.rng.next() - 0.5) * 2);
      if (ty >= 0 && ty < h) {
        cells[ty][x] = floorCell('sand'); // clear sand, easy footing
      }
    }

    const start = this.findOpenCell(cells, w, h, Math.floor(w / 2), Math.floor(h / 2));
    return { grid: { width: w, height: h, cells }, playerStart: start };
  }

  // ── Volcanic (50x50) ───────────────────────────────────────
  //
  // Jagged volcanic landscape. Lava flows, obsidian boulders,
  // cracked basalt ground.

  private generateVolcanic(): MapResult {
    const w = 50, h = 50;
    const cells = this.fillGrid(w, h, 'stone');

    // Lava pools via cellular automata
    const lavaSeed = 0.12 + this.rng.next() * 0.1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (this.rng.next() < lavaSeed) {
          cells[y][x] = makeCell('lava', Infinity, false);
        }
      }
    }

    const iterations = 2 + Math.floor(this.rng.next() * 2);
    for (let iter = 0; iter < iterations; iter++) {
      const next = this.fillGrid(w, h, 'stone');
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          let lavaCount = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (cells[y + dy][x + dx].terrain === 'lava') lavaCount++;
            }
          }
          next[y][x] = lavaCount >= 5
            ? makeCell('lava', Infinity, false)
            : makeCell('stone', 1, false);
        }
      }
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          cells[y][x] = next[y][x];
        }
      }
    }

    // Rock formations — clustered boulders on stone ground
    const rockNoise = this.generateNoiseField(w, h, 0.1);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (cells[y][x].terrain === 'stone' && rockNoise[y][x] > 0.65 && this.rng.next() < 0.35) {
          cells[y][x] = rockCell('stone');
        }
      }
    }

    // Lava rivers (0-2) — flowing lava channels
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
        if (x >= 0 && x < w && y >= 0 && y < h) {
          cells[y][x] = makeCell('lava', Infinity, false);
          // Lava glow border
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx, ny = y + dy;
              if (nx >= 0 && nx < w && ny >= 0 && ny < h && cells[ny][nx].terrain === 'stone'
                  && cells[ny][nx].features.length === 0) {
                cells[ny][nx] = makeCell('stone', 2, false); // hot ground
              }
            }
          }
        }
      }
    }

    // Safe path through the volcanic field
    this.carveWindingPath(
      cells, w, h,
      { x: 0, y: Math.floor(h / 2) },
      { x: w - 1, y: Math.floor(h / 2) },
      'stone', 2,
    );

    const start = this.findOpenCell(cells, w, h, Math.floor(w / 2), Math.floor(h / 2));
    return { grid: { width: w, height: h, cells }, playerStart: start };
  }

  // ── Tundra (50x50) ─────────────────────────────────────────
  //
  // Frozen wasteland. Ice sheets, snowdrifts, frozen streams,
  // sparse scrub vegetation.

  private generateTundra(): MapResult {
    const w = 50, h = 50;
    const cells = this.fillGrid(w, h, 'ice');

    // Snow patches (slightly different terrain feel)
    const snowNoise = this.generateNoiseField(w, h, 0.1);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (snowNoise[y][x] < 0.35) {
          cells[y][x] = makeCell('ice', 2, false); // deep snow, difficult
        }
      }
    }

    // Frozen water bodies
    const poolCount = 1 + Math.floor(this.rng.next() * 3);
    for (let i = 0; i < poolCount; i++) {
      const cx = 8 + Math.floor(this.rng.next() * (w - 16));
      const cy = 8 + Math.floor(this.rng.next() * (h - 16));
      const r = 3 + Math.floor(this.rng.next() * 4);
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy <= r * r + (this.rng.next() - 0.5) * r) {
            const px = cx + dx, py = cy + dy;
            if (px >= 0 && px < w && py >= 0 && py < h) {
              cells[py][px] = makeCell('water', 2, false);
            }
          }
        }
      }
    }

    // Scattered rocks and boulders
    const rockClusters = 3 + Math.floor(this.rng.next() * 4);
    for (let i = 0; i < rockClusters; i++) {
      const cx = 4 + Math.floor(this.rng.next() * (w - 8));
      const cy = 4 + Math.floor(this.rng.next() * (h - 8));
      const count = 1 + Math.floor(this.rng.next() * 3);
      for (let j = 0; j < count; j++) {
        const rx = cx + Math.floor(this.rng.next() * 4) - 2;
        const ry = cy + Math.floor(this.rng.next() * 4) - 2;
        if (rx >= 0 && rx < w && ry >= 0 && ry < h) {
          cells[ry][rx] = rockCell('ice');
        }
      }
    }

    // Sparse dead trees
    for (let y = 2; y < h - 2; y++) {
      for (let x = 2; x < w - 2; x++) {
        if (cells[y][x].terrain === 'ice' && cells[y][x].movementCost === 1 && this.rng.next() < 0.015) {
          cells[y][x] = treeCell('ice');
        }
      }
    }

    // Trail
    this.carveWindingPath(
      cells, w, h,
      { x: Math.floor(w * (0.3 + this.rng.next() * 0.4)), y: 0 },
      { x: Math.floor(w * (0.3 + this.rng.next() * 0.4)), y: h - 1 },
      'ice', 1,
    );

    const start = this.findOpenCell(cells, w, h, Math.floor(w / 2), Math.floor(h / 2));
    return { grid: { width: w, height: h, cells }, playerStart: start };
  }

  // ── Mountain Peak (40x40) ──────────────────────────────────
  //
  // Exposed summit. Mostly rock with sparse vegetation,
  // cliff edges, and wind-scoured stone.

  private generatePeak(): MapResult {
    const w = 40, h = 40;
    const cells = this.fillGrid(w, h, 'stone');

    // Elevation: center is highest, edges are cliffs
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x - w / 2;
        const dy = y - h / 2;
        const dist = Math.sqrt(dx * dx + dy * dy) / (w / 2);

        if (dist > 0.85) {
          // Cliff edges — impassable
          cells[y][x] = rockCell('stone');
        } else if (dist > 0.7 && this.rng.next() < 0.3) {
          cells[y][x] = rockCell('stone');
        }
      }
    }

    // Wind-carved rock formations in center
    const formations = 3 + Math.floor(this.rng.next() * 5);
    for (let i = 0; i < formations; i++) {
      const fx = 8 + Math.floor(this.rng.next() * (w - 16));
      const fy = 8 + Math.floor(this.rng.next() * (h - 16));
      cells[fy][fx] = rockCell('stone');
      if (this.rng.next() < 0.6 && fx + 1 < w) cells[fy][fx + 1] = rockCell('stone');
      if (this.rng.next() < 0.4 && fy + 1 < h) cells[fy + 1][fx] = rockCell('stone');
    }

    // Ice patches at high elevation
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (cells[y][x].terrain === 'stone' && cells[y][x].features.length === 0 && this.rng.next() < 0.08) {
          cells[y][x] = makeCell('ice', 2, false);
        }
      }
    }

    // Narrow path up
    this.carveWindingPath(
      cells, w, h,
      { x: Math.floor(w / 2), y: h - 1 },
      { x: Math.floor(w / 2), y: Math.floor(h * 0.3) },
      'stone', 1,
    );

    const start = this.findOpenCell(cells, w, h, Math.floor(w / 2), h - 3);
    return { grid: { width: w, height: h, cells }, playerStart: start };
  }

  // ── Town (40x40) ──────────────────────────────────────────

  private generateTown(biome: BiomeType = 'forest', size: LocationType = 'village'): MapResult {
    const w = 40, h = 40;

    const groundTerrain: CellTerrain = biome === 'desert' ? 'sand'
      : biome === 'tundra' ? 'ice'
      : biome === 'swamp' ? 'mud'
      : biome === 'volcanic' ? 'stone'
      : biome === 'mountain' ? 'stone'
      : 'grass';

    const roadTerrain: CellTerrain = biome === 'desert' ? 'sand'
      : biome === 'swamp' ? 'wood'
      : 'stone';

    const cells = this.fillGrid(w, h, groundTerrain);

    // Biome decoration (sparse — this is a town)
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const r = this.rng.next();
        if (biome === 'forest' && r < 0.04) cells[y][x] = treeCell('grass');
        else if (biome === 'desert' && r < 0.015) cells[y][x] = rockCell('sand');
        else if (biome === 'tundra' && r < 0.02) cells[y][x] = rockCell('ice');
        else if (biome === 'mountain' && r < 0.025) cells[y][x] = rockCell('stone');
      }
    }

    // Road layout
    const layoutRoll = this.rng.next();
    const midX = Math.floor(w / 2) + Math.floor(this.rng.next() * 5) - 2;
    const midY = Math.floor(h / 2) + Math.floor(this.rng.next() * 5) - 2;

    const hasEWRoad = layoutRoll < 0.8;
    const hasNSRoad = layoutRoll > 0.2;
    const roadDiagonal = layoutRoll > 0.85;

    if (hasEWRoad) {
      const curve = Math.floor(this.rng.next() * 3) - 1;
      for (let x = 2; x < w - 2; x++) {
        const yOff = x > w / 3 && x < 2 * w / 3 ? 0 : curve;
        const ry = Math.max(1, Math.min(h - 2, midY + yOff));
        cells[ry][x] = floorCell(roadTerrain);
        if (ry - 1 >= 0) cells[ry - 1][x] = floorCell(roadTerrain);
      }
    }

    if (hasNSRoad && !roadDiagonal) {
      const curve = Math.floor(this.rng.next() * 3) - 1;
      for (let y = 2; y < h - 2; y++) {
        const xOff = y > h / 3 && y < 2 * h / 3 ? 0 : curve;
        const rx = Math.max(1, Math.min(w - 2, midX + xOff));
        cells[y][rx] = floorCell(roadTerrain);
        if (rx + 1 < w) cells[y][rx + 1] = floorCell(roadTerrain);
      }
    } else if (roadDiagonal) {
      for (let i = 2; i < Math.min(w, h) - 2; i++) {
        const dx = Math.min(w - 2, i);
        const dy = Math.min(h - 2, i);
        cells[dy][dx] = floorCell(roadTerrain);
        if (dx + 1 < w) cells[dy][dx + 1] = floorCell(roadTerrain);
      }
    }

    // Town square
    const sqSize = size === 'city' ? 5 : size === 'town' ? 4 : 3;
    for (let y = midY - sqSize; y <= midY + sqSize - 1; y++) {
      for (let x = midX - sqSize; x <= midX + sqSize; x++) {
        if (x >= 1 && x < w - 1 && y >= 1 && y < h - 1) {
          cells[y][x] = floorCell(roadTerrain);
        }
      }
    }

    // Center feature
    const featureRoll = this.rng.next();
    const centerFeature: CellFeature = featureRoll < 0.5 ? 'fountain'
      : featureRoll < 0.8 ? 'fire' : 'fountain';
    cells[midY][midX] = makeCell(roadTerrain, 1, false, [centerFeature]);

    // Buildings
    const buildingCount = size === 'city' ? 10 + Math.floor(this.rng.next() * 4)
      : size === 'town' ? 7 + Math.floor(this.rng.next() * 3)
      : 4 + Math.floor(this.rng.next() * 3);

    const placed: { x: number; y: number; bw: number; bh: number }[] = [];

    for (let attempt = 0; attempt < buildingCount * 8 && placed.length < buildingCount; attempt++) {
      const bw = 4 + Math.floor(this.rng.next() * 5);
      const bh = 4 + Math.floor(this.rng.next() * 4);
      const bx = 3 + Math.floor(this.rng.next() * (w - bw - 6));
      const by = 3 + Math.floor(this.rng.next() * (h - bh - 6));

      let overlaps = false;
      if (bx < midX + sqSize + 2 && bx + bw > midX - sqSize - 1 &&
          by < midY + sqSize + 1 && by + bh > midY - sqSize - 1) {
        overlaps = true;
      }
      for (const p of placed) {
        if (bx < p.x + p.bw + 1 && bx + bw + 1 > p.x &&
            by < p.y + p.bh + 1 && by + bh + 1 > p.y) {
          overlaps = true;
          break;
        }
      }
      if (!overlaps) {
        placed.push({ x: bx, y: by, bw, bh });
        this.placeBuilding(cells, w, h, bx, by, bw, bh);
      }
    }

    // Perimeter wall
    const hasWall = size === 'city' || size === 'town' || this.rng.next() < 0.4;
    const gates: Coordinate[] = [];

    if (hasWall) {
      if (hasEWRoad) {
        gates.push({ x: 0, y: midY }, { x: 0, y: midY - 1 });
        gates.push({ x: w - 1, y: midY }, { x: w - 1, y: midY - 1 });
      }
      if (hasNSRoad || roadDiagonal) {
        gates.push({ x: midX, y: 0 }, { x: midX + 1, y: 0 });
        gates.push({ x: midX, y: h - 1 }, { x: midX + 1, y: h - 1 });
      }
      if (gates.length === 0) {
        gates.push({ x: midX, y: h - 1 }, { x: midX + 1, y: h - 1 });
      }
      this.placePerimeter(cells, w, h, gates);
    }

    const startY = hasWall ? h - 2 : h - 3;
    return {
      grid: { width: w, height: h, cells },
      playerStart: { x: midX, y: startY },
    };
  }

  // ── Dungeon (30x50) ───────────────────────────────────────

  private generateDungeon(): MapResult {
    const w = 30, h = 50;
    const cells = this.fillGrid(w, h, 'wall', Infinity, true);

    const rooms: { x: number; y: number; w: number; h: number }[] = [];
    this.bspDivide(rooms, 1, 1, w - 2, h - 2, 0);

    for (const room of rooms) {
      for (let y = room.y; y < room.y + room.h; y++) {
        for (let x = room.x; x < room.x + room.w; x++) {
          if (x > 0 && x < w - 1 && y > 0 && y < h - 1) {
            cells[y][x] = floorCell('stone');
          }
        }
      }
    }

    for (let i = 0; i < rooms.length - 1; i++) {
      const a = { x: Math.floor(rooms[i].x + rooms[i].w / 2), y: Math.floor(rooms[i].y + rooms[i].h / 2) };
      const b = { x: Math.floor(rooms[i + 1].x + rooms[i + 1].w / 2), y: Math.floor(rooms[i + 1].y + rooms[i + 1].h / 2) };
      this.carveCorridor(cells, w, h, a, b);
    }

    for (const room of rooms) {
      this.placeDoors(cells, w, h, room);
    }

    if (rooms.length > 0) {
      const firstRoom = rooms[0];
      const stairsUpX = Math.floor(firstRoom.x + firstRoom.w / 2);
      const stairsUpY = Math.floor(firstRoom.y + firstRoom.h / 2);
      cells[stairsUpY][stairsUpX] = makeCell('stone', 1, false, ['stairs_up']);

      const lastRoom = rooms[rooms.length - 1];
      const stairsDownX = Math.floor(lastRoom.x + lastRoom.w / 2);
      const stairsDownY = Math.floor(lastRoom.y + lastRoom.h / 2);
      cells[stairsDownY][stairsDownX] = makeCell('stone', 1, false, ['stairs_down']);

      for (let i = 1; i < rooms.length - 1; i++) {
        if (this.rng.next() < 0.3) {
          const rx = rooms[i].x + 1;
          const ry = rooms[i].y + 1;
          if (cells[ry][rx].terrain === 'stone') {
            cells[ry][rx] = makeCell('stone', 1, false, ['chest']);
          }
        }
      }

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

    const startRoom = rooms[0] ?? { x: 1, y: 1, w: 5, h: 5 };
    return {
      grid: { width: w, height: h, cells },
      playerStart: { x: Math.floor(startRoom.x + startRoom.w / 2), y: Math.floor(startRoom.y + startRoom.h / 2) },
    };
  }

  // ── Cave (40x40) ──────────────────────────────────────────

  private generateCave(): MapResult {
    const w = 40, h = 40;
    const cells = this.fillGrid(w, h, 'wall', Infinity, true);

    const openDensity = 0.40 + this.rng.next() * 0.1;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (this.rng.next() < openDensity) {
          cells[y][x] = floorCell('stone');
        }
      }
    }

    const iterations = 3 + Math.floor(this.rng.next() * 3);
    for (let iter = 0; iter < iterations; iter++) {
      const next = this.fillGrid(w, h, 'wall', Infinity, true);
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const wallCount = this.countWallNeighbors(cells, x, y);
          next[y][x] = wallCount >= 5 ? wallCell() : floorCell('stone');
        }
      }
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          cells[y][x] = next[y][x];
        }
      }
    }

    // Borders are walls
    for (let x = 0; x < w; x++) {
      cells[0][x] = wallCell();
      cells[h - 1][x] = wallCell();
    }
    for (let y = 0; y < h; y++) {
      cells[y][0] = wallCell();
      cells[y][w - 1] = wallCell();
    }

    // Water pools
    const poolChance = 0.01 + this.rng.next() * 0.03;
    for (let y = 2; y < h - 2; y++) {
      for (let x = 2; x < w - 2; x++) {
        if (cells[y][x].terrain === 'stone' && this.rng.next() < poolChance) {
          cells[y][x] = makeCell('water', 2, false);
          if (cells[y + 1][x].terrain === 'stone') cells[y + 1][x] = makeCell('water', 2, false);
          if (cells[y][x + 1].terrain === 'stone') cells[y][x + 1] = makeCell('water', 2, false);
        }
      }
    }

    const start = this.findOpenCell(cells, w, h, Math.floor(w / 2), Math.floor(h / 2));
    return { grid: { width: w, height: h, cells }, playerStart: start };
  }

  // ── Wilderness (50x50) ────────────────────────────────────
  //
  // Open natural landscape. Trees placed organically via noise,
  // winding paths, clearings, optional streams.

  private generateWilderness(biome: BiomeType): MapResult {
    const w = 50, h = 50;
    const baseTerrain = this.biomeToTerrain(biome);
    const cells = this.fillGrid(w, h, baseTerrain);

    // Tree/obstacle placement via noise for organic clumping
    const isForest = biome === 'forest';
    const isPlains = biome === 'plains';
    const treeDensity = isForest ? 0.42 : isPlains ? 0.08 : 0.2;

    const noise = this.generateNoiseField(w, h, 0.1 + this.rng.next() * 0.06);
    const cutoff = 1 - treeDensity;

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (noise[y][x] > cutoff) {
          cells[y][x] = treeCell(baseTerrain);
        }
      }
    }

    // Clearings — open areas in the forest
    const clearingCount = isForest ? 2 + Math.floor(this.rng.next() * 3) :
                          isPlains ? 0 : 1 + Math.floor(this.rng.next() * 2);
    const clearings: Coordinate[] = [];
    for (let i = 0; i < clearingCount; i++) {
      const cx = 8 + Math.floor(this.rng.next() * (w - 16));
      const cy = 8 + Math.floor(this.rng.next() * (h - 16));
      const r = 3 + Math.floor(this.rng.next() * 4);
      clearings.push({ x: cx, y: cy });
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const dist = (dx * dx + dy * dy);
          if (dist <= r * r + (this.rng.next() - 0.5) * r * 2) {
            const px = cx + dx, py = cy + dy;
            if (px >= 0 && px < w && py >= 0 && py < h) {
              cells[py][px] = floorCell(baseTerrain);
            }
          }
        }
      }
    }

    // Natural path through the area
    const pathStart: Coordinate = this.rng.next() < 0.5
      ? { x: 0, y: Math.floor(h * (0.2 + this.rng.next() * 0.6)) }
      : { x: Math.floor(w * (0.2 + this.rng.next() * 0.6)), y: 0 };
    const pathEnd: Coordinate = this.rng.next() < 0.5
      ? { x: w - 1, y: Math.floor(h * (0.2 + this.rng.next() * 0.6)) }
      : { x: Math.floor(w * (0.2 + this.rng.next() * 0.6)), y: h - 1 };

    this.carveWindingPath(cells, w, h, pathStart, pathEnd, 'stone', 1);

    // Connect clearings to the path
    for (const c of clearings) {
      const nearest = pathStart; // simplified — connect to path start
      this.carveWindingPath(cells, w, h, c, nearest, baseTerrain, 1);
    }

    // Stream
    if (this.rng.next() < 0.4) {
      this.carveStream(cells, w, h);
    }

    // Player starts in first clearing or center
    const startPos = clearings.length > 0 ? clearings[0] : { x: Math.floor(w / 2), y: Math.floor(h / 2) };
    const start = this.findOpenCell(cells, w, h, startPos.x, startPos.y);
    return { grid: { width: w, height: h, cells }, playerStart: start };
  }

  // ── Ruins (40x40) ─────────────────────────────────────────
  //
  // Ruins are the ONE place where random wall fragments make sense —
  // crumbling structures half-reclaimed by nature.

  private generateRuins(): MapResult {
    const w = 40, h = 40;
    const cells = this.fillGrid(w, h, 'grass');

    // Scatter trees around the ruins (nature reclaiming)
    const treeNoise = this.generateNoiseField(w, h, 0.12);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (treeNoise[y][x] > 0.65 && this.rng.next() < 0.25) {
          cells[y][x] = treeCell('grass');
        }
      }
    }

    // Ruined buildings — partial walls with gaps
    const ruinCount = 3 + Math.floor(this.rng.next() * 5);
    const placed: { x: number; y: number; bw: number; bh: number }[] = [];

    for (let attempt = 0; attempt < ruinCount * 6 && placed.length < ruinCount; attempt++) {
      const bw = 5 + Math.floor(this.rng.next() * 5);
      const bh = 4 + Math.floor(this.rng.next() * 4);
      const bx = 3 + Math.floor(this.rng.next() * (w - bw - 6));
      const by = 3 + Math.floor(this.rng.next() * (h - bh - 6));

      let overlaps = false;
      for (const p of placed) {
        if (bx < p.x + p.bw + 2 && bx + bw + 2 > p.x &&
            by < p.y + p.bh + 2 && by + bh + 2 > p.y) {
          overlaps = true;
          break;
        }
      }
      if (overlaps) continue;

      placed.push({ x: bx, y: by, bw, bh });
      const decay = 0.4 + this.rng.next() * 0.35; // 40-75% walls remaining

      for (let y = by; y < by + bh && y < h; y++) {
        for (let x = bx; x < bx + bw && x < w; x++) {
          if (y === by || y === by + bh - 1 || x === bx || x === bx + bw - 1) {
            if (this.rng.next() < decay) {
              cells[y][x] = wallCell(); // Crumbling walls — walls make sense here
            } else {
              cells[y][x] = rockCell('grass'); // Fallen rubble
            }
          } else {
            cells[y][x] = floorCell('stone');
          }
        }
      }
    }

    // Chests hidden in ruins
    const chestCount = 1 + Math.floor(this.rng.next() * 3);
    for (let i = 0; i < chestCount; i++) {
      const rx = 3 + Math.floor(this.rng.next() * (w - 6));
      const ry = 3 + Math.floor(this.rng.next() * (h - 6));
      if (cells[ry][rx].terrain === 'stone' && cells[ry][rx].features.length === 0) {
        cells[ry][rx] = makeCell('stone', 1, false, ['chest']);
      }
    }

    // Path connecting ruins
    if (placed.length >= 2) {
      for (let i = 0; i < placed.length - 1; i++) {
        const a = { x: placed[i].x + Math.floor(placed[i].bw / 2), y: placed[i].y + Math.floor(placed[i].bh / 2) };
        const b = { x: placed[i + 1].x + Math.floor(placed[i + 1].bw / 2), y: placed[i + 1].y + Math.floor(placed[i + 1].bh / 2) };
        this.carveWindingPath(cells, w, h, a, b, 'stone', 1);
      }
    }

    const start = this.findOpenCell(cells, w, h, Math.floor(w / 2), Math.floor(h / 2));
    return { grid: { width: w, height: h, cells }, playerStart: start };
  }

  // ── Castle (35x35) ────────────────────────────────────────

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

    // Central hall
    for (let y = 12; y < 23; y++) {
      for (let x = 12; x < 23; x++) {
        cells[y][x] = floorCell('stone');
      }
    }

    cells[17][17] = makeCell('stone', 1, false, ['altar']);

    for (const pos of [{ x: 14, y: 14 }, { x: 20, y: 14 }, { x: 14, y: 20 }, { x: 20, y: 20 }]) {
      cells[pos.y][pos.x] = makeCell('stone', Infinity, true, ['pillar']);
    }

    cells[h - 1][Math.floor(w / 2)] = floorCell('stone');
    cells[h - 1][Math.floor(w / 2) + 1] = floorCell('stone');

    return {
      grid: { width: w, height: h, cells },
      playerStart: { x: Math.floor(w / 2), y: h - 2 },
    };
  }

  // ── Temple (30x40) ────────────────────────────────────────

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

    cells[3][15] = makeCell('stone', 1, false, ['altar']);
    cells[h - 4][15] = makeCell('stone', 1, false, ['fountain']);
    cells[h - 2][15] = makeCell('stone', 1, false, ['door']);

    return {
      grid: { width: w, height: h, cells },
      playerStart: { x: 15, y: h - 3 },
    };
  }

  // ── Utility Methods ───────────────────────────────────────

  /**
   * Generate a 2D noise field using value noise with interpolation.
   * Returns values in [0, 1] with organic-looking clumps.
   */
  private generateNoiseField(w: number, h: number, frequency: number): number[][] {
    // Generate random lattice points
    const gridSize = Math.max(4, Math.ceil(Math.max(w, h) * frequency) + 2);
    const lattice: number[][] = [];
    for (let y = 0; y < gridSize; y++) {
      lattice[y] = [];
      for (let x = 0; x < gridSize; x++) {
        lattice[y][x] = this.rng.next();
      }
    }

    // Smoothstep interpolation
    const smoothstep = (t: number) => t * t * (3 - 2 * t);

    const field: number[][] = [];
    for (let y = 0; y < h; y++) {
      field[y] = [];
      for (let x = 0; x < w; x++) {
        const fx = x * frequency;
        const fy = y * frequency;
        const ix = Math.floor(fx);
        const iy = Math.floor(fy);
        const tx = smoothstep(fx - ix);
        const ty = smoothstep(fy - iy);

        const gx = ix % gridSize;
        const gy = iy % gridSize;
        const gx1 = (ix + 1) % gridSize;
        const gy1 = (iy + 1) % gridSize;

        const v00 = lattice[gy][gx];
        const v10 = lattice[gy][gx1];
        const v01 = lattice[gy1][gx];
        const v11 = lattice[gy1][gx1];

        const top = v00 + (v10 - v00) * tx;
        const bottom = v01 + (v11 - v01) * tx;
        field[y][x] = top + (bottom - top) * ty;
      }
    }

    return field;
  }

  /**
   * Carve a winding natural path between two points.
   * Width is 1-2 tiles, with random meander.
   */
  private carveWindingPath(
    cells: GridCell[][], w: number, h: number,
    from: Coordinate, to: Coordinate,
    terrain: CellTerrain, pathWidth: number,
  ): void {
    let x = from.x, y = from.y;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const steps = Math.abs(dx) + Math.abs(dy) + 10;

    for (let step = 0; step < steps; step++) {
      if (x >= 0 && x < w && y >= 0 && y < h) {
        cells[y][x] = floorCell(terrain);
        // Path width
        if (pathWidth >= 2) {
          if (x + 1 < w) cells[y][x + 1] = floorCell(terrain);
          if (y + 1 < h) cells[y + 1][x] = floorCell(terrain);
        }
      }

      if (x === to.x && y === to.y) break;

      // Weighted toward target with random meander
      const targetBias = 0.6 + this.rng.next() * 0.2;
      const remainX = to.x - x;
      const remainY = to.y - y;

      if (this.rng.next() < targetBias) {
        // Move toward target
        if (Math.abs(remainX) > Math.abs(remainY) || (Math.abs(remainX) === Math.abs(remainY) && this.rng.next() < 0.5)) {
          x += remainX > 0 ? 1 : -1;
        } else {
          y += remainY > 0 ? 1 : -1;
        }
      } else {
        // Random wander
        const dir = Math.floor(this.rng.next() * 4);
        if (dir === 0 && x < w - 1) x++;
        else if (dir === 1 && x > 0) x--;
        else if (dir === 2 && y < h - 1) y++;
        else if (dir === 3 && y > 0) y--;
      }

      x = Math.max(0, Math.min(w - 1, x));
      y = Math.max(0, Math.min(h - 1, y));
    }
  }

  /** Carve a meandering stream across the map */
  private carveStream(cells: GridCell[][], w: number, h: number): void {
    const vertical = this.rng.next() < 0.5;
    let pos = Math.floor(this.rng.next() * (vertical ? w : h) * 0.6 + (vertical ? w : h) * 0.2);
    const len = vertical ? h : w;

    for (let i = 0; i < len; i++) {
      pos += Math.floor(this.rng.next() * 3) - 1;
      pos = Math.max(1, Math.min((vertical ? w : h) - 2, pos));

      const x = vertical ? pos : i;
      const y = vertical ? i : pos;
      if (x >= 0 && x < w && y >= 0 && y < h) {
        cells[y][x] = makeCell('water', 2, false);
        // Stream is 1-2 tiles wide
        if (vertical && x + 1 < w && this.rng.next() < 0.4) {
          cells[y][x + 1] = makeCell('water', 2, false);
        } else if (!vertical && y + 1 < h && this.rng.next() < 0.4) {
          cells[y + 1][x] = makeCell('water', 2, false);
        }
      }
    }
  }

  /** Check if a cell at (x,y) is adjacent to a cell with the given terrain */
  private adjacentTo(cells: GridCell[][], w: number, h: number, x: number, y: number, terrain: CellTerrain): boolean {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < w && ny >= 0 && ny < h && cells[ny][nx].terrain === terrain) {
          return true;
        }
      }
    }
    return false;
  }

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
    for (let y = by; y < by + bh && y < gridH; y++) {
      for (let x = bx; x < bx + bw && x < gridW; x++) {
        if (y === by || y === by + bh - 1 || x === bx || x === bx + bw - 1) {
          cells[y][x] = wallCell();
        } else {
          cells[y][x] = floorCell('wood');
        }
      }
    }

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
      const roomW = Math.max(minSize, Math.floor(w * (0.6 + this.rng.next() * 0.3)));
      const roomH = Math.max(minSize, Math.floor(h * (0.6 + this.rng.next() * 0.3)));
      const roomX = x + Math.floor(this.rng.next() * Math.max(1, w - roomW));
      const roomY = y + Math.floor(this.rng.next() * Math.max(1, h - roomH));
      rooms.push({ x: roomX, y: roomY, w: roomW, h: roomH });
      return;
    }

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
          count++;
        } else if (cells[ny][nx].movementCost === Infinity) {
          count++;
        }
      }
    }
    return count;
  }

  private findOpenCell(cells: GridCell[][], w: number, h: number, startX: number, startY: number): Coordinate {
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
