import type { EntityId, GameTime, Location } from '@/types';

export class LocationManager {
  private locations: Map<EntityId, Location> = new Map();

  registerLocation(location: Location): void {
    this.locations.set(location.id, location);
  }

  getLocation(id: EntityId): Location | undefined {
    return this.locations.get(id);
  }

  getLocationsInRegion(regionId: EntityId): Location[] {
    const result: Location[] = [];
    for (const loc of this.locations.values()) {
      if (loc.regionId === regionId) {
        result.push(loc);
      }
    }
    return result;
  }

  getConnectedLocations(locationId: EntityId): Location[] {
    const location = this.locations.get(locationId);
    if (!location) return [];

    const connected: Location[] = [];
    for (const connId of location.connections) {
      const connLoc = this.locations.get(connId);
      if (connLoc) {
        connected.push(connLoc);
      }
    }
    return connected;
  }

  addNPC(locationId: EntityId, npcId: EntityId): void {
    const location = this.locations.get(locationId);
    if (location && !location.npcs.includes(npcId)) {
      location.npcs.push(npcId);
    }
  }

  removeNPC(locationId: EntityId, npcId: EntityId): void {
    const location = this.locations.get(locationId);
    if (location) {
      const idx = location.npcs.indexOf(npcId);
      if (idx !== -1) {
        location.npcs.splice(idx, 1);
      }
    }
  }

  getNPCs(locationId: EntityId): EntityId[] {
    const location = this.locations.get(locationId);
    return location ? [...location.npcs] : [];
  }

  markVisited(locationId: EntityId, time: GameTime): void {
    const location = this.locations.get(locationId);
    if (location) {
      location.lastVisited = time;
      location.discovered = true;
    }
  }

  markDiscovered(locationId: EntityId): void {
    const location = this.locations.get(locationId);
    if (location) {
      location.discovered = true;
    }
  }

  getTimeSinceVisit(locationId: EntityId, currentTime: GameTime): number | null {
    const location = this.locations.get(locationId);
    if (!location || !location.lastVisited) return null;
    return currentTime.totalRounds - location.lastVisited.totalRounds;
  }
}
