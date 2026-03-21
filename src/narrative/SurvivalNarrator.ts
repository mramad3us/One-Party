import type { NarrativeBlock } from '@/types/narrative';
import type { SurvivalState, HungerThreshold, ThirstThreshold, FatigueThreshold } from '@/types';
import { SurvivalRules } from '@/rules/SurvivalRules';

// ── Hunger Narratives ─────────────────────────────────────

const HUNGER_NARRATIVES: Record<HungerThreshold, string[]> = {
  satiated: [
    'Your belly is pleasantly full. The world feels a little kinder on a full stomach.',
  ],
  comfortable: [
    'You feel well-fed and content. No complaints from your stomach.',
  ],
  peckish: [
    'Your stomach murmurs quietly — a gentle reminder that the road offers no feasts.',
    'A faint hollowness stirs below your ribs. Not urgent. Not yet.',
    'You catch yourself glancing at your pack, wondering what provisions remain.',
  ],
  hungry: [
    'Hunger has settled in like an unwelcome guest. Your thoughts keep drifting to food.',
    'Your stomach growls audibly. The emptiness is no longer subtle.',
    'A persistent gnawing occupies the edge of your awareness. You need to eat.',
  ],
  very_hungry: [
    'The hunger is sharp now, a blade twisting in your gut. Concentration falters.',
    'Your hands shake slightly as you walk. When did you last eat? The memory is hazy.',
    'Every scent on the wind — woodsmoke, earth, rain — makes your mouth water desperately.',
  ],
  famished: [
    'Your limbs feel hollow, filled with nothing but ache. The world narrows to a single thought: food.',
    'Weakness creeps through your body like cold water. Even bark and dirt begin to seem appealing.',
    'You stumble, vision swimming. The hunger has become a living thing inside you, consuming what little strength remains.',
  ],
  starving: [
    'Your body is eating itself. Each step is an act of defiance against the abyss.',
    'The world tilts and sways. Reality frays at the edges. You are beyond hunger now — this is dying, slowly.',
    'Consciousness comes and goes in waves. Your body has become a prison of bone and desperation.',
  ],
};

// ── Thirst Narratives ─────────────────────────────────────

const THIRST_NARRATIVES: Record<ThirstThreshold, string[]> = {
  quenched: [
    'Well-watered and clear-headed. The simple pleasure of quenched thirst.',
  ],
  hydrated: [
    'You feel adequately hydrated. No complaints.',
  ],
  mild_thirst: [
    'A faint dryness tickles the back of your throat.',
    'You lick your lips absently. A drink would be welcome, though not urgent.',
  ],
  thirsty: [
    'Your mouth is dry, tongue thick against your palate. You need water.',
    'Thirst presses at the edges of your focus. Each swallow feels coarse.',
    'The dry air scrapes your throat raw. Water — you need water.',
  ],
  very_thirsty: [
    'Your lips crack and split. Every breath is a rasp of sandpaper.',
    'The world shimmers at the edges. Your tongue is a dead thing in your mouth.',
    'You would trade gold for water. Silver for a single mouthful of rain.',
  ],
  parched: [
    'Your throat has closed to a pinhole. Speech comes in cracked whispers.',
    'Swallowing is agony. Your vision darkens at the periphery, tunneling inward.',
    'The thirst is a fire in your skull. Thought dissolves into animal need.',
  ],
  dehydrated: [
    'Your body is shutting down. Organs failing, one by one, for want of water.',
    'You can no longer form coherent thoughts. Only thirst. Only the burning.',
    'Death whispers from the dry places. Without water, it will not wait long.',
  ],
};

// ── Fatigue Narratives ────────────────────────────────────

const FATIGUE_NARRATIVES: Record<FatigueThreshold, string[]> = {
  rested: [
    'You feel sharp and alert. Sleep has done its work well.',
  ],
  alert: [
    'Your mind is clear, though the day begins to weigh on you.',
  ],
  tired: [
    'Weariness creeps into your bones. Your eyelids grow heavy between blinks.',
    'Your body asks for rest. Not demands — not yet. But it asks.',
    'Each step takes slightly more effort than the last. The road grows long.',
  ],
  weary: [
    'Exhaustion clings to you like wet wool. Your reactions are a half-beat slow.',
    'The world feels muffled, distant. Sleep pulls at the corners of your mind.',
    'You catch yourself drifting, thoughts unraveling like loose thread.',
  ],
  exhausted: [
    'Your body moves on instinct alone. The mind is a guttering candle.',
    'Standing is an achievement. Walking is heroism. Thinking is nearly impossible.',
    'Shadows gather at the edges of your vision. Your body screams for rest.',
  ],
  delirious: [
    'Reality fractures. Voices murmur from empty air. Is that a fire, or a memory of fire?',
    'You no longer know if your eyes are open or closed. The darkness is the same either way.',
    'Your body has become a stranger. It moves without your consent, stumbles without your knowledge.',
  ],
};

// ── Consumption Narratives ────────────────────────────────

const EATING_NARRATIVES: Record<string, string[]> = {
  starving_to_fed: [
    'You devour the food with desperate, shaking hands. Life flows back into you, warm and real.',
    'The first bite brings tears. You eat like a beast, caring nothing for dignity — only survival.',
  ],
  hungry_to_fed: [
    'You eat gratefully, each bite pushing back the gnawing emptiness.',
    'The food is simple, but it tastes like salvation.',
  ],
  peckish_to_fed: [
    'You eat steadily, a measured meal to keep your strength.',
    'A satisfying meal. The hollow feeling retreats.',
  ],
  comfortable: [
    'You eat without urgency, savouring what you have.',
  ],
};

const DRINKING_NARRATIVES: Record<string, string[]> = {
  parched_to_quenched: [
    'Water touches your lips and the world explodes back into clarity. You drink deep, greedy, alive.',
    'The liquid hits your throat like a miracle. You gasp between swallows, unable to stop.',
  ],
  thirsty_to_quenched: [
    'Cool water slides down your throat, washing away the dryness. Relief, pure and simple.',
    'You drink slowly, letting each mouthful restore what the road took.',
  ],
  mild_to_quenched: [
    'A refreshing drink. The faint dryness vanishes.',
  ],
  comfortable: [
    'You take a measured drink, staying ahead of the thirst.',
  ],
};

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

export class SurvivalNarrator {
  /** Generate narrative for a hunger threshold crossing. */
  static describeHungerCrossing(to: HungerThreshold): NarrativeBlock {
    return {
      text: pick(HUNGER_NARRATIVES[to]),
      category: 'description',
      tone: to === 'starving' || to === 'famished' ? 'desperate' : 'atmospheric',
    };
  }

  /** Generate narrative for a thirst threshold crossing. */
  static describeThirstCrossing(to: ThirstThreshold): NarrativeBlock {
    return {
      text: pick(THIRST_NARRATIVES[to]),
      category: 'description',
      tone: to === 'dehydrated' || to === 'parched' ? 'desperate' : 'atmospheric',
    };
  }

  /** Generate narrative for a fatigue threshold crossing. */
  static describeFatigueCrossing(to: FatigueThreshold): NarrativeBlock {
    return {
      text: pick(FATIGUE_NARRATIVES[to]),
      category: 'description',
      tone: to === 'delirious' || to === 'exhausted' ? 'desperate' : 'atmospheric',
    };
  }

  /** Generate narrative for eating food. */
  static describeEating(hungerBefore: number, _hungerAfter: number, itemDescription?: string): NarrativeBlock {
    let key = 'comfortable';
    if (hungerBefore >= 76) key = 'starving_to_fed';
    else if (hungerBefore >= 46) key = 'hungry_to_fed';
    else if (hungerBefore >= 31) key = 'peckish_to_fed';

    const templates = EATING_NARRATIVES[key] ?? EATING_NARRATIVES['comfortable'];
    let text = pick(templates);
    if (itemDescription) {
      text = itemDescription + ' ' + text;
    }

    return { text, category: 'action', tone: 'atmospheric' };
  }

  /** Generate narrative for drinking. */
  static describeDrinking(thirstBefore: number, _thirstAfter: number, itemDescription?: string): NarrativeBlock {
    let key = 'comfortable';
    if (thirstBefore >= 76) key = 'parched_to_quenched';
    else if (thirstBefore >= 46) key = 'thirsty_to_quenched';
    else if (thirstBefore >= 31) key = 'mild_to_quenched';

    const templates = DRINKING_NARRATIVES[key] ?? DRINKING_NARRATIVES['comfortable'];
    let text = pick(templates);
    if (itemDescription) {
      text = itemDescription + ' ' + text;
    }

    return { text, category: 'action', tone: 'atmospheric' };
  }

  /** Blended status description combining all three tracks. */
  static describeOverallStatus(survival: SurvivalState): NarrativeBlock {
    const hunger = SurvivalRules.getHungerThreshold(survival.hunger);
    const thirst = SurvivalRules.getThirstThreshold(survival.thirst);
    const fatigue = SurvivalRules.getFatigueThreshold(survival.fatigue);

    const parts: string[] = [];

    // Only mention tracks that are noteworthy
    if (hunger === 'satiated' && thirst === 'quenched' && fatigue === 'rested') {
      return {
        text: 'You feel strong and well-provisioned. Body and mind are sharp, ready for whatever lies ahead.',
        category: 'description',
        tone: 'atmospheric',
      };
    }

    if (survival.hunger >= 46) {
      parts.push(pick(HUNGER_NARRATIVES[hunger]));
    } else if (survival.hunger >= 31) {
      parts.push('A faint hunger nags at the edges of your focus.');
    }

    if (survival.thirst >= 46) {
      parts.push(pick(THIRST_NARRATIVES[thirst]));
    } else if (survival.thirst >= 31) {
      parts.push('Your throat is a touch dry.');
    }

    if (survival.fatigue >= 46) {
      parts.push(pick(FATIGUE_NARRATIVES[fatigue]));
    } else if (survival.fatigue >= 31) {
      parts.push('Tiredness weighs on your limbs.');
    }

    if (parts.length === 0) {
      return {
        text: 'You are in fair condition. No immediate concerns trouble your body.',
        category: 'description',
        tone: 'atmospheric',
      };
    }

    return {
      text: parts.join(' '),
      category: 'description',
      tone: survival.hunger >= 76 || survival.thirst >= 76 || survival.fatigue >= 76 ? 'desperate' : 'atmospheric',
    };
  }
}
