import type { SaveMeta, SaveData } from '@/types';
import type { OverworldData } from '@/types/overworld';
import type { Universe } from '@/types/universe';

const DB_NAME = 'one-party';
const DB_VERSION = 3;

const STORE_SAVE_META = 'save-meta';
const STORE_SAVE_DATA = 'save-data';
const STORE_SETTINGS = 'settings';
const STORE_WORLD = 'world';
const STORE_UNIVERSE = 'universe';

/**
 * IndexedDB wrapper providing async access to save data,
 * save metadata, and user settings.
 */
export class StorageEngine {
  private db: IDBDatabase | null = null;

  /** Open (or create) the IndexedDB database and set up object stores. */
  async init(): Promise<void> {
    if (this.db) return;

    this.db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = request.result;
        const oldVersion = (event as IDBVersionChangeEvent).oldVersion;

        if (oldVersion < 1) {
          db.createObjectStore(STORE_SAVE_META, { keyPath: 'id' });
          db.createObjectStore(STORE_SAVE_DATA, { keyPath: 'id' });
          db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
        }
        if (oldVersion < 2) {
          db.createObjectStore(STORE_WORLD, { keyPath: 'id' });
        }
        if (oldVersion < 3) {
          db.createObjectStore(STORE_UNIVERSE, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /** Close the database connection. */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // ── Saves ──

  /** List all save metadata, sorted by lastSaved descending. */
  async listSaves(): Promise<SaveMeta[]> {
    const tx = this.transaction(STORE_SAVE_META, 'readonly');
    const store = tx.objectStore(STORE_SAVE_META);
    const all = await this.request<SaveMeta[]>(store.getAll());
    return all.sort((a, b) => b.lastSaved - a.lastSaved);
  }

  /** Get metadata for a single save. */
  async getSaveMeta(id: string): Promise<SaveMeta | undefined> {
    const tx = this.transaction(STORE_SAVE_META, 'readonly');
    const store = tx.objectStore(STORE_SAVE_META);
    const result = await this.request<SaveMeta | undefined>(store.get(id));
    return result ?? undefined;
  }

  /** Persist both metadata and full save data in a single transaction. */
  async save(meta: SaveMeta, data: SaveData): Promise<void> {
    const tx = this.transaction([STORE_SAVE_META, STORE_SAVE_DATA], 'readwrite');
    const metaStore = tx.objectStore(STORE_SAVE_META);
    const dataStore = tx.objectStore(STORE_SAVE_DATA);

    metaStore.put(meta);
    dataStore.put(data);

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /** Load full save data by id. */
  async loadSave(id: string): Promise<SaveData | undefined> {
    const tx = this.transaction(STORE_SAVE_DATA, 'readonly');
    const store = tx.objectStore(STORE_SAVE_DATA);
    const result = await this.request<SaveData | undefined>(store.get(id));
    return result ?? undefined;
  }

  /** Delete a save (both meta and data). */
  async deleteSave(id: string): Promise<void> {
    const tx = this.transaction([STORE_SAVE_META, STORE_SAVE_DATA], 'readwrite');
    const metaStore = tx.objectStore(STORE_SAVE_META);
    const dataStore = tx.objectStore(STORE_SAVE_DATA);

    metaStore.delete(id);
    dataStore.delete(id);

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /** Check whether any saves exist. */
  async hasSaves(): Promise<boolean> {
    const tx = this.transaction(STORE_SAVE_META, 'readonly');
    const store = tx.objectStore(STORE_SAVE_META);
    const count = await this.request<number>(store.count());
    return count > 0;
  }

  /** Get the most recently saved game's metadata. */
  async getMostRecentSave(): Promise<SaveMeta | undefined> {
    const saves = await this.listSaves();
    return saves[0];
  }

  // ── Settings ──

  /** Retrieve a user setting by key. */
  async getSetting<T>(key: string): Promise<T | undefined> {
    const tx = this.transaction(STORE_SETTINGS, 'readonly');
    const store = tx.objectStore(STORE_SETTINGS);
    const result = await this.request<{ key: string; value: T } | undefined>(store.get(key));
    return result?.value;
  }

  /** Store a user setting. */
  async setSetting<T>(key: string, value: T): Promise<void> {
    const tx = this.transaction(STORE_SETTINGS, 'readwrite');
    const store = tx.objectStore(STORE_SETTINGS);
    await this.request(store.put({ key, value }));
  }

  // ── World ──

  /** Save the overworld data (only one world at a time). */
  async saveWorld(data: OverworldData): Promise<void> {
    const tx = this.transaction(STORE_WORLD, 'readwrite');
    const store = tx.objectStore(STORE_WORLD);
    store.put(data);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /** Load the current overworld (returns first record since only one exists). */
  async loadWorld(): Promise<OverworldData | undefined> {
    const tx = this.transaction(STORE_WORLD, 'readonly');
    const store = tx.objectStore(STORE_WORLD);
    const all = await this.request<OverworldData[]>(store.getAll());
    return all[0];
  }

  /** Delete the current world. */
  async deleteWorld(): Promise<void> {
    const tx = this.transaction(STORE_WORLD, 'readwrite');
    const store = tx.objectStore(STORE_WORLD);
    store.clear();
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /** Check whether a world exists. */
  async hasWorld(): Promise<boolean> {
    const tx = this.transaction(STORE_WORLD, 'readonly');
    const store = tx.objectStore(STORE_WORLD);
    const count = await this.request<number>(store.count());
    return count > 0;
  }

  // ── Universe (v2 hierarchical worlds) ──

  /** Save a universe (v2 format). Stores the full inline universe. */
  async saveUniverse(universe: Universe): Promise<void> {
    const tx = this.transaction(STORE_UNIVERSE, 'readwrite');
    const store = tx.objectStore(STORE_UNIVERSE);
    store.put(universe);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /** Load the current universe. */
  async loadUniverse(): Promise<Universe | undefined> {
    const tx = this.transaction(STORE_UNIVERSE, 'readonly');
    const store = tx.objectStore(STORE_UNIVERSE);
    const all = await this.request<Universe[]>(store.getAll());
    return all[0];
  }

  /** Check whether a universe (v2) is stored. */
  async hasUniverse(): Promise<boolean> {
    const tx = this.transaction(STORE_UNIVERSE, 'readonly');
    const store = tx.objectStore(STORE_UNIVERSE);
    const count = await this.request<number>(store.count());
    return count > 0;
  }

  /** Delete the stored universe. */
  async deleteUniverse(): Promise<void> {
    const tx = this.transaction(STORE_UNIVERSE, 'readwrite');
    const store = tx.objectStore(STORE_UNIVERSE);
    store.clear();
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /** Delete all saves (used when deleting a world). */
  async deleteAllSaves(): Promise<void> {
    const tx = this.transaction([STORE_SAVE_META, STORE_SAVE_DATA], 'readwrite');
    tx.objectStore(STORE_SAVE_META).clear();
    tx.objectStore(STORE_SAVE_DATA).clear();
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ── Private helpers ──

  /** Create a transaction over one or more object stores. */
  private transaction(
    stores: string | string[],
    mode: IDBTransactionMode,
  ): IDBTransaction {
    if (!this.db) {
      throw new Error('StorageEngine not initialized — call init() first');
    }
    return this.db.transaction(stores, mode);
  }

  /** Wrap an IDBRequest in a Promise. */
  private request<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}
