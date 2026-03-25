import type { CellTerrain, CellFeature } from '@/types';
import type { Grid } from './Grid';

// ── Tileset Interfaces ────────────────────────────────────────

/** How a tileset renders a single cell. */
export interface TilesetRenderContext {
  ctx: CanvasRenderingContext2D;
  /** Pixel x of top-left corner */
  px: number;
  /** Pixel y of top-left corner */
  py: number;
  /** Cell width in pixels */
  cw: number;
  /** Cell height in pixels */
  ch: number;
  /** Grid x coordinate */
  gx: number;
  /** Grid y coordinate */
  gy: number;
  /** Simple deterministic hash for this cell position */
  hash: number;
  /** Reference to the grid (for wall auto-connect etc.) */
  grid: Grid;
  /** Dim factor (1 = full bright, 0.3 = fog explored) */
  dim: number;
}

/** A tileset defines how to render terrain, features, and entities on canvas. */
export interface Tileset {
  /** Human-readable name */
  readonly name: string;
  /** Unique ID for storage */
  readonly id: string;
  /** Whether cells should be square (true) or monospace-shaped (false) */
  readonly squareCells: boolean;
  /** Base cell size in px (before viewport fitting) */
  readonly baseCellSize: number;

  /** Render terrain background + glyph/tile for a cell. */
  renderTerrain(rc: TilesetRenderContext, terrain: CellTerrain): void;

  /** Render a feature on top of terrain. */
  renderFeature(rc: TilesetRenderContext, feature: CellFeature, terrain: CellTerrain): void;

  /** Render an entity glyph. Returns true if handled, false to use default ASCII. */
  renderEntity(
    rc: TilesetRenderContext,
    symbol: string,
    color: string,
    isPlayer: boolean,
    isAlly: boolean,
    spriteId?: string,
    /** Grid footprint in cells (1=Medium, 2=Large, 3=Huge, 4=Gargantuan) */
    entitySize?: number,
  ): void;
}

// ── Shared Utilities ──────────────────────────────────────────

/** Simple hash for consistent terrain variation per cell. */
export function cellHash(x: number, y: number): number {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return (h ^ (h >> 16)) & 0x7fffffff;
}

/** Dim a hex color by a factor (0-1). */
export function dimColor(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.floor(r * factor)},${Math.floor(g * factor)},${Math.floor(b * factor)})`;
}

/** Dim an rgb/rgba string by a factor. */
export function dimRgb(r: number, g: number, b: number, factor: number): string {
  return `rgb(${Math.floor(r * factor)},${Math.floor(g * factor)},${Math.floor(b * factor)})`;
}

/**
 * Wall auto-connect: picks box-drawing chars based on adjacent walls.
 * Used by ASCII tileset.
 */
export function getWallChar(grid: Grid, x: number, y: number): string {
  const connectsWall = (wx: number, wy: number): boolean => {
    if (!grid.isValidPosition(wx, wy)) return true;
    const c = grid.getCell(wx, wy);
    if (!c) return true;
    if (c.terrain === 'wall') return true;
    if (c.features.some(f => f === 'door' || f === 'door_locked' || f === 'pillar')) return true;
    return false;
  };

  const n = connectsWall(x, y - 1);
  const s = connectsWall(x, y + 1);
  const e = connectsWall(x + 1, y);
  const w = connectsWall(x - 1, y);

  if (n && s && e && w) return '\u254B'; // ╋
  if (n && s && e)      return '\u2523'; // ┣
  if (n && s && w)      return '\u252B'; // ┫
  if (n && e && w)      return '\u253B'; // ┻
  if (s && e && w)      return '\u2533'; // ┳
  if (n && s)           return '\u2503'; // ┃
  if (e && w)           return '\u2501'; // ━
  if (n && e)           return '\u2517'; // ┗
  if (n && w)           return '\u251B'; // ┛
  if (s && e)           return '\u250F'; // ┏
  if (s && w)           return '\u2513'; // ┓
  if (n)                return '\u2503'; // ┃
  if (s)                return '\u2503'; // ┃
  if (e)                return '\u2501'; // ━
  if (w)                return '\u2501'; // ━
  return '\u2588'; // █
}

// ── ASCII Tileset ─────────────────────────────────────────────

const TERRAIN_GLYPHS: Record<CellTerrain, { chars: string[]; fg: string; bg: string }> = {
  floor:  { chars: ['.'],              fg: '#808080', bg: '#181818' },
  wall:   { chars: ['#'],              fg: '#c0c0c0', bg: '#303030' },
  grass:  { chars: ['.', ',', '`'],    fg: '#00cc00', bg: '#002200' },
  water:  { chars: ['~', '\u2248'],    fg: '#00aaff', bg: '#001133' },
  lava:   { chars: ['~', '\u2248'],    fg: '#ff4400', bg: '#330a00' },
  stone:  { chars: ['.', ':'],         fg: '#aaaaaa', bg: '#1c1c1c' },
  ice:    { chars: ['.'],              fg: '#aaddee', bg: '#112233' },
  mud:    { chars: [',', '~'],         fg: '#aa7733', bg: '#1a0f00' },
  sand:   { chars: ['.', ':'],         fg: '#ddbb55', bg: '#221a00' },
  wood:   { chars: ['.'],              fg: '#cc9944', bg: '#1a0f00' },
  pit:    { chars: [' '],              fg: '#222222', bg: '#000000' },
};

const FEATURE_GLYPHS: Record<CellFeature, { ch: string; fg: string; bg: string }> = {
  door:        { ch: '+', fg: '#ffaa00', bg: '#332200' },
  door_locked: { ch: '+', fg: '#ff4444', bg: '#330000' },
  chest:       { ch: '*', fg: '#ffee00', bg: '#332a00' },
  trap:        { ch: '^', fg: '#ff2222', bg: '#220000' },
  stairs_up:   { ch: '<', fg: '#ffffff', bg: '#002244' },
  stairs_down: { ch: '>', fg: '#ffffff', bg: '#002244' },
  fountain:    { ch: '{', fg: '#00ccff', bg: '#001a33' },
  fire:        { ch: '&', fg: '#ff6600', bg: '#331100' },
  altar:       { ch: '_', fg: '#cc66ff', bg: '#1a0033' },
  pillar:      { ch: 'O', fg: '#aaaaaa', bg: '#222222' },
  tree:        { ch: 'T', fg: '#8b5a2b', bg: '#2a1a0a' },
  rock:        { ch: '.', fg: '#888888', bg: '#333333' },
  running_water: { ch: '~', fg: '#4ac4ff', bg: '#0a2a4a' },
  torch_wall:       { ch: '!', fg: '#ffaa33', bg: '#331a00' },
  torch_wall_spent: { ch: '!', fg: '#555544', bg: '#1a1a14' },
  brazier:          { ch: '0', fg: '#ff6600', bg: '#331100' },
};

export class AsciiTileset implements Tileset {
  readonly name = 'Classic ASCII';
  readonly id = 'ascii';
  readonly squareCells = false;
  readonly baseCellSize = 20;

  renderTerrain(rc: TilesetRenderContext, terrain: CellTerrain): void {
    const { ctx, px, py, cw, ch, gx, gy, hash, grid, dim } = rc;
    const g = TERRAIN_GLYPHS[terrain] ?? TERRAIN_GLYPHS.floor;

    let bg = g.bg;
    let fg = g.fg;
    let char: string;

    if (terrain === 'wall') {
      char = getWallChar(grid, gx, gy);
    } else {
      char = g.chars[hash % g.chars.length];
    }

    if (dim < 1) {
      bg = dimColor(bg, dim);
      fg = dimColor(fg, dim);
    }

    ctx.fillStyle = bg;
    ctx.fillRect(px, py, cw, ch);
    ctx.fillStyle = fg;
    ctx.fillText(char, px + cw / 2, py + ch / 2);
  }

  renderFeature(rc: TilesetRenderContext, feature: CellFeature, _terrain: CellTerrain): void {
    const { ctx, px, py, cw, ch, dim } = rc;
    const g = FEATURE_GLYPHS[feature];
    if (!g) return;

    let bg = g.bg;
    let fg = g.fg;
    if (dim < 1) {
      bg = dimColor(bg, dim);
      fg = dimColor(fg, dim);
    }

    // Open doors use '/' glyph instead of '+'
    let glyph = g.ch;
    if (feature === 'door' || feature === 'door_locked') {
      const cell = rc.grid.getCell(rc.gx, rc.gy);
      if (cell && cell.movementCost < Infinity) glyph = '/';
    }

    ctx.fillStyle = bg;
    ctx.fillRect(px, py, cw, ch);
    ctx.fillStyle = fg;
    ctx.fillText(glyph, px + cw / 2, py + ch / 2);
  }

  renderEntity(
    rc: TilesetRenderContext,
    symbol: string,
    color: string,
    isPlayer: boolean,
    isAlly: boolean,
    _spriteId?: string,
    entitySize?: number,
  ): void {
    const { ctx, px, py, cw, ch } = rc;
    const s = entitySize ?? 1;
    const totalW = cw * s;
    const totalH = ch * s;
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(px, py, totalW, totalH);

    let c = color;
    if (isPlayer) c = '#ffffff';
    else if (isAlly) c = '#44aaff';

    ctx.fillStyle = c;
    if (s > 1) {
      ctx.save();
      ctx.font = `bold ${Math.floor(rc.ch * s * 0.6)}px monospace`;
      ctx.fillText(symbol, px + totalW / 2, py + totalH / 2);
      ctx.restore();
    } else {
      ctx.fillText(symbol, px + cw / 2, py + ch / 2);
    }
  }
}

// ── Tileset Registry ──────────────────────────────────────────

import { FantasyTileset } from './FantasyTileset';

const TILESETS: Tileset[] = [
  new AsciiTileset(),
  new FantasyTileset(),
];

export function getTilesetById(id: string): Tileset {
  return TILESETS.find(t => t.id === id) ?? TILESETS[0];
}

export function getAllTilesets(): Tileset[] {
  return TILESETS;
}
