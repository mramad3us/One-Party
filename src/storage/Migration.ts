import type { SerializedGameState } from '@/types';

type MigrationFn = (data: SerializedGameState) => SerializedGameState;

/** Current save format version. Bump when the schema changes. */
const CURRENT_VERSION = 1;

/**
 * Schema versioning for forward compatibility.
 * Each registered migration upgrades from version N to N+1.
 */
export class Migration {
  private static migrations: Map<number, MigrationFn> = new Map();

  /** Register a migration that upgrades from `fromVersion` to `fromVersion + 1`. */
  static register(fromVersion: number, migration: MigrationFn): void {
    Migration.migrations.set(fromVersion, migration);
  }

  /**
   * Apply all migrations from `fromVersion` up to `toVersion`.
   * Each step calls the registered migration for that version.
   */
  static migrate(
    data: SerializedGameState,
    fromVersion: number,
    toVersion: number,
  ): SerializedGameState {
    let current = data;

    for (let v = fromVersion; v < toVersion; v++) {
      const fn = Migration.migrations.get(v);
      if (!fn) {
        throw new Error(
          `No migration registered for version ${v} -> ${v + 1}`,
        );
      }
      current = fn(current);
    }

    return current;
  }

  /** The latest save format version. */
  static getCurrentVersion(): number {
    return CURRENT_VERSION;
  }
}

// Register initial migration (v0 -> v1 is identity)
Migration.register(0, (data) => data);
