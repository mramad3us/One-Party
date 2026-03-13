import type { Entity, EntityId } from './core';

/** Quest lifecycle states */
export type QuestStatus =
  | 'available'
  | 'active'
  | 'completed'
  | 'failed'
  | 'abandoned';

/** Types of quest objectives */
export type ObjectiveType =
  | 'kill'
  | 'collect'
  | 'escort'
  | 'explore'
  | 'deliver'
  | 'talk'
  | 'survive';

/** A single trackable objective within a quest */
export type Objective = {
  id: string;
  type: ObjectiveType;
  description: string;
  target: string;
  current: number;
  required: number;
  completed: boolean;
  optional: boolean;
};

/** Rewards granted on quest completion */
export type QuestReward = {
  xp: number;
  gold?: number;
  items?: string[];
  reputation?: Record<string, number>;
};

/** A quest the player can undertake */
export interface Quest extends Entity {
  type: 'quest';
  name: string;
  description: string;
  giverId: EntityId;
  status: QuestStatus;
  objectives: Objective[];
  rewards: QuestReward;
  level: number;
  locationId?: EntityId;
}
