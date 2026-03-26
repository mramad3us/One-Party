import type { Coordinate, NPC, NPCRole } from '@/types';

/** An action the player can take when interacting with an NPC. */
export type InteractionOption = {
  label: string;
  key: string;
  action: 'shop' | 'talk' | 'rest' | 'heal';
};

/** Interaction options per NPC role. */
const ROLE_INTERACTIONS: Record<NPCRole, InteractionOption[]> = {
  merchant: [
    { label: 'Browse Wares', key: 'b', action: 'shop' },
    { label: 'Chat', key: 'c', action: 'talk' },
  ],
  blacksmith: [
    { label: 'Browse Weapons & Armor', key: 'b', action: 'shop' },
    { label: 'Chat', key: 'c', action: 'talk' },
  ],
  innkeeper: [
    { label: 'Buy Food & Drink', key: 'b', action: 'shop' },
    { label: 'Rent a Room', key: 'r', action: 'rest' },
    { label: 'Chat', key: 'c', action: 'talk' },
  ],
  priest: [
    { label: 'Buy Remedies', key: 'b', action: 'shop' },
    { label: 'Request Healing', key: 'h', action: 'heal' },
    { label: 'Chat', key: 'c', action: 'talk' },
  ],
  guard: [
    { label: 'Chat', key: 'c', action: 'talk' },
  ],
  commoner: [
    { label: 'Chat', key: 'c', action: 'talk' },
  ],
  noble: [
    { label: 'Chat', key: 'c', action: 'talk' },
  ],
  quest_giver: [
    { label: 'Chat', key: 'c', action: 'talk' },
  ],
  companion: [
    { label: 'Chat', key: 'c', action: 'talk' },
  ],
  hostile: [],
};

/**
 * Utility class for detecting and building NPC interaction menus.
 */
export class NPCInteraction {
  /**
   * Check if the player is adjacent (4-directional) to any NPC on the
   * exploration grid and return the first match.
   */
  static getAdjacentNPC(playerPos: Coordinate, npcs: NPC[]): NPC | null {
    const offsets: Coordinate[] = [
      { x: 0, y: -1 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
    ];

    for (const npc of npcs) {
      if (!npc.position) continue;
      for (const offset of offsets) {
        if (
          npc.position.x === playerPos.x + offset.x &&
          npc.position.y === playerPos.y + offset.y
        ) {
          return npc;
        }
      }
    }

    return null;
  }

  /**
   * Get all adjacent NPCs (not just the first).
   */
  static getAllAdjacentNPCs(playerPos: Coordinate, npcs: NPC[]): NPC[] {
    const offsets: Coordinate[] = [
      { x: 0, y: -1 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
    ];

    const result: NPC[] = [];
    for (const npc of npcs) {
      if (!npc.position) continue;
      for (const offset of offsets) {
        if (
          npc.position.x === playerPos.x + offset.x &&
          npc.position.y === playerPos.y + offset.y
        ) {
          result.push(npc);
          break;
        }
      }
    }

    return result;
  }

  /**
   * Get the available interaction options for an NPC based on their role.
   * Merchants with no inventory will have the shop option removed.
   */
  static getInteractionOptions(npc: NPC): InteractionOption[] {
    const options = ROLE_INTERACTIONS[npc.role] ?? [];

    // If the NPC has a shop action but no merchant inventory, filter it out
    if (!npc.merchantInventory) {
      return options.filter((opt) => opt.action !== 'shop');
    }

    return [...options];
  }

  /**
   * Check whether an NPC can trade (has merchantInventory and is a
   * merchant-capable role).
   */
  static canTrade(npc: NPC): boolean {
    return npc.merchantInventory != null;
  }
}
