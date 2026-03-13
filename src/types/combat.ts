import type {
  Coordinate,
  DamageType,
  DiceRollResult,
  EntityId,
} from './core';

export type { DiceRollResult } from './core';

/** Combat state machine phases */
export type CombatPhase =
  | 'idle'
  | 'setup'
  | 'initiative'
  | 'turn_start'
  | 'turn_active'
  | 'turn_end'
  | 'check_end'
  | 'resolution';

/** Types of actions a combatant can take */
export type ActionType =
  | 'attack'
  | 'cast_spell'
  | 'dash'
  | 'dodge'
  | 'disengage'
  | 'help'
  | 'hide'
  | 'ready'
  | 'use_item'
  | 'interact';

/** A participant in combat */
export type Combatant = {
  entityId: EntityId;
  initiative: number;
  isPlayer: boolean;
  isAlly: boolean;
};

/** Full state of an active combat encounter */
export type CombatState = {
  phase: CombatPhase;
  combatants: Combatant[];
  currentTurnIndex: number;
  round: number;
  gridId: EntityId;
};

/** The outcome of a combat action */
export type ActionResult = {
  success: boolean;
  type: ActionType;
  actorId: EntityId;
  targetId?: EntityId;
  damage?: number;
  damageType?: DamageType;
  healing?: number;
  description: string;
  rolls: DiceRollResult[];
};

/** A spell that can be cast during combat */
export type SpellOption = {
  spellId: string;
  slotLevel: number;
  validTargets: EntityId[];
  validCells: Coordinate[];
};

/** What a combatant can do on their turn */
export type AvailableActions = {
  canMove: boolean;
  remainingMovement: number;
  canAction: boolean;
  canBonusAction: boolean;
  canReaction: boolean;
  validAttackTargets: EntityId[];
  validSpells: SpellOption[];
  /** Set of "x,y" coordinate strings the combatant can move to */
  validMoveCells: Set<string>;
};

/** A specific action to execute */
export type CombatAction = {
  type: ActionType;
  targetId?: EntityId;
  spellId?: string;
  itemId?: EntityId;
  position?: Coordinate;
};

/** A combatant's planned turn */
export type PlannedTurn = {
  movement?: Coordinate[];
  action?: CombatAction;
  bonusAction?: CombatAction;
};
