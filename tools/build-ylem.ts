#!/usr/bin/env npx tsx
/**
 * build-ylem.ts — Generates the Ylem handcrafted world.
 *
 * Usage:  npx tsx tools/build-ylem.ts
 * Output: public/worlds/ylem.oneparty.json
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Inline types (mirrors src/types) ────────────────────────────
// NOTE: Feature physics (blocks, blocksLoS, lightRadius) are canonically
// defined in src/data/features.ts. This build tool duplicates them inline
// because it runs standalone and cannot import from src/.

type CellTerrain = 'floor' | 'wall' | 'water' | 'lava' | 'pit' | 'grass' | 'stone' | 'ice' | 'mud' | 'sand' | 'wood';
type CellFeature = 'door' | 'door_locked' | 'trap' | 'chest' | 'fire' | 'altar' | 'stairs_up' | 'stairs_down'
  | 'fountain' | 'pillar' | 'tree' | 'rock' | 'running_water' | 'torch_wall' | 'torch_wall_spent' | 'brazier'
  | 'table' | 'chair' | 'bed' | 'shelf' | 'counter' | 'anvil' | 'barrel' | 'crate' | 'bookshelf' | 'rug'
  | 'banner' | 'well' | 'market_stall' | 'sign' | 'candle' | 'chandelier' | 'weapon_rack' | 'hearth' | 'bench';
type GridCell = { terrain: CellTerrain; movementCost: number; blocksLoS: boolean; elevation: number; features: CellFeature[] };

/** Inline copy of physics — must match src/data/features.ts FEATURES registry */
const FEATURE_PHYSICS: Partial<Record<CellFeature, { blocks: boolean; blocksLoS: boolean }>> = {
  tree: { blocks: true, blocksLoS: true }, rock: { blocks: true, blocksLoS: true },
  pillar: { blocks: true, blocksLoS: true }, counter: { blocks: true, blocksLoS: true },
  shelf: { blocks: true, blocksLoS: true }, bookshelf: { blocks: true, blocksLoS: true },
  barrel: { blocks: true, blocksLoS: true }, crate: { blocks: true, blocksLoS: true },
  bed: { blocks: true, blocksLoS: false }, well: { blocks: true, blocksLoS: false },
  anvil: { blocks: true, blocksLoS: false }, weapon_rack: { blocks: true, blocksLoS: true },
  market_stall: { blocks: true, blocksLoS: true }, chest: { blocks: true, blocksLoS: false },
  hearth: { blocks: true, blocksLoS: false }, fountain: { blocks: true, blocksLoS: false },
  door_locked: { blocks: true, blocksLoS: true },
};
type Coordinate = { x: number; y: number };
type BiomeType = 'forest' | 'mountain' | 'desert' | 'swamp' | 'plains' | 'coast' | 'tundra' | 'volcanic' | 'underdark' | 'urban';
type OverworldTerrain = 'deep_water' | 'shallow_water' | 'beach' | 'plains' | 'forest' | 'dense_forest' | 'hills' | 'mountain' | 'peak' | 'snow' | 'desert' | 'swamp' | 'tundra' | 'volcanic';
type SettlementType = 'village' | 'town' | 'city' | 'fortress' | 'ruins' | 'temple';
type PlaneType = 'material' | 'underdark' | 'feywild' | 'shadowfell' | 'elemental' | 'astral' | 'ethereal' | 'outer';

type OverworldTile = {
  elevation: number; temperature: number; moisture: number;
  biome: BiomeType; terrain: OverworldTerrain; river: boolean;
  settlement: SettlementType | null; settlementName: string | null;
  discovered: boolean; regionId: string;
};
type OverworldRegion = { id: string; name: string; biome: BiomeType; centerX: number; centerY: number; tileCount: number };
type OverworldData = {
  id: string; name: string; seed: number; width: number; height: number;
  tiles: OverworldTile[][]; regions: OverworldRegion[];
  history: { year: number; event: string }[]; createdAt: number;
};
type HandcraftedNPC = {
  id?: string; name: string; role: string; race?: string;
  description?: string; dialogue?: Record<string, string>;
  inventory?: string[]; position?: Coordinate;
};
type HandcraftedPOI = { name: string; type: string; tileX: number; tileY: number; description: string };
type LocationOverride = {
  tileX: number; tileY: number;
  handcraftedMap?: { width: number; height: number; cells: [number, number, GridCell][]; playerStart: Coordinate };
  npcs?: HandcraftedNPC[]; description?: string; pointsOfInterest?: HandcraftedPOI[];
};

// ── Map Builder ─────────────────────────────────────────────────

const MAP_W = 200;
const MAP_H = 200;

class MapBuilder {
  private cells = new Map<string, GridCell>();

  private key(x: number, y: number): string { return `${x},${y}`; }

  set(x: number, y: number, cell: GridCell): void {
    if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) return;
    this.cells.set(this.key(x, y), cell);
  }

  get(x: number, y: number): GridCell | undefined {
    return this.cells.get(this.key(x, y));
  }

  /** Fill a rectangle with terrain. */
  fill(x: number, y: number, w: number, h: number, terrain: CellTerrain, features: CellFeature[] = []): void {
    const mv = terrain === 'wall' ? Infinity : terrain === 'water' ? 2 : 1;
    const los = terrain === 'wall';
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        this.set(x + dx, y + dy, { terrain, movementCost: mv, blocksLoS: los, elevation: 0, features: [...features] });
      }
    }
  }

  /** Draw walls around a rectangle perimeter. */
  walls(x: number, y: number, w: number, h: number): void {
    for (let dx = 0; dx < w; dx++) {
      this.set(x + dx, y, wall());
      this.set(x + dx, y + h - 1, wall());
    }
    for (let dy = 0; dy < h; dy++) {
      this.set(x, y + dy, wall());
      this.set(x + w - 1, y + dy, wall());
    }
  }

  /** Fill interior of a rectangle with floor terrain. */
  floor(x: number, y: number, w: number, h: number, terrain: CellTerrain = 'wood'): void {
    for (let dy = 1; dy < h - 1; dy++) {
      for (let dx = 1; dx < w - 1; dx++) {
        this.set(x + dx, y + dy, { terrain, movementCost: 1, blocksLoS: false, elevation: 0, features: [] });
      }
    }
  }

  /** Place a door at a specific position (replaces wall). */
  door(x: number, y: number, locked = false): void {
    this.set(x, y, { terrain: 'wood', movementCost: 1, blocksLoS: false, elevation: 0, features: [locked ? 'door_locked' : 'door'] });
  }

  /** Place a feature on an existing cell, or create a floor cell with the feature. */
  feature(x: number, y: number, feat: CellFeature, terrain?: CellTerrain): void {
    const phys = FEATURE_PHYSICS[feat];
    const existing = this.get(x, y);
    if (existing) {
      existing.features.push(feat);
      if (phys?.blocks && existing.movementCost < Infinity) {
        existing.movementCost = Infinity;
      }
      if (phys?.blocksLoS) {
        existing.blocksLoS = true;
      }
      this.set(x, y, existing);
    } else {
      this.set(x, y, {
        terrain: terrain ?? 'wood',
        movementCost: phys?.blocks ? Infinity : 1,
        blocksLoS: phys?.blocksLoS ?? false,
        elevation: 0,
        features: [feat],
      });
    }
  }

  /** Draw a horizontal or vertical road. */
  hroad(x1: number, x2: number, y: number, width: number): void {
    for (let w = 0; w < width; w++) {
      for (let x = x1; x <= x2; x++) {
        this.set(x, y + w, stone());
      }
    }
  }

  vroad(y1: number, y2: number, x: number, width: number): void {
    for (let w = 0; w < width; w++) {
      for (let y = y1; y <= y2; y++) {
        this.set(x + w, y, stone());
      }
    }
  }

  /** Create a complete building with walls, floor, and a door. */
  building(x: number, y: number, w: number, h: number, doorSide: 'n' | 's' | 'e' | 'w', doorOffset: number, floorTerrain: CellTerrain = 'wood'): void {
    this.walls(x, y, w, h);
    this.floor(x, y, w, h, floorTerrain);
    // Place door
    switch (doorSide) {
      case 'n': this.door(x + doorOffset, y); break;
      case 's': this.door(x + doorOffset, y + h - 1); break;
      case 'w': this.door(x, y + doorOffset); break;
      case 'e': this.door(x + w - 1, y + doorOffset); break;
    }
  }

  /** Scatter trees in an area (sparse, skip existing cells). */
  trees(x: number, y: number, w: number, h: number, density = 0.15): void {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        if (!this.get(x + dx, y + dy) && pseudoRandom(x + dx, y + dy) < density) {
          this.set(x + dx, y + dy, { terrain: 'grass', movementCost: Infinity, blocksLoS: true, elevation: 0, features: ['tree'] });
        }
      }
    }
  }

  /** Export sparse cell array (only non-default cells). */
  toSparse(): [number, number, GridCell][] {
    const result: [number, number, GridCell][] = [];
    this.cells.forEach((cell, key) => {
      const [x, y] = key.split(',').map(Number);
      result.push([x, y, cell]);
    });
    return result;
  }
}

// ── Cell helpers ────────────────────────────────────────────────

function wall(): GridCell {
  return { terrain: 'wall', movementCost: Infinity, blocksLoS: true, elevation: 0, features: [] };
}
function stone(features: CellFeature[] = []): GridCell {
  return { terrain: 'stone', movementCost: 1, blocksLoS: false, elevation: 0, features };
}
function water(deep = false): GridCell {
  return { terrain: 'water', movementCost: deep ? Infinity : 2, blocksLoS: false, elevation: deep ? -5 : -1, features: [] };
}
function sand(features: CellFeature[] = []): GridCell {
  return { terrain: 'sand', movementCost: 1, blocksLoS: false, elevation: 0, features };
}

/** Simple deterministic pseudo-random for scattering. */
function pseudoRandom(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263 + 1013904223) | 0;
  h = ((h >> 16) ^ h) * 0x45d9f3b; h = ((h >> 16) ^ h) * 0x45d9f3b; h = (h >> 16) ^ h;
  return (h & 0x7fffffff) / 0x7fffffff;
}

// ── Build Plassans ──────────────────────────────────────────────

function buildPlassans(): { map: typeof dummyMap; npcs: HandcraftedNPC[]; pois: HandcraftedPOI[] } {
  const m = new MapBuilder();

  // ── 1. Natural terrain: sea, beach, outskirts ──

  // Southern sea (y >= 165)
  for (let y = 165; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      m.set(x, y, water(y > 172));
    }
  }
  // Western sea (x <= 14)
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x <= 14; x++) {
      m.set(x, y, water(x < 8));
    }
  }
  // Beach along southern coast (y 158-164)
  for (let y = 158; y < 165; y++) {
    for (let x = 15; x < MAP_W; x++) {
      if (!m.get(x, y)) m.set(x, y, sand());
    }
  }
  // Beach along western coast (x 15-20)
  for (let y = 0; y < 158; y++) {
    for (let x = 15; x <= 20; x++) {
      if (!m.get(x, y)) m.set(x, y, sand());
    }
  }

  // Trees in outskirts (north and east)
  m.trees(22, 0, 178, 28, 0.2);
  m.trees(170, 28, 30, 130, 0.15);

  // ── 2. City ground: stone streets ──

  // Fill city area with stone cobblestone base
  m.fill(25, 30, 142, 125, 'stone'); // Main city area: x=25-166, y=30-154

  // ── 3. Major streets (3 wide) ──

  // Grand Boulevard (main E-W): y=80-82
  m.hroad(22, 175, 80, 3);
  // Avenue de la Cathédrale (main N-S): x=93-95
  m.vroad(28, 160, 93, 3);
  // Rue Royale (E side N-S): x=138-140
  m.vroad(28, 155, 138, 3);

  // ── 4. Secondary streets (2 wide) ──

  // Rue Haute (N residential): y=50-51
  m.hroad(25, 166, 50, 2);
  // Rue des Vignes: y=65-66
  m.hroad(25, 166, 65, 2);
  // Rue du Commerce: y=100-101
  m.hroad(25, 136, 100, 2);
  // Rue des Pêcheurs: y=120-121
  m.hroad(25, 166, 120, 2);
  // Promenade du Port: y=142-143
  m.hroad(22, 166, 142, 2);

  // Rue de l'Ouest (W side N-S): x=55-56
  m.vroad(30, 155, 55, 2);
  // Rue du Vieux Port: x=75-76
  m.vroad(30, 155, 75, 2);
  // Rue des Artisans: x=115-116
  m.vroad(30, 140, 115, 2);
  // Rue des Remparts (E): x=158-159
  m.vroad(30, 155, 158, 2);

  // ── 5. Place de la Fontaine (Central Plaza) ──

  // Large open plaza around the Grand Boulevard / Ave de la Cathédrale intersection
  m.fill(82, 72, 28, 18, 'stone'); // 28x18 plaza, x=82-109, y=72-89
  m.feature(96, 81, 'fountain', 'stone');
  // Benches around the fountain
  m.feature(93, 79, 'bench', 'stone');
  m.feature(99, 79, 'bench', 'stone');
  m.feature(93, 83, 'bench', 'stone');
  m.feature(99, 83, 'bench', 'stone');
  // Market stalls on the plaza edges
  m.feature(84, 74, 'market_stall', 'stone');
  m.feature(89, 74, 'market_stall', 'stone');
  m.feature(101, 74, 'market_stall', 'stone');
  m.feature(106, 74, 'market_stall', 'stone');
  // Pillars framing the plaza
  m.feature(82, 72, 'pillar', 'stone');
  m.feature(109, 72, 'pillar', 'stone');
  m.feature(82, 89, 'pillar', 'stone');
  m.feature(109, 89, 'pillar', 'stone');
  // Decorative rug at center approach
  m.feature(96, 78, 'rug', 'stone');

  // ── 6. Port / Harbor area (y 144-162) ──

  // Wooden docks extending over sand/water
  // Main dock platform
  m.fill(40, 148, 80, 4, 'wood');  // Long wooden pier
  m.fill(55, 152, 3, 10, 'wood');  // Pier arm 1
  m.fill(75, 152, 3, 10, 'wood');  // Pier arm 2
  m.fill(95, 152, 3, 10, 'wood');  // Pier arm 3
  m.fill(110, 148, 30, 4, 'wood'); // Secondary dock
  // Bollards and barrels on docks
  m.feature(45, 149, 'barrel');
  m.feature(50, 149, 'crate');
  m.feature(60, 149, 'barrel');
  m.feature(85, 149, 'crate');
  m.feature(100, 149, 'barrel');
  m.feature(115, 149, 'barrel');
  m.feature(125, 149, 'crate');

  // ── 7. City Walls (north and east) ──

  // North wall
  for (let x = 22; x <= 168; x++) {
    m.set(x, 28, wall());
    m.set(x, 29, wall());
  }
  // North gate opening
  for (let x = 92; x <= 96; x++) {
    m.set(x, 28, stone(['sign']));
    m.set(x, 29, stone());
  }
  // East wall
  for (let y = 28; y <= 155; y++) {
    m.set(167, y, wall());
    m.set(168, y, wall());
  }
  // East gate opening
  for (let y = 79; y <= 83; y++) {
    m.set(167, y, stone());
    m.set(168, y, stone());
  }
  // Wall torches
  for (let x = 30; x <= 165; x += 12) {
    m.feature(x, 28, 'torch_wall');
  }
  for (let y = 35; y <= 150; y += 12) {
    m.feature(168, y, 'torch_wall');
  }

  // ── 8. Buildings ──────────────────────────────────────────────

  // ─── CATHÉDRALE SAINT-AURIEL ─── (the grandest building)
  // North-center, between Rue Haute and Rue des Vignes
  m.building(60, 34, 28, 14, 's', 14, 'stone');
  // Internal pillars
  for (let px = 64; px <= 84; px += 4) {
    m.feature(px, 38, 'pillar', 'stone');
    m.feature(px, 44, 'pillar', 'stone');
  }
  m.feature(74, 36, 'altar', 'stone');      // Main altar
  m.feature(73, 36, 'candle', 'stone');
  m.feature(75, 36, 'candle', 'stone');
  m.feature(74, 35, 'banner', 'stone');
  m.feature(70, 41, 'bench', 'stone');       // Pews
  m.feature(72, 41, 'bench', 'stone');
  m.feature(76, 41, 'bench', 'stone');
  m.feature(78, 41, 'bench', 'stone');
  m.feature(70, 43, 'bench', 'stone');
  m.feature(72, 43, 'bench', 'stone');
  m.feature(76, 43, 'bench', 'stone');
  m.feature(78, 43, 'bench', 'stone');
  m.feature(74, 41, 'chandelier', 'stone');  // Grand chandelier
  // Stained glass feel: torch sconces on walls
  m.feature(61, 37, 'torch_wall');
  m.feature(61, 43, 'torch_wall');
  m.feature(87, 37, 'torch_wall');
  m.feature(87, 43, 'torch_wall');

  // ─── LA COURONNE D'OR ─── (main inn/tavern)
  // West of plaza, south of Rue des Vignes
  m.building(28, 68, 22, 14, 'e', 7, 'wood');
  // Common room (main floor)
  m.feature(35, 72, 'hearth');               // Big fireplace
  m.feature(33, 74, 'table');
  m.feature(32, 74, 'chair');
  m.feature(34, 74, 'chair');
  m.feature(33, 76, 'table');
  m.feature(32, 76, 'chair');
  m.feature(34, 76, 'chair');
  m.feature(37, 74, 'table');
  m.feature(36, 74, 'chair');
  m.feature(38, 74, 'chair');
  m.feature(37, 76, 'table');
  m.feature(36, 76, 'chair');
  m.feature(38, 76, 'chair');
  m.feature(43, 71, 'counter');              // Bar counter
  m.feature(44, 71, 'counter');
  m.feature(45, 71, 'counter');
  m.feature(46, 71, 'counter');
  m.feature(44, 70, 'barrel');               // Kegs behind bar
  m.feature(46, 70, 'barrel');
  m.feature(42, 77, 'stairs_up');            // To rooms (north of interior wall)
  m.feature(30, 72, 'chandelier');
  m.feature(40, 72, 'chandelier');
  // Interior wall dividing common room from guest rooms
  for (let dx = 29; dx <= 48; dx++) m.set(dx, 78, wall());
  m.door(38, 78);                             // Door to back area
  // Guest rooms in back
  m.feature(31, 79, 'bed');
  m.feature(34, 79, 'bed');
  m.feature(38, 79, 'bed');
  m.feature(42, 79, 'bed');
  m.feature(31, 80, 'shelf');
  m.feature(42, 80, 'shelf');
  m.feature(29, 70, 'torch_wall');
  m.feature(48, 70, 'torch_wall');
  m.feature(29, 78, 'torch_wall');
  m.feature(48, 78, 'torch_wall');
  m.feature(30, 69, 'sign');                 // Inn sign

  // ─── BOUTIQUE LAFLEUR ─── (general store)
  // NW area, south of Rue Haute
  m.building(28, 53, 12, 10, 's', 6, 'wood');
  m.feature(30, 55, 'shelf');
  m.feature(31, 55, 'shelf');
  m.feature(32, 55, 'shelf');
  m.feature(30, 57, 'shelf');
  m.feature(31, 57, 'shelf');
  m.feature(35, 55, 'counter');
  m.feature(36, 55, 'counter');
  m.feature(37, 55, 'crate');
  m.feature(37, 57, 'crate');
  m.feature(30, 59, 'barrel');
  m.feature(37, 59, 'barrel');
  m.feature(29, 54, 'torch_wall');
  m.feature(38, 54, 'torch_wall');

  // ─── L'APOTHICAIRE ─── (potion/herb shop)
  // NE of cathedral
  m.building(100, 34, 12, 10, 's', 6, 'wood');
  m.feature(102, 36, 'shelf');
  m.feature(103, 36, 'shelf');
  m.feature(104, 36, 'bookshelf');
  m.feature(107, 36, 'shelf');
  m.feature(108, 36, 'shelf');
  m.feature(105, 38, 'counter');
  m.feature(106, 38, 'counter');
  m.feature(102, 40, 'barrel');
  m.feature(109, 40, 'crate');
  m.feature(105, 40, 'candle');
  m.feature(101, 35, 'torch_wall');
  m.feature(110, 35, 'torch_wall');

  // ─── FORGE DE MAÎTRE BRUN ─── (blacksmith)
  // East of avenue, north side
  m.building(100, 55, 14, 10, 's', 7, 'stone');
  m.feature(103, 57, 'hearth');              // Forge fire
  m.feature(104, 57, 'anvil');               // Working anvil
  m.feature(108, 57, 'weapon_rack');
  m.feature(110, 57, 'weapon_rack');
  m.feature(103, 61, 'barrel');              // Water barrel (quenching)
  m.feature(108, 61, 'crate');
  m.feature(110, 61, 'shelf');
  m.feature(105, 59, 'brazier');             // Extra heat
  m.feature(101, 56, 'torch_wall');
  m.feature(112, 56, 'torch_wall');

  // ─── CASERNE DES GARDES ─── (barracks/guard house)
  // Far east (width 16 to clear Rue des Remparts at x=158-159)
  m.building(142, 34, 16, 14, 'w', 7, 'stone');
  // Armory side
  m.feature(145, 37, 'weapon_rack');
  m.feature(147, 37, 'weapon_rack');
  m.feature(149, 37, 'weapon_rack');
  m.feature(145, 39, 'chest');
  // Bunks (shifted inward)
  m.feature(151, 37, 'bed');
  m.feature(153, 37, 'bed');
  m.feature(155, 37, 'bed');
  m.feature(151, 39, 'bed');
  m.feature(153, 39, 'bed');
  m.feature(155, 39, 'bed');
  // Common area
  m.feature(150, 42, 'table');
  m.feature(149, 42, 'chair');
  m.feature(151, 42, 'chair');
  m.feature(150, 44, 'table');
  m.feature(149, 44, 'chair');
  m.feature(151, 44, 'chair');
  m.feature(145, 44, 'hearth');
  m.feature(143, 36, 'torch_wall');
  m.feature(143, 44, 'torch_wall');
  m.feature(156, 36, 'torch_wall');
  m.feature(156, 44, 'torch_wall');
  m.feature(155, 36, 'banner');

  // ─── HÔTEL DE VILLE ─── (town hall)
  // East of avenue, between Rue des Vignes and Grand Boulevard
  m.building(100, 68, 14, 10, 'w', 5, 'stone');
  m.feature(103, 70, 'table');
  m.feature(104, 70, 'chair');
  m.feature(105, 70, 'chair');
  m.feature(108, 70, 'bookshelf');
  m.feature(110, 70, 'bookshelf');
  m.feature(108, 74, 'table');
  m.feature(107, 74, 'chair');
  m.feature(109, 74, 'chair');
  m.feature(103, 74, 'banner');
  m.feature(106, 72, 'chandelier');
  m.feature(101, 69, 'torch_wall');
  m.feature(112, 69, 'torch_wall');

  // ─── LE CHAT NOIR ─── (harbor tavern)
  // South area near port
  m.building(58, 124, 16, 12, 'n', 8, 'wood');
  m.feature(62, 128, 'hearth');
  m.feature(64, 128, 'table');
  m.feature(63, 128, 'chair');
  m.feature(65, 128, 'chair');
  m.feature(64, 130, 'table');
  m.feature(63, 130, 'chair');
  m.feature(65, 130, 'chair');
  m.feature(68, 127, 'counter');
  m.feature(69, 127, 'counter');
  m.feature(70, 127, 'counter');
  m.feature(69, 126, 'barrel');
  m.feature(71, 126, 'barrel');
  m.feature(60, 132, 'crate');
  m.feature(71, 132, 'crate');
  m.feature(59, 125, 'torch_wall');
  m.feature(72, 125, 'torch_wall');

  // ─── LE GRAND MARCHÉ ─── (open market area)
  // West of center, between Rue du Commerce and Rue des Pêcheurs
  // Open air: stone ground with market stalls (no walls)
  m.fill(28, 103, 24, 15, 'stone');
  m.feature(30, 105, 'market_stall');
  m.feature(35, 105, 'market_stall');
  m.feature(40, 105, 'market_stall');
  m.feature(45, 105, 'market_stall');
  m.feature(30, 110, 'market_stall');
  m.feature(35, 110, 'market_stall');
  m.feature(40, 110, 'market_stall');
  m.feature(45, 110, 'market_stall');
  m.feature(32, 107, 'crate');
  m.feature(38, 107, 'barrel');
  m.feature(43, 107, 'crate');
  m.feature(48, 107, 'barrel');
  m.feature(30, 114, 'sign');

  // ─── HARBOR MASTER'S OFFICE ───
  m.building(78, 138, 10, 8, 'n', 5, 'wood');
  m.feature(80, 140, 'table');
  m.feature(81, 140, 'chair');
  m.feature(84, 140, 'bookshelf');
  m.feature(80, 143, 'chest');
  m.feature(84, 143, 'shelf');
  m.feature(79, 139, 'torch_wall');

  // ─── FISH MARKET ───
  m.building(100, 138, 12, 6, 'n', 6, 'wood');
  m.feature(102, 140, 'counter');
  m.feature(103, 140, 'counter');
  m.feature(104, 140, 'counter');
  m.feature(107, 140, 'barrel');
  m.feature(109, 140, 'crate');

  // ─── WAREHOUSE 1 ─── (moved east to clear Rue des Artisans at x=115-116)
  m.building(117, 124, 14, 10, 'w', 5, 'stone');
  m.feature(120, 126, 'crate');
  m.feature(122, 126, 'crate');
  m.feature(124, 126, 'crate');
  m.feature(126, 126, 'barrel');
  m.feature(120, 130, 'barrel');
  m.feature(122, 130, 'barrel');
  m.feature(124, 130, 'crate');
  m.feature(126, 130, 'crate');

  // ─── WAREHOUSE 2 ───
  m.building(135, 124, 12, 10, 'w', 5, 'stone');
  m.feature(138, 126, 'barrel');
  m.feature(140, 126, 'barrel');
  m.feature(143, 126, 'crate');
  m.feature(138, 130, 'crate');
  m.feature(140, 130, 'crate');
  m.feature(143, 130, 'barrel');

  // ─── RESIDENTIAL HOUSES ───

  // House 1: Near cathedral (priest's quarters)
  m.building(28, 34, 10, 8, 's', 5, 'wood');
  m.feature(30, 36, 'bed');
  m.feature(34, 36, 'bookshelf');
  m.feature(30, 38, 'table');
  m.feature(31, 38, 'chair');
  m.feature(34, 38, 'candle');
  m.feature(29, 35, 'torch_wall');

  // House 2: Noble residence (NW)
  m.building(42, 34, 12, 10, 's', 6, 'wood');
  m.feature(44, 36, 'bed');
  m.feature(44, 37, 'rug');
  m.feature(49, 36, 'bookshelf');
  m.feature(50, 36, 'bookshelf');
  m.feature(47, 39, 'table');
  m.feature(46, 39, 'chair');
  m.feature(48, 39, 'chair');
  m.feature(44, 40, 'hearth');
  m.feature(50, 40, 'chandelier');
  m.feature(43, 35, 'torch_wall');
  m.feature(52, 35, 'torch_wall');

  // House 3: East residential
  m.building(120, 55, 10, 8, 'w', 4, 'wood');
  m.feature(122, 57, 'bed');
  m.feature(126, 57, 'shelf');
  m.feature(124, 59, 'table');
  m.feature(123, 59, 'chair');

  // House 4: East residential
  m.building(120, 68, 10, 8, 'w', 4, 'wood');
  m.feature(122, 70, 'bed');
  m.feature(126, 70, 'shelf');
  m.feature(124, 72, 'hearth');

  // House 5: West, south of Boutique
  m.building(42, 55, 10, 8, 'e', 4, 'wood');
  m.feature(44, 57, 'bed');
  m.feature(48, 57, 'table');
  m.feature(47, 57, 'chair');
  m.feature(44, 59, 'barrel');

  // House 6: Near La Couronne d'Or
  m.building(28, 85, 10, 8, 'n', 5, 'wood');
  m.feature(30, 87, 'bed');
  m.feature(34, 87, 'shelf');
  m.feature(30, 89, 'table');
  m.feature(31, 89, 'chair');

  // House 7: South residential
  m.building(28, 124, 10, 8, 'n', 5, 'wood');
  m.feature(30, 126, 'bed');
  m.feature(34, 126, 'shelf');
  m.feature(30, 128, 'hearth');

  // House 8: North of market (ends at y=98, clear of Rue du Commerce at y=100)
  m.building(42, 91, 10, 8, 'e', 4, 'wood');
  m.feature(44, 93, 'bed');
  m.feature(48, 93, 'table');
  m.feature(47, 93, 'chair');
  m.feature(44, 95, 'shelf');

  // House 9: Central east
  m.building(142, 55, 12, 8, 'w', 4, 'wood');
  m.feature(144, 57, 'bed');
  m.feature(148, 57, 'table');
  m.feature(147, 57, 'chair');
  m.feature(150, 57, 'bookshelf');
  m.feature(144, 59, 'hearth');

  // House 10: Port area
  m.building(42, 124, 10, 8, 'n', 5, 'wood');
  m.feature(44, 126, 'bed');
  m.feature(48, 126, 'shelf');
  m.feature(44, 128, 'table');
  m.feature(45, 128, 'chair');

  // House 11: NE area
  m.building(120, 34, 10, 8, 's', 5, 'wood');
  m.feature(122, 36, 'bed');
  m.feature(126, 36, 'shelf');
  m.feature(124, 38, 'table');
  m.feature(123, 38, 'chair');

  // House 12: S-center
  m.building(78, 103, 12, 10, 'n', 6, 'wood');
  m.feature(80, 105, 'bed');
  m.feature(80, 106, 'bed');
  m.feature(85, 105, 'table');
  m.feature(84, 105, 'chair');
  m.feature(86, 105, 'chair');
  m.feature(85, 109, 'hearth');
  m.feature(79, 104, 'torch_wall');
  m.feature(88, 104, 'torch_wall');

  // House 13: Far south
  m.building(100, 103, 10, 10, 'w', 5, 'wood');
  m.feature(102, 105, 'bed');
  m.feature(106, 105, 'shelf');
  m.feature(102, 109, 'table');
  m.feature(103, 109, 'chair');
  m.feature(106, 109, 'barrel');

  // House 14: Dockworker house
  m.building(58, 138, 10, 8, 'n', 5, 'wood');
  m.feature(60, 140, 'bed');
  m.feature(64, 140, 'shelf');
  m.feature(60, 142, 'table');
  m.feature(61, 142, 'chair');

  // (House 15 removed — overlapped with Le Grand Marché at the same coordinates)

  // La Banque de Plassans — stone building, east of the central plaza
  m.building(120, 85, 14, 10, 'w', 5, 'stone');
  m.feature(122, 87, 'counter');
  m.feature(124, 87, 'counter');
  m.feature(126, 87, 'counter');
  m.feature(128, 87, 'shelf');
  m.feature(130, 87, 'bookshelf');
  m.feature(122, 91, 'table');
  m.feature(123, 91, 'chair');
  m.feature(128, 91, 'chest');
  m.feature(130, 91, 'chest');
  m.feature(121, 86, 'torch_wall');
  m.feature(131, 86, 'torch_wall');
  m.feature(121, 92, 'torch_wall');
  m.feature(131, 92, 'torch_wall');

  // ─── 9. Street decorations ──

  // Wells scattered around
  m.feature(60, 80, 'well', 'stone');
  m.feature(130, 100, 'well', 'stone');

  // Street torches along major roads
  for (let x = 30; x <= 165; x += 10) {
    m.feature(x, 79, 'torch_wall', 'stone'); // Along Grand Boulevard
  }
  for (let y = 35; y <= 150; y += 10) {
    m.feature(92, y, 'torch_wall', 'stone'); // Along Ave de la Cathédrale
  }

  // Trees along Promenade du Port
  for (let x = 30; x <= 160; x += 8) {
    m.feature(x, 141, 'tree', 'stone');
  }

  // Benches along promenade
  for (let x = 35; x <= 155; x += 15) {
    m.feature(x, 143, 'bench', 'stone');
  }

  // ── 10. Approach roads from edges ──

  // North approach road
  m.vroad(0, 28, 93, 3);
  // East approach road
  m.hroad(168, 199, 80, 3);

  // ── NPCs ──────────────────────────────────────────────────────

  const npcs: HandcraftedNPC[] = [
    {
      name: 'Aurélie Bonnard',
      role: 'innkeeper',
      race: 'human',
      description: 'A warm, broad-shouldered woman with flour-dusted hands and a ready laugh. She runs La Couronne d\'Or with an iron will and a generous heart.',
      dialogue: {
        greeting: 'Bienvenue, traveller! A room, a meal, or just a place by the fire?',
        info: 'Plassans has been peaceful lately, though the fishermen speak of strange lights on the water at night.',
        farewell: 'May the road rise to meet you, friend.',
      },
      position: { x: 44, y: 72 },
    },
    {
      name: 'Père Matthieu',
      role: 'priest',
      race: 'human',
      description: 'A gaunt elderly man with kind eyes and ink-stained fingers. He tends the Cathédrale with quiet devotion and keeps the city\'s oldest records.',
      dialogue: {
        greeting: 'Peace be upon you, child. The light of Saint-Auriel watches over all who enter here.',
        info: 'The cathedral has stood for three centuries. Its stones remember much that mortal minds forget.',
        farewell: 'Walk in the light, always.',
      },
      position: { x: 72, y: 42 },
    },
    {
      name: 'Madame Lafleur',
      role: 'merchant',
      race: 'human',
      description: 'A sharp-eyed woman in her fifties who knows the value of everything and the price of nothing. Her shop has served Plassans for twenty years.',
      dialogue: {
        greeting: 'Ah, a customer! Come in, come in. I have exactly what you need — even if you don\'t know it yet.',
        info: 'Trade has been good since the new harbour master arrived. Ships from the east bring rare goods.',
        farewell: 'Come back soon — I\'ll save the good stock for you.',
      },
      inventory: ['torch', 'rope', 'rations', 'healing_potion', 'antidote'],
      position: { x: 34, y: 58 },
    },
    {
      name: 'Maître Brun',
      role: 'blacksmith',
      race: 'dwarf',
      description: 'A stocky dwarf with arms like oak beams and a bristling red beard. His forge burns day and night, and his blades are prized across La Côte Dorée.',
      dialogue: {
        greeting: 'Aye? Need steel? You\'ve come to the right forge.',
        info: 'I\'ve been working a new alloy — volcanic ore from the mountains mixed with coastal iron. Stronger than anything I\'ve made before.',
        farewell: 'Keep your blade sharp and your shield high.',
      },
      inventory: ['longsword', 'shortsword', 'shield', 'chain_mail', 'dagger'],
      position: { x: 106, y: 60 },
    },
    {
      name: 'Capitaine Duval',
      role: 'guard',
      race: 'human',
      description: 'A tall, stern woman with close-cropped grey hair and a scar across her left cheek. She commands the city guard with precision and fairness.',
      dialogue: {
        greeting: 'State your business, stranger. Plassans is a peaceful city and we intend to keep it so.',
        info: 'Bandits have been spotted on the eastern road. We\'ve doubled patrols, but travellers should exercise caution.',
        farewell: 'Stay out of trouble.',
      },
      position: { x: 150, y: 42 },
    },
    {
      name: 'Sylvie Herault',
      role: 'merchant',
      race: 'half-elf',
      description: 'A willowy half-elf with silver-streaked auburn hair and eyes that seem to see through you. Her potions are renowned, her prices less so.',
      dialogue: {
        greeting: 'The herbs whisper your ailments to me before you speak them. What remedy do you seek?',
        info: 'Strange fungus has been growing in the sewers beneath the old quarter. I\'ve been studying samples — fascinating, if a touch concerning.',
        farewell: 'Health is wealth, dear one.',
      },
      inventory: ['healing_potion', 'antidote', 'potion_of_resistance'],
      position: { x: 106, y: 38 },
    },
    {
      name: 'Vieux Jacques',
      role: 'innkeeper',
      race: 'human',
      description: 'A leathery old sailor turned tavern keeper, missing two fingers and most of his hair. His stories are half lies and entirely entertaining.',
      dialogue: {
        greeting: 'Pull up a chair, ya landlubber. Ale\'s cheap and the stories are free.',
        info: 'I sailed these waters forty years. There\'s things beneath the waves that no chart will ever show you.',
        farewell: 'Don\'t fall in the harbour on your way out, eh?',
      },
      position: { x: 66, y: 129 },
    },
    {
      name: 'Harbour Master Renaud',
      role: 'noble',
      race: 'human',
      description: 'A portly man with an impressive mustache and an even more impressive collection of maritime charts. He controls all shipping in and out of Plassans.',
      dialogue: {
        greeting: 'Yes, yes, the harbour fees are non-negotiable. What else do you need?',
        info: 'A merchant galley from the eastern isles is expected within the week. They carry silks and spices — and rumours of trouble.',
        farewell: 'Fair winds and following seas.',
      },
      position: { x: 82, y: 142 },
    },
    {
      name: 'Marcel Dupont',
      role: 'merchant',
      race: 'human',
      description: 'A cheerful fishmonger with a booming voice and a permanent smell of brine. His catch is always the freshest in the market.',
      dialogue: {
        greeting: 'Fresh fish! Caught this morning! The finest in all Plassans!',
        info: 'The fish have been swimming deeper lately. Something\'s stirring them up out there.',
        farewell: 'Try the mackerel — you won\'t regret it!',
      },
      position: { x: 104, y: 141 },
    },
    {
      name: 'Guard Thierry',
      role: 'guard',
      race: 'human',
      description: 'A young guard with eager eyes and polished armor. He takes his duty at the north gate very seriously.',
      dialogue: {
        greeting: 'Halt! ... Oh, a traveller. Welcome to Plassans. The Capitaine says I should be more welcoming.',
        info: 'I heard wolves howling from the northern woods last night. Unusual for this time of year.',
        farewell: 'Stay safe on the roads.',
      },
      position: { x: 94, y: 31 },
    },
    {
      name: 'Guard Élodie',
      role: 'guard',
      race: 'human',
      description: 'A guard stationed near the east gate, she keeps a watchful eye on the road from Montclair.',
      dialogue: {
        greeting: 'Traveller from the east? The road is clear, but keep your wits about you after dark.',
        info: 'Merchant caravans have reported missing supplies. Could be bandits, could be worse.',
        farewell: 'Auriel\'s blessing.',
      },
      position: { x: 166, y: 81 },
    },
    {
      name: 'Marie-Claire Fontaine',
      role: 'commoner',
      race: 'human',
      description: 'A baker\'s wife with rosy cheeks and a warm disposition. She knows every piece of gossip in the city.',
      dialogue: {
        greeting: 'Oh, hello dear! Have you tried the brioche from my husband\'s bakery? Best in the whole coast!',
        info: 'They say the old Beaumont estate on the hill is haunted. Lights in the windows at night, but no one lives there...',
        farewell: 'Come by the bakery! Corner of Rue Haute and Rue de l\'Ouest!',
      },
      position: { x: 44, y: 58 },
    },
    {
      name: 'Henri Beaumont',
      role: 'noble',
      race: 'human',
      description: 'A thin, pale aristocrat with impeccable dress and a perpetually worried expression. Last of the Beaumont line, he haunts the town hall more than his own manor.',
      dialogue: {
        greeting: 'Ah, another adventurer. How... quaint. I don\'t suppose you\'re here about the manor?',
        info: 'My family\'s estate lies north of the city. Strange occurrences have forced me into the town. I would pay handsomely for someone to investigate.',
        farewell: 'Do be careful. The world is far more dangerous than it appears.',
      },
      position: { x: 106, y: 72 },
    },
    {
      name: 'Colette the Flower Girl',
      role: 'commoner',
      race: 'halfling',
      description: 'A bright-eyed halfling child who sells wildflowers in the central plaza. She knows every alley and shortcut in Plassans.',
      dialogue: {
        greeting: 'Flowers! Pretty flowers for a pretty copper! Roses, lavender, and moonpetals!',
        info: 'I saw rats — BIG rats — coming out of the old well behind the cathedral. Like, really really big.',
        farewell: 'Thank you! You\'re my favourite customer today!',
      },
      position: { x: 90, y: 81 },
    },
    {
      name: 'Gaspard le Marin',
      role: 'commoner',
      race: 'human',
      description: 'A weathered sailor nursing a drink, waiting for his next ship. He\'s sailed to every port on La Côte Dorée.',
      dialogue: {
        greeting: '*grunt* ... Oh. Sorry. Thought you were the harbour master come to collect. What do you want?',
        info: 'There\'s an island three days\' sail southwest. Charts don\'t show it. I\'ve seen it twice — and both times it wasn\'t where it was before.',
        farewell: 'If you ever need passage, ask at the docks for the Étoile du Matin.',
      },
      position: { x: 62, y: 127 },
    },
    {
      name: 'Margot Chevalier',
      role: 'commoner',
      race: 'human',
      description: 'An elderly woman who sits on the promenade bench watching the ships come and go, as she has done every day for thirty years.',
      dialogue: {
        greeting: 'Sit, sit. The view is free and the memories are mine to share.',
        info: 'I remember when a sea serpent surfaced in the harbour. The year my husband was lost. That was fifty summers ago, and still the sea does not forget.',
        farewell: 'The tide waits for no one, dear.',
      },
      position: { x: 65, y: 143 },
    },
    // Banker
    {
      name: 'Monsieur Leduc',
      role: 'banker',
      race: 'human',
      description: 'A meticulous man in a spotless dark doublet with silver cufflinks, his fingers stained with ink from endless ledgers. He runs La Banque de Plassans with the precision of a clockwork mechanism.',
      dialogue: {
        greeting: 'Welcome to La Banque de Plassans. How may I optimize your financial portfolio today?',
        info: 'We offer coin exchange services — bring your coppers, leave with gold. The mathematics is simple and the service impeccable.',
        farewell: 'A pleasure, as always. Your coins are in excellent hands — figuratively speaking.',
      },
      position: { x: 122, y: 89 },
    },
    // Market merchants
    {
      name: 'Lucien the Spice Merchant',
      role: 'merchant',
      race: 'human',
      description: 'A dark-skinned trader from distant lands, his stall in the grand market is a riot of color and aroma.',
      dialogue: {
        greeting: 'From the deserts of Kharim to the shores of Plassans — the finest spices in the known world!',
        info: 'My last shipment was delayed. Storms in the strait, they say, but I\'ve heard whispers of pirates.',
        farewell: 'Taste before you buy, always!',
      },
      inventory: ['rations'],
      position: { x: 36, y: 108 },
    },
    {
      name: 'Thérèse the Clothier',
      role: 'merchant',
      race: 'human',
      description: 'A prim woman with spectacles perched on her nose, surrounded by bolts of fine fabric.',
      dialogue: {
        greeting: 'Looking for something to wear that won\'t fall apart in a fortnight? You\'ve found me.',
        info: 'The nobility are ordering mourning clothes. Something about the Beaumont family, I hear.',
        farewell: 'Dress well, live well.',
      },
      inventory: ['clothes'],
      position: { x: 42, y: 108 },
    },
    {
      name: 'Commoner Patrice',
      role: 'commoner',
      race: 'human',
      description: 'A middle-aged dockworker with calloused hands and a quiet demeanor.',
      dialogue: {
        greeting: 'Don\'t mind me. Just heading to the docks.',
        info: 'Work is steady, but the harbour master has been on edge. Something about the eastern ships.',
      },
      position: { x: 62, y: 143 },
    },
    {
      name: 'Commoner Adèle',
      role: 'commoner',
      race: 'human',
      description: 'A young woman carrying a basket of bread, hurrying home from the market.',
      dialogue: {
        greeting: 'Excuse me! Coming through! ... Oh, hello. Sorry, I\'m in a rush.',
        info: 'Have you been to La Couronne d\'Or? Aurélie\'s onion soup is the best thing in this city.',
      },
      position: { x: 80, y: 75 },
    },
  ];

  // ── POIs (for overworld preview) ──────────────────────────────

  const pois: HandcraftedPOI[] = [
    { name: 'Cathédrale Saint-Auriel', type: 'temple', tileX: 74, tileY: 41, description: 'A grand cathedral with soaring stone pillars and centuries of history embedded in its walls.' },
    { name: 'La Couronne d\'Or', type: 'tavern', tileX: 39, tileY: 75, description: 'The finest inn in Plassans, renowned for its onion soup and generous rooms.' },
    { name: 'Le Chat Noir', type: 'tavern', tileX: 66, tileY: 130, description: 'A rough-hewn harbour tavern where sailors swap tales and lies in equal measure.' },
    { name: 'Place de la Fontaine', type: 'landmark', tileX: 96, tileY: 81, description: 'The beating heart of Plassans — a grand plaza with a marble fountain and bustling market stalls.' },
    { name: 'Le Grand Marché', type: 'market', tileX: 40, tileY: 108, description: 'An open-air market brimming with spices, fabrics, and the shouts of eager merchants.' },
    { name: 'Le Port de Plassans', type: 'harbor', tileX: 80, tileY: 150, description: 'The lifeblood of the city — wooden docks stretching into the azure coastal waters.' },
    { name: 'La Banque de Plassans', type: 'bank', tileX: 120, tileY: 85, description: 'A solid stone building with iron-barred windows and a heavy oak door. The city\'s premier establishment for coin exchange and financial services.' },
  ];

  const map = {
    width: MAP_W,
    height: MAP_H,
    cells: m.toSparse(),
    playerStart: { x: 94, y: 27 } as Coordinate, // Just inside the north gate
  };

  return { map, npcs, pois };
}

const dummyMap = { width: 0, height: 0, cells: [] as [number, number, GridCell][], playerStart: { x: 0, y: 0 } };

// ── Build Overworld ─────────────────────────────────────────────

const OW = 64;
const REGION_ID = 'region_cote_doree';

function buildOverworld(): OverworldData {
  const tiles: OverworldTile[][] = [];

  for (let y = 0; y < OW; y++) {
    tiles[y] = [];
    for (let x = 0; x < OW; x++) {
      tiles[y][x] = generateTile(x, y);
    }
  }

  // Place settlements
  setSettlement(tiles, 10, 52, 'city', 'Plassans');
  setSettlement(tiles, 11, 52, 'city', 'Plassans');
  setSettlement(tiles, 10, 51, 'city', 'Plassans');
  setSettlement(tiles, 11, 51, 'city', 'Plassans');

  setSettlement(tiles, 32, 28, 'town', 'Montclair');
  setSettlement(tiles, 33, 28, 'town', 'Montclair');

  setSettlement(tiles, 22, 40, 'village', 'Les Vignes');

  setSettlement(tiles, 45, 15, 'village', 'Rochefort');
  setSettlement(tiles, 15, 35, 'ruins', 'Ruines de Valmort');
  setSettlement(tiles, 50, 42, 'temple', 'Sanctuaire de la Lune');

  // Add river: flows from NE mountains down to SW coast
  carveRiver(tiles, 55, 5, 8, 55);

  return {
    id: 'overworld_ylem',
    name: 'Le Royaume de Beausoleil',
    seed: 42,
    width: OW,
    height: OW,
    tiles,
    regions: [
      { id: REGION_ID, name: 'La Côte Dorée', biome: 'coast', centerX: 20, centerY: 45, tileCount: OW * OW },
    ],
    history: [
      { year: -800, event: 'The first settlers arrive on the golden coast, drawn by the mild climate and bountiful seas.' },
      { year: -500, event: 'Foundation of Plassans as a fishing village at the mouth of the Auriel River.' },
      { year: -300, event: 'The Beausoleil dynasty rises to power, unifying the coastal settlements under one banner.' },
      { year: -200, event: 'Construction of the Cathédrale Saint-Auriel begins, a monument to the patron saint of the coast.' },
      { year: -100, event: 'Montclair is established as a hill fortress to guard against raids from the eastern mountains.' },
      { year: -50, event: 'The Great Storm devastates the harbour. Plassans rebuilds stronger, with stone walls and deeper docks.' },
      { year: 0, event: 'Present day. Plassans thrives as the jewel of La Côte Dorée, a city of merchants, artisans, and dreamers.' },
    ],
    createdAt: Date.now(),
  };
}

function generateTile(x: number, y: number): OverworldTile {
  // Sea on west and south edges
  const isDeepWaterW = x < 4;
  const isDeepWaterS = y > 59;
  const isShallowW = x >= 4 && x < 6;
  const isShallowS = y >= 58 && y <= 59;
  const isBeachW = x >= 6 && x < 8;
  const isBeachS = y >= 56 && y <= 57;

  // SW corner blend
  const isDeepCorner = x < 4 && y > 56;
  const isShallowCorner = (x < 6 && y > 56) || (x < 4 && y > 54);

  let terrain: OverworldTerrain;
  let biome: BiomeType;
  let elevation: number;
  let temperature: number;
  let moisture: number;

  if (isDeepWaterW || isDeepWaterS || isDeepCorner) {
    terrain = 'deep_water'; biome = 'coast'; elevation = -10; temperature = 0.5; moisture = 1.0;
  } else if (isShallowW || isShallowS || isShallowCorner) {
    terrain = 'shallow_water'; biome = 'coast'; elevation = -2; temperature = 0.5; moisture = 1.0;
  } else if (isBeachW || isBeachS) {
    terrain = 'beach'; biome = 'coast'; elevation = 0.5; temperature = 0.7; moisture = 0.7;
  } else {
    // Land — elevation increases to NE
    const normalizedElev = ((x - 8) + (OW - y)) / (OW * 2);
    elevation = normalizedElev;
    temperature = 0.8 - normalizedElev * 0.4;
    moisture = 0.5 + (y / OW) * 0.3;

    // Add some noise
    const n = pseudoRandom(x * 7 + 3, y * 13 + 7);

    if (normalizedElev > 0.85) {
      terrain = n > 0.7 ? 'snow' : 'peak'; biome = 'mountain';
    } else if (normalizedElev > 0.7) {
      terrain = 'mountain'; biome = 'mountain';
    } else if (normalizedElev > 0.5) {
      terrain = 'hills'; biome = 'mountain';
    } else if (normalizedElev > 0.3) {
      terrain = n > 0.6 ? 'dense_forest' : 'forest'; biome = 'forest';
    } else if (normalizedElev > 0.1) {
      terrain = n > 0.7 ? 'forest' : 'plains'; biome = 'plains';
    } else {
      terrain = 'plains'; biome = 'plains';
    }
  }

  return {
    elevation, temperature, moisture,
    biome, terrain, river: false,
    settlement: null, settlementName: null,
    discovered: false, regionId: REGION_ID,
  };
}

function setSettlement(tiles: OverworldTile[][], x: number, y: number, type: SettlementType, name: string): void {
  if (x >= 0 && x < OW && y >= 0 && y < OW) {
    tiles[y][x].settlement = type;
    tiles[y][x].settlementName = name;
    // Settlements should be on appropriate terrain
    if (tiles[y][x].terrain === 'deep_water' || tiles[y][x].terrain === 'shallow_water' || tiles[y][x].terrain === 'peak') {
      tiles[y][x].terrain = 'plains';
      tiles[y][x].biome = 'plains';
    }
  }
}

function carveRiver(tiles: OverworldTile[][], startX: number, startY: number, endX: number, endY: number): void {
  // Simple bresenham-ish river with some meandering
  let x = startX;
  let y = startY;
  while (x !== endX || y !== endY) {
    if (x >= 0 && x < OW && y >= 0 && y < OW) {
      const tile = tiles[y][x];
      if (tile.terrain !== 'deep_water' && tile.terrain !== 'shallow_water') {
        tile.river = true;
      }
    }
    // Move toward target with slight meandering
    const dx = endX - x;
    const dy = endY - y;
    const n = pseudoRandom(x * 31 + y * 17, x + y);

    if (Math.abs(dx) > Math.abs(dy)) {
      x += dx > 0 ? 1 : -1;
      if (n > 0.6) y += dy > 0 ? 1 : (dy < 0 ? -1 : 0);
    } else {
      y += dy > 0 ? 1 : -1;
      if (n > 0.6) x += dx > 0 ? 1 : (dx < 0 ? -1 : 0);
    }
  }
}

// ── Assemble Universe ───────────────────────────────────────────

function buildUniverse() {
  const overworld = buildOverworld();
  const { map, npcs, pois } = buildPlassans();

  const countryId = 'country_beausoleil';
  const regionId = 'region_cote_doree_world';
  const continentId = 'continent_valterre';
  const planeId = 'plane_material';
  const universeId = 'universe_ylem';

  const universe = {
    id: universeId,
    name: 'Ylem',
    description: 'A world of golden coasts, whispering forests, and ancient secrets buried beneath stone and sea. The kingdom of Beausoleil clings to the western shore, its cities bright against the endless blue.',
    planes: [{
      id: planeId,
      name: 'Le Plan Matériel',
      planeType: 'material' as PlaneType,
      inline: {
        id: planeId,
        name: 'Le Plan Matériel',
        planeType: 'material' as PlaneType,
        description: 'The prime material plane — where mortal feet tread on solid earth, and the sun rises each dawn over the golden coast.',
        continents: [{
          id: continentId,
          name: 'Valterre',
          inline: {
            id: continentId,
            name: 'Valterre',
            description: 'A vast continent stretching from frozen northern peaks to sun-drenched southern shores. Its western coast, La Côte Dorée, is famed for its mild climate and rich trade.',
            regions: [{
              id: regionId,
              name: 'La Côte Dorée',
              inline: {
                id: regionId,
                name: 'La Côte Dorée',
                description: 'The Golden Coast — a ribbon of warm, fertile land between the mountains and the sea. Vineyards climb the hills, fishing boats dot the harbors, and the scent of lavender carries on the breeze.',
                climate: 'Mediterranean',
                countries: [{
                  id: countryId,
                  name: 'Le Royaume de Beausoleil',
                  inline: {
                    id: countryId,
                    name: 'Le Royaume de Beausoleil',
                    description: 'A proud coastal kingdom ruled by an aging dynasty. Its capital, Plassans, is a city of white stone and terracotta roofs, built where the Auriel River meets the sea.',
                    government: 'Hereditary Monarchy',
                    overworld,
                    locationOverrides: [
                      {
                        tileX: 10,
                        tileY: 52,
                        handcraftedMap: map,
                        npcs,
                        description: 'The city of Plassans — jewel of La Côte Dorée. White stone buildings rise along cobbled streets, their terracotta roofs glowing amber in the coastal sun. The grand plaza buzzes with merchants and children, while the cathedral\'s bell tower watches over all.',
                        pointsOfInterest: pois,
                      },
                    ],
                  },
                }],
              },
            }],
          },
        }],
      },
    }],
    history: [
      { era: 'Dawn Age', year: -2000, event: 'The Material Plane coalesces from the raw essence of Ylem — the primordial matter from which all things spring.', scope: 'universe' as const },
      { era: 'Age of Settling', year: -800, event: 'First mortal settlers arrive on the golden coast of Valterre.', scope: 'continent' as const, scopeId: continentId },
      { era: 'Age of Settling', year: -500, event: 'Foundation of Plassans at the mouth of the Auriel River.', scope: 'country' as const, scopeId: countryId },
      { era: 'Age of Crowns', year: -300, event: 'The Beausoleil dynasty unifies the coastal settlements into a kingdom.', scope: 'country' as const, scopeId: countryId },
      { era: 'Age of Crowns', year: -200, event: 'Construction of the Cathédrale Saint-Auriel begins.', scope: 'country' as const, scopeId: countryId },
      { era: 'Age of Storms', year: -50, event: 'The Great Storm ravages the coast. Plassans rebuilds with stone walls and deeper harbours.', scope: 'country' as const, scopeId: countryId },
      { era: 'Present Day', year: 0, event: 'The kingdom of Beausoleil endures, its golden coast a beacon of civilization on the western shore.', scope: 'country' as const, scopeId: countryId },
    ],
    meta: {
      author: 'Handcrafted',
      createdAt: Date.now(),
      lastModified: Date.now(),
      formatVersion: 2,
    },
  };

  return {
    format: 'oneparty-world',
    version: 2,
    exportedAt: Date.now(),
    universe,
  };
}

// ── Main ────────────────────────────────────────────────────────

const world = buildUniverse();
// Infinity is not valid JSON — use a replacer to encode it as a sentinel number
const json = JSON.stringify(world, (_key, value) => value === Infinity ? 999999 : value);
const outPath = join(__dirname, '..', 'public', 'worlds', 'ylem.oneparty.json');
writeFileSync(outPath, json);

const cellCount = world.universe.planes[0].inline!.continents[0].inline!.regions[0].inline!.countries[0].inline!.overworld.tiles.flat().length;
const sparseCount = world.universe.planes[0].inline!.continents[0].inline!.regions[0].inline!.countries[0].inline!.locationOverrides[0].handcraftedMap!.cells.length;
const npcCount = world.universe.planes[0].inline!.continents[0].inline!.regions[0].inline!.countries[0].inline!.locationOverrides[0].npcs!.length;
const fileSize = (Buffer.byteLength(json) / 1024).toFixed(1);

console.log(`✓ Ylem world generated → ${outPath}`);
console.log(`  Overworld: ${OW}×${OW} = ${cellCount} tiles`);
console.log(`  Plassans map: ${MAP_W}×${MAP_H}, ${sparseCount} handcrafted cells`);
console.log(`  NPCs: ${npcCount}`);
console.log(`  File size: ${fileSize} KB`);
