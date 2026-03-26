import type { Inventory } from '@/types';

/** D&D 5e exchange rates: 1 gp = 10 sp = 100 cp */
const COPPER_PER_SILVER = 10;
const COPPER_PER_GOLD = 100;

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
export function fromCopper(copper: number): { gold: number; silver: number; copper: number } {
  const gold = Math.floor(copper / COPPER_PER_GOLD);
  copper -= gold * COPPER_PER_GOLD;
  const silver = Math.floor(copper / COPPER_PER_SILVER);
  copper -= silver * COPPER_PER_SILVER;
  return { gold, silver, copper };
}

/**
 * Check whether an inventory's coin purse can cover a cost expressed in copper.
 */
export function canAfford(inventory: Inventory, costInCopper: number): boolean {
  const total = totalInCopper(inventory.gold, inventory.silver, inventory.copper);
  return total >= costInCopper;
}

/**
 * Deduct a cost (in copper) from an inventory, converting denominations as
 * needed.  Mutates the inventory in place.
 *
 * Returns `false` if the player cannot afford the cost (inventory unchanged).
 */
export function deduct(inventory: Inventory, costInCopper: number): boolean {
  const total = totalInCopper(inventory.gold, inventory.silver, inventory.copper);
  if (total < costInCopper) return false;

  const remaining = fromCopper(total - costInCopper);
  inventory.gold = remaining.gold;
  inventory.silver = remaining.silver;
  inventory.copper = remaining.copper;
  return true;
}

/**
 * Add coins to an inventory.  Any of the denomination amounts may be 0.
 * Mutates the inventory in place.
 */
export function addGold(
  inventory: Inventory,
  amount: { gold?: number; silver?: number; copper?: number },
): void {
  inventory.gold += amount.gold ?? 0;
  inventory.silver += amount.silver ?? 0;
  inventory.copper += amount.copper ?? 0;
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

/**
 * Convert a CoinValue to its copper equivalent (convenience wrapper).
 */
export function coinValueToCopper(value: { gold: number; silver: number; copper: number }): number {
  return totalInCopper(value.gold, value.silver, value.copper);
}
