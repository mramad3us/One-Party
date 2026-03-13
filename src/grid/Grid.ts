import type {
  Coordinate,
  EntityId,
  GridCell,
  GridDefinition,
  GridEntityPlacement,
} from '@/types';
import { coordToKey } from '@/utils/math';

/**
 * Pure data structure for the tactical grid.
 * No rendering, no DOM — just spatial data and entity placement.
 * 1 cell = 5 feet.
 */
export class Grid {
  private definition: GridDefinition;
  private entityPlacements: Map<EntityId, GridEntityPlacement> = new Map();
  /** Reverse lookup: "x,y" -> entityId occupying that cell */
  private occupiedCells: Map<string, EntityId> = new Map();

  constructor(definition: GridDefinition) {
    this.definition = definition;
  }

  // ── Cell access ──────────────────────────────────────────────

  getCell(x: number, y: number): GridCell | undefined {
    if (!this.isValidPosition(x, y)) return undefined;
    return this.definition.cells[y][x];
  }

  setCell(x: number, y: number, cell: GridCell): void {
    if (!this.isValidPosition(x, y)) return;
    this.definition.cells[y][x] = cell;
  }

  isValidPosition(x: number, y: number): boolean {
    return x >= 0 && x < this.definition.width && y >= 0 && y < this.definition.height;
  }

  isPassable(x: number, y: number): boolean {
    const cell = this.getCell(x, y);
    if (!cell) return false;
    return cell.movementCost < Infinity;
  }

  getMovementCost(x: number, y: number): number {
    const cell = this.getCell(x, y);
    if (!cell) return Infinity;
    return cell.movementCost;
  }

  // ── Entity management ────────────────────────────────────────

  placeEntity(entityId: EntityId, position: Coordinate, size: number): boolean {
    if (!this.canOccupy(position, size)) return false;

    const placement: GridEntityPlacement = { entityId, position, size };
    this.entityPlacements.set(entityId, placement);
    this.markOccupied(entityId, position, size);
    return true;
  }

  moveEntity(entityId: EntityId, to: Coordinate): boolean {
    const placement = this.entityPlacements.get(entityId);
    if (!placement) return false;
    if (!this.canOccupyExcluding(to, placement.size, entityId)) return false;

    this.clearOccupied(entityId, placement.position, placement.size);
    placement.position = { x: to.x, y: to.y };
    this.markOccupied(entityId, to, placement.size);
    return true;
  }

  removeEntity(entityId: EntityId): boolean {
    const placement = this.entityPlacements.get(entityId);
    if (!placement) return false;

    this.clearOccupied(entityId, placement.position, placement.size);
    this.entityPlacements.delete(entityId);
    return true;
  }

  getEntityAt(position: Coordinate): EntityId | null {
    return this.occupiedCells.get(coordToKey(position)) ?? null;
  }

  getEntityPosition(entityId: EntityId): Coordinate | undefined {
    return this.entityPlacements.get(entityId)?.position;
  }

  getEntityPlacement(entityId: EntityId): GridEntityPlacement | undefined {
    return this.entityPlacements.get(entityId);
  }

  getEntitiesInArea(center: Coordinate, radius: number): EntityId[] {
    const radiusCells = Math.ceil(radius / 5);
    const found = new Set<EntityId>();

    for (let dy = -radiusCells; dy <= radiusCells; dy++) {
      for (let dx = -radiusCells; dx <= radiusCells; dx++) {
        const cx = center.x + dx;
        const cy = center.y + dy;
        const dist = this.getDistance({ x: center.x, y: center.y }, { x: cx, y: cy });
        if (dist <= radius) {
          const eid = this.getEntityAt({ x: cx, y: cy });
          if (eid) found.add(eid);
        }
      }
    }

    return Array.from(found);
  }

  getAllEntityPlacements(): Map<EntityId, GridEntityPlacement> {
    return new Map(this.entityPlacements);
  }

  // ── Spatial queries ──────────────────────────────────────────

  getAdjacentEntities(entityId: EntityId): EntityId[] {
    const placement = this.entityPlacements.get(entityId);
    if (!placement) return [];

    const adjacent = new Set<EntityId>();
    const { position, size } = placement;

    // Check all cells around the entity's footprint
    for (let dy = -1; dy <= size; dy++) {
      for (let dx = -1; dx <= size; dx++) {
        // Skip cells inside the entity's own footprint
        if (dx >= 0 && dx < size && dy >= 0 && dy < size) continue;

        const cx = position.x + dx;
        const cy = position.y + dy;
        const eid = this.getEntityAt({ x: cx, y: cy });
        if (eid && eid !== entityId) {
          adjacent.add(eid);
        }
      }
    }

    return Array.from(adjacent);
  }

  /**
   * Distance in feet using D&D diagonal rule:
   * max(dx, dy) * 5 (simplified Chebyshev distance).
   */
  getDistance(a: Coordinate, b: Coordinate): number {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    return Math.max(dx, dy) * 5;
  }

  /**
   * Distance between two entities, measured from closest occupied cells.
   */
  getEntityDistance(aId: EntityId, bId: EntityId): number {
    const aPlace = this.entityPlacements.get(aId);
    const bPlace = this.entityPlacements.get(bId);
    if (!aPlace || !bPlace) return Infinity;

    let minDist = Infinity;
    for (let ay = 0; ay < aPlace.size; ay++) {
      for (let ax = 0; ax < aPlace.size; ax++) {
        for (let by = 0; by < bPlace.size; by++) {
          for (let bx = 0; bx < bPlace.size; bx++) {
            const dist = this.getDistance(
              { x: aPlace.position.x + ax, y: aPlace.position.y + ay },
              { x: bPlace.position.x + bx, y: bPlace.position.y + by },
            );
            if (dist < minDist) minDist = dist;
          }
        }
      }
    }

    return minDist;
  }

  isAdjacent(a: Coordinate, b: Coordinate): boolean {
    return Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1 && !(a.x === b.x && a.y === b.y);
  }

  // ── Grid properties ──────────────────────────────────────────

  getWidth(): number {
    return this.definition.width;
  }

  getHeight(): number {
    return this.definition.height;
  }

  getDefinition(): GridDefinition {
    return this.definition;
  }

  // ── Occupancy checks ────────────────────────────────────────

  canOccupy(position: Coordinate, size: number): boolean {
    return this.canOccupyExcluding(position, size, null);
  }

  /**
   * Check if a large creature (size > 1) can occupy a position,
   * optionally excluding an entity from the occupancy check (for self-move).
   */
  private canOccupyExcluding(position: Coordinate, size: number, excludeId: EntityId | null): boolean {
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const cx = position.x + dx;
        const cy = position.y + dy;
        if (!this.isValidPosition(cx, cy)) return false;
        if (!this.isPassable(cx, cy)) return false;

        const occupant = this.getEntityAt({ x: cx, y: cy });
        if (occupant && occupant !== excludeId) return false;
      }
    }
    return true;
  }

  private markOccupied(entityId: EntityId, position: Coordinate, size: number): void {
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        this.occupiedCells.set(coordToKey({ x: position.x + dx, y: position.y + dy }), entityId);
      }
    }
  }

  private clearOccupied(_entityId: EntityId, position: Coordinate, size: number): void {
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        this.occupiedCells.delete(coordToKey({ x: position.x + dx, y: position.y + dy }));
      }
    }
  }
}
