import type {
  Coordinate,
  EntityId,
  GridEntityPlacement,
} from '@/types';
import { coordToKey } from '@/utils/math';
import { Grid } from './Grid';
import { FogOfWar } from './FogOfWar';
import type { Tileset, TilesetRenderContext } from './Tileset';
import { cellHash, AsciiTileset } from './Tileset';
import { LIGHT_SOURCE_RADIUS } from '@/types/grid';

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

// ── Grid Renderer ─────────────────────────────────────────────

/**
 * Canvas-based grid renderer. Delegates cell rendering to a Tileset,
 * supporting both ASCII (non-square) and graphical (square) tilesets.
 * The viewport is centered on the camera position and fills the container.
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
  private lookCursor: Coordinate | null = null;
  private animationFrame: number | null = null;
  private resizeObserver: ResizeObserver | null = null;

  // Active tileset
  private tileset: Tileset;

  // Cell size auto-calculated from font metrics or tileset
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

  constructor(container: HTMLElement, tileset?: Tileset) {
    this.container = container;
    this.tileset = tileset ?? new AsciiTileset();

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

  /** Switch to a different tileset at runtime. */
  setTileset(tileset: Tileset): void {
    this.tileset = tileset;
    this.resizeCanvas();
  }

  /** Get the current tileset. */
  getTileset(): Tileset {
    return this.tileset;
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

    // Set up font for ASCII tileset (graphical tilesets ignore this)
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

        // Per-tile lighting: visible tiles use their light level (1–10 → 0.08–1.0)
        // Explored-but-not-visible tiles stay at 0.25
        let dim: number;
        if (visible) {
          const light = fog.getLightLevel(gx, gy);
          // Map 1–10 to 0.08–1.0 (very dark at minimum)
          dim = light > 0 ? 0.08 + (light - 1) * (0.92 / 9) : 0.08;
        } else {
          dim = 0.25;
        }
        const hash = cellHash(gx, gy);

        const rc: TilesetRenderContext = {
          ctx, px, py, cw: this.cellW, ch: this.cellH,
          gx, gy, hash, grid, dim,
        };

        // Render terrain
        this.tileset.renderTerrain(rc, cell.terrain);

        // Features override terrain
        if (cell.features.length > 0) {
          this.tileset.renderFeature(rc, cell.features[0], cell.terrain);
        }
      }
    }

    // Draw warm glow around light sources
    this.renderLightGlow(grid, fog, startX, startY);

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

    // Look mode cursor — distinct gold/cyan border
    if (this.lookCursor) {
      const lx = this.lookCursor.x - startX;
      const ly = this.lookCursor.y - startY;
      if (lx >= 0 && lx < this.viewCols && ly >= 0 && ly < this.viewRows) {
        ctx.strokeStyle = '#c8a84e';
        ctx.lineWidth = 2;
        ctx.strokeRect(lx * this.cellW + 1, ly * this.cellH + 1, this.cellW - 2, this.cellH - 2);
        ctx.fillStyle = 'rgba(200, 168, 78, 0.12)';
        ctx.fillRect(lx * this.cellW, ly * this.cellH, this.cellW, this.cellH);
      }
    }

    ctx.restore();
  }

  /** Render entities as colored glyphs/shapes depending on tileset. */
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

      const rc: TilesetRenderContext = {
        ctx, px, py, cw: this.cellW, ch: this.cellH,
        gx: placement.position.x, gy: placement.position.y,
        hash: 0, grid: null as unknown as Grid, dim: 1,
      };

      this.tileset.renderEntity(rc, info.symbol, info.color, info.isPlayer, info.isAlly);

      // Selected: pulsing gold highlight (target indicator)
      if (entityId === this.selectedEntity) {
        const pulse = 0.3 + 0.15 * Math.sin(Date.now() * 0.005);
        ctx.fillStyle = `rgba(212,170,60,${pulse})`;
        ctx.fillRect(px, py, this.cellW, this.cellH);
        ctx.strokeStyle = `rgba(212,170,60,${pulse + 0.2})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, this.cellW - 1, this.cellH - 1);
      }
    }

    ctx.restore();
  }

  // ── Light Glow ──────────────────────────────────────────

  /** Render warm radial glow around light-emitting features. */
  private renderLightGlow(
    grid: Grid,
    fog: FogOfWar,
    startX: number,
    startY: number,
  ): void {
    const { ctx } = this;

    // Scan visible viewport cells for light sources
    for (let vy = 0; vy < this.viewRows; vy++) {
      for (let vx = 0; vx < this.viewCols; vx++) {
        const gx = startX + vx;
        const gy = startY + vy;

        if (!fog.isVisible(gx, gy) && !fog.isExplored(gx, gy)) continue;

        const cell = grid.getCell(gx, gy);
        if (!cell) continue;

        for (const feat of cell.features) {
          const radiusCells = LIGHT_SOURCE_RADIUS[feat];
          if (radiusCells === undefined) continue;

          const dim = fog.isVisible(gx, gy) ? 1 : 0.3;
          const cx = vx * this.cellW + this.cellW / 2;
          const cy = vy * this.cellH + this.cellH / 2;
          const radiusPx = radiusCells * Math.max(this.cellW, this.cellH);

          // Pick glow color by feature type
          let r = 255, g = 160, b = 40; // warm amber default
          if (feat === 'fountain') { r = 100; g = 180; b = 255; } // cool blue
          else if (feat === 'brazier') { r = 255; g = 120; b = 20; } // deep orange
          else if (feat === 'fire') { r = 255; g = 140; b = 30; } // orange-yellow

          const alpha = 0.12 * dim;
          const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radiusPx);
          grad.addColorStop(0, `rgba(${r},${g},${b},${alpha * 2.5})`);
          grad.addColorStop(0.3, `rgba(${r},${g},${b},${alpha * 1.5})`);
          grad.addColorStop(0.7, `rgba(${r},${g},${b},${alpha * 0.5})`);
          grad.addColorStop(1, `rgba(${r},${g},${b},0)`);

          ctx.fillStyle = grad;
          ctx.fillRect(
            cx - radiusPx, cy - radiusPx,
            radiusPx * 2, radiusPx * 2,
          );
          break; // one glow per cell
        }
      }
    }
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

  setLookCursor(pos: Coordinate | null): void {
    this.lookCursor = pos;
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

  /** Convert grid coordinate to the screen-space center of that cell. */
  gridToScreenCenter(coord: Coordinate): { x: number; y: number } {
    const startX = this.cameraCenter.x - Math.floor(this.viewCols / 2);
    const startY = this.cameraCenter.y - Math.floor(this.viewRows / 2);
    return {
      x: (coord.x - startX) * this.cellW + this.cellW / 2,
      y: (coord.y - startY) * this.cellH + this.cellH / 2,
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

    if (this.tileset.squareCells) {
      // Square cells: equal width and height
      const size = this.tileset.baseCellSize;
      this.cellW = size;
      this.cellH = size;
      this.fontSize = Math.floor(size * 0.7);
    } else {
      // ASCII cells: taller than wide (monospace proportions)
      this.fontSize = this.tileset.baseCellSize;
      this.cellW = Math.ceil(this.fontSize * 0.65);
      this.cellH = Math.ceil(this.fontSize * 1.15);
    }

    // How many cells fit in the viewport
    this.viewCols = Math.ceil(rect.width / this.cellW);
    this.viewRows = Math.ceil(rect.height / this.cellH);
  }
}
