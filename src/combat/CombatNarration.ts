/**
 * DM-style combat narration. Every spell, attack, and ability gets
 * its own flavor text — narrative first, mechanics in parentheses.
 */

// ── Types ──

type NarrationEntry = {
  hit?: string[];    // Spell attack or melee hit
  miss?: string[];   // Spell attack or melee miss
  save?: string[];   // Target succeeds saving throw
  fail?: string[];   // Target fails saving throw
  auto?: string[];   // Auto-hit (Magic Missile)
  heal?: string[];   // Healing effect
  buff?: string[];   // Utility/buff with no damage
};

// ── Helpers ──

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Spell Narration Registry ──
// Keyed by spell name (exact match).

const SPELL_NARRATION: Record<string, NarrationEntry> = {
  // ── Cantrips ──
  'Acid Splash': {
    fail: ['A glob of acid arcs through the air and splashes across the target, hissing as it eats through armor and flesh.'],
    save: ['Acid splatters toward the target, but they dodge the worst of it — only a few drops sizzle on contact.'],
  },
  'Chill Touch': {
    hit: ['A ghostly, skeletal hand materializes and claws at the target, leeching warmth from their very bones.'],
    miss: ['A spectral hand reaches out but passes through empty air, its deathly chill dissipating harmlessly.'],
  },
  'Fire Bolt': {
    hit: ['A mote of fire streaks from the caster\'s fingertip and detonates against the target in a burst of flame.'],
    miss: ['A bolt of fire screams past the target, scorching the ground behind them.'],
  },
  'Poison Spray': {
    fail: ['A cloud of noxious green gas erupts in the target\'s face — they choke and gag as the poison burns through them.'],
    save: ['Toxic fumes billow toward the target, but they hold their breath and turn away in time.'],
  },
  'Ray of Frost': {
    hit: ['A frigid beam of blue-white light strikes the target, ice crystals forming where it hits. Their movements slow.'],
    miss: ['A beam of arctic cold lances out but misses, leaving a patch of frost on the ground.'],
  },
  'Shocking Grasp': {
    hit: ['Lightning crackles between the caster\'s fingers as they lunge — the target convulses as electricity surges through them.'],
    miss: ['Sparks fly from outstretched fingers, but the target jerks away before the current can arc.'],
  },
  'Sacred Flame': {
    fail: ['A column of radiant fire descends from above, engulfing the target in holy flame that burns the wicked.'],
    save: ['Divine light flares down, but the target throws themselves aside, the sacred fire scorching only stone.'],
  },
  'Toll the Dead': {
    fail: ['The air fills with the dolorous sound of a funeral bell — the target clutches their head as necrotic energy reverberates through them.'],
    save: ['A spectral bell tolls, but the target steels their will against the deathly resonance.'],
  },
  'Vicious Mockery': {
    fail: ['A string of magically laced insults cuts deeper than any blade — the target\'s confidence crumbles along with their composure.'],
    save: ['The mocking words sting, but the target shakes off the enchantment with a snarl.'],
  },
  'Produce Flame': {
    hit: ['A ball of fire is hurled from an open palm, splashing against the target in a wash of heat.'],
    miss: ['A handful of conjured flame sails wide, guttering out against the far wall.'],
  },
  'Eldritch Blast': {
    hit: ['A crackling beam of eldritch energy lances from the caster, striking with otherworldly force.'],
    miss: ['Eldritch energy screams through the air but veers off course, punching a hole in the ground beyond.'],
  },

  // ── Level 1 Damage ──
  'Burning Hands': {
    fail: ['A sheet of flame roars from outstretched fingers, washing over the target in a wave of searing heat.'],
    save: ['Fire erupts in a cone of flame — the target dives low, but the heat still singes them.'],
  },
  'Chromatic Orb': {
    hit: ['A shimmering sphere of elemental energy hurtles forward and detonates on impact, unleashing raw destruction.'],
    miss: ['The chromatic orb streaks past, trailing a rainbow of elemental energy before shattering against stone.'],
  },
  'Magic Missile': {
    auto: [
      'Glowing darts of magical force streak from the caster\'s fingers — each one unerringly finds its mark.',
      'Three bolts of pure arcane energy lance out, weaving through the air to strike without fail.',
    ],
  },
  'Thunderwave': {
    fail: ['A wave of thunderous force erupts outward — the target is slammed backward as the air itself detonates.'],
    save: ['Thunder rolls outward in a concussive blast. The target braces against it, staggering but holding ground.'],
  },
  'Witch Bolt': {
    hit: ['A sustained arc of blue lightning leaps from the caster\'s hand to the target, crackling and writhing.'],
    miss: ['Lightning arcs wildly, grounding itself into the floor instead of its intended victim.'],
  },
  'Guiding Bolt': {
    hit: ['A flash of light streaks toward the target and explodes in a burst of radiance, leaving them outlined in a dim glow.'],
    miss: ['A bolt of radiant energy blazes past the target, illuminating the battlefield for a brief, blinding instant.'],
  },
  'Inflict Wounds': {
    hit: ['Necrotic energy floods through the caster\'s touch — the target\'s flesh withers and blackens where the hand makes contact.'],
    miss: ['A hand wreathed in dark energy reaches out, but the target recoils just beyond its grasp.'],
  },
  'Dissonant Whispers': {
    fail: ['An insidious melody only the target can hear burrows into their mind — they scream, clutching their skull.'],
    save: ['Discordant whispers claw at the target\'s psyche, but they grit their teeth and force them out.'],
  },
  'Searing Smite': {
    hit: ['The weapon erupts in white-hot flame as it strikes — the target\'s wound catches fire, burning from within.'],
    miss: ['A blade wreathed in fire swings wide, trailing embers through empty air.'],
  },
  'Thunderous Smite': {
    hit: ['The weapon rings like a thunderclap on impact — a shockwave erupts from the point of contact.'],
    miss: ['Thunder gathers around the weapon, but the swing goes wide and the energy dissipates with a rumble.'],
  },
  'Wrathful Smite': {
    hit: ['The weapon gleams with dark fury as it bites into the target — a wave of dread washes over them.'],
    miss: ['Malevolent energy coils around the weapon, but it cuts only air.'],
  },
  'Hellish Rebuke': {
    fail: ['Flames of the Nine Hells erupt around the target in retribution — the stench of brimstone fills the air.'],
    save: ['Hellfire surges toward the attacker, but they throw up a guard and take only a lick of infernal flame.'],
  },
  'Arms of Hadar': {
    fail: ['Tendrils of dark energy erupt from the ground, lashing at the target and pulling at their very essence.'],
    save: ['Shadowy tentacles writhe outward, but the target wrenches free before they can take hold.'],
  },
  'Hex': {
    buff: ['A baleful curse settles over the target like a shroud — their weaknesses laid bare for exploitation.'],
  },
  'Divine Favor': {
    buff: ['Holy power surges through the caster\'s weapon, which begins to gleam with radiant light.'],
  },
  "Hunter's Mark": {
    buff: ['The target is marked — their movements become more predictable, their weaknesses more apparent.'],
  },
  'Armor of Agathys': {
    buff: ['A spectral layer of frost encases the caster, crackling with vengeful cold that awaits any who dare strike.'],
  },
  'Hail of Thorns': {
    fail: ['The projectile explodes into a hail of razor-sharp thorns that shred everything nearby.'],
    save: ['Thorns burst outward from the impact, but the target shields themselves from the worst of it.'],
  },

  // ── Level 2 Damage ──
  'Scorching Ray': {
    hit: ['A searing ray of fire lances out and strikes true, leaving a smoking wound.'],
    miss: ['A ray of fire streaks past, the heat of its passage palpable but harmless.'],
  },
  'Spiritual Weapon': {
    hit: ['A spectral weapon materializes and strikes with divine purpose, guided by an unseen hand.'],
    miss: ['The ghostly weapon swings but passes through empty space, fading slightly before reforming.'],
  },
  'Heat Metal': {
    fail: ['The target\'s armor glows cherry-red — they cry out in agony as the metal sears their flesh.'],
    save: ['Metal heats dangerously, but the target grits through the pain and keeps their grip.'],
  },
  'Moonbeam': {
    fail: ['A silvery beam of pale light shines down on the target, burning them with the cold fire of the moon.'],
    save: ['Moonlight washes over the target, but they steel themselves and emerge only slightly singed.'],
  },
  'Cloud of Daggers': {
    auto: ['The air fills with spinning, razor-sharp blades of force that slash at everything caught within.'],
  },
  'Flame Blade': {
    hit: ['A scimitar of fire materializes and slashes across the target, leaving a trail of cinders.'],
    miss: ['The flame blade sweeps through the air, its heat blistering but its edge finding nothing.'],
  },
  'Spike Growth': {
    buff: ['The ground erupts with razor-sharp thorns and spines — every step becomes agony for those caught within.'],
  },
  'Branding Smite': {
    hit: ['The weapon flares with searing radiance as it strikes — the wound glows, making the target impossible to hide.'],
    miss: ['Light gathers around the weapon, but the strike goes wide and the radiance fades.'],
  },

  // ── Level 3 Damage ──
  'Call Lightning': {
    fail: ['A bolt of lightning crashes down from above, striking the target with a deafening crack of thunder.'],
    save: ['Lightning splits the sky — the target dives aside, but the blast still singes and deafens.'],
  },
  'Vampiric Touch': {
    hit: ['A hand wreathed in shadow grips the target — their life force visibly drains, flowing back into the caster.'],
    miss: ['Shadow-wreathed fingers reach out hungrily but close on empty air.'],
  },
  'Lightning Arrow': {
    hit: ['The arrow transforms into a bolt of pure lightning mid-flight — it strikes with a thunderous crash.'],
    miss: ['A lightning-charged arrow screams past, the thunder of its passage ringing in everyone\'s ears.'],
  },
  'Blinding Smite': {
    hit: ['The weapon blazes with blinding radiant light as it connects — the target staggers, eyes seared by holy fury.'],
    miss: ['Radiance erupts around the weapon, but the blow fails to land. The light fades, the moment lost.'],
  },
  'Conjure Barrage': {
    fail: ['A storm of spectral weapons cascades down upon the target, each one finding flesh.'],
    save: ['Phantom projectiles rain down, but the target weaves between them, catching only glancing blows.'],
  },
  'Hunger of Hadar': {
    fail: ['A sphere of absolute darkness opens — within, something gnaws and slurps. The target screams.'],
    save: ['The void yawns open, frigid and hungry. The target resists the worst of the otherworldly cold.'],
  },
  'Wind Wall': {
    buff: ['A wall of howling wind springs into existence, sending debris and projectiles spiraling away.'],
  },
  "Crusader's Mantle": {
    buff: ['A holy aura radiates outward — allies feel righteous fury kindle in their hearts, their strikes empowered.'],
  },
  'Elemental Weapon': {
    buff: ['The weapon hums with elemental energy, its edge now wreathed in destructive power.'],
  },

  // ── Level 4+ Damage ──
  'Blight': {
    fail: ['Necromantic energy surges through the target — moisture evaporates from their body, skin cracking like parched earth.'],
    save: ['Dark energy washes over the target, but their vitality resists the worst of the withering.'],
  },
  'Phantasmal Killer': {
    fail: ['The target\'s eyes go wide with primal terror — they see something only they can see, and it is killing them.'],
    save: ['A phantom of fear claws at the target\'s mind, but they shake off the nightmarish vision.'],
  },
  'Fire Shield': {
    buff: ['Flames wreath the caster\'s body — a shield of living fire that lashes out at any who dare strike.'],
  },
  'Staggering Smite': {
    hit: ['The weapon crashes home with psychic force — the target\'s mind reels, their vision swimming.'],
    miss: ['Psychic energy gathers on the weapon\'s edge but finds no target to afflict.'],
  },
  'Banishing Smite': {
    hit: ['The weapon erupts with a force that tears at the boundary between planes — the target flickers, partially banished.'],
    miss: ['Planar energy crackles along the weapon, but the swing goes wide. Reality stabilizes.'],
  },
  'Cloudkill': {
    fail: ['A sickly yellow-green fog rolls over the target — they choke and retch as the poison eats at them from within.'],
    save: ['Toxic fog engulfs the area. The target covers their mouth and pushes through, but the poison still burns.'],
  },
  'Destructive Wave': {
    fail: ['The ground cracks as divine energy erupts outward — thunder and radiance sweep the target off their feet.'],
    save: ['A shockwave of holy thunder rolls outward. The target plants their feet and weathers the blast.'],
  },
  'Conjure Volley': {
    fail: ['Hundreds of phantom arrows rain from the sky, turning the ground into a pincushion of spectral shafts.'],
    save: ['A hail of arrows falls from above — the target shields themselves, but several find their mark.'],
  },
  'Blade Barrier': {
    fail: ['A wall of whirling, razor-sharp blades materializes — the target stumbles into the storm of cutting edges.'],
    save: ['Spinning blades fill the air. The target navigates carefully, but the blades still draw blood.'],
  },
  'Harm': {
    fail: ['A wave of virulent energy crashes into the target — their body convulses as the spell ravages them from within.'],
    save: ['Malignant energy assaults the target, but their constitution holds against the worst of it.'],
  },
  'Guardian of Faith': {
    auto: ['A spectral guardian materializes, its weapon already swinging — it strikes the trespasser without hesitation.'],
  },
  'Fire Storm': {
    fail: ['Pillars of flame erupt from the ground in a cataclysmic inferno — the target is engulfed completely.'],
    save: ['Fire erupts all around in a devastating storm. The target dives behind cover, singed but alive.'],
  },
  'Finger of Death': {
    fail: ['A beam of sickly green energy lances from a pointed finger — the target\'s body begins to wither, life draining visibly.'],
    save: ['Necrotic energy floods toward the target, but their will to live burns strong enough to resist annihilation.'],
  },
  'Prismatic Spray': {
    fail: ['Seven colors erupt in a dazzling fan of light — the target is struck by a random beam of devastating energy.'],
    save: ['A prismatic barrage washes over the target in a kaleidoscope of deadly light. They shield their eyes and endure.'],
  },
  'Incendiary Cloud': {
    fail: ['A roiling cloud of fire and smoke descends — the target is engulfed, flames licking at them from every direction.'],
    save: ['The burning cloud sweeps over the target. They drop low, choking on smoke but avoiding the worst of the flames.'],
  },
  'Meteor Swarm': {
    fail: ['Four blazing orbs streak from the heavens and detonate in apocalyptic fireballs — the devastation is total.'],
    save: ['Meteors crash down in pillars of flame. The target throws themselves flat, but the inferno still reaches them.'],
  },
  'Power Word Kill': {
    auto: ['A single word of absolute power is spoken. The target simply... dies. No save. No resistance. Just silence.'],
  },
  'Storm of Vengeance': {
    fail: ['The sky tears open — lightning, hail, and acidic rain hammer down in a divine tempest of wrath.'],
    save: ['The storm of vengeance rages overhead. The target finds scant shelter, battered but not broken.'],
  },

  // ── Healing ──
  'Cure Wounds': {
    heal: ['Warm golden light flows from the caster\'s hands, knitting torn flesh and mending cracked bone.'],
  },
  'Healing Word': {
    heal: ['A whispered word of power carries across the battlefield — wounds close and pain fades at its sound.'],
  },
  'Mass Healing Word': {
    heal: ['A resonant word of restoration echoes across the field — allies feel their wounds begin to close.'],
  },
  'Mass Cure Wounds': {
    heal: ['A wave of restorative energy pulses outward, washing over the wounded and easing their suffering.'],
  },
  'Heal': {
    heal: ['A flood of positive energy surges into the target — wounds vanish, disease flees, vitality returns in full.'],
  },
  'Prayer of Healing': {
    heal: ['A soft prayer carries through the air like a warm breeze, and wounds begin to knit closed.'],
  },
};

// ── Melee Attack Narration ──

const MELEE_HIT: Record<string, string[]> = {
  slashing: [
    'The blade bites deep, carving a vicious wound.',
    'Steel sings through the air and finds flesh.',
    'A clean strike opens a gash, blood welling immediately.',
    'The edge catches flesh, leaving a crimson line in its wake.',
  ],
  piercing: [
    'The point drives home with lethal precision.',
    'A thrust finds the gap between defenses.',
    'The weapon punches through with a wet crunch.',
    'A precise strike slips past the guard.',
  ],
  bludgeoning: [
    'The blow lands with a sickening crunch of bone.',
    'A bone-jarring impact staggers the target.',
    'The strike connects solidly — something cracks.',
    'A heavy blow sends the target reeling.',
  ],
  necrotic: [
    'Dark energy crackles through the strike, withering flesh on contact.',
    'The wound blackens and spreads as life itself drains away.',
    'Shadows bleed from the point of impact, consuming vitality.',
  ],
  radiant: [
    'Holy light erupts from the strike, searing unholy flesh.',
    'The blow blazes with divine radiance, leaving a glowing wound.',
    'Radiant energy detonates on impact in a flash of gold.',
  ],
  fire: [
    'Flames lick along the wound, cauterizing as they burn.',
    'The strike leaves scorched, smoking flesh in its wake.',
    'Fire blooms from the impact, blistering everything it touches.',
  ],
  cold: [
    'Ice spreads from the wound, frost crackling across the target\'s skin.',
    'A freezing chill follows the strike, numbing flesh to the bone.',
  ],
  lightning: [
    'Electricity arcs from the blow, the target convulsing from the shock.',
    'Sparks fly as the strike carries a jolt that locks muscles and singes hair.',
  ],
  poison: [
    'A sickly sheen coats the wound — the poison works fast.',
    'Venom seeps into the wound, the target\'s face going pale.',
  ],
  psychic: [
    'The strike carries a psychic echo that reverberates through the target\'s mind.',
    'Pain blooms not just in the body, but behind the eyes — a mind-rending aftershock.',
  ],
  default: [
    'The attack strikes true with punishing force.',
    'A solid hit finds its mark — the target staggers.',
    'The blow connects with devastating precision.',
  ],
};

const MELEE_MISS = [
  'The strike goes wide — the target narrowly evades.',
  'A near miss. Steel whistles past, finding only air.',
  'The attack glances off harmlessly.',
  'The target twists away at the last instant.',
  'A swing that finds nothing but empty space.',
  'The blow is deflected, sparks flying from the parry.',
];

// ── Slap (Naelia) ──

const SLAP_HIT = [
  'Naelia\'s hand descends with the weight of divine judgment — necrotic energy crackles through the creature.',
  'A casual, almost bored backhand. The creature\'s flesh blackens where divinity touches mortality.',
  'Naelia barely glances at the creature as her palm connects. The air itself recoils.',
  'With contemptuous grace, Naelia delivers a slap that echoes across planes of existence.',
  'The goddess\'s hand moves faster than thought. Where it lands, life unravels.',
];

const SLAP_KILL = [
  'The creature\'s eyes go wide — then dark. It crumples like a puppet with severed strings.',
  'A shudder passes through the creature as the last spark of life is extinguished. It falls, utterly still.',
  'The necrotic energy devours what remains. The creature simply... ceases.',
  'One moment it stood. The next, it is nothing. The goddess has spoken.',
];

const SLAP_SURVIVE = [
  'Impossibly, the creature still draws breath — though every fiber of its being screams to stop.',
  'The creature staggers but holds. A stubborn will clings to the mortal coil against all reason.',
  'Against all odds, the creature endures the touch of a god. It will not do so twice.',
];

// ── Public API ──

export function narrateAttack(attackName: string, hit: boolean, damage: number, damageType: string, roll: number, ac: number): string {
  if (attackName === 'Slap' && hit) {
    return `${pick(SLAP_HIT)} ${damage} necrotic. (${roll} vs AC ${ac})`;
  }
  if (!hit) {
    return `${pick(MELEE_MISS)} (${roll} vs AC ${ac})`;
  }
  const pool = MELEE_HIT[damageType] ?? MELEE_HIT['default'];
  return `${pick(pool)} ${damage} ${damageType}. (${roll} vs AC ${ac})`;
}

export function narrateSlapSave(saved: boolean, saveTotal: number): string {
  if (!saved) {
    return ` ${pick(SLAP_KILL)} (CON save ${saveTotal} vs DC 64)`;
  }
  return ` ${pick(SLAP_SURVIVE)} (CON save ${saveTotal} vs DC 64)`;
}

export function narrateSpellSave(spellName: string, saved: boolean, damage: number, damageType: string, saveRoll: number, dc: number): string {
  const entry = SPELL_NARRATION[spellName];
  const mechanic = `(save ${saveRoll} vs DC ${dc})`;

  if (entry) {
    if (saved && entry.save) {
      return `${pick(entry.save)}${damage > 0 ? ` ${damage} ${damageType}.` : ''} ${mechanic}`;
    }
    if (!saved && entry.fail) {
      return `${pick(entry.fail)} ${damage} ${damageType}. ${mechanic}`;
    }
  }

  // Fallback
  return saved
    ? `${spellName} crashes against the target's will — they resist the brunt of it${damage > 0 ? `, but still take ${damage} ${damageType} damage` : ''}. ${mechanic}`
    : `${spellName} tears through the target's defenses — ${damage} ${damageType}! ${mechanic}`;
}

export function narrateSpellAttack(spellName: string, hit: boolean, damage: number, damageType: string, attackRoll: number, ac: number): string {
  const entry = SPELL_NARRATION[spellName];
  const mechanic = `(${attackRoll} vs AC ${ac})`;

  if (entry) {
    if (hit && entry.hit) {
      return `${pick(entry.hit)} ${damage} ${damageType}. ${mechanic}`;
    }
    if (!hit && entry.miss) {
      return `${pick(entry.miss)} ${mechanic}`;
    }
  }

  // Fallback
  return hit
    ? `${spellName} arcs through the air and strikes true — ${damage} ${damageType}! ${mechanic}`
    : `${spellName} hurtles toward the target but goes wide. ${mechanic}`;
}

export function narrateSpellAutoHit(spellName: string, damage: number, damageType: string): string {
  const entry = SPELL_NARRATION[spellName];
  if (entry?.auto) {
    return `${pick(entry.auto)} ${damage} ${damageType}.`;
  }
  return `${spellName} strikes unerringly — ${damage} ${damageType}, impossible to evade.`;
}

export function narrateHealing(spellName: string, amount: number): string {
  const entry = SPELL_NARRATION[spellName];
  if (entry?.heal) {
    return `${pick(entry.heal)} ${amount} hit points restored.`;
  }
  return `Warm light flows from ${spellName.toLowerCase()}, mending wounds — ${amount} hit points restored.`;
}

export function narrateBuff(spellName: string): string {
  const entry = SPELL_NARRATION[spellName];
  if (entry?.buff) {
    return pick(entry.buff);
  }
  return `The air shimmers as ${spellName.toLowerCase()} weaves into reality.`;
}

export function narrateOpportunityAttack(attackName: string, hit: boolean, damage: number): string {
  if (hit) {
    return `Seizing the opening — a vicious ${attackName.toLowerCase()} catches them off-guard. ${damage} damage!`;
  }
  return 'A retaliatory swing lashes out as they flee, but the blow goes wide.';
}

export function narrateUnarmedStrike(hit: boolean, damage: number, roll: number, ac: number): string {
  if (hit) {
    return `A bare-fisted blow lands solidly — ${damage} bludgeoning. (${roll} vs AC ${ac})`;
  }
  return `A desperate swing of the fist finds nothing but air. (${roll} vs AC ${ac})`;
}

export function narrateFeatureHealing(featureName: string, amount: number): string {
  return `${featureName} surges with restorative power — ${amount} hit points of damage fade away.`;
}
