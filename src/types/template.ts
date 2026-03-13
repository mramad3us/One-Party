import type { GameTime } from './core';

/** Categories of templates */
export type TemplateType =
  | 'encounter'
  | 'event'
  | 'npc'
  | 'quest'
  | 'dialogue'
  | 'loot';

/** Comparison operators for template conditions */
export type ConditionOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'contains'
  | 'not_contains';

/** A prerequisite that must be met for a template to activate */
export type TemplateCondition = {
  type: string;
  operator: ConditionOperator;
  value: unknown;
};

/** A variable to be resolved when a template is instantiated */
export type TemplateVariable = {
  name: string;
  source: 'state' | 'random' | 'computed';
  /** Dot-path into game state (when source is 'state') */
  path?: string;
  /** Possible values to pick from (when source is 'random') */
  options?: unknown[];
  /** Expression to evaluate (when source is 'computed') */
  compute?: string;
};

/** A reusable template for procedural content generation */
export type Template = {
  id: string;
  type: TemplateType;
  tags: string[];
  /** Selection weight for weighted random picks */
  weight: number;
  conditions: TemplateCondition[];
  variables: TemplateVariable[];
  data: Record<string, unknown>;
};

/** A hint for the narrative engine about tone and context */
export type NarrativeHint = {
  key: string;
  tone: string;
  context: Record<string, string>;
};

/** A fully resolved event ready for narration */
export type ResolvedEvent = {
  templateId: string;
  type: TemplateType;
  timestamp: GameTime;
  resolvedData: Record<string, unknown>;
  narrativeHints: NarrativeHint[];
};
