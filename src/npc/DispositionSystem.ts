import type { EntityId, NPC } from '@/types';
import { clamp } from '@/utils/math';

export class DispositionSystem {
  getDisposition(npc: NPC, targetId: EntityId): number {
    if (!npc.companion) {
      // Non-companion NPCs: use role-based defaults
      return this.getDefaultDisposition(npc.role);
    }

    return npc.companion.disposition.get(targetId) ?? this.getDefaultDisposition(npc.role);
  }

  modifyDisposition(npc: NPC, targetId: EntityId, delta: number): number {
    if (!npc.companion) {
      // Non-companion NPCs don't track individual dispositions
      return this.getDefaultDisposition(npc.role);
    }

    const current = npc.companion.disposition.get(targetId) ?? this.getDefaultDisposition(npc.role);
    const newValue = clamp(current + delta, -100, 100);
    npc.companion.disposition.set(targetId, newValue);
    return newValue;
  }

  getReaction(disposition: number): 'hostile' | 'unfriendly' | 'neutral' | 'friendly' | 'allied' {
    if (disposition <= -50) return 'hostile';
    if (disposition <= -10) return 'unfriendly';
    if (disposition <= 30) return 'neutral';
    if (disposition <= 70) return 'friendly';
    return 'allied';
  }

  private getDefaultDisposition(role: string): number {
    switch (role) {
      case 'hostile':
        return -75;
      case 'guard':
        return 10;
      case 'merchant':
      case 'innkeeper':
      case 'blacksmith':
        return 20;
      case 'quest_giver':
        return 30;
      case 'companion':
        return 50;
      case 'noble':
        return 0;
      case 'priest':
        return 30;
      case 'commoner':
      default:
        return 10;
    }
  }
}
