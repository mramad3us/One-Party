# One Party -- Developer Guide

Solo D&D 5e browser RPG. Vanilla TypeScript, Vite, no framework. Everything runs client-side.

## Quick Start

```bash
npm install
npm run dev          # Vite dev server on :3000
npx tsc --noEmit     # Type-check (always run before committing)
npx tsx tools/build-ylem.ts  # Rebuild handcrafted Ylem world
```

## Architecture Overview

```
GameEngine (tick loop)
  -> EventBus (pub/sub, wildcard patterns like "combat:attack:*")
  -> EntityManager (all game entities by ID)
  -> UIManager (screen transitions, component lifecycle)
  -> GameState (world, location, NPCs, time)
```

**Data flow**: Events drive everything. UI emits events -> handlers in `main.ts` orchestrate logic -> rules return results -> state mutates -> UI re-renders.

## Directory Map

| Directory | Purpose |
|-----------|---------|
| `src/data/` | Static game content: classes, races, spells, items, monsters, **features registry** |
| `src/engine/` | GameEngine, EventBus, EntityManager, KeyboardInput |
| `src/grid/` | Grid data structure, Pathfinder, LineOfSight, renderers (ASCII + Fantasy tilesets) |
| `src/rules/` | Stateless rule engines: DiceRoller, CombatRules, RestRules, ForageRules, etc. |
| `src/state/` | GameState -- mutable world snapshot, serializable for save/load |
| `src/types/` | All TypeScript type definitions. No runtime code except re-exports. |
| `src/ui/` | Component base class, UIManager, screens, panels, widgets |
| `src/world/` | World/map generation: OverworldGenerator, LocalMapGenerator, POIMapGenerator |
| `src/combat/` | CombatManager, TurnManager, InitiativeTracker, CombatAI, TargetingSystem |
| `src/npc/` | NPCFactory, MerchantSystem, DispositionSystem, NPCInteraction |
| `src/storage/` | SaveManager, StorageEngine (IndexedDB), WorldExporter, Migration |
| `src/character/` | CharacterFactory, CharacterSheet display |
| `src/narrative/` | Template-based narration engine |
| `src/styles/` | CSS organized by screen (game.css, combat.css, etc.) |
| `tools/` | Build scripts (build-ylem.ts for handcrafted worlds) |

## UI System

Screens extend `Component`. Lifecycle: `createElement()` -> `mount()` -> `setupEvents()` -> `destroy()`.

- `mount()` appends to DOM and calls `setupEvents()` once
- `listen()` auto-cleans up event listeners on destroy
- `FocusNav` handles keyboard navigation (attach in `setupEvents`, detach in `destroy`)
- UIManager caches persistent screens and handles directional slide transitions

**Rule**: Never call `focusNav.attach()` in `mount()` -- call it in `setupEvents()` to prevent double-attach on remount.

## Feature Registry (src/data/features.ts)

**This is the single source of truth for all map feature properties.** Adding a new feature (furniture, terrain object, interactable) requires exactly 2 steps:

### Step 1: Add to CellFeature union

In `src/types/grid.ts`, add the string literal to the union:

```typescript
export type CellFeature =
  | 'door'
  | 'chest'
  // ...
  | 'your_new_feature';  // <-- add here
```

### Step 2: Add to FEATURES registry

In `src/data/features.ts`, add one entry:

```typescript
your_new_feature: {
  label: 'a descriptive name',           // shown in exploration text
  blocks: true,                           // impassable? (movementCost = Infinity)
  blocksLoS: false,                       // blocks line of sight?
  lightRadius: 0,                         // light emission in grid cells (0 = none)
  glowColor: [255, 160, 40],             // optional, only if lightRadius > 0
  ascii: { ch: 'X', fg: '#aabbcc', bg: '#112233' },  // ASCII tileset
  colors: { primary: [r,g,b], secondary: [r,g,b], bg: [r,g,b] },  // Fantasy tileset
  narratives: [
    'Flavor text when the player discovers this feature.',
    'A second variation for variety.',
  ],
},
```

### Step 3 (rendering only): Add pattern to FantasyTileset

In `src/grid/FantasyTileset.ts`, add a case to `renderFeature()`:

```typescript
case 'your_new_feature':
  pattern = makeYourPattern(colors.primary, colors.secondary);
  break;
```

If you skip this step, the feature will be invisible but won't crash (graceful degradation).

### What derives automatically

From the registry entry, these are auto-generated at module load:
- `FEATURE_PHYSICS` -- used by `featureCell()` in map generators
- `LIGHT_SOURCE_RADIUS` -- used by Grid.getLightSources() and GridRenderer
- `FEATURE_GLYPHS` -- used by ASCII Tileset
- `FEATURE_COLORS` -- used by Fantasy Tileset
- `FEATURE_NARRATIVES` -- used by ExplorationController
- `FEATURE_GLOW_COLORS` -- used by GridRenderer light rendering

### Placing features on maps

Always use `featureCell(terrain, [features])` instead of `makeCell()` with manual movementCost/blocksLoS. This auto-derives physics from the registry:

```typescript
// Good -- physics auto-derived
cells[y][x] = featureCell('wood', ['counter']);
cells[y][x] = featureCell('stone', ['fountain']);

// Bad -- manual physics can drift from registry
cells[y][x] = makeCell('wood', Infinity, true, ['counter']);
```

`makeCell()` is still valid for cells with no features or with explicit overrides (walls, doors that toggle state).

### build-ylem.ts (handcrafted worlds)

This standalone build tool has its own inline `FEATURE_PHYSICS` copy (it can't import from `src/`). When adding blocking features, update both:
1. `src/data/features.ts` (canonical)
2. `tools/build-ylem.ts` FEATURE_PHYSICS (inline copy)

Use `m.feature(x, y, 'feature_name')` to place features -- it auto-derives physics from the inline lookup.

## Map Generation

Three generators, all producing `GridDefinition` (cells[y][x]):

| Generator | Use case | Size |
|-----------|----------|------|
| `LocalMapGenerator` | Settlement interiors (villages, towns) | 60-200 tiles |
| `POIMapGenerator` | Points of interest (caves, ruins, camps) | 200x200 |
| `CombatMapGenerator` | Throwaway combat encounter maps | 20-30 tiles |

Handcrafted worlds (like Ylem) use `tools/build-ylem.ts` with a `MapBuilder` helper class.

## D&D 5e Rules

Rules live in `src/rules/` as stateless classes/functions:
- `DiceRoller` -- requires `SeededRNG` for determinism
- `CombatRules` -- attack rolls, damage, saving throws, death saves
- `RestRules` -- short rest (hit dice + con mod), long rest (full HP, half dice, all slots)
- `ForageRules` -- survival/nature checks with DC by terrain
- `CurrencyRules` -- canAfford/deduct for copper-based economy

**Important**: Rest mechanics use `ROUNDS_PER_DAY` for 24-hour cooldown tracking on long rests.

## NPC System

NPCs have roles (`merchant`, `innkeeper`, `blacksmith`, `priest`, `guard`, etc.) that determine interaction options. The `NPCInteraction` class maps roles to available actions.

### NPC Placement

NPCs are placed on exploration maps using **anchor-based placement** (in `placeExplorationNPCs` in main.ts). Each role maps to anchor features:

| Role | Anchor Features |
|------|----------------|
| innkeeper | counter, hearth |
| merchant | counter, shelf |
| blacksmith | anvil, hearth |
| priest | altar, fountain |
| guard | weapon_rack, banner |

The algorithm: scan the grid for anchor features, place NPCs in passable cells adjacent to their role's anchor. Fallback: random indoor cell, then outdoor. Handcrafted NPCs use stored `npc.position` from universe data.

### Merchant Stock

Stock tables in `src/npc/MerchantSystem.ts` map roles to item IDs:
- **merchant** -- adventuring gear, tools, ammunition, containers
- **blacksmith** -- all SRD weapons & armor
- **innkeeper** -- food, drink, rations
- **priest** -- potions, alchemical supplies, holy items

Biome extras add context-appropriate items (desert: waterskin; mountain: climbing gear; etc.). Difficulty tiers filter expensive items at low levels.

Innkeeper special actions:
- `short_rest` (buy a meal, 2sp) -- 1 hour, spend hit dice
- `rest` (rent a room, 5sp) -- 8 hours, full long rest with TimeActivity animation

### Adding Items

Add items to `src/data/items.ts` in the `SRD_ITEMS` array. Each item needs: `id`, `type: 'item'`, `name`, `itemType`, `rarity`, `weight`, `value`, `description`, `stackable`, `requiresAttunement`, and type-specific `properties`. Then add the item ID to the appropriate stock table in `MerchantSystem.ts`.

## Event Patterns

Events use `type:` prefixed categories:
- `ui:navigate` -- screen transitions
- `ui:modal:*` -- modal dialogs
- `world:created` / `world:delete` -- world lifecycle
- `combat:*` -- combat events
- `character:*` -- character changes

## CSS Conventions

- CSS variables defined in `src/styles/base.css` (colors, spacing, z-index layers)
- Z-index layers: `--z-base`, `--z-dropdown`, `--z-modal`, `--z-notification`
- Screen-specific CSS in `src/styles/screens/` (one file per screen)
- Animations: `fadeIn`, `menuItemReveal`, `fadeOut` keyframes shared across screens
- Dark fantasy aesthetic with warm amber accents (`--gold`, `--gold-dim`)

## Versioning

- `package.json` version is the source of truth
- `__APP_VERSION__` is injected by Vite at build time (defined in vite.config.ts)
- MenuScreen displays it via `v${__APP_VERSION__}`
- patch++ = x.y.Z+1, minor++ = x.Y+1.0, major++ = X+1.0.0

## Save System

IndexedDB primary, localStorage fallback. Worlds and saves are separate:
- `StorageEngine.saveWorld()` / `loadWorld()` -- the overworld data
- `SaveManager.saveGame()` / `loadGame()` -- character + game state
- `WorldExporter` -- JSON export/import (.oneparty.json format, v1 legacy and v2 hierarchical)

## Common Pitfalls

1. **Don't use `makeCell` with features** -- use `featureCell()` so physics derive from registry
2. **Don't attach FocusNav in mount()** -- attach in `setupEvents()` only (called once)
3. **Don't hardcode z-index** -- use CSS variables (`--z-modal`, etc.)
4. **Clear timeouts on destroy** -- track them in an array, clearTimeout in `destroy()`
5. **Modal letter-spacing** -- lock to `0.18em !important` in modal footers to prevent hover layout shift
6. **DiceRoller needs SeededRNG** -- `new DiceRoller(rng)`, never `new DiceRoller()`
7. **build-ylem.ts is standalone** -- it can't import from `src/`, duplicate types/physics inline
