import type { EntityId, Result } from '@/types';

export class CompanionManager {
  private companions: EntityId[] = [];
  private maxPartySize: number = 20;

  addCompanion(npcId: EntityId): Result<void, string> {
    if (this.companions.includes(npcId)) {
      return { ok: false, error: 'This NPC is already a companion.' };
    }

    if (this.companions.length >= this.maxPartySize) {
      return { ok: false, error: `Party is full (max ${this.maxPartySize}).` };
    }

    this.companions.push(npcId);
    return { ok: true, value: undefined };
  }

  removeCompanion(npcId: EntityId): Result<void, string> {
    const idx = this.companions.indexOf(npcId);
    if (idx === -1) {
      return { ok: false, error: 'This NPC is not a companion.' };
    }

    this.companions.splice(idx, 1);
    return { ok: true, value: undefined };
  }

  getCompanions(): EntityId[] {
    return [...this.companions];
  }

  getPartySize(): number {
    return this.companions.length;
  }

  isCompanion(npcId: EntityId): boolean {
    return this.companions.includes(npcId);
  }

  setMaxPartySize(size: number): void {
    this.maxPartySize = Math.max(1, size);
  }
}
