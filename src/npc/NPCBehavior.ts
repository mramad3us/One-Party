import type {
  EntityId,
  Location,
  NarrativeHint,
  NPC,
  ResolvedEvent,
} from '@/types';

export interface BehaviorContext {
  location: Location;
  nearbyEntities: EntityId[];
  recentEvents: ResolvedEvent[];
  playerDisposition: number;
}

export type NPCAction =
  | { type: 'idle' }
  | { type: 'talk'; target: EntityId; topic: string }
  | { type: 'move'; destination: EntityId }
  | { type: 'trade' }
  | { type: 'quest_offer'; questTemplate: string };

// ── Dialogue tables ─────────────────────────────────────────────────

const ROLE_GREETINGS: Record<string, string[]> = {
  innkeeper: [
    'Welcome, traveler! Pull up a chair and rest your weary bones.',
    'Ah, a customer! What can I get you? Ale? A warm meal?',
    'Come in, come in! The fire\'s warm and the ale is cold.',
  ],
  merchant: [
    'Fine wares for sale! Take a look, friend.',
    'Looking to buy? I\'ve got the best prices in the region.',
    'Welcome to my shop. Everything you see is for sale.',
  ],
  guard: [
    'Move along, citizen. No trouble here.',
    'Keep your weapons sheathed within the village walls.',
    'State your business, stranger.',
  ],
  quest_giver: [
    'You look capable. I might have a task that suits your talents.',
    'Adventurer, eh? I\'ve been looking for someone like you.',
    'If you\'re looking for work, I have a proposition.',
  ],
  commoner: [
    'Good day to you.',
    'Pleasant weather we\'re having, isn\'t it?',
    'Haven\'t seen you around here before.',
  ],
  noble: [
    'I trust you have business here?',
    'Hmm, another adventurer. How... quaint.',
    'You may address me properly.',
  ],
  priest: [
    'May the light guide your path, child.',
    'The temple is open to all who seek solace.',
    'Be at peace, traveler. You are safe here.',
  ],
  blacksmith: [
    'Need something forged? You\'ve come to the right place.',
    'I can repair that armor of yours, if you need.',
    'Step closer to the forge. What do you need crafted?',
  ],
  companion: [
    'Ready when you are.',
    'What\'s the plan?',
    'Lead the way, I\'m with you.',
  ],
  hostile: [
    'You shouldn\'t have come here.',
    'Your belongings will be mine soon enough.',
    'Prepare yourself!',
  ],
};

const TOPIC_RESPONSES: Record<string, string[]> = {
  rumors: [
    'I\'ve heard strange sounds coming from the old ruins to the north.',
    'They say bandits have been ambushing travelers on the eastern road.',
    'A merchant passed through telling tales of treasure in the caves nearby.',
    'Something has been killing livestock on the outskirts of the village.',
  ],
  directions: [
    'The dungeon? Head north through the forest. Can\'t miss it.',
    'Follow the main road east and you\'ll reach the next town.',
    'The cave entrance is hidden behind the waterfall to the west.',
  ],
  history: [
    'This village was founded generations ago by settlers from the east.',
    'The ruins were once a great fortress, before the war.',
    'They say an ancient evil sleeps beneath these lands.',
  ],
  trade: [
    'I\'ve got supplies if you need them. Take a look.',
    'I can offer a fair price for anything you want to sell.',
    'My stock changes regularly. Check back often.',
  ],
};

const DISPOSITION_MODIFIERS: Record<string, number> = {
  greeting: 1,
  helped: 5,
  completed_quest: 10,
  insulted: -5,
  attacked: -20,
  gifted: 3,
};

export class NPCBehavior {
  decideAction(npc: NPC, context: BehaviorContext): NPCAction {
    // Hostile NPCs always try to fight
    if (npc.role === 'hostile') {
      if (context.nearbyEntities.length > 0) {
        return { type: 'talk', target: context.nearbyEntities[0], topic: 'threat' };
      }
      return { type: 'idle' };
    }

    // Quest givers offer quests to nearby players with friendly disposition
    if (npc.role === 'quest_giver' && context.playerDisposition >= 0) {
      if (context.nearbyEntities.length > 0) {
        return { type: 'quest_offer', questTemplate: 'generic_fetch_quest' };
      }
    }

    // Merchants/innkeepers offer trade
    if (npc.role === 'merchant' || npc.role === 'innkeeper' || npc.role === 'blacksmith') {
      if (context.nearbyEntities.length > 0 && context.playerDisposition >= -10) {
        return { type: 'trade' };
      }
    }

    // Companions follow the player
    if (npc.role === 'companion') {
      if (context.nearbyEntities.length > 0) {
        return { type: 'talk', target: context.nearbyEntities[0], topic: 'companion_chat' };
      }
    }

    // Default: idle
    return { type: 'idle' };
  }

  updateGoals(npc: NPC, events: ResolvedEvent[]): void {
    if (!npc.companion) return;

    for (const event of events) {
      // Check if any events relate to NPC goals
      const eventType = event.resolvedData['type'] as string | undefined;

      if (eventType === 'quest_complete') {
        for (const goal of npc.companion.goals.shortTerm) {
          if (!goal.completed) {
            goal.progress = Math.min(1, goal.progress + 0.25);
            if (goal.progress >= 1) {
              goal.completed = true;
            }
          }
        }
      }

      // Negative events lower morale
      if (eventType === 'ally_death') {
        const sentimentKey = DISPOSITION_MODIFIERS['attacked'];
        void sentimentKey;
      }
    }
  }

  getDialogueResponse(npc: NPC, topic: string): NarrativeHint {
    // Check for role-specific greeting
    if (topic === 'greeting' || topic === '') {
      const greetings = ROLE_GREETINGS[npc.role] ?? ROLE_GREETINGS['commoner'];
      const greeting = greetings[Math.floor(Math.random() * greetings.length)];
      return {
        key: 'dialogue',
        tone: npc.role === 'hostile' ? 'threatening' : 'friendly',
        context: {
          speaker: npc.name,
          text: greeting,
          role: npc.role,
        },
      };
    }

    // Check topic responses
    const responses = TOPIC_RESPONSES[topic];
    if (responses) {
      const response = responses[Math.floor(Math.random() * responses.length)];
      return {
        key: 'dialogue',
        tone: 'informative',
        context: {
          speaker: npc.name,
          text: response,
          topic,
        },
      };
    }

    // Default response
    return {
      key: 'dialogue',
      tone: 'neutral',
      context: {
        speaker: npc.name,
        text: `"I don't know much about that, I'm afraid."`,
        topic,
      },
    };
  }
}
