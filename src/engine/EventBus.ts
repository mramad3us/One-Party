import type { GameTime, EntityId, Unsubscribe } from '@/types';

export type EventCategory = 'combat' | 'world' | 'character' | 'ui' | 'time' | 'narrative' | 'system';

export interface GameEvent {
  type: string;
  category: EventCategory;
  timestamp?: GameTime;
  source?: EntityId;
  data: Record<string, unknown>;
}

export type EventHandler = (event: GameEvent) => void;

interface HandlerEntry {
  handler: EventHandler;
  priority: number;
  once: boolean;
}

/**
 * Typed pub/sub system with wildcard and priority support.
 * Patterns use ":" as separator. "combat:*" matches "combat:attack:hit".
 * "*" alone matches everything.
 */
export class EventBus {
  private handlers: Map<string, HandlerEntry[]> = new Map();

  /**
   * Subscribe to events matching the given pattern.
   * Lower priority values run first (default 0).
   * Returns an unsubscribe function.
   */
  on(pattern: string, handler: EventHandler, priority = 0): Unsubscribe {
    const entry: HandlerEntry = { handler, priority, once: false };
    this.addEntry(pattern, entry);
    return () => this.off(pattern, handler);
  }

  /**
   * Subscribe to the next matching event only, then auto-unsubscribe.
   */
  once(pattern: string, handler: EventHandler): Unsubscribe {
    const entry: HandlerEntry = { handler, priority: 0, once: true };
    this.addEntry(pattern, entry);
    return () => this.off(pattern, handler);
  }

  /**
   * Emit an event. All matching handlers are called in priority order.
   */
  emit(event: GameEvent): void {
    const toRemove: Array<{ pattern: string; handler: EventHandler }> = [];

    for (const [pattern, entries] of this.handlers) {
      if (!this.matches(pattern, event.type)) continue;

      // Iterate over a copy since we may mutate during iteration
      const sorted = [...entries].sort((a, b) => a.priority - b.priority);

      for (const entry of sorted) {
        entry.handler(event);
        if (entry.once) {
          toRemove.push({ pattern, handler: entry.handler });
        }
      }
    }

    // Clean up once-handlers after all dispatching is done
    for (const { pattern, handler } of toRemove) {
      this.off(pattern, handler);
    }
  }

  /**
   * Remove a specific handler from a pattern.
   */
  off(pattern: string, handler: EventHandler): void {
    const entries = this.handlers.get(pattern);
    if (!entries) return;

    const idx = entries.findIndex((e) => e.handler === handler);
    if (idx !== -1) {
      entries.splice(idx, 1);
    }

    if (entries.length === 0) {
      this.handlers.delete(pattern);
    }
  }

  /**
   * Remove all handlers.
   */
  clear(): void {
    this.handlers.clear();
  }

  private addEntry(pattern: string, entry: HandlerEntry): void {
    let entries = this.handlers.get(pattern);
    if (!entries) {
      entries = [];
      this.handlers.set(pattern, entries);
    }
    entries.push(entry);
  }

  /**
   * Checks whether a subscription pattern matches an event type.
   * - Exact match: "combat:attack:hit" matches "combat:attack:hit"
   * - Wildcard: "combat:*" matches "combat:attack:hit"
   * - Global wildcard: "*" matches everything
   */
  private matches(pattern: string, eventType: string): boolean {
    if (pattern === '*') return true;
    if (pattern === eventType) return true;

    // "combat:*" should match "combat:attack" and "combat:attack:hit"
    if (pattern.endsWith(':*')) {
      const prefix = pattern.slice(0, -2); // remove ":*"
      return eventType === prefix || eventType.startsWith(prefix + ':');
    }

    return false;
  }
}
