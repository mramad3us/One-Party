import type { GameEngine } from '@/engine/GameEngine';
import type { Component } from './Component';
import { AnimationSystem } from './AnimationSystem';

export type ScreenName =
  | 'menu'
  | 'creation'
  | 'game'
  | 'combat'
  | 'inventory'
  | 'character'
  | 'death';

/**
 * Screen orchestrator. Manages screen transitions with
 * smooth directional animations.
 */
export class UIManager {
  private container: HTMLElement;
  private currentScreen: Component | null = null;
  private currentName: ScreenName | null = null;
  private screenFactories: Map<ScreenName, () => Component> = new Map();
  private transitioning = false;

  constructor(
    container: HTMLElement,
    private engine: GameEngine,
  ) {
    this.container = container;
    this.container.classList.add('screen-container');
  }

  /** Register a factory function that creates a screen component. */
  registerScreen(name: ScreenName, factory: () => Component): void {
    this.screenFactories.set(name, factory);
  }

  /**
   * Transition to a new screen with directional animation.
   * The outgoing screen slides out, the incoming screen slides in.
   */
  async switchScreen(
    name: ScreenName,
    direction: 'left' | 'right' | 'up' | 'down' = 'left',
  ): Promise<void> {
    if (this.transitioning) return;
    if (name === this.currentName) return;

    const factory = this.screenFactories.get(name);
    if (!factory) {
      console.error(`Screen "${name}" not registered`);
      return;
    }

    this.transitioning = true;

    const incoming = factory();
    const outgoing = this.currentScreen;

    // Mount incoming (off-screen)
    incoming.mount();
    const incomingEl = this.container.lastElementChild as HTMLElement;

    if (outgoing && incomingEl) {
      const outgoingEl = incomingEl.previousElementSibling as HTMLElement;
      if (outgoingEl) {
        await AnimationSystem.screenTransition(outgoingEl, incomingEl, direction);
      }
      outgoing.destroy();
      outgoingEl?.remove();
    }

    this.currentScreen = incoming;
    this.currentName = name;
    this.transitioning = false;

    this.engine.events.emit({
      type: 'ui:screen:changed',
      category: 'ui',
      data: { screen: name },
    });
  }

  /** Get the name of the currently active screen. */
  getCurrentScreen(): ScreenName | null {
    return this.currentName;
  }
}
