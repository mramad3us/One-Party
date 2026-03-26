import type { EntityId, Location, NPC, SubLocation } from '@/types';

/** A mapping entry linking an NPC to the sub-location they inhabit */
export type NPCPlacement = {
  npcId: EntityId;
  subLocationId: EntityId;
  subLocationType: SubLocation['subType'];
  subLocationName: string;
};

/**
 * Given a location, returns an array of NPCPlacement entries describing
 * which NPCs are in which sub-locations. This is used when the player
 * enters a building to determine which NPC to render.
 */
export function getNPCPlacements(location: Location): NPCPlacement[] {
  const placements: NPCPlacement[] = [];

  for (const [, subLocation] of location.subLocations) {
    for (const npcId of subLocation.npcs) {
      placements.push({
        npcId,
        subLocationId: subLocation.id,
        subLocationType: subLocation.subType,
        subLocationName: subLocation.name,
      });
    }
  }

  return placements;
}

/**
 * Given a location and a specific sub-location ID, returns the NPC IDs
 * present in that sub-location. Returns an empty array if the sub-location
 * doesn't exist or has no NPCs.
 */
export function getNPCsInSubLocation(
  location: Location,
  subLocationId: EntityId,
): EntityId[] {
  const subLocation = location.subLocations.get(subLocationId);
  if (!subLocation) return [];
  return [...subLocation.npcs];
}

/**
 * Given a location and an NPC ID, finds which sub-location the NPC is in.
 * Returns null if the NPC is not found in any sub-location.
 */
export function findNPCSubLocation(
  location: Location,
  npcId: EntityId,
): SubLocation | null {
  for (const [, subLocation] of location.subLocations) {
    if (subLocation.npcs.includes(npcId)) {
      return subLocation;
    }
  }
  return null;
}

/**
 * Resolve NPC placements to full NPC objects using a lookup function.
 * Useful for rendering: get the actual NPC data for each placement.
 */
export function resolveNPCPlacements(
  location: Location,
  getNPC: (id: EntityId) => NPC | undefined,
): Array<NPCPlacement & { npc: NPC }> {
  const placements = getNPCPlacements(location);
  const resolved: Array<NPCPlacement & { npc: NPC }> = [];

  for (const placement of placements) {
    const npc = getNPC(placement.npcId);
    if (npc) {
      resolved.push({ ...placement, npc });
    }
  }

  return resolved;
}
