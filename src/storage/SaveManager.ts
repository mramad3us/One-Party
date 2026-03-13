import type { SaveMeta, SaveData, SerializedGameState, Entity } from '@/types';
import type { EntityManager } from '@/engine/EntityManager';
import { GameState } from '@/state/GameState';
import { generateId } from '@/engine/IdGenerator';
import { StorageEngine } from './StorageEngine';
import { Migration } from './Migration';

/**
 * High-level save/load logic built on top of StorageEngine.
 * Handles serialization, auto-save, and migration.
 */
export class SaveManager {
  private storage: StorageEngine;
  private autoSaveTimer: ReturnType<typeof setInterval> | null = null;

  constructor(storage: StorageEngine) {
    this.storage = storage;
  }

  async init(): Promise<void> {
    await this.storage.init();
  }

  // ── Save ──

  /** Save the game with an optional custom name. */
  async saveGame(
    gameState: GameState,
    entities: EntityManager,
    name?: string,
  ): Promise<SaveMeta> {
    const id = generateId();
    const serialized = this.serializeGameState(gameState, entities);
    const character = entities.getAll('character')[0] as
      | (Entity & { name: string; level: number })
      | undefined;

    const meta: SaveMeta = {
      id,
      name: name ?? `Save — ${new Date().toLocaleDateString()}`,
      characterName: character?.name ?? 'Unknown',
      level: character?.level ?? 1,
      playtime: 0,
      lastSaved: Date.now(),
      version: Migration.getCurrentVersion(),
    };

    const data: SaveData = {
      id,
      version: Migration.getCurrentVersion(),
      state: serialized,
    };

    await this.storage.save(meta, data);
    return meta;
  }

  /** Quick-save overwriting the "quicksave" slot. */
  async quickSave(
    gameState: GameState,
    entities: EntityManager,
  ): Promise<SaveMeta> {
    const serialized = this.serializeGameState(gameState, entities);
    const character = entities.getAll('character')[0] as
      | (Entity & { name: string; level: number })
      | undefined;

    const meta: SaveMeta = {
      id: 'quicksave',
      name: 'Quick Save',
      characterName: character?.name ?? 'Unknown',
      level: character?.level ?? 1,
      playtime: 0,
      lastSaved: Date.now(),
      version: Migration.getCurrentVersion(),
    };

    const data: SaveData = {
      id: 'quicksave',
      version: Migration.getCurrentVersion(),
      state: serialized,
    };

    await this.storage.save(meta, data);
    return meta;
  }

  /** Auto-save overwriting the "autosave" slot. */
  async autoSave(
    gameState: GameState,
    entities: EntityManager,
  ): Promise<SaveMeta> {
    const serialized = this.serializeGameState(gameState, entities);
    const character = entities.getAll('character')[0] as
      | (Entity & { name: string; level: number })
      | undefined;

    const meta: SaveMeta = {
      id: 'autosave',
      name: 'Auto Save',
      characterName: character?.name ?? 'Unknown',
      level: character?.level ?? 1,
      playtime: 0,
      lastSaved: Date.now(),
      version: Migration.getCurrentVersion(),
    };

    const data: SaveData = {
      id: 'autosave',
      version: Migration.getCurrentVersion(),
      state: serialized,
    };

    await this.storage.save(meta, data);
    return meta;
  }

  // ── Load ──

  /** Load a specific save by id. Returns deserialized state or undefined. */
  async loadGame(
    saveId: string,
  ): Promise<{ state: GameState; entities: Record<string, unknown>[] } | undefined> {
    const data = await this.storage.loadSave(saveId);
    if (!data) return undefined;

    let serialized = data.state;

    // Run migrations if needed
    const currentVersion = Migration.getCurrentVersion();
    if (data.version < currentVersion) {
      serialized = Migration.migrate(serialized, data.version, currentVersion);
    }

    return this.deserializeGameState(serialized);
  }

  /** Load the most recently saved game. */
  async loadMostRecent(): Promise<{
    state: GameState;
    entities: Record<string, unknown>[];
  } | undefined> {
    const meta = await this.storage.getMostRecentSave();
    if (!meta) return undefined;
    return this.loadGame(meta.id);
  }

  // ── Management ──

  /** List all saves sorted by most recent first. */
  async listSaves(): Promise<SaveMeta[]> {
    return this.storage.listSaves();
  }

  /** Delete a save by id. */
  async deleteSave(id: string): Promise<void> {
    return this.storage.deleteSave(id);
  }

  /** Check whether any saves exist. */
  async hasSaves(): Promise<boolean> {
    return this.storage.hasSaves();
  }

  // ── Auto-save control ──

  /** Start periodic auto-saves. */
  enableAutoSave(
    intervalMs: number,
    getState: () => { state: GameState; entities: EntityManager },
  ): void {
    this.disableAutoSave();

    this.autoSaveTimer = setInterval(() => {
      const { state, entities } = getState();
      this.autoSave(state, entities).catch((err) =>
        console.error('Auto-save failed:', err),
      );
    }, intervalMs);
  }

  /** Stop periodic auto-saves. */
  disableAutoSave(): void {
    if (this.autoSaveTimer !== null) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  // ── Serialization helpers ──

  /** Convert live GameState + entities into a plain JSON-safe object. */
  private serializeGameState(
    state: GameState,
    entities: EntityManager,
  ): SerializedGameState {
    const allEntities = entities.query(() => true);

    return {
      gameState: state.serialize(),
      entities: allEntities.map((e) => ({ ...e })),
    };
  }

  /** Reconstruct a GameState and entity list from serialized data. */
  private deserializeGameState(
    data: SerializedGameState,
  ): { state: GameState; entities: Record<string, unknown>[] } {
    const gameStateData = data['gameState'] as SerializedGameState;
    const entitiesData = (data['entities'] as Record<string, unknown>[]) ?? [];

    const state = GameState.deserialize(gameStateData);

    return { state, entities: entitiesData };
  }
}
