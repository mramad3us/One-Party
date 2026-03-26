import type { GameEngine } from '@/engine/GameEngine';
import type { NarrativeBlock } from '@/types/narrative';
import type { Character, Coordinate, EntityId, GridDefinition, GridEntityPlacement, Region, SurvivalState } from '@/types';
import type { GameTime } from '@/types/core';
import type { OverworldData } from '@/types/overworld';
import { Component } from '@/ui/Component';
import { NarrativePanel } from '@/ui/panels/NarrativePanel';
import { PartyPanel, type PartyMember } from '@/ui/panels/PartyPanel';
import { StatusPanel } from '@/ui/panels/StatusPanel';
import { ActionPanel, type ActionContext, type KeyboardHint } from '@/ui/panels/ActionPanel';
import { MapPanel } from '@/ui/panels/MapPanel';
import { GridPanel } from '@/ui/panels/GridPanel';
import { CombatHUD, type CombatantDisplay } from '@/ui/screens/CombatScreen';
import { IconSystem } from '@/ui/IconSystem';
import type { EntityRenderInfo } from '@/grid/GridRenderer';
import { Grid } from '@/grid/Grid';
import { FogOfWar } from '@/grid/FogOfWar';
import { TimeNarrator } from '@/narrative/TimeNarrator';
import { SurvivalRules } from '@/rules/SurvivalRules';
import { SunArc } from '@/ui/widgets/SunArc';
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
  private travelLogEl!: HTMLElement;
  private travelSunArc!: SunArc;
  private travelInfoBar!: HTMLElement;
  private isTraveling = false;
  private hintsVisible = false;

  // Combat HUD
  private combatHUD: CombatHUD | null = null;
  private combatActionBar!: HTMLElement;
  private combatDiceContainer!: HTMLElement;
  private combatGrid: Grid | null = null;
  private combatFog: FogOfWar | null = null;

  // Status bar elements
  private sunArc!: SunArc;
  private timeEl!: HTMLElement;
  private lightEl!: HTMLElement;
  private survivalStatusEl!: HTMLElement;
  private locationEl!: HTMLElement;

  private currentMode: 'exploration' | 'combat' = 'exploration';

  constructor(parent: HTMLElement, engine: GameEngine) {
    super(parent, engine);
  }

  protected createElement(): HTMLElement {
    const screen = el('div', { class: 'game-screen screen' });

    // ── Status Bar (compact, roleplay-driven) ──
    const statusBar = el('div', { class: 'game-statusbar' });

    // Left group: sun arc + time & light
    const statusLeft = el('div', { class: 'game-statusbar-group' });
    const sunArcWrap = el('div', { class: 'game-statusbar-sun-arc' });
    this.sunArc = new SunArc(sunArcWrap, this.engine, 'compact');
    statusLeft.appendChild(sunArcWrap);
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

    // ── Combat action bar (hidden until combat) ──
    this.combatActionBar = el('div', { class: 'combat-action-bar combat-action-bar--hidden' });
    screen.appendChild(this.combatActionBar);

    // Dice roll animation container (used by CombatController for initiative/attack/damage rolls)
    this.combatDiceContainer = el('div', { class: 'combat-dice-container' });
    screen.appendChild(this.combatDiceContainer);

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
    closeBtn.addEventListener('click', () => {
      this.engine.events.emit({ type: 'input:cancel', category: 'ui', data: {} });
    });
    mapHeader.appendChild(closeBtn);
    mapOverlayInner.appendChild(mapHeader);

    const mapContent = el('div', { class: 'game-map-overlay-content' });
    this.mapPanel = new MapPanel(mapContent, this.engine);

    // Travel info bar + log: overlay inside the map content area (position: absolute)
    this.travelInfoBar = el('div', { class: 'travel-info-bar travel-info-bar--hidden' });
    const travelSunWrap = el('div', { class: 'travel-sun-wrap' });
    this.travelSunArc = new SunArc(travelSunWrap, this.engine, 'large');
    this.travelInfoBar.appendChild(travelSunWrap);
    mapContent.appendChild(this.travelInfoBar);

    this.travelLogEl = el('div', { class: 'travel-log travel-log--hidden' });
    mapContent.appendChild(this.travelLogEl);

    mapOverlayInner.appendChild(mapContent);

    mapOverlayInner.appendChild(el('div', { class: 'game-map-overlay-hint font-mono' }, ['Arrows/WASD: move cursor \u2022 Enter: travel \u2022 m/Esc: close']));
    this.mapOverlay.appendChild(mapOverlayInner);
    screen.appendChild(this.mapOverlay);

    return screen;
  }

  protected setupEvents(): void {
    this.addChild(this.sunArc);
    this.addChild(this.travelSunArc);
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
    // Overworld map is set via setOverworld() — region/location are legacy no-ops
  }

  enterCombatMode(gridDef: GridDefinition, participants: CombatantDisplay[]): void {
    this.currentMode = 'combat';

    // Build grid + fog — reveal from all combatant starting positions
    const grid = new Grid(gridDef);
    const fog = new FogOfWar();
    this.combatGrid = grid;
    this.combatFog = fog;

    this.gridPanel.initGrid(grid, fog);

    // Tell renderer the map size so it centers small maps in the viewport
    this.gridPanel.setMapSize(gridDef.width, gridDef.height);
    this.gridPanel.centerOn({ x: Math.floor(gridDef.width / 2), y: Math.floor(gridDef.height / 2) });

    // Mount CombatHUD on the grid wrapper
    if (this.combatHUD) {
      this.combatHUD.destroy();
    }
    this.combatHUD = new CombatHUD(this.gridWrap, this.engine);
    this.combatHUD.mount();
    this.addChild(this.combatHUD);
    this.combatHUD.setInitiativeOrder(participants);

    // Always show combat action bar during combat — it's the primary keyboard reference
    this.combatActionBar.classList.remove('combat-action-bar--hidden');
    // Hide the exploration hints panel during combat (the action bar replaces it)
    this.actionWrap.classList.add('game-action-wrap--hidden');

    // Add combat mode class for CSS
    this.el.classList.add('game-screen--combat');
  }

  exitCombatMode(): void {
    this.currentMode = 'exploration';
    this.combatGrid = null;
    this.combatFog = null;

    // Clear small-map centering offset
    this.gridPanel.setMapSize(0, 0);

    // Remove CombatHUD from DOM (unmount removes element + cleans up)
    if (this.combatHUD) {
      this.removeChild(this.combatHUD);
      this.combatHUD = null;
    }

    // Hide combat action bar, restore exploration hints if they were visible
    this.combatActionBar.classList.add('combat-action-bar--hidden');
    this.combatActionBar.innerHTML = '';
    if (this.hintsVisible) {
      this.actionWrap.classList.remove('game-action-wrap--hidden');
    }

    // Clear any leftover dice roll elements
    this.combatDiceContainer.innerHTML = '';

    // Remove combat mode class
    this.el.classList.remove('game-screen--combat');
  }

  isInCombat(): boolean {
    return this.currentMode === 'combat';
  }

  getCombatHUD(): CombatHUD | null {
    return this.combatHUD;
  }

  getCombatDiceContainer(): HTMLElement {
    return this.combatDiceContainer;
  }

  /** Returns the grid wrapper element (used as screen shake target). */
  getGridWrap(): HTMLElement {
    return this.gridWrap;
  }

  /** Set combat action buttons (Attack, Dash, Dodge, etc.) */
  setCombatActions(actions: { label: string; key: string; enabled: boolean; isBonusAction?: boolean; group?: string; onClick: () => void }[]): void {
    this.combatActionBar.innerHTML = '';
    if (actions.length === 0) return;

    // Movement hint on the left
    const moveHint = el('div', { class: 'combat-action-move-hint' });
    moveHint.innerHTML = '<span class="combat-action-move-keys">hjkl</span><span class="combat-action-move-label">move</span>';
    this.combatActionBar.appendChild(moveHint);

    this.combatActionBar.appendChild(el('div', { class: 'combat-action-sep' }));

    // Group buttons by their group label
    const groups: { name: string; buttons: typeof actions }[] = [];
    let currentGroup = '';
    for (const action of actions) {
      const g = action.group ?? 'actions';
      if (g !== currentGroup) {
        currentGroup = g;
        groups.push({ name: g, buttons: [] });
      }
      groups[groups.length - 1].buttons.push(action);
    }

    const groupLabels: Record<string, string> = {
      actions: 'ACTION',
      bonus: 'BONUS',
      surge: 'FREE',
      end: '',
    };

    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi];

      // Add separator between groups
      if (gi > 0) {
        this.combatActionBar.appendChild(el('div', { class: 'combat-action-sep' }));
      }

      const groupEl = el('div', { class: `combat-action-group combat-action-group--${group.name}` });

      // Group label
      const label = groupLabels[group.name];
      if (label) {
        groupEl.appendChild(el('span', { class: 'combat-action-group-label' }, [label]));
      }

      const btnsWrap = el('div', { class: 'combat-action-group-buttons' });
      for (const action of group.buttons) {
        const classes = ['combat-action-btn'];
        if (!action.enabled) classes.push('combat-action-btn--disabled');
        if (action.isBonusAction) classes.push('combat-action-btn--bonus');
        if (group.name === 'end') classes.push('combat-action-btn--end');
        if (group.name === 'surge') classes.push('combat-action-btn--surge');
        const btn = el('button', { class: classes.join(' ') });
        btn.innerHTML = `<span class="combat-action-btn-key">${action.key}</span><span class="combat-action-btn-label">${action.label}</span>`;
        if (action.enabled) {
          btn.addEventListener('click', action.onClick);
        } else {
          btn.setAttribute('disabled', 'true');
        }
        btnsWrap.appendChild(btn);
      }
      groupEl.appendChild(btnsWrap);

      this.combatActionBar.appendChild(groupEl);
    }

    // Help hint on the right
    this.combatActionBar.appendChild(el('div', { class: 'combat-action-sep' }));
    const helpHint = el('div', { class: 'combat-action-help-hint' });
    helpHint.innerHTML = '<span class="combat-action-btn-key">?</span><span class="combat-action-move-label">help</span>';
    this.combatActionBar.appendChild(helpHint);
  }

  /** Update entity placements on the combat grid. */
  updateCombatEntities(
    placements: Map<EntityId, GridEntityPlacement>,
    getInfo: (id: EntityId) => EntityRenderInfo | undefined,
  ): void {
    this.gridPanel.updateEntities(placements, getInfo);
  }

  /**
   * Update combat fog of war from observer positions.
   * Call after any entity movement to reveal newly visible cells.
   */
  updateCombatFog(observers: { position: Coordinate; range: number }[]): void {
    if (!this.combatGrid || !this.combatFog) return;
    this.combatFog.updateVisibility(this.combatGrid, observers);
    // Set full light on all newly visible tiles
    const w = this.combatGrid.getWidth();
    const h = this.combatGrid.getHeight();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (this.combatFog.isVisible(x, y)) {
          this.combatFog.setLightLevel(x, y, 10);
        }
      }
    }
  }

  clearNarrative(): void {
    this.narrativePanel.clear();
  }

  addNarrative(block: NarrativeBlock): void {
    this.narrativePanel.addBlock(block);
    // Mirror to travel log when journeying
    if (this.isTraveling) {
      const cat = block.category === 'action' ? 'action'
        : block.category === 'system' ? 'system'
        : 'description';
      this.addTravelLog(block.text, cat);
    }
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
    this.sunArc.updateTime(time);
  }

  /** Get the sun arc widget (for time-spending activity overlays). */
  getSunArc(): SunArc {
    return this.sunArc;
  }

  /** Get the travel sun arc on the map overlay. */
  getTravelSunArc(): SunArc {
    return this.travelSunArc;
  }

  /** Show the travel log + sun arc on the map overlay. */
  startTravelLog(initialTime: GameTime): void {
    this.travelLogEl.innerHTML = '';
    this.travelLogEl.classList.remove('travel-log--hidden');
    this.travelInfoBar.classList.remove('travel-info-bar--hidden');
    this.travelSunArc.updateTime(initialTime);
    this.isTraveling = true;
  }

  /** Add a line to the travel log on the map overlay. */
  addTravelLog(text: string, category: 'action' | 'description' | 'system' = 'description'): void {
    const entry = el('div', { class: `travel-log-entry travel-log-entry--${category}` }, [text]);
    this.travelLogEl.appendChild(entry);
    this.travelLogEl.scrollTop = this.travelLogEl.scrollHeight;
  }

  /** Hide the travel log + sun arc. */
  endTravelLog(): void {
    this.isTraveling = false;
    this.travelLogEl.classList.add('travel-log--hidden');
    this.travelInfoBar.classList.add('travel-info-bar--hidden');
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

  /** Update the player entity on the grid (preserves existing NPC entities). */
  updatePlayerEntity(
    playerId: EntityId,
    position: { x: number; y: number },
    info: EntityRenderInfo,
  ): void {
    // Merge player into existing placements instead of replacing them all
    const existing = this.gridPanel.getEntityPlacements();
    const placements = new Map(existing);
    placements.set(playerId, { entityId: playerId, position, size: 1 });

    const existingInfoFn = this.gridPanel.getEntityInfoFn();
    this.gridPanel.updateEntities(placements, (id) => {
      if (id === playerId) return info;
      return existingInfoFn?.(id);
    });
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
    // During combat, the action bar is always visible — don't toggle it
    if (this.currentMode === 'combat') return;

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
    // Re-center on player when opening (also triggers canvas resize)
    requestAnimationFrame(() => {
      this.centerWorldMapOnPlayer();
      this.mapPanel.activate();
    });
  }

  hideWorldMap(): void {
    this.mapOverlayVisible = false;
    this.mapOverlay.classList.add('game-map-overlay--hidden');
    this.mapPanel.deactivate();
  }

  /** Move the world map cursor by delta. */
  moveMapCursor(dx: number, dy: number): void {
    this.mapPanel.moveCursor(dx, dy);
  }

  /** Travel to the current cursor position on the world map. */
  travelToMapCursor(): void {
    this.mapPanel.travelToCursor();
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

  /** Set the overworld data for the world map canvas. */
  setOverworld(overworld: OverworldData): void {
    this.mapPanel.setOverworld(overworld);
  }

  /** Set edge-visibility checker for travel gating */
  setEdgeChecker(fn: (dx: number, dy: number) => boolean): void {
    this.mapPanel.setEdgeChecker(fn);
  }

  /** Set supply checker for journey planning */
  setSupplyChecker(fn: (tiles: number) => { sufficient: boolean; maxTiles: number; limitingFactor: string | null }): void {
    this.mapPanel.setSupplyChecker(fn);
  }

  /** Update the player's overworld tile position on the map. */
  setOverworldPosition(x: number, y: number): void {
    this.mapPanel.setPlayerPosition(x, y);
  }

  /** Center the world map view on the player. */
  centerWorldMapOnPlayer(): void {
    this.mapPanel.centerOnPlayer();
  }

  /** Update player position on map during travel animation. */
  setOverworldPositionAnimated(x: number, y: number): void {
    this.mapPanel.setPlayerPositionAnimated(x, y);
  }

  /** Set the travel path being animated. */
  setTravelPath(path: import('@/types').Coordinate[], index: number): void {
    this.mapPanel.setTravelPath(path, index);
  }

  /** Clear travel animation state. */
  clearTravelPath(): void {
    this.mapPanel.clearTravelPath();
  }
}
