import type { Entity, EntityId, EntityType } from '@/types';

/**
 * Central entity storage with type-based indexing for fast lookups.
 */
export class EntityManager {
  private entities: Map<EntityId, Entity> = new Map();
  private typeIndex: Map<EntityType, Set<EntityId>> = new Map();

  /** Add an entity to the manager. Overwrites if the ID already exists. */
  add<T extends Entity>(entity: T): void {
    // If replacing, remove from old type index first
    const existing = this.entities.get(entity.id);
    if (existing) {
      this.typeIndex.get(existing.type)?.delete(entity.id);
    }

    this.entities.set(entity.id, entity);

    let typeSet = this.typeIndex.get(entity.type);
    if (!typeSet) {
      typeSet = new Set();
      this.typeIndex.set(entity.type, typeSet);
    }
    typeSet.add(entity.id);
  }

  /** Retrieve an entity by ID with type casting. */
  get<T extends Entity>(id: EntityId): T | undefined {
    return this.entities.get(id) as T | undefined;
  }

  /** Get all entities of a specific type. */
  getAll<T extends Entity>(type: EntityType): T[] {
    const ids = this.typeIndex.get(type);
    if (!ids) return [];

    const result: T[] = [];
    for (const id of ids) {
      const entity = this.entities.get(id);
      if (entity) {
        result.push(entity as T);
      }
    }
    return result;
  }

  /** Remove an entity by ID. Returns true if it existed. */
  remove(id: EntityId): boolean {
    const entity = this.entities.get(id);
    if (!entity) return false;

    this.entities.delete(id);
    this.typeIndex.get(entity.type)?.delete(id);
    return true;
  }

  /** Check whether an entity with the given ID exists. */
  has(id: EntityId): boolean {
    return this.entities.has(id);
  }

  /** Query entities with a predicate filter. */
  query<T extends Entity>(predicate: (e: Entity) => boolean): T[] {
    const result: T[] = [];
    for (const entity of this.entities.values()) {
      if (predicate(entity)) {
        result.push(entity as T);
      }
    }
    return result;
  }

  /** Count entities, optionally filtered by type. */
  count(type?: EntityType): number {
    if (type !== undefined) {
      return this.typeIndex.get(type)?.size ?? 0;
    }
    return this.entities.size;
  }

  /** Remove all entities. */
  clear(): void {
    this.entities.clear();
    this.typeIndex.clear();
  }
}
