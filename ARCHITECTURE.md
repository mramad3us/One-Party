# One Party -- Architecture Guide

This document describes the internal architecture of One Party for developers who want to understand, extend, or contribute to the codebase.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Core Systems](#core-systems)
   - [Game Engine](#game-engine)
   - [Rules Engine](#rules-engine)
   - [World System](#world-system)
   - [Grid and Combat](#grid-and-combat)
   - [NPC System](#npc-system)
   - [Template System](#template-system)
   - [Narrative Layer](#narrative-layer)
   - [UI System](#ui-system)
   - [Storage](#storage)
3. [Data Models](#data-models)
4. [How to Extend](#how-to-extend)
5. [SRD Data](#srd-data)

---

## System Overview

### Five-Layer Architecture

One Party is structured as five layers, each depending only on the layers below it:

```
Layer 5: NARRATIVE     Converts resolved events into displayable prose
Layer 4: RULES         Implements D&D 5e mechanics (dice, damage, conditions)
Layer 3: RESOLUTION    Evaluates templates against state, produces events
Layer 2: TEMPLATES     Declarative content definitions (encounters, events, loot)
Layer 1: STATE         World model, entity storage, event bus, game loop
```

**Layer 1 -- State** holds the ground truth: the world structure, all entities, the game clock, and the event bus. The `GameEngine` runs a `requestAnimationFrame` tick loop that updates registered systems in priority order.

**Layer 2 -- Templates** are static data declarations. They describe what *can* happen (an encounter, an event, a loot drop) using conditions, weights, and variables. Templates have no behavior.

**Layer 3 -- Resolution** is where templates become events. The `Resolver` evaluates template conditions against current game state, selects eligible templates via weighted random, resolves variables, and outputs `ResolvedEvent` objects.

**Layer 4 -- Rules** enforces D&D 5e mechanics. Dice rolls, attack resolution, damage calculation, condition effects, ability checks, rest recovery -- all live here. Rules are stateless functions that take inputs and return results.

**Layer 5 -- Narrative** takes `ResolvedEvent` and `ActionResult` objects and converts them into `NarrativeBlock` prose for display. The current implementation (`TextNarrativeEngine`) uses string templates with interpolation. The `NarrativeEngine` interface is designed for future LLM integration.

### Event-Driven Communication

Systems communicate through the `EventBus`, a typed pub/sub system. Events are categorized (`combat`, `world`, `character`, `ui`, `time`, `narrative`, `system`) and support pattern matching with wildcards:

- `"combat:attack:hit"` -- exact match
- `"combat:*"` -- matches all combat events
- `"*"` -- matches everything

Handlers execute in priority order (lower number = first). One-shot subscriptions via `once()` auto-unsubscribe after firing. All subscriptions return an `Unsubscribe` function for cleanup.

### Entity Management

The `EntityManager` provides centralized storage for all game objects. Entities are indexed by both ID and type, enabling fast lookups:

- `get<Character>(id)` -- O(1) lookup by ID
- `getAll<NPC>('npc')` -- O(n) within type, uses type index
- `query(predicate)` -- O(n) scan with arbitrary filter

Entity types: `character`, `npc`, `item`, `location`, `quest`.

---

## Core Systems

### Game Engine

**Location:** `src/engine/`

| Class | Responsibility |
|---|---|
| `GameEngine` | Master orchestrator. Owns the `EventBus` and `EntityManager`. Runs the `requestAnimationFrame` tick loop, updating registered `GameSystem` instances in priority order. |
| `EventBus` | Typed pub/sub with wildcard pattern matching and priority-ordered handlers. Supports `on()`, `once()`, `off()`, `emit()`, and `clear()`. |
| `EntityManager` | Central entity storage with type-based indexing. Supports `add()`, `get()`, `getAll()`, `remove()`, `query()`, and `count()`. |
| `IdGenerator` | Generates unique IDs via `crypto.randomUUID()`. |

**Key design decisions:**

- The engine is deliberately minimal. It does not know about D&D rules, combat, or world structure. All game logic lives in registered systems.
- Systems implement the `GameSystem` interface: `name`, `priority`, `init(engine)`, optional `update(deltaMs)` and `destroy()`.
- The tick loop uses real-time delta (milliseconds since last frame), not fixed time steps. Game time is tracked separately in `GameState`.

### Rules Engine

**Location:** `src/rules/`

| Class | Responsibility |
|---|---|
| `DiceRoller` | Rolls any polyhedral die with advantage/disadvantage, modifiers, and critical detection. Uses `SeededRNG` for reproducibility. |
| `CombatRules` | Attack roll resolution, damage calculation (including critical hits), AC comparison. |
| `ConditionRules` | Applies 5e condition effects (blinded, paralyzed, etc.), tracks durations, ticks conditions at end of turn, calculates speed multipliers. |
| `AbilityChecks` | Skill checks, saving throws, ability contests with proficiency and advantage handling. |
| `EquipmentRules` | AC calculation from equipped armor and shields, weapon property handling. |
| `LevelUpRules` | XP thresholds, level-up stat changes, proficiency bonus scaling, epic boon selection past level 20. |
| `RestRules` | Short rest (hit dice recovery, feature recharge) and long rest (full HP, spell slot, hit dice recovery). |

**Key design decisions:**

- All rules functions are stateless. They take inputs (ability scores, conditions, dice) and return results. No rules class holds mutable state.
- `DiceRoller` accepts a `SeededRNG` so that all randomness is reproducible from the world seed.
- `DiceRollResult` captures full detail: individual rolls, modifier, critical/fumble flags, advantage/disadvantage state, and a human-readable description.

### World System

**Location:** `src/world/`

| Class | Responsibility |
|---|---|
| `WorldGenerator` | Procedurally generates the world hierarchy: `World` containing `Region`s with `Location`s. Uses concentric rings of regions with scaling difficulty. |
| `LocationManager` | CRUD operations on locations within the world. Handles discovery, visit tracking, NPC/item assignment. |
| `TravelSystem` | Calculates travel time and events between locations. Handles random encounters during travel based on region difficulty. |
| `ExplorationSystem` | Manages exploration within a location: entering sub-locations, triggering events, discovering items and NPCs. |
| `SpaceGenerator` | Generates tactical `Space` objects with grids for combat or exploration. Creates terrain, places features (doors, chests, traps), determines lighting. |

**World hierarchy:**

```
World
  +-- Region (biome, difficulty, coordinates)
        +-- Location (type: village/dungeon/ruins/etc.)
              +-- SubLocation (type: tavern/shop/dungeon_room/etc.)
                    +-- Space (grid + terrain + entities + lighting)
```

**Key design decisions:**

- World generation is seeded. The same seed always produces the same world.
- Regions are arranged in concentric rings from the starting village. Inner rings are easier; outer rings scale in difficulty.
- Locations are not fully generated upfront. Sub-locations and spaces can be generated on demand (lazy simulation).
- Each location tracks `lastVisited` for retroactive generation on return.

### Grid and Combat

**Location:** `src/grid/`, `src/combat/`

#### Grid System

| Class | Responsibility |
|---|---|
| `Grid` | Pure data structure for the tactical grid. 1 cell = 5 feet. Manages entity placement, occupancy, adjacency queries, and distance calculation (Chebyshev). No rendering. |
| `Pathfinder` | A* pathfinding with terrain costs and creature size awareness. Also provides Dijkstra-based reachability queries (`getReachableCells`). |
| `LineOfSight` | Bresenham-based line-of-sight checks that respect `blocksLoS` terrain. |
| `FogOfWar` | Tracks explored and currently visible cells. Updates visibility when entities move. |
| `GridRenderer` | Canvas 2D renderer for the tactical grid. Draws terrain, entities, fog, movement highlights, and path previews. |
| `GridInteraction` | Handles mouse/touch input on the grid canvas. Click-to-move, click-to-target, hover highlighting. |

#### Combat System

| Class | Responsibility |
|---|---|
| `CombatManager` | Master combat controller. Manages the full lifecycle: setup, initiative, turns, actions, movement, opportunity attacks, death, and resolution. State machine with phases: `idle -> setup -> initiative -> turn_start -> turn_active -> turn_end -> check_end -> resolution`. |
| `InitiativeTracker` | Rolls initiative for all participants, maintains sorted order, handles turn advancement and round tracking. |
| `TurnManager` | Tracks action economy within a single turn: action used, bonus action used, reaction used, remaining movement, dash state. |
| `TargetingSystem` | Calculates valid melee targets (by reach), valid ranged targets (by range), area-of-effect targets, and opportunity attack triggers. |
| `CombatAI` | Autonomous decision-making for NPC combatants. Uses companion preferences (aggression, focus damaged, protect allies, preferred range) to plan movement and action. Falls back to simple monster AI for non-companion NPCs. |

**How combat flows:**

1. `startCombat()` receives participants, a grid definition, and initial placements.
2. Initiative is rolled; combatants are sorted.
3. For each turn: `beginTurn()` applies start-of-turn effects and starts the turn manager.
4. If the current combatant is a player, the UI is activated for input. If NPC, `processNPCTurn()` runs the combat AI.
5. Actions are executed through `executeAttack()`, `executeCastSpell()`, `executeDash()`, etc. Each deducts from the turn manager and emits combat events.
6. Movement via `executeMove()` checks for opportunity attacks along the path.
7. At turn end, conditions tick, and initiative advances.
8. `checkCombatEnd()` evaluates whether all enemies or all allies are dead.

**Key design decisions:**

- Combat is turn-based on a grid, not theater-of-mind. This enables tactical depth.
- Distance uses Chebyshev metric (max of dx, dy) times 5 feet, matching the simplified D&D diagonal rule.
- Large creatures occupy multi-cell footprints (2x2 for Large, 3x3 for Huge, 4x4 for Gargantuan). Pathfinding respects this.
- Multiattack is handled by iterating over all attacks in a creature's stat block when `executeAttack()` is called.

### NPC System

**Location:** `src/npc/`

| Class | Responsibility |
|---|---|
| `NPCFactory` | Creates NPCs from role templates (innkeeper, guard, merchant, etc.) with appropriate stats, attacks, and names. Creates full companions with personality, goals, disposition, and combat preferences. |
| `NPCBehavior` | Determines NPC behavior outside of combat: idle actions, reactions to player presence, dialogue triggers. |
| `CompanionManager` | Manages the player's companion roster. Handles joining, leaving, and party composition. |
| `DispositionSystem` | Tracks how NPCs feel about the player and other entities on a -100 (hostile) to +100 (friendly) scale. Disposition changes based on player actions. |
| `NPCMemory` | Records significant events from an NPC's perspective. Memories have timestamps, sentiment values, and details. Memory affects future behavior and dialogue. |

**NPC lifecycle:**

1. **Decorative** -- Created by `NPCFactory.createFromTemplate()` with a role (innkeeper, guard, etc.). Has stats but no personality. `isAwakened = false`.
2. **Awakened** -- When the game decides an NPC becomes important, it gains personality traits, bonds, ideals, flaws, goals, and memory tracking. `isAwakened = true`.
3. **Companion** -- An awakened NPC that has been recruited to the player's party. Has full `CompanionData` including combat preferences and level-up strategy. Fights alongside the player with autonomous AI.

**Key design decisions:**

- Not all NPCs need full personality simulation. Decorative NPCs are cheap to create and display. Only important NPCs get "awakened."
- Combat preferences (aggression, focus damaged targets, protect allies, preferred range, spell priority) allow each companion to fight differently.
- The disposition system uses a simple numeric scale rather than complex relationship modeling. This keeps the system predictable and debuggable.

### Template System

**Location:** `src/templates/`, `src/resolution/`

| Class | Responsibility |
|---|---|
| `TemplateRegistry` | Central storage for all template definitions. Supports registration, lookup by ID, and filtering by type and tags. |
| `Resolver` | Core resolution engine. Evaluates template conditions against game state, resolves variables (from state, random selection, or computation), and produces `ResolvedEvent` objects. |
| `EncounterResolver` | Specialized resolver for combat encounters. Selects appropriate monsters, scales difficulty, determines grid layout. |
| `RetroactiveGenerator` | Generates "what happened while you were away" events for locations. Produces NPC changes (healing), world events, and narrative hints proportional to time elapsed. |
| `WeightedSelector` | Utility for weighted random selection among eligible templates. |

**Template structure:**

```typescript
type Template = {
  id: string;
  type: 'encounter' | 'event' | 'npc' | 'quest' | 'dialogue' | 'loot';
  tags: string[];
  weight: number;               // Selection probability weight
  conditions: TemplateCondition[];  // Prerequisites to activate
  variables: TemplateVariable[];    // Values to resolve at instantiation
  data: Record<string, unknown>;    // Template-specific payload
};
```

**Resolution flow:**

1. `findEligibleTemplates(type, state)` filters all templates of the given type by evaluating their conditions against current game state.
2. `WeightedSelector` picks one template based on weights.
3. `resolve(template, state)` evaluates each variable:
   - `source: 'state'` -- reads a value from game state via dot-path (e.g., `"character.level"`)
   - `source: 'random'` -- picks randomly from an options array
   - `source: 'computed'` -- evaluates a simple math expression
4. The result is a `ResolvedEvent` with all variables filled in and narrative hints attached.

**Template definitions are in:** `src/templates/definitions/encounters.ts`, `events.ts`, `loot.ts`, `npcs.ts`

### Narrative Layer

**Location:** `src/narrative/`

| Class | Responsibility |
|---|---|
| `TextNarrativeEngine` | Default implementation of `NarrativeEngine`. Converts resolved events, combat actions, locations, and NPCs into prose using role-based string templates with variable interpolation. |
| `CombatNarrator` | Specialized narrator for combat events. Generates turn-by-turn descriptions of attacks, spells, movement, and deaths. |

**The `NarrativeEngine` interface:**

```typescript
interface NarrativeEngine {
  narrate(event: ResolvedEvent): NarrativeBlock[];
  describeCombatAction(result: ActionResult): NarrativeBlock;
  describeLocation(location: unknown): NarrativeBlock;
  describeNPC(npc: unknown): NarrativeBlock;
}
```

**NarrativeBlock categories:** `action`, `dialogue`, `description`, `system`, `combat`, `loot`

**Key design decisions:**

- The narrative layer receives only `ResolvedEvent` and `ActionResult` -- it never reads game state directly. This makes the interface clean and the engine swappable.
- `TextNarrativeEngine` uses per-role and per-location-type template arrays, picking randomly for variety. An LLM engine would replace these with API calls.
- Each `NarrativeBlock` carries a `tone` hint (atmospheric, exciting, neutral, etc.) for future use by more sophisticated narrative engines.

### UI System

**Location:** `src/ui/`

| Class | Responsibility |
|---|---|
| `Component` | Abstract base class for all UI components. Provides lifecycle management (`mount`, `unmount`, `update`, `destroy`), DOM helpers (`$`, `$$`), auto-cleanup event listeners (`listen`, `subscribe`), and Web Animations API integration. |
| `UIManager` | Screen orchestrator. Manages screen transitions with directional slide animations. Screens are registered as factory functions and instantiated on demand. |
| `AnimationSystem` | Handles screen transition animations (slide left/right/up/down) using the Web Animations API. |
| `IconSystem` | SVG sprite management. Loads and provides inline SVG icons from sprite sheets. |
| `TooltipSystem` | Hover tooltip management. Reads `data-tooltip` attributes and displays positioned tooltips. |

**Screens** (`src/ui/screens/`):

| Screen | Purpose |
|---|---|
| `MenuScreen` | Main menu with New Game, Continue, Load, Settings |
| `CreationScreen` | Character creation wizard: race, class, ability scores, skills, name |
| `GameScreen` | Main exploration view with narrative, map, actions, and party panels |
| `CombatScreen` | Tactical combat view with grid, initiative tracker, action buttons |
| `InventoryScreen` | Item management and equipment |
| `CharacterScreen` | Character sheet display |
| `DeathScreen` | Game over screen with reload option |

**Panels** (`src/ui/panels/`):

| Panel | Purpose |
|---|---|
| `NarrativePanel` | Scrolling text log of narration and events |
| `MapPanel` | Region/location overview map |
| `ActionPanel` | Context-sensitive action buttons |
| `PartyPanel` | HP bars, conditions, and companion status |
| `GridPanel` | Wraps the canvas grid renderer for combat |

**Widgets** (`src/ui/widgets/`): `Button`, `DiceDisplay`, `ItemCard`, `Modal`, `ProgressBar`, `StatBlock`

**Key design decisions:**

- The `Component` base class auto-cleans DOM listeners and EventBus subscriptions on `destroy()`. This prevents memory leaks from orphaned handlers.
- Screens are lazily constructed via factory functions. Only the active screen exists in the DOM.
- CSS custom properties power the theming system. The dark fantasy look can be reskinned by changing variable values.
- No virtual DOM, no framework. Direct DOM manipulation keeps the bundle small and performance predictable.

### Storage

**Location:** `src/storage/`

| Class | Responsibility |
|---|---|
| `StorageEngine` | IndexedDB wrapper providing async access to three object stores: `save-meta` (metadata), `save-data` (full game state), and `settings` (user preferences). |
| `SaveManager` | High-level save operations: manual save, quick save, auto-save (periodic), load, list, delete. Serializes `GameState` and `EntityManager` contents. |
| `ExportImport` | JSON export/import with DJB2 checksum integrity verification. Handles file download/upload via browser APIs. Auto-migrates imported saves to the current schema version. |
| `Migration` | Schema versioning system. Migrations are registered as functions that upgrade from version N to N+1. Applied sequentially when loading old saves. |

**Save data structure:**

```
SaveMeta {id, name, characterName, level, location, playtime, lastSaved, version}
SaveData {id, version, state: SerializedGameState, entities: SerializedEntity[]}
```

**Key design decisions:**

- IndexedDB is used instead of localStorage because save data can exceed localStorage's 5MB limit.
- Metadata is stored separately from data so the save list can be displayed without deserializing full game states.
- The migration system is forward-compatible: old saves are automatically upgraded. Each version bump requires registering a migration function.
- Export files include a DJB2 checksum to detect corruption or tampering.

---

## Data Models

### Character

```
Character extends Entity {
  name, race, class, level, xp
  abilityScores: {str, dex, con, int, wis, cha}
  maxHp, currentHp, tempHp, hitDice
  armorClass, speed, proficiencyBonus
  proficiencies: {skills, savingThrows, armor, weapons, tools, languages}
  features: FeatureInstance[]
  inventory: {items, capacity, weight, gold/silver/copper}
  equipment: {mainHand, offHand, armor, helmet, cloak, gloves, boots, rings, amulet, belt}
  spellcasting: {ability, slots, known, prepared, concentration, cantrips} | null
  conditions: ActiveCondition[]
  deathSaves: {successes, failures}
  position, initiative
  epicBoons: EpicBoon[]
}
```

### NPC

```
NPC extends Entity {
  templateId, name, role, locationId, isAwakened
  stats: CreatureStatBlock {
    abilityScores, maxHp, currentHp, armorClass, speed, level
    attacks: AttackDefinition[]
    spellcasting, features, conditions
    size, resistances, immunities, vulnerabilities, conditionImmunities
  }
  companion: CompanionData {
    personality: {traits, bonds, ideals, flaws}
    goals: {shortTerm, longTerm}
    disposition: Map<EntityId, number>
    memory: NPCMemoryEntry[]
    combatPreferences: {aggression, focusDamaged, protectAllies, preferredRange, spellPriority}
    levelUpStrategy: {preferredAbilities, preferredFeats, spellPreference}
  } | null
  position, initiative
}
```

### World Hierarchy

```
World {id, name, seed, regions: Map, time: GameTime, history}
  Region {id, name, biome, description, coordinates, difficulty, locations: Map, connections, discovered}
    Location {id, regionId, name, locationType, coordinates, description, subLocations: Map, npcs, items, discovered, lastVisited, connections, tags}
      SubLocation {id, locationId, name, subType, coordinates, spaces: Map, npcs, items, discovered, interiorType}
        Space {id, subLocationId, name, grid: GridDefinition, terrain, interiorType, lighting, entities}
```

### Grid Types

```
GridDefinition {width, height, cells: GridCell[][]}
GridCell {terrain, movementCost, blocksLoS, elevation, features}
GridEntityPlacement {entityId, position: Coordinate, size}
PathResult {path: Coordinate[], totalCost, reachable}
FogState {explored: Set<string>, visible: Set<string>}
```

### Combat Types

```
CombatState {phase, combatants: Combatant[], currentTurnIndex, round, gridId}
Combatant {entityId, initiative, isPlayer, isAlly}
AvailableActions {canMove, remainingMovement, canAction, canBonusAction, canReaction, validAttackTargets, validSpells, validMoveCells}
ActionResult {success, type, actorId, targetId, damage, damageType, healing, description, rolls}
PlannedTurn {movement, action, bonusAction}
```

### Template Types

```
Template {id, type, tags, weight, conditions: TemplateCondition[], variables: TemplateVariable[], data}
TemplateCondition {type, operator: eq|neq|gt|lt|gte|lte|contains|not_contains, value}
TemplateVariable {name, source: state|random|computed, path?, options?, compute?}
ResolvedEvent {templateId, type, timestamp, resolvedData, narrativeHints}
NarrativeBlock {text, category, speaker?, tone?, timestamp?}
```

---

## How to Extend

### Adding a New Race

Edit `src/data/races.ts`. Add an entry to the races array:

```typescript
{
  id: 'gnome',
  name: 'Gnome',
  abilityBonuses: { intelligence: 2 },
  speed: 25,
  size: 'small',
  traits: [
    { id: 'darkvision', name: 'Darkvision', description: '...' },
    { id: 'gnome_cunning', name: 'Gnome Cunning', description: '...' },
  ],
  languages: ['common', 'gnomish'],
  proficiencies: [],
}
```

No other files need to change. The creation wizard reads from this data file.

### Adding a New Class

Edit `src/data/classes.ts`. Follow the pattern of existing classes (fighter, wizard, rogue, cleric). Each class defines hit die, primary ability, saving throw proficiencies, skill options, starting equipment, and level-by-level features.

### Adding a New Monster

Edit `src/data/monsters.ts`. Add an entry with ability scores, HP, AC, speed, attacks (with to-hit bonus and damage rolls), and any special features. The combat system will use the stat block directly.

### Adding a New Spell

Edit `src/data/spells.ts`. Define the spell level, school, casting time, range, components, duration, and effect description. Wire up the mechanical effect in `CombatManager.executeCastSpell()` or the relevant rules class.

### Adding a New Encounter Template

Edit `src/templates/definitions/encounters.ts`. Add a template:

```typescript
{
  id: 'encounter_goblin_ambush',
  type: 'encounter',
  tags: ['combat', 'ambush', 'goblin'],
  weight: 10,
  conditions: [
    { type: 'partyLevel', operator: 'lte', value: 5 },
    { type: 'biome', operator: 'eq', value: 'forest' },
  ],
  variables: [
    { name: 'goblinCount', source: 'computed', compute: 'partyLevel + 1' },
  ],
  data: {
    monsterIds: ['goblin'],
    narrativeHints: [
      { key: 'ambush', tone: 'tense', context: { description: 'Goblins spring from the underbrush!' } },
    ],
  },
}
```

The resolver will automatically include this template when conditions are met.

### Adding a New UI Screen

1. Create a new class in `src/ui/screens/` extending `Component`.
2. Implement `createElement()` to build the DOM structure.
3. Override `setupEvents()` to wire up event handlers.
4. Register the screen in `main.ts` via `ui.registerScreen('screenName', () => new MyScreen(container, engine))`.
5. Navigate to it by emitting `ui:navigate` events with the screen name.

### Swapping the Narrative Engine

1. Implement the `NarrativeEngine` interface from `src/types/narrative.ts`.
2. Your implementation must provide: `narrate(event)`, `describeCombatAction(result)`, `describeLocation(location)`, `describeNPC(npc)`.
3. Replace the `TextNarrativeEngine` instantiation with your implementation wherever the narrative engine is constructed.

Example for an LLM-powered engine:

```typescript
class LLMNarrativeEngine implements NarrativeEngine {
  async narrate(event: ResolvedEvent): Promise<NarrativeBlock[]> {
    const prompt = buildPromptFromEvent(event);
    const response = await callLLM(prompt);
    return parseResponseToBlocks(response);
  }
  // ...
}
```

---

## SRD Data

All game data lives in `src/data/` as typed TypeScript constants.

| File | Content | Approximate Size |
|---|---|---|
| `races.ts` | Playable races: Human, Elf, Dwarf, Halfling, Half-Elf | ~5 KB |
| `classes.ts` | Character classes: Fighter, Wizard, Rogue, Cleric with features by level | ~85 KB |
| `spells.ts` | Spell definitions across all levels | ~58 KB |
| `monsters.ts` | Monster stat blocks with attacks, abilities, and CR | ~87 KB |
| `items.ts` | Weapons, armor, potions, adventuring gear | ~35 KB |
| `conditions.ts` | All 15 D&D 5e conditions with mechanical effects | ~3 KB |
| `epic-progression.ts` | Epic boons and scaling rules for levels 21-100 | ~5 KB |

### Adding More SRD Data

Follow the existing typed patterns. Each data file exports a typed array or record. The type definitions in `src/types/` enforce the expected structure at compile time, so TypeScript will catch missing or malformed fields.

All SRD data is loaded at startup as part of the JavaScript bundle. For very large datasets, consider lazy loading via dynamic `import()`.
