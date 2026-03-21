import type {
  CellFeature,
  CellTerrain,
  Coordinate,
  EntityId,
  GridEntityPlacement,
} from '@/types';
import { coordToKey } from '@/utils/math';
import { Grid } from './Grid';
import { FogOfWar } from './FogOfWar';

// ── CDDA-Style ASCII Terrain Symbols & Colors ────────────────

/**
 * Each terrain type has a character, foreground color, and background color.
 * Colors are saturated and rich — inspired by CDDA's curses palette.
 * Multiple chars per terrain add visual variety.
 */
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

/** Feature glyphs override terrain when present. Bright, high-contrast. */
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
  tree:        { ch: 'T', fg: '#22aa22', bg: '#0a220a' },
  rock:        { ch: '.', fg: '#888888', bg: '#333333' },
};

/**
 * Wall auto-connect: picks box-drawing chars based on adjacent walls.
 * Considers out-of-bounds and doors as connectable neighbors.
 */
function getWallChar(grid: Grid, x: number, y: number): string {
  const connectsWall = (wx: number, wy: number): boolean => {
    if (!grid.isValidPosition(wx, wy)) return true; // edges connect
    const c = grid.getCell(wx, wy);
    if (!c) return true;
    if (c.terrain === 'wall') return true;
    // Doors and pillars connect to walls
    if (c.features.some(f => f === 'door' || f === 'door_locked' || f === 'pillar')) return true;
    return false;
  };

  const n = connectsWall(x, y - 1);
  const s = connectsWall(x, y + 1);
  const e = connectsWall(x + 1, y);
  const w = connectsWall(x - 1, y);

  // Box-drawing character selection (heavy lines for better visibility)
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
  return '\u2588'; // █ solid block for isolated walls
}

/** Simple hash for consistent terrain variation per cell. */
function cellHash(x: number, y: number): number {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return (h ^ (h >> 16)) & 0x7fffffff;
}

// ── Visual info for entity rendering ─────────────────────────

/** Visual info needed to render an entity glyph. */
export interface EntityRenderInfo {
  name: string;
  color: string;
  symbol: string;
  hp: number;
  maxHp: number;
  isPlayer: boolean;
  isAlly: boolean;
  size: number;
  conditions: string[];
}

/** A highlight layer to draw over cells. */
interface HighlightLayer {
  cells: Set<string>;
  color: string;
  alpha: number;
}

// ── CDDA-Style ASCII Grid Renderer ───────────────────────────

/**
 * CDDA-inspired ASCII renderer. Each grid cell is a single colored character
 * drawn on a black background using a monospace font. The viewport is centered
 * on the camera position and fills the container.
 */
export class GridRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private overlay: HTMLElement;
  private container: HTMLElement;
  private camera = { x: 0, y: 0, zoom: 1 };
  private hoveredCell: Coordinate | null = null;
  private selectedEntity: EntityId | null = null;
  private highlights: HighlightLayer[] = [];
  private pathPreview: Coordinate[] = [];
  private animationFrame: number | null = null;
  private resizeObserver: ResizeObserver | null = null;

  // Cell size auto-calculated from font metrics
  private cellW = 16;
  private cellH = 20;
  private fontSize = 16;

  // Viewport dimensions in cells
  private viewCols = 80;
  private viewRows = 40;

  // Track last known container size to detect resize
  private lastContainerW = 0;
  private lastContainerH = 0;

  // Camera center in grid coords
  private cameraCenter: Coordinate = { x: 0, y: 0 };

  // Event hooks
  onCellHover: ((coord: Coordinate | null) => void) | null = null;
  onCellClick: ((coord: Coordinate) => void) | null = null;
  onEntityClick: ((entityId: EntityId) => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;

    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.background = '#000';
    container.appendChild(this.canvas);

    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas 2D context');
    this.ctx = ctx;

    this.overlay = document.createElement('div');
    this.overlay.style.position = 'absolute';
    this.overlay.style.top = '0';
    this.overlay.style.left = '0';
    this.overlay.style.pointerEvents = 'none';
    container.style.position = 'relative';
    container.appendChild(this.overlay);

    // Bind events
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('click', this.handleClick);
    window.addEventListener('resize', this.handleResize);

    // ResizeObserver to detect when container gets/changes dimensions
    this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
    this.resizeObserver.observe(container);

    this.resizeCanvas();
  }

  // ── Main Render ────────────────────────────────────────────

  render(grid: Grid, fog: FogOfWar): void {
    const { ctx } = this;
    const dpr = window.devicePixelRatio;

    // Ensure canvas matches container size
    this.checkResize();

    // Nothing to draw if viewport is 0
    if (this.viewCols <= 0 || this.viewRows <= 0) return;

    // Clear to black
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr);

    // Calculate viewport bounds
    const startX = this.cameraCenter.x - Math.floor(this.viewCols / 2);
    const startY = this.cameraCenter.y - Math.floor(this.viewRows / 2);

    ctx.font = `${this.fontSize}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let vy = 0; vy < this.viewRows; vy++) {
      for (let vx = 0; vx < this.viewCols; vx++) {
        const gx = startX + vx;
        const gy = startY + vy;

        const px = vx * this.cellW;
        const py = vy * this.cellH;

        const cell = grid.getCell(gx, gy);

        // Out of bounds: solid black
        if (!cell) continue;

        const visible = fog.isVisible(gx, gy);
        const explored = fog.isExplored(gx, gy);

        // Unexplored: black
        if (!visible && !explored) continue;

        // Determine glyph: features override terrain, entities override both (handled later)
        let ch: string;
        let fg: string;
        let bg: string;

        const terrainGlyph = TERRAIN_GLYPHS[cell.terrain] ?? TERRAIN_GLYPHS.floor;
        bg = terrainGlyph.bg;
        fg = terrainGlyph.fg;

        // Auto-connect walls
        if (cell.terrain === 'wall') {
          ch = getWallChar(grid, gx, gy);
        } else {
          ch = terrainGlyph.chars[cellHash(gx, gy) % terrainGlyph.chars.length];
        }

        // Features override terrain glyph (including background)
        if (cell.features.length > 0) {
          const feat = FEATURE_GLYPHS[cell.features[0]];
          if (feat) {
            ch = feat.ch;
            fg = feat.fg;
            bg = feat.bg;
          }
        }

        // Dim explored-but-not-visible cells
        if (!visible) {
          fg = this.dimColor(fg, 0.3);
          bg = this.dimColor(bg, 0.3);
        }

        // Draw background
        ctx.fillStyle = bg;
        ctx.fillRect(px, py, this.cellW, this.cellH);

        // Draw character
        ctx.fillStyle = fg;
        ctx.fillText(ch, px + this.cellW / 2, py + this.cellH / 2);
      }
    }

    // Draw highlights
    for (const layer of this.highlights) {
      ctx.globalAlpha = layer.alpha;
      for (const key of layer.cells) {
        const parts = key.split(',');
        const hx = parseInt(parts[0], 10) - startX;
        const hy = parseInt(parts[1], 10) - startY;
        if (hx < 0 || hx >= this.viewCols || hy < 0 || hy >= this.viewRows) continue;
        ctx.fillStyle = layer.color;
        ctx.fillRect(hx * this.cellW, hy * this.cellH, this.cellW, this.cellH);
      }
      ctx.globalAlpha = 1;
    }

    // Draw path preview
    if (this.pathPreview.length > 1) {
      ctx.strokeStyle = 'rgba(255,255,100,0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      const first = this.pathPreview[0];
      const sx = (first.x - startX) * this.cellW + this.cellW / 2;
      const sy = (first.y - startY) * this.cellH + this.cellH / 2;
      ctx.moveTo(sx, sy);
      for (let i = 1; i < this.pathPreview.length; i++) {
        const p = this.pathPreview[i];
        ctx.lineTo(
          (p.x - startX) * this.cellW + this.cellW / 2,
          (p.y - startY) * this.cellH + this.cellH / 2,
        );
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Hovered cell highlight
    if (this.hoveredCell) {
      const hx = this.hoveredCell.x - startX;
      const hy = this.hoveredCell.y - startY;
      if (hx >= 0 && hx < this.viewCols && hy >= 0 && hy < this.viewRows) {
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(hx * this.cellW, hy * this.cellH, this.cellW, this.cellH);
      }
    }

    ctx.restore();
  }

  /** Render entities as colored ASCII glyphs (@ for player, letters for others). */
  renderEntities(
    placements: Map<EntityId, GridEntityPlacement>,
    getInfo: (id: EntityId) => EntityRenderInfo | undefined,
  ): void {
    const { ctx } = this;
    const dpr = window.devicePixelRatio;
    const startX = this.cameraCenter.x - Math.floor(this.viewCols / 2);
    const startY = this.cameraCenter.y - Math.floor(this.viewRows / 2);

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = `bold ${this.fontSize}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const [entityId, placement] of placements) {
      const info = getInfo(entityId);
      if (!info) continue;

      const vx = placement.position.x - startX;
      const vy = placement.position.y - startY;

      // Skip if off-viewport
      if (vx < 0 || vx >= this.viewCols || vy < 0 || vy >= this.viewRows) continue;

      const px = vx * this.cellW;
      const py = vy * this.cellH;

      // Background: darken the cell slightly to make entity stand out
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(px, py, this.cellW, this.cellH);

      // Entity color
      let color = info.color;
      if (info.isPlayer) {
        color = '#ffffff';
      } else if (info.isAlly) {
        color = '#44aaff';
      }

      // Selected: bright highlight
      if (entityId === this.selectedEntity) {
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(px, py, this.cellW, this.cellH);
      }

      // Draw the entity glyph
      ctx.fillStyle = color;
      ctx.fillText(info.symbol, px + this.cellW / 2, py + this.cellH / 2);
    }

    ctx.restore();
  }

  // ── Highlights ────────────────────────────────────────────

  highlightCells(cells: Coordinate[] | Set<string>, color: string, alpha = 0.3): void {
    let cellSet: Set<string>;
    if (cells instanceof Set) {
      cellSet = cells;
    } else {
      cellSet = new Set(cells.map((c) => coordToKey(c)));
    }
    this.highlights.push({ cells: cellSet, color, alpha });
  }

  showPath(path: Coordinate[]): void {
    this.pathPreview = path;
  }

  showRange(center: Coordinate, range: number, color: string): void {
    const rangeCells = Math.ceil(range / 5);
    const cells = new Set<string>();
    for (let dy = -rangeCells; dy <= rangeCells; dy++) {
      for (let dx = -rangeCells; dx <= rangeCells; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) * 5 <= range) {
          cells.add(coordToKey({ x: center.x + dx, y: center.y + dy }));
        }
      }
    }
    this.highlights.push({ cells, color, alpha: 0.2 });
  }

  clearHighlights(): void {
    this.highlights = [];
    this.pathPreview = [];
  }

  setSelectedEntity(entityId: EntityId | null): void {
    this.selectedEntity = entityId;
  }

  // ── Camera ────────────────────────────────────────────────

  panTo(position: Coordinate, _animate = false): void {
    this.cameraCenter = { x: position.x, y: position.y };
  }

  setZoom(zoom: number): void {
    this.camera.zoom = Math.max(0.25, Math.min(3, zoom));
  }

  centerOn(position: Coordinate): void {
    this.cameraCenter = { x: position.x, y: position.y };
  }

  // ── Coordinate conversion ─────────────────────────────────

  gridToScreen(coord: Coordinate): { x: number; y: number } {
    const startX = this.cameraCenter.x - Math.floor(this.viewCols / 2);
    const startY = this.cameraCenter.y - Math.floor(this.viewRows / 2);
    return {
      x: (coord.x - startX) * this.cellW,
      y: (coord.y - startY) * this.cellH,
    };
  }

  screenToGrid(screenX: number, screenY: number): Coordinate {
    const startX = this.cameraCenter.x - Math.floor(this.viewCols / 2);
    const startY = this.cameraCenter.y - Math.floor(this.viewRows / 2);
    return {
      x: Math.floor(screenX / this.cellW) + startX,
      y: Math.floor(screenY / this.cellH) + startY,
    };
  }

  // ── Cleanup ───────────────────────────────────────────────

  destroy(): void {
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('click', this.handleClick);
    window.removeEventListener('resize', this.handleResize);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
    }
    this.container.removeChild(this.canvas);
    this.container.removeChild(this.overlay);
  }

  // ── Event handlers ────────────────────────────────────────

  private handleMouseMove = (e: MouseEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    const coord = this.screenToGrid(e.clientX - rect.left, e.clientY - rect.top);
    this.hoveredCell = coord;
    this.onCellHover?.(coord);
  };

  private handleClick = (e: MouseEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    const coord = this.screenToGrid(e.clientX - rect.left, e.clientY - rect.top);
    this.onCellClick?.(coord);
  };

  private handleResize = (): void => {
    this.resizeCanvas();
  };

  // ── Internal ──────────────────────────────────────────────

  /** Check if container size changed and recalculate if needed. */
  private checkResize(): void {
    const rect = this.container.getBoundingClientRect();
    if (rect.width !== this.lastContainerW || rect.height !== this.lastContainerH) {
      this.resizeCanvas();
    }
  }

  private resizeCanvas(): void {
    const rect = this.container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    this.lastContainerW = rect.width;
    this.lastContainerH = rect.height;

    const dpr = window.devicePixelRatio;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;

    // Calculate cell size to fill viewport
    // Target: larger glyphs with square-ish cells for CDDA feel
    this.fontSize = 20;
    this.cellW = Math.ceil(this.fontSize * 0.65); // Monospace char width
    this.cellH = Math.ceil(this.fontSize * 1.15); // Tighter line height for density

    // How many cells fit in the viewport
    this.viewCols = Math.ceil(rect.width / this.cellW);
    this.viewRows = Math.ceil(rect.height / this.cellH);
  }

  /** Dim a hex color by a factor (0-1). */
  private dimColor(hex: string, factor: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.floor(r * factor)},${Math.floor(g * factor)},${Math.floor(b * factor)})`;
  }
}
