import type { Coordinate, EntityId, Spell, SpellTargetType } from '@/types';
import { Grid } from '@/grid/Grid';
import { LineOfSight } from '@/grid/LineOfSight';

/**
 * Range checks, valid target calculation, and area of effect resolution.
 * Works with the Grid to determine spatial targeting.
 */
export class TargetingSystem {
  constructor(private grid: Grid) {}

  /**
   * Get all entities within melee reach of the attacker.
   * Default reach is 5ft (adjacent cells). Some weapons have 10ft reach.
   */
  getValidMeleeTargets(attacker: EntityId, reach = 5): EntityId[] {
    const pos = this.grid.getEntityPosition(attacker);
    if (!pos) return [];

    const placement = this.grid.getEntityPlacement(attacker);
    const size = placement?.size ?? 1;
    const targets: EntityId[] = [];
    const seen = new Set<EntityId>();
    const reachCells = Math.ceil(reach / 5);

    // Check all cells within reach around the attacker's footprint
    for (let dy = -reachCells; dy < size + reachCells; dy++) {
      for (let dx = -reachCells; dx < size + reachCells; dx++) {
        // Skip cells inside the attacker's own footprint
        if (dx >= 0 && dx < size && dy >= 0 && dy < size) continue;

        const cx = pos.x + dx;
        const cy = pos.y + dy;
        const eid = this.grid.getEntityAt({ x: cx, y: cy });
        if (eid && eid !== attacker && !seen.has(eid)) {
          // Verify actual distance is within reach
          const dist = this.grid.getEntityDistance(attacker, eid);
          if (dist <= reach) {
            seen.add(eid);
            targets.push(eid);
          }
        }
      }
    }

    return targets;
  }

  /**
   * Get all entities within ranged weapon range, with line of sight.
   */
  getValidRangedTargets(attacker: EntityId, _rangeNormal: number, rangeLong: number): EntityId[] {
    const pos = this.grid.getEntityPosition(attacker);
    if (!pos) return [];

    const targets: EntityId[] = [];
    const placements = this.grid.getAllEntityPlacements();

    for (const [eid, placement] of placements) {
      if (eid === attacker) continue;

      const dist = this.grid.getEntityDistance(attacker, eid);
      if (dist > rangeLong) continue;

      // Check line of sight
      if (LineOfSight.hasLineOfSight(this.grid, pos, placement.position)) {
        targets.push(eid);
      }
    }

    // Sort by distance for convenience (nearest first)
    targets.sort((a, b) => {
      const distA = this.grid.getEntityDistance(attacker, a);
      const distB = this.grid.getEntityDistance(attacker, b);
      return distA - distB;
    });

    return targets;
  }

  /**
   * Get valid targets for a spell based on its target type and range.
   */
  getSpellTargets(caster: EntityId, spell: Spell): EntityId[] {
    const pos = this.grid.getEntityPosition(caster);
    if (!pos) return [];

    const range = spell.range;

    switch (spell.targetType) {
      case 'self':
        return [caster];

      case 'touch':
        return this.getValidMeleeTargets(caster, 5);

      case 'single':
      case 'area':
      case 'sphere':
      case 'cube':
      case 'cylinder':
        return this.getValidRangedTargets(caster, range, range);

      case 'cone':
      case 'line':
        // For directional spells, any entity within range could be targeted
        return this.getValidRangedTargets(caster, range, range);

      default:
        return [];
    }
  }

  /**
   * Check if an entity is within a given range of another.
   */
  isInRange(from: EntityId, to: EntityId, range: number): boolean {
    return this.grid.getEntityDistance(from, to) <= range;
  }

  /**
   * Check if an entity is within melee range (including reach weapons).
   */
  isInMeleeRange(attacker: EntityId, target: EntityId, reach = 5): boolean {
    return this.grid.getEntityDistance(attacker, target) <= reach;
  }

  // ── Area of Effect ───────────────────────────────────────────

  /**
   * Calculate which cells are affected by an area-of-effect ability.
   */
  getAffectedCells(
    origin: Coordinate,
    shape: SpellTargetType,
    size: number,
    direction?: Coordinate,
  ): Coordinate[] {
    const radiusCells = Math.ceil(size / 5);
    const cells: Coordinate[] = [];

    switch (shape) {
      case 'sphere':
      case 'area':
      case 'cylinder': {
        for (let dy = -radiusCells; dy <= radiusCells; dy++) {
          for (let dx = -radiusCells; dx <= radiusCells; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) * 5 <= size) {
              const cx = origin.x + dx;
              const cy = origin.y + dy;
              if (this.grid.isValidPosition(cx, cy)) {
                cells.push({ x: cx, y: cy });
              }
            }
          }
        }
        break;
      }

      case 'cube': {
        for (let dy = 0; dy < radiusCells; dy++) {
          for (let dx = 0; dx < radiusCells; dx++) {
            const cx = origin.x + dx;
            const cy = origin.y + dy;
            if (this.grid.isValidPosition(cx, cy)) {
              cells.push({ x: cx, y: cy });
            }
          }
        }
        break;
      }

      case 'cone': {
        if (!direction) break;
        const angle = Math.atan2(direction.y - origin.y, direction.x - origin.x);
        const halfAngle = Math.PI / 4;

        for (let dy = -radiusCells; dy <= radiusCells; dy++) {
          for (let dx = -radiusCells; dx <= radiusCells; dx++) {
            if (dx === 0 && dy === 0) continue;
            const cellDist = Math.max(Math.abs(dx), Math.abs(dy));
            if (cellDist > radiusCells) continue;

            const cellAngle = Math.atan2(dy, dx);
            let angleDiff = Math.abs(cellAngle - angle);
            if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

            if (angleDiff <= halfAngle) {
              const cx = origin.x + dx;
              const cy = origin.y + dy;
              if (this.grid.isValidPosition(cx, cy)) {
                cells.push({ x: cx, y: cy });
              }
            }
          }
        }
        break;
      }

      case 'line': {
        if (!direction) break;
        const ddx = direction.x - origin.x;
        const ddy = direction.y - origin.y;
        const dist = Math.max(Math.abs(ddx), Math.abs(ddy));
        if (dist === 0) break;

        const stepX = ddx / dist;
        const stepY = ddy / dist;

        for (let i = 1; i <= radiusCells; i++) {
          const cx = Math.round(origin.x + stepX * i);
          const cy = Math.round(origin.y + stepY * i);
          if (this.grid.isValidPosition(cx, cy)) {
            cells.push({ x: cx, y: cy });
          }
        }
        break;
      }

      default:
        break;
    }

    return cells;
  }

  /**
   * Get all entities present in the given set of cells.
   */
  getEntitiesInArea(cells: Coordinate[]): EntityId[] {
    const found = new Set<EntityId>();
    for (const cell of cells) {
      const eid = this.grid.getEntityAt(cell);
      if (eid) found.add(eid);
    }
    return Array.from(found);
  }

  // ── Opportunity Attack Detection ─────────────────────────────

  /**
   * Check if moving along a path causes the entity to leave any enemy's
   * threatened area (triggering an opportunity attack).
   * Returns the enemy who can make the OA and the cell where it triggers.
   */
  leavesThreatenedArea(
    _entityId: EntityId,
    path: Coordinate[],
    enemies: EntityId[],
  ): { triggeredBy: EntityId; at: Coordinate }[] {
    const triggers: { triggeredBy: EntityId; at: Coordinate }[] = [];
    if (path.length < 2) return triggers;

    for (const enemyId of enemies) {
      const enemyPos = this.grid.getEntityPosition(enemyId);
      if (!enemyPos) continue;

      const enemyPlacement = this.grid.getEntityPlacement(enemyId);
      const enemySize = enemyPlacement?.size ?? 1;

      // Check if the entity starts adjacent to this enemy and leaves adjacency
      let wasAdjacent = false;

      for (let i = 0; i < path.length; i++) {
        const cell = path[i];
        // Check adjacency to enemy (within 5ft)
        let isAdjacentNow = false;

        for (let ey = 0; ey < enemySize; ey++) {
          for (let ex = 0; ex < enemySize; ex++) {
            if (this.grid.isAdjacent(cell, { x: enemyPos.x + ex, y: enemyPos.y + ey })) {
              isAdjacentNow = true;
            }
          }
        }

        if (wasAdjacent && !isAdjacentNow) {
          // Left the threatened area — opportunity attack at the cell where we left
          triggers.push({ triggeredBy: enemyId, at: path[i - 1] });
          break; // Each enemy only gets one OA per movement
        }

        wasAdjacent = isAdjacentNow;
      }
    }

    return triggers;
  }
}
