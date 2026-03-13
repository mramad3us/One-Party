import type { GameEngine } from '@/engine/GameEngine';
import type { NarrativeBlock } from '@/types/narrative';
import type { EntityId, Region } from '@/types';
import { Component } from '@/ui/Component';
import { NarrativePanel } from '@/ui/panels/NarrativePanel';
import { PartyPanel, type PartyMember } from '@/ui/panels/PartyPanel';
import { ActionPanel, type ActionContext } from '@/ui/panels/ActionPanel';
import { MapPanel } from '@/ui/panels/MapPanel';
import { GridPanel } from '@/ui/panels/GridPanel';
import { IconSystem } from '@/ui/IconSystem';
import { Grid } from '@/grid/Grid';
import { FogOfWar } from '@/grid/FogOfWar';
import { el } from '@/utils/dom';

export interface GameScreenState {
  mode: 'exploration' | 'combat';
  partyMembers: PartyMember[];
  region?: Region;
  currentLocationId?: EntityId;
}

/**
 * Main game screen: party panel (left), narrative/grid (center),
 * action bar (bottom center), sidebar with map (right).
 * Switches between exploration (narrative) and combat (grid) modes.
 */
export class GameScreen extends Component {
  private narrativePanel!: NarrativePanel;
  private partyPanel!: PartyPanel;
  private actionPanel!: ActionPanel;
  private mapPanel!: MapPanel;
  private gridPanel!: GridPanel;

  private mainViewEl!: HTMLElement;
  private narrativeWrap!: HTMLElement;
  private gridWrap!: HTMLElement;
  private sidebarEl!: HTMLElement;
  private sidebarVisible = true;
  private currentMode: 'exploration' | 'combat' = 'exploration';

  constructor(parent: HTMLElement, engine: GameEngine) {
    super(parent, engine);
  }

  protected createElement(): HTMLElement {
    const screen = el('div', { class: 'game-screen screen' });

    // ── Top Bar ──
    const topBar = el('div', { class: 'game-topbar' });

    const titleGroup = el('div', { class: 'game-topbar-title' });
    titleGroup.appendChild(el('span', { class: 'game-topbar-logo font-heading' }, ['ONE PARTY']));
    topBar.appendChild(titleGroup);

    const timeDisplay = el('div', { class: 'game-topbar-time font-mono' }, ['Day 1']);
    topBar.appendChild(timeDisplay);

    const topActions = el('div', { class: 'game-topbar-actions' });
    topActions.appendChild(IconSystem.iconButton('save', 'Save Game', () => {
      this.engine.events.emit({ type: 'ui:action:save', category: 'ui', data: {} });
    }));
    topActions.appendChild(IconSystem.iconButton('cog', 'Settings', () => {
      this.engine.events.emit({ type: 'ui:action:settings', category: 'ui', data: {} });
    }));
    topActions.appendChild(IconSystem.iconButton('bars', 'Menu', () => {
      this.engine.events.emit({ type: 'ui:navigate', category: 'ui', data: { screen: 'menu', direction: 'right' } });
    }));
    topBar.appendChild(topActions);
    screen.appendChild(topBar);

    // ── Main Layout (CSS Grid) ──
    const layout = el('div', { class: 'game-layout' });

    // Left: Party Panel
    const leftCol = el('div', { class: 'game-col-left' });
    this.partyPanel = new PartyPanel(leftCol, this.engine);
    layout.appendChild(leftCol);

    // Center: Main view + action bar
    const centerCol = el('div', { class: 'game-col-center' });

    // Main view area (switches narrative / grid)
    this.mainViewEl = el('div', { class: 'game-main-view' });

    this.narrativeWrap = el('div', { class: 'game-narrative-wrap' });
    this.narrativePanel = new NarrativePanel(this.narrativeWrap, this.engine);
    this.mainViewEl.appendChild(this.narrativeWrap);

    this.gridWrap = el('div', { class: 'game-grid-wrap game-grid-wrap--hidden' });
    this.gridPanel = new GridPanel(this.gridWrap, this.engine);
    this.mainViewEl.appendChild(this.gridWrap);

    centerCol.appendChild(this.mainViewEl);

    // Action bar
    const actionWrap = el('div', { class: 'game-action-wrap' });
    this.actionPanel = new ActionPanel(actionWrap, this.engine);
    centerCol.appendChild(actionWrap);

    layout.appendChild(centerCol);

    // Right: Sidebar
    this.sidebarEl = el('div', { class: 'game-col-right' });

    // Sidebar toggle
    const sidebarToggle = el('button', { class: 'game-sidebar-toggle btn btn-ghost' }, ['\u276E']);
    sidebarToggle.addEventListener('click', () => this.toggleSidebar());
    this.sidebarEl.appendChild(sidebarToggle);

    this.mapPanel = new MapPanel(this.sidebarEl, this.engine);
    layout.appendChild(this.sidebarEl);

    screen.appendChild(layout);

    return screen;
  }

  protected setupEvents(): void {
    // Mount child panels
    this.addChild(this.partyPanel);
    this.addChild(this.narrativePanel);
    this.addChild(this.gridPanel);
    this.addChild(this.actionPanel);
    this.addChild(this.mapPanel);

    // Listen for game events
    this.subscribe('narrative:*', (event) => {
      const block = event.data['block'] as NarrativeBlock | undefined;
      if (block) {
        this.narrativePanel.addBlock(block);
      }
    });
  }

  setGameState(state: GameScreenState): void {
    this.partyPanel.setMembers(state.partyMembers);

    if (state.region) {
      this.mapPanel.setRegion(state.region);
    }
    if (state.currentLocationId) {
      this.mapPanel.setCurrentLocation(state.currentLocationId);
    }

    if (state.mode !== this.currentMode) {
      if (state.mode === 'combat') {
        this.enterCombatMode();
      } else {
        this.exitCombatMode();
      }
    }
  }

  enterCombatMode(grid?: Grid, fog?: FogOfWar): void {
    this.currentMode = 'combat';

    if (grid && fog) {
      this.gridPanel.initGrid(grid, fog);
    }

    // Animate transition
    this.narrativeWrap.style.transition = 'opacity 0.4s var(--ease-smooth), transform 0.4s var(--ease-smooth)';
    this.narrativeWrap.style.opacity = '0';
    this.narrativeWrap.style.transform = 'translateX(-30px)';

    setTimeout(() => {
      this.narrativeWrap.classList.add('game-narrative-wrap--hidden');
      this.gridWrap.classList.remove('game-grid-wrap--hidden');

      requestAnimationFrame(() => {
        this.gridWrap.style.transition = 'opacity 0.4s var(--ease-smooth), transform 0.4s var(--ease-out-back)';
        this.gridWrap.style.opacity = '1';
        this.gridWrap.style.transform = 'translateX(0)';
      });
    }, 400);
  }

  exitCombatMode(): void {
    this.currentMode = 'exploration';

    this.gridWrap.style.transition = 'opacity 0.4s var(--ease-smooth), transform 0.4s var(--ease-smooth)';
    this.gridWrap.style.opacity = '0';
    this.gridWrap.style.transform = 'translateX(30px)';

    setTimeout(() => {
      this.gridWrap.classList.add('game-grid-wrap--hidden');
      this.narrativeWrap.classList.remove('game-narrative-wrap--hidden');

      this.narrativeWrap.style.opacity = '0';
      this.narrativeWrap.style.transform = 'translateX(-30px)';

      requestAnimationFrame(() => {
        this.narrativeWrap.style.transition = 'opacity 0.4s var(--ease-smooth), transform 0.4s var(--ease-out-back)';
        this.narrativeWrap.style.opacity = '1';
        this.narrativeWrap.style.transform = 'translateX(0)';
      });
    }, 400);
  }

  addNarrative(block: NarrativeBlock): void {
    this.narrativePanel.addBlock(block);
  }

  updateParty(members: PartyMember[]): void {
    this.partyPanel.setMembers(members);
  }

  setActions(context: ActionContext): void {
    this.actionPanel.setContext(context);
  }

  getGridPanel(): GridPanel {
    return this.gridPanel;
  }

  getNarrativePanel(): NarrativePanel {
    return this.narrativePanel;
  }

  private toggleSidebar(): void {
    this.sidebarVisible = !this.sidebarVisible;

    const toggleBtn = this.$('.game-sidebar-toggle');
    if (toggleBtn) {
      toggleBtn.textContent = this.sidebarVisible ? '\u276E' : '\u276F';
    }

    if (this.sidebarVisible) {
      this.sidebarEl.classList.remove('game-col-right--collapsed');
    } else {
      this.sidebarEl.classList.add('game-col-right--collapsed');
    }
  }
}
