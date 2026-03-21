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
import { LocalMapGenerator } from '@/world/LocalMapGenerator';
import { WorldCreationScreen } from '@/ui/screens/WorldCreationScreen';
import { overworldToWorld } from '@/world/OverworldBridge';
import type { OverworldData } from '@/types/overworld';
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
import { Modal } from '@/ui/widgets/Modal';
import { el } from '@/utils/dom';
import type { SaveMeta, EquipmentSlots } from '@/types';
import { EquipmentRules } from '@/rules/EquipmentRules';
import { RestRules } from '@/rules/RestRules';

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
  let activeDice: DiceRoller | null = null;
  let activeOverworld: OverworldData | null = null;
  const narrator = new TextNarrativeEngine();
  const equipmentRules = new EquipmentRules();

  // 7. Register screens
  ui.registerScreen('worldcreation', () => new WorldCreationScreen(container, engine));
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
    activeDice = dice;

    // Create character via factory
    const factory = new CharacterFactory(dice);
    const character: Character = factory.create({
      name,
      raceId: race,
      classId: classId,
      abilityScores,
      skills,
    });

    // Bridge overworld to World/Region/Location hierarchy
    if (!activeOverworld) {
      throw new Error('No world generated — create a world first');
    }
    const { world, startLocationId } = overworldToWorld(activeOverworld, rng);

    // Create game state
    const gameState = new GameState(world, character.id, startLocationId);
    activeGameState = gameState;

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
    invScreen.setEquipment(character.equipment, itemMap);
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
      const props = item.properties as ConsumableProperties;
      const hungerBefore = character.survival.hunger;
      const thirstBefore = character.survival.thirst;
      SurvivalRules.consume(character.survival, props);

      // Remove from inventory
      const invEntry = character.inventory.items.find(e => e.itemId === itemId);
      if (invEntry) {
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

    // Generate or restore local map for current location
    let gridDef: import('@/types').GridDefinition;
    let playerStart: import('@/types').Coordinate;
    const fog = new FogOfWar();

    if (location.localMap) {
      // Restore persisted map state
      gridDef = location.localMap.grid;
      playerStart = location.localMap.playerStart;
      // Restore fog of war explored cells
      if (location.localMap.exploredCells.length > 0) {
        fog.setState({
          explored: new Set(location.localMap.exploredCells),
          visible: new Set(),
        });
      }
    } else {
      // First visit — generate new local map
      const rng = activeRng ?? new SeededRNG(Date.now());
      const mapGen = new LocalMapGenerator(rng);
      const result = mapGen.generate(location.locationType, region.biome);
      gridDef = result.grid;
      playerStart = result.playerStart;
      // Store in location for persistence
      location.localMap = { grid: gridDef, playerStart, exploredCells: [] };
    }

    const grid = new Grid(gridDef);

    // Use saved character position if available, otherwise default start
    const spawnPos = character.position ?? playerStart;

    // Configure exploration controller
    explorationController.configure({
      gameState: state,
      getCharacter: () => eng.entities.getAll<Character>('character')[0] ?? null,
    });

    // Enter local exploration
    explorationController.enterSpace(
      grid, fog, character.id, spawnPos,
      character.speed, 'bright',
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
    };
    screen.updatePlayerEntity(character.id, spawnPos, playerInfo);

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
      { key: 'r',   label: 'Rest',      available: true, category: 'action' },
      { key: '>',   label: 'Descend',   available: true, category: 'action' },
      { key: '<',   label: 'Ascend',    available: true, category: 'action' },
      { key: 'i',   label: 'Inventory', available: true, category: 'meta' },
      { key: 'c',   label: 'Character', available: true, category: 'meta' },
      { key: 'm',   label: 'World Map', available: true, category: 'meta' },
      { key: '?',   label: 'Help',      available: true, category: 'meta' },
      { key: 'Esc', label: 'Cancel',    available: true, category: 'meta' },
    ];
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
      // Persist grid state (door changes etc.)
      const gridDef = explorationController.getGridDefinition();
      if (gridDef) {
        location.localMap.grid = gridDef;
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

  // ── Rest Menu ──
  engine.events.on('input:rest', () => {
    if (!activeGameScreen || !activeGameState || !activeDice) return;
    openRestMenu(engine, activeGameState, activeGameScreen, activeDice, saveManager);
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

    // Generate or restore local map for destination
    let gridDef: import('@/types').GridDefinition;
    let playerStart: import('@/types').Coordinate;
    const fog = new FogOfWar();

    if (dest.localMap) {
      gridDef = dest.localMap.grid;
      playerStart = dest.localMap.playerStart;
      if (dest.localMap.exploredCells.length > 0) {
        fog.setState({ explored: new Set(dest.localMap.exploredCells), visible: new Set() });
      }
    } else {
      const rng = activeRng ?? new SeededRNG(Date.now());
      const mapGen = new LocalMapGenerator(rng);
      const result = mapGen.generate(dest.locationType, region.biome);
      gridDef = result.grid;
      playerStart = result.playerStart;
      dest.localMap = { grid: gridDef, playerStart, exploredCells: [] };
    }

    const grid = new Grid(gridDef);

    // Clear saved position when traveling (new location = new start)
    if (character) character.position = null;

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

  // 15. Wire world creation and deletion events
  engine.events.on('world:created', async (event) => {
    const { overworld } = event.data as { overworld: OverworldData };
    activeOverworld = overworld;
    await storage.saveWorld(overworld);
    console.log(`[One Party] World "${overworld.name}" saved (${overworld.width}×${overworld.height})`);

    // Navigate to menu
    engine.events.emit({
      type: 'ui:navigate',
      category: 'ui',
      data: { screen: 'menu', direction: 'left' },
    });
  });

  engine.events.on('world:delete', async () => {
    // Confirm with the player
    const confirmed = await Modal.confirm(
      engine,
      'This will permanently destroy the world and all saved games. Are you sure?',
      'Delete World',
    );
    if (!confirmed) return;

    // Delete world and all saves
    await storage.deleteWorld();
    await storage.deleteAllSaves();
    localStorage.removeItem('oneparty-saves');
    activeOverworld = null;
    activeGameState = null;
    gamePopulated = false;
    engine.entities.clear();

    engine.events.emit({
      type: 'ui:navigate',
      category: 'ui',
      data: { screen: 'worldcreation', direction: 'right' },
    });
  });

  // 16. Check world and saves, decide what to show first
  const hasWorld = await storage.hasWorld();

  if (hasWorld) {
    activeOverworld = (await storage.loadWorld()) ?? null;

    const hasSaves = await saveManager.hasSaves();
    if (hasSaves) {
      localStorage.setItem('oneparty-saves', 'true');
    } else {
      localStorage.removeItem('oneparty-saves');
    }

    await ui.switchScreen('menu');
  } else {
    // No world yet — show world creation screen
    localStorage.removeItem('oneparty-saves');
    await ui.switchScreen('worldcreation');
  }

  // 17. Start the engine loop
  engine.start();
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
  shortBtn.addEventListener('click', () => {
    const hdToSpend = parseInt(hdSelect.value, 10);
    const result = restRules.shortRest(character, hdToSpend);

    // Advance time by 1 hour
    gameState.advanceTime(ROUNDS_PER_HOUR);
    // Tick survival for 1 hour
    const tickResult = SurvivalRules.tick(character.survival, ROUNDS_PER_HOUR);

    // Build narrative
    const parts: string[] = [];
    parts.push('You settle down for a short rest, catching your breath and tending to your wounds.');
    if (result.hpHealed > 0) {
      parts.push(`You spend ${result.hitDiceUsed} Hit ${result.hitDiceUsed === 1 ? 'Die' : 'Dice'} and recover ${result.hpHealed} hit points.`);
    } else if (hdToSpend === 0) {
      parts.push('You rest without spending any Hit Dice.');
    }
    if (result.featuresRecharged.length > 0) {
      parts.push(`Recharged: ${result.featuresRecharged.join(', ')}.`);
    }
    if (tickResult.hungerCrossing) {
      parts.push(`You feel ${SurvivalRules.formatThreshold(tickResult.hungerCrossing.to)}.`);
    }
    if (tickResult.thirstCrossing) {
      parts.push(`Your throat grows ${SurvivalRules.formatThreshold(tickResult.thirstCrossing.to)}.`);
    }

    gameScreen.addNarrative({ text: parts.join(' '), category: 'system' });
    gameScreen.setCharacter(character);
    gameScreen.updateTime(gameState.world.time);

    // Check time transitions
    const timeBefore = { totalRounds: gameState.world.time.totalRounds - ROUNDS_PER_HOUR };
    const transition = TimeNarrator.describeTimeTransition(timeBefore, gameState.world.time);
    if (transition) {
      gameScreen.addNarrative({ text: transition, category: 'description' });
    }

    // Autosave
    saveManager.autoSave(gameState, engine.entities).catch(() => {});
    modal.close();
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
    return item && item.itemType === 'food' && e.quantity > 0;
  });
  const hasWater = character.inventory.items.some(e => {
    const item = getItem(e.itemId);
    return item && item.itemType === 'drink' && e.quantity > 0;
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

  longBtn.addEventListener('click', () => {
    const result = restRules.longRest(character);

    // Consume 1 food + 1 drink if available (5e: need food/water during long rest)
    if (hasFood) {
      const foodEntry = character.inventory.items.find(e => {
        const item = getItem(e.itemId);
        return item && item.itemType === 'food';
      });
      if (foodEntry) {
        foodEntry.quantity -= 1;
        if (foodEntry.quantity <= 0) {
          character.inventory.items = character.inventory.items.filter(e => e !== foodEntry);
        }
      }
    }
    if (hasWater) {
      const waterEntry = character.inventory.items.find(e => {
        const item = getItem(e.itemId);
        return item && item.itemType === 'drink';
      });
      if (waterEntry) {
        waterEntry.quantity -= 1;
        if (waterEntry.quantity <= 0) {
          character.inventory.items = character.inventory.items.filter(e => e !== waterEntry);
        }
      }
    }

    // Advance time by 8 hours
    const longRestRounds = ROUNDS_PER_HOUR * 8;
    gameState.advanceTime(longRestRounds);

    // Tick survival for 8 hours (hunger/thirst advance, but fatigue resets)
    SurvivalRules.tick(character.survival, longRestRounds);
    // Then reset fatigue (long rest overrides fatigue)
    SurvivalRules.rest(character.survival);

    // If no food/water was available, add exhaustion
    if (!hasFood || !hasWater) {
      character.survival.exhaustionLevel = Math.min(6, character.survival.exhaustionLevel + 1);
    }

    // Build narrative
    const parts: string[] = [];
    parts.push('You make camp and settle in for a long rest. The hours pass as your body mends itself through deep, restorative sleep.');
    if (result.hpHealed > 0) {
      parts.push(`You awaken fully restored, recovering ${result.hpHealed} hit points.`);
    } else {
      parts.push('You awaken feeling refreshed.');
    }
    if (result.hitDiceRecovered > 0) {
      parts.push(`You recover ${result.hitDiceRecovered} Hit ${result.hitDiceRecovered === 1 ? 'Die' : 'Dice'}.`);
    }
    if (result.spellSlotsRecovered) {
      parts.push('Your magical reserves are fully replenished.');
    }
    if (result.featuresRecharged.length > 0) {
      parts.push(`Abilities recharged: ${result.featuresRecharged.join(', ')}.`);
    }
    if (hasFood && hasWater) {
      parts.push('You eat a meal and drink deeply before breaking camp.');
    } else {
      parts.push('Your stomach growls — you had no proper provisions. The lack of sustenance takes its toll.');
    }

    gameScreen.addNarrative({ text: parts.join(' '), category: 'system' });
    gameScreen.setCharacter(character);
    gameScreen.updateTime(gameState.world.time);

    // Check time transitions
    const timeBefore = { totalRounds: gameState.world.time.totalRounds - longRestRounds };
    const transition = TimeNarrator.describeTimeTransition(timeBefore, gameState.world.time);
    if (transition) {
      gameScreen.addNarrative({ text: transition, category: 'description' });
    }

    // Autosave
    saveManager.autoSave(gameState, engine.entities).catch(() => {});
    modal.close();
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

main().catch(console.error);
