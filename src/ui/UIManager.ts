import type { GameEngine } from '@/engine/GameEngine';
import type { Component } from './Component';
import { AnimationSystem } from './AnimationSystem';

export type ScreenName =
  | 'menu'
  | 'worldcreation'
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
  private cachedScreens: Map<ScreenName, Component> = new Map();
  private persistentScreens: Set<ScreenName> = new Set();
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

  /** Mark a screen as persistent — it won't be destroyed on navigation away. */
  setPersistent(name: ScreenName): void {
    this.persistentScreens.add(name);
  }

  /**
   * Transition to a new screen with directional animation.
   * The outgoing screen slides out, the incoming screen slides in.
   * Persistent screens are cached and reused instead of recreated.
   */
  async switchScreen(
    name: ScreenName,
    direction: 'left' | 'right' | 'up' | 'down' = 'left',
  ): Promise<void> {
    if (this.transitioning) return;
    if (name === this.currentName) return;

    this.transitioning = true;

    // Reuse cached screen if persistent, otherwise create new
    let incoming: Component;
    const cached = this.cachedScreens.get(name);
    if (cached) {
      incoming = cached;
    } else {
      const factory = this.screenFactories.get(name);
      if (!factory) {
        console.error(`Screen "${name}" not registered`);
        this.transitioning = false;
        return;
      }
      incoming = factory();
      // Cache if persistent
      if (this.persistentScreens.has(name)) {
        this.cachedScreens.set(name, incoming);
      }
    }

    const outgoing = this.currentScreen;
    const outgoingName = this.currentName;

    // Mount incoming
    incoming.mount();
    const incomingEl = this.container.lastElementChild as HTMLElement;

    if (outgoing && incomingEl) {
      const outgoingEl = incomingEl.previousElementSibling as HTMLElement;
      if (outgoingEl) {
        await AnimationSystem.screenTransition(outgoingEl, incomingEl, direction);
      }
      // Only destroy non-persistent outgoing screens
      if (outgoingName && this.persistentScreens.has(outgoingName)) {
        // Just detach from DOM, don't destroy
        outgoingEl?.remove();
      } else {
        outgoing.destroy();
        outgoingEl?.remove();
      }
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
