import type { Coordinate, CellTerrain, CellFeature, GridCell } from '@/types';
import type { BiomeType } from '@/types/world';
import type { SettlementType, OverworldTerrain } from '@/types/overworld';
import { SeededRNG } from '@/utils/SeededRNG';
import {
  LocalMapGenerator,
  makeCell, wallCell, floorCell, treeCell, rockCell,
  tileSeed,
  type MapResult,
} from './LocalMapGenerator';

const POI_SIZE = 200;
const CENTER = Math.floor(POI_SIZE / 2);

/**
 * Generates large (120×120) Point of Interest maps for ALL overworld tiles.
 * Every persistent overworld tile resolves to a POI — settlement tiles get
 * towns/fortresses/etc, terrain tiles get wilderness POIs (clearings, caves,
 * groves, oases, etc). Small non-POI maps are reserved for future random
 * encounters during travel between tiles.
 */
/** Axis-aligned bounding box for a placed building. */
type BuildingRect = { x1: number; y1: number; x2: number; y2: number };

export class POIMapGenerator extends LocalMapGenerator {
  /** All building footprints placed during current generation. */
  private buildings: BuildingRect[] = [];

  /**
   * Generate a POI map for a settlement tile.
   */
  generatePOI(
    settlement: SettlementType,
    biome: BiomeType,
    entryDir: { dx: number; dy: number },
    worldSeed?: number,
    tileX?: number,
    tileY?: number,
  ): MapResult {
    const doGenerate = () => {
      const w = POI_SIZE, h = POI_SIZE;
      const ground = this.biomeToTerrain(biome);
      const cells = this.fillGrid(w, h, ground);
      this.buildings = [];

      this.paintBiomeDecoration(cells, w, h, biome, ground);
      const roadTerrain: CellTerrain = biome === 'swamp' ? 'wood' : 'stone';
      const roadWidth = settlement === 'fortress' ? 3 : 2;
      this.carveApproachRoads(cells, w, h, roadTerrain, roadWidth);

      switch (settlement) {
        case 'village': case 'town': case 'city':
          this.placeVillagePOI(cells, w, h, ground, roadTerrain, settlement);
          break;
        case 'ruins':
          this.placeRuinsPOI(cells, w, h, ground);
          break;
        case 'temple':
          this.placeShrinePOI(cells, w, h, ground);
          break;
        case 'fortress':
          this.placeFortressPOI(cells, w, h, roadTerrain);
          break;
      }

      this.placeMinorPOIs(cells, w, h, ground, roadTerrain);

      // Post-generation: validate and repair all building perimeters
      this.validateBuildings(cells, w, h);

      const playerStart = this.computeSpawnPoint(cells, w, h, entryDir);
      return { grid: { width: w, height: h, cells }, playerStart };
    };

    if (worldSeed !== undefined && tileX !== undefined && tileY !== undefined) {
      const saved = this.rng;
      this.rng = new SeededRNG(tileSeed(worldSeed ^ 0x901_CAFE, tileX, tileY));
      const result = doGenerate();
      this.rng = saved;
      return result;
    }
    return doGenerate();
  }

  /**
   * Generate a POI map for a terrain (non-settlement) tile.
   * Every overworld tile gets a 120×120 map with a terrain-appropriate POI.
   */
  generateTerrainPOI(
    terrain: OverworldTerrain,
    biome: BiomeType,
    hasRiver: boolean,
    waterSides: number,
    entryDir: { dx: number; dy: number },
    worldSeed?: number,
    tileX?: number,
    tileY?: number,
  ): MapResult {
    const doGenerate = () => {
      const w = POI_SIZE, h = POI_SIZE;
      const ground = this.biomeToTerrain(biome);
      const cells = this.fillGrid(w, h, ground);
      this.buildings = [];

      this.paintBiomeDecoration(cells, w, h, biome, ground);

      const roadTerrain: CellTerrain = biome === 'swamp' ? 'wood'
        : biome === 'desert' ? 'sand' : 'grass';
      this.carveApproachRoads(cells, w, h, roadTerrain, 1); // narrow trails

      switch (terrain) {
        case 'forest':
        case 'dense_forest':
          this.placeForestPOI(cells, w, h, ground, terrain === 'dense_forest');
          break;
        case 'plains':
          this.placePlainsPOI(cells, w, h, ground);
          break;
        case 'hills':
          this.placeHillsPOI(cells, w, h, ground);
          break;
        case 'mountain':
          this.placeMountainPOI(cells, w, h);
          break;
        case 'desert':
          this.placeDesertPOI(cells, w, h);
          break;
        case 'swamp':
          this.placeSwampPOI(cells, w, h, ground);
          break;
        case 'beach':
          this.placeCoastPOI(cells, w, h, waterSides);
          break;
        case 'tundra':
        case 'snow':
          this.placeTundraPOI(cells, w, h, ground);
          break;
        case 'volcanic':
          this.placeVolcanicPOI(cells, w, h);
          break;
        default:
          this.placeWildernessClearingPOI(cells, w, h, ground);
          break;
      }

      // River if present
      if (hasRiver) {
        this.carveRiver(cells, w, h);
      }

      this.placeMinorPOIs(cells, w, h, ground, roadTerrain);

      // Post-generation: validate and repair all building perimeters
      this.validateBuildings(cells, w, h);

      const playerStart = this.computeSpawnPoint(cells, w, h, entryDir);
      return { grid: { width: w, height: h, cells }, playerStart };
    };

    if (worldSeed !== undefined && tileX !== undefined && tileY !== undefined) {
      const saved = this.rng;
      this.rng = new SeededRNG(tileSeed(worldSeed ^ 0x901_CAFE, tileX, tileY));
      const result = doGenerate();
      this.rng = saved;
      return result;
    }
    return doGenerate();
  }

  // ── Biome Decoration ───────────────────────────────────────

  private paintBiomeDecoration(
    cells: GridCell[][],
    w: number, h: number,
    biome: BiomeType, ground: CellTerrain,
  ): void {
    const noise = this.generateNoiseField(w, h, 0.08 + this.rng.next() * 0.04);
    const density = biome === 'forest' ? 0.15
      : biome === 'plains' ? 0.04
      : biome === 'desert' ? 0.03
      : biome === 'swamp' ? 0.12
      : biome === 'mountain' ? 0.08
      : biome === 'tundra' ? 0.05
      : 0.1;

    const placeFn = (_x: number, _y: number): GridCell => {
      if (biome === 'desert') return rockCell('sand');
      if (biome === 'mountain' || biome === 'volcanic') return rockCell('stone');
      if (biome === 'tundra') return this.rng.next() < 0.3 ? rockCell('ice') : treeCell('ice');
      return treeCell(ground);
    };
    this.placeSpacedTrees(cells, w, h, noise, density, ground, { placeFn });
  }

  // ── Approach Roads ─────────────────────────────────────────

  private carveApproachRoads(
    cells: GridCell[][],
    w: number, h: number,
    roadTerrain: CellTerrain, roadWidth: number,
  ): void {
    const targets = [
      { x: CENTER - 3, y: CENTER },
      { x: CENTER + 3, y: CENTER },
      { x: CENTER, y: CENTER - 3 },
      { x: CENTER, y: CENTER + 3 },
    ];

    const edges: Coordinate[] = [
      { x: 1, y: Math.floor(h / 2) },
      { x: w - 2, y: Math.floor(h / 2) },
      { x: Math.floor(w / 2), y: 1 },
      { x: Math.floor(w / 2), y: h - 2 },
    ];

    for (let i = 0; i < 4; i++) {
      this.carveWindingPath(cells, w, h, edges[i], targets[i], roadTerrain, roadWidth);
    }

    // Central plaza where roads meet
    for (let y = CENTER - 4; y <= CENTER + 4; y++) {
      for (let x = CENTER - 4; x <= CENTER + 4; x++) {
        if (x >= 0 && x < w && y >= 0 && y < h) {
          cells[y][x] = floorCell(roadTerrain);
        }
      }
    }
  }

  // ── Settlement POI Generators ─────────────────────────────

  // ── Village / Town / City ──

  private placeVillagePOI(
    cells: GridCell[][],
    w: number, h: number,
    ground: CellTerrain, roadTerrain: CellTerrain,
    settlement: SettlementType,
  ): void {
    const isCity = settlement === 'city';
    const isTown = settlement === 'town';

    // Farmland ring
    const farmInner = isCity ? 42 : isTown ? 47 : 53;
    const farmOuter = isCity ? 75 : isTown ? 70 : 67;
    this.placeFarmland(cells, w, h, farmInner, farmOuter, ground);

    // Town core area
    const coreSize = isCity ? 64 : isTown ? 54 : 40;
    const coreMin = CENTER - Math.floor(coreSize / 2);
    const coreMax = CENTER + Math.floor(coreSize / 2);

    // Clear core area
    for (let y = coreMin; y <= coreMax; y++) {
      for (let x = coreMin; x <= coreMax; x++) {
        if (x >= 0 && x < w && y >= 0 && y < h) {
          cells[y][x] = floorCell(ground);
        }
      }
    }

    // Internal roads (cross pattern through core)
    for (let x = coreMin; x <= coreMax; x++) {
      cells[CENTER][x] = floorCell(roadTerrain);
      cells[CENTER - 1][x] = floorCell(roadTerrain);
    }
    for (let y = coreMin; y <= coreMax; y++) {
      cells[y][CENTER] = floorCell(roadTerrain);
      cells[y][CENTER + 1] = floorCell(roadTerrain);
    }

    // Town square at center
    const sqSize = isCity ? 10 : isTown ? 8 : 6;
    for (let y = CENTER - sqSize; y <= CENTER + sqSize; y++) {
      for (let x = CENTER - sqSize; x <= CENTER + sqSize; x++) {
        if (x >= 0 && x < w && y >= 0 && y < h) {
          cells[y][x] = floorCell(roadTerrain);
        }
      }
    }
    cells[CENTER][CENTER] = makeCell(roadTerrain, 1, false, ['fountain']);

    // Market stalls — 4 chests at offsets around the fountain
    const stallOffsets = [[-5, -3], [5, -3], [-5, 3], [5, 3]];
    for (const [dx, dy] of stallOffsets) {
      const sx = CENTER + dx, sy = CENTER + dy;
      if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
        cells[sy][sx] = makeCell(roadTerrain, 1, false, ['chest']);
      }
    }
    // 4 corner pillars for the square
    for (const [dx, dy] of [[-sqSize, -sqSize], [sqSize, -sqSize], [-sqSize, sqSize], [sqSize, sqSize]]) {
      const px = CENTER + dx, py = CENTER + dy;
      if (px >= 0 && px < w && py >= 0 && py < h) {
        cells[py][px] = makeCell(roadTerrain, Infinity, true, ['pillar']);
      }
    }

    // Town wall (towns and cities) — build BEFORE buildings so we know the boundary
    let wallMin = 0, wallMax = 0;
    if (isTown || isCity) {
      wallMin = coreMin - 1;
      wallMax = coreMax + 1;

      const gates: Coordinate[] = [
        { x: CENTER, y: wallMin }, { x: CENTER + 1, y: wallMin },
        { x: CENTER, y: wallMax }, { x: CENTER + 1, y: wallMax },
        { x: wallMin, y: CENTER }, { x: wallMin, y: CENTER - 1 },
        { x: wallMax, y: CENTER }, { x: wallMax, y: CENTER - 1 },
      ];
      const gapSet = new Set(gates.map(g => `${g.x},${g.y}`));

      for (let x = wallMin; x <= wallMax; x++) {
        if (!gapSet.has(`${x},${wallMin}`)) cells[wallMin][x] = wallCell();
        if (!gapSet.has(`${x},${wallMax}`)) cells[wallMax][x] = wallCell();
      }
      for (let y = wallMin; y <= wallMax; y++) {
        if (!gapSet.has(`${wallMin},${y}`)) cells[y][wallMin] = wallCell();
        if (!gapSet.has(`${wallMax},${y}`)) cells[y][wallMax] = wallCell();
      }
    }

    // Buildings — properly placed in core quadrants, avoiding roads and square
    const buildingCount = isCity ? 16 + Math.floor(this.rng.next() * 6)
      : isTown ? 10 + Math.floor(this.rng.next() * 4)
      : 6 + Math.floor(this.rng.next() * 3);

    // Define the 4 quadrants buildings can occupy (avoiding road cross and town square)
    const quadrants = [
      { xMin: coreMin + 2, xMax: CENTER - sqSize - 2, yMin: coreMin + 2, yMax: CENTER - sqSize - 2 },
      { xMin: CENTER + sqSize + 2, xMax: coreMax - 2, yMin: coreMin + 2, yMax: CENTER - sqSize - 2 },
      { xMin: coreMin + 2, xMax: CENTER - sqSize - 2, yMin: CENTER + sqSize + 2, yMax: coreMax - 2 },
      { xMin: CENTER + sqSize + 2, xMax: coreMax - 2, yMin: CENTER + sqSize + 2, yMax: coreMax - 2 },
    ];

    const placed: { x: number; y: number; bw: number; bh: number }[] = [];
    const multiRoomCount = Math.ceil(buildingCount * 0.5); // first ~50% are multi-room

    for (let attempt = 0; attempt < buildingCount * 20 && placed.length < buildingCount; attempt++) {
      const q = quadrants[Math.floor(this.rng.next() * quadrants.length)];
      const isMultiRoom = placed.length < multiRoomCount;
      const bw = isMultiRoom
        ? 14 + Math.floor(this.rng.next() * 8)  // 14-21
        : 8 + Math.floor(this.rng.next() * 4);  // 8-11 (cottages/sheds)
      const bh = isMultiRoom
        ? 10 + Math.floor(this.rng.next() * 6)  // 10-15
        : 6 + Math.floor(this.rng.next() * 3);  // 6-8
      const availW = q.xMax - q.xMin - bw;
      const availH = q.yMax - q.yMin - bh;
      if (availW < 0 || availH < 0) continue;

      const bx = q.xMin + Math.floor(this.rng.next() * (availW + 1));
      const by = q.yMin + Math.floor(this.rng.next() * (availH + 1));

      // Check overlap with existing buildings (2-cell gap)
      let overlaps = false;
      for (const p of placed) {
        if (bx < p.x + p.bw + 2 && bx + bw + 2 > p.x &&
            by < p.y + p.bh + 2 && by + bh + 2 > p.y) {
          overlaps = true;
          break;
        }
      }
      if (overlaps) continue;

      // Bounds check
      if (bx < 1 || by < 1 || bx + bw >= w - 1 || by + bh >= h - 1) continue;

      placed.push({ x: bx, y: by, bw, bh });

      const bIdx = placed.length - 1;
      if (isMultiRoom) {
        // Multi-room buildings get room types based on building purpose
        const roomTypes = bIdx === 0
          ? ['common', 'kitchen', 'storage']      // Tavern
          : bIdx === 1
          ? ['common', 'armory', 'storage']        // Blacksmith
          : bIdx === 2
          ? ['shrine', 'common', 'storage']        // Temple
          : ['common', 'bedroom', 'storage', 'kitchen'];
        this.placeMultiRoomBuilding(cells, w, h, bx, by, bw, bh, roomTypes);
      } else {
        this.placeSolidBuilding(cells, w, h, bx, by, bw, bh);
      }
    }

    // Outskirt cottages along roads between farm ring and town
    const outskirtCount = 2 + Math.floor(this.rng.next() * 3);
    for (let i = 0; i < outskirtCount; i++) {
      const side = Math.floor(this.rng.next() * 4);
      const dist = farmInner + Math.floor(this.rng.next() * (farmOuter - farmInner - 6));
      let cx: number, cy: number;
      if (side === 0) { cx = CENTER + 5 + Math.floor(this.rng.next() * 6); cy = CENTER - dist; }
      else if (side === 1) { cx = CENTER + 5 + Math.floor(this.rng.next() * 6); cy = CENTER + dist; }
      else if (side === 2) { cx = CENTER - dist; cy = CENTER + 5 + Math.floor(this.rng.next() * 6); }
      else { cx = CENTER + dist; cy = CENTER + 5 + Math.floor(this.rng.next() * 6); }

      if (cx > 3 && cx < w - 14 && cy > 3 && cy < h - 12) {
        const ocw = 8, och = 6;
        // Check overlap with existing buildings (2-cell gap)
        const ox1 = cx - 2, oy1 = cy - 2, ox2 = cx + ocw + 2, oy2 = cy + och + 2;
        let outskirtOverlaps = false;
        for (const b of this.buildings) {
          if (ox1 <= b.x2 && ox2 >= b.x1 && oy1 <= b.y2 && oy2 >= b.y1) {
            outskirtOverlaps = true;
            break;
          }
        }
        if (!outskirtOverlaps) {
          this.placeSolidBuilding(cells, w, h, cx, cy, ocw, och);
        }
      }
    }
  }

  private placeFarmland(
    cells: GridCell[][],
    w: number, h: number,
    innerRadius: number, outerRadius: number,
    ground: CellTerrain,
  ): void {
    const plotCount = 6 + Math.floor(this.rng.next() * 6);
    for (let i = 0; i < plotCount; i++) {
      const angle = this.rng.next() * Math.PI * 2;
      const dist = innerRadius + this.rng.next() * (outerRadius - innerRadius);
      const fx = CENTER + Math.floor(Math.cos(angle) * dist);
      const fy = CENTER + Math.floor(Math.sin(angle) * dist);
      const pw = 10 + Math.floor(this.rng.next() * 10);
      const ph = 8 + Math.floor(this.rng.next() * 8);

      for (let y = fy; y < fy + ph && y < h - 1; y++) {
        for (let x = fx; x < fx + pw && x < w - 1; x++) {
          if (x > 0 && y > 0) {
            cells[y][x] = floorCell(ground);
          }
        }
      }
      // Fence (tree border)
      for (let x = fx; x < fx + pw && x < w - 1; x++) {
        if (x > 0 && fy > 0 && fy < h - 1) cells[fy][x] = treeCell(ground);
        if (x > 0 && fy + ph - 1 > 0 && fy + ph - 1 < h - 1) cells[fy + ph - 1][x] = treeCell(ground);
      }

      // 30% well per farm plot
      if (this.rng.next() < 0.3) {
        const wellX = fx + Math.floor(pw / 2);
        const wellY = fy + Math.floor(ph / 2);
        if (wellX > 0 && wellX < w - 1 && wellY > 0 && wellY < h - 1) {
          cells[wellY][wellX] = makeCell('water', 1, false);
          for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
            const sx = wellX + dx, sy = wellY + dy;
            if (sx > 0 && sx < w - 1 && sy > 0 && sy < h - 1) {
              cells[sy][sx] = floorCell('stone');
            }
          }
        }
      }

      // 20% small shed adjacent
      if (this.rng.next() < 0.2) {
        const shedX = fx + pw + 1;
        const shedY = fy + 1;
        if (shedX + 3 < w - 1 && shedY + 3 < h - 1 && shedX > 0 && shedY > 0) {
          // Check overlap with existing buildings (2-cell gap)
          const shW = 5, shH = 4;
          const sx1 = shedX - 2, sy1 = shedY - 2, sx2 = shedX + shW + 2, sy2 = shedY + shH + 2;
          let shedOverlaps = false;
          for (const b of this.buildings) {
            if (sx1 <= b.x2 && sx2 >= b.x1 && sy1 <= b.y2 && sy2 >= b.y1) {
              shedOverlaps = true;
              break;
            }
          }
          if (!shedOverlaps) {
            this.placeSolidBuilding(cells, w, h, shedX, shedY, shW, shH);
          }
        }
      }
    }
  }

  // ── Ruins ──

  private placeRuinsPOI(
    cells: GridCell[][],
    w: number, h: number,
    ground: CellTerrain,
  ): void {
    // Dense vegetation in outer area — spaced for navigation
    const outerNoise = this.generateNoiseField(w, h, 0.1);
    this.placeSpacedTrees(cells, w, h, outerNoise, 0.10, ground, {
      skipCell: (x, y) => Math.sqrt((x - CENTER) ** 2 + (y - CENTER) ** 2) <= 42,
    });

    // Old road fragments (partially overgrown) — with spacing
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (cells[y][x].terrain === 'stone' && cells[y][x].features.length === 0) {
          if (this.rng.next() < 0.25 && !this.hasOrthogonalTree(cells, w, h, x, y)) {
            cells[y][x] = treeCell(ground);
          }
        }
      }
    }

    // Central ruins cluster (66x66 area)
    const ruinsSize = 33;
    const ruinsMin = CENTER - ruinsSize;
    const ruinsMax = CENTER + ruinsSize;

    // Clear the ruins area
    for (let y = ruinsMin; y <= ruinsMax; y++) {
      for (let x = ruinsMin; x <= ruinsMax; x++) {
        if (x >= 0 && x < w && y >= 0 && y < h) {
          const dist = Math.sqrt((x - CENTER) ** 2 + (y - CENTER) ** 2);
          if (dist < ruinsSize && cells[y][x].features.some(f => f === 'tree') && this.rng.next() < 0.6) {
            cells[y][x] = floorCell(ground);
          }
        }
      }
    }

    // Ruined buildings — multi-room with decay
    const buildingCount = 5 + Math.floor(this.rng.next() * 4);
    const placed: { x: number; y: number; bw: number; bh: number }[] = [];

    for (let attempt = 0; attempt < buildingCount * 15 && placed.length < buildingCount; attempt++) {
      const isLarge = placed.length < Math.ceil(buildingCount * 0.5);
      const bw = isLarge
        ? 14 + Math.floor(this.rng.next() * 7)  // 14-20
        : 8 + Math.floor(this.rng.next() * 5);  // 8-12
      const bh = isLarge
        ? 10 + Math.floor(this.rng.next() * 5)  // 10-14
        : 6 + Math.floor(this.rng.next() * 4);  // 6-9
      const bx = ruinsMin + 3 + Math.floor(this.rng.next() * (ruinsSize * 2 - bw - 6));
      const by = ruinsMin + 3 + Math.floor(this.rng.next() * (ruinsSize * 2 - bh - 6));

      if (bx < 1 || by < 1 || bx + bw >= w - 1 || by + bh >= h - 1) continue;

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

      // Place building first (multi-room or solid)
      // Track index so we can unregister after decay (ruins are intentionally broken)
      const preCount = this.buildings.length;
      if (isLarge) {
        this.placeMultiRoomBuilding(cells, w, h, bx, by, bw, bh, ['common', 'storage', 'bedroom']);
      } else {
        this.placeSolidBuilding(cells, w, h, bx, by, bw, bh);
      }
      // Remove from validation — ruins are intentionally decayed
      this.buildings.splice(preCount);

      // Apply decay — randomly remove walls and doors
      const decay = 0.3 + this.rng.next() * 0.35;
      for (let y = by; y < by + bh; y++) {
        for (let x = bx; x < bx + bw; x++) {
          if (x >= 0 && x < w && y >= 0 && y < h) {
            if (cells[y][x].terrain === 'wall' && this.rng.next() > decay) {
              cells[y][x] = rockCell(ground);
            }
            // Remove doors randomly
            if (cells[y][x].features.some(f => f === 'door') && this.rng.next() > 0.5) {
              cells[y][x] = floorCell('stone');
            }
            // Convert wood floors to stone (aged)
            if (cells[y][x].terrain === 'wood') {
              cells[y][x] = floorCell('stone');
            }
          }
        }
      }
    }

    // Central courtyard
    for (let y = CENTER - 4; y <= CENTER + 4; y++) {
      for (let x = CENTER - 4; x <= CENTER + 4; x++) {
        if (x >= 0 && x < w && y >= 0 && y < h) {
          cells[y][x] = floorCell('stone');
        }
      }
    }
    const centerFeature: CellFeature = this.rng.next() < 0.5 ? 'altar' : 'fountain';
    cells[CENTER][CENTER] = makeCell('stone', 1, false, [centerFeature]);

    // Chests in ruins
    for (const b of placed) {
      if (this.rng.next() < 0.5) {
        const cx = b.x + 1 + Math.floor(this.rng.next() * Math.max(1, b.bw - 2));
        const cy = b.y + 1 + Math.floor(this.rng.next() * Math.max(1, b.bh - 2));
        if (cx < w && cy < h && cells[cy][cx].terrain === 'stone' && cells[cy][cx].features.length === 0) {
          cells[cy][cx] = makeCell('stone', 1, false, ['chest']);
        }
      }
    }

    // Collapsed watchtower
    const twX = ruinsMin - 8 + Math.floor(this.rng.next() * 6);
    const twY = ruinsMin - 5 + Math.floor(this.rng.next() * 6);
    if (twX > 2 && twX < w - 8 && twY > 2 && twY < h - 8) {
      const twR = 3;
      for (let dy = -twR; dy <= twR; dy++) {
        for (let dx = -twR; dx <= twR; dx++) {
          const d2 = dx * dx + dy * dy;
          if (d2 >= (twR - 1) * (twR - 1) && d2 <= twR * twR && this.rng.next() < 0.6) {
            cells[twY + dy][twX + dx] = wallCell();
          } else if (d2 < (twR - 1) * (twR - 1)) {
            cells[twY + dy][twX + dx] = floorCell('stone');
          }
        }
      }
    }
  }

  // ── Shrine / Temple ──

  private placeShrinePOI(
    cells: GridCell[][],
    w: number, h: number,
    ground: CellTerrain,
  ): void {
    // Sacred clearing
    const sacredRadius = 24 + Math.floor(this.rng.next() * 6);
    for (let y = CENTER - sacredRadius; y <= CENTER + sacredRadius; y++) {
      for (let x = CENTER - sacredRadius; x <= CENTER + sacredRadius; x++) {
        if (x < 0 || x >= w || y < 0 || y >= h) continue;
        if ((x - CENTER) ** 2 + (y - CENTER) ** 2 <= sacredRadius * sacredRadius) {
          cells[y][x] = floorCell(ground);
        }
      }
    }

    // Dense sacred grove ring
    const groveOuter = sacredRadius + 10;
    for (let y = CENTER - groveOuter; y <= CENTER + groveOuter; y++) {
      for (let x = CENTER - groveOuter; x <= CENTER + groveOuter; x++) {
        if (x < 1 || x >= w - 1 || y < 1 || y >= h - 1) continue;
        const d2 = (x - CENTER) ** 2 + (y - CENTER) ** 2;
        if (d2 > sacredRadius * sacredRadius && d2 <= groveOuter * groveOuter) {
          if (this.rng.next() < 0.45) {
            cells[y][x] = treeCell(ground);
          }
        }
      }
    }

    // Standing stones along approach paths
    for (let dir = 0; dir < 4; dir++) {
      for (let dist = sacredRadius + 12; dist < 90; dist += 18 + Math.floor(this.rng.next() * 8)) {
        let sx: number, sy: number;
        if (dir === 0) { sx = CENTER; sy = CENTER - dist; }
        else if (dir === 1) { sx = CENTER; sy = CENTER + dist; }
        else if (dir === 2) { sx = CENTER - dist; sy = CENTER; }
        else { sx = CENTER + dist; sy = CENTER; }

        for (const offset of [-2, 2]) {
          const px = dir >= 2 ? sx : sx + offset;
          const py = dir < 2 ? sy : sy + offset;
          if (px >= 0 && px < w && py >= 0 && py < h) {
            cells[py][px] = makeCell('stone', Infinity, true, ['pillar']);
          }
        }
      }
    }

    // Central structure — seeded choice
    if (this.rng.next() < 0.5) {
      // Stone circle with pillars
      const circleR = 10;
      const pillarCount = 8 + Math.floor(this.rng.next() * 4);
      for (let i = 0; i < pillarCount; i++) {
        const angle = (i / pillarCount) * Math.PI * 2;
        const px = CENTER + Math.round(Math.cos(angle) * circleR);
        const py = CENTER + Math.round(Math.sin(angle) * circleR);
        if (px >= 0 && px < w && py >= 0 && py < h) {
          cells[py][px] = makeCell('stone', Infinity, true, ['pillar']);
        }
      }
      cells[CENTER][CENTER] = makeCell('stone', 1, false, ['altar']);
      for (let y = CENTER - circleR + 1; y <= CENTER + circleR - 1; y++) {
        for (let x = CENTER - circleR + 1; x <= CENTER + circleR - 1; x++) {
          if ((x - CENTER) ** 2 + (y - CENTER) ** 2 < (circleR - 1) * (circleR - 1)) {
            if (cells[y][x].features.length === 0) {
              cells[y][x] = floorCell('stone');
            }
          }
        }
      }
    } else {
      // Temple building
      const tw = 26, th = 36;
      const tx = CENTER - Math.floor(tw / 2);
      const ty = CENTER - Math.floor(th / 2);
      this.placeSolidBuilding(cells, w, h, tx, ty, tw, th);

      // Nave pillars
      for (let y = ty + 5; y < ty + th - 5; y += 6) {
        if (tx + 5 < w) cells[y][tx + 5] = makeCell('stone', Infinity, true, ['pillar']);
        if (tx + tw - 6 < w) cells[y][tx + tw - 6] = makeCell('stone', Infinity, true, ['pillar']);
      }
      // Altar at far end
      cells[ty + 3][CENTER] = makeCell('stone', 1, false, ['altar']);
      // Fountain near entrance
      cells[ty + th - 4][CENTER] = makeCell('stone', 1, false, ['fountain']);
    }
  }

  // ── Fortress ──

  private placeFortressPOI(
    cells: GridCell[][],
    w: number, h: number,
    roadTerrain: CellTerrain,
  ): void {
    // Clear zone around fortress
    const clearRadius = 35 + Math.floor(this.rng.next() * 8);
    for (let y = CENTER - clearRadius; y <= CENTER + clearRadius; y++) {
      for (let x = CENTER - clearRadius; x <= CENTER + clearRadius; x++) {
        if (x < 0 || x >= w || y < 0 || y >= h) continue;
        if ((x - CENTER) ** 2 + (y - CENTER) ** 2 <= clearRadius * clearRadius) {
          if (cells[y][x].features.some(f => f === 'tree' || f === 'rock')) {
            cells[y][x] = floorCell('grass');
          }
        }
      }
    }

    // Fortress walls (66x66)
    const fortSize = 33;
    const fMin = CENTER - fortSize;
    const fMax = CENTER + fortSize;

    const gates: Coordinate[] = [
      { x: CENTER, y: fMin }, { x: CENTER + 1, y: fMin },
      { x: CENTER, y: fMax }, { x: CENTER + 1, y: fMax },
      { x: fMin, y: CENTER }, { x: fMin, y: CENTER - 1 },
      { x: fMax, y: CENTER }, { x: fMax, y: CENTER - 1 },
    ];
    const gapSet = new Set(gates.map(g => `${g.x},${g.y}`));

    for (let x = fMin; x <= fMax; x++) {
      if (!gapSet.has(`${x},${fMin}`)) cells[fMin][x] = wallCell();
      if (!gapSet.has(`${x},${fMax}`)) cells[fMax][x] = wallCell();
    }
    for (let y = fMin; y <= fMax; y++) {
      if (!gapSet.has(`${fMin},${y}`)) cells[y][fMin] = wallCell();
      if (!gapSet.has(`${fMax},${y}`)) cells[y][fMax] = wallCell();
    }

    // Interior floor
    for (let y = fMin + 1; y < fMax; y++) {
      for (let x = fMin + 1; x < fMax; x++) {
        cells[y][x] = floorCell('stone');
      }
    }

    // Corner towers (6x6)
    for (const t of [
      { x: fMin, y: fMin }, { x: fMax - 5, y: fMin },
      { x: fMin, y: fMax - 5 }, { x: fMax - 5, y: fMax - 5 },
    ]) {
      for (let y = t.y; y < t.y + 6; y++) {
        for (let x = t.x; x < t.x + 6; x++) {
          if (x >= 0 && x < w && y >= 0 && y < h) {
            if (y === t.y || y === t.y + 5 || x === t.x || x === t.x + 5) {
              cells[y][x] = wallCell();
            } else {
              cells[y][x] = floorCell('stone');
            }
          }
        }
      }
    }

    // Interior buildings (multi-room)
    this.placeMultiRoomBuilding(cells, w, h, fMin + 5, CENTER - 14, 14, 10, ['common', 'armory', 'storage']);
    this.placeMultiRoomBuilding(cells, w, h, fMin + 5, CENTER + 5, 14, 10, ['bedroom', 'common', 'kitchen']);
    this.placeMultiRoomBuilding(cells, w, h, fMax - 19, CENTER - 14, 14, 10, ['shrine', 'storage', 'armory']);

    // Armory chest
    const armoryChestX = fMax - 15;
    const armoryChestY = CENTER - 10;
    if (armoryChestX >= 0 && armoryChestX < w && armoryChestY >= 0 && armoryChestY < h) {
      cells[armoryChestY][armoryChestX] = makeCell('stone', 1, false, ['chest']);
    }

    // Central keep (16x16)
    const keepMin = CENTER - 8;
    const keepMax = CENTER + 7;
    for (let y = keepMin; y <= keepMax; y++) {
      for (let x = keepMin; x <= keepMax; x++) {
        if (y === keepMin || y === keepMax || x === keepMin || x === keepMax) {
          cells[y][x] = wallCell();
        } else {
          cells[y][x] = floorCell('stone');
        }
      }
    }
    cells[keepMax][CENTER] = makeCell('stone', Infinity, true, ['door']);
    cells[keepMin + 3][CENTER] = makeCell('stone', 1, false, ['altar']);
    cells[keepMin + 3][keepMin + 3] = makeCell('stone', Infinity, true, ['pillar']);
    cells[keepMin + 3][keepMax - 3] = makeCell('stone', Infinity, true, ['pillar']);
    cells[keepMax - 3][keepMin + 3] = makeCell('stone', Infinity, true, ['pillar']);
    cells[keepMax - 3][keepMax - 3] = makeCell('stone', Infinity, true, ['pillar']);

    // Optional moat (30% chance)
    if (this.rng.next() < 0.3) {
      const moatR = fortSize + 2;
      for (let y = CENTER - moatR; y <= CENTER + moatR; y++) {
        for (let x = CENTER - moatR; x <= CENTER + moatR; x++) {
          if (x < 0 || x >= w || y < 0 || y >= h) continue;
          const dist = Math.max(Math.abs(x - CENTER), Math.abs(y - CENTER));
          if (dist === fortSize + 1 || dist === fortSize + 2) {
            const onGateAxis = (Math.abs(x - CENTER) <= 1) || (Math.abs(y - CENTER) <= 1);
            if (!onGateAxis) {
              cells[y][x] = makeCell('water', Infinity, false);
            }
          }
        }
      }
    }

    // Internal roads
    for (let x = fMin + 1; x < fMax; x++) {
      cells[CENTER][x] = floorCell(roadTerrain);
      cells[CENTER - 1][x] = floorCell(roadTerrain);
    }
    for (let y = fMin + 1; y < fMax; y++) {
      cells[y][CENTER] = floorCell(roadTerrain);
      cells[y][CENTER + 1] = floorCell(roadTerrain);
    }
  }

  // ── Terrain POI Generators ────────────────────────────────

  // ── Forest ──

  private placeForestPOI(
    cells: GridCell[][],
    w: number, h: number,
    ground: CellTerrain,
    isDense: boolean,
  ): void {
    // Dense forests get heavier tree coverage, but still navigable
    if (isDense) {
      const extraNoise = this.generateNoiseField(w, h, 0.12);
      this.placeSpacedTrees(cells, w, h, extraNoise, 0.20, ground, {
        skipCell: (x, y) => cells[y][x].features.length > 0 || this.isRoad(cells[y][x]),
      });
    }

    // Central clearing — ancient grove or druid circle
    const clearRadius = 10 + Math.floor(this.rng.next() * 5);
    for (let y = CENTER - clearRadius; y <= CENTER + clearRadius; y++) {
      for (let x = CENTER - clearRadius; x <= CENTER + clearRadius; x++) {
        if (x < 0 || x >= w || y < 0 || y >= h) continue;
        if ((x - CENTER) ** 2 + (y - CENTER) ** 2 <= clearRadius * clearRadius) {
          cells[y][x] = floorCell(ground);
        }
      }
    }

    // Ancient tree at center (giant trunk = rock cluster)
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        cells[CENTER + dy][CENTER + dx] = treeCell(ground);
      }
    }
    cells[CENTER][CENTER] = makeCell(ground, 1, false, ['altar']); // shrine at tree base

    // Mushroom ring around clearing
    const ringR = clearRadius - 2;
    const mushroomCount = 8 + Math.floor(this.rng.next() * 6);
    for (let i = 0; i < mushroomCount; i++) {
      const angle = (i / mushroomCount) * Math.PI * 2;
      const rx = CENTER + Math.round(Math.cos(angle) * ringR);
      const ry = CENTER + Math.round(Math.sin(angle) * ringR);
      if (rx >= 0 && rx < w && ry >= 0 && ry < h) {
        cells[ry][rx] = rockCell(ground); // standing stones / mushrooms
      }
    }

    // Small pond nearby
    const pondX = CENTER + (this.rng.next() < 0.5 ? -1 : 1) * (8 + Math.floor(this.rng.next() * 5));
    const pondY = CENTER + (this.rng.next() < 0.5 ? -1 : 1) * (6 + Math.floor(this.rng.next() * 4));
    const pondR = 3 + Math.floor(this.rng.next() * 2);
    for (let dy = -pondR; dy <= pondR; dy++) {
      for (let dx = -pondR; dx <= pondR; dx++) {
        if (dx * dx + dy * dy <= pondR * pondR) {
          const px = pondX + dx, py = pondY + dy;
          if (px >= 0 && px < w && py >= 0 && py < h) {
            cells[py][px] = makeCell('water', 2, false);
          }
        }
      }
    }

    // 2-3 secondary clearings at radius 30-50, each with a feature
    const secCount = 2 + (this.rng.next() < 0.5 ? 1 : 0);
    for (let s = 0; s < secCount; s++) {
      const angle = (s / secCount) * Math.PI * 2 + this.rng.next() * 0.5;
      const dist = 30 + Math.floor(this.rng.next() * 20);
      const scx = CENTER + Math.floor(Math.cos(angle) * dist);
      const scy = CENTER + Math.floor(Math.sin(angle) * dist);
      if (scx < 8 || scx >= w - 8 || scy < 8 || scy >= h - 8) continue;

      // Clear a small area
      const scr = 5 + Math.floor(this.rng.next() * 3);
      for (let dy = -scr; dy <= scr; dy++) {
        for (let dx = -scr; dx <= scr; dx++) {
          if (dx * dx + dy * dy <= scr * scr) {
            const px = scx + dx, py = scy + dy;
            if (px >= 0 && px < w && py >= 0 && py < h) {
              cells[py][px] = floorCell(ground);
            }
          }
        }
      }

      // Feature in clearing: fire, altar, or chest
      const featureChoice = this.rng.next();
      const feature: CellFeature = featureChoice < 0.33 ? 'fire' : featureChoice < 0.66 ? 'altar' : 'chest';
      cells[scy][scx] = makeCell(ground, 1, false, [feature]);

      // Connect to center via winding path
      this.carveWindingPath(cells, w, h, { x: scx, y: scy }, { x: CENTER, y: CENTER }, ground, 1);
    }

    // 50% chance hunter's blind (3×4 partial wall + chest) in outer area
    if (this.rng.next() < 0.5) {
      const hAngle = this.rng.next() * Math.PI * 2;
      const hDist = 35 + Math.floor(this.rng.next() * 15);
      const hx = CENTER + Math.floor(Math.cos(hAngle) * hDist);
      const hy = CENTER + Math.floor(Math.sin(hAngle) * hDist);
      if (hx >= 4 && hx + 3 < w - 1 && hy >= 4 && hy + 4 < h - 1) {
        // L-shaped partial wall
        for (let dx = 0; dx < 3; dx++) cells[hy][hx + dx] = wallCell();
        cells[hy + 1][hx] = wallCell();
        cells[hy + 2][hx] = wallCell();
        cells[hy + 3][hx] = wallCell();
        // Interior
        cells[hy + 1][hx + 1] = floorCell('wood');
        cells[hy + 2][hx + 1] = floorCell('wood');
        cells[hy + 1][hx + 2] = floorCell('wood');
        cells[hy + 2][hx + 2] = floorCell('wood');
        // Chest
        cells[hy + 1][hx + 1] = makeCell('wood', 1, false, ['chest']);
      }
    }
  }

  // ── Plains ──

  private placePlainsPOI(
    cells: GridCell[][],
    w: number, h: number,
    ground: CellTerrain,
  ): void {
    // Crossroads waypoint with standing stone
    cells[CENTER][CENTER] = makeCell('stone', Infinity, true, ['pillar']);

    // Stone circle landmark
    const circleR = 8;
    const stoneCount = 6 + Math.floor(this.rng.next() * 4);
    for (let i = 0; i < stoneCount; i++) {
      const angle = (i / stoneCount) * Math.PI * 2;
      const px = CENTER + Math.round(Math.cos(angle) * circleR);
      const py = CENTER + Math.round(Math.sin(angle) * circleR);
      if (px >= 0 && px < w && py >= 0 && py < h) {
        cells[py][px] = rockCell('stone');
      }
    }
    // Inner clearing
    for (let y = CENTER - circleR + 1; y <= CENTER + circleR - 1; y++) {
      for (let x = CENTER - circleR + 1; x <= CENTER + circleR - 1; x++) {
        if ((x - CENTER) ** 2 + (y - CENTER) ** 2 < (circleR - 1) * (circleR - 1)) {
          cells[y][x] = floorCell(ground);
        }
      }
    }

    // Scattered copses of trees
    const copseCount = 3 + Math.floor(this.rng.next() * 4);
    for (let c = 0; c < copseCount; c++) {
      const cx = 15 + Math.floor(this.rng.next() * (w - 30));
      const cy = 15 + Math.floor(this.rng.next() * (h - 30));
      const dist = Math.sqrt((cx - CENTER) ** 2 + (cy - CENTER) ** 2);
      if (dist < 15) continue; // don't cover the center
      const cr = 3 + Math.floor(this.rng.next() * 3);
      for (let dy = -cr; dy <= cr; dy++) {
        for (let dx = -cr; dx <= cr; dx++) {
          if (dx * dx + dy * dy <= cr * cr && this.rng.next() < 0.6) {
            const px = cx + dx, py = cy + dy;
            if (px >= 1 && px < w - 1 && py >= 1 && py < h - 1 && !this.isRoad(cells[py][px])
                && !this.hasOrthogonalTree(cells, w, h, px, py)) {
              cells[py][px] = treeCell(ground);
            }
          }
        }
      }
    }

    // Old campfire at center
    cells[CENTER + 2][CENTER + 2] = makeCell(ground, 1, false, ['fire']);

    // Old wagon trail (winding stone path edge-to-edge, roughly E-W)
    const trailStartY = 20 + Math.floor(this.rng.next() * 30);
    const trailEndY = 20 + Math.floor(this.rng.next() * 30);
    this.carveWindingPath(cells, w, h,
      { x: 2, y: trailStartY },
      { x: w - 3, y: trailEndY },
      'stone', 1);

    // Livestock pen (wall rectangle 8×6 with door gap)
    const penX = CENTER + 20 + Math.floor(this.rng.next() * 15);
    const penY = CENTER - 15 + Math.floor(this.rng.next() * 10);
    if (penX + 8 < w - 2 && penY >= 2 && penY + 6 < h - 2) {
      for (let x = penX; x < penX + 8; x++) {
        cells[penY][x] = wallCell();
        cells[penY + 5][x] = wallCell();
      }
      for (let y = penY; y < penY + 6; y++) {
        cells[y][penX] = wallCell();
        cells[y][penX + 7] = wallCell();
      }
      // Door gap on south side
      cells[penY + 5][penX + 3] = floorCell(ground);
      cells[penY + 5][penX + 4] = floorCell(ground);
      // Interior is ground
      for (let y = penY + 1; y < penY + 5; y++) {
        for (let x = penX + 1; x < penX + 7; x++) {
          cells[y][x] = floorCell(ground);
        }
      }
    }

    // Windmill ruin (partial circle wall + center pillar)
    const wmX = CENTER - 25 + Math.floor(this.rng.next() * 10);
    const wmY = CENTER + 15 + Math.floor(this.rng.next() * 10);
    if (wmX >= 5 && wmX < w - 5 && wmY >= 5 && wmY < h - 5) {
      const wmR = 4;
      for (let dy = -wmR; dy <= wmR; dy++) {
        for (let dx = -wmR; dx <= wmR; dx++) {
          const d2 = dx * dx + dy * dy;
          if (d2 >= (wmR - 1) * (wmR - 1) && d2 <= wmR * wmR) {
            // 40% decay
            if (this.rng.next() < 0.6) {
              cells[wmY + dy][wmX + dx] = wallCell();
            } else {
              cells[wmY + dy][wmX + dx] = rockCell('stone');
            }
          } else if (d2 < (wmR - 1) * (wmR - 1)) {
            cells[wmY + dy][wmX + dx] = floorCell('stone');
          }
        }
      }
      cells[wmY][wmX] = makeCell('stone', Infinity, true, ['pillar']);
    }
  }

  // ── Hills ──

  private placeHillsPOI(
    cells: GridCell[][],
    w: number, h: number,
    ground: CellTerrain,
  ): void {
    // Rocky hilltop with lookout point
    const hillR = 15 + Math.floor(this.rng.next() * 5);
    for (let y = CENTER - hillR; y <= CENTER + hillR; y++) {
      for (let x = CENTER - hillR; x <= CENTER + hillR; x++) {
        if (x < 0 || x >= w || y < 0 || y >= h) continue;
        const d = Math.sqrt((x - CENTER) ** 2 + (y - CENTER) ** 2);
        if (d <= hillR) {
          if (d > hillR - 3) {
            cells[y][x] = rockCell('stone');
          } else {
            cells[y][x] = floorCell('stone');
          }
        }
      }
    }

    // Central cairn
    cells[CENTER][CENTER] = makeCell('stone', Infinity, true, ['pillar']);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      cells[CENTER + dy][CENTER + dx] = rockCell('stone');
    }

    // Small cave entrance on hillside
    const caveDir = Math.floor(this.rng.next() * 4);
    const caveX = CENTER + (caveDir === 2 ? -hillR + 2 : caveDir === 3 ? hillR - 2 : 0);
    const caveY = CENTER + (caveDir === 0 ? -hillR + 2 : caveDir === 1 ? hillR - 2 : 0);
    if (caveX >= 1 && caveX < w - 1 && caveY >= 1 && caveY < h - 1) {
      cells[caveY][caveX] = makeCell('stone', 1, false, ['stairs_down']);
      // Wall around cave
      for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0]]) {
        const px = caveX + dx, py = caveY + dy;
        if (px >= 0 && px < w && py >= 0 && py < h) {
          cells[py][px] = wallCell();
        }
      }
    }

    // Scattered boulders on lower slopes
    for (let i = 0; i < 20; i++) {
      const angle = this.rng.next() * Math.PI * 2;
      const dist = hillR + 5 + this.rng.next() * 20;
      const rx = CENTER + Math.floor(Math.cos(angle) * dist);
      const ry = CENTER + Math.floor(Math.sin(angle) * dist);
      if (rx >= 1 && rx < w - 1 && ry >= 1 && ry < h - 1 && !this.isRoad(cells[ry][rx])) {
        cells[ry][rx] = rockCell(ground);
      }
    }

    // Shepherd's shelter (4×3 building with fire inside)
    const shAngle = this.rng.next() * Math.PI * 2;
    const shDist = hillR + 8 + Math.floor(this.rng.next() * 12);
    const shX = CENTER + Math.floor(Math.cos(shAngle) * shDist);
    const shY = CENTER + Math.floor(Math.sin(shAngle) * shDist);
    if (shX >= 2 && shX + 4 < w - 1 && shY >= 2 && shY + 3 < h - 1) {
      this.placeSolidBuilding(cells, w, h, shX, shY, 4, 3);
      // Fire inside
      cells[shY + 1][shX + 2] = makeCell('wood', 1, false, ['fire']);
    }

    // Watchtower ruin (partial circular wall, 40% decay, pillar + stairs_down)
    const wtAngle = shAngle + Math.PI * 0.7 + this.rng.next() * 0.6; // opposite-ish from shelter
    const wtDist = hillR + 10 + Math.floor(this.rng.next() * 15);
    const wtX = CENTER + Math.floor(Math.cos(wtAngle) * wtDist);
    const wtY = CENTER + Math.floor(Math.sin(wtAngle) * wtDist);
    if (wtX >= 5 && wtX < w - 5 && wtY >= 5 && wtY < h - 5) {
      const wtR = 3;
      for (let dy = -wtR; dy <= wtR; dy++) {
        for (let dx = -wtR; dx <= wtR; dx++) {
          const d2 = dx * dx + dy * dy;
          if (d2 >= (wtR - 1) * (wtR - 1) && d2 <= wtR * wtR) {
            if (this.rng.next() < 0.6) {
              cells[wtY + dy][wtX + dx] = wallCell();
            } else {
              cells[wtY + dy][wtX + dx] = rockCell('stone');
            }
          } else if (d2 < (wtR - 1) * (wtR - 1)) {
            cells[wtY + dy][wtX + dx] = floorCell('stone');
          }
        }
      }
      cells[wtY][wtX] = makeCell('stone', Infinity, true, ['pillar']);
      // Stairs down at edge
      if (wtX + 1 < w) cells[wtY][wtX + 1] = makeCell('stone', 1, false, ['stairs_down']);
    }
  }

  // ── Mountain ──

  private placeMountainPOI(
    cells: GridCell[][],
    w: number, h: number,
  ): void {
    // Mountain pass with rocky terrain
    // Fill outer area with heavy rocks and stone
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const d = Math.sqrt((x - CENTER) ** 2 + (y - CENTER) ** 2);
        if (d < 35 && !this.isRoad(cells[y][x])) {
          if (this.rng.next() < 0.3) {
            cells[y][x] = rockCell('stone');
          } else {
            cells[y][x] = makeCell('stone', 2, false);
          }
        }
      }
    }

    // Central cave system
    const caveR = 12;
    for (let y = CENTER - caveR; y <= CENTER + caveR; y++) {
      for (let x = CENTER - caveR; x <= CENTER + caveR; x++) {
        if (x < 0 || x >= w || y < 0 || y >= h) continue;
        if ((x - CENTER) ** 2 + (y - CENTER) ** 2 <= caveR * caveR) {
          cells[y][x] = wallCell();
        }
      }
    }

    // Carve interior rooms
    const roomCount = 3 + Math.floor(this.rng.next() * 3);
    for (let i = 0; i < roomCount; i++) {
      const rx = CENTER + Math.floor(this.rng.next() * 12) - 6;
      const ry = CENTER + Math.floor(this.rng.next() * 12) - 6;
      const rr = 2 + Math.floor(this.rng.next() * 3);
      for (let dy = -rr; dy <= rr; dy++) {
        for (let dx = -rr; dx <= rr; dx++) {
          if (dx * dx + dy * dy <= rr * rr) {
            const px = rx + dx, py = ry + dy;
            if (px >= 0 && px < w && py >= 0 && py < h) {
              cells[py][px] = floorCell('stone');
            }
          }
        }
      }
      // Connect room to center
      this.carveWindingPath(cells, w, h, { x: rx, y: ry }, { x: CENTER, y: CENTER }, 'stone', 1);
    }

    // Cave entrance (south of center)
    cells[CENTER + caveR][CENTER] = makeCell('stone', 1, false, ['stairs_down']);
    cells[CENTER + caveR][CENTER - 1] = floorCell('stone');
    cells[CENTER + caveR][CENTER + 1] = floorCell('stone');

    // Chest inside cave
    cells[CENTER][CENTER] = makeCell('stone', 1, false, ['chest']);
  }

  // ── Desert ──

  private placeDesertPOI(
    cells: GridCell[][],
    w: number, h: number,
  ): void {
    // Oasis at center
    const oasisR = 8 + Math.floor(this.rng.next() * 4);
    for (let y = CENTER - oasisR - 3; y <= CENTER + oasisR + 3; y++) {
      for (let x = CENTER - oasisR - 3; x <= CENTER + oasisR + 3; x++) {
        if (x < 0 || x >= w || y < 0 || y >= h) continue;
        const d = Math.sqrt((x - CENTER) ** 2 + (y - CENTER) ** 2);
        if (d <= oasisR) {
          cells[y][x] = makeCell('water', 2, false);
        } else if (d <= oasisR + 3) {
          // Palm trees and grass ring
          if (this.rng.next() < 0.4) {
            cells[y][x] = treeCell('grass');
          } else {
            cells[y][x] = floorCell('grass');
          }
        }
      }
    }

    // Ancient half-buried ruins near oasis
    const ruinX = CENTER + (this.rng.next() < 0.5 ? -1 : 1) * (oasisR + 8);
    const ruinY = CENTER + Math.floor(this.rng.next() * 10) - 5;
    if (ruinX > 5 && ruinX < w - 12 && ruinY > 5 && ruinY < h - 10) {
      // Partial walls emerging from sand
      for (let y = ruinY; y < ruinY + 7; y++) {
        for (let x = ruinX; x < ruinX + 8; x++) {
          if (y === ruinY || y === ruinY + 6 || x === ruinX || x === ruinX + 7) {
            if (this.rng.next() < 0.5) cells[y][x] = wallCell();
          } else {
            cells[y][x] = floorCell('sand');
          }
        }
      }
      cells[ruinY + 3][ruinX + 4] = makeCell('sand', 1, false, ['chest']);
    }

    // Sand dunes (elevated rock clusters)
    for (let i = 0; i < 6; i++) {
      const dx = 20 + Math.floor(this.rng.next() * (w - 40));
      const dy = 20 + Math.floor(this.rng.next() * (h - 40));
      if (Math.sqrt((dx - CENTER) ** 2 + (dy - CENTER) ** 2) < oasisR + 5) continue;
      const dr = 3 + Math.floor(this.rng.next() * 4);
      for (let ry = -dr; ry <= dr; ry++) {
        for (let rx = -dr; rx <= dr; rx++) {
          if (rx * rx + ry * ry <= dr * dr && this.rng.next() < 0.5) {
            const px = dx + rx, py = dy + ry;
            if (px >= 1 && px < w - 1 && py >= 1 && py < h - 1 && !this.isRoad(cells[py][px])) {
              cells[py][px] = rockCell('sand');
            }
          }
        }
      }
    }
  }

  // ── Swamp ──

  private placeSwampPOI(
    cells: GridCell[][],
    w: number, h: number,
    ground: CellTerrain,
  ): void {
    // Scattered water pools
    const poolNoise = this.generateNoiseField(w, h, 0.06);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (poolNoise[y][x] > 0.7 && !this.isRoad(cells[y][x])) {
          cells[y][x] = makeCell('water', 2, false);
        }
      }
    }

    // Central raised island with witch hut
    const islandR = 8 + Math.floor(this.rng.next() * 3);
    for (let y = CENTER - islandR; y <= CENTER + islandR; y++) {
      for (let x = CENTER - islandR; x <= CENTER + islandR; x++) {
        if (x < 0 || x >= w || y < 0 || y >= h) continue;
        if ((x - CENTER) ** 2 + (y - CENTER) ** 2 <= islandR * islandR) {
          cells[y][x] = floorCell(ground);
        }
      }
    }

    // Hut on island
    this.placeSolidBuilding(cells, w, h, CENTER - 3, CENTER - 3, 6, 5);

    // Ritual circle nearby
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const px = CENTER + Math.round(Math.cos(angle) * (islandR - 2));
      const py = CENTER + Math.round(Math.sin(angle) * (islandR - 2));
      if (px >= 0 && px < w && py >= 0 && py < h) {
        cells[py][px] = makeCell('stone', Infinity, true, ['pillar']);
      }
    }

    // Boardwalks (wood paths through water)
    for (let dir = 0; dir < 4; dir++) {
      let sx: number, sy: number;
      if (dir === 0) { sx = CENTER; sy = CENTER - islandR; }
      else if (dir === 1) { sx = CENTER; sy = CENTER + islandR; }
      else if (dir === 2) { sx = CENTER - islandR; sy = CENTER; }
      else { sx = CENTER + islandR; sy = CENTER; }

      const ex = dir >= 2 ? (dir === 2 ? 1 : w - 2) : sx;
      const ey = dir < 2 ? (dir === 0 ? 1 : h - 2) : sy;
      this.carveWindingPath(cells, w, h, { x: sx, y: sy }, { x: ex, y: ey }, 'wood', 1);
    }
  }

  // ── Coast ──

  private placeCoastPOI(
    cells: GridCell[][],
    w: number, h: number,
    waterSides: number,
  ): void {
    const hasN = (waterSides & 1) !== 0;
    const hasS = (waterSides & 2) !== 0;
    const hasW = (waterSides & 4) !== 0;
    const hasE = (waterSides & 8) !== 0;

    // Determine primary water edge
    let waterN = hasN, waterS = hasS, waterW = hasW, waterE = hasE;
    if (!waterN && !waterS && !waterW && !waterE) {
      const pick = Math.floor(this.rng.next() * 4);
      if (pick === 0) waterN = true;
      else if (pick === 1) waterS = true;
      else if (pick === 2) waterW = true;
      else waterE = true;
    }

    // Paint water edges
    const depth = Math.floor(POI_SIZE * 0.25);
    const waveFreq = 0.06 + this.rng.next() * 0.08;
    const waveAmp = 3 + Math.floor(this.rng.next() * 4);

    for (let a = 0; a < POI_SIZE; a++) {
      const edge = depth + Math.floor(Math.sin(a * waveFreq) * waveAmp);
      for (let b = 0; b < edge; b++) {
        if (waterN && b < h && a < w) cells[b][a] = makeCell(b < edge - 3 ? 'water' : 'sand', b < edge - 3 ? Infinity : 1, false);
        if (waterS && h - 1 - b >= 0 && a < w) cells[h - 1 - b][a] = makeCell(b < edge - 3 ? 'water' : 'sand', b < edge - 3 ? Infinity : 1, false);
        if (waterW && a < h && b < w) cells[a][b] = makeCell(b < edge - 3 ? 'water' : 'sand', b < edge - 3 ? Infinity : 1, false);
        if (waterE && a < h && w - 1 - b >= 0) cells[a][w - 1 - b] = makeCell(b < edge - 3 ? 'water' : 'sand', b < edge - 3 ? Infinity : 1, false);
      }
    }

    // Fishing hut on shore
    const hutX = CENTER + Math.floor(this.rng.next() * 10) - 5;
    const hutY = waterN ? depth + 5 : waterS ? h - depth - 10 : CENTER;
    if (hutX > 3 && hutX < w - 10 && hutY > 3 && hutY < h - 10) {
      this.placeSolidBuilding(cells, w, h, hutX, hutY, 6, 5);
    }

    // Driftwood and rocks on beach
    for (let i = 0; i < 12; i++) {
      const rx = 5 + Math.floor(this.rng.next() * (w - 10));
      const ry = 5 + Math.floor(this.rng.next() * (h - 10));
      if (cells[ry][rx].terrain === 'sand' && cells[ry][rx].features.length === 0) {
        cells[ry][rx] = this.rng.next() < 0.5 ? rockCell('sand') : treeCell('sand');
      }
    }
  }

  // ── Tundra / Snow ──

  private placeTundraPOI(
    cells: GridCell[][],
    w: number, h: number,
    _ground: CellTerrain,
  ): void {
    // Frozen lake
    const lakeR = 10 + Math.floor(this.rng.next() * 5);
    const lakeX = CENTER + Math.floor(this.rng.next() * 10) - 5;
    const lakeY = CENTER + Math.floor(this.rng.next() * 10) - 5;
    for (let y = lakeY - lakeR; y <= lakeY + lakeR; y++) {
      for (let x = lakeX - lakeR; x <= lakeX + lakeR; x++) {
        if (x < 0 || x >= w || y < 0 || y >= h) continue;
        if ((x - lakeX) ** 2 + (y - lakeY) ** 2 <= lakeR * lakeR) {
          cells[y][x] = makeCell('ice', 1, false);
        }
      }
    }

    // Abandoned cabin
    const cabinX = CENTER + (this.rng.next() < 0.5 ? -1 : 1) * (lakeR + 6);
    const cabinY = CENTER + Math.floor(this.rng.next() * 8) - 4;
    if (cabinX > 3 && cabinX < w - 10 && cabinY > 3 && cabinY < h - 10) {
      this.placeSolidBuilding(cells, w, h, cabinX, cabinY, 6, 5);
      // Fireplace inside
      cells[cabinY + 2][cabinX + 3] = makeCell('wood', 1, false, ['fire']);
    }

    // Ice formations
    for (let i = 0; i < 8; i++) {
      const ix = 15 + Math.floor(this.rng.next() * (w - 30));
      const iy = 15 + Math.floor(this.rng.next() * (h - 30));
      if (!this.isRoad(cells[iy][ix])) {
        cells[iy][ix] = makeCell('ice', Infinity, true, ['pillar']);
      }
    }
  }

  // ── Volcanic ──

  private placeVolcanicPOI(
    cells: GridCell[][],
    w: number, h: number,
  ): void {
    // Lava pools
    const poolCount = 3 + Math.floor(this.rng.next() * 3);
    for (let i = 0; i < poolCount; i++) {
      const px = 15 + Math.floor(this.rng.next() * (w - 30));
      const py = 15 + Math.floor(this.rng.next() * (h - 30));
      const pr = 3 + Math.floor(this.rng.next() * 4);
      for (let dy = -pr; dy <= pr; dy++) {
        for (let dx = -pr; dx <= pr; dx++) {
          if (dx * dx + dy * dy <= pr * pr) {
            const lx = px + dx, ly = py + dy;
            if (lx >= 0 && lx < w && ly >= 0 && ly < h) {
              cells[ly][lx] = makeCell('water', Infinity, false); // "lava" (rendered as water for now)
            }
          }
        }
      }
    }

    // Central volcanic vent
    const ventR = 6;
    for (let y = CENTER - ventR; y <= CENTER + ventR; y++) {
      for (let x = CENTER - ventR; x <= CENTER + ventR; x++) {
        if (x < 0 || x >= w || y < 0 || y >= h) continue;
        const d = (x - CENTER) ** 2 + (y - CENTER) ** 2;
        if (d <= ventR * ventR) {
          if (d <= (ventR - 2) * (ventR - 2)) {
            cells[y][x] = makeCell('water', Infinity, false); // magma
          } else {
            cells[y][x] = rockCell('stone');
          }
        }
      }
    }
    cells[CENTER][CENTER] = makeCell('stone', 1, false, ['stairs_down']);

    // Obsidian formations (rock clusters)
    for (let i = 0; i < 15; i++) {
      const rx = 10 + Math.floor(this.rng.next() * (w - 20));
      const ry = 10 + Math.floor(this.rng.next() * (h - 20));
      if (!this.isRoad(cells[ry][rx]) && cells[ry][rx].terrain !== 'water') {
        cells[ry][rx] = rockCell('stone');
      }
    }
  }

  // ── Wilderness Clearing (fallback) ──

  private placeWildernessClearingPOI(
    cells: GridCell[][],
    w: number, h: number,
    ground: CellTerrain,
  ): void {
    // Simple clearing with campsite
    const clearR = 12 + Math.floor(this.rng.next() * 5);
    for (let y = CENTER - clearR; y <= CENTER + clearR; y++) {
      for (let x = CENTER - clearR; x <= CENTER + clearR; x++) {
        if (x < 0 || x >= w || y < 0 || y >= h) continue;
        if ((x - CENTER) ** 2 + (y - CENTER) ** 2 <= clearR * clearR) {
          cells[y][x] = floorCell(ground);
        }
      }
    }
    cells[CENTER][CENTER] = makeCell(ground, 1, false, ['fire']);

    // Lean-to shelter
    for (let x = CENTER - 2; x <= CENTER + 2; x++) {
      cells[CENTER - 3][x] = wallCell();
    }
    for (let x = CENTER - 2; x <= CENTER + 2; x++) {
      cells[CENTER - 2][x] = floorCell('wood');
    }
  }

  // ── River ──

  private carveRiver(
    cells: GridCell[][],
    w: number, h: number,
  ): void {
    // Meander from top to bottom (or left to right)
    const horizontal = this.rng.next() < 0.5;
    const length = horizontal ? w : h;
    const span = horizontal ? h : w;
    let pos = Math.floor(span * 0.3 + this.rng.next() * span * 0.4);
    const riverWidth = 2 + Math.floor(this.rng.next() * 2);

    for (let i = 0; i < length; i++) {
      // Meander
      pos += Math.floor(this.rng.next() * 3) - 1;
      pos = Math.max(riverWidth, Math.min(span - riverWidth - 1, pos));

      for (let w2 = -riverWidth; w2 <= riverWidth; w2++) {
        const x = horizontal ? i : pos + w2;
        const y = horizontal ? pos + w2 : i;
        if (x >= 0 && x < w && y >= 0 && y < h) {
          cells[y][x] = makeCell('water', Infinity, false, ['running_water']);
        }
      }
    }
  }

  // ── Minor Interest Points ──────────────────────────────────

  private placeMinorPOIs(
    cells: GridCell[][],
    w: number, h: number,
    ground: CellTerrain, roadTerrain: CellTerrain,
  ): void {
    const minorTypes = [
      'campfire', 'shrine', 'guard_post', 'well', 'hut', 'merchant',
    ] as const;

    const count = 4 + Math.floor(this.rng.next() * 3); // 4-6 minor POIs
    const usedDirs = new Set<number>();

    for (let i = 0; i < count; i++) {
      let dir: number;
      do {
        dir = Math.floor(this.rng.next() * 4);
      } while (usedDirs.has(dir) && usedDirs.size < 4);
      usedDirs.add(dir);

      const pct = 0.25 + this.rng.next() * 0.3;
      const dist = Math.floor(CENTER * pct);
      let mx: number, my: number;

      if (dir === 0) { mx = CENTER; my = dist; }
      else if (dir === 1) { mx = CENTER; my = h - 1 - dist; }
      else if (dir === 2) { mx = dist; my = CENTER; }
      else { mx = w - 1 - dist; my = CENTER; }

      const offsetX = (dir < 2 ? 1 : 0) * (6 + Math.floor(this.rng.next() * 8)) * (this.rng.next() < 0.5 ? -1 : 1);
      const offsetY = (dir >= 2 ? 1 : 0) * (6 + Math.floor(this.rng.next() * 8)) * (this.rng.next() < 0.5 ? -1 : 1);
      mx += offsetX;
      my += offsetY;

      if (mx < 6 || mx >= w - 6 || my < 6 || my >= h - 6) continue;

      // Skip if the minor POI's 7×7 area overlaps any building (with 1-cell margin)
      const mxMin = mx - 4, mxMax = mx + 4, myMin = my - 4, myMax = my + 4;
      let hitsBuilding = false;
      for (const b of this.buildings) {
        if (mxMin <= b.x2 && mxMax >= b.x1 && myMin <= b.y2 && myMax >= b.y1) {
          hitsBuilding = true;
          break;
        }
      }
      if (hitsBuilding) continue;

      const type = minorTypes[Math.floor(this.rng.next() * minorTypes.length)];
      this.placeMinorFeature(cells, w, h, mx, my, type, ground, roadTerrain);

      // Connect minor POI toward center via winding path
      this.carveWindingPath(cells, w, h, { x: mx, y: my }, { x: CENTER, y: CENTER }, roadTerrain, 1);
    }

    // Road milestones — pillar features every ~20 tiles along approach roads
    for (let dir = 0; dir < 4; dir++) {
      for (let step = 20; step < CENTER - 10; step += 18 + Math.floor(this.rng.next() * 8)) {
        let px: number, py: number;
        if (dir === 0) { px = CENTER + 2; py = CENTER - step; }
        else if (dir === 1) { px = CENTER + 2; py = CENTER + step; }
        else if (dir === 2) { px = CENTER - step; py = CENTER + 2; }
        else { px = CENTER + step; py = CENTER + 2; }

        if (px >= 1 && px < w - 1 && py >= 1 && py < h - 1
            && cells[py][px].terrain !== 'wall' && cells[py][px].terrain !== 'wood'
            && cells[py][px].features.length === 0 && !this.isRoad(cells[py][px])) {
          cells[py][px] = makeCell('stone', Infinity, true, ['pillar']);
        }
      }
    }
  }

  private placeMinorFeature(
    cells: GridCell[][],
    w: number, h: number,
    cx: number, cy: number,
    type: string,
    ground: CellTerrain, roadTerrain: CellTerrain,
  ): void {
    // Clear a small area first — but never overwrite structural cells (walls, doors)
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const px = cx + dx, py = cy + dy;
        if (px >= 0 && px < w && py >= 0 && py < h) {
          const cell = cells[py][px];
          if (cell.terrain !== 'wall' && cell.terrain !== 'wood'
            && !cell.features.some(f => f === 'door' || f === 'door_locked' || f === 'chest' || f === 'altar' || f === 'fire')) {
            cells[py][px] = floorCell(ground);
          }
        }
      }
    }

    switch (type) {
      case 'campfire': {
        // Central fire
        cells[cy][cx] = makeCell(ground, 1, false, ['fire']);
        // Ring of 8 seating rocks
        for (const [dx, dy] of [[-2,0],[2,0],[0,-2],[0,2],[-1,-1],[1,-1],[-1,1],[1,1]]) {
          const sx = cx + dx, sy = cy + dy;
          if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
            cells[sy][sx] = rockCell(ground);
          }
        }
        // 2-3 wood bedrolls around the fire
        const bedrollCount = 2 + (this.rng.next() < 0.5 ? 1 : 0);
        const bedrollSpots = [[3, 1], [-3, 0], [1, 3]];
        for (let b = 0; b < bedrollCount; b++) {
          const bx = cx + bedrollSpots[b][0], by = cy + bedrollSpots[b][1];
          if (bx >= 0 && bx < w && by >= 0 && by < h) {
            cells[by][bx] = floorCell('wood');
          }
        }
        // 50% chance tent (L-shaped wall)
        if (this.rng.next() < 0.5) {
          const tx = cx - 3, ty = cy - 3;
          if (tx >= 0 && ty >= 0 && tx + 3 < w && ty + 2 < h) {
            for (let dx = 0; dx <= 3; dx++) cells[ty][tx + dx] = wallCell();
            cells[ty + 1][tx] = wallCell();
            cells[ty + 2][tx] = wallCell();
            cells[ty + 1][tx + 1] = floorCell('wood');
            cells[ty + 2][tx + 1] = floorCell('wood');
          }
        }
        break;
      }

      case 'shrine': {
        // 5×5 stone platform
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const sx = cx + dx, sy = cy + dy;
            if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
              cells[sy][sx] = floorCell('stone');
            }
          }
        }
        // Central altar
        cells[cy][cx] = makeCell('stone', 1, false, ['altar']);
        // Offering chest behind altar
        if (cy - 1 >= 0) cells[cy - 1][cx] = makeCell('stone', 1, false, ['chest']);
        // 2 flanking pillars
        if (cx - 2 >= 0) cells[cy][cx - 2] = makeCell('stone', Infinity, true, ['pillar']);
        if (cx + 2 < w) cells[cy][cx + 2] = makeCell('stone', Infinity, true, ['pillar']);
        // Stone approach path (3 tiles south)
        for (let dy = 1; dy <= 3; dy++) {
          const sy = cy + dy;
          if (sy < h) cells[sy][cx] = floorCell('stone');
        }
        break;
      }

      case 'guard_post': {
        // 5×5 building
        this.placeSolidBuilding(cells, w, h, cx - 2, cy - 2, 5, 5);
        // Chest inside
        if (cx - 1 >= 0 && cy - 1 >= 0) {
          cells[cy - 1][cx - 1] = makeCell('wood', 1, false, ['chest']);
        }
        // Watchtower pillar outside (NE corner)
        const twx = cx + 4, twy = cy - 3;
        if (twx >= 0 && twx < w && twy >= 0 && twy < h) {
          cells[twy][twx] = makeCell('stone', Infinity, true, ['pillar']);
        }
        // Cleared perimeter (remove trees in 3-cell ring)
        for (let dy = -5; dy <= 5; dy++) {
          for (let dx = -5; dx <= 5; dx++) {
            const px = cx + dx, py = cy + dy;
            if (px >= 0 && px < w && py >= 0 && py < h) {
              if (cells[py][px].features.some(f => f === 'tree')) {
                cells[py][px] = floorCell(ground);
              }
            }
          }
        }
        break;
      }

      case 'well': {
        // Central water
        cells[cy][cx] = makeCell('water', 1, false);
        // Stone surround
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const sx = cx + dx, sy = cy + dy;
            if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
              cells[sy][sx] = floorCell('stone');
            }
          }
        }
        // 4 corner roof-post pillars
        for (const [dx, dy] of [[-2,-2],[2,-2],[-2,2],[2,2]]) {
          const px = cx + dx, py = cy + dy;
          if (px >= 0 && px < w && py >= 0 && py < h) {
            cells[py][px] = makeCell('stone', Infinity, true, ['pillar']);
          }
        }
        break;
      }

      case 'hut': {
        // 5×5 building
        this.placeSolidBuilding(cells, w, h, cx - 2, cy - 2, 5, 5);
        // Hearth fire inside
        cells[cy][cx] = makeCell('wood', 1, false, ['fire']);
        // Fenced garden plot adjacent (east side)
        const gx = cx + 4, gy = cy - 2;
        if (gx + 4 < w && gy >= 0 && gy + 4 < h) {
          // Fence border (trees)
          for (let dx = 0; dx <= 4; dx++) {
            cells[gy][gx + dx] = treeCell(ground);
            cells[gy + 4][gx + dx] = treeCell(ground);
          }
          for (let dy = 1; dy < 4; dy++) {
            cells[gy + dy][gx] = treeCell(ground);
            cells[gy + dy][gx + 4] = treeCell(ground);
          }
          // Garden interior (cleared ground)
          for (let dy = 1; dy < 4; dy++) {
            for (let dx = 1; dx < 4; dx++) {
              cells[gy + dy][gx + dx] = floorCell(ground);
            }
          }
        }
        // Corner trees
        for (const d of [[-4, -4], [4, -4], [-4, 4]] as const) {
          const tx = cx + d[0], ty = cy + d[1];
          if (tx >= 0 && tx < w && ty >= 0 && ty < h) {
            cells[ty][tx] = treeCell(ground);
          }
        }
        break;
      }

      case 'merchant': {
        // 5×5 trading post floor
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const sx = cx + dx, sy = cy + dy;
            if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
              cells[sy][sx] = floorCell(roadTerrain);
            }
          }
        }
        // 2 chests (wares)
        cells[cy][cx - 1] = makeCell(roadTerrain, 1, false, ['chest']);
        cells[cy][cx + 1] = makeCell(roadTerrain, 1, false, ['chest']);
        // Fire (cooking)
        if (cy - 2 >= 0) cells[cy - 2][cx] = makeCell(roadTerrain, 1, false, ['fire']);
        // 4 pillar posts at corners
        for (const [dx, dy] of [[-2,-2],[2,-2],[-2,2],[2,2]]) {
          const px = cx + dx, py = cy + dy;
          if (px >= 0 && px < w && py >= 0 && py < h) {
            cells[py][px] = makeCell(roadTerrain, Infinity, true, ['pillar']);
          }
        }
        break;
      }
    }
  }

  // ── Multi-Room Building ───────────────────────────────────

  /**
   * Place a multi-room building with internal wall subdivisions and doors.
   * Creates 2-4 rooms depending on building size.
   * Minimum useful size: 8x6.
   */
  private placeMultiRoomBuilding(
    cells: GridCell[][],
    gridW: number, gridH: number,
    bx: number, by: number,
    bw: number, bh: number,
    roomTypes?: string[],
  ): void {
    // Clamp to grid bounds
    const x1 = Math.max(0, bx);
    const y1 = Math.max(0, by);
    const x2 = Math.min(gridW - 1, bx + bw - 1);
    const y2 = Math.min(gridH - 1, by + bh - 1);

    // Need at least 8x6 for multi-room, fallback to solid
    if (x2 - x1 < 7 || y2 - y1 < 5) {
      return this.placeSolidBuilding(cells, gridW, gridH, bx, by, bw, bh);
    }

    // Register footprint for collision avoidance and post-gen validation
    this.buildings.push({ x1, y1, x2, y2 });

    const innerW = x2 - x1 - 1; // interior width (not counting perimeter walls)
    const innerH = y2 - y1 - 1;

    // ── Step 1: Outer shell — walls on perimeter, wood floor inside ──
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        if (y === y1 || y === y2 || x === x1 || x === x2) {
          cells[y][x] = wallCell();
        } else {
          cells[y][x] = floorCell('wood');
        }
      }
    }

    // ── Step 2: Choose vertical split position ──
    // Pick a position for the internal vertical wall (column index)
    const splitX = x1 + Math.floor(innerW * (0.35 + this.rng.next() * 0.3)) + 1;

    // ── Step 3: Place main entrance on south wall, NOT on the split column ──
    // The entrance must be clearly inside one of the two halves
    let mainDoorX: number;
    const leftMid = x1 + Math.floor((splitX - x1) / 2);
    const rightMid = splitX + Math.floor((x2 - splitX) / 2);
    // Pick the larger side for the entrance
    if (splitX - x1 > x2 - splitX) {
      mainDoorX = leftMid; // entrance in left half
    } else {
      mainDoorX = rightMid; // entrance in right half
    }
    // Ensure door is on interior (not on outer wall column)
    mainDoorX = Math.max(x1 + 1, Math.min(x2 - 1, mainDoorX));
    // Final safety: must not be on splitX
    if (mainDoorX === splitX) mainDoorX = splitX + 1;
    if (mainDoorX >= x2) mainDoorX = splitX - 1;

    cells[y2][mainDoorX] = makeCell('wood', Infinity, true, ['door']);

    const entranceOnLeft = mainDoorX < splitX;

    // ── Step 4: Place vertical internal wall with door ──
    for (let y = y1 + 1; y < y2; y++) {
      cells[y][splitX] = wallCell();
    }

    // ── Step 5: Horizontal split (if tall enough) on the non-entrance side ──
    // Determine room layout
    type Room = { rx1: number; ry1: number; rx2: number; ry2: number; idx: number };
    const rooms: Room[] = [];
    let roomIdx = 0;

    // Entrance room spans the full height of its half
    const entranceRoom: Room = entranceOnLeft
      ? { rx1: x1 + 1, ry1: y1 + 1, rx2: splitX - 1, ry2: y2 - 1, idx: roomIdx++ }
      : { rx1: splitX + 1, ry1: y1 + 1, rx2: x2 - 1, ry2: y2 - 1, idx: roomIdx++ };
    rooms.push(entranceRoom);

    // The other side may get horizontally split
    const otherX1 = entranceOnLeft ? splitX + 1 : x1 + 1;
    const otherX2 = entranceOnLeft ? x2 - 1 : splitX - 1;
    const otherSpan = otherX2 - otherX1 + 1; // width of other side interior

    if (innerH >= 6 && otherSpan >= 2) {
      // Horizontal split on the other side
      const hSplitY = y1 + Math.floor(innerH * (0.35 + this.rng.next() * 0.3)) + 1;

      // Place horizontal wall
      for (let x = otherX1; x <= otherX2; x++) {
        cells[hSplitY][x] = wallCell();
      }

      // Door in horizontal wall — connects upper and lower other-side rooms
      const hDoorX = otherX1 + Math.floor(this.rng.next() * otherSpan);
      cells[hSplitY][hDoorX] = makeCell('wood', Infinity, true, ['door']);

      // Upper other-side room
      rooms.push({ rx1: otherX1, ry1: y1 + 1, rx2: otherX2, ry2: hSplitY - 1, idx: roomIdx++ });
      // Lower other-side room
      rooms.push({ rx1: otherX1, ry1: hSplitY + 1, rx2: otherX2, ry2: y2 - 1, idx: roomIdx++ });

      // Vertical wall door: must be placed so it connects entrance room to
      // BOTH other-side rooms. Put it at the hSplitY row (where the h-wall
      // meets the v-wall) so it acts as a T-junction, OR place two doors.
      // Simplest correct approach: place TWO doors in the vertical wall,
      // one in each half (above and below the horizontal split).
      const topDoorY = y1 + 1 + Math.floor(this.rng.next() * Math.max(1, hSplitY - y1 - 2));
      const botDoorY = hSplitY + 1 + Math.floor(this.rng.next() * Math.max(1, y2 - hSplitY - 2));
      cells[topDoorY][splitX] = makeCell('wood', Infinity, true, ['door']);
      cells[botDoorY][splitX] = makeCell('wood', Infinity, true, ['door']);
    } else {
      // No horizontal split — just 2 rooms (left and right)
      rooms.push({ rx1: otherX1, ry1: y1 + 1, rx2: otherX2, ry2: y2 - 1, idx: roomIdx++ });

      // Single door in vertical wall
      const vDoorY = y1 + 1 + Math.floor(this.rng.next() * (innerH - 1));
      cells[vDoorY][splitX] = makeCell('wood', Infinity, true, ['door']);
    }

    // ── Step 6: Place features in rooms ──
    const types = roomTypes ?? ['common', 'storage', 'kitchen', 'bedroom'];
    for (const room of rooms) {
      const type = types[room.idx % types.length];
      const rcx = Math.floor((room.rx1 + room.rx2) / 2);
      const rcy = Math.floor((room.ry1 + room.ry2) / 2);

      if (rcx >= 0 && rcx < gridW && rcy >= 0 && rcy < gridH) {
        switch (type) {
          case 'common':
          case 'kitchen':
            cells[rcy][rcx] = makeCell('wood', 1, false, ['fire']);
            break;
          case 'storage':
          case 'armory':
            cells[rcy][rcx] = makeCell('wood', 1, false, ['chest']);
            break;
          case 'shrine':
            cells[rcy][rcx] = makeCell('wood', 1, false, ['altar']);
            break;
          case 'bedroom':
            break;
        }
      }
    }
  }

  // ── Solid Building (improved) ──────────────────────────────

  /**
   * Place a solid rectangular building with complete walls and a door.
   * Guaranteed: full wall perimeter, wood floor interior, door on south wall.
   * Minimum size 4x4 to fit walls + interior + door.
   */
  private placeSolidBuilding(
    cells: GridCell[][],
    gridW: number, gridH: number,
    bx: number, by: number,
    bw: number, bh: number,
  ): void {
    // Clamp to grid bounds
    const x1 = Math.max(0, bx);
    const y1 = Math.max(0, by);
    const x2 = Math.min(gridW - 1, bx + bw - 1);
    const y2 = Math.min(gridH - 1, by + bh - 1);

    // Need at least 3x3 to be useful
    if (x2 - x1 < 2 || y2 - y1 < 2) return;

    // Register footprint for collision avoidance and post-gen validation
    this.buildings.push({ x1, y1, x2, y2 });

    // Build the rectangle: walls on perimeter, wood floor inside
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        if (y === y1 || y === y2 || x === x1 || x === x2) {
          cells[y][x] = wallCell();
        } else {
          cells[y][x] = floorCell('wood');
        }
      }
    }

    // Door on south wall, centered
    const doorX = x1 + Math.floor((x2 - x1) / 2);
    cells[y2][doorX] = makeCell('wood', Infinity, true, ['door']);

    // If building is large enough, add a second door on north or east
    if (bw >= 6 && bh >= 6) {
      const secondDoorX = x1 + Math.floor((x2 - x1) / 2);
      cells[y1][secondDoorX] = makeCell('wood', Infinity, true, ['door']);
    }
  }

  // ── Building Validation ──────────────────────────────────────

  /**
   * Post-generation pass: validate and repair all registered buildings.
   * 1. Repair perimeter walls that were destroyed
   * 2. Remove interior wall cells placed by overlapping neighbor buildings
   * 3. Ensure every interior cell is reachable from the entrance via flood fill
   * 4. Ensure at least one entrance door exists
   */
  private validateBuildings(cells: GridCell[][], w: number, h: number): void {
    // Build a set of all perimeter cells across ALL buildings
    const perimeterSet = new Set<string>();
    const validBuildings = this.buildings.filter(
      b => b.x1 >= 0 && b.y1 >= 0 && b.x2 < w && b.y2 < h && b.x2 - b.x1 >= 2 && b.y2 - b.y1 >= 2,
    );

    for (const b of validBuildings) {
      for (let x = b.x1; x <= b.x2; x++) {
        perimeterSet.add(`${x},${b.y1}`);
        perimeterSet.add(`${x},${b.y2}`);
      }
      for (let y = b.y1 + 1; y < b.y2; y++) {
        perimeterSet.add(`${b.x1},${y}`);
        perimeterSet.add(`${b.x2},${y}`);
      }
    }

    // Pass 1: Repair ALL perimeters across all buildings first
    for (const b of validBuildings) {
      for (let x = b.x1; x <= b.x2; x++) {
        this.repairWall(cells, x, b.y1);
        this.repairWall(cells, x, b.y2);
      }
      for (let y = b.y1 + 1; y < b.y2; y++) {
        this.repairWall(cells, b.x1, y);
        this.repairWall(cells, b.x2, y);
      }
    }

    // Pass 2: Remove foreign interior walls, but NEVER touch cells that are
    // on ANY building's perimeter (those were just repaired in pass 1)
    for (const b of validBuildings) {
      for (let y = b.y1 + 1; y < b.y2; y++) {
        for (let x = b.x1 + 1; x < b.x2; x++) {
          if (cells[y][x].terrain !== 'wall') continue;
          if (perimeterSet.has(`${x},${y}`)) continue; // don't touch any building's perimeter
          // Check if this wall is from another building's footprint
          for (const other of validBuildings) {
            if (other === b) continue;
            const onOtherPerimeter =
              ((x === other.x1 || x === other.x2) && y >= other.y1 && y <= other.y2) ||
              ((y === other.y1 || y === other.y2) && x >= other.x1 && x <= other.x2);
            if (onOtherPerimeter) {
              cells[y][x] = floorCell('wood');
              break;
            }
          }
        }
      }
    }

    // Pass 3: Ensure entrance doors + flood-fill reachability for each building
    for (const b of validBuildings) {
      // Find an entrance door on the perimeter
      let entranceDoor: { x: number; y: number } | null = null;
      for (let x = b.x1; x <= b.x2; x++) {
        for (const ey of [b.y1, b.y2]) {
          if (cells[ey][x].features.some(f => f === 'door' || f === 'door_locked')) {
            entranceDoor = { x, y: ey };
          }
        }
      }
      for (let y = b.y1 + 1; y < b.y2; y++) {
        for (const ex of [b.x1, b.x2]) {
          if (cells[y][ex].features.some(f => f === 'door' || f === 'door_locked')) {
            entranceDoor = { x: ex, y };
          }
        }
      }
      if (!entranceDoor) {
        const doorX = b.x1 + Math.floor((b.x2 - b.x1) / 2);
        cells[b.y2][doorX] = makeCell('wood', Infinity, true, ['door']);
        entranceDoor = { x: doorX, y: b.y2 };
      }

      // Flood fill from entrance
      const reachable = new Set<string>();
      const queue: [number, number][] = [[entranceDoor.x, entranceDoor.y]];
      while (queue.length > 0) {
        const [fx, fy] = queue.shift()!;
        const k = `${fx},${fy}`;
        if (reachable.has(k)) continue;
        if (fx < b.x1 || fx > b.x2 || fy < b.y1 || fy > b.y2) continue;
        const c = cells[fy][fx];
        if (c.terrain === 'wall' && !c.features.some(f => f === 'door' || f === 'door_locked')) continue;
        reachable.add(k);
        queue.push([fx + 1, fy], [fx - 1, fy], [fx, fy + 1], [fx, fy - 1]);
      }

      // Fix unreachable interior cells by punching doors through blocking walls
      for (let y = b.y1 + 1; y < b.y2; y++) {
        for (let x = b.x1 + 1; x < b.x2; x++) {
          const c = cells[y][x];
          if (c.terrain === 'wall' || c.features.some(f => f === 'door' || f === 'door_locked')) continue;
          if (reachable.has(`${x},${y}`)) continue;

          // Find adjacent wall between reachable and unreachable areas
          for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
            const wx = x + dx, wy = y + dy;
            if (wx < b.x1 || wx > b.x2 || wy < b.y1 || wy > b.y2) continue;
            // Only punch through internal walls, not perimeter walls
            if (wx === b.x1 || wx === b.x2 || wy === b.y1 || wy === b.y2) continue;
            if (cells[wy][wx].terrain !== 'wall' || cells[wy][wx].features.length > 0) continue;

            const ox = wx + dx, oy = wy + dy;
            if (ox >= b.x1 && ox <= b.x2 && oy >= b.y1 && oy <= b.y2 && reachable.has(`${ox},${oy}`)) {
              cells[wy][wx] = makeCell('wood', Infinity, true, ['door']);
              // Re-flood from newly connected cell
              const requeue: [number, number][] = [[x, y]];
              while (requeue.length > 0) {
                const [rx, ry] = requeue.shift()!;
                const rk = `${rx},${ry}`;
                if (reachable.has(rk)) continue;
                if (rx < b.x1 || rx > b.x2 || ry < b.y1 || ry > b.y2) continue;
                const rc = cells[ry][rx];
                if (rc.terrain === 'wall' && !rc.features.some(f => f === 'door' || f === 'door_locked')) continue;
                reachable.add(rk);
                requeue.push([rx + 1, ry], [rx - 1, ry], [rx, ry + 1], [rx, ry - 1]);
              }
              break;
            }
          }
        }
      }
    }
  }

  /** Repair a single perimeter cell to be a wall, unless it's a door. */
  private repairWall(cells: GridCell[][], x: number, y: number): void {
    const cell = cells[y][x];
    if (cell.features.some(f => f === 'door' || f === 'door_locked')) return;
    if (cell.terrain !== 'wall') {
      cells[y][x] = wallCell();
    }
  }

  // ── Spawn Point ────────────────────────────────────────────

  private computeSpawnPoint(
    cells: GridCell[][],
    w: number, h: number,
    entryDir: { dx: number; dy: number },
  ): Coordinate {
    let targetX = Math.floor(w / 2);
    let targetY = Math.floor(h / 2);

    const { dx, dy } = entryDir;

    if (Math.abs(dx) >= Math.abs(dy)) {
      if (dx > 0) { targetX = 2; targetY = Math.floor(h / 2); }
      else if (dx < 0) { targetX = w - 3; targetY = Math.floor(h / 2); }
    } else {
      if (dy > 0) { targetY = 2; targetX = Math.floor(w / 2); }
      else if (dy < 0) { targetY = h - 3; targetX = Math.floor(w / 2); }
    }

    // Default: south edge (first visit)
    if (dx === 0 && dy === 0) {
      targetX = Math.floor(w / 2);
      targetY = h - 3;
    }

    return this.findOpenCell(cells, w, h, targetX, targetY);
  }

  // ── Utilities ──────────────────────────────────────────────

  /** Check if a cell is part of a road/path (to avoid overwriting) */
  private isRoad(cell: GridCell): boolean {
    return cell.terrain === 'stone' && cell.features.length === 0 && cell.movementCost <= 1;
  }
}
