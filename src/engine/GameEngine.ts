import { EventBus } from './EventBus';
import { EntityManager } from './EntityManager';

/**
 * Interface that all game systems must implement.
 * Systems are updated each frame in priority order (lower = first).
 */
export interface GameSystem {
  readonly name: string;
  readonly priority: number;
  init(engine: GameEngine): void;
  update?(deltaMs: number): void;
  destroy?(): void;
}

/**
 * Master orchestrator. Coordinates systems, runs the tick loop
 * via requestAnimationFrame, and provides access to shared services.
 */
export class GameEngine {
  readonly events: EventBus;
  readonly entities: EntityManager;
  private systems: Map<string, GameSystem> = new Map();
  private sortedSystems: GameSystem[] = [];
  private running = false;
  private lastFrameTime = 0;
  private animFrameId: number | null = null;

  constructor() {
    this.events = new EventBus();
    this.entities = new EntityManager();
  }

  /** Register a system. Initializes it immediately and inserts by priority. */
  registerSystem(system: GameSystem): void {
    if (this.systems.has(system.name)) {
      throw new Error(`System "${system.name}" is already registered`);
    }

    this.systems.set(system.name, system);
    system.init(this);

    // Rebuild sorted list
    this.sortedSystems = Array.from(this.systems.values()).sort(
      (a, b) => a.priority - b.priority,
    );
  }

  /** Retrieve a registered system by name with type casting. */
  getSystem<T extends GameSystem>(name: string): T {
    const system = this.systems.get(name);
    if (!system) {
      throw new Error(`System "${name}" not found`);
    }
    return system as T;
  }

  /** Start the requestAnimationFrame tick loop. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastFrameTime = performance.now();
    this.animFrameId = requestAnimationFrame((t) => this.tick(t));

    this.events.emit({
      type: 'system:engine:start',
      category: 'system',
      data: {},
    });
  }

  /** Stop the tick loop. */
  stop(): void {
    if (!this.running) return;
    this.running = false;

    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    this.events.emit({
      type: 'system:engine:stop',
      category: 'system',
      data: {},
    });
  }

  /** Whether the engine tick loop is currently running. */
  isRunning(): boolean {
    return this.running;
  }

  /** Called each frame by requestAnimationFrame. */
  private tick(timestamp: number): void {
    if (!this.running) return;

    const deltaMs = timestamp - this.lastFrameTime;
    this.lastFrameTime = timestamp;

    // Update all systems in priority order
    for (const system of this.sortedSystems) {
      system.update?.(deltaMs);
    }

    this.animFrameId = requestAnimationFrame((t) => this.tick(t));
  }
}
