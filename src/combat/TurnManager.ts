import type { EntityId } from '@/types';

/**
 * Tracks action economy within a single turn.
 * Manages movement, action, bonus action, and reaction usage.
 */
export class TurnManager {
  private entityId: EntityId = '';
  private actionUsed = false;
  private bonusActionUsed = false;
  private reactionUsed = false;
  private movementUsed = 0;
  private maxMovement = 0;
  private _disengaged = false;

  constructor() {}

  /**
   * Begin a new turn for an entity. Resets all action economy except reaction
   * (reaction resets at the START of a creature's turn per 5e rules).
   */
  startTurn(entityId: EntityId, speed: number): void {
    this.entityId = entityId;
    this.actionUsed = false;
    this.bonusActionUsed = false;
    this.movementUsed = 0;
    this.maxMovement = speed;
    this._disengaged = false;
    // Reaction resets at the start of your turn
    this.reactionUsed = false;
  }

  // ── Movement ─────────────────────────────────────────────────

  canMove(distance: number): boolean {
    return this.movementUsed + distance <= this.maxMovement;
  }

  useMovement(distance: number): void {
    this.movementUsed += distance;
  }

  getRemainingMovement(): number {
    return Math.max(0, this.maxMovement - this.movementUsed);
  }

  // ── Action ───────────────────────────────────────────────────

  canAction(): boolean {
    return !this.actionUsed;
  }

  useAction(): void {
    this.actionUsed = true;
  }

  // ── Bonus Action ─────────────────────────────────────────────

  canBonusAction(): boolean {
    return !this.bonusActionUsed;
  }

  useBonusAction(): void {
    this.bonusActionUsed = true;
  }

  // ── Reaction ─────────────────────────────────────────────────

  canReaction(): boolean {
    return !this.reactionUsed;
  }

  useReaction(): void {
    this.reactionUsed = true;
  }

  resetReaction(): void {
    this.reactionUsed = false;
  }

  // ── Disengage ──────────────────────────────────────────────

  /** Mark that this entity has taken the Disengage action this turn. */
  disengage(): void {
    this.actionUsed = true;
    this._disengaged = true;
  }

  /** Whether the current entity has Disengaged this turn (immune to opportunity attacks). */
  get disengaged(): boolean {
    return this._disengaged;
  }

  // ── Dash (doubles movement) ──────────────────────────────────

  /**
   * Dash action: gain additional movement equal to your speed.
   * Per 5e rules, this effectively doubles your movement for the turn.
   */
  dash(): void {
    this.actionUsed = true;
    // Dash grants movement equal to your speed (maxMovement was set to speed at turn start)
    this.maxMovement += this.maxMovement;
  }

  // ── State query ──────────────────────────────────────────────

  getEntityId(): EntityId {
    return this.entityId;
  }

  getTurnState(): {
    actionUsed: boolean;
    bonusActionUsed: boolean;
    reactionUsed: boolean;
    movementUsed: number;
    maxMovement: number;
  } {
    return {
      actionUsed: this.actionUsed,
      bonusActionUsed: this.bonusActionUsed,
      reactionUsed: this.reactionUsed,
      movementUsed: this.movementUsed,
      maxMovement: this.maxMovement,
    };
  }

  endTurn(): void {
    // Clean up — nothing to do here currently.
    // State persists for reaction until next startTurn.
  }
}
