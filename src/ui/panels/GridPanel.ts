import type { GameEngine } from '@/engine/GameEngine';
import type { Coordinate, EntityId, GridEntityPlacement } from '@/types';
import { Component } from '@/ui/Component';
import { Grid } from '@/grid/Grid';
import { FogOfWar } from '@/grid/FogOfWar';
import { GridRenderer, type EntityRenderInfo } from '@/grid/GridRenderer';
import { GridInteraction, type InteractionMode, type GridAction } from '@/grid/GridInteraction';
import { el } from '@/utils/dom';

/**
 * Component wrapper around GridRenderer + GridInteraction,
 * integrating the canvas-based grid into the UI component system.
 */
export class GridPanel extends Component {
  private renderer: GridRenderer | null = null;
  private interaction: GridInteraction | null = null;
  private grid: Grid | null = null;
  private fog: FogOfWar | null = null;
  private containerEl!: HTMLElement;
  private renderLoop: number | null = null;
  private entityPlacements: Map<EntityId, GridEntityPlacement> = new Map();
  private entityInfoFn: ((id: EntityId) => EntityRenderInfo | undefined) | null = null;

  /** External handler for grid actions (selection, movement, targeting). */
  onGridAction: ((action: GridAction) => void) | null = null;

  constructor(parent: HTMLElement, engine: GameEngine) {
    super(parent, engine);
  }

  protected createElement(): HTMLElement {
    const wrapper = el('div', { class: 'grid-panel' });
    this.containerEl = el('div', { class: 'grid-panel-canvas' });
    wrapper.appendChild(this.containerEl);
    return wrapper;
  }

  initGrid(grid: Grid, fog: FogOfWar): void {
    this.destroyRenderer();

    this.grid = grid;
    this.fog = fog;

    this.renderer = new GridRenderer(this.containerEl);
    this.interaction = new GridInteraction(this.renderer, grid, (action) => {
      this.onGridAction?.(action);
    });
    this.interaction.enable();

    // Start render loop
    this.startRenderLoop();
  }

  updateEntities(
    placements: Map<EntityId, GridEntityPlacement>,
    getInfo: (id: EntityId) => EntityRenderInfo | undefined,
  ): void {
    this.entityPlacements = placements;
    this.entityInfoFn = getInfo;
  }

  highlightMovement(cells: Set<string>): void {
    this.renderer?.highlightCells(cells, 'rgba(50,100,255,0.8)', 0.25);
  }

  highlightAttack(cells: Coordinate[]): void {
    this.renderer?.highlightCells(cells, 'rgba(255,50,50,0.8)', 0.3);
  }

  showPath(path: Coordinate[]): void {
    this.renderer?.showPath(path);
  }

  clearHighlights(): void {
    this.renderer?.clearHighlights();
  }

  setInteractionMode(mode: InteractionMode): void {
    this.interaction?.setMode(mode);
  }

  centerOn(position: Coordinate): void {
    this.renderer?.centerOn(position);
  }

  override destroy(): void {
    this.destroyRenderer();
    super.destroy();
  }

  private startRenderLoop(): void {
    const loop = (): void => {
      if (!this.renderer || !this.grid || !this.fog) return;

      this.renderer.render(this.grid, this.fog);
      if (this.entityInfoFn) {
        this.renderer.renderEntities(this.entityPlacements, this.entityInfoFn);
      }

      this.renderLoop = requestAnimationFrame(loop);
    };
    this.renderLoop = requestAnimationFrame(loop);
  }

  private destroyRenderer(): void {
    if (this.renderLoop !== null) {
      cancelAnimationFrame(this.renderLoop);
      this.renderLoop = null;
    }
    this.interaction?.destroy();
    this.interaction = null;
    this.renderer?.destroy();
    this.renderer = null;
    this.grid = null;
    this.fog = null;
  }
}
