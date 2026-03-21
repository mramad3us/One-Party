import type { CellTerrain, CellFeature } from '@/types';
import type { Tileset, TilesetRenderContext } from './Tileset';
import { getWallChar } from './Tileset';

// ── Color Palettes ────────────────────────────────────────────

type RGB = [number, number, number];

const TERRAIN_COLORS: Record<CellTerrain, { base: RGB; alt: RGB; accent: RGB }> = {
  floor:  { base: [45, 40, 35],   alt: [50, 44, 38],   accent: [55, 48, 42] },
  wall:   { base: [70, 65, 58],   alt: [80, 74, 66],   accent: [60, 55, 48] },
  grass:  { base: [30, 85, 35],   alt: [25, 75, 30],   accent: [40, 100, 45] },
  water:  { base: [20, 80, 160],  alt: [30, 90, 170],  accent: [15, 70, 140] },
  lava:   { base: [200, 60, 10],  alt: [220, 80, 20],  accent: [180, 40, 5] },
  stone:  { base: [90, 85, 80],   alt: [100, 95, 88],  accent: [80, 75, 70] },
  ice:    { base: [160, 200, 220],alt: [170, 210, 230], accent: [140, 185, 210] },
  mud:    { base: [90, 60, 30],   alt: [100, 68, 35],  accent: [80, 52, 25] },
  sand:   { base: [190, 170, 100],alt: [200, 180, 110],accent: [180, 160, 90] },
  wood:   { base: [120, 80, 40],  alt: [130, 88, 45],  accent: [110, 72, 35] },
  pit:    { base: [8, 6, 4],      alt: [12, 10, 8],    accent: [5, 4, 3] },
};

const FEATURE_COLORS: Record<CellFeature, { primary: RGB; secondary: RGB; bg: RGB }> = {
  door:        { primary: [200, 140, 40],  secondary: [160, 110, 30],  bg: [80, 55, 20] },
  door_locked: { primary: [200, 50, 50],   secondary: [160, 40, 40],   bg: [80, 20, 20] },
  chest:       { primary: [240, 200, 40],  secondary: [200, 160, 30],  bg: [80, 65, 15] },
  trap:        { primary: [220, 40, 40],   secondary: [180, 30, 30],   bg: [60, 15, 15] },
  stairs_up:   { primary: [200, 210, 220], secondary: [150, 160, 170], bg: [30, 50, 80] },
  stairs_down: { primary: [200, 210, 220], secondary: [150, 160, 170], bg: [30, 50, 80] },
  fountain:    { primary: [40, 180, 240],  secondary: [30, 140, 200],  bg: [15, 50, 80] },
  fire:        { primary: [255, 140, 20],  secondary: [255, 80, 10],   bg: [80, 30, 5] },
  altar:       { primary: [180, 80, 240],  secondary: [140, 60, 200],  bg: [50, 20, 80] },
  pillar:      { primary: [160, 155, 145], secondary: [130, 125, 115], bg: [70, 68, 62] },
  tree:        { primary: [50, 120, 40],   secondary: [100, 70, 30],   bg: [20, 45, 15] },
  rock:        { primary: [120, 115, 108], secondary: [95, 90, 82],    bg: [55, 52, 48] },
};

// ── Helper: blend two colors ──────────────────────────────────

function blend(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.floor(a[0] + (b[0] - a[0]) * t),
    Math.floor(a[1] + (b[1] - a[1]) * t),
    Math.floor(a[2] + (b[2] - a[2]) * t),
  ];
}

function rgb(c: RGB, dim = 1): string {
  return `rgb(${Math.floor(c[0] * dim)},${Math.floor(c[1] * dim)},${Math.floor(c[2] * dim)})`;
}

// ── Fantasy Tileset ───────────────────────────────────────────

export class FantasyTileset implements Tileset {
  readonly name = 'Fantasy';
  readonly id = 'fantasy';
  readonly squareCells = true;
  readonly baseCellSize = 20;

  renderTerrain(rc: TilesetRenderContext, terrain: CellTerrain): void {
    const { ctx, px, py, cw, ch, gx, gy, hash, grid, dim } = rc;
    const colors = TERRAIN_COLORS[terrain] ?? TERRAIN_COLORS.floor;

    // Pick a subtle variation based on hash
    const variation = (hash % 7) / 7;
    const baseColor = blend(colors.base, colors.alt, variation);

    // Fill base
    ctx.fillStyle = rgb(baseColor, dim);
    ctx.fillRect(px, py, cw, ch);

    // Terrain-specific decorations
    switch (terrain) {
      case 'wall':
        this.drawWall(rc, grid, gx, gy, baseColor);
        break;
      case 'grass':
        this.drawGrass(rc, baseColor, colors.accent, hash);
        break;
      case 'water':
        this.drawWater(rc, baseColor, colors.accent, hash);
        break;
      case 'lava':
        this.drawLava(rc, baseColor, colors.accent, hash);
        break;
      case 'ice':
        this.drawIce(rc, baseColor, colors.accent, hash);
        break;
      case 'sand':
        this.drawSand(rc, baseColor, colors.accent, hash);
        break;
      case 'mud':
        this.drawMud(rc, baseColor, colors.accent, hash);
        break;
      case 'stone':
        this.drawStone(rc, baseColor, colors.accent, hash);
        break;
      case 'wood':
        this.drawWood(rc, baseColor, colors.accent, hash);
        break;
      case 'floor':
        this.drawFloor(rc, baseColor, colors.accent, hash);
        break;
      case 'pit':
        this.drawPit(rc, baseColor);
        break;
    }
  }

  renderFeature(rc: TilesetRenderContext, feature: CellFeature, _terrain: CellTerrain): void {
    const { ctx, px, py, cw, ch, dim } = rc;
    const colors = FEATURE_COLORS[feature];
    if (!colors) return;

    // Feature background
    ctx.fillStyle = rgb(colors.bg, dim);
    ctx.fillRect(px, py, cw, ch);

    switch (feature) {
      case 'door':
      case 'door_locked':
        this.drawDoor(rc, colors.primary, colors.secondary, feature === 'door_locked');
        break;
      case 'chest':
        this.drawChest(rc, colors.primary, colors.secondary);
        break;
      case 'trap':
        this.drawTrap(rc, colors.primary, colors.secondary);
        break;
      case 'stairs_up':
        this.drawStairs(rc, colors.primary, colors.secondary, true);
        break;
      case 'stairs_down':
        this.drawStairs(rc, colors.primary, colors.secondary, false);
        break;
      case 'fountain':
        this.drawFountain(rc, colors.primary, colors.secondary);
        break;
      case 'fire':
        this.drawFire(rc, colors.primary, colors.secondary);
        break;
      case 'altar':
        this.drawAltar(rc, colors.primary, colors.secondary);
        break;
      case 'pillar':
        this.drawPillar(rc, colors.primary, colors.secondary);
        break;
      case 'tree':
        this.drawTree(rc, colors.primary, colors.secondary);
        break;
      case 'rock':
        this.drawRock(rc, colors.primary, colors.secondary);
        break;
    }
  }

  renderEntity(
    rc: TilesetRenderContext,
    symbol: string,
    color: string,
    isPlayer: boolean,
    isAlly: boolean,
  ): void {
    const { ctx, px, py, cw, ch } = rc;
    const cx = px + cw / 2;
    const cy = py + ch / 2;
    const r = Math.min(cw, ch) * 0.38;

    // Dark background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(px, py, cw, ch);

    let c = color;
    if (isPlayer) c = '#ffffff';
    else if (isAlly) c = '#44aaff';

    // Filled circle for the entity
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = c;
    ctx.fill();

    // Symbol on top
    ctx.fillStyle = '#0a0a0a';
    ctx.font = `bold ${Math.floor(Math.min(cw, ch) * 0.55)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(symbol, cx, cy);
  }

  // ── Terrain Renderers ─────────────────────────────────────

  private drawWall(rc: TilesetRenderContext, grid: import('./Grid').Grid, gx: number, gy: number, base: RGB): void {
    const { ctx, px, py, cw, ch, dim } = rc;
    const wallChar = getWallChar(grid, gx, gy);

    // Raised stone look
    const highlight = blend(base, [180, 175, 165], 0.3);
    const shadow = blend(base, [20, 18, 15], 0.4);

    // Top/left highlight edge
    ctx.fillStyle = rgb(highlight, dim);
    ctx.fillRect(px, py, cw, 2);
    ctx.fillRect(px, py, 2, ch);

    // Bottom/right shadow edge
    ctx.fillStyle = rgb(shadow, dim);
    ctx.fillRect(px, py + ch - 2, cw, 2);
    ctx.fillRect(px + cw - 2, py, 2, ch);

    // Mortar lines based on connectivity
    ctx.fillStyle = rgb(shadow, dim * 0.7);
    if (wallChar === '\u2501' || wallChar === '\u254B' || wallChar === '\u2533' || wallChar === '\u253B' || wallChar === '\u2523' || wallChar === '\u252B') {
      // Horizontal connection — draw horizontal mortar
      ctx.fillRect(px, py + Math.floor(ch * 0.5), cw, 1);
    }
    if (wallChar === '\u2503' || wallChar === '\u254B' || wallChar === '\u2533' || wallChar === '\u253B' || wallChar === '\u2523' || wallChar === '\u252B') {
      // Vertical connection — draw vertical mortar
      ctx.fillRect(px + Math.floor(cw * 0.5), py, 1, ch);
    }
  }

  private drawGrass(rc: TilesetRenderContext, _base: RGB, accent: RGB, hash: number): void {
    const { ctx, px, py, cw, ch, dim } = rc;

    // Grass blades — 3-5 small line marks
    const count = 2 + (hash % 4);
    ctx.strokeStyle = rgb(accent, dim);
    ctx.lineWidth = 1;
    for (let i = 0; i < count; i++) {
      const bx = px + ((hash * (i + 3) * 7) % cw);
      const by = py + ((hash * (i + 5) * 11) % ch);
      const h = 2 + ((hash * (i + 1)) % 4);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + ((i % 2) ? 1 : -1), by - h);
      ctx.stroke();
    }

    // Small dot variation
    if (hash % 5 === 0) {
      ctx.fillStyle = rgb(blend(accent, [60, 130, 50], 0.5), dim);
      ctx.fillRect(px + (hash % (cw - 2)), py + ((hash * 3) % (ch - 2)), 2, 2);
    }
  }

  private drawWater(rc: TilesetRenderContext, _base: RGB, accent: RGB, hash: number): void {
    const { ctx, px, py, cw, ch, dim } = rc;

    // Wavelet pattern — horizontal streaks
    const waveY = py + (hash % Math.max(1, ch - 4)) + 2;
    ctx.fillStyle = rgb(accent, dim * 0.6);
    ctx.fillRect(px + 2, waveY, cw - 4, 1);

    // Light reflection dot
    if (hash % 4 === 0) {
      ctx.fillStyle = rgb([120, 180, 240], dim * 0.5);
      ctx.fillRect(
        px + (hash % Math.max(1, cw - 3)),
        py + ((hash * 7) % Math.max(1, ch - 3)),
        2, 1,
      );
    }
  }

  private drawLava(rc: TilesetRenderContext, _base: RGB, _accent: RGB, hash: number): void {
    const { ctx, px, py, cw, ch, dim } = rc;

    // Bright hot spots
    const spotX = px + (hash % Math.max(1, cw - 4)) + 1;
    const spotY = py + ((hash * 3) % Math.max(1, ch - 4)) + 1;
    ctx.fillStyle = rgb([255, 160, 30], dim * 0.7);
    ctx.fillRect(spotX, spotY, 3, 2);

    // Dark crust cracks
    if (hash % 3 === 0) {
      ctx.fillStyle = rgb([100, 25, 5], dim);
      ctx.fillRect(px + ((hash * 7) % cw), py, 1, ch);
    }
  }

  private drawIce(rc: TilesetRenderContext, _base: RGB, _accent: RGB, hash: number): void {
    const { ctx, px, py, cw, ch, dim } = rc;

    // Crack lines
    if (hash % 3 === 0) {
      ctx.strokeStyle = rgb([200, 230, 250], dim * 0.3);
      ctx.lineWidth = 1;
      ctx.beginPath();
      const sx = px + (hash % cw);
      ctx.moveTo(sx, py);
      ctx.lineTo(sx + ((hash % 5) - 2), py + ch);
      ctx.stroke();
    }

    // Shine spot
    if (hash % 5 === 0) {
      ctx.fillStyle = rgb([220, 240, 255], dim * 0.4);
      ctx.fillRect(
        px + (hash % Math.max(1, cw - 2)),
        py + ((hash * 3) % Math.max(1, ch - 2)),
        2, 2,
      );
    }
  }

  private drawSand(rc: TilesetRenderContext, _base: RGB, accent: RGB, hash: number): void {
    const { ctx, px, py, cw, ch, dim } = rc;

    // Small grain dots
    const count = 1 + (hash % 3);
    for (let i = 0; i < count; i++) {
      const dx = (hash * (i + 2) * 13) % cw;
      const dy = (hash * (i + 3) * 17) % ch;
      ctx.fillStyle = rgb(accent, dim * 0.6);
      ctx.fillRect(px + dx, py + dy, 1, 1);
    }
  }

  private drawMud(rc: TilesetRenderContext, base: RGB, _accent: RGB, hash: number): void {
    const { ctx, px, py, cw, ch, dim } = rc;

    // Wet patches
    if (hash % 3 === 0) {
      ctx.fillStyle = rgb(blend(base, [60, 40, 20], 0.3), dim);
      const sz = 2 + (hash % 3);
      ctx.fillRect(
        px + (hash % Math.max(1, cw - sz)),
        py + ((hash * 7) % Math.max(1, ch - sz)),
        sz, sz,
      );
    }
  }

  private drawStone(rc: TilesetRenderContext, base: RGB, accent: RGB, hash: number): void {
    const { ctx, px, py, cw, ch, dim } = rc;

    // Subtle crack
    if (hash % 4 === 0) {
      ctx.fillStyle = rgb(blend(base, [50, 48, 44], 0.4), dim);
      ctx.fillRect(px + (hash % cw), py + 1, 1, ch - 2);
    }

    // Pebble dot
    if (hash % 3 === 0) {
      ctx.fillStyle = rgb(accent, dim * 0.7);
      ctx.fillRect(
        px + ((hash * 3) % Math.max(1, cw - 2)),
        py + ((hash * 5) % Math.max(1, ch - 2)),
        2, 1,
      );
    }
  }

  private drawWood(rc: TilesetRenderContext, base: RGB, accent: RGB, hash: number): void {
    const { ctx, px, py, cw, ch, dim } = rc;

    // Wood grain — horizontal lines
    const lineY = py + (hash % Math.max(1, ch - 2)) + 1;
    ctx.fillStyle = rgb(blend(base, accent, 0.3), dim * 0.7);
    ctx.fillRect(px, lineY, cw, 1);

    // Knot
    if (hash % 7 === 0) {
      ctx.fillStyle = rgb(blend(base, [80, 50, 25], 0.5), dim);
      ctx.fillRect(
        px + (hash % Math.max(1, cw - 3)) + 1,
        py + ((hash * 3) % Math.max(1, ch - 3)) + 1,
        2, 2,
      );
    }
  }

  private drawFloor(rc: TilesetRenderContext, base: RGB, accent: RGB, hash: number): void {
    const { ctx, px, py, cw, ch, dim } = rc;

    // Stone tile grid lines
    ctx.fillStyle = rgb(blend(base, [30, 28, 24], 0.3), dim);
    ctx.fillRect(px + cw - 1, py, 1, ch);
    ctx.fillRect(px, py + ch - 1, cw, 1);

    // Occasional scuff mark
    if (hash % 8 === 0) {
      ctx.fillStyle = rgb(accent, dim * 0.4);
      ctx.fillRect(
        px + ((hash * 3) % Math.max(1, cw - 3)) + 1,
        py + ((hash * 5) % Math.max(1, ch - 2)) + 1,
        2, 1,
      );
    }
  }

  private drawPit(rc: TilesetRenderContext, _base: RGB): void {
    const { ctx, px, py, cw, ch, dim } = rc;

    // Dark gradient edge
    ctx.fillStyle = rgb([20, 18, 15], dim * 0.3);
    ctx.fillRect(px, py, cw, 2);
    ctx.fillRect(px, py, 2, ch);
    ctx.fillRect(px + cw - 2, py, 2, ch);
    ctx.fillRect(px, py + ch - 2, cw, 2);
  }

  // ── Feature Renderers ─────────────────────────────────────

  private drawDoor(rc: TilesetRenderContext, primary: RGB, secondary: RGB, locked: boolean): void {
    const { ctx, px, py, cw, ch, dim } = rc;
    const inset = Math.max(2, Math.floor(cw * 0.15));

    // Door frame
    ctx.fillStyle = rgb(secondary, dim);
    ctx.fillRect(px + inset, py + 1, cw - inset * 2, ch - 2);

    // Door panel
    ctx.fillStyle = rgb(primary, dim);
    ctx.fillRect(px + inset + 2, py + 3, cw - inset * 2 - 4, ch - 6);

    // Handle/lock indicator
    const handleX = px + cw / 2 + 2;
    const handleY = py + ch / 2;
    ctx.fillStyle = locked ? rgb([255, 60, 60], dim) : rgb([240, 220, 100], dim);
    ctx.fillRect(handleX, handleY - 1, 2, 2);
  }

  private drawChest(rc: TilesetRenderContext, primary: RGB, secondary: RGB): void {
    const { ctx, px, py, cw, ch, dim } = rc;
    const cx = px + cw / 2;
    const cy = py + ch / 2;
    const w = Math.floor(cw * 0.6);
    const h = Math.floor(ch * 0.5);

    // Chest body
    ctx.fillStyle = rgb(secondary, dim);
    ctx.fillRect(cx - w / 2, cy - h / 2 + 1, w, h);

    // Lid
    ctx.fillStyle = rgb(primary, dim);
    ctx.fillRect(cx - w / 2, cy - h / 2, w, Math.floor(h * 0.4));

    // Latch
    ctx.fillStyle = rgb([255, 255, 200], dim);
    ctx.fillRect(cx - 1, cy - 1, 2, 2);
  }

  private drawTrap(rc: TilesetRenderContext, primary: RGB, secondary: RGB): void {
    const { ctx, px, py, cw, ch, dim } = rc;
    const cx = px + cw / 2;
    const cy = py + ch / 2;
    const s = Math.floor(Math.min(cw, ch) * 0.35);

    // Triangle warning
    ctx.fillStyle = rgb(primary, dim);
    ctx.beginPath();
    ctx.moveTo(cx, cy - s);
    ctx.lineTo(cx + s, cy + s * 0.6);
    ctx.lineTo(cx - s, cy + s * 0.6);
    ctx.closePath();
    ctx.fill();

    // Exclamation dot
    ctx.fillStyle = rgb(secondary, dim);
    ctx.fillRect(cx - 1, cy - s * 0.3, 2, s * 0.4);
    ctx.fillRect(cx - 1, cy + s * 0.2, 2, 2);
  }

  private drawStairs(rc: TilesetRenderContext, primary: RGB, secondary: RGB, up: boolean): void {
    const { ctx, px, py, cw, ch, dim } = rc;
    const steps = 4;
    const stepW = Math.floor((cw - 4) / steps);
    const stepH = Math.floor((ch - 4) / steps);

    for (let i = 0; i < steps; i++) {
      const shade = up ? i / steps : 1 - i / steps;
      ctx.fillStyle = rgb(blend(secondary, primary, shade), dim);
      const sx = px + 2 + i * stepW;
      const sy = up ? py + ch - 2 - (i + 1) * stepH : py + 2 + i * stepH;
      ctx.fillRect(sx, sy, stepW, stepH);
    }

    // Arrow indicator
    ctx.fillStyle = rgb([255, 255, 255], dim * 0.6);
    const arrowX = px + cw / 2;
    const arrowY = up ? py + 3 : py + ch - 4;
    ctx.beginPath();
    if (up) {
      ctx.moveTo(arrowX, arrowY);
      ctx.lineTo(arrowX + 3, arrowY + 3);
      ctx.lineTo(arrowX - 3, arrowY + 3);
    } else {
      ctx.moveTo(arrowX, arrowY);
      ctx.lineTo(arrowX + 3, arrowY - 3);
      ctx.lineTo(arrowX - 3, arrowY - 3);
    }
    ctx.closePath();
    ctx.fill();
  }

  private drawFountain(rc: TilesetRenderContext, primary: RGB, secondary: RGB): void {
    const { ctx, px, py, cw, ch, dim } = rc;
    const cx = px + cw / 2;
    const cy = py + ch / 2;
    const r = Math.floor(Math.min(cw, ch) * 0.3);

    // Basin
    ctx.fillStyle = rgb(secondary, dim);
    ctx.beginPath();
    ctx.arc(cx, cy + 2, r, 0, Math.PI * 2);
    ctx.fill();

    // Water surface
    ctx.fillStyle = rgb(primary, dim * 0.8);
    ctx.beginPath();
    ctx.arc(cx, cy + 2, r - 2, 0, Math.PI * 2);
    ctx.fill();

    // Spout
    ctx.fillStyle = rgb([180, 220, 255], dim * 0.6);
    ctx.fillRect(cx - 1, cy - r, 2, r);
  }

  private drawFire(rc: TilesetRenderContext, primary: RGB, secondary: RGB): void {
    const { ctx, px, py, cw, ch, dim } = rc;
    const cx = px + cw / 2;
    const baseY = py + ch * 0.7;

    // Flame body — stacked triangles
    ctx.fillStyle = rgb(secondary, dim);
    ctx.beginPath();
    ctx.moveTo(cx, py + ch * 0.15);
    ctx.lineTo(cx + cw * 0.3, baseY);
    ctx.lineTo(cx - cw * 0.3, baseY);
    ctx.closePath();
    ctx.fill();

    // Inner flame
    ctx.fillStyle = rgb(primary, dim);
    ctx.beginPath();
    ctx.moveTo(cx, py + ch * 0.3);
    ctx.lineTo(cx + cw * 0.18, baseY - 2);
    ctx.lineTo(cx - cw * 0.18, baseY - 2);
    ctx.closePath();
    ctx.fill();

    // Core glow
    ctx.fillStyle = rgb([255, 240, 120], dim * 0.8);
    ctx.fillRect(cx - 1, py + ch * 0.45, 2, Math.floor(ch * 0.15));
  }

  private drawAltar(rc: TilesetRenderContext, primary: RGB, secondary: RGB): void {
    const { ctx, px, py, cw, ch, dim } = rc;
    const cx = px + cw / 2;

    // Pedestal
    ctx.fillStyle = rgb(secondary, dim);
    ctx.fillRect(px + 3, py + ch * 0.6, cw - 6, ch * 0.35);

    // Top slab
    ctx.fillStyle = rgb(primary, dim);
    ctx.fillRect(px + 2, py + ch * 0.55, cw - 4, Math.floor(ch * 0.12));

    // Glow symbol
    ctx.fillStyle = rgb([220, 160, 255], dim * 0.6);
    ctx.fillRect(cx - 1, py + ch * 0.3, 2, Math.floor(ch * 0.2));
    ctx.fillRect(cx - 3, py + ch * 0.38, 6, 1);
  }

  private drawPillar(rc: TilesetRenderContext, primary: RGB, secondary: RGB): void {
    const { ctx, px, py, cw, ch, dim } = rc;
    const cx = px + cw / 2;
    const pillarW = Math.floor(cw * 0.35);

    // Shaft
    ctx.fillStyle = rgb(primary, dim);
    ctx.fillRect(cx - pillarW / 2, py + 3, pillarW, ch - 6);

    // Capital (top)
    ctx.fillStyle = rgb(blend(primary, [200, 195, 185], 0.3), dim);
    ctx.fillRect(cx - pillarW / 2 - 1, py + 2, pillarW + 2, 3);

    // Base
    ctx.fillStyle = rgb(secondary, dim);
    ctx.fillRect(cx - pillarW / 2 - 1, py + ch - 5, pillarW + 2, 3);
  }

  private drawTree(rc: TilesetRenderContext, primary: RGB, secondary: RGB): void {
    const { ctx, px, py, cw, ch, dim } = rc;
    const cx = px + cw / 2;

    // Trunk
    const trunkW = Math.max(2, Math.floor(cw * 0.2));
    ctx.fillStyle = rgb(secondary, dim);
    ctx.fillRect(cx - trunkW / 2, py + ch * 0.5, trunkW, ch * 0.45);

    // Canopy — layered circles
    const r = Math.floor(Math.min(cw, ch) * 0.35);
    ctx.fillStyle = rgb(primary, dim);
    ctx.beginPath();
    ctx.arc(cx, py + ch * 0.35, r, 0, Math.PI * 2);
    ctx.fill();

    // Canopy highlight
    ctx.fillStyle = rgb(blend(primary, [80, 160, 60], 0.4), dim * 0.7);
    ctx.beginPath();
    ctx.arc(cx - 1, py + ch * 0.3, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawRock(rc: TilesetRenderContext, primary: RGB, _secondary: RGB): void {
    const { ctx, px, py, cw, ch, dim } = rc;
    const cx = px + cw / 2;
    const cy = py + ch / 2;
    const rw = Math.floor(cw * 0.35);
    const rh = Math.floor(ch * 0.3);

    // Rock body
    ctx.fillStyle = rgb(primary, dim);
    ctx.beginPath();
    ctx.ellipse(cx, cy + 1, rw, rh, 0, 0, Math.PI * 2);
    ctx.fill();

    // Highlight edge
    ctx.fillStyle = rgb(blend(primary, [180, 175, 165], 0.3), dim);
    ctx.beginPath();
    ctx.ellipse(cx - 1, cy - 1, rw * 0.6, rh * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
