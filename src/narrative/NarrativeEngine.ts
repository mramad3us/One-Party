import type {
  ActionResult,
  Location,
  NarrativeBlock,
  NarrativeEngine,
  NPC,
  ResolvedEvent,
} from '@/types';

// ── Location description templates ─────────────────────────────────

const LOCATION_INTROS: Record<string, string[]> = {
  village: [
    'You step into the village of {name}. {description}',
    'The humble settlement of {name} stretches before you. {description}',
    'Woodsmoke curls from chimneys as you enter {name}. {description}',
  ],
  town: [
    'The town of {name} bustles with activity. {description}',
    'You pass through the gates of {name}. {description}',
  ],
  dungeon: [
    'Darkness swallows the light as you descend into {name}. {description}',
    'The air grows cold and stale as you enter {name}. {description}',
    'You steel yourself and step into {name}. {description}',
  ],
  wilderness: [
    'The wild expanse of {name} stretches before you. {description}',
    'You find yourself in {name}, far from civilization. {description}',
    'Nature reigns supreme in {name}. {description}',
  ],
  ruins: [
    'The crumbling remains of {name} loom ahead. {description}',
    'Time has not been kind to {name}. {description}',
  ],
  cave: [
    'The mouth of {name} yawns before you like a hungry maw. {description}',
    'A chill draft blows from the entrance to {name}. {description}',
  ],
  castle: [
    'The imposing walls of {name} rise before you. {description}',
    'You approach the gates of {name}. {description}',
  ],
  temple: [
    'A sense of reverence fills the air as you enter {name}. {description}',
    'The sacred halls of {name} welcome you. {description}',
  ],
  camp: [
    'The makeshift camp of {name} comes into view. {description}',
    'Campfires flicker in {name}. {description}',
  ],
  city: [
    'The sprawling city of {name} envelops you. {description}',
  ],
};

// ── NPC description templates ──────────────────────────────────────

const NPC_DESCRIPTIONS: Record<string, string[]> = {
  innkeeper: [
    'A stout figure stands behind the bar, wiping a mug with a practiced hand. This is {name}, the innkeeper.',
    '{name} greets you with a warm smile, the firelight casting dancing shadows across their face.',
  ],
  guard: [
    '{name} stands at attention, hand resting on the pommel of their weapon, watching you with keen eyes.',
    'A guard named {name} blocks the way, their expression stern and watchful.',
  ],
  merchant: [
    '{name} sits behind a counter laden with goods, their eyes brightening at the sight of a potential customer.',
    'A merchant called {name} beckons you closer, gesturing at their wares with obvious pride.',
  ],
  companion: [
    '{name} stands ready at your side, a trusted ally in these dangerous lands.',
    'Your companion {name} surveys the surroundings with practiced vigilance.',
  ],
  commoner: [
    '{name} goes about their daily business, pausing to glance your way.',
    'A local named {name} notices your approach.',
  ],
  quest_giver: [
    '{name} waves you over urgently, their expression troubled.',
    'A worried-looking figure introduces themselves as {name}.',
  ],
  hostile: [
    '{name} snarls at your approach, weapon drawn and ready for violence.',
    'The hostile figure of {name} bars your path, murder in their eyes.',
  ],
  noble: [
    '{name} regards you with an air of superiority, their fine clothing marking their station.',
    'Dressed in finery, {name} surveys you with a critical eye.',
  ],
  priest: [
    '{name} stands before the altar in quiet contemplation, their robes flowing gently.',
    'A serene figure in holy vestments, {name} turns to greet you with gentle eyes.',
  ],
  blacksmith: [
    '{name} hammers away at the forge, sparks flying with each strike. Sweat glistens on their muscular arms.',
    'The ring of metal on metal announces {name}\'s presence long before you see the smithy.',
  ],
};

// ── Event narration templates ──────────────────────────────────────

const EVENT_NARRATIVES: Record<string, string[]> = {
  encounter: [
    'A hostile presence makes itself known!',
    'Danger emerges without warning!',
    'You are not alone — prepare for battle!',
  ],
  event: [
    'Something catches your attention.',
    'An unexpected development occurs.',
    'The world around you shifts.',
  ],
  loot: [
    'Among the spoils, you discover:',
    'A search of the area reveals:',
    'You find the following:',
  ],
  quest: [
    'A new task presents itself.',
    'An opportunity for adventure arises.',
  ],
};

// ── Combat action templates ────────────────────────────────────────

const COMBAT_DESCRIPTIONS: Record<string, string[]> = {
  attack_hit: [
    'The attack strikes true!',
    'The blow connects with force!',
    'A solid hit!',
  ],
  attack_miss: [
    'The attack goes wide!',
    'The blow misses its mark!',
    'The attack fails to connect!',
  ],
  cast_spell: [
    'Arcane energy crackles through the air!',
    'The spell takes effect!',
    'Magical power surges forth!',
  ],
  dodge: [
    'A defensive stance is taken, ready to evade incoming attacks.',
  ],
  dash: [
    'A burst of speed carries them across the battlefield.',
  ],
  use_item: [
    'An item is used.',
  ],
};

function interpolate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}

export class TextNarrativeEngine implements NarrativeEngine {
  narrate(event: ResolvedEvent): NarrativeBlock[] {
    const blocks: NarrativeBlock[] = [];
    const type = event.type;

    // Get event-type narrative
    const templates = EVENT_NARRATIVES[type] ?? EVENT_NARRATIVES['event'];
    const template = templates[Math.floor(Math.random() * templates.length)];

    blocks.push({
      text: template,
      category: type === 'encounter' ? 'combat' : 'description',
      tone: 'neutral',
    });

    // Add narrative hints as additional blocks
    for (const hint of event.narrativeHints) {
      const description = hint.context['description'] ?? hint.context['text'] ?? '';
      if (description) {
        blocks.push({
          text: description,
          category: 'description',
          tone: hint.tone,
        });
      }
    }

    return blocks;
  }

  describeCombatAction(result: ActionResult): NarrativeBlock {
    const templates = result.success
      ? COMBAT_DESCRIPTIONS[`${result.type}_hit`] ?? COMBAT_DESCRIPTIONS['attack_hit']
      : COMBAT_DESCRIPTIONS[`${result.type}_miss`] ?? COMBAT_DESCRIPTIONS['attack_miss'];

    const templateText = templates
      ? templates[Math.floor(Math.random() * templates.length)]
      : result.description;

    let text = templateText;
    if (result.damage !== undefined && result.damage > 0) {
      text += ` (${result.damage} ${result.damageType ?? ''} damage)`;
    }

    return {
      text,
      category: 'combat',
      tone: result.success ? 'exciting' : 'neutral',
    };
  }

  describeLocation(location: unknown): NarrativeBlock {
    const loc = location as Location;
    const templates = LOCATION_INTROS[loc.locationType] ?? LOCATION_INTROS['wilderness'];
    const template = templates[Math.floor(Math.random() * templates.length)];

    const text = interpolate(template, {
      name: loc.name,
      description: loc.description,
    });

    return {
      text,
      category: 'description',
      tone: 'atmospheric',
    };
  }

  describeNPC(npc: unknown): NarrativeBlock {
    const npcData = npc as NPC;
    const templates = NPC_DESCRIPTIONS[npcData.role] ?? NPC_DESCRIPTIONS['commoner'];
    const template = templates[Math.floor(Math.random() * templates.length)];

    const text = interpolate(template, {
      name: npcData.name,
    });

    return {
      text,
      category: 'description',
      tone: 'neutral',
    };
  }
}
