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
  private baseSpeed = 0;
  private _disengaged = false;

  /** How many attacks have been used this turn (for Extra Attack). */
  private attacksUsedThisTurn = 0;
  /** Maximum attacks per Attack action (1 normally, 2 with Extra Attack). */
  private maxAttacksThisTurn = 1;
  /** Whether Sneak Attack has been used this turn (once per turn). */
  private _sneakAttackUsedThisTurn = false;

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
    this.baseSpeed = speed;
    this._disengaged = false;
    this.attacksUsedThisTurn = 0;
    this.maxAttacksThisTurn = 1; // will be set by CombatManager based on features
    this._sneakAttackUsedThisTurn = false;
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

  /** Reset action used flag (e.g. after Action Surge). */
  resetAction(): void {
    this.actionUsed = false;
    this.attacksUsedThisTurn = 0;
  }

  // ── Extra Attack ──────────────────────────────────────────────

  /** Set the maximum number of attacks per Attack action. */
  setMaxAttacks(max: number): void {
    this.maxAttacksThisTurn = max;
  }

  /** Whether there are attacks remaining in the current Attack action. */
  hasAttacksRemaining(): boolean {
    return this.attacksUsedThisTurn < this.maxAttacksThisTurn;
  }

  /** Use one attack. If all attacks are spent, marks the action as used. */
  useAttack(): void {
    this.attacksUsedThisTurn++;
    if (this.attacksUsedThisTurn >= this.maxAttacksThisTurn) {
      this.actionUsed = true;
    }
  }

  /** Get the number of attacks used this turn. */
  getAttacksUsed(): number {
    return this.attacksUsedThisTurn;
  }

  /** Get the max attacks for this turn. */
  getMaxAttacks(): number {
    return this.maxAttacksThisTurn;
  }

  // ── Sneak Attack ─────────────────────────────────────────────

  /** Whether Sneak Attack has been used this turn. */
  get sneakAttackUsed(): boolean {
    return this._sneakAttackUsedThisTurn;
  }

  /** Mark Sneak Attack as used this turn. */
  useSneakAttack(): void {
    this._sneakAttackUsedThisTurn = true;
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

  // ── Bonus Action variants ───────────────────────────────────

  /** Bonus action Dash (Cunning Action): gain speed as extra movement, consuming bonus action only. */
  bonusDash(): void {
    this.bonusActionUsed = true;
    this.maxMovement += this.baseSpeed;
  }

  /** Bonus action Disengage (Cunning Action): immune to OAs, consuming bonus action only. */
  bonusDisengage(): void {
    this.bonusActionUsed = true;
    this._disengaged = true;
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
    attacksUsed: number;
    maxAttacks: number;
    sneakAttackUsed: boolean;
  } {
    return {
      actionUsed: this.actionUsed,
      bonusActionUsed: this.bonusActionUsed,
      reactionUsed: this.reactionUsed,
      movementUsed: this.movementUsed,
      maxMovement: this.maxMovement,
      attacksUsed: this.attacksUsedThisTurn,
      maxAttacks: this.maxAttacksThisTurn,
      sneakAttackUsed: this._sneakAttackUsedThisTurn,
    };
  }

  endTurn(): void {
    // Clean up — nothing to do here currently.
    // State persists for reaction until next startTurn.
  }
}
