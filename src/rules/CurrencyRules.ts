import type { Inventory, InventoryEntry, PurseContents } from '@/types';
import { getItem } from '@/data/items';

/** D&D 5e exchange rates: 1 gp = 10 sp = 100 cp */
const COPPER_PER_SILVER = 10;
const COPPER_PER_GOLD = 100;

// ── Basic conversion helpers ────────────────────────────────────────

/**
 * Convert a mixed-denomination purse to its total value in copper pieces.
 */
export function totalInCopper(gold: number, silver: number, copper: number): number {
  return gold * COPPER_PER_GOLD + silver * COPPER_PER_SILVER + copper;
}

/**
 * Convert a copper total back into the largest denominations possible.
 * Returns { gold, silver, copper }.
 */
export function fromCopper(total: number): { gold: number; silver: number; copper: number } {
  const gold = Math.floor(total / COPPER_PER_GOLD);
  total -= gold * COPPER_PER_GOLD;
  const silver = Math.floor(total / COPPER_PER_SILVER);
  total -= silver * COPPER_PER_SILVER;
  return { gold, silver, copper: total };
}

/**
 * Convert a CoinValue to its copper equivalent (convenience wrapper).
 */
export function coinValueToCopper(value: { gold: number; silver: number; copper: number }): number {
  return totalInCopper(value.gold, value.silver, value.copper);
}

/**
 * Format a coin amount as a human-readable string like "5 gp, 3 sp, 2 cp".
 * Omits denominations that are zero.
 */
export function formatCurrency(gold: number, silver: number, copper: number): string {
  const parts: string[] = [];
  if (gold > 0) parts.push(`${gold} gp`);
  if (silver > 0) parts.push(`${silver} sp`);
  if (copper > 0) parts.push(`${copper} cp`);
  return parts.length > 0 ? parts.join(', ') : '0 cp';
}

// ── Purse helpers ───────────────────────────────────────────────────

/** Total number of individual coins in a PurseContents (count, not value). */
export function coinCount(coins: PurseContents): number {
  return coins.gold + coins.silver + coins.copper;
}

/** Get the coin capacity of a container item. Returns 0 if not a container. */
export function getContainerCapacity(itemId: string): number {
  const item = getItem(itemId);
  if (!item || item.itemType !== 'container') return 0;
  const props = item.properties as { coinCapacity?: number };
  return props.coinCapacity ?? 0;
}

/** Find all purse (container) entries in an inventory that have coins storage. */
export function getPurses(inventory: Inventory): InventoryEntry[] {
  return inventory.items.filter((entry) => {
    const item = getItem(entry.itemId);
    return item?.itemType === 'container' && getContainerCapacity(entry.itemId) > 0;
  });
}

/** Ensure a purse entry has an initialized coins object. */
function ensureCoins(entry: InventoryEntry): PurseContents {
  if (!entry.coins) {
    entry.coins = { gold: 0, silver: 0, copper: 0 };
  }
  return entry.coins;
}

/** Remaining coin slots in a purse entry. */
export function purseSpace(entry: InventoryEntry): number {
  const capacity = getContainerCapacity(entry.itemId);
  const coins = entry.coins ?? { gold: 0, silver: 0, copper: 0 };
  return Math.max(0, capacity - coinCount(coins));
}

// ── Inventory-wide coin totals ──────────────────────────────────────

/** Total copper value of ALL coins the player holds (purses only). */
export function totalPlayerCopper(inventory: Inventory): number {
  let total = 0;
  for (const purse of getPurses(inventory)) {
    const c = purse.coins ?? { gold: 0, silver: 0, copper: 0 };
    total += totalInCopper(c.gold, c.silver, c.copper);
  }
  return total;
}

/** Total coins across all purses, broken out by denomination. */
export function totalPlayerDenominations(inventory: Inventory): PurseContents {
  let gold = 0;
  let silver = 0;
  let copper = 0;
  for (const purse of getPurses(inventory)) {
    const c = purse.coins ?? { gold: 0, silver: 0, copper: 0 };
    gold += c.gold;
    silver += c.silver;
    copper += c.copper;
  }
  return { gold, silver, copper };
}

/** Total remaining coin space across all purses. */
export function totalPurseSpace(inventory: Inventory): number {
  let space = 0;
  for (const purse of getPurses(inventory)) {
    space += purseSpace(purse);
  }
  return space;
}

// ── Affordability ───────────────────────────────────────────────────

/**
 * Check whether the player can afford a cost expressed in copper.
 * Sums across all purses + loose coins.
 */
export function canAfford(inventory: Inventory, costInCopper: number): boolean {
  return totalPlayerCopper(inventory) >= costInCopper;
}

// ── Adding coins ────────────────────────────────────────────────────

/**
 * Add coins to inventory — fills purses only. Returns any overflow that didn't fit.
 * Coins are added in their given denomination (no auto-conversion).
 * Mutates the inventory in place.
 */
export function addCoins(
  inventory: Inventory,
  amount: { gold?: number; silver?: number; copper?: number },
): PurseContents {
  let goldToAdd = amount.gold ?? 0;
  let silverToAdd = amount.silver ?? 0;
  let copperToAdd = amount.copper ?? 0;

  const purses = getPurses(inventory);

  // Try to fill purses (gold first — most valuable gets priority for limited space)
  for (const purse of purses) {
    const coins = ensureCoins(purse);
    const space = purseSpace(purse);
    if (space <= 0) continue;

    // Gold
    const goldFit = Math.min(goldToAdd, space);
    coins.gold += goldFit;
    goldToAdd -= goldFit;
    const spaceAfterGold = space - goldFit;

    // Silver
    const silverFit = Math.min(silverToAdd, spaceAfterGold);
    coins.silver += silverFit;
    silverToAdd -= silverFit;
    const spaceAfterSilver = spaceAfterGold - silverFit;

    // Copper
    const copperFit = Math.min(copperToAdd, spaceAfterSilver);
    coins.copper += copperFit;
    copperToAdd -= copperFit;

    if (goldToAdd === 0 && silverToAdd === 0 && copperToAdd === 0) break;
  }

  // Return overflow — callers decide what to do with coins that didn't fit
  return { gold: goldToAdd, silver: silverToAdd, copper: copperToAdd };
}

/**
 * Legacy alias — adds coins to inventory (purse-aware).
 */
export function addGold(
  inventory: Inventory,
  amount: { gold?: number; silver?: number; copper?: number },
): void {
  addCoins(inventory, amount);
}

// ── Deducting coins ─────────────────────────────────────────────────

/**
 * A mutable coin source for the deduction algorithm.
 * Points back to either a purse entry's coins or the inventory's loose coins.
 */
interface CoinSource {
  coins: PurseContents;
}

/**
 * Deduct a cost (in copper) from the player's coin holdings.
 * Spends smallest denominations first (copper → silver → gold).
 * When breaking a larger coin, change is returned as the next-lower denomination.
 * Never consolidates upward (that's the banker's job).
 *
 * Mutates the inventory in place.
 * Returns `false` if the player cannot afford the cost (inventory unchanged).
 */
export function deduct(inventory: Inventory, costInCopper: number): boolean {
  if (!canAfford(inventory, costInCopper)) return false;

  // Build ordered list of coin sources (purses only)
  const sources: CoinSource[] = [];
  for (const purse of getPurses(inventory)) {
    sources.push({ coins: ensureCoins(purse) });
  }

  let remaining = costInCopper;

  // Phase 1: spend copper (1:1)
  for (const src of sources) {
    if (remaining <= 0) break;
    const spend = Math.min(src.coins.copper, remaining);
    src.coins.copper -= spend;
    remaining -= spend;
  }

  // Phase 2: spend silver (1 silver = 10 copper)
  if (remaining > 0) {
    for (const src of sources) {
      if (remaining <= 0) break;
      const silverNeeded = Math.ceil(remaining / COPPER_PER_SILVER);
      const spend = Math.min(src.coins.silver, silverNeeded);
      if (spend === 0) continue;
      const copperValue = spend * COPPER_PER_SILVER;
      src.coins.silver -= spend;
      const overpay = copperValue - remaining;
      remaining = 0;
      if (overpay > 0) {
        // Change returned as copper — add back to this same source
        src.coins.copper += overpay;
      }
    }
  }

  // Phase 3: spend gold (1 gold = 100 copper)
  if (remaining > 0) {
    for (const src of sources) {
      if (remaining <= 0) break;
      const goldNeeded = Math.ceil(remaining / COPPER_PER_GOLD);
      const spend = Math.min(src.coins.gold, goldNeeded);
      if (spend === 0) continue;
      const copperValue = spend * COPPER_PER_GOLD;
      src.coins.gold -= spend;
      const overpay = copperValue - remaining;
      remaining = 0;
      if (overpay > 0) {
        // Change as silver + copper (never consolidate upward)
        const changeSilver = Math.floor(overpay / COPPER_PER_SILVER);
        const changeCopper = overpay % COPPER_PER_SILVER;
        src.coins.silver += changeSilver;
        src.coins.copper += changeCopper;
      }
    }
  }

  return true;
}

// ── Banker: coin optimization ───────────────────────────────────────

/**
 * Optimize all coin denominations across purses — the banker's service.
 * Collects ALL coins (purses + loose), converts to optimal denominations
 * (fewest coins), then redistributes into purses. Any overflow stays loose.
 *
 * Returns a summary of the exchange for display purposes.
 */
export function optimizeCoins(inventory: Inventory): {
  before: PurseContents;
  after: PurseContents;
  coinsSaved: number;
} {
  // Collect all coins
  const before = totalPlayerDenominations(inventory);
  const totalCopper = totalInCopper(before.gold, before.silver, before.copper);
  const after = fromCopper(totalCopper);
  const coinsSaved = coinCount(before) - coinCount(after);

  // Zero out purses
  for (const purse of getPurses(inventory)) {
    purse.coins = { gold: 0, silver: 0, copper: 0 };
  }

  // Redistribute optimized coins into purses
  addCoins(inventory, after);

  return { before, after, coinsSaved };
}
