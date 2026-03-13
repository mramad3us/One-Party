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

/**
 * Context-sensitive action button panel.
 * Buttons animate in with a stagger when context changes.
 */
export class ActionPanel extends Component {
  private buttonContainer!: HTMLElement;
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

    // Button row
    this.buttonContainer = el('div', { class: 'action-panel-buttons' });
    wrapper.appendChild(this.buttonContainer);

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

}
