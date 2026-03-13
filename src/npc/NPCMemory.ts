import type { NPC, NPCMemoryEntry } from '@/types';

export class NPCMemory {
  recordEvent(
    npc: NPC,
    event: string,
    sentiment: number,
    details?: Record<string, unknown>,
  ): void {
    if (!npc.companion) return;

    const entry: NPCMemoryEntry = {
      timestamp: { totalRounds: 0 }, // Should be set by caller with actual game time
      event,
      sentiment,
      details: details ?? {},
    };

    npc.companion.memory.push(entry);
  }

  getMemories(npc: NPC, limit?: number): NPCMemoryEntry[] {
    if (!npc.companion) return [];

    const memories = npc.companion.memory;
    if (limit !== undefined && limit < memories.length) {
      return memories.slice(-limit);
    }
    return [...memories];
  }

  getMemoriesAbout(npc: NPC, topic: string): NPCMemoryEntry[] {
    if (!npc.companion) return [];

    return npc.companion.memory.filter((m) =>
      m.event.toLowerCase().includes(topic.toLowerCase()) ||
      Object.values(m.details).some(
        (v) => typeof v === 'string' && v.toLowerCase().includes(topic.toLowerCase()),
      ),
    );
  }

  getOverallSentiment(npc: NPC): number {
    if (!npc.companion || npc.companion.memory.length === 0) return 0;

    const total = npc.companion.memory.reduce((sum, m) => sum + m.sentiment, 0);
    return total / npc.companion.memory.length;
  }

  forgetOldMemories(npc: NPC, maxAge: number): number {
    if (!npc.companion) return 0;

    const before = npc.companion.memory.length;
    npc.companion.memory = npc.companion.memory.filter(
      (m) => m.timestamp.totalRounds >= maxAge,
    );
    return before - npc.companion.memory.length;
  }
}
