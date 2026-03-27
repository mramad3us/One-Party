/**
 * Centralized Feature Registry — SINGLE SOURCE OF TRUTH
 *
 * Every per-feature property lives here. When adding a new CellFeature:
 *   1. Add the string literal to the CellFeature union in src/types/grid.ts
 *   2. Add ONE entry to FEATURES below — everything else derives from it.
 */

import type { CellFeature } from '@/types/grid';

type RGB = [number, number, number];

export interface FeatureDefinition {
  /** Short display name (e.g. "a wooden table", "a stone pillar") */
  label: string;
  /** Blocks movement (movementCost = Infinity) */
  blocks: boolean;
  /** Blocks line of sight */
  blocksLoS: boolean;
  /** Light emission radius in grid cells (1 cell = 5ft). 0 = no light. */
  lightRadius: number;
  /** Light glow color RGB (only meaningful if lightRadius > 0) */
  glowColor?: RGB;
  /** ASCII tileset rendering */
  ascii: { ch: string; fg: string; bg: string };
  /** Fantasy tileset colors */
  colors: { primary: RGB; secondary: RGB; bg: RGB };
  /** Exploration discovery flavor text (1-2 lines) */
  narratives: string[];
}

export const FEATURES: Record<CellFeature, FeatureDefinition> = {
  door: {
    label: 'a door',
    blocks: false,
    blocksLoS: false,
    lightRadius: 0,
    ascii: { ch: '+', fg: '#ffaa00', bg: '#332200' },
    colors: { primary: [200, 140, 40], secondary: [160, 110, 30], bg: [80, 55, 20] },
    narratives: [
      'A heavy wooden door stands here, its iron handle worn smooth by countless hands.',
      'You notice a door set into the wall. It looks like it could be opened.',
    ],
  },
  door_locked: {
    label: 'a locked door',
    blocks: true,
    blocksLoS: true,
    lightRadius: 0,
    ascii: { ch: '+', fg: '#ff4444', bg: '#330000' },
    colors: { primary: [200, 50, 50], secondary: [160, 40, 40], bg: [80, 20, 20] },
    narratives: [
      'A sturdy door bars the way. The lock gleams — it won\'t yield without a key or clever fingers.',
      'An iron-banded door stands sealed. You\'ll need to find a way to open it.',
    ],
  },
  trap: {
    label: 'a trap',
    blocks: false,
    blocksLoS: false,
    lightRadius: 0,
    ascii: { ch: '^', fg: '#ff2222', bg: '#220000' },
    colors: { primary: [220, 40, 40], secondary: [180, 30, 30], bg: [60, 15, 15] },
    narratives: [
      'Your eye catches something — a thin wire stretched across the floor. A trap!',
      'A subtle discoloration in the stone betrays a pressure plate. Someone doesn\'t want you here.',
    ],
  },
  chest: {
    label: 'a chest',
    blocks: true,
    blocksLoS: false,
    lightRadius: 0,
    ascii: { ch: '*', fg: '#ffee00', bg: '#332a00' },
    colors: { primary: [240, 200, 40], secondary: [200, 160, 30], bg: [80, 65, 15] },
    narratives: [
      'A wooden chest sits in the corner, its lid firmly shut. Something glints between the slats.',
      'You spot a chest half-hidden in the shadows. Who knows what treasures it holds?',
    ],
  },
  fire: {
    label: 'a fire',
    blocks: false,
    blocksLoS: false,
    lightRadius: 5,
    glowColor: [255, 140, 30],
    ascii: { ch: '&', fg: '#ff6600', bg: '#331100' },
    colors: { primary: [255, 140, 20], secondary: [255, 80, 10], bg: [80, 30, 5] },
    narratives: [
      'Flames crackle and dance, casting long shadows across the walls. The warmth is welcome, but the fire blocks the way.',
    ],
  },
  altar: {
    label: 'an altar',
    blocks: false,
    blocksLoS: false,
    lightRadius: 0,
    ascii: { ch: '_', fg: '#cc66ff', bg: '#1a0033' },
    colors: { primary: [180, 80, 240], secondary: [140, 60, 200], bg: [50, 20, 80] },
    narratives: [
      'An ancient stone altar rises from the floor, its surface carved with worn symbols. You feel a faint thrum of old power.',
    ],
  },
  stairs_up: {
    label: 'stairs leading up',
    blocks: false,
    blocksLoS: false,
    lightRadius: 0,
    ascii: { ch: '<', fg: '#ffffff', bg: '#002244' },
    colors: { primary: [200, 210, 220], secondary: [150, 160, 170], bg: [30, 50, 80] },
    narratives: [
      'Stone steps spiral upward into darkness. Whatever lies above, it awaits your arrival.',
      'A staircase leads up, its steps worn smooth by ages of passage.',
    ],
  },
  stairs_down: {
    label: 'stairs leading down',
    blocks: false,
    blocksLoS: false,
    lightRadius: 0,
    ascii: { ch: '>', fg: '#ffffff', bg: '#002244' },
    colors: { primary: [200, 210, 220], secondary: [150, 160, 170], bg: [30, 50, 80] },
    narratives: [
      'Steps descend into deeper shadow. The air rising from below is cool and carries a faint musty scent.',
      'A stairway plunges downward. The lower depths await.',
    ],
  },
  fountain: {
    label: 'a fountain',
    blocks: true,
    blocksLoS: false,
    lightRadius: 3,
    glowColor: [100, 180, 255],
    ascii: { ch: '{', fg: '#00ccff', bg: '#001a33' },
    colors: { primary: [40, 180, 240], secondary: [30, 140, 200], bg: [15, 50, 80] },
    narratives: [
      'A stone fountain bubbles with clear water. The sound is oddly soothing in this place.',
      'Cool water wells up from a carved basin, catching the light. It looks safe to drink.',
    ],
  },
  pillar: {
    label: 'a stone pillar',
    blocks: true,
    blocksLoS: true,
    lightRadius: 0,
    ascii: { ch: 'O', fg: '#aaaaaa', bg: '#222222' },
    colors: { primary: [160, 155, 145], secondary: [130, 125, 115], bg: [70, 68, 62] },
    narratives: [
      'A thick stone pillar supports the ceiling here, carved with faded patterns.',
    ],
  },
  tree: {
    label: 'a gnarled tree',
    blocks: true,
    blocksLoS: true,
    lightRadius: 0,
    ascii: { ch: 'T', fg: '#8b5a2b', bg: '#2a1a0a' },
    colors: { primary: [50, 120, 40], secondary: [100, 70, 30], bg: [20, 45, 15] },
    narratives: [
      'A gnarled tree spreads its branches overhead, roots gripping the earth like claws.',
      'An ancient tree stands here, its bark scarred by wind and time.',
    ],
  },
  rock: {
    label: 'a large rock',
    blocks: true,
    blocksLoS: true,
    lightRadius: 0,
    ascii: { ch: '.', fg: '#888888', bg: '#333333' },
    colors: { primary: [120, 115, 108], secondary: [95, 90, 82], bg: [55, 52, 48] },
    narratives: [
      'A weathered boulder juts from the ground, its surface pocked and cracked.',
      'A large stone rests here, half-buried and stubborn as the mountains that spawned it.',
    ],
  },
  running_water: {
    label: 'flowing water',
    blocks: false,
    blocksLoS: false,
    lightRadius: 0,
    ascii: { ch: '~', fg: '#4ac4ff', bg: '#0a2a4a' },
    colors: { primary: [60, 180, 255], secondary: [30, 140, 220], bg: [10, 40, 70] },
    narratives: [
      'A stream flows here, swift and clear over smooth stones. The water looks safe to drink.',
      'Running water courses along a natural channel, glinting in the light. You could refill your waterskin here.',
    ],
  },
  torch_wall: {
    label: 'a wall torch',
    blocks: false,
    blocksLoS: false,
    lightRadius: 5,
    glowColor: [255, 160, 40],
    ascii: { ch: '!', fg: '#ffaa33', bg: '#331a00' },
    colors: { primary: [255, 170, 50], secondary: [200, 120, 30], bg: [80, 40, 10] },
    narratives: [
      'A torch burns in an iron sconce on the wall, casting flickering shadows across the stone.',
      'Firelight dances from a wall-mounted torch, its flame guttering in an unseen draft.',
    ],
  },
  torch_wall_spent: {
    label: 'a spent torch',
    blocks: false,
    blocksLoS: false,
    lightRadius: 0,
    ascii: { ch: '!', fg: '#555544', bg: '#1a1a14' },
    colors: { primary: [85, 80, 65], secondary: [60, 55, 45], bg: [30, 28, 22] },
    narratives: [
      'An empty iron sconce juts from the wall, its torch long since burned to ash. Soot stains the stone above it like a black tongue.',
      'A spent torch hangs limp in its bracket, nothing but a charred stub. This place has been dark a long time.',
      'The remains of a wall torch — a blackened stick in a rusted sconce. Whoever lit it last never came back.',
    ],
  },
  brazier: {
    label: 'a brazier',
    blocks: false,
    blocksLoS: false,
    lightRadius: 6,
    glowColor: [255, 120, 20],
    ascii: { ch: '0', fg: '#ff6600', bg: '#331100' },
    colors: { primary: [255, 120, 20], secondary: [220, 80, 10], bg: [80, 30, 5] },
    narratives: [
      'A large brazier crackles with burning coals, its warmth radiating outward in waves. The fire pit lights the chamber with a deep orange glow.',
      'An iron brazier stands here, its bed of embers painting the surrounding stone in shades of amber and crimson.',
    ],
  },
  table: {
    label: 'a wooden table',
    blocks: false,
    blocksLoS: false,
    lightRadius: 0,
    ascii: { ch: 'T', fg: '#aa7733', bg: '#2a1a0a' },
    colors: { primary: [160, 110, 50], secondary: [130, 85, 35], bg: [90, 60, 25] },
    narratives: [
      'A sturdy wooden table stands here, its surface scarred by years of use.',
      'A well-crafted table occupies this space, its planks worn smooth by countless meals and meetings.',
    ],
  },
  chair: {
    label: 'a chair',
    blocks: false,
    blocksLoS: false,
    lightRadius: 0,
    ascii: { ch: 'h', fg: '#885522', bg: '#1a0f00' },
    colors: { primary: [120, 80, 35], secondary: [95, 62, 28], bg: [65, 42, 18] },
    narratives: [
      'A simple wooden chair sits here, waiting for someone to rest their weary bones.',
    ],
  },
  bed: {
    label: 'a bed',
    blocks: true,
    blocksLoS: false,
    lightRadius: 0,
    ascii: { ch: 'B', fg: '#ddccaa', bg: '#2a1a0a' },
    colors: { primary: [230, 220, 200], secondary: [130, 85, 40], bg: [80, 55, 25] },
    narratives: [
      'A bed with rumpled linens offers the promise of rest in this unforgiving place.',
      'A sleeping pallet lies here, its blankets still bearing the impression of whoever last sought respite.',
    ],
  },
  shelf: {
    label: 'a shelf',
    blocks: true,
    blocksLoS: true,
    lightRadius: 0,
    ascii: { ch: '#', fg: '#996633', bg: '#1a0f00' },
    colors: { primary: [140, 95, 42], secondary: [110, 72, 32], bg: [75, 50, 22] },
    narratives: [
      'A tall wooden shelf looms here, its boards sagging under the weight of accumulated goods.',
      'Shelves line the wall, cluttered with dusty odds and ends.',
    ],
  },
  counter: {
    label: 'a counter',
    blocks: true,
    blocksLoS: true,
    lightRadius: 0,
    ascii: { ch: '=', fg: '#bb8844', bg: '#2a1a0a' },
    colors: { primary: [170, 120, 55], secondary: [140, 95, 40], bg: [95, 65, 28] },
    narratives: [
      'A polished wooden counter stretches across the space, its surface worn by years of commerce.',
    ],
  },
  anvil: {
    label: 'an anvil',
    blocks: true,
    blocksLoS: false,
    lightRadius: 0,
    ascii: { ch: 'A', fg: '#888899', bg: '#1a1a22' },
    colors: { primary: [90, 90, 95], secondary: [60, 60, 65], bg: [35, 35, 40] },
    narratives: [
      'A heavy iron anvil squats on a thick stump, its face pitted from a thousand hammer blows.',
      'An anvil stands here, dark and massive. The ring of steel on iron still seems to hang in the air.',
    ],
  },
  barrel: {
    label: 'a barrel',
    blocks: true,
    blocksLoS: true,
    lightRadius: 0,
    ascii: { ch: 'o', fg: '#996633', bg: '#1a0f00' },
    colors: { primary: [145, 95, 38], secondary: [110, 70, 28], bg: [75, 48, 18] },
    narratives: [
      'A stout wooden barrel stands here, its staves bound with iron bands.',
      'A barrel rests against the wall. Something sloshes faintly within.',
    ],
  },
  crate: {
    label: 'a crate',
    blocks: true,
    blocksLoS: true,
    lightRadius: 0,
    ascii: { ch: 'c', fg: '#bb9955', bg: '#2a1a0a' },
    colors: { primary: [175, 135, 70], secondary: [140, 105, 50], bg: [95, 72, 32] },
    narratives: [
      'A wooden crate sits here, its planks nailed shut. Whatever is inside was meant to stay there.',
      'A sturdy shipping crate occupies this corner, its contents a mystery.',
    ],
  },
  bookshelf: {
    label: 'a bookshelf',
    blocks: true,
    blocksLoS: true,
    lightRadius: 0,
    ascii: { ch: '#', fg: '#886633', bg: '#1a0f00' },
    colors: { primary: [130, 85, 38], secondary: [100, 65, 28], bg: [68, 44, 18] },
    narratives: [
      'A towering bookshelf reaches toward the ceiling, its shelves crammed with leather-bound volumes.',
      'Books of every size and color crowd these shelves. The scent of old parchment fills the air.',
    ],
  },
  rug: {
    label: 'a decorative rug',
    blocks: false,
    blocksLoS: false,
    lightRadius: 0,
    ascii: { ch: '~', fg: '#cc3333', bg: '#330a0a' },
    colors: { primary: [165, 40, 40], secondary: [200, 165, 50], bg: [120, 28, 28] },
    narratives: [
      'A richly woven rug covers the floor, its patterns faded but still beautiful.',
      'A decorative rug lies underfoot, its crimson and gold threads speaking of distant lands.',
    ],
  },
  banner: {
    label: 'a hanging banner',
    blocks: false,
    blocksLoS: false,
    lightRadius: 0,
    ascii: { ch: '|', fg: '#cc2222', bg: '#330000' },
    colors: { primary: [180, 35, 35], secondary: [210, 180, 50], bg: [130, 25, 25] },
    narratives: [
      'A fabric banner hangs from the wall, its colors faded but its heraldry still legible.',
      'A tattered banner sways in a draft you cannot feel, bearing symbols of an age gone by.',
    ],
  },
  well: {
    label: 'a stone well',
    blocks: true,
    blocksLoS: false,
    lightRadius: 0,
    ascii: { ch: 'O', fg: '#8888aa', bg: '#1a1a22' },
    colors: { primary: [130, 130, 135], secondary: [50, 120, 190], bg: [85, 85, 90] },
    narratives: [
      'A stone well rises from the ground, its rope and bucket still intact. Dark water gleams far below.',
      'You peer into a deep well. The water at the bottom reflects a perfect circle of light.',
    ],
  },
  market_stall: {
    label: 'a market stall',
    blocks: true,
    blocksLoS: true,
    lightRadius: 0,
    ascii: { ch: 'M', fg: '#996633', bg: '#2a1a0a' },
    colors: { primary: [145, 100, 45], secondary: [180, 50, 50], bg: [95, 65, 28] },
    narratives: [
      'A vendor\'s stall stands here, its colorful awning shading a counter of wares.',
      'A market stall displays its goods beneath a bright canopy, awaiting customers.',
    ],
  },
  sign: {
    label: 'a signpost',
    blocks: false,
    blocksLoS: false,
    lightRadius: 0,
    ascii: { ch: '!', fg: '#aa7733', bg: '#1a0f00' },
    colors: { primary: [140, 95, 42], secondary: [220, 215, 200], bg: [90, 60, 25] },
    narratives: [
      'A wooden signpost juts from the ground, its painted letters pointing the way.',
      'A weathered sign hangs here, its message still readable despite the elements.',
    ],
  },
  candle: {
    label: 'a candle',
    blocks: false,
    blocksLoS: false,
    lightRadius: 2,
    glowColor: [255, 160, 40],
    ascii: { ch: 'i', fg: '#ffdd33', bg: '#332a00' },
    colors: { primary: [255, 220, 60], secondary: [140, 95, 42], bg: [80, 55, 22] },
    narratives: [
      'A lone candle flickers in a holder, its small flame casting a warm circle of light.',
      'A candle gutters here, its wax pooling in a brass dish. The flame dances with each breath of air.',
    ],
  },
  chandelier: {
    label: 'a chandelier',
    blocks: false,
    blocksLoS: false,
    lightRadius: 5,
    glowColor: [255, 160, 40],
    ascii: { ch: 'Y', fg: '#ccaa33', bg: '#332a00' },
    colors: { primary: [200, 170, 60], secondary: [255, 220, 80], bg: [140, 115, 40] },
    narratives: [
      'An ornate chandelier hangs overhead, its many candles bathing the room in warm, golden light.',
      'A brass chandelier sways gently above, its flames casting shifting shadows across the walls.',
    ],
  },
  weapon_rack: {
    label: 'a weapon rack',
    blocks: true,
    blocksLoS: true,
    lightRadius: 0,
    ascii: { ch: '/', fg: '#aaaabb', bg: '#1a1a22' },
    colors: { primary: [100, 65, 30], secondary: [170, 170, 180], bg: [65, 42, 18] },
    narratives: [
      'A wooden rack displays an array of weapons — blades, hafts, and points gleaming in the dim light.',
      'Weapons of various make hang from a sturdy rack, ready to be claimed by willing hands.',
    ],
  },
  hearth: {
    label: 'a hearth',
    blocks: true,
    blocksLoS: false,
    lightRadius: 4,
    glowColor: [255, 160, 40],
    ascii: { ch: '&', fg: '#ff8822', bg: '#331100' },
    colors: { primary: [255, 150, 30], secondary: [130, 130, 135], bg: [80, 30, 5] },
    narratives: [
      'A stone hearth crackles with a welcoming fire, its warmth seeping into your bones.',
      'A fireplace dominates the wall, its flames licking at blackened stones. The scent of woodsmoke fills the air.',
    ],
  },
  bench: {
    label: 'a wooden bench',
    blocks: false,
    blocksLoS: false,
    lightRadius: 0,
    ascii: { ch: '=', fg: '#996633', bg: '#1a0f00' },
    colors: { primary: [150, 100, 50], secondary: [120, 78, 35], bg: [80, 52, 22] },
    narratives: [
      'A simple wooden bench offers a place to sit and rest weary legs.',
      'A sturdy bench lines the wall, its planks worn smooth by years of use.',
    ],
  },
  wardrobe: {
    label: 'a wardrobe',
    blocks: true,
    blocksLoS: true,
    lightRadius: 0,
    ascii: { ch: 'W', fg: '#8a6030', bg: '#1a0f00' },
    colors: { primary: [120, 78, 38], secondary: [95, 60, 28], bg: [62, 40, 18] },
    narratives: [
      'A tall wooden wardrobe stands against the wall, its doors slightly ajar. Moth-eaten fabric peeks from within.',
      'An imposing wardrobe of dark wood dominates the corner, its brass handles tarnished with age.',
    ],
  },
  cabinet: {
    label: 'a cabinet',
    blocks: true,
    blocksLoS: true,
    lightRadius: 0,
    ascii: { ch: '#', fg: '#7a5528', bg: '#1a0f00' },
    colors: { primary: [110, 72, 32], secondary: [85, 55, 24], bg: [58, 36, 14] },
    narratives: [
      'A sturdy cabinet stands here, its glass-paned doors revealing rows of jars and bottles.',
      'A wooden cabinet with iron hinges. Whatever it once held, the shelves inside are half-empty now.',
    ],
  },
  mirror: {
    label: 'a mirror',
    blocks: false,
    blocksLoS: false,
    lightRadius: 0,
    ascii: { ch: '|', fg: '#ccddee', bg: '#1a1a22' },
    colors: { primary: [200, 210, 225], secondary: [170, 180, 195], bg: [50, 55, 65] },
    narratives: [
      'A tall mirror in an ornate frame reflects the room — and you, travel-worn and weary.',
      'An old mirror hangs on the wall. Your reflection stares back through a patina of dust and age.',
    ],
  },
  painting: {
    label: 'a painting',
    blocks: false,
    blocksLoS: false,
    lightRadius: 0,
    ascii: { ch: '=', fg: '#cc8844', bg: '#2a1a0a' },
    colors: { primary: [180, 120, 50], secondary: [140, 90, 35], bg: [95, 62, 24] },
    narratives: [
      'A framed painting hangs here, its oils cracked with age. The subject\'s eyes seem to follow you.',
      'A canvas in a gilded frame depicts a landscape that no longer exists — or perhaps never did.',
    ],
  },
  tapestry: {
    label: 'a tapestry',
    blocks: false,
    blocksLoS: false,
    lightRadius: 0,
    ascii: { ch: '|', fg: '#994433', bg: '#1a0a05' },
    colors: { primary: [150, 55, 40], secondary: [200, 170, 50], bg: [100, 35, 25] },
    narratives: [
      'A woven tapestry covers the wall, depicting a battle scene in faded threads of crimson and gold.',
      'Threadbare but magnificent, a tapestry tells stories in silk and wool that words cannot capture.',
    ],
  },
  cauldron: {
    label: 'a cauldron',
    blocks: true,
    blocksLoS: false,
    lightRadius: 0,
    ascii: { ch: 'U', fg: '#444444', bg: '#1a1a1a' },
    colors: { primary: [60, 58, 55], secondary: [40, 38, 35], bg: [28, 26, 24] },
    narratives: [
      'A massive iron cauldron sits over dead coals, its interior stained and crusted from unknown brews.',
      'A three-legged cauldron squats in the corner. The smell lingering about it is... complex.',
    ],
  },
  hay_pile: {
    label: 'a pile of hay',
    blocks: false,
    blocksLoS: false,
    lightRadius: 0,
    ascii: { ch: '#', fg: '#ccaa44', bg: '#332a00' },
    colors: { primary: [200, 175, 60], secondary: [170, 145, 45], bg: [120, 100, 30] },
    narratives: [
      'A mound of dry hay spills across the floor, golden and fragrant. It would make a passable bed in a pinch.',
      'Hay is piled here, probably for animals. Or perhaps for someone with no better option.',
    ],
  },
  tombstone: {
    label: 'a tombstone',
    blocks: true,
    blocksLoS: false,
    lightRadius: 0,
    ascii: { ch: '+', fg: '#888888', bg: '#222222' },
    colors: { primary: [140, 138, 132], secondary: [110, 108, 102], bg: [65, 63, 58] },
    narratives: [
      'A weathered tombstone leans in the earth, its inscription worn to ghost letters by rain and time.',
      'A stone grave marker stands here, moss creeping over the name of someone long forgotten.',
    ],
  },
  statue: {
    label: 'a statue',
    blocks: true,
    blocksLoS: true,
    lightRadius: 0,
    ascii: { ch: '&', fg: '#aaaaaa', bg: '#222222' },
    colors: { primary: [165, 162, 155], secondary: [135, 132, 125], bg: [75, 72, 68] },
    narratives: [
      'A stone statue gazes down from its plinth with blank, ancient eyes. Time has stolen its features but not its authority.',
      'A carved figure stands here in silent vigil, its pose heroic, its identity lost to the ages.',
    ],
  },
  planter: {
    label: 'a stone planter',
    blocks: true,
    blocksLoS: false,
    lightRadius: 0,
    ascii: { ch: '%', fg: '#448833', bg: '#1a2a0a' },
    colors: { primary: [60, 130, 45], secondary: [140, 135, 125], bg: [35, 80, 25] },
    narratives: [
      'A stone planter overflows with herbs and wildflowers, filling the air with their mingled scent.',
      'Green things grow in a carved stone basin — someone tends this place still.',
    ],
  },
  ladder: {
    label: 'a ladder',
    blocks: false,
    blocksLoS: false,
    lightRadius: 0,
    ascii: { ch: 'H', fg: '#aa8844', bg: '#1a0f00' },
    colors: { primary: [155, 115, 55], secondary: [125, 88, 40], bg: [85, 60, 25] },
    narratives: [
      'A wooden ladder leans against the wall, its rungs worn thin by boots and gloves.',
      'A simple ladder leads upward into shadow.',
    ],
  },
  curtain: {
    label: 'a curtain',
    blocks: false,
    blocksLoS: true,
    lightRadius: 0,
    ascii: { ch: '|', fg: '#774422', bg: '#1a0f00' },
    colors: { primary: [120, 55, 30], secondary: [95, 42, 22], bg: [65, 28, 12] },
    narratives: [
      'A heavy curtain of dark fabric hangs from an iron rod, dividing the space beyond from view.',
      'Thick drapes block the passage. Whatever lies behind them is hidden from sight.',
    ],
  },
  fence: {
    label: 'a wooden fence',
    blocks: true,
    blocksLoS: false,
    lightRadius: 0,
    ascii: { ch: '#', fg: '#886633', bg: '#1a0f00' },
    colors: { primary: [130, 90, 40], secondary: [105, 72, 30], bg: [72, 48, 18] },
    narratives: [
      'A simple wooden fence marks the boundary. It wouldn\'t stop a determined soul, but it makes the point.',
      'Weather-beaten fence posts stand in a line, their rails silvered by sun and rain.',
    ],
  },
  woodpile: {
    label: 'a woodpile',
    blocks: true,
    blocksLoS: true,
    lightRadius: 0,
    ascii: { ch: '=', fg: '#8a6633', bg: '#1a0f00' },
    colors: { primary: [125, 85, 38], secondary: [100, 68, 28], bg: [68, 44, 16] },
    narratives: [
      'A neatly stacked woodpile stands here, its split logs ready for the fire.',
      'Firewood is piled high against the wall — proof that someone expects to weather a long winter.',
    ],
  },
  cart: {
    label: 'a cart',
    blocks: true,
    blocksLoS: false,
    lightRadius: 0,
    ascii: { ch: 'C', fg: '#996633', bg: '#1a0f00' },
    colors: { primary: [140, 95, 42], secondary: [110, 75, 32], bg: [75, 50, 20] },
    narratives: [
      'A wooden handcart sits here, its bed empty save for straw and road dust.',
      'A two-wheeled cart rests on its shafts. It has seen many miles and carried many loads.',
    ],
  },
  sack: {
    label: 'a sack',
    blocks: false,
    blocksLoS: false,
    lightRadius: 0,
    ascii: { ch: 's', fg: '#aa9966', bg: '#2a1a0a' },
    colors: { primary: [165, 145, 95], secondary: [135, 118, 75], bg: [95, 82, 50] },
    narratives: [
      'A burlap sack slumps against the wall, its contents shifting with a dry rustle.',
      'A tied sack sits here. Grain, perhaps, or root vegetables — the staples of common life.',
    ],
  },
  cage: {
    label: 'an iron cage',
    blocks: true,
    blocksLoS: false,
    lightRadius: 0,
    ascii: { ch: '#', fg: '#777788', bg: '#1a1a22' },
    colors: { primary: [100, 100, 110], secondary: [75, 75, 85], bg: [42, 42, 50] },
    narratives: [
      'An iron cage stands here, its bars cold and unyielding. Whatever it held is long gone.',
      'A heavy cage of black iron occupies the space. Scratches on the bars tell a story you\'d rather not hear.',
    ],
  },
  throne: {
    label: 'a throne',
    blocks: true,
    blocksLoS: false,
    lightRadius: 0,
    ascii: { ch: 'T', fg: '#ddaa33', bg: '#332a00' },
    colors: { primary: [200, 160, 40], secondary: [160, 50, 45], bg: [120, 95, 25] },
    narratives: [
      'A magnificent throne of carved stone and gilded wood commands the room. Its seat is cold and empty.',
      'An ornate throne rises on a stepped dais, its armrests carved with the figures of snarling beasts.',
    ],
  },
};

// ── Derived Lookups (backwards compatibility / performance) ────

/** Physical properties for features — used by featureCell() and map generators */
export const FEATURE_PHYSICS: Partial<Record<CellFeature, { blocks: boolean; blocksLoS: boolean }>> = Object.fromEntries(
  (Object.entries(FEATURES) as [CellFeature, FeatureDefinition][])
    .filter(([, def]) => def.blocks || def.blocksLoS)
    .map(([feat, def]) => [feat, { blocks: def.blocks, blocksLoS: def.blocksLoS }]),
) as Partial<Record<CellFeature, { blocks: boolean; blocksLoS: boolean }>>;

/** Features that emit light and their radius in grid cells (1 cell = 5ft) */
export const LIGHT_SOURCE_RADIUS: Partial<Record<CellFeature, number>> = Object.fromEntries(
  (Object.entries(FEATURES) as [CellFeature, FeatureDefinition][])
    .filter(([, def]) => def.lightRadius > 0)
    .map(([feat, def]) => [feat, def.lightRadius]),
) as Partial<Record<CellFeature, number>>;

/** ASCII tileset glyphs derived from registry */
export const FEATURE_GLYPHS: Record<CellFeature, { ch: string; fg: string; bg: string }> = Object.fromEntries(
  (Object.entries(FEATURES) as [CellFeature, FeatureDefinition][])
    .map(([feat, def]) => [feat, def.ascii]),
) as Record<CellFeature, { ch: string; fg: string; bg: string }>;

/** Fantasy tileset colors derived from registry */
export const FEATURE_COLORS: Record<CellFeature, { primary: RGB; secondary: RGB; bg: RGB }> = Object.fromEntries(
  (Object.entries(FEATURES) as [CellFeature, FeatureDefinition][])
    .map(([feat, def]) => [feat, def.colors]),
) as Record<CellFeature, { primary: RGB; secondary: RGB; bg: RGB }>;

/** Exploration discovery narratives derived from registry */
export const FEATURE_NARRATIVES: Record<CellFeature, string[]> = Object.fromEntries(
  (Object.entries(FEATURES) as [CellFeature, FeatureDefinition][])
    .map(([feat, def]) => [feat, def.narratives]),
) as Record<CellFeature, string[]>;

/** Glow colors for light-emitting features (used by GridRenderer) */
export const FEATURE_GLOW_COLORS: Partial<Record<CellFeature, RGB>> = Object.fromEntries(
  (Object.entries(FEATURES) as [CellFeature, FeatureDefinition][])
    .filter(([, def]) => def.glowColor !== undefined)
    .map(([feat, def]) => [feat, def.glowColor!]),
) as Partial<Record<CellFeature, RGB>>;
