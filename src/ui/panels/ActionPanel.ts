import type { GameEngine } from '@/engine/GameEngine';
import { Component } from '@/ui/Component';
import { Button } from '@/ui/widgets/Button';
import { AnimationSystem } from '@/ui/AnimationSystem';
import { TooltipSystem } from '@/ui/TooltipSystem';
import { el } from '@/utils/dom';

export interface ActionOption {
  id: string;
  label: string;
  icon?: string;
  description?: string;
  enabled: boolean;
  onClick: () => void;
}

export type ActionContext =
  | { type: 'exploration'; actions: ActionOption[] }
  | { type: 'combat'; actions: ActionOption[] }
  | { type: 'dialogue'; actions: ActionOption[] }
  | { type: 'location'; actions: ActionOption[] };

export interface KeyboardHint {
  key: string;
  label: string;
  available: boolean;
  category: 'movement' | 'action' | 'meta';
}

/**
 * Context-sensitive action button panel.
 * Buttons animate in with a stagger when context changes.
 */
export class ActionPanel extends Component {
  private buttonContainer!: HTMLElement;
  private hintContainer!: HTMLElement;
  private currentButtons: Button[] = [];
  private contextLabel!: HTMLElement;
  constructor(parent: HTMLElement, engine: GameEngine) {
    super(parent, engine);
  }

  protected createElement(): HTMLElement {
    const wrapper = el('div', { class: 'action-panel' });

    // Context label
    this.contextLabel = el('div', { class: 'action-panel-context' });
    wrapper.appendChild(this.contextLabel);

    // Button row (classic mode)
    this.buttonContainer = el('div', { class: 'action-panel-buttons' });
    wrapper.appendChild(this.buttonContainer);

    // Keyboard hint container (CDDA mode)
    this.hintContainer = el('div', { class: 'action-hints action-hints--hidden' });
    wrapper.appendChild(this.hintContainer);

    return wrapper;
  }

  protected setupEvents(): void {
    TooltipSystem.getInstance().registerContainer(this.el);
  }

  setContext(context: ActionContext): void {
    // Update context label
    const labels: Record<string, string> = {
      exploration: 'Exploration',
      combat: 'Combat',
      dialogue: 'Dialogue',
      location: 'Location',
    };
    this.contextLabel.textContent = labels[context.type] ?? '';
    this.contextLabel.className = `action-panel-context action-panel-context--${context.type}`;

    this.setActions(context.actions);
  }

  setActions(actions: ActionOption[]): void {
    // Clear old buttons
    for (const btn of this.currentButtons) {
      btn.destroy();
    }
    this.currentButtons = [];
    this.buttonContainer.innerHTML = '';

    // Create new buttons with stagger
    for (const action of actions) {
      const btn = new Button(this.buttonContainer, this.engine, {
        label: action.label,
        icon: action.icon,
        variant: action.enabled ? 'secondary' : undefined,
        disabled: !action.enabled,
        onClick: action.onClick,
        tooltip: action.description,
        className: 'action-btn',
      });
      btn.mount();
      this.currentButtons.push(btn);
    }

    // Stagger animation on the containers
    const slotEls = Array.from(this.buttonContainer.children) as HTMLElement[];
    AnimationSystem.stagger(slotEls, 'animate-slide-in-up', 60);
  }

  disableAll(): void {
    for (const btn of this.currentButtons) {
      btn.setDisabled(true);
    }
  }

  enableAll(): void {
    for (const btn of this.currentButtons) {
      btn.setDisabled(false);
    }
  }

  /** Switch to keyboard hint mode (CDDA-style). */
  setKeyboardHints(hints: KeyboardHint[]): void {
    // keyboard hint mode active
    this.buttonContainer.classList.add('action-panel-buttons--hidden');
    this.hintContainer.classList.remove('action-hints--hidden');
    this.hintContainer.innerHTML = '';

    this.contextLabel.textContent = 'Exploration';
    this.contextLabel.className = 'action-panel-context action-panel-context--exploration';

    // Group hints by category
    const groups: Record<string, KeyboardHint[]> = {
      movement: [],
      action: [],
      meta: [],
    };
    for (const hint of hints) {
      groups[hint.category].push(hint);
    }

    const groupLabels: Record<string, string> = {
      movement: 'Movement',
      action: 'Actions',
      meta: 'Menu',
    };

    for (const [category, categoryHints] of Object.entries(groups)) {
      if (categoryHints.length === 0) continue;

      const group = el('div', { class: 'action-hint-group' });
      group.appendChild(el('div', { class: 'action-hint-group-title font-mono' }, [groupLabels[category]]));

      const list = el('div', { class: 'action-hint-list' });
      for (const hint of categoryHints) {
        const item = el('div', {
          class: `action-hint-item${hint.available ? '' : ' action-hint-item--dim'}`,
        });
        item.appendChild(el('span', { class: 'action-hint-key font-mono' }, [`[${hint.key}]`]));
        item.appendChild(el('span', { class: 'action-hint-label font-mono' }, [hint.label]));
        list.appendChild(item);
      }

      group.appendChild(list);
      this.hintContainer.appendChild(group);
    }
  }

  /** Switch back to button mode. */
  setButtonMode(): void {
    // button mode active
    this.buttonContainer.classList.remove('action-panel-buttons--hidden');
    this.hintContainer.classList.add('action-hints--hidden');
  }

}
