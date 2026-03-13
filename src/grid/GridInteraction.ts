import type { Coordinate, EntityId } from '@/types';
import { coordToKey } from '@/utils/math';
import { Grid } from './Grid';
import { GridRenderer } from './GridRenderer';
import { Pathfinder } from './Pathfinder';

/** Interaction modes for grid input. */
export type InteractionMode =
  | { type: 'select' }
  | { type: 'move'; entityId: EntityId; reachable: Set<string> }
  | { type: 'target'; validTargets: EntityId[]; range: number; origin: Coordinate }
  | { type: 'area'; shape: 'circle' | 'cone' | 'line'; size: number; origin: Coordinate };

/** Actions generated from grid interaction. */
export type GridAction =
  | { type: 'select_entity'; entityId: EntityId }
  | { type: 'select_cell'; position: Coordinate }
  | { type: 'move_to'; position: Coordinate }
  | { type: 'target_entity'; entityId: EntityId }
  | { type: 'target_area'; cells: Coordinate[] };

/**
 * Handles mouse/keyboard input for the grid.
 * Translates raw input events into semantic GridActions based on the current mode.
 */
export class GridInteraction {
  private mode: InteractionMode = { type: 'select' };
  private pathfinder = new Pathfinder();
  private enabled = false;

  constructor(
    private renderer: GridRenderer,
    private grid: Grid,
    private onAction: (action: GridAction) => void,
  ) {}

  enable(): void {
    if (this.enabled) return;
    this.enabled = true;

    this.renderer.onCellHover = this.handleHover;
    this.renderer.onCellClick = this.handleClick;
  }

  disable(): void {
    this.enabled = false;
    this.renderer.onCellHover = null;
    this.renderer.onCellClick = null;
    this.renderer.clearHighlights();
  }

  setMode(mode: InteractionMode): void {
    this.mode = mode;
    this.renderer.clearHighlights();

    switch (mode.type) {
      case 'move':
        // Highlight reachable cells
        this.renderer.highlightCells(mode.reachable, 'rgba(50,100,255,0.8)', 0.25);
        break;

      case 'target':
        // Highlight valid target range
        this.renderer.showRange(mode.origin, mode.range, 'rgba(255,50,50,0.8)');
        break;

      case 'area':
        // Area preview will follow cursor in handleHover
        break;
    }
  }

  destroy(): void {
    this.disable();
  }

  // ── Event handlers ───────────────────────────────────────────

  private handleHover = (coord: Coordinate | null): void => {
    if (!coord || !this.enabled) return;

    switch (this.mode.type) {
      case 'move': {
        const key = coordToKey(coord);
        if (this.mode.reachable.has(key)) {
          const entityPos = this.grid.getEntityPosition(this.mode.entityId);
          if (entityPos) {
            const size = this.grid.getEntityPlacement(this.mode.entityId)?.size ?? 1;
            const path = this.pathfinder.findPath(
              this.grid,
              entityPos,
              coord,
              size,
              Infinity,
            );
            if (path.reachable) {
              this.renderer.showPath(path.path);
            }
          }
        } else {
          this.renderer.showPath([]);
        }
        break;
      }

      case 'area': {
        // Show area preview centered on cursor
        const areaCells = this.getAreaCells(this.mode.origin, coord, this.mode.shape, this.mode.size);
        this.renderer.clearHighlights();
        this.renderer.highlightCells(areaCells, 'rgba(255,100,50,0.8)', 0.3);
        break;
      }
    }
  };

  private handleClick = (coord: Coordinate): void => {
    if (!this.enabled) return;

    switch (this.mode.type) {
      case 'select': {
        const entityId = this.grid.getEntityAt(coord);
        if (entityId) {
          this.onAction({ type: 'select_entity', entityId });
        } else {
          this.onAction({ type: 'select_cell', position: coord });
        }
        break;
      }

      case 'move': {
        const key = coordToKey(coord);
        if (this.mode.reachable.has(key)) {
          this.onAction({ type: 'move_to', position: coord });
        }
        break;
      }

      case 'target': {
        const entityId = this.grid.getEntityAt(coord);
        if (entityId && this.mode.validTargets.includes(entityId)) {
          this.onAction({ type: 'target_entity', entityId });
        }
        break;
      }

      case 'area': {
        const areaCells = this.getAreaCells(this.mode.origin, coord, this.mode.shape, this.mode.size);
        this.onAction({ type: 'target_area', cells: areaCells });
        break;
      }
    }
  };

  // ── Area helpers ─────────────────────────────────────────────

  private getAreaCells(
    origin: Coordinate,
    target: Coordinate,
    shape: 'circle' | 'cone' | 'line',
    size: number,
  ): Coordinate[] {
    const radiusCells = Math.ceil(size / 5);
    const cells: Coordinate[] = [];

    switch (shape) {
      case 'circle': {
        for (let dy = -radiusCells; dy <= radiusCells; dy++) {
          for (let dx = -radiusCells; dx <= radiusCells; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) * 5 <= size) {
              cells.push({ x: target.x + dx, y: target.y + dy });
            }
          }
        }
        break;
      }

      case 'line': {
        const ddx = target.x - origin.x;
        const ddy = target.y - origin.y;
        const dist = Math.max(Math.abs(ddx), Math.abs(ddy));
        if (dist === 0) break;

        const stepX = ddx / dist;
        const stepY = ddy / dist;

        for (let i = 1; i <= radiusCells; i++) {
          cells.push({
            x: Math.round(origin.x + stepX * i),
            y: Math.round(origin.y + stepY * i),
          });
        }
        break;
      }

      case 'cone': {
        // Simplified cone: fan shape in the direction of target
        const ddx = target.x - origin.x;
        const ddy = target.y - origin.y;
        const angle = Math.atan2(ddy, ddx);
        const halfAngle = Math.PI / 4; // 45-degree half-angle

        for (let dy = -radiusCells; dy <= radiusCells; dy++) {
          for (let dx = -radiusCells; dx <= radiusCells; dx++) {
            if (dx === 0 && dy === 0) continue;
            const cellDist = Math.max(Math.abs(dx), Math.abs(dy));
            if (cellDist > radiusCells) continue;

            const cellAngle = Math.atan2(dy, dx);
            let angleDiff = Math.abs(cellAngle - angle);
            if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

            if (angleDiff <= halfAngle) {
              cells.push({ x: origin.x + dx, y: origin.y + dy });
            }
          }
        }
        break;
      }
    }

    return cells;
  }
}
