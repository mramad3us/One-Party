import './styles/main.css';

import type { AbilityScores, Character, Entity, Skill } from '@/types';
import { GameEngine } from '@/engine/GameEngine';
import { GameState } from '@/state/GameState';
import { IconSystem } from '@/ui/IconSystem';
import { TooltipSystem } from '@/ui/TooltipSystem';
import { UIManager } from '@/ui/UIManager';
import { MenuScreen } from '@/ui/screens/MenuScreen';
import { CreationScreen } from '@/ui/screens/CreationScreen';
import { StorageEngine } from '@/storage/StorageEngine';
import { SaveManager } from '@/storage/SaveManager';
import { CharacterFactory } from '@/character/CharacterFactory';
import { WorldGenerator } from '@/world/WorldGenerator';
import { SeededRNG } from '@/utils/SeededRNG';
import { DiceRoller } from '@/rules/DiceRoller';

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

  // 5. Get the app container
  const container = document.getElementById('app');
  if (!container) {
    throw new Error('#app container not found');
  }

  // 6. Create UI manager
  const ui = new UIManager(container, engine);

  // Track active game state
  let activeGameState: GameState | null = null;

  // 7. Register screens
  ui.registerScreen('menu', () => new MenuScreen(container, engine));
  ui.registerScreen('creation', () => new CreationScreen(container, engine));

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
