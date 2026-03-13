import type {
  CellTerrain,
  Coordinate,
  EntityId,
  GridEntityPlacement,
} from '@/types';
import { coordToKey } from '@/utils/math';
import { Grid } from './Grid';
import { FogOfWar } from './FogOfWar';

/** Visual info needed to render an entity token. */
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

/** Terrain color lookup. */
const TERRAIN_COLORS: Record<CellTerrain, string> = {
  floor: '#4a4236',
  wall: '#2a2520',
  grass: '#3a4a2a',
  water: '#2a3a4a',
  lava: '#6a2a1a',
  stone: '#5a5a5a',
  ice: '#7a9aaa',
  mud: '#4a3a2a',
  sand: '#8a7a5a',
  wood: '#5a4230',
  pit: '#1a1a1a',
};

/**
 * Canvas-based grid renderer with entity tokens, fog of war, and highlights.
 * Handles camera (pan/zoom) and coordinate conversion.
 */
export class GridRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private overlay: HTMLElement;
  private container: HTMLElement;
  private camera = { x: 0, y: 0, zoom: 1 };
  private cellSize = 40;
  private hoveredCell: Coordinate | null = null;
  private selectedEntity: EntityId | null = null;
  private highlights: HighlightLayer[] = [];
  private pathPreview: Coordinate[] = [];
  private animationFrame: number | null = null;

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

    this.resizeCanvas();

    // Bind events
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('click', this.handleClick);
    window.addEventListener('resize', this.handleResize);
  }

  // ── Rendering ────────────────────────────────────────────────

  render(grid: Grid, fog: FogOfWar): void {
    const { ctx, cellSize, camera } = this;
    const width = grid.getWidth();
    const height = grid.getHeight();

    ctx.save();
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Apply camera transform
    ctx.translate(-camera.x * camera.zoom, -camera.y * camera.zoom);
    ctx.scale(camera.zoom, camera.zoom);

    // Draw cells
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = grid.getCell(x, y);
        if (!cell) continue;

        const px = x * cellSize;
        const py = y * cellSize;

        // Terrain fill
        ctx.fillStyle = TERRAIN_COLORS[cell.terrain] ?? '#333';
        ctx.fillRect(px, py, cellSize, cellSize);

        // Grid lines
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px, py, cellSize, cellSize);

        // Fog of war
        if (!fog.isVisible(x, y)) {
          if (fog.isExplored(x, y)) {
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
          } else {
            ctx.fillStyle = 'rgba(0,0,0,0.95)';
          }
          ctx.fillRect(px, py, cellSize, cellSize);
        }
      }
    }

    // Draw highlights
    for (const layer of this.highlights) {
      ctx.fillStyle = layer.color;
      ctx.globalAlpha = layer.alpha;
      for (const key of layer.cells) {
        const parts = key.split(',');
        const hx = parseInt(parts[0], 10);
        const hy = parseInt(parts[1], 10);
        ctx.fillRect(hx * cellSize, hy * cellSize, cellSize, cellSize);
      }
      ctx.globalAlpha = 1;
    }

    // Draw path preview
    if (this.pathPreview.length > 1) {
      ctx.strokeStyle = 'rgba(255,255,100,0.7)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      const first = this.pathPreview[0];
      ctx.moveTo(first.x * cellSize + cellSize / 2, first.y * cellSize + cellSize / 2);
      for (let i = 1; i < this.pathPreview.length; i++) {
        const p = this.pathPreview[i];
        ctx.lineTo(p.x * cellSize + cellSize / 2, p.y * cellSize + cellSize / 2);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Hovered cell highlight
    if (this.hoveredCell) {
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(
        this.hoveredCell.x * cellSize,
        this.hoveredCell.y * cellSize,
        cellSize,
        cellSize,
      );
    }

    ctx.restore();
  }

  renderEntities(
    placements: Map<EntityId, GridEntityPlacement>,
    getInfo: (id: EntityId) => EntityRenderInfo | undefined,
  ): void {
    const { ctx, cellSize, camera } = this;

    ctx.save();
    ctx.translate(-camera.x * camera.zoom, -camera.y * camera.zoom);
    ctx.scale(camera.zoom, camera.zoom);

    for (const [entityId, placement] of placements) {
      const info = getInfo(entityId);
      if (!info) continue;

      const tokenSize = placement.size * cellSize;
      const cx = placement.position.x * cellSize + tokenSize / 2;
      const cy = placement.position.y * cellSize + tokenSize / 2;
      const radius = (tokenSize - 4) / 2;

      // Token circle
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = info.color;
      ctx.fill();

      // Border
      ctx.lineWidth = 2;
      if (info.isPlayer) {
        ctx.strokeStyle = '#ffd700'; // Gold
      } else if (info.isAlly) {
        ctx.strokeStyle = '#4488ff'; // Blue
      } else {
        ctx.strokeStyle = '#ff4444'; // Red
      }

      // Selected entity: brighter border
      if (entityId === this.selectedEntity) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ffffff';
      }

      ctx.stroke();

      // Symbol letter
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.floor(tokenSize * 0.4)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(info.symbol, cx, cy);

      // HP bar below token
      const barWidth = tokenSize - 6;
      const barHeight = 3;
      const barX = placement.position.x * cellSize + 3;
      const barY = placement.position.y * cellSize + tokenSize - 2;
      const hpPercent = Math.max(0, info.hp / info.maxHp);

      ctx.fillStyle = '#333';
      ctx.fillRect(barX, barY, barWidth, barHeight);

      const hpColor = hpPercent > 0.5 ? '#4a4' : hpPercent > 0.25 ? '#aa4' : '#a44';
      ctx.fillStyle = hpColor;
      ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);
    }

    ctx.restore();
  }

  // ── Highlights ───────────────────────────────────────────────

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

  // ── Camera ───────────────────────────────────────────────────

  panTo(position: Coordinate, _animate = false): void {
    this.camera.x = position.x * this.cellSize - this.canvas.width / (2 * this.camera.zoom);
    this.camera.y = position.y * this.cellSize - this.canvas.height / (2 * this.camera.zoom);
  }

  setZoom(zoom: number): void {
    this.camera.zoom = Math.max(0.25, Math.min(3, zoom));
  }

  centerOn(position: Coordinate): void {
    this.panTo(position);
  }

  // ── Coordinate conversion ────────────────────────────────────

  gridToScreen(coord: Coordinate): { x: number; y: number } {
    return {
      x: (coord.x * this.cellSize - this.camera.x) * this.camera.zoom,
      y: (coord.y * this.cellSize - this.camera.y) * this.camera.zoom,
    };
  }

  screenToGrid(screenX: number, screenY: number): Coordinate {
    return {
      x: Math.floor(screenX / (this.cellSize * this.camera.zoom) + this.camera.x / this.cellSize),
      y: Math.floor(screenY / (this.cellSize * this.camera.zoom) + this.camera.y / this.cellSize),
    };
  }

  // ── Cleanup ──────────────────────────────────────────────────

  destroy(): void {
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('click', this.handleClick);
    window.removeEventListener('resize', this.handleResize);
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
    }
    this.container.removeChild(this.canvas);
    this.container.removeChild(this.overlay);
  }

  // ── Event handlers (arrow fns for stable `this`) ─────────────

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

  private resizeCanvas(): void {
    const rect = this.container.getBoundingClientRect();
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }
}
