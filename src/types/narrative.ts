import type { GameTime } from './core';
import type { ActionResult } from './combat';
import type { ResolvedEvent } from './template';

/** A block of narrative text to display to the player */
export type NarrativeBlock = {
  text: string;
  category: 'action' | 'dialogue' | 'description' | 'system' | 'combat' | 'loot';
  speaker?: string;
  tone?: string;
  timestamp?: GameTime;
};

/** Interface for the narrative engine that converts game events into prose */
export interface NarrativeEngine {
  /** Generate narrative blocks from a resolved event */
  narrate(event: ResolvedEvent): NarrativeBlock[];
  /** Describe a combat action result as narrative text */
  describeCombatAction(result: ActionResult): NarrativeBlock;
  /** Describe a location for the player */
  describeLocation(location: unknown): NarrativeBlock;
  /** Describe an NPC for the player */
  describeNPC(npc: unknown): NarrativeBlock;
}
