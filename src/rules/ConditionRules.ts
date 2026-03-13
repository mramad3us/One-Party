import type { Character, ConditionType, EntityId, NPC } from '@/types';

type Entity = Character | NPC;

function isCharacter(entity: Entity): entity is Character {
  return entity.type === 'character';
}

function getConditions(entity: Entity) {
  return isCharacter(entity) ? entity.conditions : entity.stats.conditions;
}

/** Conditions that prevent the creature from taking actions. */
const INCAPACITATING_CONDITIONS: ConditionType[] = [
  'incapacitated',
  'paralyzed',
  'petrified',
  'stunned',
  'unconscious',
];

/** Conditions that impose disadvantage on attack rolls. */
const ATTACK_DISADVANTAGE_CONDITIONS: ConditionType[] = [
  'blinded',
  'frightened',
  'poisoned',
  'prone',
  'restrained',
];

/** Conditions that give attackers advantage against a target. */
const ADVANTAGE_AGAINST_CONDITIONS: ConditionType[] = [
  'blinded',
  'paralyzed',
  'petrified',
  'restrained',
  'stunned',
  'unconscious',
];

export class ConditionRules {
  /** Apply a condition to an entity. Does nothing if already present. */
  applyCondition(
    entity: Entity,
    condition: ConditionType,
    duration?: number,
    source?: EntityId,
  ): void {
    const conditions = getConditions(entity);
    const existing = conditions.find((c) => c.type === condition);
    if (existing) return;
    conditions.push({ type: condition, duration, source });
  }

  /** Remove a condition from an entity. */
  removeCondition(entity: Entity, condition: ConditionType): void {
    const conditions = getConditions(entity);
    const index = conditions.findIndex((c) => c.type === condition);
    if (index !== -1) {
      conditions.splice(index, 1);
    }
  }

  /** Check whether the entity currently has a condition. */
  hasCondition(entity: Entity, condition: ConditionType): boolean {
    return getConditions(entity).some((c) => c.type === condition);
  }

  /**
   * Tick down durations at end of turn. Returns list of conditions
   * that were removed because their duration expired.
   */
  tickConditions(entity: Entity): ConditionType[] {
    const conditions = getConditions(entity);
    const removed: ConditionType[] = [];

    for (let i = conditions.length - 1; i >= 0; i--) {
      const cond = conditions[i];
      if (cond.duration !== undefined) {
        cond.duration -= 1;
        if (cond.duration <= 0) {
          removed.push(cond.type);
          conditions.splice(i, 1);
        }
      }
    }

    return removed;
  }

  /** Whether the entity is incapacitated (can't take actions). */
  isIncapacitated(entity: Entity): boolean {
    return INCAPACITATING_CONDITIONS.some((c) => this.hasCondition(entity, c));
  }

  /** Whether the entity has disadvantage on its own attack rolls. */
  hasDisadvantageOnAttacks(entity: Entity): boolean {
    return ATTACK_DISADVANTAGE_CONDITIONS.some((c) => this.hasCondition(entity, c));
  }

  /** Whether attacks against this target have advantage. */
  hasAdvantageOnAttacksAgainst(target: Entity): boolean {
    return ADVANTAGE_AGAINST_CONDITIONS.some((c) => this.hasCondition(target, c));
  }

  /**
   * Speed multiplier based on conditions.
   * Returns 0 if speed is reduced to 0 (grappled, restrained, stunned, paralyzed, petrified, unconscious).
   * Returns 0.5 if prone (crawling).
   * Returns 1 otherwise.
   */
  getSpeedMultiplier(entity: Entity): number {
    const zeroSpeedConditions: ConditionType[] = [
      'grappled',
      'restrained',
      'stunned',
      'paralyzed',
      'petrified',
      'unconscious',
    ];

    for (const c of zeroSpeedConditions) {
      if (this.hasCondition(entity, c)) return 0;
    }

    if (this.hasCondition(entity, 'prone')) return 0.5;

    return 1;
  }
}
