import type { GameEngine } from '@/engine/GameEngine';
import type { OverworldData, OverworldTerrain, SettlementType } from '@/types/overworld';
import { Component } from '@/ui/Component';
import { el } from '@/utils/dom';
import { isTraversable, getTerrainName } from '@/world/OverworldBridge';

// ── Terrain colors (shared with WorldCreationScreen) ──

const TERRAIN_COLORS: Record<OverworldTerrain, string> = {
  deep_water:    '#0f2942',
  shallow_water: '#1a4a70',
  beach:         '#c8b060',
  plains:        '#4a7a2a',
  forest:        '#2a5a1a',
  dense_forest:  '#1a3a10',
  hills:         '#8a7a4a',
  mountain:      '#6a6a6a',
  peak:          '#d0d0d0',
  snow:          '#c8d8e0',
  desert:        '#c8a848',
  swamp:         '#3a4a20',
  tundra:        '#8a9aa0',
  volcanic:      '#6a2218',
};

const SETTLEMENT_COLORS: Record<SettlementType, string> = {
  village:  '#e8d040',
  town:     '#f0c020',
  city:     '#ffffff',
  fortress: '#a0a0a0',
  ruins:    '#8a6a3a',
  temple:   '#d0b8ff',
};

const RIVER_COLOR = '#2a6aaa';
const PLAYER_COLOR = '#ff4444';
const PLAYER_GLOW = 'rgba(255, 68, 68, 0.5)';

const SETTLEMENT_LABELS: Record<SettlementType, string> = {
  village: 'Village',
  town: 'Town',
  city: 'City',
  fortress: 'Fortress',
  ruins: 'Ruins',
  temple: 'Temple',
};

/**
 * Overworld map panel — canvas-based pixel map replacing the old SVG node-link graph.
 * Shows the full overworld with terrain colors, settlements, rivers, and player position.
 * Tiles are clickable for details and travel.
 */
export class MapPanel extends Component {
  private canvas!: HTMLCanvasElement;
  private detailEl!: HTMLElement;
  private regionNameEl!: HTMLElement;
  private overworld: OverworldData | null = null;
  private playerPos: { x: number; y: number } | null = null;
  private cursorPos: { x: number; y: number } | null = null;
  private selectedTile: { x: number; y: number } | null = null;
  private scale = 3; // pixels per tile
  private offsetX = 0;
  private offsetY = 0;
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragStartOffsetX = 0;
  private dragStartOffsetY = 0;
  private active = false;
  /** Optional callback to check if player can see map edge in a direction */
  private edgeChecker: ((dx: number, dy: number) => boolean) | null = null;

  constructor(parent: HTMLElement, engine: GameEngine) {
    super(parent, engine);
  }

  protected createElement(): HTMLElement {
    const wrapper = el('div', { class: 'map-panel panel' });

    // Header
    const header = el('div', { class: 'map-header' });
    header.appendChild(el('span', { class: 'map-header-title font-heading' }, ['World Map']));
    wrapper.appendChild(header);

    // Region name display
    this.regionNameEl = el('div', { class: 'map-region-name' });
    wrapper.appendChild(this.regionNameEl);

    // Canvas container
    const canvasWrap = el('div', { class: 'map-canvas-wrap' });
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'map-canvas';
    canvasWrap.appendChild(this.canvas);
    wrapper.appendChild(canvasWrap);

    // Detail panel (shown on tile click)
    this.detailEl = el('div', { class: 'map-detail map-detail--hidden' });
    wrapper.appendChild(this.detailEl);

    return wrapper;
  }

  protected setupEvents(): void {
    // Click on canvas → select tile
    this.listen(this.canvas, 'click', (e: Event) => {
      const me = e as MouseEvent;
      if (this.isDragging) return;
      const tile = this.canvasToTile(me.offsetX, me.offsetY);
      if (tile) {
        if (this.selectedTile && this.selectedTile.x === tile.x && this.selectedTile.y === tile.y) {
          this.hideDetail();
        } else {
          this.showDetail(tile.x, tile.y);
        }
      }
    });

    // Drag to pan
    this.listen(this.canvas, 'mousedown', (e: Event) => {
      const me = e as MouseEvent;
      this.isDragging = false;
      this.dragStartX = me.clientX;
      this.dragStartY = me.clientY;
      this.dragStartOffsetX = this.offsetX;
      this.dragStartOffsetY = this.offsetY;

      const onMove = (e2: MouseEvent) => {
        const dx = e2.clientX - this.dragStartX;
        const dy = e2.clientY - this.dragStartY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          this.isDragging = true;
        }
        this.offsetX = this.dragStartOffsetX + dx;
        this.offsetY = this.dragStartOffsetY + dy;
        this.renderMap();
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        // Reset isDragging after a tick so click handler can check it
        setTimeout(() => { this.isDragging = false; }, 0);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    // Scroll to zoom
    this.listen(this.canvas, 'wheel', (e: Event) => {
      const we = e as WheelEvent;
      we.preventDefault();
      const oldScale = this.scale;
      const delta = we.deltaY > 0 ? -0.5 : 0.5;
      this.scale = Math.max(1, Math.min(8, this.scale + delta));

      // Zoom toward cursor
      if (this.scale !== oldScale) {
        const rect = this.canvas.getBoundingClientRect();
        const cx = we.clientX - rect.left;
        const cy = we.clientY - rect.top;
        const ratio = this.scale / oldScale;
        this.offsetX = cx - (cx - this.offsetX) * ratio;
        this.offsetY = cy - (cy - this.offsetY) * ratio;
      }

      this.renderMap();
    });
  }

  /** Set the overworld data to render. */
  setOverworld(overworld: OverworldData): void {
    this.overworld = overworld;
    this.regionNameEl.textContent = overworld.name;
    this.calculateInitialView();
    this.renderMap();
  }

  /** Set the player's current overworld position. */
  /** Set a callback that checks if the party can see the map edge in a direction */
  setEdgeChecker(fn: (dx: number, dy: number) => boolean): void {
    this.edgeChecker = fn;
  }

  setPlayerPosition(x: number, y: number): void {
    this.playerPos = { x, y };
    // Initialize cursor at player position
    if (!this.cursorPos) {
      this.cursorPos = { x, y };
    }
    this.renderMap();
  }

  /** Activate the map (call when overlay opens). */
  activate(): void {
    if (this.active) return;
    this.active = true;

    // Reset cursor to player position
    if (this.playerPos) {
      this.cursorPos = { ...this.playerPos };
      this.showDetail(this.cursorPos.x, this.cursorPos.y);
    }

    this.renderMap();
  }

  /** Deactivate the map (call when overlay closes). */
  deactivate(): void {
    this.active = false;
  }

  /** Handle cursor movement from KeyboardInput events. */
  moveCursor(dx: number, dy: number): void {
    if (!this.overworld || !this.cursorPos) return;
    const nx = Math.max(0, Math.min(this.overworld.width - 1, this.cursorPos.x + dx));
    const ny = Math.max(0, Math.min(this.overworld.height - 1, this.cursorPos.y + dy));
    this.cursorPos = { x: nx, y: ny };
    this.showDetail(nx, ny);
    this.scrollCursorIntoView();
  }

  /** Handle travel command from KeyboardInput events. */
  travelToCursor(): void {
    if (!this.overworld || !this.cursorPos) return;
    if (!this.isAdjacentToPlayer(this.cursorPos.x, this.cursorPos.y)) return;

    const tile = this.overworld.tiles[this.cursorPos.y][this.cursorPos.x];
    if (!isTraversable(tile.terrain)) return;

    // Check edge visibility
    if (this.edgeChecker && this.playerPos) {
      const dx = this.cursorPos.x - this.playerPos.x;
      const dy = this.cursorPos.y - this.playerPos.y;
      if (!this.edgeChecker(dx, dy)) return;
    }

    this.engine.events.emit({
      type: 'overworld:travel',
      category: 'ui',
      data: { x: this.cursorPos.x, y: this.cursorPos.y },
    });
    this.hideDetail();
  }

  /** Scroll the view so the cursor is visible. */
  private scrollCursorIntoView(): void {
    if (!this.cursorPos) return;
    const cx = this.offsetX + this.cursorPos.x * this.scale + this.scale / 2;
    const cy = this.offsetY + this.cursorPos.y * this.scale + this.scale / 2;
    const margin = 40;

    let moved = false;
    if (cx < margin) { this.offsetX += margin - cx; moved = true; }
    if (cx > this.canvas.width - margin) { this.offsetX -= cx - (this.canvas.width - margin); moved = true; }
    if (cy < margin) { this.offsetY += margin - cy; moved = true; }
    if (cy > this.canvas.height - margin) { this.offsetY -= cy - (this.canvas.height - margin); moved = true; }

    if (moved) this.renderMap();
  }

  /** Center the map view on the player. Also resizes canvas to fit container. */
  centerOnPlayer(): void {
    if (!this.playerPos || !this.overworld) return;

    // Resize canvas to match current container size
    const container = this.canvas.parentElement;
    if (container) {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
      }
    }

    const cw = this.canvas.width;
    const ch = this.canvas.height;
    this.offsetX = cw / 2 - this.playerPos.x * this.scale - this.scale / 2;
    this.offsetY = ch / 2 - this.playerPos.y * this.scale - this.scale / 2;
    this.renderMap();
  }

  // ── Legacy API compatibility (called from GameScreen.setGameState) ──

  setRegion(): void {
    // No-op: overworld map doesn't use region-based rendering
  }

  setCurrentLocation(): void {
    // No-op: use setPlayerPosition instead
  }

  highlightPath(): void {
    // No-op
  }

  // ── Rendering ──

  private calculateInitialView(): void {
    if (!this.overworld) return;

    // Size canvas to fill container
    const container = this.canvas.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const cw = Math.max(400, rect.width || 600);
    const ch = Math.max(300, rect.height || 400);
    this.canvas.width = cw;
    this.canvas.height = ch;

    // Fit the map to the canvas
    const scaleX = cw / this.overworld.width;
    const scaleY = ch / this.overworld.height;
    this.scale = Math.max(1, Math.min(8, Math.floor(Math.min(scaleX, scaleY))));

    // Center
    const mapW = this.overworld.width * this.scale;
    const mapH = this.overworld.height * this.scale;
    this.offsetX = (cw - mapW) / 2;
    this.offsetY = (ch - mapH) / 2;
  }

  private renderMap(): void {
    if (!this.overworld) return;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    const cw = this.canvas.width;
    const ch = this.canvas.height;

    // Clear
    ctx.fillStyle = '#080808';
    ctx.fillRect(0, 0, cw, ch);

    const ow = this.overworld.width;
    const oh = this.overworld.height;
    const s = this.scale;

    // Compute visible tile range
    const startX = Math.max(0, Math.floor(-this.offsetX / s));
    const startY = Math.max(0, Math.floor(-this.offsetY / s));
    const endX = Math.min(ow, Math.ceil((cw - this.offsetX) / s));
    const endY = Math.min(oh, Math.ceil((ch - this.offsetY) / s));

    // Draw terrain tiles
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const tile = this.overworld.tiles[y][x];
        let color = TERRAIN_COLORS[tile.terrain] ?? '#333333';

        // River override
        if (tile.river && tile.terrain !== 'deep_water' && tile.terrain !== 'shallow_water') {
          color = RIVER_COLOR;
        }

        ctx.fillStyle = color;
        ctx.fillRect(
          this.offsetX + x * s,
          this.offsetY + y * s,
          s, s,
        );

        // Settlement dot
        if (tile.settlement && s >= 2) {
          ctx.fillStyle = SETTLEMENT_COLORS[tile.settlement] ?? '#ffffff';
          const dotSize = Math.max(2, s);
          const offset = (s - dotSize) / 2;
          ctx.fillRect(
            this.offsetX + x * s + offset,
            this.offsetY + y * s + offset,
            dotSize, dotSize,
          );
        }
      }
    }

    // Draw cursor (keyboard selection)
    if (this.cursorPos && this.active) {
      const cx = this.offsetX + this.cursorPos.x * s;
      const cy = this.offsetY + this.cursorPos.y * s;

      // Pulsing cursor border
      ctx.strokeStyle = '#c8a84e';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - 1, cy - 1, s + 2, s + 2);

      // Inner highlight
      ctx.fillStyle = 'rgba(200, 168, 78, 0.15)';
      ctx.fillRect(cx, cy, s, s);
    }

    // Draw selected tile highlight (mouse click, only when no keyboard cursor)
    if (this.selectedTile && !this.active) {
      const sx = this.offsetX + this.selectedTile.x * s;
      const sy = this.offsetY + this.selectedTile.y * s;
      ctx.strokeStyle = '#c8a84e';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx - 1, sy - 1, s + 2, s + 2);
    }

    // Draw player position
    if (this.playerPos) {
      const px = this.offsetX + this.playerPos.x * s + s / 2;
      const py = this.offsetY + this.playerPos.y * s + s / 2;
      const r = Math.max(3, s * 0.6);

      // Glow
      ctx.beginPath();
      ctx.arc(px, py, r + 2, 0, Math.PI * 2);
      ctx.fillStyle = PLAYER_GLOW;
      ctx.fill();

      // Dot
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = PLAYER_COLOR;
      ctx.fill();

      // Border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // ── Tile ↔ Canvas coordinate mapping ──

  private canvasToTile(canvasX: number, canvasY: number): { x: number; y: number } | null {
    if (!this.overworld) return null;

    const tileX = Math.floor((canvasX - this.offsetX) / this.scale);
    const tileY = Math.floor((canvasY - this.offsetY) / this.scale);

    if (tileX < 0 || tileX >= this.overworld.width || tileY < 0 || tileY >= this.overworld.height) {
      return null;
    }
    return { x: tileX, y: tileY };
  }

  // ── Detail Panel ──

  private showDetail(x: number, y: number): void {
    if (!this.overworld) return;
    const tile = this.overworld.tiles[y][x];

    this.selectedTile = { x, y };
    this.detailEl.innerHTML = '';
    this.detailEl.classList.remove('map-detail--hidden');

    const isPlayerHere = this.playerPos?.x === x && this.playerPos?.y === y;
    const isAdjacent = this.isAdjacentToPlayer(x, y);
    const traversable = isTraversable(tile.terrain);

    // Header
    const header = el('div', { class: 'map-detail-header' });

    // Color swatch
    const swatch = el('span', { class: 'map-detail-swatch' });
    swatch.style.backgroundColor = TERRAIN_COLORS[tile.terrain];
    header.appendChild(swatch);

    // Name
    const name = tile.settlement && tile.settlementName
      ? tile.settlementName
      : getTerrainName(tile.terrain);
    header.appendChild(el('span', { class: 'map-detail-name font-heading' }, [name]));

    // Close button
    const closeBtn = el('button', { class: 'map-detail-close btn btn-ghost' }, ['\u2715']);
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hideDetail();
    });
    header.appendChild(closeBtn);
    this.detailEl.appendChild(header);

    // Type badge
    const typeLabel = tile.settlement
      ? SETTLEMENT_LABELS[tile.settlement]
      : getTerrainName(tile.terrain);
    const typeBadge = el('div', { class: 'map-detail-type font-mono' }, [typeLabel]);
    if (isPlayerHere) {
      typeBadge.appendChild(el('span', { class: 'map-detail-current-badge' }, [' \u2022 You are here']));
    }
    this.detailEl.appendChild(typeBadge);

    // Coordinates
    this.detailEl.appendChild(
      el('div', { class: 'map-detail-coords font-mono' }, [`(${x}, ${y})`]),
    );

    // Region info
    const owRegion = this.overworld.regions.find(r => r.id === tile.regionId);
    if (owRegion) {
      this.detailEl.appendChild(
        el('div', { class: 'map-detail-sub font-mono' }, [`Region: ${owRegion.name}`]),
      );
    }

    // Tile properties
    if (tile.river) {
      this.detailEl.appendChild(
        el('div', { class: 'map-detail-sub font-mono' }, ['\u2022 River flows through here']),
      );
    }

    // Travel button — must be adjacent, traversable, and player must see the map edge
    const canSeeEdge = isAdjacent && this.playerPos
      ? (!this.edgeChecker || this.edgeChecker(x - this.playerPos.x, y - this.playerPos.y))
      : true;

    if (!isPlayerHere && isAdjacent && traversable && canSeeEdge) {
      const travelBtn = el('button', { class: 'btn btn-primary map-detail-travel' }, [
        `Travel to ${name}`,
      ]);
      travelBtn.addEventListener('click', () => {
        this.engine.events.emit({
          type: 'overworld:travel',
          category: 'ui',
          data: { x, y },
        });
        this.hideDetail();
      });
      this.detailEl.appendChild(travelBtn);
    } else if (!isPlayerHere && isAdjacent && traversable && !canSeeEdge) {
      this.detailEl.appendChild(
        el('div', { class: 'map-detail-unreachable font-mono' }, [
          'Reach the edge of the local map in that direction first.',
        ]),
      );
    } else if (!isPlayerHere && !isAdjacent) {
      this.detailEl.appendChild(
        el('div', { class: 'map-detail-unreachable font-mono' }, [
          'Too far — travel to an adjacent tile first.',
        ]),
      );
    } else if (!traversable && !isPlayerHere) {
      this.detailEl.appendChild(
        el('div', { class: 'map-detail-unreachable font-mono' }, [
          'This terrain is impassable on foot.',
        ]),
      );
    }

    this.renderMap();
  }

  private hideDetail(): void {
    this.selectedTile = null;
    this.detailEl.classList.add('map-detail--hidden');
    this.detailEl.innerHTML = '';
    this.renderMap();
  }

  private isAdjacentToPlayer(x: number, y: number): boolean {
    if (!this.playerPos) return false;
    const dx = Math.abs(x - this.playerPos.x);
    const dy = Math.abs(y - this.playerPos.y);
    // 8-directional adjacency
    return dx <= 1 && dy <= 1 && !(dx === 0 && dy === 0);
  }
}
