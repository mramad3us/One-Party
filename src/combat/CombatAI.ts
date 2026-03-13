import type {
  AvailableActions,
  CombatState,
  Coordinate,
  EntityId,
  NPC,
  PlannedTurn,
} from '@/types';
import { Grid } from '@/grid/Grid';
import { Pathfinder } from '@/grid/Pathfinder';
import { TargetingSystem } from './TargetingSystem';

interface EntityInfo {
  hp: number;
  maxHp: number;
  position: Coordinate;
  ac: number;
}

/**
 * NPC decision-making in combat.
 * Uses CombatPreferences from companion data or simple heuristics for monsters.
 */
export class CombatAI {
  private pathfinder = new Pathfinder();

  constructor(
    private grid: Grid,
    _targeting: TargetingSystem,
  ) {}

  /**
   * Decide what an NPC should do on their turn.
   * Returns a PlannedTurn with movement, action, and optional bonus action.
   */
  decideTurn(
    npc: NPC,
    _combatState: CombatState,
    availableActions: AvailableActions,
    _allies: EntityId[],
    enemies: EntityId[],
    getEntityInfo: (id: EntityId) => EntityInfo | undefined,
  ): PlannedTurn {
    const prefs = npc.companion?.combatPreferences;
    const plan: PlannedTurn = {};

    const npcPos = this.grid.getEntityPosition(npc.id);
    if (!npcPos) return plan;

    const currentHpPercent = npc.stats.currentHp / npc.stats.maxHp;

    // Check if NPC should retreat
    if (prefs && this.shouldRetreat(npc, currentHpPercent)) {
      plan.movement = this.planRetreat(npc, enemies, availableActions, getEntityInfo);
      plan.action = { type: 'dodge' };
      return plan;
    }

    // Select a target
    const target = this.selectTarget(npc, enemies, getEntityInfo);
    if (!target) return plan;

    const targetInfo = getEntityInfo(target);
    if (!targetInfo) return plan;

    const distToTarget = this.grid.getEntityDistance(npc.id, target);
    const preferMelee = !prefs || prefs.preferredRange === 'melee' || prefs.preferredRange === 'mixed';
    const preferRanged = prefs?.preferredRange === 'ranged';

    // Check if we have ranged attacks
    const hasRangedAttack = npc.stats.attacks.some((a) => a.rangeNormal !== undefined && a.rangeNormal > 0);
    const hasMeleeAttack = npc.stats.attacks.some((a) => !a.rangeNormal || a.rangeNormal === 0);

    // Decide movement
    if (availableActions.canMove && availableActions.remainingMovement > 0) {
      if (preferRanged && hasRangedAttack && distToTarget <= 10) {
        // Ranged NPC too close — try to back away
        plan.movement = this.planRetreat(npc, enemies, availableActions, getEntityInfo);
      } else if (preferMelee || !hasRangedAttack) {
        // Move toward target for melee
        if (distToTarget > 5) {
          plan.movement = this.planApproach(npc, target, availableActions, getEntityInfo);
        }
      } else if (preferRanged) {
        // Ranged NPC: stay at distance if possible
        const maxRange = Math.max(...npc.stats.attacks.filter((a) => a.rangeNormal).map((a) => a.rangeNormal ?? 0));
        if (distToTarget > maxRange) {
          plan.movement = this.planApproach(npc, target, availableActions, getEntityInfo);
        }
      }
    }

    // Decide action
    if (availableActions.canAction) {
      // After movement, recalculate distance
      const finalPos = plan.movement && plan.movement.length > 0
        ? plan.movement[plan.movement.length - 1]
        : npcPos;

      const newDist = this.grid.getDistance(finalPos, targetInfo.position);

      // Try melee attack first if adjacent
      if (hasMeleeAttack && newDist <= 5) {
        plan.action = { type: 'attack', targetId: target };
      } else if (hasRangedAttack) {
        // Use ranged attack
        const rangedAttack = npc.stats.attacks.find((a) => a.rangeNormal !== undefined && a.rangeNormal > 0);
        if (rangedAttack && newDist <= (rangedAttack.rangeLong ?? rangedAttack.rangeNormal ?? 0)) {
          plan.action = { type: 'attack', targetId: target };
        }
      } else if (hasMeleeAttack && newDist > 5) {
        // Can't reach target, use Dash to close distance
        plan.action = { type: 'dash' };
      }
    }

    return plan;
  }

  // ── Private helpers ──────────────────────────────────────────

  /**
   * Score a position for tactical evaluation (higher = better).
   */
  /**
   * Select the best target from valid enemies.
   */
  private selectTarget(
    npc: NPC,
    validTargets: EntityId[],
    getInfo: (id: EntityId) => EntityInfo | undefined,
  ): EntityId | null {
    if (validTargets.length === 0) return null;

    const prefs = npc.companion?.combatPreferences;
    const npcPos = this.grid.getEntityPosition(npc.id);
    if (!npcPos) return validTargets[0];

    // Score each potential target
    let bestTarget = validTargets[0];
    let bestScore = -Infinity;

    for (const targetId of validTargets) {
      const info = getInfo(targetId);
      if (!info) continue;

      let score = 0;
      const dist = this.grid.getEntityDistance(npc.id, targetId);

      // Prefer closer targets (less movement needed)
      score -= dist * 0.5;

      // Focus damaged targets if preference set
      if (prefs?.focusDamaged) {
        const hpPercent = info.hp / info.maxHp;
        score += (1 - hpPercent) * 20;
      }

      // Prefer lower AC targets (easier to hit)
      score -= info.ac * 0.3;

      // Prefer targets already in melee range
      if (dist <= 5) score += 10;

      if (score > bestScore) {
        bestScore = score;
        bestTarget = targetId;
      }
    }

    return bestTarget;
  }

  /**
   * Determine if the NPC should retreat based on HP and aggression.
   */
  private shouldRetreat(npc: NPC, currentHpPercent: number): boolean {
    const prefs = npc.companion?.combatPreferences;
    if (!prefs) return false;

    // Low aggression NPCs retreat when below 30% HP
    // High aggression NPCs retreat only when below 10% HP
    const retreatThreshold = 0.1 + (1 - prefs.aggression) * 0.3;
    return currentHpPercent < retreatThreshold;
  }

  /**
   * Plan a path toward a target entity.
   */
  private planApproach(
    npc: NPC,
    targetId: EntityId,
    availableActions: AvailableActions,
    _getEntityInfo: (id: EntityId) => EntityInfo | undefined,
  ): Coordinate[] {
    const npcPos = this.grid.getEntityPosition(npc.id);
    const targetPos = this.grid.getEntityPosition(targetId);
    if (!npcPos || !targetPos) return [];

    const size = this.grid.getEntityPlacement(npc.id)?.size ?? 1;

    // Find cells adjacent to target
    const reachable = this.pathfinder.getReachableCells(
      this.grid,
      npcPos,
      size,
      availableActions.remainingMovement,
      new Set([npc.id]),
    );

    // Find the reachable cell closest to the target
    let bestCell: Coordinate | null = null;
    let bestDist = Infinity;

    for (const [key] of reachable) {
      const parts = key.split(',');
      const cx = parseInt(parts[0], 10);
      const cy = parseInt(parts[1], 10);
      const dist = this.grid.getDistance({ x: cx, y: cy }, targetPos);

      if (dist < bestDist) {
        bestDist = dist;
        bestCell = { x: cx, y: cy };
      }
    }

    if (!bestCell) return [];

    const pathResult = this.pathfinder.findPath(
      this.grid,
      npcPos,
      bestCell,
      size,
      availableActions.remainingMovement,
      new Set([npc.id]),
    );

    return pathResult.reachable ? pathResult.path : [];
  }

  /**
   * Plan a retreat path away from enemies.
   */
  private planRetreat(
    npc: NPC,
    enemies: EntityId[],
    availableActions: AvailableActions,
    _getEntityInfo: (id: EntityId) => EntityInfo | undefined,
  ): Coordinate[] {
    const npcPos = this.grid.getEntityPosition(npc.id);
    if (!npcPos) return [];

    const size = this.grid.getEntityPlacement(npc.id)?.size ?? 1;
    const reachable = this.pathfinder.getReachableCells(
      this.grid,
      npcPos,
      size,
      availableActions.remainingMovement,
      new Set([npc.id]),
    );

    // Find the cell that maximizes distance from all enemies
    let bestCell: Coordinate | null = null;
    let bestMinDist = -Infinity;

    for (const [key] of reachable) {
      const parts = key.split(',');
      const cx = parseInt(parts[0], 10);
      const cy = parseInt(parts[1], 10);

      let minDistToEnemy = Infinity;
      for (const enemyId of enemies) {
        const enemyPos = this.grid.getEntityPosition(enemyId);
        if (!enemyPos) continue;
        const dist = this.grid.getDistance({ x: cx, y: cy }, enemyPos);
        if (dist < minDistToEnemy) minDistToEnemy = dist;
      }

      if (minDistToEnemy > bestMinDist) {
        bestMinDist = minDistToEnemy;
        bestCell = { x: cx, y: cy };
      }
    }

    if (!bestCell) return [];

    const pathResult = this.pathfinder.findPath(
      this.grid,
      npcPos,
      bestCell,
      size,
      availableActions.remainingMovement,
      new Set([npc.id]),
    );

    return pathResult.reachable ? pathResult.path : [];
  }
}
