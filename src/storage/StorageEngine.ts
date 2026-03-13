import type { SaveMeta, SaveData } from '@/types';

const DB_NAME = 'one-party';
const DB_VERSION = 1;

const STORE_SAVE_META = 'save-meta';
const STORE_SAVE_DATA = 'save-data';
const STORE_SETTINGS = 'settings';

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

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(STORE_SAVE_META)) {
          db.createObjectStore(STORE_SAVE_META, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_SAVE_DATA)) {
          db.createObjectStore(STORE_SAVE_DATA, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
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
