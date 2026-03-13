/** Metadata for a save slot (displayed in load screen) */
export type SaveMeta = {
  id: string;
  name: string;
  characterName: string;
  level: number;
  /** Total playtime in seconds */
  playtime: number;
  /** Unix timestamp (ms) of last save */
  lastSaved: number;
  /** Schema version for migration */
  version: number;
};

/**
 * Intentionally loose — the actual serialization format
 * is defined by GameState. This avoids circular type dependencies.
 */
export type SerializedGameState = Record<string, unknown>;

/** The actual save payload stored in localStorage */
export type SaveData = {
  id: string;
  version: number;
  state: SerializedGameState;
};

/** Full export bundle for file-based save/load */
export type ExportData = {
  header: {
    version: number;
    exportedAt: number;
    checksum: string;
  };
  save: SaveData;
  meta: SaveMeta;
};
