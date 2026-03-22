import type { Combatant, DiceRollResult, EntityId } from '@/types';
import type { DiceRoller } from '@/rules/DiceRoller';

/** Individual initiative roll result for UI display. */
export interface InitiativeRollEntry {
  entityId: EntityId;
  isPlayer: boolean;
  isAlly: boolean;
  rollResult: DiceRollResult;
  total: number;
}

/**
 * Manages initiative order for combat encounters.
 * Rolls initiative, sorts combatants, tracks turn progression.
 */
export class InitiativeTracker {
  private combatants: Combatant[] = [];
  private currentIndex = 0;
  private round = 1;

  /** Stored from the last rollInitiative call for UI display. */
  lastInitiativeRolls: InitiativeRollEntry[] = [];

  constructor() {}

  /**
   * Roll initiative for all entities and establish turn order.
   * Sorts descending by initiative. Ties broken by modifier, then random.
   */
  rollInitiative(
    entities: { entityId: EntityId; modifier: number; isPlayer: boolean; isAlly: boolean }[],
    dice: DiceRoller,
  ): Combatant[] {
    this.lastInitiativeRolls = [];

    this.combatants = entities.map((e) => {
      const roll = dice.rollD20({ modifier: e.modifier });
      this.lastInitiativeRolls.push({
        entityId: e.entityId,
        isPlayer: e.isPlayer,
        isAlly: e.isAlly,
        rollResult: roll,
        total: roll.total,
      });
      return {
        entityId: e.entityId,
        initiative: roll.total,
        isPlayer: e.isPlayer,
        isAlly: e.isAlly,
      };
    });

    // Sort descending by initiative; ties broken by higher modifier (approximated
    // by giving a tiny random offset so they don't remain tied).
    this.combatants.sort((a, b) => {
      if (b.initiative !== a.initiative) return b.initiative - a.initiative;
      // Tie-break: look up the original modifier
      const aMod = entities.find((e) => e.entityId === a.entityId)?.modifier ?? 0;
      const bMod = entities.find((e) => e.entityId === b.entityId)?.modifier ?? 0;
      if (bMod !== aMod) return bMod - aMod;
      // Final tie-break: random
      return dice.roll(20) - dice.roll(20);
    });

    this.currentIndex = 0;
    this.round = 1;

    return [...this.combatants];
  }

  getCurrentCombatant(): Combatant {
    return this.combatants[this.currentIndex];
  }

  /**
   * Advance to the next combatant. Wraps around and increments the round.
   */
  nextTurn(): Combatant {
    this.currentIndex++;
    if (this.currentIndex >= this.combatants.length) {
      this.currentIndex = 0;
      this.round++;
    }
    return this.combatants[this.currentIndex];
  }

  getOrder(): Combatant[] {
    return [...this.combatants];
  }

  getRound(): number {
    return this.round;
  }

  getCurrentIndex(): number {
    return this.currentIndex;
  }

  removeCombatant(entityId: EntityId): void {
    const idx = this.combatants.findIndex((c) => c.entityId === entityId);
    if (idx === -1) return;

    this.combatants.splice(idx, 1);

    // Adjust currentIndex if needed
    if (this.combatants.length === 0) {
      this.currentIndex = 0;
      return;
    }

    if (idx < this.currentIndex) {
      this.currentIndex--;
    } else if (idx === this.currentIndex) {
      // If we removed the current combatant, stay at the same index
      // (which now points to the next combatant). Wrap if needed.
      if (this.currentIndex >= this.combatants.length) {
        this.currentIndex = 0;
        this.round++;
      }
    }
  }

  /**
   * Insert a combatant into the initiative order at the correct position.
   */
  addCombatant(combatant: Combatant): void {
    let insertIdx = this.combatants.length;
    for (let i = 0; i < this.combatants.length; i++) {
      if (combatant.initiative > this.combatants[i].initiative) {
        insertIdx = i;
        break;
      }
    }

    this.combatants.splice(insertIdx, 0, combatant);

    // Adjust currentIndex if insertion was before or at current position
    if (insertIdx <= this.currentIndex) {
      this.currentIndex++;
    }
  }

  reset(): void {
    this.combatants = [];
    this.currentIndex = 0;
    this.round = 1;
  }
}
