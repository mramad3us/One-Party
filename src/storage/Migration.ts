import type { SerializedGameState } from '@/types';

type MigrationFn = (data: SerializedGameState) => SerializedGameState;

/** Current save format version. Bump when the schema changes. */
const CURRENT_VERSION = 2;

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

// v1 -> v2: Slot-based inventory + purse-only coins
Migration.register(1, (data) => {
  // Migrate all character entities
  const entities = (data.entities ?? []) as Record<string, unknown>[];
  for (const entity of entities) {
    if (entity.type !== 'character') continue;
    const inv = entity.inventory as Record<string, unknown> | undefined;
    if (!inv) continue;

    // Add maxSlots
    if (!inv.maxSlots) inv.maxSlots = 16;

    // Move loose coins into first purse that has space
    const looseGold = (inv.gold as number) ?? 0;
    const looseSilver = (inv.silver as number) ?? 0;
    const looseCopper = (inv.copper as number) ?? 0;

    if (looseGold > 0 || looseSilver > 0 || looseCopper > 0) {
      const items = inv.items as { itemId: string; quantity: number; coins?: { gold: number; silver: number; copper: number } }[];
      // Find first purse/container
      let deposited = false;
      for (const item of items) {
        if (item.coins !== undefined) {
          // This is a purse — add loose coins to it
          item.coins.gold += looseGold;
          item.coins.silver += looseSilver;
          item.coins.copper += looseCopper;
          deposited = true;
          break;
        }
      }
      // If no purse found, create one
      if (!deposited) {
        items.push({
          itemId: 'item_purse',
          quantity: 1,
          coins: { gold: looseGold, silver: looseSilver, copper: looseCopper },
        });
      }
    }

    // Clear loose coin fields
    delete inv.gold;
    delete inv.silver;
    delete inv.copper;
    delete inv.capacity;
    delete inv.currentWeight;
  }
  return data;
});
