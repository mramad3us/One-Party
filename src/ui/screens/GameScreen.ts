import type { GameEngine } from '@/engine/GameEngine';
import type { NarrativeBlock } from '@/types/narrative';
import type { Character, Coordinate, EntityId, Region, SurvivalState } from '@/types';
import type { GameTime } from '@/types/core';
import { Component } from '@/ui/Component';
import { NarrativePanel } from '@/ui/panels/NarrativePanel';
import { PartyPanel, type PartyMember } from '@/ui/panels/PartyPanel';
import { StatusPanel } from '@/ui/panels/StatusPanel';
import { ActionPanel, type ActionContext, type KeyboardHint } from '@/ui/panels/ActionPanel';
import { MapPanel } from '@/ui/panels/MapPanel';
import { GridPanel } from '@/ui/panels/GridPanel';
import { IconSystem } from '@/ui/IconSystem';
import type { EntityRenderInfo } from '@/grid/GridRenderer';
import { Grid } from '@/grid/Grid';
import { FogOfWar } from '@/grid/FogOfWar';
import { TimeNarrator } from '@/narrative/TimeNarrator';
import { SurvivalRules } from '@/rules/SurvivalRules';
import { el } from '@/utils/dom';

export interface GameScreenState {
  mode: 'exploration' | 'combat';
  partyMembers: PartyMember[];
  region?: Region;
  currentLocationId?: EntityId;
}

/**
 * Main game screen — CDDA-inspired two-panel layout.
 *
 * Left:  Local map (ASCII grid) — dominant panel
 * Right: Chronicle log (narrative) — scrollable side panel
 * Top:   Compact status bar with roleplay time, character vitals, survival
 * Bottom: Keyboard hints (hidden by default, toggle with ?)
 *
 * World map is a separate overlay triggered by 'm'.
 */
export class GameScreen extends Component {
  private narrativePanel!: NarrativePanel;
  private statusPanel!: StatusPanel;
  private partyPanel!: PartyPanel;
  private actionPanel!: ActionPanel;
  private mapPanel!: MapPanel;
  private gridPanel!: GridPanel;

  private gridWrap!: HTMLElement;
  private narrativeWrap!: HTMLElement;
  private actionWrap!: HTMLElement;
  private mapOverlay!: HTMLElement;
  private mapOverlayVisible = false;
  private hintsVisible = false;

  // Status bar elements
  private timeEl!: HTMLElement;
  private lightEl!: HTMLElement;
  private survivalStatusEl!: HTMLElement;
  private locationEl!: HTMLElement;

  // @ts-expect-error Written for future combat mode toggling
  private currentMode: 'exploration' | 'combat' = 'exploration';

  constructor(parent: HTMLElement, engine: GameEngine) {
    super(parent, engine);
  }

  protected createElement(): HTMLElement {
    const screen = el('div', { class: 'game-screen screen' });

    // ── Status Bar (compact, roleplay-driven) ──
    const statusBar = el('div', { class: 'game-statusbar' });

    // Left group: time & light
    const statusLeft = el('div', { class: 'game-statusbar-group' });
    this.timeEl = el('span', { class: 'game-statusbar-time font-mono' }, ['Dawn, Day 1']);
    this.lightEl = el('span', { class: 'game-statusbar-light font-mono' }, ['Pale dawn light']);
    statusLeft.appendChild(this.timeEl);
    statusLeft.appendChild(el('span', { class: 'game-statusbar-sep' }, ['\u2502']));
    statusLeft.appendChild(this.lightEl);
    statusBar.appendChild(statusLeft);

    // Center: location
    this.locationEl = el('span', { class: 'game-statusbar-location font-heading' });
    statusBar.appendChild(this.locationEl);

    // Right group: survival summary + menu buttons
    const statusRight = el('div', { class: 'game-statusbar-group' });
    this.survivalStatusEl = el('span', { class: 'game-statusbar-survival font-mono' });
    statusRight.appendChild(this.survivalStatusEl);

    statusRight.appendChild(el('span', { class: 'game-statusbar-sep' }, ['\u2502']));

    statusRight.appendChild(IconSystem.iconButton('save', 'Saves', () => {
      this.engine.events.emit({ type: 'ui:open_saves', category: 'ui', data: {} });
    }));

    const quitBtn = IconSystem.iconButton('close', 'Quit to Menu', () => {
      this.engine.events.emit({ type: 'ui:quit_to_menu', category: 'ui', data: {} });
    });
    quitBtn.classList.add('game-statusbar-quit');
    statusRight.appendChild(quitBtn);
    statusBar.appendChild(statusRight);

    screen.appendChild(statusBar);

    // ── Two-Panel Layout ──
    const layout = el('div', { class: 'game-layout-local' });

    // Left panel: ASCII grid map (dominant)
    this.gridWrap = el('div', { class: 'game-panel-map' });
    this.gridPanel = new GridPanel(this.gridWrap, this.engine);
    layout.appendChild(this.gridWrap);

    // Right panel: Chronicle log
    this.narrativeWrap = el('div', { class: 'game-panel-log' });

    // Compact character status at top of log panel
    const statusSection = el('div', { class: 'game-log-status' });
    this.statusPanel = new StatusPanel(statusSection, this.engine);
    this.narrativeWrap.appendChild(statusSection);

    // Narrative log fills rest
    const logSection = el('div', { class: 'game-log-narrative' });
    this.narrativePanel = new NarrativePanel(logSection, this.engine);
    this.narrativeWrap.appendChild(logSection);

    layout.appendChild(this.narrativeWrap);

    screen.appendChild(layout);

    // ── Action bar (keyboard hints, hidden by default) ──
    this.actionWrap = el('div', { class: 'game-action-wrap game-action-wrap--hidden' });
    this.actionPanel = new ActionPanel(this.actionWrap, this.engine);
    screen.appendChild(this.actionWrap);

    // ── Hidden panels ──
    // Party panel (not shown in main layout, available for future use)
    const hiddenParty = el('div', { style: 'display:none' });
    this.partyPanel = new PartyPanel(hiddenParty, this.engine);

    // World map overlay (triggered by 'm')
    this.mapOverlay = el('div', { class: 'game-map-overlay game-map-overlay--hidden' });
    const mapOverlayInner = el('div', { class: 'game-map-overlay-inner' });
    const mapHeader = el('div', { class: 'game-map-overlay-header' });
    mapHeader.appendChild(el('span', { class: 'game-map-overlay-title font-heading' }, ['World Map']));
    const closeBtn = el('button', { class: 'btn btn-ghost game-map-overlay-close' }, ['\u2715']);
    closeBtn.addEventListener('click', () => this.hideWorldMap());
    mapHeader.appendChild(closeBtn);
    mapOverlayInner.appendChild(mapHeader);

    const mapContent = el('div', { class: 'game-map-overlay-content' });
    this.mapPanel = new MapPanel(mapContent, this.engine);
    mapOverlayInner.appendChild(mapContent);

    mapOverlayInner.appendChild(el('div', { class: 'game-map-overlay-hint font-mono' }, ['Press [m] or [Esc] to close']));
    this.mapOverlay.appendChild(mapOverlayInner);
    screen.appendChild(this.mapOverlay);

    return screen;
  }

  protected setupEvents(): void {
    this.addChild(this.statusPanel);
    this.addChild(this.partyPanel);
    this.addChild(this.narrativePanel);
    this.addChild(this.gridPanel);
    this.addChild(this.actionPanel);
    this.addChild(this.mapPanel);

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
  }

  enterCombatMode(grid?: Grid, fog?: FogOfWar): void {
    this.currentMode = 'combat';
    if (grid && fog) {
      this.gridPanel.initGrid(grid, fog);
    }
  }

  exitCombatMode(): void {
    this.currentMode = 'exploration';
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

  setCharacter(character: Character): void {
    this.statusPanel.setCharacter(character);
    this.updateSurvivalStatus(character);
  }

  updateSurvival(survival: SurvivalState): void {
    this.statusPanel.updateSurvival(survival);
  }

  getGridPanel(): GridPanel {
    return this.gridPanel;
  }

  getNarrativePanel(): NarrativePanel {
    return this.narrativePanel;
  }

  // ── Time Display ──

  /** Update the roleplay time display from game time. */
  updateTime(time: GameTime): void {
    this.timeEl.textContent = TimeNarrator.shortTime(time);
    this.lightEl.textContent = TimeNarrator.getLightDescription(time);
  }

  /** Set the location name in the status bar. */
  setLocationName(name: string): void {
    this.locationEl.textContent = name;
  }

  // ── Survival Status (compact bar summary) ──

  private updateSurvivalStatus(character: Character): void {
    const s = character.survival;
    const parts: string[] = [];

    // Only show survival stats that are notable (above 20%)
    const hungerT = SurvivalRules.getHungerThreshold(s.hunger);
    const thirstT = SurvivalRules.getThirstThreshold(s.thirst);
    const fatigueT = SurvivalRules.getFatigueThreshold(s.fatigue);

    // Only show when actually concerning (skip the "fine" early tiers)
    const hungerFine = hungerT === 'satiated' || hungerT === 'comfortable';
    const thirstFine = thirstT === 'quenched' || thirstT === 'hydrated';
    const fatigueFine = fatigueT === 'rested' || fatigueT === 'alert';

    if (!hungerFine) parts.push(this.formatSurvivalTag('hunger', hungerT, s.hunger));
    if (!thirstFine) parts.push(this.formatSurvivalTag('thirst', thirstT, s.thirst));
    if (!fatigueFine) parts.push(this.formatSurvivalTag('fatigue', fatigueT, s.fatigue));

    // HP
    const hpPct = character.currentHp / character.maxHp;
    if (hpPct < 1) {
      const hpClass = hpPct > 0.5 ? 'status-warn' : hpPct > 0.25 ? 'status-danger' : 'status-critical';
      parts.push(`<span class="${hpClass}">HP ${character.currentHp}/${character.maxHp}</span>`);
    }

    this.survivalStatusEl.innerHTML = parts.length > 0
      ? parts.join(' <span class="game-statusbar-sep">\u2502</span> ')
      : '<span class="status-good">Healthy</span>';
  }

  private formatSurvivalTag(_type: string, threshold: string, value: number): string {
    const cls = value <= 30 ? 'status-good' : value <= 50 ? 'status-warn' : value <= 75 ? 'status-danger' : 'status-critical';
    const label = SurvivalRules.formatThreshold(threshold);
    return `<span class="${cls}">${label}</span>`;
  }

  // ── Local Mode ──

  /** Enter local exploration mode: two-panel layout is already default. */
  enterLocalMode(grid: Grid, fog: FogOfWar): void {
    this.currentMode = 'exploration';
    this.gridPanel.initGrid(grid, fog);
  }

  /** Update the player entity on the grid. */
  updatePlayerEntity(
    playerId: EntityId,
    position: { x: number; y: number },
    info: EntityRenderInfo,
  ): void {
    const placements = new Map();
    placements.set(playerId, { entityId: playerId, position, size: 1 });
    this.gridPanel.updateEntities(placements, (id) => id === playerId ? info : undefined);
  }

  /** Center the grid camera on a position. */
  centerGrid(position: Coordinate): void {
    this.gridPanel.centerOn(position);
  }

  /** Set keyboard hints on the action panel. */
  setKeyboardHints(hints: KeyboardHint[]): void {
    this.actionPanel.setKeyboardHints(hints);
  }

  // ── Help Toggle ──

  /** Toggle keyboard hints visibility (bound to ?) */
  toggleHelp(): void {
    this.hintsVisible = !this.hintsVisible;
    if (this.hintsVisible) {
      this.actionWrap.classList.remove('game-action-wrap--hidden');
    } else {
      this.actionWrap.classList.add('game-action-wrap--hidden');
    }
  }

  // ── World Map Overlay ──

  showWorldMap(): void {
    this.mapOverlayVisible = true;
    this.mapOverlay.classList.remove('game-map-overlay--hidden');
  }

  hideWorldMap(): void {
    this.mapOverlayVisible = false;
    this.mapOverlay.classList.add('game-map-overlay--hidden');
  }

  toggleWorldMap(): void {
    if (this.mapOverlayVisible) {
      this.hideWorldMap();
    } else {
      this.showWorldMap();
    }
  }

  isWorldMapVisible(): boolean {
    return this.mapOverlayVisible;
  }
}
