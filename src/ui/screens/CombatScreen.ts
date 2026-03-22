import type { GameEngine } from '@/engine/GameEngine';
import type { EntityId, Coordinate, DamageType, ActionResult } from '@/types';
import { Component } from '@/ui/Component';
import { AnimationSystem } from '@/ui/AnimationSystem';
import { ProgressBar } from '@/ui/widgets/ProgressBar';
import { el } from '@/utils/dom';

export interface CombatantDisplay {
  entityId: EntityId;
  name: string;
  initiative: number;
  isPlayer: boolean;
  isAlly: boolean;
  currentHp: number;
  maxHp: number;
}

export interface TurnState {
  canMove: boolean;
  canAction: boolean;
  canBonusAction: boolean;
  remainingMovement: number;
  maxMovement: number;
}

/**
 * Combat HUD overlay: initiative bar, turn info, damage numbers,
 * and action result toasts. Renders on top of the grid panel.
 */
/** Converts a grid coordinate to screen-space pixel center. */
export type GridToScreenFn = (pos: Coordinate) => { x: number; y: number };

export class CombatHUD extends Component {
  private initiativeBar!: HTMLElement;
  private turnInfo!: HTMLElement;
  private toastContainer!: HTMLElement;
  private damageContainer!: HTMLElement;
  private combatantEls: Map<EntityId, HTMLElement> = new Map();
  private hpBars: Map<EntityId, ProgressBar> = new Map();
  private currentTurnId: EntityId | null = null;
  private gridToScreen: GridToScreenFn | null = null;

  constructor(parent: HTMLElement, engine: GameEngine) {
    super(parent, engine);
  }

  /** Set the coordinate converter and damage overlay container (on the grid canvas). */
  setGridOverlay(fn: GridToScreenFn, damageContainer: HTMLElement): void {
    this.gridToScreen = fn;
    this.damageContainer = damageContainer;
  }

  protected createElement(): HTMLElement {
    const wrapper = el('div', { class: 'combat-hud' });

    // Initiative tracker bar (top)
    this.initiativeBar = el('div', { class: 'combat-initiative-bar' });
    wrapper.appendChild(this.initiativeBar);

    // Turn info (below initiative)
    this.turnInfo = el('div', { class: 'combat-turn-info' });
    wrapper.appendChild(this.turnInfo);

    // Toast container for action results
    this.toastContainer = el('div', { class: 'combat-toast-container' });
    wrapper.appendChild(this.toastContainer);

    return wrapper;
  }

  setInitiativeOrder(combatants: CombatantDisplay[]): void {
    // Track old positions for FLIP animation
    const oldEls = Array.from(this.initiativeBar.children) as HTMLElement[];

    this.initiativeBar.innerHTML = '';
    this.combatantEls.clear();
    for (const bar of this.hpBars.values()) {
      bar.destroy();
    }
    this.hpBars.clear();
    this.children = this.children.filter((c) => !(c instanceof ProgressBar));

    const sorted = [...combatants].sort((a, b) => b.initiative - a.initiative);

    for (const c of sorted) {
      const combEl = this.createCombatantEl(c);
      this.combatantEls.set(c.entityId, combEl);
      this.initiativeBar.appendChild(combEl);
    }

    // FLIP animate if we had previous elements
    if (oldEls.length > 0) {
      const newEls = Array.from(this.initiativeBar.children) as HTMLElement[];
      AnimationSystem.stagger(newEls, 'animate-slide-in-down', 50);
    }
  }

  setCurrentTurn(entityId: EntityId): void {
    // Remove old highlight
    if (this.currentTurnId) {
      const oldEl = this.combatantEls.get(this.currentTurnId);
      oldEl?.classList.remove('combat-combatant--active');
    }

    this.currentTurnId = entityId;

    // Add new highlight
    const newEl = this.combatantEls.get(entityId);
    if (newEl) {
      newEl.classList.add('combat-combatant--active');
      // Scroll into view
      newEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  setTurnState(state: TurnState): void {
    this.turnInfo.innerHTML = '';

    const indicators = el('div', { class: 'combat-turn-indicators' });

    // Action icons
    const actionIcon = el('span', {
      class: `combat-turn-icon ${state.canAction ? 'combat-turn-icon--available' : 'combat-turn-icon--used'}`,
    }, ['A']);
    actionIcon.setAttribute('data-tooltip', state.canAction ? 'Action available' : 'Action used');
    indicators.appendChild(actionIcon);

    const bonusIcon = el('span', {
      class: `combat-turn-icon ${state.canBonusAction ? 'combat-turn-icon--available' : 'combat-turn-icon--used'}`,
    }, ['B']);
    bonusIcon.setAttribute('data-tooltip', state.canBonusAction ? 'Bonus action available' : 'Bonus action used');
    indicators.appendChild(bonusIcon);

    const moveIcon = el('span', {
      class: `combat-turn-icon ${state.canMove ? 'combat-turn-icon--available' : 'combat-turn-icon--used'}`,
    }, ['M']);
    moveIcon.setAttribute('data-tooltip', `Movement: ${state.remainingMovement}/${state.maxMovement} ft`);
    indicators.appendChild(moveIcon);

    this.turnInfo.appendChild(indicators);

    // Movement bar
    const moveBar = el('div', { class: 'combat-turn-movement' });
    const moveFill = el('div', { class: 'combat-turn-movement-fill' });
    const movePct = state.maxMovement > 0 ? (state.remainingMovement / state.maxMovement) * 100 : 0;
    moveFill.style.width = `${movePct}%`;
    moveBar.appendChild(moveFill);
    moveBar.appendChild(el('span', { class: 'combat-turn-movement-label' }, [
      `${state.remainingMovement} ft`,
    ]));
    this.turnInfo.appendChild(moveBar);
  }

  showActionResult(result: ActionResult): void {
    const toast = el('div', { class: `combat-toast ${result.success ? 'combat-toast--success' : 'combat-toast--miss'}` });
    toast.textContent = result.description;

    this.toastContainer.appendChild(toast);

    // Slide in from the right
    toast.style.transform = 'translateX(100%)';
    toast.style.opacity = '0';
    requestAnimationFrame(() => {
      toast.style.transition = 'transform 0.4s var(--ease-out-back), opacity 0.3s var(--ease-smooth)';
      toast.style.transform = 'translateX(0)';
      toast.style.opacity = '1';
    });

    // Fade out after delay
    setTimeout(() => {
      toast.style.transition = 'transform 0.3s var(--ease-smooth), opacity 0.3s var(--ease-smooth)';
      toast.style.transform = 'translateX(100%)';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  showDamageNumber(position: Coordinate, damage: number, type: DamageType): void {
    const isHealing = damage < 0;
    const absVal = Math.abs(damage);
    const isCrit = absVal >= 20; // Heuristic for big hits

    const numEl = el('div', {
      class: `combat-damage-number ${isHealing ? 'combat-damage-number--heal' : 'combat-damage-number--damage'} ${isCrit ? 'combat-damage-number--crit' : ''}`,
    }, [isHealing ? `+${absVal}` : String(absVal)]);

    // Position based on grid coordinate → screen pixel
    const screen = this.gridToScreen
      ? this.gridToScreen(position)
      : { x: position.x * 40 + 20, y: position.y * 40 };
    numEl.style.left = `${screen.x}px`;
    numEl.style.top = `${screen.y}px`;

    // Type label
    if (type !== 'bludgeoning' && type !== 'slashing' && type !== 'piercing') {
      const typeLabel = el('span', { class: 'combat-damage-type' }, [type]);
      numEl.appendChild(typeLabel);
    }

    this.damageContainer.appendChild(numEl);

    // Float up + fade out animation
    numEl.animate([
      { transform: 'translateY(0) scale(1)', opacity: '1' },
      { transform: `translateY(-60px) scale(${isCrit ? 1.3 : 1})`, opacity: '1', offset: 0.5 },
      { transform: `translateY(-80px) scale(${isCrit ? 1.1 : 0.9})`, opacity: '0' },
    ], {
      duration: isCrit ? 1500 : 1000,
      easing: 'cubic-bezier(0, 0.55, 0.45, 1)',
      fill: 'forwards',
    }).finished.then(() => numEl.remove());
  }

  /** Get the initiative bar element for a given entity (for mini dice overlays). */
  getCombatantEl(entityId: EntityId): HTMLElement | null {
    return this.combatantEls.get(entityId) ?? null;
  }

  private createCombatantEl(c: CombatantDisplay): HTMLElement {
    const classes = ['combat-combatant'];
    if (c.isPlayer) classes.push('combat-combatant--player');
    else if (c.isAlly) classes.push('combat-combatant--ally');
    else classes.push('combat-combatant--enemy');

    const combEl = el('div', { class: classes.join(' ') });

    // Initiative number
    combEl.appendChild(el('span', { class: 'combat-combatant-init' }, [String(c.initiative)]));

    // Symbol/portrait placeholder
    const symbol = c.isPlayer ? '\u2726' : c.isAlly ? '\u2666' : '\u2620';
    combEl.appendChild(el('span', { class: 'combat-combatant-symbol' }, [symbol]));

    // Name
    combEl.appendChild(el('span', { class: 'combat-combatant-name' }, [c.name]));

    // Mini HP bar
    const hpWrap = el('div', { class: 'combat-combatant-hp' });
    const hpBar = new ProgressBar(hpWrap, this.engine, {
      value: c.currentHp,
      max: c.maxHp,
      variant: 'hp',
      showLabel: false,
      animated: true,
    });
    this.addChild(hpBar);
    this.hpBars.set(c.entityId, hpBar);
    combEl.appendChild(hpWrap);

    return combEl;
  }
}
