import type { BiomeType } from '@/types';
import type {
  OverworldTile,
  OverworldData,
  OverworldRegion,
  OverworldTerrain,
  OverworldHistoryEntry,
  SettlementType,
  GenerationCallback,
} from '@/types/overworld';
import { SeededRNG } from '@/utils/SeededRNG';
import { generateId } from '@/engine/IdGenerator';

// ── Name tables ─────────────────────────────────────────────────────

const WORLD_PREFIXES = [
  'Ael', 'Dor', 'Eld', 'Fae', 'Gal', 'Hel', 'Ith', 'Kal', 'Lor',
  'Mor', 'Nor', 'Ost', 'Quel', 'Rav', 'Syl', 'Thal', 'Urd', 'Val',
  'Wyr', 'Zeph', 'Ash', 'Bael', 'Cael', 'Drak', 'Fen', 'Grim',
];

const WORLD_SUFFIXES = [
  'anor', 'duin', 'gard', 'heim', 'indor', 'kar', 'mar', 'oth',
  'rim', 'thas', 'vain', 'wyn', 'zar', 'mund', 'thorn', 'reach',
];

const REGION_PREFIXES = [
  'Shadow', 'Iron', 'Storm', 'Silver', 'Dragon', 'Raven', 'Frost', 'Ember',
  'Thorn', 'Golden', 'Dark', 'Bright', 'Crimson', 'Ash', 'Stone', 'Wolf',
  'Oak', 'Moss', 'Mist', 'Dusk', 'Dawn', 'Star', 'Moon', 'Sun', 'Black',
  'White', 'Red', 'Green', 'Deep', 'High', 'Old', 'Wild', 'Hollow', 'Bone',
];

const REGION_SUFFIXES = [
  'haven', 'hold', 'dale', 'crest', 'hollow', 'peak', 'ford', 'march',
  'fell', 'keep', 'shire', 'vale', 'gate', 'watch', 'wood', 'field',
  'moor', 'glen', 'brook', 'ridge', 'reach', 'land', 'heim', 'mark',
];

const SETTLEMENT_PREFIXES = [
  'Iron', 'Storm', 'Raven', 'Silver', 'Thorn', 'Ember', 'Oak', 'Stone',
  'Frost', 'Dawn', 'Dusk', 'Moon', 'Wolf', 'Hawk', 'Bear', 'Stag',
  'River', 'Lake', 'Hill', 'Cliff', 'Sea', 'Bay', 'Marsh', 'Fen',
];

const VILLAGE_SUFFIXES = [
  'ton', 'bury', 'stead', 'ham', 'wick', 'ford', 'dale', 'by',
  'thorpe', 'cot', 'ling', 'well', 'bridge', 'field', 'worth',
];

const TOWN_SUFFIXES = [
  'haven', 'hold', 'gate', 'keep', 'port', 'watch', 'burgh',
  'cross', 'hollow', 'grove', 'vale', 'crest', 'march', 'stead',
];

const CITY_SUFFIXES = [
  'spire', 'crown', 'throne', 'citadel', 'bastion', 'summit',
];

const FORTRESS_NAMES = [
  'Bulwark', 'Rampart', 'Bastion', 'Redoubt', 'Stronghold', 'Garrison',
  'Watchtower', 'Sentinel', 'Ward', 'Aegis', 'Shield', 'Hammer',
];

const RUIN_ADJECTIVES = [
  'Forgotten', 'Sunken', 'Shattered', 'Fallen', 'Crumbling', 'Buried',
  'Lost', 'Forsaken', 'Silent', 'Hollow', 'Blighted', 'Withered',
];

const TEMPLE_DEITIES = [
  'the Dawn', 'the Void', 'Storms', 'the Harvest', 'the Deep',
  'the Moon', 'the Sun', 'Battle', 'Wisdom', 'the Wilds', 'the Dead',
  'Fortune', 'the Flame', 'Winter', 'the Stars',
];

// ── History templates ───────────────────────────────────────────────

const FOUNDING_EVENTS = [
  'settlers from across the sea founded',
  'a band of exiles established',
  'dwarven miners discovered the site of',
  'elven wayfarers planted the first trees of',
  'a wandering knight raised the banner over',
];

const DISASTER_EVENTS = [
  'a great plague swept through',
  'a terrible earthquake shook',
  'a dragon ravaged the lands near',
  'famine gripped the people of',
  'a magical catastrophe scarred',
];

const WAR_EVENTS = [
  'War erupted between %A and %B over contested borderlands.',
  'The armies of %A marched against %B in a bitter conflict.',
  '%A and %B clashed in a struggle that lasted generations.',
];

const DISCOVERY_EVENTS = [
  'prospectors in %R unearthed veins of mithril.',
  'scholars in %R deciphered an ancient prophecy.',
  'explorers discovered a portal to the Feywild near %R.',
  'miners in %R broke into a sealed dwarven vault.',
];

// ── Generator ───────────────────────────────────────────────────────

export class OverworldGenerator {
  private rng: SeededRNG;
  private width: number;
  private height: number;
  private elevation!: number[][];
  private temperature!: number[][];
  private moisture!: number[][];
  private tiles!: OverworldTile[][];

  constructor(seed: number, width: number, height: number) {
    this.rng = new SeededRNG(seed);
    this.width = width;
    this.height = height;
  }

  async generate(onProgress: GenerationCallback): Promise<OverworldData> {
    this.initArrays();

    await this.stepHeightmap(onProgress);
    await this.stepTemperature(onProgress);
    await this.stepMoisture(onProgress);
    await this.stepBiomes(onProgress);
    await this.stepRivers(onProgress);
    const regions = await this.stepRegions(onProgress);
    await this.stepSettlements(onProgress);
    this.stepNaming(regions, onProgress);
    const history = this.stepHistory(regions, onProgress);

    const worldName = this.rng.pick(WORLD_PREFIXES) + this.rng.pick(WORLD_SUFFIXES);

    onProgress('The world is complete.', 1);

    return {
      id: generateId(),
      name: worldName,
      seed: this.rng.getSeed(),
      width: this.width,
      height: this.height,
      tiles: this.tiles,
      regions,
      history,
      createdAt: Date.now(),
    };
  }

  // ── Initialization ──────────────────────────────────────────────

  private initArrays(): void {
    const w = this.width;
    const h = this.height;

    this.elevation = Array.from({ length: h }, () => new Array(w).fill(0));
    this.temperature = Array.from({ length: h }, () => new Array(w).fill(0));
    this.moisture = Array.from({ length: h }, () => new Array(w).fill(0));
    this.tiles = Array.from({ length: h }, () =>
      Array.from({ length: w }, (): OverworldTile => ({
        elevation: 0,
        temperature: 0,
        moisture: 0,
        biome: 'plains',
        terrain: 'plains',
        river: false,
        settlement: null,
        settlementName: null,
        discovered: false,
        regionId: '',
      })),
    );
  }

  // ── Step 1: Heightmap (Diamond-Square) ──────────────────────────

  private async stepHeightmap(cb: GenerationCallback): Promise<void> {
    cb('Raising the world from the void...', 0.02);
    await yieldThread();

    // Diamond-square needs a (2^n + 1) grid
    const size = nextPow2(Math.max(this.width, this.height)) + 1;
    const map = Array.from({ length: size }, () => new Array(size).fill(0));

    // Seed corners
    map[0][0] = this.rng.nextFloat(80, 180);
    map[0][size - 1] = this.rng.nextFloat(80, 180);
    map[size - 1][0] = this.rng.nextFloat(80, 180);
    map[size - 1][size - 1] = this.rng.nextFloat(80, 180);

    let step = size - 1;
    let roughness = 128;
    const decay = 0.58;

    while (step > 1) {
      const half = step >> 1;

      // Diamond step
      for (let y = half; y < size; y += step) {
        for (let x = half; x < size; x += step) {
          const avg = (
            map[y - half][x - half] +
            map[y - half][x + half] +
            map[y + half][x - half] +
            map[y + half][x + half]
          ) / 4;
          map[y][x] = avg + this.rng.nextFloat(-roughness, roughness);
        }
      }

      // Square step
      for (let y = 0; y < size; y += half) {
        for (let x = ((y / half) % 2 === 0 ? half : 0); x < size; x += step) {
          let sum = 0;
          let count = 0;
          if (y - half >= 0) { sum += map[y - half][x]; count++; }
          if (y + half < size) { sum += map[y + half][x]; count++; }
          if (x - half >= 0) { sum += map[y][x - half]; count++; }
          if (x + half < size) { sum += map[y][x + half]; count++; }
          map[y][x] = sum / count + this.rng.nextFloat(-roughness, roughness);
        }
      }

      roughness *= decay;
      step = half;
    }

    cb('Forming continents and ocean basins...', 0.08);
    await yieldThread();

    // Sample into our grid and normalize to 0-255
    let min = Infinity;
    let max = -Infinity;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const sy = Math.floor((y / this.height) * (size - 1));
        const sx = Math.floor((x / this.width) * (size - 1));
        const v = map[sy][sx];
        if (v < min) min = v;
        if (v > max) max = v;
        this.elevation[y][x] = v;
      }
    }

    const range = max - min || 1;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.elevation[y][x] = clamp(Math.floor(((this.elevation[y][x] - min) / range) * 255), 0, 255);
      }
    }

    // Push edges toward water for island-continent feel
    const cx = this.width / 2;
    const cy = this.height / 2;
    const maxDist = Math.sqrt(cx * cx + cy * cy);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const dx = (x - cx) / cx;
        const dy = (y - cy) / cy;
        const edgeDist = Math.sqrt(dx * dx + dy * dy);
        const falloff = Math.max(0, 1 - edgeDist * 1.2);
        this.elevation[y][x] = clamp(Math.floor(this.elevation[y][x] * (0.3 + 0.7 * falloff)), 0, 255);
        void maxDist;
      }
    }

    cb('Mountains rise and valleys form...', 0.14);
    await yieldThread();
  }

  // ── Step 2: Temperature ─────────────────────────────────────────

  private async stepTemperature(cb: GenerationCallback): Promise<void> {
    cb('Freezing the northern wastes...', 0.16);
    await yieldThread();

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        // Latitude gradient: poles are cold, equator is warm
        const latFactor = 1 - Math.abs(y - this.height / 2) / (this.height / 2);
        const baseTemp = 40 + latFactor * 180; // 40 at poles, 220 at equator

        // Altitude cooling
        const altCooling = this.elevation[y][x] * 0.3;

        // Random perturbation
        const noise = this.rng.nextFloat(-10, 10);

        this.temperature[y][x] = clamp(Math.floor(baseTemp - altCooling + noise), 0, 255);
      }
    }

    cb('Warming the equatorial lands...', 0.22);
    await yieldThread();
  }

  // ── Step 3: Moisture ────────────────────────────────────────────

  private async stepMoisture(cb: GenerationCallback): Promise<void> {
    cb('Brewing storms over the seas...', 0.26);
    await yieldThread();

    // Base moisture: multi-octave value noise
    const noiseGrid = this.generateValueNoise(4);

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.moisture[y][x] = clamp(Math.floor(noiseGrid[y][x] * 255), 0, 255);
      }
    }

    cb('Rain shadows form behind the peaks...', 0.30);
    await yieldThread();

    // Ocean adjacency moisture boost
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.elevation[y][x] >= 50) {
          // Check proximity to water
          const waterDist = this.distanceToWater(x, y, 8);
          if (waterDist < 8) {
            const boost = Math.floor(40 * (1 - waterDist / 8));
            this.moisture[y][x] = clamp(this.moisture[y][x] + boost, 0, 255);
          }
        }
      }
    }

    // Rain shadow: scan west-to-east, mountains block moisture
    for (let y = 0; y < this.height; y++) {
      let carriedMoisture = this.moisture[y][0];
      for (let x = 1; x < this.width; x++) {
        if (this.elevation[y][x] > 180) {
          // Mountain absorbs moisture
          carriedMoisture = Math.floor(carriedMoisture * 0.4);
        } else {
          carriedMoisture = Math.floor(carriedMoisture * 0.95 + this.moisture[y][x] * 0.05);
        }
        // Blend carried moisture with base
        this.moisture[y][x] = clamp(
          Math.floor(this.moisture[y][x] * 0.6 + carriedMoisture * 0.4),
          0, 255,
        );
      }
    }

    cb('Saturating the lowlands...', 0.34);
    await yieldThread();
  }

  // ── Step 4: Biome Classification ────────────────────────────────

  private async stepBiomes(cb: GenerationCallback): Promise<void> {
    cb('Planting the great forests...', 0.36);
    await yieldThread();

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const elev = this.elevation[y][x];
        const temp = this.temperature[y][x];
        const moist = this.moisture[y][x];
        const jitter = this.rng.nextInt(-5, 5);

        const { biome, terrain } = classifyBiome(elev, temp + jitter, moist + jitter);

        this.tiles[y][x].elevation = elev;
        this.tiles[y][x].temperature = temp;
        this.tiles[y][x].moisture = moist;
        this.tiles[y][x].biome = biome;
        this.tiles[y][x].terrain = terrain;
      }
    }

    cb('Spreading deserts across the arid lands...', 0.40);
    await yieldThread();

    cb('Swamps fester in the humid lowlands...', 0.44);
    await yieldThread();
  }

  // ── Step 5: Rivers ──────────────────────────────────────────────

  private async stepRivers(cb: GenerationCallback): Promise<void> {
    cb('Springs emerge from the mountain heights...', 0.46);
    await yieldThread();

    const riverCount = Math.floor((this.width * this.height) / 400);
    const maxRivers = Math.min(riverCount, 100);

    // Collect candidate sources: high elevation land tiles
    const candidates: { x: number; y: number; elev: number }[] = [];
    for (let y = 2; y < this.height - 2; y++) {
      for (let x = 2; x < this.width - 2; x++) {
        const elev = this.elevation[y][x];
        if (elev > 140 && elev < 220) {
          candidates.push({ x, y, elev });
        }
      }
    }

    // Sort by elevation descending and pick sources
    candidates.sort((a, b) => b.elev - a.elev);
    const sources = this.rng.shuffle(candidates.slice(0, maxRivers * 3)).slice(0, maxRivers);

    cb('Rivers carve their paths to the sea...', 0.50);
    await yieldThread();

    for (const source of sources) {
      this.traceRiver(source.x, source.y);
    }

    // Moisture boost near rivers
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.tiles[y][x].river) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const ny = y + dy;
              const nx = x + dx;
              if (ny >= 0 && ny < this.height && nx >= 0 && nx < this.width) {
                this.moisture[ny][nx] = clamp(this.moisture[ny][nx] + 20, 0, 255);
                this.tiles[ny][nx].moisture = this.moisture[ny][nx];
              }
            }
          }
        }
      }
    }

    cb('Tributaries join the great waterways...', 0.54);
    await yieldThread();
  }

  private traceRiver(startX: number, startY: number): void {
    let x = startX;
    let y = startY;
    const visited = new Set<string>();
    const path: { x: number; y: number }[] = [];

    for (let steps = 0; steps < 500; steps++) {
      const key = `${x},${y}`;
      if (visited.has(key)) break;
      visited.add(key);
      path.push({ x, y });

      // Reached water or existing river
      const tile = this.tiles[y][x];
      if (tile.terrain === 'deep_water' || tile.terrain === 'shallow_water') break;
      if (tile.river && steps > 0) break;

      // Flow to lowest neighbor
      let lowestElev = this.elevation[y][x];
      let nextX = x;
      let nextY = y;

      for (const [dx, dy] of DIRS_8) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) continue;
        const nElev = this.elevation[ny][nx];
        if (nElev < lowestElev) {
          lowestElev = nElev;
          nextX = nx;
          nextY = ny;
        }
      }

      // Stuck — can't flow
      if (nextX === x && nextY === y) break;

      x = nextX;
      y = nextY;
    }

    // Only mark if river is long enough
    if (path.length >= 5) {
      for (const p of path) {
        this.tiles[p.y][p.x].river = true;
      }
    }
  }

  // ── Step 6: Regions (Voronoi-style) ─────────────────────────────

  private async stepRegions(cb: GenerationCallback): Promise<OverworldRegion[]> {
    cb('Dividing the lands into realms...', 0.56);
    await yieldThread();

    const area = this.width * this.height;
    const regionCount = clamp(Math.floor(area / 200), 8, 60);

    // Seed region centers on land tiles
    const landTiles: { x: number; y: number }[] = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (isLandTerrain(this.tiles[y][x].terrain)) {
          landTiles.push({ x, y });
        }
      }
    }

    const centers = this.rng.shuffle(landTiles).slice(0, regionCount);
    const regionIds = centers.map(() => generateId());

    cb('Borders crystallize between kingdoms...', 0.62);
    await yieldThread();

    // Assign each land tile to nearest region center
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (!isLandTerrain(this.tiles[y][x].terrain)) {
          this.tiles[y][x].regionId = '';
          continue;
        }

        let bestDist = Infinity;
        let bestIdx = 0;
        for (let i = 0; i < centers.length; i++) {
          const dx = x - centers[i].x;
          const dy = y - centers[i].y;
          const dist = dx * dx + dy * dy; // squared is fine for comparison
          if (dist < bestDist) {
            bestDist = dist;
            bestIdx = i;
          }
        }
        this.tiles[y][x].regionId = regionIds[bestIdx];
      }
    }

    cb('The map of the world takes shape...', 0.68);
    await yieldThread();

    // Build region objects
    const biomeCounts = new Map<string, Map<BiomeType, number>>();
    const tileCounts = new Map<string, number>();
    for (const id of regionIds) {
      biomeCounts.set(id, new Map());
      tileCounts.set(id, 0);
    }

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const rid = this.tiles[y][x].regionId;
        if (!rid) continue;
        tileCounts.set(rid, (tileCounts.get(rid) ?? 0) + 1);
        const bc = biomeCounts.get(rid)!;
        bc.set(this.tiles[y][x].biome, (bc.get(this.tiles[y][x].biome) ?? 0) + 1);
      }
    }

    const regions: OverworldRegion[] = [];
    for (let i = 0; i < centers.length; i++) {
      const id = regionIds[i];
      const tc = tileCounts.get(id) ?? 0;
      if (tc === 0) continue;

      // Dominant biome
      const bc = biomeCounts.get(id)!;
      let dominantBiome: BiomeType = 'plains';
      let maxCount = 0;
      for (const [biome, count] of bc) {
        if (count > maxCount) {
          maxCount = count;
          dominantBiome = biome;
        }
      }

      regions.push({
        id,
        name: '', // filled in naming step
        biome: dominantBiome,
        centerX: centers[i].x,
        centerY: centers[i].y,
        tileCount: tc,
      });
    }

    return regions;
  }

  // ── Step 7: Settlements ─────────────────────────────────────────

  private async stepSettlements(cb: GenerationCallback): Promise<void> {
    cb('The first settlers survey the land...', 0.70);
    await yieldThread();

    // Score all land tiles for habitability
    const scored: { x: number; y: number; score: number }[] = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const tile = this.tiles[y][x];
        if (!isLandTerrain(tile.terrain)) continue;
        if (tile.terrain === 'mountain' || tile.terrain === 'peak') continue;

        let score = tile.moisture * 0.3;
        score += (255 - Math.abs(tile.temperature - 140)) * 0.3;
        score -= tile.elevation * 0.1;

        // River adjacency bonus
        if (this.hasAdjacentRiver(x, y)) score += 50;

        // Coast adjacency bonus
        if (this.hasAdjacentWater(x, y)) score += 30;

        // Flat terrain bonus
        if (tile.terrain === 'plains' || tile.terrain === 'forest') score += 15;

        scored.push({ x, y, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);

    // Calculate settlement counts based on world size
    const area = this.width * this.height;
    const scaleFactor = area / (64 * 64); // 1x for small

    const cityCount = clamp(Math.floor(1 + scaleFactor * 0.5), 1, 3);
    const townCount = clamp(Math.floor(3 + scaleFactor * 1.5), 3, 8);
    const villageCount = clamp(Math.floor(8 + scaleFactor * 4), 8, 25);
    const ruinsCount = clamp(Math.floor(2 + scaleFactor * 1), 2, 8);
    const templeCount = clamp(Math.floor(1 + scaleFactor * 0.5), 1, 4);
    const fortressCount = clamp(Math.floor(1 + scaleFactor * 0.5), 1, 3);

    const placed: { x: number; y: number }[] = [];

    const placeSettlements = (
      type: SettlementType,
      count: number,
      minDist: number,
    ): void => {
      let n = 0;
      for (const candidate of scored) {
        if (n >= count) break;
        if (this.tooCloseToExisting(candidate.x, candidate.y, placed, minDist)) continue;

        this.tiles[candidate.y][candidate.x].settlement = type;
        placed.push({ x: candidate.x, y: candidate.y });
        n++;
      }
    };

    cb('A great city rises on the fertile plains...', 0.74);
    placeSettlements('city', cityCount, 20);

    cb('Towns spring up along trade routes...', 0.76);
    placeSettlements('town', townCount, 10);

    cb('Villages dot the countryside...', 0.78);
    placeSettlements('village', villageCount, 5);

    await yieldThread();

    // Ruins: lower habitability, more random placement
    cb('Ancient ruins dot the wilderness...', 0.80);
    const ruinCandidates = this.rng.shuffle(scored.slice(Math.floor(scored.length * 0.3)));
    let ruinsPlaced = 0;
    for (const c of ruinCandidates) {
      if (ruinsPlaced >= ruinsCount) break;
      if (this.tooCloseToExisting(c.x, c.y, placed, 6)) continue;
      this.tiles[c.y][c.x].settlement = 'ruins';
      placed.push({ x: c.x, y: c.y });
      ruinsPlaced++;
    }

    // Temples: near mountains or forests
    cb('Temples are raised to forgotten gods...', 0.82);
    const templeCandidates = scored.filter(c => {
      const t = this.tiles[c.y][c.x];
      return t.terrain === 'hills' || t.terrain === 'forest' || t.terrain === 'dense_forest';
    });
    let templesPlaced = 0;
    for (const c of this.rng.shuffle(templeCandidates)) {
      if (templesPlaced >= templeCount) break;
      if (this.tooCloseToExisting(c.x, c.y, placed, 8)) continue;
      this.tiles[c.y][c.x].settlement = 'temple';
      placed.push({ x: c.x, y: c.y });
      templesPlaced++;
    }

    // Fortresses: near region borders
    cb('Fortresses guard the borders...', 0.84);
    let fortPlaced = 0;
    for (const c of scored) {
      if (fortPlaced >= fortressCount) break;
      if (this.tooCloseToExisting(c.x, c.y, placed, 12)) continue;
      // Check if near a region border
      if (this.isNearRegionBorder(c.x, c.y)) {
        this.tiles[c.y][c.x].settlement = 'fortress';
        placed.push({ x: c.x, y: c.y });
        fortPlaced++;
      }
    }

    cb('The realms are settled...', 0.86);
    await yieldThread();
  }

  // ── Step 8: Naming ──────────────────────────────────────────────

  private stepNaming(regions: OverworldRegion[], cb: GenerationCallback): void {
    cb('The sages record the names of the lands...', 0.88);

    // Name regions
    const usedRegionNames = new Set<string>();
    for (const region of regions) {
      let name: string;
      do {
        name = this.rng.pick(REGION_PREFIXES) + this.rng.pick(REGION_SUFFIXES);
      } while (usedRegionNames.has(name));
      usedRegionNames.add(name);
      region.name = name;
    }

    // Name settlements
    cb('The cartographers label the settlements...', 0.90);
    const usedSettlementNames = new Set<string>();

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const tile = this.tiles[y][x];
        if (!tile.settlement) continue;

        let name: string;
        do {
          name = this.generateSettlementName(tile.settlement);
        } while (usedSettlementNames.has(name));
        usedSettlementNames.add(name);
        tile.settlementName = name;
      }
    }
  }

  private generateSettlementName(type: SettlementType): string {
    const prefix = this.rng.pick(SETTLEMENT_PREFIXES);
    switch (type) {
      case 'village':
        return prefix + this.rng.pick(VILLAGE_SUFFIXES);
      case 'town':
        return prefix + this.rng.pick(TOWN_SUFFIXES);
      case 'city':
        return prefix + this.rng.pick(CITY_SUFFIXES);
      case 'fortress':
        return `${prefix} ${this.rng.pick(FORTRESS_NAMES)}`;
      case 'ruins':
        return `The ${this.rng.pick(RUIN_ADJECTIVES)} ${prefix}`;
      case 'temple':
        return `Temple of ${this.rng.pick(TEMPLE_DEITIES)}`;
    }
  }

  // ── Step 9: History ─────────────────────────────────────────────

  private stepHistory(regions: OverworldRegion[], cb: GenerationCallback): OverworldHistoryEntry[] {
    cb('Recording the annals of history...', 0.92);

    const history: OverworldHistoryEntry[] = [];
    const eventCount = clamp(Math.floor(5 + regions.length * 0.5), 5, 20);

    // Gather settlement names for history
    const settlements: string[] = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.tiles[y][x].settlementName) {
          settlements.push(this.tiles[y][x].settlementName!);
        }
      }
    }

    let year = this.rng.nextInt(100, 500);

    for (let i = 0; i < eventCount; i++) {
      year += this.rng.nextInt(10, 200);
      const roll = this.rng.nextFloat(0, 1);

      let event: string;

      if (roll < 0.3 && settlements.length > 0) {
        // Founding
        const settlement = this.rng.pick(settlements);
        event = `In the year ${year}, ${this.rng.pick(FOUNDING_EVENTS)} ${settlement}.`;
      } else if (roll < 0.5 && regions.length > 0) {
        // Disaster
        const region = this.rng.pick(regions);
        event = `In the year ${year}, ${this.rng.pick(DISASTER_EVENTS)} ${region.name}.`;
      } else if (roll < 0.7 && regions.length >= 2) {
        // War
        const shuffled = this.rng.shuffle([...regions]);
        const template = this.rng.pick(WAR_EVENTS);
        event = `In the year ${year}: ${template
          .replace('%A', shuffled[0].name)
          .replace('%B', shuffled[1].name)}`;
      } else if (regions.length > 0) {
        // Discovery
        const region = this.rng.pick(regions);
        const template = this.rng.pick(DISCOVERY_EVENTS);
        event = `In the year ${year}, ${template.replace('%R', region.name)}`;
      } else {
        continue;
      }

      history.push({ year, event });
    }

    history.sort((a, b) => a.year - b.year);

    cb('The present age begins.', 0.96);
    return history;
  }

  // ── Helpers ─────────────────────────────────────────────────────

  private generateValueNoise(octaves: number): number[][] {
    const result = Array.from({ length: this.height }, () =>
      new Array(this.width).fill(0),
    );

    let amplitude = 1;
    let totalAmplitude = 0;

    for (let oct = 0; oct < octaves; oct++) {
      const freq = 1 << (oct + 2); // 4, 8, 16, 32
      const gridW = Math.ceil(this.width / freq) + 2;
      const gridH = Math.ceil(this.height / freq) + 2;

      // Random grid points
      const grid = Array.from({ length: gridH }, () =>
        Array.from({ length: gridW }, () => this.rng.nextFloat(0, 1)),
      );

      // Bilinear interpolation
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          const gx = x / freq;
          const gy = y / freq;
          const x0 = Math.floor(gx);
          const y0 = Math.floor(gy);
          const fx = gx - x0;
          const fy = gy - y0;

          const v00 = grid[y0][x0];
          const v10 = grid[y0][x0 + 1];
          const v01 = grid[y0 + 1][x0];
          const v11 = grid[y0 + 1][x0 + 1];

          const top = v00 + (v10 - v00) * fx;
          const bot = v01 + (v11 - v01) * fx;
          const val = top + (bot - top) * fy;

          result[y][x] += val * amplitude;
        }
      }

      totalAmplitude += amplitude;
      amplitude *= 0.5;
    }

    // Normalize to 0-1
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        result[y][x] /= totalAmplitude;
      }
    }

    return result;
  }

  private distanceToWater(x: number, y: number, maxDist: number): number {
    for (let d = 1; d <= maxDist; d++) {
      for (let dy = -d; dy <= d; dy++) {
        for (let dx = -d; dx <= d; dx++) {
          if (Math.abs(dx) !== d && Math.abs(dy) !== d) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) continue;
          if (this.elevation[ny][nx] < 50) return d;
        }
      }
    }
    return maxDist;
  }

  private hasAdjacentRiver(x: number, y: number): boolean {
    for (const [dx, dy] of DIRS_8) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
        if (this.tiles[ny][nx].river) return true;
      }
    }
    return false;
  }

  private hasAdjacentWater(x: number, y: number): boolean {
    for (const [dx, dy] of DIRS_8) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
        const t = this.tiles[ny][nx].terrain;
        if (t === 'deep_water' || t === 'shallow_water') return true;
      }
    }
    return false;
  }

  private tooCloseToExisting(
    x: number, y: number,
    existing: { x: number; y: number }[],
    minDist: number,
  ): boolean {
    const minDistSq = minDist * minDist;
    for (const e of existing) {
      const dx = x - e.x;
      const dy = y - e.y;
      if (dx * dx + dy * dy < minDistSq) return true;
    }
    return false;
  }

  private isNearRegionBorder(x: number, y: number): boolean {
    const myRegion = this.tiles[y][x].regionId;
    if (!myRegion) return false;
    for (const [dx, dy] of DIRS_8) {
      const nx = x + dx * 2;
      const ny = y + dy * 2;
      if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
        const otherRegion = this.tiles[ny][nx].regionId;
        if (otherRegion && otherRegion !== myRegion) return true;
      }
    }
    return false;
  }
}

// ── Pure helpers ───────────────────────────────────────────────────

const DIRS_8: [number, number][] = [
  [0, -1], [1, -1], [1, 0], [1, 1],
  [0, 1], [-1, 1], [-1, 0], [-1, -1],
];

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

function yieldThread(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function isLandTerrain(t: OverworldTerrain): boolean {
  return t !== 'deep_water' && t !== 'shallow_water';
}

function classifyBiome(
  elev: number,
  temp: number,
  moist: number,
): { biome: BiomeType; terrain: OverworldTerrain } {
  // Water
  if (elev < 30) return { biome: 'coast', terrain: 'deep_water' };
  if (elev < 50) return { biome: 'coast', terrain: 'shallow_water' };
  if (elev < 60) return { biome: 'coast', terrain: 'beach' };

  // High altitude
  if (elev > 220) return { biome: 'mountain', terrain: 'peak' };
  if (elev > 190) return { biome: 'mountain', terrain: 'mountain' };
  if (elev > 160) return { biome: 'mountain', terrain: 'hills' };

  // Land biomes based on temperature and moisture
  // Cold
  if (temp < 60) {
    if (moist > 120) return { biome: 'tundra', terrain: 'snow' };
    return { biome: 'tundra', terrain: 'tundra' };
  }

  // Cool
  if (temp < 100) {
    if (moist > 150) return { biome: 'forest', terrain: 'dense_forest' };
    if (moist > 80) return { biome: 'forest', terrain: 'forest' };
    return { biome: 'plains', terrain: 'plains' };
  }

  // Temperate
  if (temp < 180) {
    if (moist > 180) return { biome: 'forest', terrain: 'dense_forest' };
    if (moist > 100) return { biome: 'forest', terrain: 'forest' };
    if (moist > 40) return { biome: 'plains', terrain: 'plains' };
    return { biome: 'desert', terrain: 'desert' };
  }

  // Hot
  if (moist > 160) return { biome: 'swamp', terrain: 'swamp' };
  if (moist > 80) return { biome: 'plains', terrain: 'plains' };
  return { biome: 'desert', terrain: 'desert' };
}
