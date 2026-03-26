import './styles/main.css';

import type { AbilityScores, Character, Entity, Skill } from '@/types';
import { GameEngine } from '@/engine/GameEngine';
import { GameState } from '@/state/GameState';
import { IconSystem } from '@/ui/IconSystem';
import { TooltipSystem } from '@/ui/TooltipSystem';
import { UIManager } from '@/ui/UIManager';
import { MenuScreen } from '@/ui/screens/MenuScreen';
import { CreationScreen } from '@/ui/screens/CreationScreen';
import { GameScreen } from '@/ui/screens/GameScreen';
import { InventoryScreen } from '@/ui/screens/InventoryScreen';
import { CharacterScreen } from '@/ui/screens/CharacterScreen';
import { DeathScreen, type DeathScreenOptions } from '@/ui/screens/DeathScreen';
import { StorageEngine } from '@/storage/StorageEngine';
import { SaveManager } from '@/storage/SaveManager';
import { CharacterFactory } from '@/character/CharacterFactory';
import { LocalMapGenerator } from '@/world/LocalMapGenerator';
import { POIMapGenerator } from '@/world/POIMapGenerator';
import type { GridCell, GridDefinition } from '@/types/grid';
import { WorldCreationScreen } from '@/ui/screens/WorldCreationScreen';
import { WorldSelectionScreen } from '@/ui/screens/WorldSelectionScreen';
import { WorldPickerScreen } from '@/ui/screens/WorldPickerScreen';
import { WorldExporter } from '@/storage/WorldExporter';
import type { Universe } from '@/types/universe';
import { getLocationOverride } from '@/types/universe';
import { NPCFactory } from '@/npc/NPCFactory';
import {
  overworldToWorld,
  getOrCreateTileLocation,
  getTerrainName,
  getTerrainBiome,
  isTraversable,
  clearTileLocationCache,
} from '@/world/OverworldBridge';
import type { OverworldData } from '@/types/overworld';
import { SeededRNG } from '@/utils/SeededRNG';
import { isDevMode, setDevMode } from '@/utils/devmode';
import { DiceRoller } from '@/rules/DiceRoller';
import { TextNarrativeEngine } from '@/narrative/NarrativeEngine';
import { SurvivalRules } from '@/rules/SurvivalRules';
import { SurvivalNarrator } from '@/narrative/SurvivalNarrator';
import { getItem } from '@/data/items';
import { getSpell } from '@/data/spells';
import { getBonusAction } from '@/data/bonusActions';
import type { ConsumableProperties } from '@/types/item';
import { ROUNDS_PER_HOUR } from '@/types/time';
import { KeyboardInput } from '@/engine/KeyboardInput';
import { ExplorationController } from '@/engine/ExplorationController';
import { Grid } from '@/grid/Grid';
import { FogOfWar } from '@/grid/FogOfWar';
import type { KeyboardHint } from '@/ui/panels/ActionPanel';
import type { EntityRenderInfo } from '@/grid/GridRenderer';
import { TimeNarrator } from '@/narrative/TimeNarrator';
import { gameTimeToCalendar } from '@/types/time';
import type { OverworldTerrain } from '@/types/overworld';
import { Modal } from '@/ui/widgets/Modal';
import { DiceDisplay } from '@/ui/widgets/DiceDisplay';
import { el } from '@/utils/dom';
import type { Tileset } from '@/grid/Tileset';
import { getTilesetById, getAllTilesets } from '@/grid/Tileset';
import type { SaveMeta, EquipmentSlots } from '@/types';
import { EquipmentRules } from '@/rules/EquipmentRules';
import { RestRules } from '@/rules/RestRules';
import { TravelRules } from '@/rules/TravelRules';
import { ForageRules, type ForageOption, type ForagePlan } from '@/rules/ForageRules';
import { AbilityChecks } from '@/rules/AbilityChecks';
import { LevelUpRules } from '@/rules/LevelUpRules';
import { getClass } from '@/data/classes';
import { TimeActivity } from '@/ui/widgets/TimeActivity';
import { processWorldDecay, markLocationVisited } from '@/world/WorldDecay';
import type { Coordinate } from '@/types';
import { CombatManager, type CombatResult } from '@/combat/CombatManager';
import { CombatController } from '@/combat/CombatController';
import { CombatRules } from '@/rules/CombatRules';
import { ConditionRules } from '@/rules/ConditionRules';
import { TemplateRegistry } from '@/templates/TemplateRegistry';
import { Resolver } from '@/resolution/Resolver';
import { EncounterResolver } from '@/resolution/EncounterResolver';
import type { CombatantDisplay } from '@/ui/screens/CombatScreen';
import type { LocationType, LightingLevel } from '@/types/world';
import type { NPC } from '@/types/npc';
import { ShopScreen } from '@/ui/screens/ShopScreen';
import { NPCInteraction } from '@/npc/NPCInteraction';

// ── Lighting by location type ────────────────────────────────────

function getLightingForLocation(locationType: LocationType): LightingLevel {
  switch (locationType) {
    case 'dungeon':
    case 'cave':
      return 'dark';
    case 'ruins':
    case 'temple':
      return 'dim';
    default:
      return 'bright';
  }
}

// ── Level-up check helper ───────────────────────────────────────

/**
 * Check and apply pending level-ups for a character.
 * Loops to handle multi-level jumps (e.g. large XP grants).
 * Posts rich narrative text for each level gained.
 */
function checkAndApplyLevelUps(
  character: Character,
  screen: GameScreen | null,
  levelUpRules: LevelUpRules,
): void {
  const classData = getClass(character.class);
  if (!classData) return;

  while (levelUpRules.canLevelUp(character)) {
    const oldLevel = character.level;
    const result = levelUpRules.levelUp(character, classData);

    // Build an immersive level-up narrative
    const parts: string[] = [];
    parts.push(
      `A surge of power courses through ${character.name}'s veins. ` +
      `The trials endured and foes vanquished have forged something greater — ` +
      `${character.name} has reached Level ${result.newLevel}!`,
    );

    parts.push(`(+${result.hpGained} HP)`);

    if (result.featuresGained.length > 0) {
      const featureList = result.featuresGained.join(', ');
      parts.push(
        `New power awakens: ${featureList}. ` +
        `The path ahead grows clearer with each hard-won lesson.`,
      );
    }

    if (result.newSpellSlots) {
      const slotDescriptions: string[] = [];
      for (const [level, count] of Object.entries(result.newSpellSlots)) {
        slotDescriptions.push(`${count} level-${level}`);
      }
      parts.push(
        `The arcane wells deepen — spell slots: ${slotDescriptions.join(', ')}.`,
      );
    }

    // Check proficiency bonus change
    const oldProf = Math.floor((oldLevel - 1) / 4) + 2;
    if (character.proficiencyBonus > oldProf) {
      parts.push(
        `Proficiency sharpens to +${character.proficiencyBonus}, ` +
        `reflecting mastery earned through blood and sweat.`,
      );
    }

    screen?.addNarrative({
      text: parts.join(' '),
      category: 'system',
    });
  }
}

// ── Journey narrative pools ─────────────────────────────────────

const JOURNEY_NARRATIVES: Record<string, string[]> = {
  forest: [
    'The trail narrows beneath the ancient canopy, shafts of pale light filtering through leaves so dense they turn the air green. The party moves single-file, the crunch of dead leaves and snap of twigs their only companions.',
    'A cathedral of oaks stretches endlessly ahead. The forest breathes around them — the creak of boughs, the distant tap of a woodpecker, the rustle of something unseen retreating deeper into the underbrush.',
    'Moss-draped branches hang low across the path like outstretched arms. The air is thick with the sweet, loamy scent of decaying wood and wild mushrooms. The party presses on through the verdant gloom.',
    'Shafts of golden light lance through gaps in the canopy, illuminating swirling motes of pollen. Birdsong echoes from every direction, a chorus that makes the forest feel both welcoming and watchful.',
    'The undergrowth thickens, thorny brambles snagging cloaks and packs. A stream babbles somewhere nearby, its voice muffled by the dense wall of fern and hazel that crowds the barely-visible trail.',
  ],
  dense_forest: [
    'The forest here is primeval and suffocating — trunks wider than a man is tall, roots that heave the earth into treacherous ridges. Darkness pools between the trees like standing water.',
    'They push through a wall of interlocking branches that seems designed to repel intruders. Progress is measured in yards, not miles. The canopy above is so thick that day and night are nearly indistinguishable.',
    'Ancient trees loom overhead, their bark scarred and blackened with age. The silence here is oppressive — no birdsong, no wind, only the muffled thud of careful footsteps on centuries of fallen needles.',
  ],
  plains: [
    'The grassland stretches to the horizon in every direction, a sea of amber and green rolling in the wind like slow ocean waves. The sky above is vast and impossibly blue, dwarfing everything beneath it.',
    'Miles of open ground pass beneath their boots, the monotony broken only by the occasional lone tree or tumbled stone wall. Hawks circle lazily overhead, riding thermals that shimmer in the distance.',
    'The wind is constant here, carrying the sweet scent of wildflowers and the dry whisper of tall grass. The party moves at a good pace, the flat terrain easy on tired legs but offering no shelter from the elements.',
    'A herd of deer grazes in the distance, their heads snapping up at the party\'s approach before bounding away in graceful leaps. The grassland seems peaceful, but the openness leaves them feeling exposed.',
    'The trail becomes little more than a suggestion — a faint parting in the knee-high grass. Insects buzz in clouds around their ankles, and the sun beats down without mercy on the treeless expanse.',
  ],
  hills: [
    'The terrain rises and falls in endless green swells, each crest revealing another identical vista of rolling hills. Their calves burn with the constant climbing, and the wind whips harder at every summit.',
    'Stone outcroppings jut from the hillsides like broken teeth, their surfaces streaked with lichen and bird droppings. The path switchbacks relentlessly upward, loose scree skittering underfoot.',
    'From atop a windswept ridge, the party pauses to take in the view — a patchwork of green and gold stretching to distant mountains. The descent ahead looks steep, the path narrow and crumbling.',
    'Sheep dot a distant hillside like scattered cotton. A shepherd\'s whistle carries faintly on the wind. The hills here are gentler, their slopes carpeted with wildflowers and soft turf.',
  ],
  mountain: [
    'The air thins as the party climbs higher, each breath burning in their lungs. The mountain path hugs a cliff face, loose stones tumbling into the misty void below with each careless step.',
    'Jagged peaks pierce the clouds above them like the spine of some colossal beast. Snow clings to sheltered crevices even in summer, and the wind howls through narrow passes with a voice that sounds almost human.',
    'The mountain trail is barely more than a goat path — switchbacks carved into raw stone, the drop to their left growing more dizzying with each turn. Eagles soar far below them now.',
  ],
  beach: [
    'The party follows the shoreline where packed sand meets salt-bleached grass. Waves crash and hiss against the shore in an endless rhythm, leaving lace patterns of foam on the dark wet sand.',
    'Seabirds wheel and cry overhead as the party trudges along the coast. The salt wind is bracing, carrying the briny scent of kelp and the distant thunderclap of waves breaking against rocky headlands.',
    'Driftwood lies scattered along the tideline like the bones of ancient ships. The sand shifts treacherously underfoot, making every step an effort. To seaward, the horizon is a perfect knife-edge.',
  ],
  desert: [
    'The desert stretches before them in an ocean of amber and rust, the air wavering with heat mirages that conjure phantom lakes on the horizon. Each step sinks into fine, burning sand.',
    'Wind-sculpted dunes rise and fall like frozen waves, their crests streaming plumes of golden sand. The sun hammers down from a sky bleached white, and the party moves slowly, conserving every drop of water.',
    'A vast expanse of cracked earth and sparse scrub extends in all directions. Lizards dart between sun-baked stones, and the only shade comes from the occasional twisted, leafless tree.',
  ],
  swamp: [
    'The ground sucks at their boots with every step, dark water seeping into each footprint. The air reeks of rot and stagnant water, and clouds of biting insects swarm around exposed skin.',
    'Gnarled trees rise from the murk on twisted root-stilts, their branches draped in grey-green moss. The path is a series of uncertain tussocks — one wrong step and the swamp swallows a leg to the knee.',
    'Bubbles rise and pop in the brackish water, releasing puffs of foul gas. Strange lights flicker in the deeper marsh — will-o\'-wisps or something worse. The party keeps to what solid ground they can find.',
  ],
  tundra: [
    'The frozen plain stretches endlessly ahead, a white wasteland broken only by the dark slash of a frozen river. The wind cuts through every layer of clothing, and breath crystallizes instantly.',
    'Lichen-covered boulders dot the tundra like abandoned sentinels. The ground is iron-hard beneath a thin crust of snow, and the sun hangs low on the horizon, casting long blue shadows across the ice.',
  ],
  snow: [
    'They wade through knee-deep snow, each step an exhausting effort. The world is reduced to shades of white and grey, the silence broken only by the crunch of ice and the rasp of labored breathing.',
    'A bitter wind drives needles of ice into exposed skin. The snowfield is featureless and disorienting — without landmarks, only the compass keeps them on course through the frozen emptiness.',
  ],
  volcanic: [
    'The ground radiates heat through the soles of their boots. Cracks in the dark stone glow with an angry orange light, and the air tastes of sulfur and ash. Nothing grows here.',
    'Steam vents hiss from fissures in the blackened rock, wreathing the party in hot, acrid fog. The landscape is alien — twisted formations of cooled lava, pools of bubbling mud, and the distant rumble of the earth.',
  ],
  shallow_water: [
    'The party wades through shallow coastal waters, the cold sea gripping their legs. Beneath the clear surface, sand shifts and crabs scuttle away from their splashing approach.',
  ],
  peak: [
    'At this altitude the world falls away in every direction, a dizzying panorama of ridges and valleys shrouded in cloud. The air is thin and biting, each breath an act of will.',
  ],
};

const TRAVEL_FOOD_NARRATIVES: string[] = [
  'The party pauses briefly to share some {item}, eating in silence as they scan the horizon.',
  'A quick rest — hands dig into packs for {item}. Not a feast, but enough to keep legs moving.',
  'The march halts for a few minutes. {item} is passed around, eaten standing, packs still shouldered.',
  'Hunger gnaws, and the party relents. They break out {item}, chewing as they walk.',
  'Without a word, someone produces {item} from their pack. The party eats gratefully, never breaking stride.',
];

const TRAVEL_DRINK_NARRATIVES: string[] = [
  'Parched throats demand attention. The party passes around the {item}, each taking a careful sip.',
  'A halt is called — the {item} comes out, its contents rationed with practiced restraint.',
  'Dry lips and dusty tongues. Someone uncorks the {item} and the party drinks, one at a time.',
  'The {item} changes hands down the line. Water has never tasted so sweet.',
  'Thirst wins out. The party stops to drink from their {item}, wiping mouths on dusty sleeves.',
];

const WEATHER_FLAVOR: string[] = [
  'Storm clouds gather on the horizon, bruise-dark and swollen with rain. The wind picks up, carrying the electric scent of lightning.',
  'A light drizzle begins to fall, turning the trail to mud and misting the distance. The party pulls cloaks tighter and presses on.',
  'The sky is clear and vast, a dome of cerulean blue unmarred by cloud. It would be beautiful if they weren\'t so focused on the road ahead.',
  'A cold fog rolls in, reducing visibility to a few dozen yards. Sounds are muffled and distorted, every shadow a potential threat.',
  'The sun breaks through the clouds in dramatic shafts of gold, painting the landscape in sudden warmth. For a moment, the journey feels almost pleasant.',
];

// Inline SVG icons for survival actions — ink-sketch style
const FORAGE_ICONS: Record<string, string> = {
  forage: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 28V14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M16 14C16 14 12 10 10 6C9 3.5 11 1.5 13 3C14.5 4 16 7 16 7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="rgba(76,120,56,0.3)"/>
    <path d="M16 14C16 14 20 10 22 6C23 3.5 21 1.5 19 3C17.5 4 16 7 16 7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="rgba(76,120,56,0.3)"/>
    <path d="M16 18C16 18 11 15 7 14C4.5 13.3 3.5 15.5 5 17C6.2 18.2 10 19 16 18Z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="rgba(76,120,56,0.25)"/>
    <path d="M16 18C16 18 21 15 25 14C27.5 13.3 28.5 15.5 27 17C25.8 18.2 22 19 16 18Z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="rgba(76,120,56,0.25)"/>
    <circle cx="16" cy="5" r="1.2" fill="rgba(180,60,60,0.6)" stroke="currentColor" stroke-width="0.6"/>
    <circle cx="12" cy="8" r="0.9" fill="rgba(180,60,60,0.5)" stroke="currentColor" stroke-width="0.5"/>
    <circle cx="20" cy="8" r="0.9" fill="rgba(180,60,60,0.5)" stroke="currentColor" stroke-width="0.5"/>
  </svg>`,
  hunt: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 4L6 28" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M6 4C6 4 18 7 18 16C18 25 6 28 6 28" stroke="currentColor" stroke-width="1.2" fill="rgba(140,100,50,0.2)"/>
    <path d="M6 16H18" stroke="currentColor" stroke-width="0.8" stroke-dasharray="2 2" opacity="0.4"/>
    <path d="M20 16L30 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M27 13L30 16L27 19" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M21 14.5L20 16L21 17.5" stroke="currentColor" stroke-width="1" stroke-linecap="round" fill="none"/>
  </svg>`,
  fish: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 2L8 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M8 2C8 2 10 3 12 2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M8 18L10 22L8 28" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="none"/>
    <circle cx="9" cy="28" r="1.5" stroke="currentColor" stroke-width="1" fill="none"/>
    <path d="M8 10Q14 8 18 12Q22 16 20 20Q16 24 18 28" stroke="currentColor" stroke-width="0.8" stroke-dasharray="3 2" opacity="0.35" fill="none"/>
    <ellipse cx="22" cy="22" rx="5" ry="3" stroke="currentColor" stroke-width="1.2" fill="rgba(80,120,160,0.2)" transform="rotate(-15 22 22)"/>
    <path d="M27 22L30 19.5L30 24.5Z" stroke="currentColor" stroke-width="1" fill="rgba(80,120,160,0.15)"/>
    <circle cx="20" cy="21" r="0.7" fill="currentColor" opacity="0.6"/>
  </svg>`,
};

function pickJourneyNarrative(terrain: OverworldTerrain, time: { totalRounds: number }, rng: () => number): string {
  const pool = JOURNEY_NARRATIVES[terrain] ?? JOURNEY_NARRATIVES['plains'];
  const cal = gameTimeToCalendar(time);
  const base = pool[Math.floor(rng() * pool.length)];

  // Add time-of-day color occasionally
  let timeNote = '';
  if (rng() < 0.35) {
    if (cal.hour >= 5 && cal.hour < 8) timeNote = ' The early morning light casts long shadows across their path.';
    else if (cal.hour >= 18 && cal.hour < 21) timeNote = ' The dying light of sunset paints the sky in shades of amber and violet.';
    else if (cal.hour >= 21 || cal.hour < 5) timeNote = ' They travel by moonlight, the silver glow transforming the landscape into something strange and otherworldly.';
    else if (cal.hour >= 12 && cal.hour < 14) timeNote = ' The midday sun is merciless, beating down from directly overhead.';
  }

  return base + timeNote;
}

// ── Delta-storage helpers for local maps ────────────────────────
// Instead of saving the full 2500-cell grid, we regenerate the base
// from the deterministic seed and only persist cells that changed.

/** Compute a bitmask of which neighboring overworld tiles are water.
 *  bit 0=north, 1=south, 2=west, 3=east */
function getWaterSides(overworld: OverworldData, x: number, y: number): number {
  const WATER: Set<string> = new Set(['deep_water', 'shallow_water']);
  let mask = 0;
  if (y > 0 && WATER.has(overworld.tiles[y - 1][x].terrain))                     mask |= 1; // north
  if (y < overworld.height - 1 && WATER.has(overworld.tiles[y + 1][x].terrain))   mask |= 2; // south
  if (x > 0 && WATER.has(overworld.tiles[y][x - 1].terrain))                     mask |= 4; // west
  if (x < overworld.width - 1 && WATER.has(overworld.tiles[y][x + 1].terrain))    mask |= 8; // east
  return mask;
}

/** Get a human-readable cardinal direction from dx/dy offset */
function getDirectionName(dx: number, dy: number): string {
  if (dx === 0 && dy < 0) return 'north';
  if (dx === 0 && dy > 0) return 'south';
  if (dx < 0 && dy === 0) return 'west';
  if (dx > 0 && dy === 0) return 'east';
  if (dx > 0 && dy < 0) return 'northeast';
  if (dx < 0 && dy < 0) return 'northwest';
  if (dx > 0 && dy > 0) return 'southeast';
  if (dx < 0 && dy > 0) return 'southwest';
  return 'that direction';
}

/** Regenerate the base grid for a location from its overworld tile.
 *  Every overworld tile gets a 200×200 POI map. Settlement tiles get
 *  settlement POIs, terrain tiles get terrain-appropriate POIs.
 *  If a handcrafted map exists in the universe for this tile, use it instead.
 */
function regenerateBaseGrid(
  overworld: OverworldData,
  tileX: number,
  tileY: number,
  _locationType: import('@/types/world').LocationType,
  biome: import('@/types/world').BiomeType,
  universe?: Universe | null,
  entryDir: { dx: number; dy: number } = { dx: 0, dy: 0 },
): { grid: GridDefinition; playerStart: import('@/types').Coordinate } {
  // Check for handcrafted map override from universe
  if (universe) {
    const override = getLocationOverride(universe, overworld.id ? `country_${overworld.id}` : '', tileX, tileY);
    // Also try matching by iterating all countries to find the one whose overworld.id matches
    const hm = override?.handcraftedMap ?? findHandcraftedMap(universe, tileX, tileY);
    if (hm) {
      // Build full grid from sparse handcrafted cells
      const defaultCell: GridCell = { terrain: 'grass', movementCost: 1, blocksLoS: false, elevation: 0, features: [] };
      const cells: GridCell[][] = [];
      for (let y = 0; y < hm.height; y++) {
        cells[y] = [];
        for (let x = 0; x < hm.width; x++) {
          cells[y][x] = { ...defaultCell, features: [] };
        }
      }
      for (const [x, y, cell] of hm.cells) {
        if (y >= 0 && y < hm.height && x >= 0 && x < hm.width) {
          // Fix Infinity lost in JSON serialization (null or 999999 sentinel)
          if (cell.terrain === 'wall' || cell.movementCost === 999999 || cell.movementCost === null) {
            if (cell.terrain === 'wall') {
              cell.movementCost = Infinity;
              cell.blocksLoS = true;
            } else if ((cell.movementCost as unknown) === 999999) {
              cell.movementCost = Infinity;
            }
          }
          cells[y][x] = cell;
        }
      }
      return { grid: { width: hm.width, height: hm.height, cells }, playerStart: hm.playerStart };
    }
  }

  const tile = overworld.tiles[tileY][tileX];
  const poiGen = new POIMapGenerator(new SeededRNG(0));
  if (tile.settlement) {
    return poiGen.generatePOI(tile.settlement, biome, entryDir, overworld.seed, tileX, tileY);
  }
  const waterSides = getWaterSides(overworld, tileX, tileY);
  return poiGen.generateTerrainPOI(tile.terrain, biome, tile.river, waterSides, entryDir, overworld.seed, tileX, tileY);
}

/** Search all countries in a universe for a handcrafted map at the given tile. */
function findHandcraftedMap(
  universe: Universe,
  tileX: number,
  tileY: number,
): import('@/types/universe').LocationOverride['handcraftedMap'] | undefined {
  for (const planeRef of universe.planes) {
    const plane = planeRef.inline;
    if (!plane) continue;
    for (const contRef of plane.continents) {
      const cont = contRef.inline;
      if (!cont) continue;
      for (const regRef of cont.regions) {
        const reg = regRef.inline;
        if (!reg) continue;
        for (const countryRef of reg.countries) {
          const country = countryRef.inline;
          if (!country) continue;
          const override = country.locationOverrides.find(
            lo => lo.tileX === tileX && lo.tileY === tileY,
          );
          if (override?.handcraftedMap) return override.handcraftedMap;
        }
      }
    }
  }
  return undefined;
}

/**
 * Create NPC objects from handcrafted universe data and attach them to
 * the matching world Locations. Returns all created NPCs.
 */
function injectHandcraftedNPCs(
  universe: Universe,
  world: import('@/types/world').World,
  rng: SeededRNG,
): import('@/types/npc').NPC[] {
  const factory = new NPCFactory(rng);
  const allNPCs: import('@/types/npc').NPC[] = [];

  for (const planeRef of universe.planes) {
    const plane = planeRef.inline;
    if (!plane) continue;
    for (const contRef of plane.continents) {
      const cont = contRef.inline;
      if (!cont) continue;
      for (const regRef of cont.regions) {
        const reg = regRef.inline;
        if (!reg) continue;
        for (const countryRef of reg.countries) {
          const country = countryRef.inline;
          if (!country) continue;
          for (const lo of country.locationOverrides) {
            if (!lo.npcs || lo.npcs.length === 0) continue;

            // Find the Location in the world at these coordinates
            const locationId = findLocationIdAtTile(world, lo.tileX, lo.tileY);
            if (!locationId) continue;

            for (const hnpc of lo.npcs) {
              const role = (hnpc.role ?? 'commoner') as import('@/types/npc').NPCRole;
              const npc = factory.createFromTemplate(role, 1, locationId);
              // Override with handcrafted data
              npc.name = hnpc.name;
              if (hnpc.position) npc.position = hnpc.position;

              // Find the location and add NPC to its list
              for (const [, region] of world.regions) {
                const loc = region.locations.get(locationId);
                if (loc && !loc.npcs.includes(npc.id)) {
                  loc.npcs.push(npc.id);
                }
              }
              allNPCs.push(npc);
            }
          }
        }
      }
    }
  }
  return allNPCs;
}

/** Find a Location ID in the world by overworld tile coordinates. */
function findLocationIdAtTile(
  world: import('@/types/world').World,
  tileX: number,
  tileY: number,
): import('@/types').EntityId | null {
  for (const [, region] of world.regions) {
    for (const [locId, loc] of region.locations) {
      if (loc.coordinates.x === tileX && loc.coordinates.y === tileY) {
        return locId;
      }
    }
  }
  return null;
}

/** Find the start location for a handcrafted world (first LocationOverride with a map). */
function findHandcraftedStartLocation(
  universe: Universe,
  world: import('@/types/world').World,
): import('@/types').EntityId | null {
  for (const planeRef of universe.planes) {
    const plane = planeRef.inline;
    if (!plane) continue;
    for (const contRef of plane.continents) {
      const cont = contRef.inline;
      if (!cont) continue;
      for (const regRef of cont.regions) {
        const reg = regRef.inline;
        if (!reg) continue;
        for (const countryRef of reg.countries) {
          const country = countryRef.inline;
          if (!country) continue;
          for (const lo of country.locationOverrides) {
            if (!lo.handcraftedMap) continue;
            const locId = findLocationIdAtTile(world, lo.tileX, lo.tileY);
            if (locId) return locId;
          }
        }
      }
    }
  }
  return null;
}

/** Compare current grid against the regenerated base; return only changed cells. */
function computeGridDiff(base: GridDefinition, current: GridDefinition): [number, number, GridCell][] {
  const mods: [number, number, GridCell][] = [];
  for (let y = 0; y < base.height; y++) {
    for (let x = 0; x < base.width; x++) {
      const bc = base.cells[y][x];
      const cc = current.cells[y][x];
      if (
        bc.terrain !== cc.terrain ||
        bc.movementCost !== cc.movementCost ||
        bc.blocksLoS !== cc.blocksLoS ||
        bc.elevation !== cc.elevation ||
        bc.features.length !== cc.features.length ||
        bc.features.some((f, i) => f !== cc.features[i])
      ) {
        mods.push([x, y, cc]);
      }
    }
  }
  return mods;
}

/** Apply stored modifications onto a regenerated base grid. */
function applyGridMods(grid: GridDefinition, mods: [number, number, GridCell][]): void {
  for (const [x, y, cell] of mods) {
    if (y >= 0 && y < grid.height && x >= 0 && x < grid.width) {
      grid.cells[y][x] = cell;
    }
  }
}

async function main(): Promise<void> {
  // 1. Initialize storage engine
  const storage = new StorageEngine();
  await storage.init();
  const saveManager = new SaveManager(storage);

  // 2. Initialize icon system
  await IconSystem.init();

  // 3. Initialize tooltip system
  TooltipSystem.init();

  // 4. Create the game engine
  const engine = new GameEngine();

  // 4b. Register game systems
  const keyboardInput = new KeyboardInput();
  engine.registerSystem(keyboardInput);
  const explorationController = new ExplorationController();
  engine.registerSystem(explorationController);

  // 4c. Combat systems
  const combatRng = new SeededRNG(Date.now() + 42);
  const combatDice = new DiceRoller(combatRng);
  const combatRules = new CombatRules(combatDice);
  const conditionRules = new ConditionRules();
  const combatManager = new CombatManager(combatRules, conditionRules, engine.events, combatDice);
  const combatController = new CombatController();
  combatController.setCombatManager(combatManager);
  engine.registerSystem(combatController);

  // 4c-2. Level-up rules (shared across combat & rest)
  const levelUpRules = new LevelUpRules(combatDice);

  // 4d. Template / encounter resolution
  const templateRegistry = new TemplateRegistry();
  templateRegistry.loadDefaults();

  // 5. Get the app container
  const container = document.getElementById('app');
  if (!container) {
    throw new Error('#app container not found');
  }

  // 6. Create UI manager
  const ui = new UIManager(container, engine);

  // Load saved tileset preference
  const savedTilesetId = await storage.getSetting<string>('tileset');
  let activeTileset = getTilesetById(savedTilesetId ?? 'fantasy');

  // Track active game state
  let activeGameState: GameState | null = null;
  let activeGameScreen: GameScreen | null = null;
  let activeRng: SeededRNG | null = null;
  let activeDice: DiceRoller | null = null;
  let activeOverworld: OverworldData | null = null;
  let activeUniverse: Universe | null = null;
  const narrator = new TextNarrativeEngine();
  const equipmentRules = new EquipmentRules();

  // 7. Register screens
  ui.registerScreen('worldcreation', () => new WorldCreationScreen(container, engine));
  ui.registerScreen('worldselection', () => new WorldSelectionScreen(container, engine));
  ui.registerScreen('worldpicker', () => new WorldPickerScreen(container, engine));
  ui.registerScreen('menu', () => new MenuScreen(container, engine));
  ui.registerScreen('creation', () => new CreationScreen(container, engine));
  ui.registerScreen('game', () => {
    const screen = new GameScreen(container, engine);
    activeGameScreen = screen;
    return screen;
  });
  ui.setPersistent('game');
  let activeInventoryScreen: InventoryScreen | null = null;
  let activeCharacterScreen: CharacterScreen | null = null;

  ui.registerScreen('inventory', () => {
    const screen = new InventoryScreen(container, engine);
    activeInventoryScreen = screen;
    return screen;
  });
  ui.registerScreen('character', () => {
    const screen = new CharacterScreen(container, engine);
    activeCharacterScreen = screen;
    return screen;
  });

  // Death screen — options are set dynamically before navigation
  let pendingDeathOptions: DeathScreenOptions | null = null;
  ui.registerScreen('death', () => {
    const opts = pendingDeathOptions ?? {
      characterName: 'Unknown',
      causeOfDeath: 'Claimed by the darkness.',
      level: 1,
      timePlayed: '—',
      enemiesDefeated: 0,
    };
    pendingDeathOptions = null;
    return new DeathScreen(container, engine, opts);
  });

  /** Compute a formatted play-time string from the game state. */
  function getTimePlayed(): string {
    if (!activeGameState) return '—';
    const cal = gameTimeToCalendar(activeGameState.world.time);
    const days = cal.day - 1; // day 1 = start
    if (days > 0) return `${days} day${days !== 1 ? 's' : ''}`;
    const hours = cal.hour;
    if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''}`;
    return 'Moments';
  }

  /**
   * Transition to the death screen. Cleans up combat state and navigates.
   */
  function transitionToDeathScreen(causeOfDeath: string): void {
    const character = engine.entities.getAll<Character>('character')[0];
    pendingDeathOptions = {
      characterName: character?.name ?? 'Unknown',
      causeOfDeath,
      level: character?.level ?? 1,
      timePlayed: getTimePlayed(),
      enemiesDefeated: 0, // no persistent stat tracking yet
    };
    engine.events.emit({
      type: 'ui:navigate',
      category: 'ui',
      data: { screen: 'death', direction: 'left' },
    });
  }

  // 8. Listen for navigation events
  engine.events.on('ui:navigate', (event) => {
    const { screen, direction } = event.data as {
      screen: string;
      direction?: 'left' | 'right' | 'up' | 'down';
    };
    ui.switchScreen(
      screen as Parameters<typeof ui.switchScreen>[0],
      direction ?? 'left',
    );
  });

  // 9. Wire up character creation -> game start flow
  engine.events.on('character:created', (event) => {
    const { name, race, class: classId, abilityScores, skills, selectedCantrips, selectedSpells } = event.data as {
      name: string;
      race: string;
      class: string;
      abilityScores: AbilityScores;
      skills: Skill[];
      selectedCantrips?: string[];
      selectedSpells?: string[];
    };

    // Create RNG and dice
    const seed = Date.now();
    const rng = new SeededRNG(seed);
    activeRng = rng;
    const dice = new DiceRoller(rng);
    activeDice = dice;

    // Create character via factory
    const factory = new CharacterFactory(dice);
    const character: Character = factory.create({
      name,
      raceId: race,
      classId: classId,
      abilityScores,
      skills,
      selectedCantrips,
      selectedSpells,
    });

    // Bridge overworld to World/Region/Location hierarchy
    if (!activeOverworld) {
      throw new Error('No world generated — create a world first');
    }
    const { world, startLocationId: defaultStartId, npcs } = overworldToWorld(activeOverworld, rng);

    // For handcrafted worlds, start at the first LocationOverride tile (the main city)
    let startLocationId = defaultStartId;
    if (activeUniverse) {
      const overrideStart = findHandcraftedStartLocation(activeUniverse, world);
      if (overrideStart) {
        startLocationId = overrideStart;
        // Ensure the start location and its region are discovered
        for (const [, region] of world.regions) {
          const loc = region.locations.get(startLocationId);
          if (loc) { loc.discovered = true; region.discovered = true; break; }
        }
      }
    }

    // Create game state
    const gameState = new GameState(world, character.id, startLocationId);
    gameState.registerNPCs(npcs);

    // Inject handcrafted NPCs from universe LocationOverrides
    if (activeUniverse) {
      const handcraftedNPCs = injectHandcraftedNPCs(activeUniverse, world, rng);
      if (handcraftedNPCs.length > 0) {
        gameState.registerNPCs(handcraftedNPCs);
      }
    }

    activeGameState = gameState;

    // Set overworld position from starting location's coordinates
    const startLoc = gameState.getCurrentLocation();
    gameState.overworldPosition = { x: startLoc.coordinates.x, y: startLoc.coordinates.y };

    // Dev mode: add Plot Armor and God's Sword
    if (isDevMode()) {
      character.inventory.items.push({ itemId: 'item_dev_plot_armor', quantity: 1 });
      character.inventory.items.push({ itemId: 'item_dev_gods_sword', quantity: 1 });
      character.equipment.armor = 'item_dev_plot_armor';
      character.equipment.mainHand = 'item_dev_gods_sword';
      character.armorClass = 100;
    }

    // Register entities
    engine.entities.clear();
    engine.entities.add(character);

    // Auto-save the new game
    saveManager
      .autoSave(gameState, engine.entities)
      .then(() => { localStorage.setItem('oneparty-saves', 'true'); })
      .catch((err) => console.error('Initial auto-save failed:', err));

    // Auto-save is now triggered on each move, no interval needed

    console.log(
      `[One Party] New game started: ${character.name} the ${race} ${classId} in ${world.name}`,
    );
  });

  let gamePopulated = false;

  // Populate screens when they become active + sync keyboard context
  engine.events.on('ui:screen:changed', (event) => {
    const { screen } = event.data as { screen: string };

    // Sync keyboard context to the active screen
    if (screen === 'game') {
      keyboardInput.setContext('exploration');
    } else if (screen === 'inventory') {
      keyboardInput.setContext('inventory');
    } else if (screen === 'character') {
      keyboardInput.setContext('character');
    } else if (screen === 'menu' || screen === 'worldcreation' || screen === 'worldselection' || screen === 'worldpicker' || screen === 'creation') {
      keyboardInput.setContext('menu');
    }

    if (screen === 'game' && activeGameScreen && activeGameState && !gamePopulated) {
      populateGameScreen(activeGameScreen, activeGameState, engine);
      gamePopulated = true;
    }

    if (screen === 'character' && activeCharacterScreen) {
      const character = engine.entities.getAll<Character>('character')[0];
      if (character) {
        activeCharacterScreen.setCharacter(character);
      }
    }

    if (screen === 'inventory' && activeInventoryScreen) {
      refreshInventoryScreen(activeInventoryScreen);
    }
  });

  /** Build a complete item map (inventory + equipped) and refresh the inventory screen. */
  function refreshInventoryScreen(invScreen: InventoryScreen): void {
    const character = engine.entities.getAll<Character>('character')[0];
    if (!character) return;
    const itemMap = new Map<string, import('@/types').Item>();
    // Include inventory items
    for (const entry of character.inventory.items) {
      const item = getItem(entry.itemId);
      if (item) itemMap.set(item.id, item);
    }
    // Include equipped items
    for (const slotId of Object.values(character.equipment)) {
      if (slotId) {
        const item = getItem(slotId);
        if (item) itemMap.set(item.id, item);
      }
    }
    invScreen.setInventory(character.inventory, itemMap);
    invScreen.setEquipment(character.equipment, itemMap, character.equipmentCharges);
  }

  // ── Inventory interactions ──
  engine.events.on('inventory:equip', (event) => {
    const { itemId, slot } = event.data as { itemId: string; slot: keyof EquipmentSlots };
    const character = engine.entities.getAll<Character>('character')[0];
    if (!character) return;
    const item = getItem(itemId);
    if (!item) return;

    // If slot is occupied, unequip first
    if (character.equipment[slot] !== null) {
      equipmentRules.unequip(character, slot);
    }

    const result = equipmentRules.equip(character, itemId, slot);
    if (result.ok) {
      // Refresh the inventory screen
      const invScreen = activeInventoryScreen;
      if (invScreen) refreshInventoryScreen(invScreen);
      // Update game screen status
      if (activeGameScreen) activeGameScreen.setCharacter(character);
    }
  });

  engine.events.on('inventory:unequip', (event) => {
    const { slot } = event.data as { slot: keyof EquipmentSlots };
    const character = engine.entities.getAll<Character>('character')[0];
    if (!character) return;

    const result = equipmentRules.unequip(character, slot);
    if (result.ok) {
      const invScreen = activeInventoryScreen;
      if (invScreen) refreshInventoryScreen(invScreen);
      if (activeGameScreen) activeGameScreen.setCharacter(character);
    }
  });

  engine.events.on('inventory:use', (event) => {
    const { itemId } = event.data as { itemId: string };
    const character = engine.entities.getAll<Character>('character')[0];
    if (!character) return;
    const item = getItem(itemId);
    if (!item) return;

    if (item.itemType === 'food' || item.itemType === 'drink') {
      const invEntry = character.inventory.items.find(e => e.itemId === itemId);
      if (!invEntry) return;

      // Handle charge-based items (e.g. waterskin)
      if (item.maxCharges !== undefined) {
        const charges = invEntry.charges ?? item.charges ?? 0;
        if (charges <= 0) {
          if (activeGameScreen) {
            activeGameScreen.addNarrative({
              text: `The ${item.name.toLowerCase()} is empty. Find running water to refill it.`,
              category: 'action',
            });
          }
          const invScreen = activeInventoryScreen;
          if (invScreen) refreshInventoryScreen(invScreen);
          return;
        }
        invEntry.charges = charges - 1;
      }

      const props = item.properties as ConsumableProperties;
      const hungerBefore = character.survival.hunger;
      const thirstBefore = character.survival.thirst;
      SurvivalRules.consume(character.survival, props);

      // Remove from inventory (only for non-charge items, or when charges are depleted)
      if (item.maxCharges === undefined) {
        invEntry.quantity -= 1;
        if (invEntry.quantity <= 0) {
          character.inventory.items = character.inventory.items.filter(e => e.itemId !== itemId);
        }
      }

      // Narrate
      if (activeGameScreen) {
        if (item.itemType === 'food') {
          activeGameScreen.addNarrative(
            SurvivalNarrator.describeEating(hungerBefore, character.survival.hunger, props.description),
          );
        } else {
          activeGameScreen.addNarrative(
            SurvivalNarrator.describeDrinking(thirstBefore, character.survival.thirst, props.description),
          );
        }
        activeGameScreen.setCharacter(character);
      }

      // Refresh inventory
      const invScreen = activeInventoryScreen;
      if (invScreen) refreshInventoryScreen(invScreen);
    }
  });

  function populateGameScreen(
    screen: GameScreen,
    state: GameState,
    eng: GameEngine,
  ): void {
    // Clear narrative log from previous adventure
    screen.clearNarrative();

    // Apply saved tileset preference
    screen.getGridPanel().setTileset(activeTileset);

    const character = eng.entities.getAll<Character>('character')[0];
    if (!character) return;

    const region = state.getCurrentRegion();
    const location = state.getCurrentLocation();

    // Mark starting location as discovered
    location.discovered = true;

    // Populate status panel
    screen.setCharacter(character);

    // Set location name and time
    screen.setLocationName(location.name);
    screen.updateTime(state.world.time);

    // Populate party panel + map
    screen.setGameState({
      mode: 'exploration',
      partyMembers: [{
        id: character.id,
        name: character.name,
        level: character.level,
        className: character.class.charAt(0).toUpperCase() + character.class.slice(1),
        currentHp: character.currentHp,
        maxHp: character.maxHp,
        armorClass: character.armorClass,
        conditions: character.conditions.map(c => c.type),
        isPlayer: true,
      }],
      region,
      currentLocationId: location.id,
    });

    // Set up overworld canvas map
    if (activeOverworld) {
      screen.setOverworld(activeOverworld);
      screen.setEdgeChecker((dx, dy) => explorationController.canSeeMapEdge(dx, dy));
      screen.setSupplyChecker((tiles: number) => {
        const character = engine.entities.getAll<Character>('character')[0];
        if (!character) return { sufficient: true, maxTiles: 999, limitingFactor: null };
        const result = TravelRules.canSustainJourney(character, tiles);
        return { sufficient: result.sufficient, maxTiles: result.range.maxTiles, limitingFactor: result.limitingFactor };
      });

      // Derive overworld position from current location if not set (old saves)
      if (!state.overworldPosition) {
        state.overworldPosition = { x: location.coordinates.x, y: location.coordinates.y };
      }
      screen.setOverworldPosition(state.overworldPosition.x, state.overworldPosition.y);
    }

    // Add opening narrative
    screen.addNarrative({
      text: `Your adventure begins in the world of ${state.world.name}.`,
      category: 'system',
    });
    screen.addNarrative(narrator.describeLocation(location));

    // Generate or restore local map for current location
    let gridDef: import('@/types').GridDefinition;
    let playerStart: import('@/types').Coordinate;
    const fog = new FogOfWar();

    if (location.localMap) {
      // Restore persisted map state
      if (location.localMap.grid) {
        // Old save format: full grid stored directly
        gridDef = location.localMap.grid;
      } else if (activeOverworld && state.overworldPosition) {
        // New delta format: regenerate base and apply modifications
        const { x: tx, y: ty } = state.overworldPosition;
        const base = regenerateBaseGrid(activeOverworld, tx, ty, location.locationType, region.biome, activeUniverse);
        gridDef = base.grid;
        applyGridMods(gridDef, location.localMap.modifications ?? []);
      } else {
        // Fallback: no overworld context, generate non-deterministically
        const rng = activeRng ?? new SeededRNG(Date.now());
        gridDef = new LocalMapGenerator(rng).generate(location.locationType, region.biome).grid;
      }
      playerStart = location.localMap.playerStart;
      // Restore fog of war explored cells
      if (location.localMap.exploredCells.length > 0) {
        fog.setState({
          explored: new Set(location.localMap.exploredCells),
          visible: new Set(),
        });
      }
    } else {
      // First visit — generate local map from deterministic seed
      if (activeOverworld && state.overworldPosition) {
        const { x: tx, y: ty } = state.overworldPosition;
        const base = regenerateBaseGrid(activeOverworld, tx, ty, location.locationType, region.biome, activeUniverse);
        gridDef = base.grid;
        playerStart = base.playerStart;
      } else {
        const rng = activeRng ?? new SeededRNG(Date.now());
        const result = new LocalMapGenerator(rng).generate(location.locationType, region.biome);
        gridDef = result.grid;
        playerStart = result.playerStart;
      }
      // Store with empty modifications (delta format)
      location.localMap = { playerStart, exploredCells: [], modifications: [] };
    }

    // Mark as visited and run world decay
    markLocationVisited(location, state.world.time);

    const grid = new Grid(gridDef);

    // Use saved character position if available, otherwise default start
    const spawnPos = character.position ?? playerStart;

    // Configure exploration controller
    explorationController.configure({
      gameState: state,
      getCharacter: () => eng.entities.getAll<Character>('character')[0] ?? null,
    });

    // Enter local exploration
    const lighting = getLightingForLocation(location.locationType);
    explorationController.enterSpace(
      grid, fog, character.id, spawnPos,
      character.speed, lighting,
    );

    // Switch to local mode UI
    screen.enterLocalMode(grid, fog);
    screen.centerGrid(spawnPos);

    // Set up player entity rendering
    const playerInfo: EntityRenderInfo = {
      name: character.name,
      color: '#2a2520',
      symbol: '@',
      hp: character.currentHp,
      maxHp: character.maxHp,
      isPlayer: true,
      isAlly: false,
      size: 1,
      conditions: character.conditions.map(c => c.type),
      spriteId: character.class,
    };
    screen.updatePlayerEntity(character.id, spawnPos, playerInfo);

    // Place NPCs on the exploration grid for settlements
    placeExplorationNPCs(grid, location, state, screen, character);

    // Switch keyboard input to exploration mode
    keyboardInput.setContext('exploration');

    // Set keyboard hints
    screen.setKeyboardHints(buildKeyboardHints());
  }

  /** Place all NPCs for this location on the exploration grid and render them. */
  function placeExplorationNPCs(
    grid: Grid,
    location: import('@/types/world').Location,
    state: GameState,
    screen: GameScreen,
    character: Character,
  ): void {
    if (location.npcs.length === 0) return;

    const placements = new Map<string, import('@/types/grid').GridEntityPlacement>();
    const entityInfos = new Map<string, EntityRenderInfo>();

    // Always include the player
    const playerPos = grid.getEntityPosition(character.id);
    if (playerPos) {
      placements.set(character.id, { entityId: character.id, position: playerPos, size: 1 });
      entityInfos.set(character.id, {
        name: character.name, color: '#2a2520', symbol: '@',
        hp: character.currentHp, maxHp: character.maxHp,
        isPlayer: true, isAlly: false, size: 1,
        conditions: character.conditions.map(c => c.type),
        spriteId: character.class,
      });
    }

    // Pre-scan: find all indoor floor cells (passable cells adjacent to a wall)
    // These are ideal NPC placement spots — inside buildings, not in the street
    const gridDef = grid.getDefinition();
    const indoorCells: import('@/types').Coordinate[] = [];
    const outdoorCells: import('@/types').Coordinate[] = [];
    for (let y = 1; y < gridDef.height - 1; y++) {
      for (let x = 1; x < gridDef.width - 1; x++) {
        if (!grid.isPassable(x, y)) continue;
        if (grid.getEntityAt({ x, y })) continue;
        // Check if any neighbor is a wall (movementCost === Infinity)
        const hasWallNeighbor = [[-1,0],[1,0],[0,-1],[0,1]].some(([dx,dy]) => {
          const cell = grid.getCell(x+dx!, y+dy!);
          return cell && cell.movementCost === Infinity;
        });
        if (hasWallNeighbor) {
          indoorCells.push({ x, y });
        } else {
          outdoorCells.push({ x, y });
        }
      }
    }
    // Shuffle so NPCs spread across different buildings
    for (let i = indoorCells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indoorCells[i], indoorCells[j]] = [indoorCells[j], indoorCells[i]];
    }
    let indoorIdx = 0;
    let outdoorIdx = 0;

    // Place each NPC
    for (const npcId of location.npcs) {
      const npc = state.getNPC(npcId);
      if (!npc) continue;

      // Try to place NPC at their stored position, or find a suitable spot
      let npcPos = npc.position;
      if (!npcPos) {
        // Prefer indoor cells for most NPCs, outdoor for guards/commoners overflow
        while (indoorIdx < indoorCells.length) {
          const candidate = indoorCells[indoorIdx++];
          if (!grid.getEntityAt(candidate)) {
            npcPos = candidate;
            break;
          }
        }
        // Fallback: outdoor passable cells near center
        if (!npcPos) {
          const cx = Math.floor(gridDef.width / 2);
          const cy = Math.floor(gridDef.height / 2);
          // Sort outdoor cells by distance to center
          if (outdoorIdx === 0) {
            outdoorCells.sort((a, b) =>
              Math.abs(a.x - cx) + Math.abs(a.y - cy) - Math.abs(b.x - cx) - Math.abs(b.y - cy)
            );
          }
          while (outdoorIdx < outdoorCells.length) {
            const candidate = outdoorCells[outdoorIdx++];
            if (!grid.getEntityAt(candidate)) {
              npcPos = candidate;
              break;
            }
          }
        }
      }

      if (!npcPos) continue;

      // Persist discovered position back to NPC
      npc.position = npcPos;

      // Place on grid
      try {
        grid.placeEntity(npc.id, npcPos, 1);
      } catch {
        // Position occupied — skip this NPC
        continue;
      }

      placements.set(npc.id, { entityId: npc.id, position: npcPos, size: 1 });

      const NPC_COLORS: Record<string, string> = {
        innkeeper: '#c4943a', merchant: '#3a9c5a', blacksmith: '#8a5a3a',
        priest: '#d4b85a', guard: '#5a7a9a', commoner: '#8a7a6a', noble: '#9a4a8a',
      };
      const symbol = npc.name.charAt(0).toUpperCase();
      entityInfos.set(npc.id, {
        name: npc.name,
        color: NPC_COLORS[npc.role] ?? '#7a7a6a',
        symbol,
        hp: npc.stats.currentHp,
        maxHp: npc.stats.maxHp,
        isPlayer: false,
        isAlly: true,
        size: 1,
        conditions: [],
        spriteId: `npc_${npc.role}`,
      });
    }

    // Update all entities on the grid
    screen.updateCombatEntities(placements, (id) => entityInfos.get(id));
  }

  function buildExplorationActions(
    state: GameState,
    eng: GameEngine,
  ): import('@/ui/panels/ActionPanel').ActionOption[] {
    const location = state.getCurrentLocation();
    const actions: import('@/ui/panels/ActionPanel').ActionOption[] = [];

    // Look around
    actions.push({
      id: 'look',
      label: 'Look Around',
      icon: 'eye',
      description: 'Survey your surroundings',
      enabled: true,
      onClick: () => {
        if (!activeGameScreen) return;
        activeGameScreen.addNarrative({
          text: location.description,
          category: 'description',
        });
      },
    });

    // Explore sub-locations
    for (const [, sub] of location.subLocations) {
      actions.push({
        id: `enter-${sub.id}`,
        label: `Enter ${sub.name}`,
        icon: 'door',
        description: `Explore the ${sub.subType}`,
        enabled: true,
        onClick: () => {
          if (!activeGameScreen) return;
          sub.discovered = true;
          state.currentSubLocationId = sub.id;
          activeGameScreen.addNarrative({
            text: `You enter ${sub.name}.`,
            category: 'action',
          });
        },
      });
    }

    // Travel to connected locations
    const region = state.getCurrentRegion();
    for (const connId of location.connections) {
      const dest = region.locations.get(connId);
      if (!dest) continue;
      actions.push({
        id: `travel-${connId}`,
        label: `Travel to ${dest.discovered ? dest.name : '???'}`,
        icon: 'compass',
        description: dest.discovered ? `Journey to ${dest.name}` : 'Venture into the unknown',
        enabled: true,
        onClick: () => {
          if (!activeGameScreen || !activeGameState) return;
          dest.discovered = true;
          activeGameState.currentLocationId = dest.id;
          activeGameState.currentSubLocationId = null;

          // Travel takes 2-4 hours
          const travelRounds = ROUNDS_PER_HOUR * (2 + Math.floor(Math.random() * 3));
          const travelHours = Math.round(travelRounds / ROUNDS_PER_HOUR);
          activeGameState.advanceTime(travelRounds);

          activeGameScreen.addNarrative({
            text: `You gather your belongings and set out. The journey to ${dest.name} takes ${travelHours} hours of hard travel through the ${region.biome} terrain.`,
            category: 'action',
          });

          // Tick survival and narrate crossings
          const character = eng.entities.getAll<Character>('character')[0];
          if (character) {
            tickAndNarrate(character, travelRounds);
          }

          activeGameScreen.addNarrative(narrator.describeLocation(dest));

          // Update party status
          activeGameScreen.setGameState({
            mode: 'exploration',
            partyMembers: getPartyMembers(eng),
          });
          if (character) activeGameScreen.setCharacter(character);

          // Refresh actions for new location
          activeGameScreen.setActions({
            type: 'exploration',
            actions: buildExplorationActions(activeGameState, eng),
          });
        },
      });
    }

    // ── Eat ──
    const character = eng.entities.getAll<Character>('character')[0];
    if (character) {
      const foodItems = character.inventory.items
        .map(entry => ({ entry, item: getItem(entry.itemId) }))
        .filter(({ item }) => item && item.itemType === 'food');

      for (const { entry, item } of foodItems) {
        if (!item) continue;
        actions.push({
          id: `eat-${item.id}`,
          label: `Eat ${item.name}`,
          icon: 'heart',
          description: item.description,
          enabled: entry.quantity > 0,
          onClick: () => {
            if (!activeGameScreen) return;
            const char = eng.entities.getAll<Character>('character')[0];
            if (!char) return;
            const props = item.properties as ConsumableProperties;
            const hungerBefore = char.survival.hunger;
            SurvivalRules.consume(char.survival, props);
            // Remove item from inventory
            const invEntry = char.inventory.items.find(e => e.itemId === item.id);
            if (invEntry) {
              invEntry.quantity -= 1;
              if (invEntry.quantity <= 0) {
                char.inventory.items = char.inventory.items.filter(e => e.itemId !== item.id);
              }
            }
            activeGameScreen.addNarrative(
              SurvivalNarrator.describeEating(hungerBefore, char.survival.hunger, props.description),
            );
            activeGameScreen.setCharacter(char);
            // Refresh actions
            if (activeGameState) {
              activeGameScreen.setActions({
                type: 'exploration',
                actions: buildExplorationActions(activeGameState, eng),
              });
            }
          },
        });
      }

      // ── Drink ──
      const drinkItems = character.inventory.items
        .map(entry => ({ entry, item: getItem(entry.itemId) }))
        .filter(({ item }) => item && item.itemType === 'drink');

      for (const { entry, item } of drinkItems) {
        if (!item) continue;
        const isChargeBased = item.maxCharges != null;
        const charges = isChargeBased ? (entry.charges ?? item.charges ?? 0) : entry.quantity;
        actions.push({
          id: `drink-${item.id}`,
          label: `Drink ${item.name}`,
          icon: 'potion',
          description: item.description,
          enabled: charges > 0,
          onClick: () => {
            if (!activeGameScreen) return;
            const char = eng.entities.getAll<Character>('character')[0];
            if (!char) return;
            const props = item.properties as ConsumableProperties;
            const invEntry = char.inventory.items.find(e => e.itemId === item.id);
            if (!invEntry) return;

            if (isChargeBased) {
              const curCharges = invEntry.charges ?? item.charges ?? 0;
              if (curCharges <= 0) {
                activeGameScreen.addNarrative({
                  text: `The ${item.name.toLowerCase()} is empty. Find running water to refill it.`,
                  category: 'action',
                });
                return;
              }
              invEntry.charges = curCharges - 1;
            } else {
              invEntry.quantity -= 1;
              if (invEntry.quantity <= 0) {
                char.inventory.items = char.inventory.items.filter(e => e.itemId !== item.id);
              }
            }

            const thirstBefore = char.survival.thirst;
            SurvivalRules.consume(char.survival, props);
            activeGameScreen.addNarrative(
              SurvivalNarrator.describeDrinking(thirstBefore, char.survival.thirst, props.description),
            );
            activeGameScreen.setCharacter(char);
            if (activeGameState) {
              activeGameScreen.setActions({
                type: 'exploration',
                actions: buildExplorationActions(activeGameState, eng),
              });
            }
          },
        });
      }

      // ── Check Status ──
      actions.push({
        id: 'check-status',
        label: 'Check Status',
        icon: 'heart',
        description: 'Assess your physical condition',
        enabled: true,
        onClick: () => {
          if (!activeGameScreen) return;
          const char = eng.entities.getAll<Character>('character')[0];
          if (!char) return;
          activeGameScreen.addNarrative(SurvivalNarrator.describeOverallStatus(char.survival));
        },
      });
    }

    // Rest
    actions.push({
      id: 'short-rest',
      label: 'Short Rest',
      icon: 'campfire',
      description: 'Take a breather (1 hour)',
      enabled: true,
      onClick: () => {
        if (!activeGameScreen || !activeGameState) return;
        const rounds = ROUNDS_PER_HOUR;
        activeGameState.advanceTime(rounds);
        const char = eng.entities.getAll<Character>('character')[0];
        if (char) {
          tickAndNarrate(char, rounds);
          activeGameScreen.setCharacter(char);
        }
        activeGameScreen.addNarrative({
          text: 'You find a sheltered spot and take a short rest. An hour passes as you catch your breath, bind your wounds, and gather your resolve. The road ahead remains unforgiving.',
          category: 'system',
        });
      },
    });

    actions.push({
      id: 'long-rest',
      label: 'Long Rest',
      icon: 'moon',
      description: 'Make camp and sleep (8 hours)',
      enabled: true,
      onClick: () => {
        if (!activeGameScreen || !activeGameState) return;
        const rounds = ROUNDS_PER_HOUR * 8;
        activeGameState.advanceTime(rounds);
        const char = eng.entities.getAll<Character>('character')[0];
        if (char) {
          // Tick hunger/thirst during sleep, then reset fatigue
          tickAndNarrate(char, rounds);
          SurvivalRules.rest(char.survival);
          // Restore HP
          char.currentHp = char.maxHp;
          activeGameScreen.setCharacter(char);
        }
        activeGameScreen.addNarrative({
          text: 'You make camp as darkness falls. The fire crackles and pops, casting dancing shadows against the trees. Sleep comes slowly at first — the sounds of the wild keeping you alert — but exhaustion eventually claims you. Hours later you wake, stiff but restored, as pale dawn light filters through the canopy. A new day begins.',
          category: 'description',
        });
        // Refresh actions
        activeGameScreen.setActions({
          type: 'exploration',
          actions: buildExplorationActions(activeGameState, eng),
        });
      },
    });

    return actions;
  }
  // Keep for non-local mode fallback
  void buildExplorationActions;

  /** Tick survival and emit narrative for threshold crossings. */
  function tickAndNarrate(character: Character, rounds: number): void {
    const result = SurvivalRules.tick(character.survival, rounds);
    if (!activeGameScreen) return;

    if (result.hungerCrossing) {
      activeGameScreen.addNarrative(SurvivalNarrator.describeHungerCrossing(result.hungerCrossing.to));
    }
    if (result.thirstCrossing) {
      activeGameScreen.addNarrative(SurvivalNarrator.describeThirstCrossing(result.thirstCrossing.to));
    }
    if (result.fatigueCrossing) {
      activeGameScreen.addNarrative(SurvivalNarrator.describeFatigueCrossing(result.fatigueCrossing.to));
    }

    // Apply HP damage from starvation/dehydration/exhaustion
    if (result.hpDamage > 0 && character.currentHp > 0) {
      character.currentHp = Math.max(0, character.currentHp - result.hpDamage);
      const sourceText = result.hpDamageSources.join(' and ');
      activeGameScreen.addNarrative({
        text: `Your body pays the price of ${sourceText}. You take ${result.hpDamage} damage. (${character.currentHp}/${character.maxHp} HP)`,
        category: 'system',
      });

      // Update status panel
      activeGameScreen.setCharacter(character);

      // Check for death
      if (character.currentHp <= 0) {
        activeGameScreen.addNarrative({
          text: 'The road claims another victim. Your body gives out, unable to endure any longer.',
          category: 'system',
        });
      }
    }
  }

  function getPartyMembers(eng: GameEngine): import('@/ui/panels/PartyPanel').PartyMember[] {
    return eng.entities.getAll<Character>('character')
      .map(c => ({
        id: c.id,
        name: c.name,
        level: c.level,
        className: c.class.charAt(0).toUpperCase() + c.class.slice(1),
        currentHp: c.currentHp,
        maxHp: c.maxHp,
        armorClass: c.armorClass,
        conditions: c.conditions.map(cond => cond.type),
        isPlayer: true,
      }));
  }

  function buildKeyboardHints(): KeyboardHint[] {
    return keyboardInput.getContextHints().map(h => ({
      key: h.key,
      label: h.label,
      available: true,
      category: h.category,
    }));
  }

  let helpModal: Modal | null = null;

  function showContextHelp(): void {
    // Toggle existing modal if open
    if (helpModal) {
      helpModal.close();
      helpModal = null;
      return;
    }

    const context = keyboardInput.getContext();

    // On the game screen in exploration/worldmap, use the built-in action panel toggle
    if (activeGameScreen && (context === 'exploration' || context === 'worldmap')) {
      const hints = buildKeyboardHints();
      activeGameScreen.setKeyboardHints(hints);
      activeGameScreen.toggleHelp();
      return;
    }

    // Combat and all other screens: show a modal with full keyboard reference
    const hints = buildKeyboardHints();

    // In combat, enrich hints with bonus action info from current available actions
    if (context === 'combat' && combatController.isActive()) {
      const actions = combatController.getAvailableActions();
      // Add Cast spell hint (not in static CONTEXT_HINTS)
      hints.push({ key: 's', label: 'Cast Spell', available: true, category: 'action' });
      // Add bonus actions
      if (actions?.validBonusActions) {
        for (let i = 0; i < actions.validBonusActions.length; i++) {
          const ba = actions.validBonusActions[i];
          hints.push({ key: String(i + 1), label: `${ba.name} (bonus)`, available: ba.enabled, category: 'action' });
        }
      }
      // Add Action Surge if available
      if (actions?.actionSurgeAvailable) {
        hints.push({ key: 'x', label: 'Action Surge (free)', available: true, category: 'action' });
      }
    }

    if (hints.length === 0) return;

    // Group hints by category
    const groups: Record<string, KeyboardHint[]> = {};
    for (const h of hints) {
      const cat = h.category ?? 'action';
      (groups[cat] ??= []).push(h);
    }

    const content = el('div', { class: 'help-modal-grid' });
    const catLabels: Record<string, string> = { movement: 'Movement', action: 'Actions', meta: 'Menu' };
    for (const [cat, catHints] of Object.entries(groups)) {
      content.appendChild(el('div', { class: 'help-modal-category font-heading' }, [catLabels[cat] ?? cat]));
      for (const h of catHints) {
        const row = el('div', { class: `help-modal-row${h.available === false ? ' help-modal-row--dim' : ''}` });
        row.appendChild(el('kbd', { class: 'help-modal-key font-mono' }, [h.key]));
        row.appendChild(el('span', { class: 'help-modal-label' }, [h.label]));
        content.appendChild(row);
      }
    }

    helpModal = new Modal(document.body, engine, {
      title: context === 'combat' ? 'Combat Controls' : 'Keyboard Shortcuts',
      content,
      closable: true,
      width: '360px',
    });
    helpModal.mount();

    // Clear reference when modal is closed externally (Escape, backdrop click)
    const origClose = helpModal.close.bind(helpModal);
    helpModal.close = async () => {
      helpModal = null;
      await origClose();
    };
  }

  // Listen for exploration movement events — update UI + autosave
  engine.events.on('exploration:moved', (event) => {
    if (!activeGameScreen || !activeGameState) return;
    const { position, roundsElapsed } = event.data as { position: { x: number; y: number }; roundsElapsed: number };

    // Persist player position and fog state
    const character = engine.entities.getAll<Character>('character')[0];
    if (character) {
      character.position = { x: position.x, y: position.y };
    }
    const location = activeGameState.getCurrentLocation();
    if (location.localMap) {
      const fogState = explorationController.getFogState();
      if (fogState) {
        location.localMap.exploredCells = [...fogState.explored];
      }
      // Persist grid modifications as delta (door changes etc.)
      const currentGrid = explorationController.getGridDefinition();
      if (currentGrid && activeOverworld && activeGameState.overworldPosition) {
        const { x: tx, y: ty } = activeGameState.overworldPosition;
        const base = regenerateBaseGrid(activeOverworld, tx, ty, location.locationType, activeGameState.getCurrentRegion().biome, activeUniverse);
        location.localMap.modifications = computeGridDiff(base.grid, currentGrid);
        // Drop legacy full grid if present (migrated to delta)
        delete location.localMap.grid;
      } else if (currentGrid) {
        // No overworld context — fall back to full grid storage
        location.localMap.grid = currentGrid;
      }
    }

    // Autosave on every move (silent, non-blocking)
    saveManager.autoSave(activeGameState, engine.entities).catch(() => {});

    // Center camera on player
    activeGameScreen.centerGrid(position);
    if (character) {
      activeGameScreen.updatePlayerEntity(character.id, position, {
        name: character.name,
        color: '#2a2520',
        symbol: '@',
        hp: character.currentHp,
        maxHp: character.maxHp,
        isPlayer: true,
        isAlly: false,
        size: 1,
        conditions: character.conditions.map(c => c.type),
        spriteId: character.class,
      });

      if (roundsElapsed > 0) {
        // Check for time-of-day transitions
        const timeBefore = { totalRounds: activeGameState.world.time.totalRounds - roundsElapsed };
        const timeAfter = activeGameState.world.time;
        const transition = TimeNarrator.describeTimeTransition(timeBefore, timeAfter);
        if (transition) {
          activeGameScreen.addNarrative({ text: transition, category: 'description' });
        }

        activeGameScreen.setCharacter(character);
        activeGameScreen.updateTime(activeGameState.world.time);
      }
    }
  });

  engine.events.on('exploration:waited', () => {
    if (!activeGameScreen || !activeGameState) return;
    const character = engine.entities.getAll<Character>('character')[0];
    if (character) {
      activeGameScreen.setCharacter(character);
      activeGameScreen.updateTime(activeGameState.world.time);
    }
  });

  // ── Combat event handlers ──────────────────────────────────────

  // Combat UI: when combat starts, switch GameScreen to combat mode
  engine.events.on('combat:encounter_started', (event) => {
    if (!activeGameScreen) return;
    const { grid, participants } = event.data as {
      grid: import('@/types').GridDefinition;
      participants: import('@/combat/CombatManager').CombatParticipant[];
    };

    // Build CombatantDisplay list for the HUD
    const character_ = engine.entities.getAll<Character>('character')[0];
    const displays: CombatantDisplay[] = participants.map((p) => ({
      entityId: p.entityId,
      name: p.npc?.name ?? (p.isPlayer ? (character_?.name ?? 'Player') : 'Unknown'),
      initiative: p.initiative,
      isPlayer: p.isPlayer,
      isAlly: p.isAlly,
      currentHp: p.stats.currentHp,
      maxHp: p.stats.maxHp,
      spriteId: p.isPlayer ? character_?.class : p.npc?.templateId,
    }));

    keyboardInput.pushContext('combat');
    combatController.setDiceContainer(activeGameScreen.getCombatDiceContainer());
    activeGameScreen.enterCombatMode(grid, displays);

    // NOTE: fog is revealed in combat:start handler (grid doesn't exist yet here)

    // Set up overlays on the grid canvas (correct coordinate space)
    const gridPanel = activeGameScreen.getGridPanel();
    const canvasContainer = gridPanel.getCanvasContainer();
    const gridToScreen = (pos: import('@/types').Coordinate) =>
      gridPanel.gridToScreenCenter(pos) ?? { x: 0, y: 0 };

    // Spell animation overlay
    const spellAnimEl = document.createElement('div');
    spellAnimEl.className = 'combat-spell-anim-container';
    canvasContainer.appendChild(spellAnimEl);

    // Damage number overlay
    const dmgContainer = document.createElement('div');
    dmgContainer.className = 'combat-damage-container';
    canvasContainer.appendChild(dmgContainer);

    combatController.setSpellAnimations(
      spellAnimEl,
      activeGameScreen.getGridWrap(),
      gridToScreen,
    );

    // Pass grid coordinate converter + damage container to HUD
    const combatHud = activeGameScreen.getCombatHUD();
    if (combatHud) {
      combatHud.setGridOverlay(gridToScreen, dmgContainer);
      // Wire up initiative bar element getter for mini NPC dice rolls
      combatController.setInitiativeElGetter((id) => combatHud.getCombatantEl(id));
    }
  });

  // When combat starts (after initiative is rolled), update HUD with actual initiative
  engine.events.on('combat:start', (event) => {
    if (!activeGameScreen) return;
    const hud = activeGameScreen.getCombatHUD();
    if (!hud) return;

    const { initiative } = event.data as {
      initiative: { entityId: string; initiative: number; isPlayer: boolean }[];
    };

    // Rebuild displays with real initiative values
    const char = engine.entities.getAll<Character>('character')[0];
    const displays: CombatantDisplay[] = initiative.map((entry) => {
      const p = combatManager.getParticipant(entry.entityId);
      return {
        entityId: entry.entityId,
        name: p?.npc?.name ?? (entry.isPlayer ? (char?.name ?? 'Player') : 'Unknown'),
        initiative: entry.initiative,
        isPlayer: entry.isPlayer,
        isAlly: p?.isAlly ?? false,
        currentHp: p?.stats.currentHp ?? 0,
        maxHp: p?.stats.maxHp ?? 0,
        spriteId: entry.isPlayer ? char?.class : p?.npc?.templateId,
      };
    });
    hud.setInitiativeOrder(displays);

    // Now that entities are placed on the combat grid, push to the render layer
    refreshCombatEntities();
    // Reveal fog from all combatant starting positions (grid exists now)
    refreshCombatFog();

    // Center grid on player
    const character = engine.entities.getAll<Character>('character')[0];
    if (character) {
      const playerPos = combatManager.getGrid()?.getEntityPosition(character.id);
      if (playerPos) activeGameScreen.centerGrid(playerPos);
    }
  });

  // On each turn start, update combat action buttons
  engine.events.on('combat:turn_start', (event) => {
    if (!activeGameScreen) return;
    const { entityId, isPlayer } = event.data as { entityId: string; isPlayer: boolean };
    const hud = activeGameScreen.getCombatHUD();
    if (hud) hud.setCurrentTurn(entityId);

    refreshCombatEntities();

    if (isPlayer) {
      updateCombatActionButtons();
    } else {
      // Disable buttons during NPC turn
      activeGameScreen.setCombatActions([]);
    }
  });

  // Show attack results as toasts
  engine.events.on('combat:attack', (event) => {
    if (!activeGameScreen) return;
    const { result } = event.data as { result: import('@/types').ActionResult };
    const hud = activeGameScreen.getCombatHUD();
    if (hud) hud.showActionResult(result);

    // Add to narrative
    activeGameScreen.addNarrative({
      text: result.description,
      category: 'combat',
    });
  });

  // Show spell results as toasts + narrative
  engine.events.on('combat:spell', (event) => {
    if (!activeGameScreen) return;
    const { result } = event.data as { result: import('@/types').ActionResult };
    const hud = activeGameScreen.getCombatHUD();
    if (hud) hud.showActionResult(result);

    activeGameScreen.addNarrative({
      text: result.description,
      category: 'combat',
    });
  });

  // Show damage numbers
  engine.events.on('combat:damage', (event) => {
    if (!activeGameScreen) return;
    const { targetId, damage, damageType } = event.data as {
      targetId: string; damage: number; damageType: string;
    };
    const hud = activeGameScreen.getCombatHUD();
    if (!hud) return;

    // Get target position on grid for damage number placement
    const grid = combatManager.getGrid();
    const pos = grid?.getEntityPosition(targetId);
    if (pos) {
      hud.showDamageNumber(pos, damage, damageType as import('@/types').DamageType);
    }
  });

  // Refresh entity positions after movement
  engine.events.on('combat:move', () => {
    refreshCombatEntities();
    refreshCombatFog();
  });

  // Entity defeated narrative
  engine.events.on('combat:kill', (event) => {
    if (!activeGameScreen) return;
    const { entityId } = event.data as { entityId: string };
    const p = combatManager.getParticipant(entityId);
    const name = p?.npc?.name ?? 'the creature';
    activeGameScreen.addNarrative({
      text: `${name} falls!`,
      category: 'combat',
    });
    refreshCombatEntities();
  });

  // Concentration check narrative
  engine.events.on('combat:concentration_check', (event) => {
    if (!activeGameScreen) return;
    const { spellName, dc, roll, success, isPlayer } = event.data as {
      spellName: string;
      dc: number;
      roll: import('@/types').DiceRollResult;
      success: boolean;
      isPlayer: boolean;
    };
    if (isPlayer) {
      const outcomeText = success
        ? `Concentration holds! (${roll.total} vs DC ${dc})`
        : `Concentration check failed! (${roll.total} vs DC ${dc})`;
      activeGameScreen.addNarrative({
        text: `Constitution save to maintain ${spellName}: ${outcomeText}`,
        category: 'combat',
      });
    }
  });

  // Concentration broken narrative
  engine.events.on('combat:concentration_broken', (event) => {
    if (!activeGameScreen) return;
    const { spellName, isPlayer } = event.data as {
      entityId: string;
      spellName: string;
      isPlayer: boolean;
    };
    if (isPlayer) {
      activeGameScreen.addNarrative({
        text: `Your concentration on ${spellName} breaks!`,
        category: 'combat',
      });
    }
  });

  // Combat ended — show summary modal, then clean up
  engine.events.on('combat:encounter_ended', (event) => {
    if (!activeGameScreen || !activeGameState) return;
    const { result, xpEarned, loot, enemiesDefeated } = event.data as {
      result: CombatResult;
      xpEarned: number;
      loot: { itemId: string; quantity: number }[];
      enemiesDefeated: string[];
    };

    const character = engine.entities.getAll<Character>('character')[0];
    if (!character) return;

    // Award XP and loot immediately (before modal)
    const lootItems: { name: string; quantity: number }[] = [];
    let healAmount = 0;

    if (result.victory) {
      character.xp += xpEarned;

      for (const drop of loot) {
        const item = getItem(drop.itemId);
        if (item) {
          const existing = character.inventory.items.find((e) => e.itemId === drop.itemId);
          if (existing) {
            existing.quantity += drop.quantity;
          } else {
            character.inventory.items.push({ itemId: drop.itemId, quantity: drop.quantity });
          }
          lootItems.push({ name: item.name, quantity: drop.quantity });
        }
      }

      healAmount = Math.ceil(character.maxHp * 0.1);
      character.currentHp = Math.min(character.maxHp, character.currentHp + healAmount);
    }

    // Check for level-ups after XP award
    const levelBefore = character.level;
    if (result.victory) {
      checkAndApplyLevelUps(character, activeGameScreen, levelUpRules);
    }
    const levelsGained = character.level - levelBefore;

    // Build summary modal content
    const content = el('div', { class: 'combat-summary' });

    if (result.victory) {
      // Flavor text
      const flavor = el('p', { class: 'combat-summary-flavor' }, [
        'The dust settles. Silence reclaims the battlefield.',
      ]);
      content.appendChild(flavor);

      // Enemies defeated
      if (enemiesDefeated.length > 0) {
        const enemySection = el('div', { class: 'combat-summary-section' });
        enemySection.appendChild(el('h4', { class: 'combat-summary-label' }, ['Enemies Slain']));
        // Count duplicates
        const counts = new Map<string, number>();
        for (const name of enemiesDefeated) {
          counts.set(name, (counts.get(name) ?? 0) + 1);
        }
        const list = el('ul', { class: 'combat-summary-list' });
        for (const [name, count] of counts) {
          list.appendChild(el('li', {}, [count > 1 ? `${name} x${count}` : name]));
        }
        enemySection.appendChild(list);
        content.appendChild(enemySection);
      }

      // Rounds
      const statsSection = el('div', { class: 'combat-summary-section' });
      statsSection.appendChild(el('h4', { class: 'combat-summary-label' }, ['Battle Stats']));
      const statsList = el('ul', { class: 'combat-summary-list' });
      statsList.appendChild(el('li', {}, [`${result.rounds} round${result.rounds !== 1 ? 's' : ''} of combat`]));
      if (healAmount > 0) {
        statsList.appendChild(el('li', {}, [`Recovered ${healAmount} HP`]));
      }
      statsSection.appendChild(statsList);
      content.appendChild(statsSection);

      // XP
      const xpSection = el('div', { class: 'combat-summary-section combat-summary-xp' });
      xpSection.appendChild(el('span', { class: 'combat-summary-xp-label' }, ['Experience Gained']));
      xpSection.appendChild(el('span', { class: 'combat-summary-xp-value' }, [`+${xpEarned} XP`]));
      content.appendChild(xpSection);

      // Level Up
      if (levelsGained > 0) {
        const lvlSection = el('div', { class: 'combat-summary-section combat-summary-xp' });
        lvlSection.appendChild(el('span', { class: 'combat-summary-xp-label' }, ['Level Up!']));
        lvlSection.appendChild(el('span', { class: 'combat-summary-xp-value' }, [`Level ${character.level}`]));
        content.appendChild(lvlSection);
      }

      // Loot
      if (lootItems.length > 0) {
        const lootSection = el('div', { class: 'combat-summary-section' });
        lootSection.appendChild(el('h4', { class: 'combat-summary-label' }, ['Spoils']));
        const lootList = el('ul', { class: 'combat-summary-list combat-summary-loot' });
        for (const item of lootItems) {
          lootList.appendChild(el('li', {}, [
            item.quantity > 1 ? `${item.name} x${item.quantity}` : item.name,
          ]));
        }
        lootSection.appendChild(lootList);
        content.appendChild(lootSection);
      }
    } else {
      // Defeat
      const flavor = el('p', { class: 'combat-summary-flavor combat-summary-defeat' }, [
        'Darkness closes in. The party has fallen.',
      ]);
      content.appendChild(flavor);

      const statsSection = el('div', { class: 'combat-summary-section' });
      statsSection.appendChild(el('h4', { class: 'combat-summary-label' }, ['Battle Stats']));
      const statsList = el('ul', { class: 'combat-summary-list' });
      statsList.appendChild(el('li', {}, [`Lasted ${result.rounds} round${result.rounds !== 1 ? 's' : ''}`]));
      statsSection.appendChild(statsList);
      content.appendChild(statsSection);
    }

    // Show summary modal — game pauses until dismissed
    const modal = new Modal(document.body, engine, {
      title: result.victory ? 'Victory' : 'Defeat',
      content,
      closable: false,
      width: '420px',
      actions: [{
        label: result.victory ? 'Continue' : 'Accept Your Fate',
        variant: 'primary',
        onClick: () => {
          modal.close();

          // Exit combat mode
          activeGameScreen?.exitCombatMode();
          if (keyboardInput.getContext() === 'combat') {
            keyboardInput.popContext();
          }

          if (result.victory) {
            // Add narrative after modal dismissed
            activeGameScreen?.addNarrative({
              text: `Victory! The battle is won. You earn ${xpEarned} experience.`,
              category: 'action',
            });
            for (const item of lootItems) {
              activeGameScreen?.addNarrative({
                text: `Found: ${item.name}${item.quantity > 1 ? ` x${item.quantity}` : ''}`,
                category: 'system',
              });
            }

            // Refresh character UI if level changed
            if (levelsGained > 0) {
              activeGameScreen?.setCharacter(character);
            }

            // Resume travel / trigger deferred onComplete callback
            combatController.dismissCombatSummary();
          } else {
            // Player died — build cause of death from enemies and transition
            const uniqueEnemies = [...new Set(enemiesDefeated)];
            let causeOfDeath: string;
            if (uniqueEnemies.length === 1) {
              causeOfDeath = `Slain by ${uniqueEnemies[0]} after ${result.rounds} round${result.rounds !== 1 ? 's' : ''} of desperate combat.`;
            } else if (uniqueEnemies.length > 1) {
              causeOfDeath = `Overwhelmed by ${uniqueEnemies.join(' and ')} after ${result.rounds} round${result.rounds !== 1 ? 's' : ''} of desperate combat.`;
            } else {
              causeOfDeath = `Fell in battle after ${result.rounds} round${result.rounds !== 1 ? 's' : ''} of combat.`;
            }

            // Dismiss combat so the pending travel callback fires (marking defeat)
            combatController.dismissCombatSummary();

            transitionToDeathScreen(causeOfDeath);
          }
        },
      }],
    });
    modal.mount();
  });

  // Combat keyboard: movement
  engine.events.on('input:combat_move', (event) => {
    if (!combatController.isActive() || !combatManager.isPlayerTurn()) return;
    const actions = combatController.getAvailableActions();
    if (!actions?.canMove || actions.remainingMovement <= 0) return;
    const { dx, dy } = event.data as { dx: number; dy: number };
    const entityId = combatManager.getCurrentTurnEntity();
    const grid = combatManager.getGrid();
    if (!grid) return;
    const pos = grid.getEntityPosition(entityId);
    if (!pos) return;
    const dest = { x: pos.x + dx, y: pos.y + dy };
    // Check destination is within valid move cells
    if (!actions.validMoveCells.has(`${dest.x},${dest.y}`)) return;
    combatController.playerMove([pos, dest]);
    refreshCombatEntities();
    refreshCombatFog();
    updateCombatActionButtons();
  });

  engine.events.on('input:combat_attack', () => {
    if (!combatController.isActive() || !combatManager.isPlayerTurn()) return;
    const actions = combatController.getAvailableActions();
    if (!actions?.canAction || actions.validAttackTargets.length === 0) return;

    const targets = actions.validAttackTargets;

    const doAttack = (targetId: string) => {
      combatController.playerAttack(targetId).then(() => {
        refreshCombatEntities();
        updateCombatActionButtons();
      });
    };

    // Single target — attack directly
    if (targets.length === 1) {
      doAttack(targets[0]);
      return;
    }

    // Multiple targets — show floating picker on grid
    const gridContainer = activeGameScreen?.getGridPanel().getCanvasContainer();
    if (!gridContainer) return;

    const picker = el('div', { class: 'target-picker' });
    const header = el('div', { class: 'target-picker-header' });
    header.appendChild(el('span', { class: 'target-picker-title' }, ['Choose Target']));
    const closeBtn = el('button', { class: 'target-picker-close' }, ['\u00D7']);
    header.appendChild(closeBtn);
    picker.appendChild(header);

    const list = el('div', { class: 'target-selector-list' });
    let closed = false;

    const closePicker = (immediate = false) => {
      if (closed) return;
      closed = true;
      activeGameScreen?.getGridPanel().setSelectedEntity(null);
      document.removeEventListener('keydown', onKey, true);
      if (immediate) {
        picker.remove();
      } else {
        picker.animate([
          { opacity: '1', transform: 'translateY(0)' },
          { opacity: '0', transform: 'translateY(6px)' },
        ], { duration: 150, easing: 'ease-in', fill: 'forwards' });
        setTimeout(() => picker.remove(), 150);
      }
    };

    closeBtn.addEventListener('click', () => closePicker());

    targets.forEach((targetId, i) => {
      const p = combatManager.getParticipant(targetId);
      const name = p?.npc?.name ?? 'Unknown';
      const hp = p?.stats.currentHp ?? 0;
      const maxHp = p?.stats.maxHp ?? 1;
      const hpPct = Math.round((hp / maxHp) * 100);

      const btn = el('button', { class: 'target-selector-btn' });
      btn.innerHTML = `<span class="target-selector-key font-mono">${i + 1}</span>`
        + `<span class="target-selector-name">${name}</span>`
        + `<span class="target-selector-hp font-mono">${hp}/${maxHp} HP (${hpPct}%)</span>`;
      btn.addEventListener('mouseenter', () => {
        activeGameScreen?.getGridPanel().setSelectedEntity(targetId);
      });
      btn.addEventListener('mouseleave', () => {
        activeGameScreen?.getGridPanel().setSelectedEntity(null);
      });
      btn.addEventListener('click', () => {
        closePicker(true);
        doAttack(targetId);
      });
      list.appendChild(btn);
    });

    picker.appendChild(list);
    gridContainer.appendChild(picker);

    // Track keyboard-selected index
    let selectedIdx = 0;
    const allBtns = list.querySelectorAll('button');

    const highlightBtn = (idx: number) => {
      allBtns.forEach((b, i) => b.classList.toggle('target-selector-btn--active', i === idx));
      activeGameScreen?.getGridPanel().setSelectedEntity(targets[idx]);
    };
    highlightBtn(0);

    // Number keys 1-9, arrow keys, Enter, Escape
    const onKey = (e: KeyboardEvent) => {
      // Block movement keys while picker is open
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
      }

      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= targets.length) {
        e.preventDefault();
        e.stopPropagation();
        closePicker(true);
        doAttack(targets[num - 1]);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        selectedIdx = (selectedIdx + 1) % targets.length;
        highlightBtn(selectedIdx);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        selectedIdx = (selectedIdx - 1 + targets.length) % targets.length;
        highlightBtn(selectedIdx);
      } else if (e.key === 'Enter' || e.key === ' ') {
        closePicker(true);
        doAttack(targets[selectedIdx]);
      } else if (e.key === 'Escape') {
        closePicker();
      }
    };
    document.addEventListener('keydown', onKey, true);
  });

  engine.events.on('input:combat_cast_spell', () => {
    if (!combatController.isActive() || !combatManager.isPlayerTurn()) return;
    const actions = combatController.getAvailableActions();
    if (!actions || actions.validSpells.length === 0) return;

    const spells = actions.validSpells;
    const character = engine.entities.getAll<Character>('character')[0];

    // Build spell selection modal
    const list = el('div', { class: 'target-selector-list' });
    let closed = false;

    const doCast = (spellOpt: typeof spells[0], targetId: string | null) => {
      combatController.playerCastSpell(spellOpt.spellId, targetId, spellOpt.slotLevel).then(() => {
        refreshCombatEntities();
        updateCombatActionButtons();
      });
    };

    spells.forEach((spellOpt, i) => {
      const spell = getSpell(spellOpt.spellId);
      if (!spell) return;

      const isCantrip = spell.level === 0;
      const isBonusAction = spell.castingTime === '1 bonus action';
      const hasHealing = spell.effects.some(e => e.healing);

      // Slot info
      let slotInfo = 'cantrip';
      if (!isCantrip && character?.spellcasting) {
        const slot = character.spellcasting.spellSlots[spell.level];
        slotInfo = slot ? `Lv${spell.level} ${slot.current}/${slot.max}` : `Lv${spell.level}`;
      }

      // Effect summary
      let effectStr = '';
      for (const eff of spell.effects) {
        if (eff.damage) {
          effectStr += `${eff.damage.count}d${eff.damage.die} ${eff.damage.type}`;
          break;
        }
        if (eff.healing) {
          effectStr += `${eff.healing.count}d${eff.healing.die} healing`;
          break;
        }
      }

      const rangeStr = spell.range > 0 ? `${spell.range}ft` : spell.range === 0 ? 'self' : 'touch';
      const baTag = isBonusAction ? '<span class="spell-selector-ba">BA</span>' : '';

      const btn = el('button', { class: 'target-selector-btn' });
      btn.innerHTML = `<span class="target-selector-key">${i + 1}</span>`
        + `<div class="spell-selector-row">`
        + `<span class="target-selector-name">${spell.name} ${baTag}</span>`
        + `<div class="spell-selector-meta"><span>${slotInfo}</span>`
        + (effectStr ? `<span>${effectStr}</span>` : '')
        + `<span>${rangeStr}</span></div>`
        + `</div>`;

      btn.addEventListener('click', () => {
        if (closed) return;
        closed = true;
        spellModal.close();

        // Healing spells target self — cast immediately
        if (hasHealing) {
          doCast(spellOpt, null);
          return;
        }

        // Self/area spells with no explicit target — cast at first valid target
        if (spell.targetType === 'self' || spell.range === 0) {
          doCast(spellOpt, spellOpt.validTargets[0] ?? null);
          return;
        }

        // Single target — if only one, cast directly
        if (spellOpt.validTargets.length === 1) {
          doCast(spellOpt, spellOpt.validTargets[0]);
          return;
        }

        // Multiple targets — show floating picker on grid
        if (spellOpt.validTargets.length > 1) {
          const spellGridContainer = activeGameScreen?.getGridPanel().getCanvasContainer();
          if (!spellGridContainer) return;

          // Close the spell selection modal first
          spellModal.close();

          const tPicker = el('div', { class: 'target-picker' });
          const tHeader = el('div', { class: 'target-picker-header' });
          tHeader.appendChild(el('span', { class: 'target-picker-title' }, ['Choose Target']));
          const tCloseBtn = el('button', { class: 'target-picker-close' }, ['\u00D7']);
          tHeader.appendChild(tCloseBtn);
          tPicker.appendChild(tHeader);

          const tList = el('div', { class: 'target-selector-list' });
          let tClosed = false;

          const closeTPicker = (immediate = false) => {
            if (tClosed) return;
            tClosed = true;
            activeGameScreen?.getGridPanel().setSelectedEntity(null);
            document.removeEventListener('keydown', onTKey, true);
            if (immediate) {
              tPicker.remove();
            } else {
              tPicker.animate([
                { opacity: '1', transform: 'translateY(0)' },
                { opacity: '0', transform: 'translateY(6px)' },
              ], { duration: 150, easing: 'ease-in', fill: 'forwards' });
              setTimeout(() => tPicker.remove(), 150);
            }
          };

          tCloseBtn.addEventListener('click', () => closeTPicker());

          spellOpt.validTargets.forEach((targetId, ti) => {
            const p = combatManager.getParticipant(targetId);
            const name = p?.npc?.name ?? 'Unknown';
            const hp = p?.stats.currentHp ?? 0;
            const maxHp = p?.stats.maxHp ?? 1;
            const hpPct = Math.round((hp / maxHp) * 100);

            const tBtn = el('button', { class: 'target-selector-btn' });
            tBtn.innerHTML = `<span class="target-selector-key font-mono">${ti + 1}</span>`
              + `<span class="target-selector-name">${name}</span>`
              + `<span class="target-selector-hp font-mono">${hp}/${maxHp} HP (${hpPct}%)</span>`;
            tBtn.addEventListener('mouseenter', () => {
              activeGameScreen?.getGridPanel().setSelectedEntity(targetId);
            });
            tBtn.addEventListener('mouseleave', () => {
              activeGameScreen?.getGridPanel().setSelectedEntity(null);
            });
            tBtn.addEventListener('click', () => {
              closeTPicker(true);
              doCast(spellOpt, targetId);
            });
            tList.appendChild(tBtn);
          });

          tPicker.appendChild(tList);
          spellGridContainer.appendChild(tPicker);

          // Track keyboard-selected index
          let tSelectedIdx = 0;
          const tAllBtns = tList.querySelectorAll('button');

          const tHighlightBtn = (idx: number) => {
            tAllBtns.forEach((b, i) => b.classList.toggle('target-selector-btn--active', i === idx));
            activeGameScreen?.getGridPanel().setSelectedEntity(spellOpt.validTargets[idx]);
          };
          tHighlightBtn(0);

          const onTKey = (e: KeyboardEvent) => {
            // Block movement keys while picker is open
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'Enter', ' '].includes(e.key)) {
              e.preventDefault();
              e.stopPropagation();
            }

            const num = parseInt(e.key, 10);
            if (num >= 1 && num <= spellOpt.validTargets.length) {
              e.preventDefault();
              e.stopPropagation();
              closeTPicker(true);
              doCast(spellOpt, spellOpt.validTargets[num - 1]);
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
              tSelectedIdx = (tSelectedIdx + 1) % spellOpt.validTargets.length;
              tHighlightBtn(tSelectedIdx);
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
              tSelectedIdx = (tSelectedIdx - 1 + spellOpt.validTargets.length) % spellOpt.validTargets.length;
              tHighlightBtn(tSelectedIdx);
            } else if (e.key === 'Enter' || e.key === ' ') {
              closeTPicker(true);
              doCast(spellOpt, spellOpt.validTargets[tSelectedIdx]);
            } else if (e.key === 'Escape') {
              closeTPicker();
            }
          };
          document.addEventListener('keydown', onTKey, true);
        }
      });
      list.appendChild(btn);
    });

    const spellModal = new Modal(document.body, engine, {
      title: 'Cast Spell',
      content: list,
      closable: true,
      width: '380px',
    });
    spellModal.mount();

    // Number keys 1-9 to select spell
    const onKey = (e: KeyboardEvent) => {
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= spells.length) {
        e.preventDefault();
        if (closed) return;
        closed = true;
        document.removeEventListener('keydown', onKey, true);
        spellModal.close();

        const spellOpt = spells[num - 1];
        const spell = getSpell(spellOpt.spellId);
        const hasHealing = spell?.effects.some(e2 => e2.healing);

        if (hasHealing || spell?.targetType === 'self' || spell?.range === 0) {
          doCast(spellOpt, spellOpt.validTargets[0] ?? null);
        } else if (spellOpt.validTargets.length === 1) {
          doCast(spellOpt, spellOpt.validTargets[0]);
        } else if (spellOpt.validTargets.length > 1) {
          // Re-trigger with this specific spell's targets for selection
          // Simplification: pick first target
          doCast(spellOpt, spellOpt.validTargets[0]);
        }
      } else if (e.key === 'Escape') {
        document.removeEventListener('keydown', onKey, true);
      }
    };
    document.addEventListener('keydown', onKey, true);
  });

  engine.events.on('input:combat_dash', () => {
    if (!combatController.isActive() || !combatManager.isPlayerTurn()) return;
    combatController.playerDash();
    activeGameScreen?.addNarrative({ text: 'You dash forward, doubling your movement.', category: 'combat' });
    updateCombatActionButtons();
  });

  engine.events.on('input:combat_dodge', () => {
    if (!combatController.isActive() || !combatManager.isPlayerTurn()) return;
    combatController.playerDodge();
    activeGameScreen?.addNarrative({ text: 'You take the Dodge action — attacks against you have disadvantage.', category: 'combat' });
    updateCombatActionButtons();
  });

  engine.events.on('input:combat_disengage', () => {
    if (!combatController.isActive() || !combatManager.isPlayerTurn()) return;
    combatController.playerDisengage();
    activeGameScreen?.addNarrative({ text: 'You disengage — your movement won\'t provoke opportunity attacks.', category: 'combat' });
    updateCombatActionButtons();
  });

  // Number keys 1-9 → resolve to bonus action by index
  engine.events.on('input:combat_bonus_key', (e) => {
    if (!combatController.isActive() || !combatManager.isPlayerTurn()) return;
    const { index } = e.data as { index: number };
    const actions = combatController.getAvailableActions();
    if (!actions?.validBonusActions || !actions.canBonusAction) return;
    const ba = actions.validBonusActions[index];
    if (!ba || !ba.enabled) return;
    engine.events.emit({ type: 'input:combat_bonus_action', category: 'ui', data: { bonusActionId: ba.id } });
  });

  engine.events.on('input:combat_bonus_action', async (e) => {
    if (!combatController.isActive() || !combatManager.isPlayerTurn()) return;
    const { bonusActionId } = e.data as { bonusActionId: string };
    await combatController.playerBonusAction(bonusActionId);
    const def = getBonusAction(bonusActionId);
    if (def) {
      // Rich narrative feedback per effect type
      let text: string;
      switch (def.effect.type) {
        case 'heal':
          text = `You channel your resolve — ${def.name} mends your wounds.`;
          break;
        case 'grant_action':
          text = `You use ${def.name}.`;
          break;
        default:
          text = `You use ${def.name}.`;
      }
      activeGameScreen?.addNarrative({ text, category: 'combat' });
    }
    updateCombatActionButtons();
  });

  engine.events.on('input:combat_action_surge', () => {
    if (!combatController.isActive() || !combatManager.isPlayerTurn()) return;
    combatController.playerActionSurge();
    activeGameScreen?.addNarrative({
      text: 'You surge with renewed vigor — an additional action courses through you!',
      category: 'combat',
    });
    updateCombatActionButtons();
  });

  engine.events.on('input:combat_end_turn', () => {
    if (!combatController.isActive() || !combatManager.isPlayerTurn()) return;
    combatController.playerEndTurn();
  });

  /** Push current combat entity positions + render info to the grid panel. */
  function refreshCombatEntities(): void {
    if (!activeGameScreen || !combatController.isActive()) return;
    const grid = combatManager.getGrid();
    if (!grid) return;

    const placements = grid.getAllEntityPlacements();
    const character = engine.entities.getAll<Character>('character')[0];

    activeGameScreen.updateCombatEntities(placements, (id: string) => {
      const p = combatManager.getParticipant(id);
      if (!p) return undefined;
      // Use actual grid placement size (Large=2, Huge=3, etc.)
      const placement = placements.get(id);
      const entitySize = placement?.size ?? 1;
      if (p.isPlayer && character) {
        return {
          name: character.name,
          color: '#2a2520',
          symbol: '@',
          hp: p.stats.currentHp,
          maxHp: p.stats.maxHp,
          isPlayer: true,
          isAlly: true,
          size: entitySize,
          conditions: p.stats.conditions?.map((c: { type: string }) => c.type) ?? [],
          spriteId: character.class,
        };
      }
      // NPC — derive symbol from first letter of name
      const symbol = p.npc?.name?.charAt(0).toUpperCase() ?? '?';
      return {
        name: p.npc?.name ?? 'Enemy',
        color: '#8b2020',
        symbol,
        hp: p.stats.currentHp,
        maxHp: p.stats.maxHp,
        isPlayer: false,
        isAlly: p.isAlly,
        size: entitySize,
        conditions: p.stats.conditions?.map((c: { type: string }) => c.type) ?? [],
        spriteId: p.npc?.templateId,
      };
    });
  }

  /** Update combat fog of war based on all combatant positions. */
  function refreshCombatFog(): void {
    if (!activeGameScreen || !combatController.isActive()) return;
    const grid = combatManager.getGrid();
    if (!grid) return;

    const observers: { position: Coordinate; range: number }[] = [];
    const placements = grid.getAllEntityPlacements();
    for (const [id, placement] of placements) {
      const p = combatManager.getParticipant(id);
      if (!p) continue;
      // All combatants reveal fog (player, allies, and enemies are all visible in combat)
      observers.push({ position: placement.position, range: 30 });
    }
    activeGameScreen.updateCombatFog(observers);
  }

  /** Refresh the combat action button bar based on current available actions. */
  function updateCombatActionButtons(): void {
    if (!activeGameScreen || !combatController.isActive()) return;
    const actions = combatController.getAvailableActions();
    if (!actions) return;

    const hasTargets = actions.validAttackTargets.length > 0;
    const hasSpells = actions.validSpells.length > 0;
    // Bonus action spells are castable even if action is used
    const hasBonusSpells = actions.validSpells.some(s => {
      const spell = getSpell(s.spellId);
      return spell?.castingTime === '1 bonus action';
    });
    const spellEnabled = (actions.canAction && hasSpells) || (actions.canBonusAction && hasBonusSpells);

    // Standard action buttons
    const standardButtons = [
      { label: 'Attack', key: 'a', group: 'actions', enabled: actions.canAction && hasTargets, isBonusAction: false, onClick: () => {
        engine.events.emit({ type: 'input:combat_attack', category: 'ui', data: {} });
      }},
      { label: 'Cast', key: 's', group: 'actions', enabled: spellEnabled, isBonusAction: false, onClick: () => {
        engine.events.emit({ type: 'input:combat_cast_spell', category: 'ui', data: {} });
      }},
      { label: 'Dash', key: 'd', group: 'actions', enabled: actions.canAction, isBonusAction: false, onClick: () => {
        engine.events.emit({ type: 'input:combat_dash', category: 'ui', data: {} });
      }},
      { label: 'Dodge', key: 'o', group: 'actions', enabled: actions.canAction, isBonusAction: false, onClick: () => {
        engine.events.emit({ type: 'input:combat_dodge', category: 'ui', data: {} });
      }},
      { label: 'Disengage', key: 'g', group: 'actions', enabled: actions.canAction, isBonusAction: false, onClick: () => {
        engine.events.emit({ type: 'input:combat_disengage', category: 'ui', data: {} });
      }},
    ];

    // Class-feature bonus action buttons (dynamic per class)
    const bonusButtons = actions.validBonusActions.map((ba, i) => ({
      label: ba.name,
      key: String(i + 1),
      group: 'bonus',
      enabled: ba.enabled && actions.canBonusAction,
      isBonusAction: true,
      onClick: () => {
        engine.events.emit({ type: 'input:combat_bonus_action', category: 'ui', data: { bonusActionId: ba.id } });
      },
    }));

    // Action Surge button (free action — not a bonus action, styled distinctly)
    const surgeButtons: { label: string; key: string; group: string; enabled: boolean; isBonusAction: boolean; onClick: () => void }[] = [];
    if (actions.actionSurgeAvailable) {
      surgeButtons.push({
        label: 'Action Surge', key: 'x', group: 'surge', enabled: true, isBonusAction: false, onClick: () => {
          engine.events.emit({ type: 'input:combat_action_surge', category: 'ui', data: {} });
        },
      });
    }

    // End turn always last
    const endButton = {
      label: 'End Turn', key: 'e', group: 'end', enabled: true, isBonusAction: false, onClick: () => {
        engine.events.emit({ type: 'input:combat_end_turn', category: 'ui', data: {} });
      },
    };

    activeGameScreen.setCombatActions([...standardButtons, ...surgeButtons, ...bonusButtons, endButton]);

    // Update HUD turn state
    const hud = activeGameScreen.getCombatHUD();
    if (hud) {
      hud.setTurnState({
        canMove: actions.canMove,
        canAction: actions.canAction,
        canBonusAction: actions.canBonusAction,
        remainingMovement: actions.remainingMovement,
        maxMovement: 30, // approximate
      });
    }

    // Update grid highlights
    const gridPanel = activeGameScreen.getGridPanel();
    gridPanel.clearHighlights();
    if (actions.canMove && actions.validMoveCells.size > 0) {
      gridPanel.highlightMovement(actions.validMoveCells);
    }
    if (actions.canAction && hasTargets) {
      const grid = combatManager.getGrid();
      if (grid) {
        const targetPositions = actions.validAttackTargets
          .map((id) => grid.getEntityPosition(id))
          .filter((p): p is Coordinate => p !== null);
        gridPanel.highlightAttack(targetPositions);
      }
    }
  }

  // Global UI refresh: any game event refreshes the character panel & time display.
  // This eliminates the need for per-event setCharacter/updateTime calls.
  engine.events.on('*', () => {
    if (!activeGameScreen) return;
    const character = engine.entities.getAll<Character>('character')[0];
    if (character) activeGameScreen.setCharacter(character);
    if (activeGameState) activeGameScreen.updateTime(activeGameState.world.time);
    explorationController.refreshVision();
  }, 100); // low priority — runs after specific handlers

  engine.events.on('exploration:entered', () => {
    if (!activeGameScreen) return;
    activeGameScreen.addNarrative({
      text: 'You take in your surroundings, eyes adjusting to the light. The world stretches out before you.',
      category: 'description',
    });
  });

  // ── NPC Interaction — bump into an NPC entity on the exploration grid ──
  let activeShopScreen: ShopScreen | null = null;

  engine.events.on('exploration:bump_entity', (event) => {
    if (!activeGameScreen || !activeGameState) return;
    const { entityId } = event.data as { entityId: string; position: Coordinate };
    const npc = activeGameState.getNPC(entityId);
    if (!npc) return;

    // Get interaction options for this NPC
    const options = NPCInteraction.getInteractionOptions(npc);
    if (options.length === 0) return;

    // Single option — execute immediately
    if (options.length === 1) {
      handleNPCInteraction(npc, options[0].action);
      return;
    }

    // Multiple options — show picker modal
    const greetEl = el('div');
    const greetP = el('p', { class: 'font-body', style: 'margin-bottom:var(--space-md);opacity:0.7' });
    greetP.textContent = getRoleGreeting(npc.role);
    greetEl.appendChild(greetP);
    const modal = new Modal(document.getElementById('app') ?? document.body, engine, {
      title: npc.name,
      content: greetEl,
      actions: options.map(opt => ({
        label: `[${opt.key.toUpperCase()}] ${opt.label}`,
        onClick: () => {
          modal.close();
          handleNPCInteraction(npc, opt.action);
        },
      })),
    });
    modal.mount();
  });

  function getRoleGreeting(role: string): string {
    switch (role) {
      case 'innkeeper': return '"Welcome, weary traveler! Can I interest you in a warm meal or a soft bed?"';
      case 'merchant': return '"Ah, a customer! I have the finest wares in the region. Come, browse at your leisure."';
      case 'blacksmith': return '"The forge burns hot today. Looking for something sturdy? I\'ve blades and armor aplenty."';
      case 'priest': return '"Blessings upon you, friend. The light watches over all who seek solace here."';
      case 'guard': return '"Move along, citizen. Unless you have business with the watch."';
      case 'noble': return '"Hmm? Yes? Make it quick, I have affairs to attend to."';
      default: return '"Good day to you, stranger."';
    }
  }

  function handleNPCInteraction(npc: NPC, action: string): void {
    if (!activeGameScreen || !activeGameState) return;
    const character = engine.entities.getAll<Character>('character')[0];
    if (!character) return;

    switch (action) {
      case 'shop': {
        if (!npc.merchantInventory) {
          activeGameScreen.addNarrative({
            text: `${npc.name} has nothing to sell at the moment.`,
            category: 'system',
          });
          return;
        }
        // Open the shop screen
        activeShopScreen = new ShopScreen(
          document.getElementById('app')!,
          engine,
        );
        activeShopScreen.mount();
        activeShopScreen.setShopData(npc, character.inventory);
        keyboardInput.setContext('menu'); // Disable exploration input while shopping
        break;
      }
      case 'talk': {
        const dialogues = getNPCDialogue(npc);
        const line = dialogues[Math.floor(Math.random() * dialogues.length)];
        activeGameScreen.addNarrative({
          text: `**${npc.name}**: "${line}"`,
          category: 'dialogue',
        });
        break;
      }
      case 'rest': {
        // Innkeeper rest — long rest
        activeGameScreen.addNarrative({
          text: `${npc.name} leads you to a small but clean room upstairs. You settle into the straw mattress and drift into a deep, restorative sleep.`,
          category: 'action',
        });
        // Advance time by 8 hours via proper method
        if (activeGameState) {
          activeGameState.advanceTime(8 * 600);
        }
        // Heal to full, restore features
        character.currentHp = character.maxHp;
        character.hitDice.current = Math.min(
          character.hitDice.max,
          character.hitDice.current + Math.max(1, Math.floor(character.hitDice.max / 2)),
        );
        for (const feat of character.features) {
          if (feat.usesMax !== undefined) {
            feat.usesRemaining = feat.usesMax;
          }
        }
        // Restore spell slots
        if (character.spellcasting) {
          for (const level in character.spellcasting.spellSlots) {
            const slot = character.spellcasting.spellSlots[Number(level)];
            if (slot) slot.current = slot.max;
          }
        }
        // Reset survival fatigue
        if (character.survival) {
          character.survival.fatigue = 0;
          character.survival.exhaustionLevel = SurvivalRules.calculateExhaustion(character.survival);
        }
        activeGameScreen.addNarrative({
          text: 'You wake refreshed after a full night\'s rest. Your wounds have mended, and your strength is restored.',
          category: 'description',
        });
        // Refresh player HUD
        {
          const pos = explorationController.getGrid()?.getEntityPosition(character.id);
          if (pos) {
            activeGameScreen.updatePlayerEntity(character.id, pos, {
              name: character.name, color: '#2a2520', symbol: '@',
              hp: character.currentHp, maxHp: character.maxHp,
              isPlayer: true, isAlly: false, size: 1,
              conditions: character.conditions.map(c => c.type),
              spriteId: character.class,
            });
          }
        }
        break;
      }
      case 'heal': {
        // Priest healing — restore HP
        if (character.currentHp >= character.maxHp) {
          activeGameScreen.addNarrative({
            text: `${npc.name} looks you over and smiles. "You seem in fine health, friend. The light's blessing is already upon you."`,
            category: 'dialogue',
          });
          return;
        }
        const healAmount = Math.min(
          character.maxHp - character.currentHp,
          Math.floor(character.maxHp * 0.5),
        );
        character.currentHp += healAmount;
        activeGameScreen.addNarrative({
          text: `${npc.name} places warm hands upon your wounds. A soft golden light suffuses your body as flesh knits and bruises fade. You are healed for **${healAmount} HP**.`,
          category: 'action',
        });
        // Refresh player HUD
        {
          const pos = explorationController.getGrid()?.getEntityPosition(character.id);
          if (pos) {
            activeGameScreen.updatePlayerEntity(character.id, pos, {
              name: character.name, color: '#2a2520', symbol: '@',
              hp: character.currentHp, maxHp: character.maxHp,
              isPlayer: true, isAlly: false, size: 1,
              conditions: character.conditions.map(c => c.type),
              spriteId: character.class,
            });
          }
        }
        break;
      }
    }
  }

  function getNPCDialogue(npc: NPC): string[] {
    switch (npc.role) {
      case 'innkeeper': return [
        'The road\'s been quiet lately. Too quiet, if you ask me.',
        'Try the stew — it\'s my grandmother\'s recipe. Secret ingredient? Don\'t ask.',
        'We had adventurers through here last tenday. Left quite a mess, they did.',
        'If you\'re looking for trouble, head east. If you\'re running from it, you\'re in the right place.',
      ];
      case 'merchant': return [
        'Business has been slow, but I\'ve got quality goods. Have a look!',
        'I source my wares from all across the realm. Only the finest for my customers.',
        'Careful on the roads — bandits have been getting bolder.',
        'I can offer you a fair price on anything you\'ve looted. I mean, acquired.',
      ];
      case 'blacksmith': return [
        'I can put an edge on that blade that\'ll split a hair. Interested?',
        'Good steel\'s hard to come by these days. Everything I forge is the real thing.',
        'Had a soldier come through wanting dragon-scale armor. Told him to bring the scales first.',
        'The forge doesn\'t sleep and neither do I. Well, almost.',
      ];
      case 'priest': return [
        'The light guides all who seek its warmth. Even in the darkest places.',
        'I sense weariness in you, traveler. Rest here and let your burdens ease.',
        'Dark omens have troubled my meditations of late. Be careful out there.',
        'A prayer costs nothing and may save everything.',
      ];
      case 'guard': return [
        'Keep your weapons sheathed within the walls, adventurer.',
        'We\'ve had reports of monsters in the surrounding lands. Stay vigilant.',
        'I stand watch so others may sleep in peace. It\'s honest work.',
        'If you see anything suspicious, report it to the captain.',
      ];
      case 'noble': return [
        'This settlement was founded by my ancestors, you know. A proud lineage.',
        'I\'ve no time for idle chatter. Speak your business.',
        'The common folk need strong leadership. That is our burden to bear.',
      ];
      default: return [
        'Nice weather we\'re having, isn\'t it?',
        'Just going about my day. Nothing exciting, but that\'s how I like it.',
        'You look like an adventurer. Be careful out there.',
        'Have you tried the tavern? Best ale in three villages.',
      ];
    }
  }

  // Close shop screen when event fires
  engine.events.on('npc:shop_close', () => {
    if (activeShopScreen) {
      activeShopScreen.unmount();
      activeShopScreen = null;
      keyboardInput.setContext('exploration');
    }
  });

  // Handle inventory/character screen navigation via keyboard
  engine.events.on('input:inventory', () => {
    engine.events.emit({
      type: 'ui:navigate',
      category: 'ui',
      data: { screen: 'inventory', direction: 'up' },
    });
  });

  engine.events.on('input:character', () => {
    engine.events.emit({
      type: 'ui:navigate',
      category: 'ui',
      data: { screen: 'character', direction: 'up' },
    });
  });

  engine.events.on('input:help', () => {
    showContextHelp();
  });

  engine.events.on('input:worldmap', () => {
    if (!activeGameScreen) return;
    keyboardInput.pushContext('worldmap');
    activeGameScreen.showWorldMap();
  });

  // World map cursor movement and travel
  engine.events.on('input:map_cursor', (event) => {
    if (!activeGameScreen) return;
    const { dx, dy } = event.data as { dx: number; dy: number };
    activeGameScreen.moveMapCursor(dx, dy);
  });

  engine.events.on('input:map_travel', () => {
    if (!activeGameScreen) return;
    activeGameScreen.travelToMapCursor();
  });

  engine.events.on('input:cancel', () => {
    const context = keyboardInput.getContext();

    // Look mode exit is handled by ExplorationController's input:cancel listener
    if (context === 'look') return;

    // Exploration: Escape does nothing — player stays on game screen
    if (context === 'exploration') return;

    // Close world map overlay (stays on game screen)
    if (context === 'worldmap' && activeGameScreen?.isWorldMapVisible()) {
      activeGameScreen.hideWorldMap();
      keyboardInput.popContext();
      return;
    }
    // Return to game from sub-screens
    if (context === 'character' || context === 'inventory') {
      engine.events.emit({
        type: 'ui:navigate',
        category: 'ui',
        data: { screen: 'game', direction: 'down' },
      });
      // Context reset happens via ui:screen:changed
      return;
    }
  });

  // ── Look Mode ──
  engine.events.on('exploration:look_enter', (event) => {
    if (!activeGameScreen) return;
    keyboardInput.pushContext('look');
    const { position } = event.data as { position: { x: number; y: number } };
    activeGameScreen.getGridPanel().setLookCursor(position);
  });

  engine.events.on('exploration:look_move', (event) => {
    if (!activeGameScreen) return;
    const { position } = event.data as { position: { x: number; y: number } };
    activeGameScreen.getGridPanel().setLookCursor(position);
  });

  engine.events.on('exploration:look_exit', () => {
    if (!activeGameScreen) return;
    activeGameScreen.getGridPanel().setLookCursor(null);
    if (keyboardInput.getContext() === 'look') {
      keyboardInput.popContext();
    }
  });

  // ── Rest Menu ──
  engine.events.on('input:rest', () => {
    if (!activeGameScreen || !activeGameState || !activeDice) return;
    openRestMenu(engine, activeGameState, activeGameScreen, activeDice, saveManager, keyboardInput, explorationController, levelUpRules);
  });

  // ── Torch depletion — tick down equipped torch charges as time passes ──
  const ROUNDS_PER_TORCH_CHARGE = 100; // 10 minutes per charge, 6 charges = 1 hour
  let torchRoundAccumulator = 0;

  engine.events.on('time:advanced', (event) => {
    const { rounds } = event.data as { rounds: number };
    const character = engine.entities.getAll<Character>('character')[0];
    if (!character) return;

    // Only tick if a torch is equipped in offHand
    if (character.equipment.offHand !== 'item_torch') {
      torchRoundAccumulator = 0;
      return;
    }

    torchRoundAccumulator += rounds;

    // Deplete charges
    while (torchRoundAccumulator >= ROUNDS_PER_TORCH_CHARGE) {
      torchRoundAccumulator -= ROUNDS_PER_TORCH_CHARGE;
      const charges = (character.equipmentCharges.offHand ?? 0) - 1;
      character.equipmentCharges.offHand = Math.max(0, charges);

      if (charges <= 0) {
        // Torch is spent — unequip and replace with spent torch
        character.equipment.offHand = null;
        delete character.equipmentCharges.offHand;
        torchRoundAccumulator = 0;

        // Add spent torch to inventory
        const spentEntry = character.inventory.items.find(e => e.itemId === 'item_torch_spent');
        if (spentEntry) {
          spentEntry.quantity += 1;
        } else {
          character.inventory.items.push({ itemId: 'item_torch_spent', quantity: 1 });
        }

        if (activeGameScreen) {
          activeGameScreen.addNarrative({
            text: 'Your torch sputters and dies, the last ember winking out. Darkness rushes in like a held breath finally released. You pocket the charred remnant.',
            category: 'description',
          });
          activeGameScreen.setCharacter(character);
        }
        break;
      } else if (charges === 1 && activeGameScreen) {
        activeGameScreen.addNarrative({
          text: 'The torch gutters low, its flame reduced to a trembling nub. It will not last much longer.',
          category: 'description',
        });
      } else if (charges === 2 && activeGameScreen) {
        activeGameScreen.addNarrative({
          text: 'The torch burns shorter, its light dimming perceptibly.',
          category: 'description',
        });
      }
    }

  });

  // Handle travel from overworld map (tile-based)
  engine.events.on('overworld:travel', (event) => {
    const { x, y } = event.data as { x: number; y: number };
    if (!activeGameScreen || !activeGameState || !activeOverworld) return;

    const tile = activeOverworld.tiles[y][x];
    if (!isTraversable(tile.terrain)) return;

    // Gate travel: player must be able to see the map edge in the travel direction
    const curPos = activeGameState.overworldPosition;
    if (curPos) {
      const dx = x - curPos.x;
      const dy = y - curPos.y;
      if (!explorationController.canSeeMapEdge(dx, dy)) {
        const dirName = getDirectionName(dx, dy);
        activeGameScreen.addNarrative({
          text: `You cannot leave to the ${dirName} yet — the party must reach the ${dirName}ern edge of the map first.`,
          category: 'action',
        });
        activeGameScreen.hideWorldMap();
        if (keyboardInput.getContext() === 'worldmap') {
          keyboardInput.popContext();
        }
        return;
      }
    }

    // Get or create a Location for this tile
    const rng = activeRng ?? new SeededRNG(Date.now());
    const { location: dest, npcs: tileNPCs } = getOrCreateTileLocation(
      activeOverworld, x, y, activeGameState.world, rng,
    );
    if (tileNPCs.length > 0) activeGameState.registerNPCs(tileNPCs);

    dest.discovered = true;
    activeGameState.currentLocationId = dest.id;
    activeGameState.currentSubLocationId = null;
    activeGameState.overworldPosition = { x, y };

    // Travel takes 1-2 hours per tile
    const travelRounds = ROUNDS_PER_HOUR * (1 + Math.floor(Math.random() * 2));
    const travelHours = Math.round(travelRounds / ROUNDS_PER_HOUR);
    const timeBefore = { totalRounds: activeGameState.world.time.totalRounds };
    activeGameState.advanceTime(travelRounds);

    // Travel narrative
    const tileName = tile.settlement && tile.settlementName
      ? tile.settlementName
      : getTerrainName(tile.terrain);
    activeGameScreen.addNarrative({
      text: `You set out across the ${getTerrainName(tile.terrain).toLowerCase()}. The trek to ${tileName} takes ${travelHours} hour${travelHours > 1 ? 's' : ''} of travel.`,
      category: 'action',
    });

    // Time transition narrative
    const transition = TimeNarrator.describeTimeTransition(timeBefore, activeGameState.world.time);
    if (transition) {
      activeGameScreen.addNarrative({ text: transition, category: 'description' });
    }

    // Tick survival
    const character = engine.entities.getAll<Character>('character')[0];
    if (character) {
      tickAndNarrate(character, travelRounds);
    }

    activeGameScreen.addNarrative(narrator.describeLocation(dest));

    // Generate or restore local map for destination
    let gridDef: import('@/types').GridDefinition;
    let playerStart: import('@/types').Coordinate;
    const fog = new FogOfWar();

    if (dest.localMap) {
      if (dest.localMap.grid) {
        // Old save format
        gridDef = dest.localMap.grid;
      } else {
        // Delta format: regenerate + apply mods
        const base = regenerateBaseGrid(activeOverworld, x, y, dest.locationType, getTerrainBiome(tile.terrain), activeUniverse);
        gridDef = base.grid;
        applyGridMods(gridDef, dest.localMap.modifications ?? []);
      }
      playerStart = dest.localMap.playerStart;
      if (dest.localMap.exploredCells.length > 0) {
        fog.setState({ explored: new Set(dest.localMap.exploredCells), visible: new Set() });
      }
    } else {
      // First visit — generate from deterministic seed
      // Compute entry direction from travel vector
      const entryDir = curPos ? { dx: x - curPos.x, dy: y - curPos.y } : { dx: 0, dy: 0 };
      const base = regenerateBaseGrid(activeOverworld, x, y, dest.locationType, getTerrainBiome(tile.terrain), activeUniverse, entryDir);
      gridDef = base.grid;
      playerStart = base.playerStart;
      dest.localMap = { playerStart, exploredCells: [], modifications: [] };
    }

    // Mark destination as visited and run world decay on travel
    markLocationVisited(dest, activeGameState.world.time);
    const decay = processWorldDecay(activeGameState.world, activeGameState.world.time);
    if (decay.reset.length > 0 || decay.trimmed.length > 0) {
      console.log(`[World Decay] Reset: ${decay.reset.length}, Trimmed: ${decay.trimmed.length}, ~${Math.round(decay.estimatedBytesSaved / 1024)} KB freed`);
    }

    const grid = new Grid(gridDef);

    // Clear saved position when traveling (new location = new start)
    if (character) character.position = null;

    // Re-enter exploration
    const travelLighting = getLightingForLocation(dest.locationType);
    explorationController.enterSpace(
      grid, fog, character?.id ?? activeGameState.playerCharacterId, playerStart,
      character?.speed ?? 30, travelLighting,
    );

    activeGameScreen.enterLocalMode(grid, fog);
    activeGameScreen.centerGrid(playerStart);

    if (character) {
      activeGameScreen.updatePlayerEntity(character.id, playerStart, {
        name: character.name,
        color: '#2a2520',
        symbol: '@',
        hp: character.currentHp,
        maxHp: character.maxHp,
        isPlayer: true,
        isAlly: false,
        size: 1,
        conditions: character.conditions.map(c => c.type),
        spriteId: character.class,
      });
      activeGameScreen.setCharacter(character);
    }

    // Update location name, time, and map
    activeGameScreen.setLocationName(tileName);
    activeGameScreen.updateTime(activeGameState.world.time);
    activeGameScreen.setOverworldPosition(x, y);

    // Close world map and restore keyboard context
    activeGameScreen.hideWorldMap();
    if (keyboardInput.getContext() === 'worldmap') {
      keyboardInput.popContext();
    }
  });

  // 9b. Fast travel — multi-tile overworld journey with animation
  let fastTravelCancelled = false;

  // ── Interaction picker — when multiple interactables are nearby ──
  engine.events.on('exploration:interact_picker', (event) => {
    if (!activeGameScreen) return;
    const { options, onSelect } = event.data as {
      options: { key: string; label: string; icon: string }[];
      onSelect: (key: string) => void;
    };

    const list = el('div', { class: 'interact-picker' });

    for (let idx = 0; idx < options.length; idx++) {
      const opt = options[idx];
      const btn = el('button', { class: 'interact-picker-option' });
      btn.style.animationDelay = `${idx * 60}ms`;

      btn.appendChild(el('span', { class: 'interact-picker-icon' }, [opt.icon]));
      btn.appendChild(el('span', { class: 'interact-picker-label' }, [opt.label]));
      btn.appendChild(el('span', { class: 'interact-picker-arrow' }, ['\u203A']));

      btn.addEventListener('click', () => {
        modal.close();
        onSelect(opt.key);
      });
      list.appendChild(btn);
    }

    const modal = new Modal(document.body, engine, {
      title: 'Interact',
      content: list,
      closable: true,
      width: '340px',
    });
    modal.mount();
  });

  // ── Forage menu — shows available actions ──
  engine.events.on('forage:menu', (event) => {
    if (!activeGameScreen) return;
    const { options } = event.data as { options: ForageOption[] };

    const list = el('div', { class: 'forage-menu' });

    for (let idx = 0; idx < options.length; idx++) {
      const opt = options[idx];
      const skill = ForageRules.getSkillForAction(opt.action);
      const skillLabel = skill === 'nature' ? 'Nature' : 'Survival';

      // Card wrapper
      const card = el('button', { class: `forage-card forage-card--${opt.action}` });
      card.style.animationDelay = `${idx * 80}ms`;

      // SVG icon
      const iconWrap = el('div', { class: 'forage-card-icon' });
      iconWrap.innerHTML = FORAGE_ICONS[opt.action] ?? FORAGE_ICONS['forage'];
      card.appendChild(iconWrap);

      // Text content
      const textBlock = el('div', { class: 'forage-card-text' });
      const titleRow = el('div', { class: 'forage-card-title-row' });
      titleRow.appendChild(el('span', { class: 'forage-card-name font-heading' }, [opt.label]));
      if (skillLabel) {
        const badge = el('span', {
          class: `forage-card-badge forage-card-badge--${skill}`,
        }, [skillLabel]);
        titleRow.appendChild(badge);
      }
      textBlock.appendChild(titleRow);

      // Clean description — remove duplicate skill name since we show badge
      const cleanDesc = opt.description.replace(/\s*\((?:Nature|Survival)\)\s*$/i, '');
      textBlock.appendChild(el('div', { class: 'forage-card-desc' }, [cleanDesc]));

      card.appendChild(textBlock);

      // Hover arrow
      const arrow = el('div', { class: 'forage-card-arrow' }, ['\u203A']);
      card.appendChild(arrow);

      card.addEventListener('click', () => {
        modal.close();
        explorationController.executeForageAction(opt);
      });
      list.appendChild(card);
    }

    const modal = new Modal(document.body, engine, {
      title: 'Survival Actions',
      content: list,
      closable: true,
      width: '460px',
    });
    modal.mount();
  });

  // ── Forage duration picker — choose how many hours to spend ──
  engine.events.on('forage:pick_duration', (event) => {
    if (!activeGameScreen || !activeGameState) return;
    const { option, biome } = event.data as {
      option: ForageOption;
      biome: import('@/types/world').BiomeType;
    };

    const skill = ForageRules.getSkillForAction(option.action);
    const skillLabel = skill === 'nature' ? 'Nature' : 'Survival';
    const dc = ForageRules.getBaseDC(option.action, biome);

    const content = el('div', { class: 'forage-duration-picker' });
    content.appendChild(el('div', { class: 'forage-duration-info font-mono', style: 'margin-bottom: 12px; color: var(--text-muted);' }, [
      `${skillLabel} check \u2022 DC ${dc} \u2022 Roll each hour`,
    ]));
    content.appendChild(el('div', { class: 'font-mono', style: 'margin-bottom: 12px; font-size: 11px; color: var(--text-dim);' }, [
      'How many hours will you spend?',
    ]));

    const btnRow = el('div', { style: 'display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;' });
    for (const hours of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const btn = el('button', { class: 'btn btn-ghost', style: 'min-width: 48px;' }, [`${hours}h`]);
      btn.addEventListener('click', () => {
        modal.close();
        const plan = ForageRules.createPlan(option, hours, biome);
        startTimedForage(plan);
      });
      btnRow.appendChild(btn);
    }
    content.appendChild(btnRow);

    const modal = new Modal(document.body, engine, {
      title: `${option.label} — Duration`,
      content,
      closable: true,
      width: '400px',
    });
    modal.mount();
  });

  // ── Timed forage execution — hourly skill checks with TimeActivity overlay ──
  async function startTimedForage(plan: ForagePlan): Promise<void> {
    if (!activeGameScreen || !activeGameState) return;
    const character = engine.entities.getAll<Character>('character')[0];
    if (!character) return;

    const skillLabel = plan.skill === 'nature' ? 'Nature' : 'Survival';

    const activity = new TimeActivity(document.body, engine, {
      title: plan.label,
      totalHours: plan.hoursPlanned,
      startTime: { totalRounds: activeGameState.world.time.totalRounds },
      skillName: skillLabel,
      dc: plan.baseDC,
    });
    activity.mount();
    activity.initTime(activeGameState.world.time);

    // Disable keyboard input during activity
    keyboardInput.setEnabled(false);

    const rng = activeRng ?? new SeededRNG(Date.now());
    const dice = new DiceRoller(rng);
    const checks = new AbilityChecks(dice);
    const allItems = new Map<string, number>();

    for (let h = 0; h < plan.hoursPlanned; h++) {
      if (activity.isCancelled()) break;

      activity.setHourLabel(h);

      // Advance time by 1 hour
      activeGameState.advanceTime(ROUNDS_PER_HOUR);
      tickAndNarrate(character, ROUNDS_PER_HOUR);

      // Auto-consume supplies mid-activity
      autoConsumeSupplies(character);

      // Check vitals — warn at critical levels (but don't abort)
      const surv = character.survival;
      if (surv.hunger >= 76 || surv.thirst >= 76 || surv.fatigue >= 76) {
        const reasons: string[] = [];
        if (surv.hunger >= 76) reasons.push('starvation');
        if (surv.thirst >= 76) reasons.push('dehydration');
        if (surv.fatigue >= 76) reasons.push('exhaustion');
        activity.addDangerRow(`${reasons.join(' and ')} wracks your body — you push on through sheer will.`);
      } else if (surv.hunger >= 61 || surv.thirst >= 61 || surv.fatigue >= 61) {
        const warnings: string[] = [];
        if (surv.hunger >= 61) warnings.push('hunger gnaws');
        if (surv.thirst >= 61) warnings.push('thirst burns');
        if (surv.fatigue >= 61) warnings.push('exhaustion sets in');
        activity.addWarningRow(`${warnings.join(', ')} — consider stopping early.`);
      }

      // Animate sun arc (over ~500ms of the 1.5s budget)
      await activity.animateSunTo(activeGameState.world.time, 500);

      // Resolve this hour's skill check
      const hourResult = ForageRules.resolveHour(plan, h, character, checks);

      // Show dice animation
      await activity.showDiceRoll(hourResult);

      // Display result row
      activity.addResultRow(hourResult);

      // Accumulate items
      if (hourResult.success && hourResult.itemId) {
        allItems.set(hourResult.itemId, (allItems.get(hourResult.itemId) ?? 0) + hourResult.quantity);
      }
      activity.updateTotal(allItems);

      // Update game screen time
      activeGameScreen.updateTime(activeGameState.world.time);

      // Brief delay between hours (fills remaining 1.5s budget)
      await new Promise(r => setTimeout(r, 200));
    }

    // Add items to inventory
    for (const [itemId, qty] of allItems) {
      const existing = character.inventory.items.find(e => e.itemId === itemId);
      if (existing) {
        existing.quantity += qty;
      } else {
        character.inventory.items.push({ itemId: itemId, quantity: qty });
      }
    }

    // Show completion state
    activity.showComplete(allItems);

    // Build summary narrative for main log
    if (allItems.size > 0) {
      const parts: string[] = [];
      for (const [itemId, qty] of allItems) {
        const itemDef = getItem(itemId);
        parts.push(`${qty}\u00d7 ${itemDef?.name ?? itemId}`);
      }
      activeGameScreen.addNarrative({
        text: `After ${plan.hoursPlanned} hours of ${plan.label.toLowerCase()}, the party gathered: ${parts.join(', ')}.`,
        category: 'action',
      });
    } else {
      activeGameScreen.addNarrative({
        text: `After ${plan.hoursPlanned} hours of fruitless ${plan.label.toLowerCase()}, the party returns empty-handed. The land offered nothing today.`,
        category: 'action',
        tone: 'atmospheric',
      });
    }

    // Update character panel and FOV (lighting may have changed)
    activeGameScreen.setCharacter(character);
    explorationController.refreshVision();

    // Hold for a moment, then close
    await new Promise(r => setTimeout(r, 1200));
    await activity.unmount();

    // Re-enable keyboard
    keyboardInput.setEnabled(true);
  }

  engine.events.on('input:cancel_travel', () => {
    fastTravelCancelled = true;
  });

  engine.events.on('overworld:fast_travel', async (event) => {
    const { path } = event.data as { path: Coordinate[] };
    if (!activeGameScreen || !activeGameState || !activeOverworld) return;
    if (path.length === 0) return;

    const character = engine.entities.getAll<Character>('character')[0];
    if (!character) return;

    // Warn about insufficient supplies but allow travel
    const { sufficient, range, limitingFactor } = TravelRules.canSustainJourney(character, path.length);
    if (!sufficient) {
      const factor = limitingFactor === 'food' ? 'food' : 'water';
      activeGameScreen.addNarrative({
        text: `Your ${factor} won't last the full journey — supplies cover ${range.maxTiles} of ${path.length} tiles. You press on regardless, knowing the cost may be paid in blood and suffering.`,
        category: 'system',
      });
    }

    fastTravelCancelled = false;

    // Push traveling context (only Escape works)
    keyboardInput.pushContext('traveling');

    // Keep world map visible during travel, show travel log + sun arc
    activeGameScreen.setTravelPath(path, 0);
    activeGameScreen.startTravelLog(activeGameState.world.time);

    const rng = activeRng ?? new SeededRNG(Date.now());

    for (let i = 0; i < path.length; i++) {
      if (fastTravelCancelled) {
        // Stop at current position
        activeGameScreen.addNarrative({
          text: 'The party halts their journey, making camp where they stand.',
          category: 'action',
        });
        break;
      }

      const { x, y } = path[i];
      const tile = activeOverworld.tiles[y][x];
      if (!isTraversable(tile.terrain)) break;

      // Get or create location for this tile
      const { location: dest, npcs: pathNPCs } = getOrCreateTileLocation(
        activeOverworld, x, y, activeGameState.world, rng,
      );
      if (pathNPCs.length > 0) activeGameState.registerNPCs(pathNPCs);
      dest.discovered = true;
      tile.discovered = true;

      // Update position
      activeGameState.currentLocationId = dest.id;
      activeGameState.currentSubLocationId = null;
      activeGameState.overworldPosition = { x, y };

      // Travel time: 2-4 hours per tile
      const travelRounds = ROUNDS_PER_HOUR * (2 + Math.floor(Math.random() * 3));
      const travelHours = Math.round(travelRounds / ROUNDS_PER_HOUR);
      const timeBefore = { totalRounds: activeGameState.world.time.totalRounds };
      activeGameState.advanceTime(travelRounds);

      // Tick survival
      tickAndNarrate(character, travelRounds);

      // Auto-consume food/water as needed during travel
      autoConsumeSupplies(character);

      // Per-tile journey log — every tile gets a narrative entry
      const tileName = tile.settlement && tile.settlementName
        ? tile.settlementName
        : getTerrainName(tile.terrain);

      if (i === 0) {
        activeGameScreen.addNarrative({
          text: `The party shoulders their packs and sets out. ${pickJourneyNarrative(tile.terrain, activeGameState.world.time, Math.random)}`,
          category: 'action',
        });
      } else if (tile.settlement) {
        activeGameScreen.addNarrative({
          text: `After ${travelHours} hours of hard travel, the rooftops and chimney-smoke of ${tileName} appear through the haze. The party passes through, drawing curious glances from the locals.`,
          category: 'action',
        });
      } else if (i === path.length - 1) {
        activeGameScreen.addNarrative({
          text: `The final leg of the journey stretches on for ${travelHours} grueling hours. At last, their destination comes into view — weary but intact, the party has arrived.`,
          category: 'action',
        });
      } else {
        activeGameScreen.addNarrative({
          text: pickJourneyNarrative(tile.terrain, activeGameState.world.time, Math.random),
          category: 'description',
        });
        // Occasional weather/atmosphere flavor (20% chance)
        if (Math.random() < 0.2) {
          activeGameScreen.addNarrative({
            text: WEATHER_FLAVOR[Math.floor(Math.random() * WEATHER_FLAVOR.length)],
            category: 'description',
          });
        }
      }

      // Time transition
      const transition = TimeNarrator.describeTimeTransition(timeBefore, activeGameState.world.time);
      if (transition) {
        activeGameScreen.addNarrative({ text: transition, category: 'description' });
      }

      // Update map animation + sun arc
      activeGameScreen.setOverworldPositionAnimated(x, y);
      activeGameScreen.setTravelPath(path, i + 1);
      activeGameScreen.updateTime(activeGameState.world.time);

      // Animate both sun arcs smoothly during travel
      const sunArc = activeGameScreen.getSunArc();
      if (sunArc) sunArc.animateToTime(activeGameState.world.time, 1500);
      const travelSunArc = activeGameScreen.getTravelSunArc();
      if (travelSunArc) travelSunArc.animateToTime(activeGameState.world.time, 1500);

      // Animation delay — 2 seconds per tile for immersive pacing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // ── Encounter check ──────────────────────────────────────
      const encounterResolver = new EncounterResolver(
        new Resolver(templateRegistry, rng), rng,
      );

      // Roll a d20 encounter check — show it to the player
      const encounterDice = new DiceRoller(new SeededRNG(Date.now() + i));
      const encounterDC = isDevMode() ? 1 : Math.round(20 * (1 - (0.15 + Math.min(0.3, i * 0.05))));
      const encounterRoll = encounterDice.rollD20();
      const encounterTriggered = encounterRoll.total >= encounterDC;

      // Show the encounter roll — quick toast, doesn't block the map
      const encounterRollDisplay: import('@/types').DiceRollResult = {
        ...encounterRoll,
        description: encounterTriggered
          ? `Encounter! (DC ${encounterDC})`
          : `Safe passage (DC ${encounterDC})`,
      };
      await DiceDisplay.showRollQuick(document.body, encounterRollDisplay, engine);

      if (encounterTriggered && !fastTravelCancelled) {
        const encounter = encounterResolver.generateEncounter(dest, character.level, 1);
        if (encounter) {
          // Pause travel — show ambush narrative
          const encounterDesc = (encounter.resolvedData['description'] as string) ?? 'Enemies appear!';
          activeGameScreen.addNarrative({
            text: encounterDesc,
            category: 'action',
          });

          // Brief pause after narrative before combat starts
          await new Promise(resolve => setTimeout(resolve, 800));

          // Close the world map for combat
          activeGameScreen.hideWorldMap();
          activeGameScreen.endTravelLog();
          if (keyboardInput.getContext() === 'traveling') {
            keyboardInput.popContext();
          }

          // Wait for combat to finish
          const combatResult = await new Promise<CombatResult>((resolve) => {
            const terrain = tile.terrain as OverworldTerrain;
            combatController.startEncounter(character, encounter, terrain, resolve);
          });

          if (!combatResult.victory) {
            // Player died — break out of travel.
            // Death screen transition is handled by the combat:encounter_ended modal.
            fastTravelCancelled = true;
            break;
          }

          // Resume travel — reopen map
          keyboardInput.pushContext('traveling');
          activeGameScreen.showWorldMap();
          activeGameScreen.startTravelLog(activeGameState.world.time);
          activeGameScreen.setTravelPath(path, i + 1);
        }
      }
    }

    // If travel was cancelled (defeat or user cancel), skip destination setup
    if (fastTravelCancelled) {
      activeGameScreen.endTravelLog();
      activeGameScreen.clearTravelPath();
      if (activeGameScreen.isWorldMapVisible()) activeGameScreen.hideWorldMap();
      if (keyboardInput.getContext() === 'traveling') keyboardInput.popContext();
      return;
    }

    // Final destination setup — generate local map
    const finalPos = activeGameState.overworldPosition;
    if (finalPos) {
      const { x, y } = finalPos;
      const tile = activeOverworld.tiles[y][x];
      const { location: dest, npcs: finalNPCs } = getOrCreateTileLocation(
        activeOverworld, x, y, activeGameState.world, rng,
      );
      if (finalNPCs.length > 0) activeGameState.registerNPCs(finalNPCs);

      const tileName = tile.settlement && tile.settlementName
        ? tile.settlementName
        : getTerrainName(tile.terrain);

      activeGameScreen.addNarrative(narrator.describeLocation(dest));

      // Generate or restore local map
      let gridDef: import('@/types').GridDefinition;
      let playerStart: import('@/types').Coordinate;
      const fog = new FogOfWar();

      if (dest.localMap) {
        if (dest.localMap.grid) {
          gridDef = dest.localMap.grid;
        } else {
          const base = regenerateBaseGrid(activeOverworld, x, y, dest.locationType, getTerrainBiome(tile.terrain), activeUniverse);
          gridDef = base.grid;
          applyGridMods(gridDef, dest.localMap.modifications ?? []);
        }
        playerStart = dest.localMap.playerStart;
        if (dest.localMap.exploredCells.length > 0) {
          fog.setState({ explored: new Set(dest.localMap.exploredCells), visible: new Set() });
        }
      } else {
        const base = regenerateBaseGrid(activeOverworld, x, y, dest.locationType, getTerrainBiome(tile.terrain), activeUniverse);
        gridDef = base.grid;
        playerStart = base.playerStart;
        dest.localMap = { playerStart, exploredCells: [], modifications: [] };
      }

      markLocationVisited(dest, activeGameState.world.time);
      const decay = processWorldDecay(activeGameState.world, activeGameState.world.time);
      if (decay.reset.length > 0 || decay.trimmed.length > 0) {
        console.log(`[World Decay] Reset: ${decay.reset.length}, Trimmed: ${decay.trimmed.length}, ~${Math.round(decay.estimatedBytesSaved / 1024)} KB freed`);
      }

      const grid = new Grid(gridDef);
      character.position = null;

      const stairsLighting = getLightingForLocation(dest.locationType);
      explorationController.enterSpace(
        grid, fog, character.id ?? activeGameState.playerCharacterId, playerStart,
        character.speed ?? 30, stairsLighting,
      );

      activeGameScreen.enterLocalMode(grid, fog);
      activeGameScreen.centerGrid(playerStart);
      activeGameScreen.updatePlayerEntity(character.id, playerStart, {
        name: character.name,
        color: '#2a2520',
        symbol: '@',
        hp: character.currentHp,
        maxHp: character.maxHp,
        isPlayer: true,
        isAlly: false,
        size: 1,
        conditions: character.conditions.map(c => c.type),
        spriteId: character.class,
      });
      activeGameScreen.setCharacter(character);
      activeGameScreen.setLocationName(tileName);
      activeGameScreen.updateTime(activeGameState.world.time);
      activeGameScreen.setOverworldPosition(x, y);
    }

    // Clean up
    activeGameScreen.endTravelLog();
    activeGameScreen.clearTravelPath();
    activeGameScreen.hideWorldMap();
    if (keyboardInput.getContext() === 'traveling') {
      keyboardInput.popContext();
    }
    if (keyboardInput.getContext() === 'worldmap') {
      keyboardInput.popContext();
    }
  });

  // Auto-consume food/water supplies during travel (proactive at peckish/mild_thirst)
  function autoConsumeSupplies(character: Character): void {
    if (!activeGameScreen) return;
    const inventory = character.inventory;

    // Consume food while peckish or worse (hunger >= 30)
    while (character.survival.hunger >= 30) {
      let consumed = false;
      for (let i = 0; i < inventory.items.length; i++) {
        const entry = inventory.items[i];
        const item = getItem(entry.itemId);
        if (!item || item.itemType !== 'food') continue;
        const props = item.properties as ConsumableProperties;
        if (!props?.hungerReduction) continue;

        const hungerBefore = character.survival.hunger;
        if (item.maxCharges != null) {
          const charges = entry.charges ?? item.charges ?? 0;
          if (charges <= 0) continue;
          entry.charges = charges - 1;
        } else {
          entry.quantity--;
        }
        SurvivalRules.consume(character.survival, props);
        // Rich journey log for food consumption
        const foodNarrative = TRAVEL_FOOD_NARRATIVES[Math.floor(Math.random() * TRAVEL_FOOD_NARRATIVES.length)]
          .replace('{item}', item.name.toLowerCase());
        activeGameScreen.addNarrative(
          SurvivalNarrator.describeEating(hungerBefore, character.survival.hunger, foodNarrative),
        );
        // Remove depleted stacks
        if (item.maxCharges == null && entry.quantity <= 0) {
          inventory.items.splice(i, 1);
        }
        consumed = true;
        break;
      }
      if (!consumed) break; // no food left
    }

    // Consume water while mildly thirsty or worse (thirst >= 30)
    while (character.survival.thirst >= 30) {
      let consumed = false;
      for (let i = 0; i < inventory.items.length; i++) {
        const entry = inventory.items[i];
        const item = getItem(entry.itemId);
        if (!item || item.itemType !== 'drink') continue;
        const props = item.properties as ConsumableProperties;
        if (!props?.thirstReduction) continue;

        const thirstBefore = character.survival.thirst;
        if (item.maxCharges != null) {
          const charges = entry.charges ?? item.charges ?? 0;
          if (charges <= 0) continue;
          entry.charges = charges - 1;
        } else {
          entry.quantity--;
        }
        SurvivalRules.consume(character.survival, props);
        // Rich journey log for drink consumption
        const drinkNarrative = TRAVEL_DRINK_NARRATIVES[Math.floor(Math.random() * TRAVEL_DRINK_NARRATIVES.length)]
          .replace('{item}', item.name.toLowerCase());
        activeGameScreen.addNarrative(
          SurvivalNarrator.describeDrinking(thirstBefore, character.survival.thirst, drinkNarrative),
        );
        if (item.maxCharges == null && entry.quantity <= 0) {
          inventory.items.splice(i, 1);
        }
        consumed = true;
        break;
      }
      if (!consumed) break; // no water left
    }
  }

  // 10. Wire up save management modal
  engine.events.on('ui:open_saves', () => {
    if (!activeGameState) return;
    openSaveModal(engine, saveManager, activeGameState);
  });

  // 11. Wire up quit to menu with confirmation
  engine.events.on('ui:quit_to_menu', async () => {
    if (!activeGameState) return;
    // Auto-save before showing confirmation
    await saveManager.autoSave(activeGameState, engine.entities).catch(() => {});
    const confirmed = await Modal.confirm(
      engine,
      'Your game has been auto-saved. Return to the main menu?',
      'Quit to Menu',
    );
    if (confirmed) {
      engine.events.emit({ type: 'ui:return_to_menu', category: 'ui', data: {} });
    }
  });

  // 12. Wire up continue game (load most recent save)
  engine.events.on('ui:continue_game', () => {
    saveManager
      .loadMostRecent()
      .then((result) => {
        if (!result) return;

        engine.entities.clear();
        for (const entityData of result.entities) {
          engine.entities.add(entityData as unknown as Entity);
        }
        engine.entities.getAll<Character>('character').forEach(patchCharacterCompat);
        activeGameState = result.state;

        // Ensure dice roller is available for rest/combat
        if (!activeDice) {
          const rng = new SeededRNG(Date.now());
          activeRng = rng;
          activeDice = new DiceRoller(rng);
        }

        // Reset so game screen gets re-populated with loaded data
        gamePopulated = false;

        // Auto-save is triggered on each move, no interval needed

        engine.events.emit({
          type: 'ui:navigate',
          category: 'ui',
          data: { screen: 'game', direction: 'left' },
        });
      })
      .catch((err) => console.error('Load failed:', err));
  });

  // 12b. Wire up game loaded from save modal (already on game screen)
  engine.events.on('ui:game_loaded', (event) => {
    const { state } = event.data as { state: GameState };
    activeGameState = state;
    gamePopulated = false;

    // Re-populate the game screen with loaded state
    if (activeGameScreen && activeGameState) {
      populateGameScreen(activeGameScreen, activeGameState, engine);
      gamePopulated = true;
    }
  });

  // 12c. Wire up Load Game from main menu
  engine.events.on('ui:modal:load', () => {
    openLoadModal(engine, saveManager);
  });

  // 12c-2. Wire up "Load Last Save" from death screen
  engine.events.on('ui:action:load-save', () => {
    saveManager
      .loadMostRecent()
      .then((result) => {
        if (!result) {
          // No save found — return to menu instead
          engine.events.emit({
            type: 'ui:navigate',
            category: 'ui',
            data: { screen: 'menu', direction: 'right' },
          });
          return;
        }

        engine.entities.clear();
        for (const entityData of result.entities) {
          engine.entities.add(entityData as unknown as Entity);
        }
        engine.entities.getAll<Character>('character').forEach(patchCharacterCompat);
        activeGameState = result.state;

        if (!activeDice) {
          const rng = new SeededRNG(Date.now());
          activeRng = rng;
          activeDice = new DiceRoller(rng);
        }

        gamePopulated = false;

        engine.events.emit({
          type: 'ui:navigate',
          category: 'ui',
          data: { screen: 'game', direction: 'left' },
        });
      })
      .catch((err) => console.error('Load from death screen failed:', err));
  });

  // 12d. Wire up Settings modal
  engine.events.on('ui:modal:settings', () => {
    openSettingsModal(engine, storage, (tileset) => {
      activeTileset = tileset;
      if (activeGameScreen) {
        activeGameScreen.getGridPanel().setTileset(tileset);
      }
    });
  });

  // 13. Wire up return to menu
  engine.events.on('ui:return_to_menu', () => {
    activeGameState = null;
    gamePopulated = false;
    engine.entities.clear();

    engine.events.emit({
      type: 'ui:navigate',
      category: 'ui',
      data: { screen: 'menu', direction: 'right' },
    });
  });

  // 14. Register tooltip handling on the app container
  TooltipSystem.getInstance().registerContainer(container);

  // 15. Wire "New Adventure" — route to creation if world exists, else world selection
  engine.events.on('ui:new_adventure', () => {
    if (activeOverworld) {
      engine.events.emit({
        type: 'ui:navigate',
        category: 'ui',
        data: { screen: 'creation', direction: 'left' },
      });
    } else {
      engine.events.emit({
        type: 'ui:navigate',
        category: 'ui',
        data: { screen: 'worldselection', direction: 'left' },
      });
    }
  });

  // 16. Wire world creation, export, and deletion events
  engine.events.on('world:created', async (event) => {
    const { overworld } = event.data as { overworld: OverworldData };
    activeOverworld = overworld;
    await storage.saveWorld(overworld);
    localStorage.setItem('oneparty-has-world', 'true');
    console.log(`[One Party] World "${overworld.name}" saved (${overworld.width}×${overworld.height})`);

    // Navigate directly to character creation
    engine.events.emit({
      type: 'ui:navigate',
      category: 'ui',
      data: { screen: 'creation', direction: 'left' },
    });
  });

  // Universe v2 import — stores both the universe and extracts the active overworld
  engine.events.on('universe:created', async (event) => {
    const { universe, overworld } = event.data as { universe: Universe; overworld: OverworldData };
    activeUniverse = universe;
    activeOverworld = overworld;
    await storage.saveUniverse(universe);
    await storage.saveWorld(overworld);
    localStorage.setItem('oneparty-has-world', 'true');
    console.log(`[One Party] Universe "${universe.name}" saved (${universe.planes.length} planes)`);

    engine.events.emit({
      type: 'ui:navigate',
      category: 'ui',
      data: { screen: 'creation', direction: 'left' },
    });
  });

  engine.events.on('world:export', () => {
    if (activeUniverse) {
      WorldExporter.download(activeUniverse);
    } else if (activeOverworld) {
      WorldExporter.download(activeOverworld);
    }
  });

  engine.events.on('world:delete', async () => {
    const confirmed = await Modal.confirm(
      engine,
      'This will permanently destroy the world and all saved games. Are you sure?',
      'Delete World',
    );
    if (!confirmed) return;

    await storage.deleteWorld();
    await storage.deleteUniverse();
    await storage.deleteAllSaves();
    localStorage.removeItem('oneparty-saves');
    localStorage.removeItem('oneparty-has-world');
    activeOverworld = null;
    activeUniverse = null;
    activeGameState = null;
    gamePopulated = false;
    engine.entities.clear();
    clearTileLocationCache();

    engine.events.emit({
      type: 'ui:navigate',
      category: 'ui',
      data: { screen: 'menu', direction: 'right' },
    });
  });

  // 17. Check world and saves, always show menu first
  const hasWorld = await storage.hasWorld();

  if (hasWorld) {
    activeOverworld = (await storage.loadWorld()) ?? null;
    activeUniverse = (await storage.loadUniverse()) ?? null;
    localStorage.setItem('oneparty-has-world', 'true');

    const hasSaves = await saveManager.hasSaves();
    if (hasSaves) {
      localStorage.setItem('oneparty-saves', 'true');
    } else {
      localStorage.removeItem('oneparty-saves');
    }
  } else {
    localStorage.removeItem('oneparty-saves');
    localStorage.removeItem('oneparty-has-world');
  }

  await ui.switchScreen('menu');

  // 17. Start the engine loop
  engine.start();
}

/** Patch old saves missing equipmentCharges field. */
function patchCharacterCompat(character: Character): void {
  if (!character.equipmentCharges) {
    character.equipmentCharges = {};
  }
}

/** Save management modal — list saves, create new, load, delete. */
function openSaveModal(
  engine: GameEngine,
  saveManager: SaveManager,
  gameState: GameState,
): void {
  const content = el('div', { class: 'save-modal-content' });

  // Action buttons at top
  const actions = el('div', { class: 'save-modal-actions' });
  const newSaveBtn = el('button', { class: 'btn btn-primary' }, ['New Save']);
  const quickSaveBtn = el('button', { class: 'btn btn-secondary' }, ['Quick Save']);
  actions.appendChild(newSaveBtn);
  actions.appendChild(quickSaveBtn);
  content.appendChild(actions);

  // Save list container
  const listWrap = el('div', { class: 'save-modal-list' });
  const loadingEl = el('div', { class: 'save-modal-loading font-mono' }, ['Loading saves...']);
  listWrap.appendChild(loadingEl);
  content.appendChild(listWrap);

  const modal = new Modal(document.body, engine, {
    title: 'Save Management',
    content,
    closable: true,
    width: '520px',
  });

  function formatTime(timestamp: number): string {
    const d = new Date(timestamp);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function renderSaveList(saves: SaveMeta[]): void {
    listWrap.innerHTML = '';

    if (saves.length === 0) {
      listWrap.appendChild(el('div', { class: 'save-modal-empty font-mono' }, ['No saves yet']));
      return;
    }

    for (const save of saves) {
      const row = el('div', { class: 'save-modal-row' });

      const info = el('div', { class: 'save-modal-row-info' });
      const nameEl = el('div', { class: 'save-modal-row-name font-heading' }, [save.name]);
      const detailEl = el('div', { class: 'save-modal-row-detail font-mono' }, [
        `${save.characterName} \u2022 Lvl ${save.level} \u2022 ${formatTime(save.lastSaved)}`,
      ]);
      info.appendChild(nameEl);
      info.appendChild(detailEl);
      row.appendChild(info);

      const btns = el('div', { class: 'save-modal-row-btns' });

      const loadBtn = el('button', { class: 'btn btn-secondary btn-sm' }, ['Load']);
      loadBtn.addEventListener('click', async () => {
        const result = await saveManager.loadGame(save.id);
        if (!result) return;
        engine.entities.clear();
        for (const entityData of result.entities) {
          engine.entities.add(entityData as unknown as Entity);
        }
        engine.entities.getAll<Character>('character').forEach(patchCharacterCompat);
        // Update the outer gameState reference via event
        engine.events.emit({
          type: 'ui:game_loaded',
          category: 'ui',
          data: { state: result.state },
        });
        await modal.close();
      });
      btns.appendChild(loadBtn);

      // Don't allow deleting autosave
      if (save.id !== 'autosave') {
        const delBtn = el('button', { class: 'btn btn-ghost btn-sm save-modal-delete' }, ['\u2715']);
        delBtn.title = 'Delete save';
        delBtn.addEventListener('click', async () => {
          await saveManager.deleteSave(save.id);
          const updated = await saveManager.listSaves();
          renderSaveList(updated);
        });
        btns.appendChild(delBtn);
      }

      row.appendChild(btns);
      listWrap.appendChild(row);
    }
  }

  // New save
  newSaveBtn.addEventListener('click', async () => {
    const meta = await saveManager.saveGame(gameState, engine.entities);
    console.log(`[One Party] Game saved: ${meta.name}`);
    const saves = await saveManager.listSaves();
    renderSaveList(saves);
  });

  // Quick save
  quickSaveBtn.addEventListener('click', async () => {
    await saveManager.quickSave(gameState, engine.entities);
    const saves = await saveManager.listSaves();
    renderSaveList(saves);
  });

  // Load saves and render
  saveManager.listSaves().then((saves) => {
    renderSaveList(saves);
  });

  modal.mount();
}

/** Load-only modal for the main menu (no active game state needed). */
function openLoadModal(
  engine: GameEngine,
  saveManager: SaveManager,
): void {
  const content = el('div', { class: 'save-modal-content' });
  const listWrap = el('div', { class: 'save-modal-list' });
  const loadingEl = el('div', { class: 'save-modal-loading font-mono' }, ['Loading saves...']);
  listWrap.appendChild(loadingEl);
  content.appendChild(listWrap);

  const modal = new Modal(document.body, engine, {
    title: 'Load Game',
    content,
    closable: true,
    width: '520px',
  });

  function formatTime(timestamp: number): string {
    const d = new Date(timestamp);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function renderSaveList(saves: SaveMeta[]): void {
    listWrap.innerHTML = '';

    if (saves.length === 0) {
      listWrap.appendChild(el('div', { class: 'save-modal-empty font-mono' }, ['No saves found']));
      return;
    }

    for (const save of saves) {
      const row = el('div', { class: 'save-modal-row' });
      const info = el('div', { class: 'save-modal-row-info' });
      const nameEl = el('div', { class: 'save-modal-row-name font-heading' }, [save.name]);
      const detailEl = el('div', { class: 'save-modal-row-detail font-mono' }, [
        `${save.characterName} \u2022 Lvl ${save.level} \u2022 ${formatTime(save.lastSaved)}`,
      ]);
      info.appendChild(nameEl);
      info.appendChild(detailEl);
      row.appendChild(info);

      const btns = el('div', { class: 'save-modal-row-btns' });
      const loadBtn = el('button', { class: 'btn btn-primary btn-sm' }, ['Load']);
      loadBtn.addEventListener('click', async () => {
        const result = await saveManager.loadGame(save.id);
        if (!result) return;
        engine.entities.clear();
        for (const entityData of result.entities) {
          engine.entities.add(entityData as unknown as Entity);
        }
        engine.entities.getAll<Character>('character').forEach(patchCharacterCompat);
        engine.events.emit({
          type: 'ui:game_loaded',
          category: 'ui',
          data: { state: result.state },
        });
        // Navigate to game screen
        engine.events.emit({
          type: 'ui:navigate',
          category: 'ui',
          data: { screen: 'game', direction: 'left' },
        });
        await modal.close();
      });
      btns.appendChild(loadBtn);
      row.appendChild(btns);
      listWrap.appendChild(row);
    }
  }

  saveManager.listSaves().then((saves) => renderSaveList(saves));
  modal.mount();
}

/**
 * Rest menu — short rest (spend Hit Dice) or long rest (8 hours, full recovery).
 * Follows D&D 5e PHB rules for both rest types.
 */
function openRestMenu(
  engine: GameEngine,
  gameState: GameState,
  gameScreen: GameScreen,
  dice: DiceRoller,
  saveManager: SaveManager,
  keyboardInput: KeyboardInput,
  explorationController: ExplorationController,
  levelUpRules: LevelUpRules,
): void {
  const character = engine.entities.getAll<Character>('character')[0];
  if (!character) return;

  const restRules = new RestRules(dice);
  const content = el('div', { class: 'rest-modal-content' });

  // ── Character status summary ──
  const status = el('div', { class: 'rest-status font-mono' });
  status.innerHTML = `HP: ${character.currentHp}/${character.maxHp} &bull; Hit Dice: ${character.hitDice.current}/${character.hitDice.max}d${character.hitDice.die}`;
  content.appendChild(status);

  content.appendChild(el('div', { class: 'rest-divider' }));

  // ── Short Rest ──
  const shortSection = el('div', { class: 'rest-section' });
  shortSection.appendChild(el('h4', { class: 'rest-section-title font-heading' }, ['Short Rest']));
  shortSection.appendChild(el('p', { class: 'rest-section-desc' }, [
    'Rest for 1 hour. You may spend Hit Dice to recover HP. Each die heals 1d'
    + character.hitDice.die + ' + CON modifier.',
  ]));

  // Hit Dice selector
  const hdRow = el('div', { class: 'rest-hd-row' });
  hdRow.appendChild(el('span', { class: 'rest-hd-label font-mono' }, ['Hit Dice to spend:']));
  const hdSelect = el('select', { class: 'rest-hd-select font-mono' }) as HTMLSelectElement;
  for (let i = 0; i <= character.hitDice.current; i++) {
    const opt = el('option', { value: String(i) }, [String(i)]) as HTMLOptionElement;
    if (i === Math.min(character.hitDice.current, character.currentHp < character.maxHp ? character.hitDice.current : 0)) {
      opt.selected = true;
    }
    hdSelect.appendChild(opt);
  }
  hdRow.appendChild(hdSelect);
  shortSection.appendChild(hdRow);

  const shortBtn = el('button', { class: 'btn btn-secondary rest-btn' }, ['Take Short Rest']);
  shortBtn.addEventListener('click', async () => {
    const hdToSpend = parseInt(hdSelect.value, 10);
    modal.close();

    // Launch TimeActivity overlay for 1 hour
    const activity = new TimeActivity(document.body, engine, {
      title: 'Short Rest',
      totalHours: 1,
      startTime: { totalRounds: gameState.world.time.totalRounds },
    });
    activity.mount();
    activity.initTime(gameState.world.time);
    keyboardInput.setEnabled(false);

    activity.setHourLabel(0);
    activity.addTextRow('You find a sheltered spot and settle in\u2026', '\uD83D\uDD25');

    // Advance time by 1 hour
    gameState.advanceTime(ROUNDS_PER_HOUR);
    const tickResult = SurvivalRules.tick(character.survival, ROUNDS_PER_HOUR);

    // Animate sun arc over 700ms
    await activity.animateSunTo(gameState.world.time, 700);
    await new Promise(r => setTimeout(r, 300));

    // Apply rest rules
    const result = restRules.shortRest(character, hdToSpend);

    if (result.hpHealed > 0) {
      activity.addTextRow(`Spent ${result.hitDiceUsed} Hit ${result.hitDiceUsed === 1 ? 'Die' : 'Dice'}, recovered ${result.hpHealed} HP.`, '\u2764');
    } else if (hdToSpend === 0) {
      activity.addTextRow('Rested without spending Hit Dice.', '\u23F8');
    }
    if (result.featuresRecharged.length > 0) {
      activity.addTextRow(`Recharged: ${result.featuresRecharged.join(', ')}.`, '\u26A1');
    }
    if (tickResult.hungerCrossing) {
      activity.addWarningRow(`You feel ${SurvivalRules.formatThreshold(tickResult.hungerCrossing.to)}.`);
    }
    if (tickResult.thirstCrossing) {
      activity.addWarningRow(`Your throat grows ${SurvivalRules.formatThreshold(tickResult.thirstCrossing.to)}.`);
    }

    // Summary
    activity.showCompleteText('An hour passes. You feel steadier.');
    gameScreen.setCharacter(character);
    gameScreen.updateTime(gameState.world.time);
    explorationController.refreshVision();

    // Time transition narrative
    const timeBefore = { totalRounds: gameState.world.time.totalRounds - ROUNDS_PER_HOUR };
    const transition = TimeNarrator.describeTimeTransition(timeBefore, gameState.world.time);

    // Build main log narrative
    const parts: string[] = [];
    parts.push('You settle down for a short rest, catching your breath and tending to your wounds.');
    if (result.hpHealed > 0) {
      parts.push(`You spend ${result.hitDiceUsed} Hit ${result.hitDiceUsed === 1 ? 'Die' : 'Dice'} and recover ${result.hpHealed} hit points.`);
    }
    gameScreen.addNarrative({ text: parts.join(' '), category: 'system' });
    if (transition) {
      gameScreen.addNarrative({ text: transition, category: 'description' });
    }

    saveManager.autoSave(gameState, engine.entities).catch(() => {});

    // Hold, then close
    await new Promise(r => setTimeout(r, 1200));
    await activity.unmount();
    keyboardInput.setEnabled(true);
  });
  if (character.currentHp >= character.maxHp && character.hitDice.current === 0) {
    shortBtn.setAttribute('disabled', '');
    shortBtn.title = 'No Hit Dice remaining and HP is full';
  }
  shortSection.appendChild(shortBtn);
  content.appendChild(shortSection);

  content.appendChild(el('div', { class: 'rest-divider' }));

  // ── Long Rest ──
  const longSection = el('div', { class: 'rest-section' });
  longSection.appendChild(el('h4', { class: 'rest-section-title font-heading' }, ['Long Rest']));
  longSection.appendChild(el('p', { class: 'rest-section-desc' }, [
    'Rest for 8 hours. Recover all HP, regain half your maximum Hit Dice (minimum 1), '
    + 'recover all spell slots, and reset fatigue. You must have food and water.',
  ]));

  // Check if rest conditions are met
  const hasFood = character.inventory.items.some(e => {
    const item = getItem(e.itemId);
    if (!item || item.itemType !== 'food') return false;
    return item.maxCharges != null ? (e.charges ?? item.charges ?? 0) > 0 : e.quantity > 0;
  });
  const hasWater = character.inventory.items.some(e => {
    const item = getItem(e.itemId);
    if (!item || item.itemType !== 'drink') return false;
    return item.maxCharges != null ? (e.charges ?? item.charges ?? 0) > 0 : e.quantity > 0;
  });

  const longBtn = el('button', { class: 'btn btn-primary rest-btn' }, ['Take Long Rest']);

  if (!hasFood || !hasWater) {
    const warning = el('p', { class: 'rest-warning font-mono' });
    const missing: string[] = [];
    if (!hasFood) missing.push('food');
    if (!hasWater) missing.push('water');
    warning.textContent = `You lack ${missing.join(' and ')}. Resting without provisions will increase exhaustion.`;
    longSection.appendChild(warning);
  }

  const LONG_REST_FLAVOR = [
    'You gather wood and kindle a small fire. The flames crackle softly.',
    'The bedroll is laid out. Muscles ache as you lower yourself down.',
    'Night sounds fill the air — crickets, distant owls, the whisper of wind.',
    'Sleep takes hold. Dreams drift through like smoke.',
    'You stir briefly, adjusting your cloak against the chill.',
    'Deep, dreamless sleep. The body mends what the road has broken.',
    'A pale glow touches the horizon. Dawn approaches.',
    'You rise, stiff but restored. A new day begins.',
  ];

  longBtn.addEventListener('click', async () => {
    modal.close();

    // Launch TimeActivity overlay for 8 hours
    const activity = new TimeActivity(document.body, engine, {
      title: 'Long Rest',
      totalHours: 8,
      startTime: { totalRounds: gameState.world.time.totalRounds },
    });
    activity.mount();
    activity.initTime(gameState.world.time);
    keyboardInput.setEnabled(false);

    const timeBeforeRest = { totalRounds: gameState.world.time.totalRounds };

    // Consume food + drink at the start (charge-aware)
    if (hasFood) {
      const foodIdx = character.inventory.items.findIndex(e => {
        const item = getItem(e.itemId);
        return item && item.itemType === 'food' && (item.maxCharges != null ? (e.charges ?? item.charges ?? 0) > 0 : e.quantity > 0);
      });
      if (foodIdx >= 0) {
        const foodEntry = character.inventory.items[foodIdx];
        const foodItem = getItem(foodEntry.itemId);
        if (foodItem?.maxCharges != null) {
          foodEntry.charges = (foodEntry.charges ?? foodItem.charges ?? 0) - 1;
        } else {
          foodEntry.quantity -= 1;
          if (foodEntry.quantity <= 0) {
            character.inventory.items.splice(foodIdx, 1);
          }
        }
      }
    }
    if (hasWater) {
      const waterIdx = character.inventory.items.findIndex(e => {
        const item = getItem(e.itemId);
        return item && item.itemType === 'drink' && (item.maxCharges != null ? (e.charges ?? item.charges ?? 0) > 0 : e.quantity > 0);
      });
      if (waterIdx >= 0) {
        const waterEntry = character.inventory.items[waterIdx];
        const waterItem = getItem(waterEntry.itemId);
        if (waterItem?.maxCharges != null) {
          waterEntry.charges = (waterEntry.charges ?? waterItem.charges ?? 0) - 1;
        } else {
          waterEntry.quantity -= 1;
          if (waterEntry.quantity <= 0) {
            character.inventory.items.splice(waterIdx, 1);
          }
        }
      }
    }

    // Hourly tick loop — 1 hour per second
    for (let h = 0; h < 8; h++) {
      activity.setHourLabel(h);

      // Advance time by 1 hour
      gameState.advanceTime(ROUNDS_PER_HOUR);
      const tickResult = SurvivalRules.tick(character.survival, ROUNDS_PER_HOUR);

      // Animate sun arc (500ms of the 1s budget)
      await activity.animateSunTo(gameState.world.time, 500);

      // Show flavor text for this hour
      activity.addTextRow(LONG_REST_FLAVOR[h], h === 0 ? '\uD83D\uDD25' : h === 7 ? '\u2600' : '\uD83C\uDF19');

      // Survival warnings
      if (tickResult.hungerCrossing) {
        activity.addWarningRow(`You feel ${SurvivalRules.formatThreshold(tickResult.hungerCrossing.to)}.`);
      }
      if (tickResult.thirstCrossing) {
        activity.addWarningRow(`Your throat grows ${SurvivalRules.formatThreshold(tickResult.thirstCrossing.to)}.`);
      }

      gameScreen.updateTime(gameState.world.time);

      // Remaining 500ms pause
      await new Promise(r => setTimeout(r, 500));
    }

    // Apply rest rules (full HP, hit dice, spell slots, features)
    const result = restRules.longRest(character);

    // Reset fatigue
    SurvivalRules.rest(character.survival);

    // If no food/water, add exhaustion
    if (!hasFood || !hasWater) {
      character.survival.exhaustionLevel = Math.min(6, character.survival.exhaustionLevel + 1);
    }

    // Show completion
    const summaryParts: string[] = [];
    if (result.hpHealed > 0) summaryParts.push(`+${result.hpHealed} HP`);
    if (result.hitDiceRecovered > 0) summaryParts.push(`+${result.hitDiceRecovered} Hit Dice`);
    if (result.spellSlotsRecovered) summaryParts.push('Spell slots restored');
    if (result.featuresRecharged.length > 0) summaryParts.push(result.featuresRecharged.join(', '));
    activity.showCompleteText(summaryParts.length > 0 ? `Restored: ${summaryParts.join(' \u2022 ')}` : 'You awaken feeling refreshed.');

    gameScreen.setCharacter(character);
    explorationController.refreshVision();

    // Build main log narrative
    const narrativeParts: string[] = [];
    narrativeParts.push('You make camp and settle in for a long rest. The hours pass as your body mends itself through deep, restorative sleep.');
    if (result.hpHealed > 0) {
      narrativeParts.push(`You awaken fully restored, recovering ${result.hpHealed} hit points.`);
    } else {
      narrativeParts.push('You awaken feeling refreshed.');
    }
    if (result.hitDiceRecovered > 0) {
      narrativeParts.push(`You recover ${result.hitDiceRecovered} Hit ${result.hitDiceRecovered === 1 ? 'Die' : 'Dice'}.`);
    }
    if (result.spellSlotsRecovered) {
      narrativeParts.push('Your magical reserves are fully replenished.');
    }
    if (hasFood && hasWater) {
      narrativeParts.push('You eat a meal and drink deeply before breaking camp.');
    } else {
      narrativeParts.push('Your stomach growls — you had no proper provisions. The lack of sustenance takes its toll.');
    }
    gameScreen.addNarrative({ text: narrativeParts.join(' '), category: 'system' });

    // Check for any pending level-ups (safety net in case XP was awarded but level-up was missed)
    checkAndApplyLevelUps(character, gameScreen, levelUpRules);

    const transition = TimeNarrator.describeTimeTransition(timeBeforeRest, gameState.world.time);
    if (transition) {
      gameScreen.addNarrative({ text: transition, category: 'description' });
    }

    saveManager.autoSave(gameState, engine.entities).catch(() => {});

    // Hold, then close
    await new Promise(r => setTimeout(r, 1500));
    await activity.unmount();
    keyboardInput.setEnabled(true);
  });
  longSection.appendChild(longBtn);
  content.appendChild(longSection);

  const modal = new Modal(document.body, engine, {
    title: 'Rest',
    content,
    closable: true,
    width: '480px',
  });
  modal.mount();
}

/** Settings modal — tileset selection and other options. */
function openSettingsModal(
  engine: GameEngine,
  storage: StorageEngine,
  onTilesetChange: (tileset: Tileset) => void,
): void {
  const content = el('div', { class: 'settings-modal-content' });

  // ── Tileset Section ──
  const tilesetSection = el('div', { class: 'settings-section' });
  tilesetSection.appendChild(el('h4', { class: 'settings-section-title font-heading' }, ['Map Tileset']));
  tilesetSection.appendChild(el('p', { class: 'settings-section-desc' }, [
    'Choose how the dungeon map is rendered.',
  ]));

  const tilesets = getAllTilesets();
  const tilesetList = el('div', { class: 'settings-tileset-list' });

  // Load current setting
  storage.getSetting<string>('tileset').then((currentId) => {
    const activeId = currentId ?? 'fantasy';

    for (const ts of tilesets) {
      const option = el('div', {
        class: `settings-tileset-option ${ts.id === activeId ? 'settings-tileset-option--active' : ''}`,
      });

      const info = el('div', { class: 'settings-tileset-info' });
      info.appendChild(el('span', { class: 'settings-tileset-name font-heading' }, [ts.name]));

      const desc = ts.squareCells ? 'Square cells, canvas-drawn graphics' : 'Classic monospace ASCII characters';
      info.appendChild(el('span', { class: 'settings-tileset-desc font-mono' }, [desc]));
      option.appendChild(info);

      if (ts.id === activeId) {
        option.appendChild(el('span', { class: 'settings-tileset-active font-mono' }, ['Active']));
      }

      option.addEventListener('click', async () => {
        // Update visual state
        tilesetList.querySelectorAll('.settings-tileset-option').forEach(opt => {
          opt.classList.remove('settings-tileset-option--active');
          const badge = opt.querySelector('.settings-tileset-active');
          if (badge) badge.remove();
        });
        option.classList.add('settings-tileset-option--active');
        option.appendChild(el('span', { class: 'settings-tileset-active font-mono' }, ['Active']));

        // Save and apply
        await storage.setSetting('tileset', ts.id);
        const tileset = getTilesetById(ts.id);
        onTilesetChange(tileset);
      });

      tilesetList.appendChild(option);
    }
  });

  tilesetSection.appendChild(tilesetList);
  content.appendChild(tilesetSection);

  // ── Dev Mode Section ──
  const devSection = el('div', { class: 'settings-section' });
  devSection.appendChild(el('h4', { class: 'settings-section-title font-heading' }, ['Developer']));

  const devToggle = el('label', { class: 'settings-toggle' });
  const devCheckbox = el('input', { type: 'checkbox' }) as HTMLInputElement;
  devCheckbox.checked = isDevMode();
  devCheckbox.addEventListener('change', () => {
    setDevMode(devCheckbox.checked);
  });
  devToggle.appendChild(devCheckbox);
  devToggle.appendChild(el('span', { class: 'settings-toggle-label' }, ['Dev mode']));
  devSection.appendChild(devToggle);
  devSection.appendChild(el('p', { class: 'settings-section-desc' }, [
    'Forces encounters during travel, shows debug info.',
  ]));
  content.appendChild(devSection);

  const modal = new Modal(document.body, engine, {
    title: 'Settings',
    content,
    closable: true,
    width: '480px',
  });
  modal.mount();
}

main().catch(console.error);
