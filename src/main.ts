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
import { StorageEngine } from '@/storage/StorageEngine';
import { SaveManager } from '@/storage/SaveManager';
import { CharacterFactory } from '@/character/CharacterFactory';
import { WorldGenerator } from '@/world/WorldGenerator';
import { LocalMapGenerator } from '@/world/LocalMapGenerator';
import { SeededRNG } from '@/utils/SeededRNG';
import { DiceRoller } from '@/rules/DiceRoller';
import { TextNarrativeEngine } from '@/narrative/NarrativeEngine';
import { SurvivalRules } from '@/rules/SurvivalRules';
import { SurvivalNarrator } from '@/narrative/SurvivalNarrator';
import { getItem } from '@/data/items';
import type { ConsumableProperties } from '@/types/item';
import { ROUNDS_PER_HOUR } from '@/types/time';
import { KeyboardInput } from '@/engine/KeyboardInput';
import { ExplorationController } from '@/engine/ExplorationController';
import { Grid } from '@/grid/Grid';
import { FogOfWar } from '@/grid/FogOfWar';
import type { KeyboardHint } from '@/ui/panels/ActionPanel';
import type { EntityRenderInfo } from '@/grid/GridRenderer';
import { TimeNarrator } from '@/narrative/TimeNarrator';

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

  // 5. Get the app container
  const container = document.getElementById('app');
  if (!container) {
    throw new Error('#app container not found');
  }

  // 6. Create UI manager
  const ui = new UIManager(container, engine);

  // Track active game state
  let activeGameState: GameState | null = null;
  let activeGameScreen: GameScreen | null = null;
  let activeRng: SeededRNG | null = null;
  const narrator = new TextNarrativeEngine();

  // 7. Register screens
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
    const { name, race, class: classId, abilityScores, skills } = event.data as {
      name: string;
      race: string;
      class: string;
      abilityScores: AbilityScores;
      skills: Skill[];
    };

    // Create RNG and dice
    const seed = Date.now();
    const rng = new SeededRNG(seed);
    activeRng = rng;
    const dice = new DiceRoller(rng);

    // Create character via factory
    const factory = new CharacterFactory(dice);
    const character: Character = factory.create({
      name,
      raceId: race,
      classId: classId,
      abilityScores,
      skills,
    });

    // Generate world
    const worldGen = new WorldGenerator(rng);
    const world = worldGen.generateWorld(seed);

    // Find starting location (first village, or first location in first region)
    let startLocationId: string | null = null;
    for (const [, region] of world.regions) {
      for (const [, location] of region.locations) {
        if (location.locationType === 'village') {
          startLocationId = location.id;
          break;
        }
      }
      if (startLocationId) break;
    }

    // Fall back to first location in first region
    if (!startLocationId) {
      const firstRegion = world.regions.values().next().value;
      if (firstRegion) {
        const firstLoc = firstRegion.locations.values().next().value;
        if (firstLoc) {
          startLocationId = firstLoc.id;
        }
      }
    }

    if (!startLocationId) {
      throw new Error('World has no locations');
    }

    // Create game state
    const gameState = new GameState(world, character.id, startLocationId);
    activeGameState = gameState;

    // Register entities
    engine.entities.clear();
    engine.entities.add(character);

    // Auto-save the new game
    saveManager
      .autoSave(gameState, engine.entities)
      .catch((err) => console.error('Initial auto-save failed:', err));

    // Enable periodic auto-save (every 5 minutes)
    saveManager.enableAutoSave(5 * 60 * 1000, () => ({
      state: gameState,
      entities: engine.entities,
    }));

    console.log(
      `[One Party] New game started: ${character.name} the ${race} ${classId} in ${world.name}`,
    );
  });

  let gamePopulated = false;

  // Populate screens when they become active
  engine.events.on('ui:screen:changed', (event) => {
    const { screen } = event.data as { screen: string };

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
      const character = engine.entities.getAll<Character>('character')[0];
      if (character) {
        const itemMap = new Map<string, import('@/types').Item>();
        for (const entry of character.inventory.items) {
          const item = getItem(entry.itemId);
          if (item) itemMap.set(item.id, item);
        }
        activeInventoryScreen.setInventory(character.inventory, itemMap);
        activeInventoryScreen.setEquipment(character.equipment, itemMap);
      }
    }
  });

  function populateGameScreen(
    screen: GameScreen,
    state: GameState,
    eng: GameEngine,
  ): void {
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

    // Add opening narrative
    screen.addNarrative({
      text: `Your adventure begins in the world of ${state.world.name}.`,
      category: 'system',
    });
    screen.addNarrative(narrator.describeLocation(location));

    // Generate local map for current location
    const rng = activeRng ?? new SeededRNG(Date.now());
    const mapGen = new LocalMapGenerator(rng);
    const { grid: gridDef, playerStart } = mapGen.generate(location.locationType, region.biome);
    const grid = new Grid(gridDef);
    const fog = new FogOfWar();

    // Configure exploration controller
    explorationController.configure({
      gameState: state,
      getCharacter: () => eng.entities.getAll<Character>('character')[0] ?? null,
    });

    // Enter local exploration
    explorationController.enterSpace(
      grid, fog, character.id, playerStart,
      character.speed, 'bright',
    );

    // Switch to local mode UI
    screen.enterLocalMode(grid, fog);
    screen.centerGrid(playerStart);

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
    };
    screen.updatePlayerEntity(character.id, playerStart, playerInfo);

    // Switch keyboard input to exploration mode
    keyboardInput.setContext('exploration');

    // Set keyboard hints
    screen.setKeyboardHints(buildKeyboardHints());
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

          // Update map and status
          activeGameScreen.setGameState({
            mode: 'exploration',
            partyMembers: getPartyMembers(eng),
            region,
            currentLocationId: dest.id,
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
        actions.push({
          id: `drink-${item.id}`,
          label: `Drink ${item.name}`,
          icon: 'potion',
          description: item.description,
          enabled: entry.quantity > 0,
          onClick: () => {
            if (!activeGameScreen) return;
            const char = eng.entities.getAll<Character>('character')[0];
            if (!char) return;
            const props = item.properties as ConsumableProperties;
            const thirstBefore = char.survival.thirst;
            SurvivalRules.consume(char.survival, props);
            const invEntry = char.inventory.items.find(e => e.itemId === item.id);
            if (invEntry) {
              invEntry.quantity -= 1;
              if (invEntry.quantity <= 0) {
                char.inventory.items = char.inventory.items.filter(e => e.itemId !== item.id);
              }
            }
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
    return [
      { key: 'k/\u2191', label: 'North',     available: true, category: 'movement' },
      { key: 'j/\u2193', label: 'South',     available: true, category: 'movement' },
      { key: 'h/\u2190', label: 'West',      available: true, category: 'movement' },
      { key: 'l/\u2192', label: 'East',      available: true, category: 'movement' },
      { key: 'y',   label: 'NW',        available: true, category: 'movement' },
      { key: 'u',   label: 'NE',        available: true, category: 'movement' },
      { key: 'b',   label: 'SW',        available: true, category: 'movement' },
      { key: 'n',   label: 'SE',        available: true, category: 'movement' },
      { key: 'e',   label: 'Interact',  available: true, category: 'action' },
      { key: 'x',   label: 'Look',      available: true, category: 'action' },
      { key: ',',   label: 'Pick up',   available: true, category: 'action' },
      { key: '.',   label: 'Wait',      available: true, category: 'action' },
      { key: '>',   label: 'Descend',   available: true, category: 'action' },
      { key: '<',   label: 'Ascend',    available: true, category: 'action' },
      { key: 'i',   label: 'Inventory', available: true, category: 'meta' },
      { key: 'c',   label: 'Character', available: true, category: 'meta' },
      { key: 'm',   label: 'World Map', available: true, category: 'meta' },
      { key: '?',   label: 'Help',      available: true, category: 'meta' },
      { key: 'Esc', label: 'Cancel',    available: true, category: 'meta' },
    ];
  }

  // Listen for exploration movement events — update UI
  engine.events.on('exploration:moved', (event) => {
    if (!activeGameScreen || !activeGameState) return;
    const { position, roundsElapsed } = event.data as { position: { x: number; y: number }; roundsElapsed: number };

    // Center camera on player
    activeGameScreen.centerGrid(position);

    // Update player entity rendering
    const character = engine.entities.getAll<Character>('character')[0];
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

  engine.events.on('exploration:entered', () => {
    if (!activeGameScreen) return;
    activeGameScreen.addNarrative({
      text: 'You take in your surroundings, eyes adjusting to the light. The world stretches out before you.',
      category: 'description',
    });
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
    if (!activeGameScreen) return;
    activeGameScreen.toggleHelp();
  });

  engine.events.on('input:worldmap', () => {
    if (!activeGameScreen) return;
    activeGameScreen.toggleWorldMap();
  });

  engine.events.on('input:cancel', () => {
    // Close world map if open
    if (activeGameScreen?.isWorldMapVisible()) {
      activeGameScreen.hideWorldMap();
      return;
    }
    // If on a sub-screen, return to game
    const current = ui.getCurrentScreen();
    if (current === 'character' || current === 'inventory') {
      engine.events.emit({
        type: 'ui:navigate',
        category: 'ui',
        data: { screen: 'game', direction: 'down' },
      });
    }
  });

  // Handle travel from world map
  engine.events.on('map:travel', (event) => {
    const { locationId } = event.data as { locationId: string };
    if (!activeGameScreen || !activeGameState) return;

    const region = activeGameState.getCurrentRegion();
    const dest = region.locations.get(locationId);
    if (!dest) return;

    dest.discovered = true;
    activeGameState.currentLocationId = dest.id;
    activeGameState.currentSubLocationId = null;

    // Travel takes 2-4 hours
    const travelRounds = ROUNDS_PER_HOUR * (2 + Math.floor(Math.random() * 3));
    const travelHours = Math.round(travelRounds / ROUNDS_PER_HOUR);
    const timeBefore = { totalRounds: activeGameState.world.time.totalRounds };
    activeGameState.advanceTime(travelRounds);

    // Travel narrative
    activeGameScreen.addNarrative({
      text: `You gather your belongings and set out. The journey to ${dest.name} takes ${travelHours} hours of hard travel through the ${region.biome} terrain.`,
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

    // Generate new local map
    const rng = activeRng ?? new SeededRNG(Date.now());
    const mapGen = new LocalMapGenerator(rng);
    const { grid: gridDef, playerStart } = mapGen.generate(dest.locationType, region.biome);
    const grid = new Grid(gridDef);
    const fog = new FogOfWar();

    // Re-enter exploration
    explorationController.enterSpace(
      grid, fog, character?.id ?? activeGameState.playerCharacterId, playerStart,
      character?.speed ?? 30, 'bright',
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
      });
      activeGameScreen.setCharacter(character);
    }

    // Update location name, time, and map
    activeGameScreen.setLocationName(dest.name);
    activeGameScreen.updateTime(activeGameState.world.time);
    activeGameScreen.setGameState({
      mode: 'exploration',
      partyMembers: getPartyMembers(engine),
      region,
      currentLocationId: dest.id,
    });

    // Close world map
    activeGameScreen.hideWorldMap();
  });

  // 10. Wire up save game event
  engine.events.on('ui:save_game', () => {
    if (!activeGameState) return;
    saveManager
      .saveGame(activeGameState, engine.entities)
      .then((meta) => {
        console.log(`[One Party] Game saved: ${meta.name}`);
        engine.events.emit({
          type: 'ui:notification',
          category: 'ui',
          data: { message: 'Game saved', style: 'success' },
        });
      })
      .catch((err) => console.error('Save failed:', err));
  });

  // 11. Wire up quick save
  engine.events.on('ui:quick_save', () => {
    if (!activeGameState) return;
    saveManager
      .quickSave(activeGameState, engine.entities)
      .then(() => {
        engine.events.emit({
          type: 'ui:notification',
          category: 'ui',
          data: { message: 'Quick saved', style: 'success' },
        });
      })
      .catch((err) => console.error('Quick save failed:', err));
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
        activeGameState = result.state;

        // Reset so game screen gets re-populated with loaded data
        gamePopulated = false;

        // Re-enable auto-save
        saveManager.enableAutoSave(5 * 60 * 1000, () => ({
          state: result.state,
          entities: engine.entities,
        }));

        engine.events.emit({
          type: 'ui:navigate',
          category: 'ui',
          data: { screen: 'game', direction: 'left' },
        });
      })
      .catch((err) => console.error('Load failed:', err));
  });

  // 13. Wire up return to menu
  engine.events.on('ui:return_to_menu', () => {
    saveManager.disableAutoSave();
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

  // 15. Check if saves exist (to enable/disable menu buttons via storage)
  const hasSaves = await saveManager.hasSaves();
  if (hasSaves) {
    // Store a flag so MenuScreen can detect saves
    localStorage.setItem('oneparty-saves', 'true');
  } else {
    localStorage.removeItem('oneparty-saves');
  }

  // 16. Show menu screen
  await ui.switchScreen('menu');

  // 17. Start the engine loop
  engine.start();
}

main().catch(console.error);
