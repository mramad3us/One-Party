import type { EntityId, GameTime, HistoryEntry } from '@/types';

export class HistoryLog {
  private entries: HistoryEntry[] = [];

  record(
    event: string,
    category: string,
    timestamp: GameTime,
    details?: Record<string, unknown>,
  ): void {
    this.entries.push({
      timestamp,
      event,
      category,
      details: details ?? {},
    });
  }

  getRecent(count: number): HistoryEntry[] {
    return this.entries.slice(-count);
  }

  getByCategory(category: string): HistoryEntry[] {
    return this.entries.filter((e) => e.category === category);
  }

  getSince(time: GameTime): HistoryEntry[] {
    return this.entries.filter((e) => e.timestamp.totalRounds >= time.totalRounds);
  }

  getForLocation(locationId: EntityId): HistoryEntry[] {
    return this.entries.filter(
      (e) => e.details['locationId'] === locationId,
    );
  }

  serialize(): HistoryEntry[] {
    return [...this.entries];
  }

  static deserialize(data: HistoryEntry[]): HistoryLog {
    const log = new HistoryLog();
    log.entries = [...data];
    return log;
  }
}
