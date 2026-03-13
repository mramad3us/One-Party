import type {
  ActionResult,
  DamageType,
  DiceRollResult,
  NarrativeBlock,
} from '@/types';

// ── Attack hit variants ────────────────────────────────────────────

const ATTACK_HIT_MELEE = [
  '{attacker} swings {weapon} at {target} — the blow strikes true!',
  '{attacker}\'s {weapon} finds its mark, biting into {target}.',
  'With a fierce cry, {attacker} drives {weapon} into {target}.',
  '{attacker} lunges forward, {weapon} connecting solidly with {target}.',
  'A well-placed strike from {attacker}\'s {weapon} catches {target} off guard.',
];

const ATTACK_HIT_RANGED = [
  '{attacker} looses a shot that strikes {target} squarely.',
  'The projectile from {attacker}\'s {weapon} finds its mark in {target}.',
  '{attacker}\'s aim is true — the shot pierces {target}.',
  'With practiced precision, {attacker} sends {weapon} flying into {target}.',
  'A well-aimed shot from {attacker} catches {target} in the open.',
];

const ATTACK_HIT_UNARMED = [
  '{attacker} strikes {target} with a powerful blow!',
  '{attacker}\'s fist connects with {target}, staggering them.',
  'With raw strength, {attacker} hammers {target}.',
];

// ── Attack miss variants ───────────────────────────────────────────

const ATTACK_MISS = [
  '{attacker} swings {weapon} at {target}, but the blow goes wide.',
  '{target} sidesteps {attacker}\'s {weapon} at the last moment.',
  '{attacker}\'s {weapon} whistles through the air, missing {target} entirely.',
  'The attack from {attacker} glances off {target}\'s armor harmlessly.',
  '{target} ducks beneath {attacker}\'s swing, the blade passing harmlessly overhead.',
];

// ── Critical hit variants ──────────────────────────────────────────

const CRITICAL_HIT = [
  'A devastating blow! {attacker} strikes {target} with terrible force!',
  'CRITICAL HIT! {attacker}\'s {weapon} finds a gap in {target}\'s defenses for maximum effect!',
  '{attacker} delivers a masterful strike against {target} — a critical blow!',
  'The stars align for {attacker} — a perfectly placed strike devastates {target}!',
  'With uncanny precision, {attacker} lands a crippling blow on {target}!',
];

// ── Damage description variants ────────────────────────────────────

const DAMAGE_DESCRIPTIONS: Record<DamageType, string[]> = {
  slashing: [
    '{target} reels as the blade opens a gash, dealing {amount} slashing damage.',
    'A crimson line appears across {target} — {amount} slashing damage!',
    'The edge bites deep into {target} for {amount} slashing damage.',
  ],
  piercing: [
    'The point drives into {target}, dealing {amount} piercing damage.',
    '{target} staggers as the weapon pierces flesh — {amount} piercing damage!',
    'A sharp thrust punctures {target} for {amount} piercing damage.',
  ],
  bludgeoning: [
    'A crushing blow slams into {target} for {amount} bludgeoning damage.',
    'Bones creak under the impact — {target} takes {amount} bludgeoning damage!',
    'The heavy strike sends {target} staggering, dealing {amount} bludgeoning damage.',
  ],
  fire: [
    'Flames engulf {target}, dealing {amount} fire damage!',
    '{target} screams as fire sears flesh — {amount} fire damage!',
    'A burst of flame scorches {target} for {amount} fire damage.',
  ],
  cold: [
    'Bitter cold seizes {target}, dealing {amount} cold damage.',
    'Frost spreads across {target}\'s skin — {amount} cold damage!',
    'An icy blast chills {target} to the bone for {amount} cold damage.',
  ],
  lightning: [
    'A bolt of lightning arcs through {target} for {amount} lightning damage!',
    'Electricity crackles across {target}\'s body — {amount} lightning damage!',
    '{target} convulses as lightning courses through them for {amount} lightning damage.',
  ],
  thunder: [
    'A thunderous boom slams into {target}, dealing {amount} thunder damage!',
    'The concussive force batters {target} for {amount} thunder damage.',
    '{target} is staggered by the sonic blast — {amount} thunder damage!',
  ],
  poison: [
    'Venom courses through {target}\'s veins — {amount} poison damage!',
    '{target}\'s face turns green as poison takes hold for {amount} damage.',
    'Toxic ichor burns {target} from within, dealing {amount} poison damage.',
  ],
  acid: [
    'Acid sizzles as it eats into {target}, dealing {amount} acid damage!',
    '{target} howls as caustic liquid burns flesh — {amount} acid damage!',
    'Corrosive acid dissolves armor and flesh alike for {amount} acid damage.',
  ],
  necrotic: [
    'Dark energy drains the life from {target} — {amount} necrotic damage!',
    '{target}\'s flesh withers as necrotic power courses through them for {amount} damage.',
    'A wave of deathly energy washes over {target}, dealing {amount} necrotic damage.',
  ],
  radiant: [
    'Holy light sears {target} for {amount} radiant damage!',
    '{target} recoils from the blinding radiance — {amount} radiant damage!',
    'Divine energy burns {target}, dealing {amount} radiant damage.',
  ],
  force: [
    'An invisible force hammers {target} for {amount} force damage!',
    'Pure magical energy strikes {target}, dealing {amount} force damage.',
    '{target} is struck by unseen force — {amount} damage!',
  ],
  psychic: [
    '{target}\'s mind reels under a psychic assault — {amount} psychic damage!',
    'Mental anguish tears through {target} for {amount} psychic damage.',
    '{target} clutches their head as psychic energy deals {amount} damage.',
  ],
};

// ── Kill variants ──────────────────────────────────────────────────

const KILL_DESCRIPTIONS = [
  '{attacker} delivers the killing blow — {target} collapses to the ground, lifeless.',
  'With a final, devastating strike, {attacker} fells {target}.',
  '{target} crumples under {attacker}\'s assault, the light fading from their eyes.',
  'A mortal wound from {attacker} brings {target} down for good.',
  '{attacker}\'s attack proves fatal. {target} falls, defeated.',
];

// ── Death save variants ────────────────────────────────────────────

const DEATH_SAVE_SUCCESS = [
  '{character} clings to life, fighting against the darkness. (Success {successes}/3)',
  'A faint heartbeat — {character} is still holding on. (Success {successes}/3)',
  '{character} draws a ragged breath, refusing to give in. (Success {successes}/3)',
];

const DEATH_SAVE_FAILURE = [
  '{character} slips further toward oblivion. (Failure {failures}/3)',
  'The light in {character}\'s eyes dims dangerously. (Failure {failures}/3)',
  '{character}\'s breathing grows shallow and labored. (Failure {failures}/3)',
];

const DEATH_SAVE_CRITICAL_SUCCESS = [
  '{character} gasps and surges back to consciousness! A miraculous recovery!',
  'Against all odds, {character} fights back from the brink of death!',
];

const DEATH_SAVE_CRITICAL_FAILURE = [
  '{character} convulses violently — two failures at once! (Failures {failures}/3)',
  'A terrible spasm racks {character}\'s body. Things look grim. (Failures {failures}/3)',
];

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

function interpolate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}

export class CombatNarrator {
  describeAttack(
    result: ActionResult,
    attacker: string,
    target: string,
    weapon?: string,
  ): NarrativeBlock {
    const wpn = weapon ?? 'their weapon';
    const vars = { attacker, target, weapon: wpn };

    if (result.success) {
      const isRanged = weapon
        ? ['bow', 'crossbow', 'sling', 'javelin'].some((w) => weapon.toLowerCase().includes(w))
        : false;
      const pool = isRanged ? ATTACK_HIT_RANGED : (weapon ? ATTACK_HIT_MELEE : ATTACK_HIT_UNARMED);
      return {
        text: interpolate(pick(pool), vars),
        category: 'combat',
        tone: 'action',
      };
    }

    return {
      text: interpolate(pick(ATTACK_MISS), vars),
      category: 'combat',
      tone: 'neutral',
    };
  }

  describeDamage(amount: number, type: DamageType, target: string): NarrativeBlock {
    const templates = DAMAGE_DESCRIPTIONS[type] ?? DAMAGE_DESCRIPTIONS['bludgeoning'];
    const vars = { target, amount: String(amount) };

    return {
      text: interpolate(pick(templates), vars),
      category: 'combat',
      tone: amount >= 20 ? 'dramatic' : 'action',
    };
  }

  describeMiss(attacker: string, target: string, weapon?: string): NarrativeBlock {
    const vars = { attacker, target, weapon: weapon ?? 'their weapon' };

    return {
      text: interpolate(pick(ATTACK_MISS), vars),
      category: 'combat',
      tone: 'neutral',
    };
  }

  describeCritical(attacker: string, target: string): NarrativeBlock {
    const vars = { attacker, target, weapon: 'their weapon' };

    return {
      text: interpolate(pick(CRITICAL_HIT), vars),
      category: 'combat',
      tone: 'dramatic',
    };
  }

  describeKill(attacker: string, target: string): NarrativeBlock {
    const vars = { attacker, target };

    return {
      text: interpolate(pick(KILL_DESCRIPTIONS), vars),
      category: 'combat',
      tone: 'dramatic',
    };
  }

  describeDeathSave(
    character: string,
    result: DiceRollResult,
    successes: number,
    failures: number,
  ): NarrativeBlock {
    const vars = {
      character,
      successes: String(successes),
      failures: String(failures),
    };

    let pool: string[];

    if (result.isCritical) {
      // Natural 20 on death save
      pool = DEATH_SAVE_CRITICAL_SUCCESS;
    } else if (result.isFumble) {
      // Natural 1 on death save
      pool = DEATH_SAVE_CRITICAL_FAILURE;
    } else if (result.total >= 10) {
      pool = DEATH_SAVE_SUCCESS;
    } else {
      pool = DEATH_SAVE_FAILURE;
    }

    return {
      text: interpolate(pick(pool), vars),
      category: 'combat',
      tone: result.total >= 10 ? 'hopeful' : 'dire',
    };
  }
}
