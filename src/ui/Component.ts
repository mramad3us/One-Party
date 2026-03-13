import type { GameEngine } from '@/engine/GameEngine';
import type { EventHandler } from '@/engine/EventBus';

/**
 * Base component class with lifecycle management, DOM helpers,
 * and automatic cleanup of event listeners.
 */
export abstract class Component {
  protected el!: HTMLElement;
  protected children: Component[] = [];
  private eventCleanups: (() => void)[] = [];
  private busCleanups: (() => void)[] = [];

  constructor(
    protected parent: HTMLElement,
    protected engine: GameEngine,
  ) {
    this.el = this.createElement();
  }

  /** Build and return the root DOM element for this component. */
  protected abstract createElement(): HTMLElement;

  /** Override to wire up DOM / bus events after mount. */
  protected setupEvents(): void {}

  // ── Lifecycle ──

  /** Append element to parent and trigger enter animation. */
  mount(): void {
    this.parent.appendChild(this.el);
    this.setupEvents();
    requestAnimationFrame(() => {
      this.el.classList.add('mounted');
    });
  }

  /** Play exit animation, then destroy and remove from DOM. */
  async unmount(): Promise<void> {
    this.el.classList.add('exiting');
    this.el.classList.remove('mounted');
    await this.waitForAnimation();
    this.destroy();
    this.el.remove();
  }

  /** Re-render / sync DOM with state. Override as needed. */
  update(): void {}

  /** Tear down children and remove all listeners. */
  destroy(): void {
    this.children.forEach((c) => c.destroy());
    this.children = [];
    this.eventCleanups.forEach((fn) => fn());
    this.eventCleanups = [];
    this.busCleanups.forEach((fn) => fn());
    this.busCleanups = [];
  }

  // ── DOM Helpers ──

  /** querySelector within this component's root element. */
  protected $(selector: string): HTMLElement | null {
    return this.el.querySelector(selector);
  }

  /** querySelectorAll within this component's root element, as array. */
  protected $$(selector: string): HTMLElement[] {
    return Array.from(this.el.querySelectorAll(selector));
  }

  /** Mount a child component (appends to its own parent). */
  protected addChild(child: Component): void {
    this.children.push(child);
    child.mount();
  }

  /** Unmount and remove a child component. */
  protected async removeChild(child: Component): Promise<void> {
    const idx = this.children.indexOf(child);
    if (idx >= 0) this.children.splice(idx, 1);
    await child.unmount();
  }

  // ── Event Helpers (auto-cleanup) ──

  /** Add a DOM event listener that is automatically removed on destroy. */
  protected listen(
    target: EventTarget,
    event: string,
    handler: EventListener,
  ): void {
    target.addEventListener(event, handler);
    this.eventCleanups.push(() => target.removeEventListener(event, handler));
  }

  /** Subscribe to EventBus events; automatically unsubscribed on destroy. */
  protected subscribe(pattern: string, handler: EventHandler): void {
    const unsub = this.engine.events.on(pattern, handler);
    this.busCleanups.push(unsub);
  }

  // ── Animation Helpers ──

  /** Run a Web Animations API animation on an element and await its finish. */
  protected async animateEl(
    el: HTMLElement,
    keyframes: Keyframe[],
    options?: KeyframeAnimationOptions,
  ): Promise<void> {
    const animation = el.animate(keyframes, {
      duration: 300,
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      fill: 'forwards',
      ...options,
    });
    await animation.finished;
  }

  /** Wait for any CSS animation currently playing on this.el to end. */
  private waitForAnimation(): Promise<void> {
    return new Promise<void>((resolve) => {
      const animations = this.el.getAnimations();
      if (animations.length === 0) {
        // Fallback: wait a short duration for CSS transition
        setTimeout(resolve, 300);
        return;
      }
      Promise.all(animations.map((a) => a.finished)).then(() => resolve());
    });
  }
}
