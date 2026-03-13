# One Party

**A Solo D&D 5e Adventure -- Your AI Game Master**

One Party is a browser-based solo D&D 5e game that runs entirely client-side. Create a character, explore a procedurally generated world, engage in grid-based tactical combat, recruit NPC companions, and progress from level 1 through epic tiers -- all orchestrated by a template-driven game engine designed to be extended with LLM narration.

---

## Features (v0.1.0)

- **Character creation wizard** -- 5 races, 4 classes, point-buy ability scores, skill proficiency selection
- **Procedural world generation** -- Regions with biomes, locations (villages, dungeons, ruins, etc.), sub-locations, and tactical spaces
- **Grid-based tactical combat** -- A* pathfinding, line-of-sight, fog of war, creature size awareness, terrain costs
- **Full 5e action economy** -- Action, bonus action, reaction, movement; opportunity attacks, dash, dodge, disengage
- **NPC system** -- Companions with personality traits, goals, disposition tracking, autonomous combat AI, and memory
- **Template-based event system** -- Encounters, events, loot, quests, and NPC generation driven by weighted conditional templates
- **Narrative engine** -- Swappable architecture; string-template narrator now, LLM integration designed in
- **Dark fantasy UI** -- CSS animations, SVG icon system, tooltips, screen transitions, responsive layout
- **IndexedDB saves** -- Auto-save, quick save, manual save, JSON export/import with integrity checking
- **Epic progression** -- Levels 1-100+ with epic boons, scaling proficiency bonus, and ASI every 4 levels
- **Zero runtime dependencies** -- Pure TypeScript, no frameworks, no external libraries

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript 5.x (strict mode) |
| Bundler | Vite 8.x |
| Rendering | Canvas 2D + HTML overlay for grid; DOM for UI |
| Styling | CSS custom properties theming, animations |
| Persistence | IndexedDB via `StorageEngine` wrapper |
| Dependencies | **Zero** runtime dependencies |

## Getting Started

```bash
git clone https://github.com/mramad3us/One-Party.git
cd One-Party
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. That is it -- no server, no database, no API keys.

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |

## Architecture

One Party is built around a five-layer architecture. Each layer depends only on the layers below it:

```
+------------------------------------------------------+
|  5. NARRATIVE   TextNarrativeEngine, CombatNarrator   |
|     Converts resolved events into prose for display   |
+------------------------------------------------------+
|  4. RULES       DiceRoller, CombatRules, Conditions   |
|     Implements 5e mechanics: rolls, damage, AC, etc.  |
+------------------------------------------------------+
|  3. RESOLUTION  Resolver, EncounterResolver, Retro    |
|     Selects and instantiates templates into events    |
+------------------------------------------------------+
|  2. TEMPLATES   TemplateRegistry, definitions/*       |
|     Declarative content: encounters, events, loot     |
+------------------------------------------------------+
|  1. STATE       GameState, GameEngine, EntityManager   |
|     World model, entity storage, event bus, tick loop |
+------------------------------------------------------+
```

### Key Design Decisions

- **Template Resolution Engine** -- Content emerges from weighted, conditional templates rather than pure random generation. Templates declare prerequisites, variables, and narrative hints. The resolver evaluates conditions against game state, selects eligible templates, and resolves variables to produce structured events.

- **Lazy Simulation (Retroactive Generation)** -- The world does not simulate while the player is away. Instead, when the player returns to a location, the `RetroactiveGenerator` synthesizes what "happened" during their absence: NPC healing, local events, shop restocking.

- **Interface-first Design** -- Every major system is fronted by a TypeScript interface (`NarrativeEngine`, `GameSystem`, `Entity`). Implementations can be swapped without changing consumers. This is how the narrative layer will transition from string templates to LLM-driven narration.

- **NPC Lifecycle: Decorative to Awakened to Companion** -- NPCs start as simple role-based entities (innkeeper, guard). When "awakened," they gain personality, goals, disposition tracking, and memory. Awakened NPCs can be recruited as companions with autonomous combat AI.

## Project Structure

```
src/
  main.ts                   -- Application entry point, wires up all systems
  character/                -- Character creation factory and sheet display
  combat/                   -- Combat state machine, AI, initiative, targeting
  data/                     -- SRD reference data (races, classes, spells, monsters, items)
  engine/                   -- Core engine: GameEngine, EventBus, EntityManager, IdGenerator
  grid/                     -- Tactical grid: Grid, Pathfinder, LineOfSight, FogOfWar, Renderer
  icons/                    -- SVG icon sprites (combat, status, ui)
  narrative/                -- Narrative engine and text templates
  npc/                      -- NPC factory, behavior AI, companion manager, disposition, memory
  resolution/               -- Template resolver, encounter resolver, retroactive generator
  rules/                    -- 5e rules: dice, combat, conditions, equipment, level-up, rest
  state/                    -- Game state container and history log
  storage/                  -- IndexedDB engine, save manager, export/import, schema migration
  styles/                   -- CSS: main stylesheet, screen-specific styles
  templates/                -- Template registry and content definitions (encounters, events, loot, NPCs)
  types/                    -- TypeScript type definitions for all systems
  ui/                       -- UI framework: Component base class, UIManager, screens, panels, widgets
  utils/                    -- SeededRNG, math helpers, DOM utilities, formatting
  world/                    -- World generator, location manager, exploration, travel, space generation
```

## Design Philosophy

### Build to Grow

Every system is designed to be extended without rewriting. Adding a new race is a data entry in `src/data/races.ts`. Adding a new encounter is a template definition in `src/templates/definitions/encounters.ts`. Swapping the narrative engine means implementing the `NarrativeEngine` interface.

### Template-Based Structured Emergence

Content is not hard-coded sequences or purely random rolls. Templates define *what can happen* -- with conditions, weights, and variables -- and the resolution layer decides *what does happen* given the current game state. This produces emergent gameplay that still feels authored.

### Narrative Layer Decoupled from Game Logic

The game engine produces `ResolvedEvent` objects. The narrative engine converts them to `NarrativeBlock` text for display. This clean boundary means the game works identically whether narration comes from string templates, an LLM API, or a localized text database.

### No Runtime Dependencies by Design

The entire game ships as a single JS bundle with zero external dependencies. This keeps the build fast, the bundle small, and the game permanently playable -- no CDNs, no API servers, no broken links.

## Roadmap

| Version | Milestone |
|---|---|
| **v0.1.0** (current) | Core game loop, character creation, grid combat, exploration, NPC framework, persistence |
| **v0.2.0** | Full spell system, subclass selection, level-up wizard |
| **v0.3.0** | NPC awakening mechanic, full dialogue trees, companion recruitment |
| **v0.4.0** | World events (cascading), settlement building, economy |
| **v0.5.0** | LLM narrative integration, dynamic narration |
| **v1.0.0** | Full featured release |

## License

MIT
