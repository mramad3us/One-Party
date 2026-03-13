import type {
  EntityId,
  Location,
  Region,
  SerializedGameState,
  World,
} from '@/types';
import type { TimeContext } from '@/types/time';

export class GameState {
  world: World;
  playerCharacterId: EntityId;
  currentLocationId: EntityId;
  currentSubLocationId: EntityId | null;
  currentSpaceId: EntityId | null;
  timeContext: TimeContext;

  constructor(world: World, playerId: EntityId, startLocationId: EntityId) {
    this.world = world;
    this.playerCharacterId = playerId;
    this.currentLocationId = startLocationId;
    this.currentSubLocationId = null;
    this.currentSpaceId = null;
    this.timeContext = {
      scale: 'exploration',
      roundsPerTurn: 100,
    };
  }

  getCurrentLocation(): Location {
    for (const [, region] of this.world.regions) {
      const loc = region.locations.get(this.currentLocationId);
      if (loc) return loc;
    }
    throw new Error(`Current location ${this.currentLocationId} not found in world`);
  }

  getCurrentRegion(): Region {
    for (const [, region] of this.world.regions) {
      if (region.locations.has(this.currentLocationId)) {
        return region;
      }
    }
    throw new Error(`Region for location ${this.currentLocationId} not found`);
  }

  advanceTime(rounds: number): void {
    this.world.time = {
      totalRounds: this.world.time.totalRounds + rounds,
    };
  }

  serialize(): SerializedGameState {
    return {
      world: this.serializeWorld(this.world),
      playerCharacterId: this.playerCharacterId,
      currentLocationId: this.currentLocationId,
      currentSubLocationId: this.currentSubLocationId,
      currentSpaceId: this.currentSpaceId,
      timeContext: this.timeContext,
    };
  }

  static deserialize(data: SerializedGameState): GameState {
    const worldData = data['world'] as Record<string, unknown>;
    const world = GameState.deserializeWorld(worldData);

    const state = new GameState(
      world,
      data['playerCharacterId'] as EntityId,
      data['currentLocationId'] as EntityId,
    );
    state.currentSubLocationId = (data['currentSubLocationId'] as EntityId | null) ?? null;
    state.currentSpaceId = (data['currentSpaceId'] as EntityId | null) ?? null;
    state.timeContext = data['timeContext'] as TimeContext;

    return state;
  }

  private serializeWorld(world: World): Record<string, unknown> {
    const regions: [string, Record<string, unknown>][] = [];

    for (const [id, region] of world.regions) {
      const locations: [string, Record<string, unknown>][] = [];

      for (const [locId, location] of region.locations) {
        const subLocations: [string, Record<string, unknown>][] = [];

        for (const [subId, sub] of location.subLocations) {
          const spaces: [string, unknown][] = [];
          for (const [spaceId, space] of sub.spaces) {
            spaces.push([spaceId, space]);
          }

          subLocations.push([subId, {
            ...sub,
            spaces,
          }]);
        }

        locations.push([locId, {
          ...location,
          subLocations,
        }]);
      }

      regions.push([id, {
        ...region,
        locations,
      }]);
    }

    return {
      ...world,
      regions,
    };
  }

  private static deserializeWorld(data: Record<string, unknown>): World {
    const regionEntries = data['regions'] as [string, Record<string, unknown>][];
    const regions = new Map<EntityId, Region>();

    for (const [regionId, regionData] of regionEntries) {
      const locationEntries = regionData['locations'] as [string, Record<string, unknown>][];
      const locations = new Map<EntityId, Location>();

      for (const [locId, locData] of locationEntries) {
        const subEntries = locData['subLocations'] as [string, Record<string, unknown>][];
        const subLocations = new Map();

        for (const [subId, subData] of subEntries) {
          const spaceEntries = (subData['spaces'] as [string, unknown][]) ?? [];
          const spaces = new Map();
          for (const [spaceId, spaceData] of spaceEntries) {
            spaces.set(spaceId, spaceData);
          }

          subLocations.set(subId, {
            ...subData,
            spaces,
          });
        }

        locations.set(locId, {
          ...locData,
          subLocations,
        } as Location);
      }

      regions.set(regionId, {
        ...regionData,
        locations,
      } as Region);
    }

    return {
      id: data['id'] as EntityId,
      name: data['name'] as string,
      seed: data['seed'] as number,
      regions,
      time: data['time'] as { totalRounds: number },
      history: (data['history'] as World['history']) ?? [],
    };
  }
}
