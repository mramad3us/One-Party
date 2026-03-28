import type {
  BiomeType,
  Inventory,
  MerchantInventory,
  MerchantItem,
  NPCRole,
  Result,
} from '@/types';
import { getItem } from '@/data/items';
import { canAfford, coinValueToCopper, deduct, addCoins, fromCopper, totalPurseSpace } from '@/rules/CurrencyRules';

// ── Stock tables by merchant role ──────────────────────────────────────

/** Item IDs a general merchant carries */
const GENERAL_STOCK: string[] = [
  'item_rations',
  'item_waterskin',
  'item_torch',
  'item_rope',
  'item_hempen_rope_silk',
  'item_bedroll',
  'item_backpack',
  'item_tinderbox',
  'item_oil_flask',
  'item_chalk',
  'item_purse',
  'item_small_purse',
  'item_belt_pouch',
  'item_money_bag',
  'item_iron_pot',
  'item_manacles',
  'item_arrows_20',
  'item_bolts_20',
  'item_sling_bullets',
  'item_dart',
  'item_caltrops',
  'item_ball_bearings',
  'item_chain_10',
  'item_bell',
  'item_mirror_steel',
  'item_signal_whistle',
  'item_parchment',
  'item_ink_bottle',
  'item_sealing_wax',
  'item_soap',
  'item_mess_kit',
  'item_tent',
  'item_fishing_tackle',
  'item_whetstone',
  'item_lantern_bullseye',
  'item_component_pouch',
  'item_climbers_kit',
];

/** Item IDs a blacksmith carries */
const BLACKSMITH_STOCK: string[] = [
  // Simple weapons
  'item_dagger',
  'item_handaxe',
  'item_javelin',
  'item_light_hammer',
  'item_mace',
  'item_quarterstaff',
  'item_sickle',
  'item_spear',
  'item_club',
  // Martial melee weapons
  'item_shortsword',
  'item_longsword',
  'item_greatsword',
  'item_battleaxe',
  'item_greataxe',
  'item_rapier',
  'item_scimitar',
  'item_warhammer',
  'item_flail',
  'item_morningstar',
  'item_war_pick',
  'item_pike',
  'item_halberd',
  'item_glaive',
  'item_maul',
  'item_trident',
  'item_whip',
  // Ranged weapons
  'item_light_crossbow',
  'item_heavy_crossbow',
  'item_hand_crossbow',
  'item_shortbow',
  'item_longbow',
  'item_sling',
  // Armor
  'item_padded',
  'item_leather',
  'item_studded_leather',
  'item_hide',
  'item_chain_shirt',
  'item_scale_mail',
  'item_breastplate',
  'item_half_plate',
  'item_ring_mail',
  'item_chain_mail',
  'item_splint',
  'item_plate',
  'item_shield',
  // Ammunition
  'item_arrows_20',
  'item_bolts_20',
  'item_sling_bullets',
];

/** Item IDs an apothecary / herbalist carries */
const APOTHECARY_STOCK: string[] = [
  'item_healing_potion',
  'item_greater_healing_potion',
  'item_superior_healing_potion',
  'item_antitoxin',
  'item_alchemist_fire',
  'item_holy_water',
  'item_acid',
  'item_basic_poison',
  'item_potion_fire_resistance',
  'item_potion_climbing',
  'item_healers_kit',
  'item_herbalism_kit',
  'item_holy_symbol',
];

/** Item IDs an innkeeper carries */
const INNKEEPER_STOCK: string[] = [
  'item_ale',
  'item_wine',
  'item_mead',
  'item_dwarven_spirits',
  'item_fresh_water',
  'item_tea_herbal',
  'item_bread_loaf',
  'item_meat_pie',
  'item_stew_bowl',
  'item_dried_meat',
  'item_cheese_wheel',
  'item_dried_fruit',
  'item_smoked_fish',
  'item_honey_cake',
  'item_salted_pork',
  'item_rations',
  'item_waterskin',
];

/** Map merchant-capable roles to their stock tables */
function getStockTable(role: NPCRole): string[] {
  switch (role) {
    case 'merchant':
      return GENERAL_STOCK;
    case 'blacksmith':
      return BLACKSMITH_STOCK;
    case 'innkeeper':
      return INNKEEPER_STOCK;
    case 'priest':
      return APOTHECARY_STOCK;
    default:
      return GENERAL_STOCK;
  }
}

/** Baseline gold a merchant has to buy from the player, by role */
function baseMerchantGold(role: NPCRole): number {
  switch (role) {
    case 'blacksmith':
      return 250;
    case 'merchant':
      return 200;
    case 'innkeeper':
      return 50;
    case 'priest':
      return 100;
    default:
      return 100;
  }
}

// ── Biome-flavored extras ──────────────────────────────────────────────

const BIOME_EXTRAS: Partial<Record<BiomeType, string[]>> = {
  desert: ['item_waterskin', 'item_fresh_water', 'item_tent'],
  tundra: ['item_tinderbox', 'item_oil_flask', 'item_bedroll', 'item_tent', 'item_dwarven_spirits'],
  swamp: ['item_antitoxin', 'item_herbalism_kit'],
  underdark: ['item_torch', 'item_lantern', 'item_lantern_bullseye', 'item_oil_flask', 'item_chalk'],
  mountain: ['item_grappling_hook', 'item_hempen_rope_silk', 'item_pitons', 'item_climbers_kit'],
  forest: ['item_herbalism_kit', 'item_fishing_tackle', 'item_hunting_trap'],
  coast: ['item_fishing_tackle', 'item_fresh_water'],
};

// ── Inventory generation ───────────────────────────────────────────────

/**
 * Generate a merchant inventory appropriate for the NPC's role, location
 * biome, and the surrounding difficulty tier.
 *
 * `difficulty` (1-5) controls whether expensive items appear and how many
 * units the merchant stocks.
 */
export function generateMerchantInventory(
  role: NPCRole,
  biome: BiomeType,
  difficulty: number,
): MerchantInventory {
  const stockIds = getStockTable(role);
  const biomeExtras = BIOME_EXTRAS[biome] ?? [];
  const combined = [...new Set([...stockIds, ...biomeExtras])];

  const items: MerchantItem[] = [];

  for (const itemId of combined) {
    const def = getItem(itemId);
    if (!def) continue;

    // Filter out items too expensive for this difficulty tier
    const valueInCopper = coinValueToCopper(def.value);
    if (difficulty < 3 && valueInCopper > 10000) continue; // skip 100+ gp items at low tiers
    if (difficulty < 2 && valueInCopper > 5000) continue;  // skip 50+ gp items at tier 1

    const baseQuantity = def.stackable ? 5 + difficulty * 3 : 1 + Math.floor(difficulty / 2);

    // Consumables (food, drink, potions, ammo) are effectively infinite for merchants
    const isConsumable = ['food', 'drink', 'potion', 'ammunition'].includes(def.itemType);

    items.push({
      itemId,
      quantity: baseQuantity,
      infinite: isConsumable,
    });
  }

  const gold = baseMerchantGold(role) + difficulty * 50;

  return {
    items,
    gold,
    restockInterval: 24, // restock every 24 game-time ticks (one day)
  };
}

// ── Buy / Sell transactions ────────────────────────────────────────────

/**
 * Buy price for an item (what the player pays).
 * Equal to the item's listed value.
 */
export function getBuyPrice(itemId: string, merchantItem?: MerchantItem): number {
  if (merchantItem?.priceOverride != null) return merchantItem.priceOverride;
  const def = getItem(itemId);
  if (!def) return 0;
  return coinValueToCopper(def.value);
}

/**
 * Sell price for an item (what the player receives).
 * Standard D&D rule: half the item's value, rounded down.
 */
export function getSellPrice(itemId: string): number {
  const def = getItem(itemId);
  if (!def) return 0;
  return Math.floor(coinValueToCopper(def.value) / 2);
}

/**
 * Player buys `quantity` of an item from a merchant.
 *
 * Mutates both `merchantInv` and `playerInv` on success.
 */
export function buyItem(
  merchantInv: MerchantInventory,
  playerInv: Inventory,
  itemId: string,
  quantity: number,
): Result<void, string> {
  if (quantity <= 0) return { ok: false, error: 'Quantity must be positive.' };

  const merchantEntry = merchantInv.items.find((mi) => mi.itemId === itemId);
  if (!merchantEntry) return { ok: false, error: 'The merchant does not stock that item.' };

  if (!merchantEntry.infinite && merchantEntry.quantity < quantity) {
    return { ok: false, error: `The merchant only has ${merchantEntry.quantity} in stock.` };
  }

  const unitPrice = getBuyPrice(itemId, merchantEntry);
  const totalCost = unitPrice * quantity;

  if (!canAfford(playerInv, totalCost)) {
    return { ok: false, error: 'You cannot afford this purchase.' };
  }

  // Deduct coins from player
  deduct(playerInv, totalCost);

  // Add coins to merchant gold pool (all internal accounting in gold)
  merchantInv.gold += totalCost / 100;

  // Reduce merchant stock
  if (!merchantEntry.infinite) {
    merchantEntry.quantity -= quantity;
    if (merchantEntry.quantity <= 0) {
      const idx = merchantInv.items.indexOf(merchantEntry);
      if (idx !== -1) merchantInv.items.splice(idx, 1);
    }
  }

  // Add item to player inventory
  const existing = playerInv.items.find((e) => e.itemId === itemId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    playerInv.items.push({ itemId, quantity });
  }

  return { ok: true, value: undefined };
}

/**
 * Player sells `quantity` of an item to a merchant.
 *
 * Mutates both `merchantInv` and `playerInv` on success.
 */
export function sellItem(
  merchantInv: MerchantInventory,
  playerInv: Inventory,
  itemId: string,
  quantity: number,
): Result<void, string> {
  if (quantity <= 0) return { ok: false, error: 'Quantity must be positive.' };

  const playerEntry = playerInv.items.find((e) => e.itemId === itemId);
  if (!playerEntry || playerEntry.quantity < quantity) {
    return { ok: false, error: 'You do not have enough of that item.' };
  }

  const unitSellPrice = getSellPrice(itemId);
  const totalRevenue = unitSellPrice * quantity;

  // Check if merchant can afford to buy
  const merchantCopperPool = merchantInv.gold * 100;
  if (merchantCopperPool < totalRevenue) {
    return { ok: false, error: 'The merchant cannot afford to buy that many.' };
  }

  // Deduct from merchant gold
  merchantInv.gold -= totalRevenue / 100;

  // Give coins to player — check purse space first
  const coins = fromCopper(totalRevenue);
  const totalCoinsToAdd = (coins.gold ?? 0) + (coins.silver ?? 0) + (coins.copper ?? 0);
  const available = totalPurseSpace(playerInv);
  if (available < totalCoinsToAdd) {
    return { ok: false, error: 'Your purses are full — no room for the coins.' };
  }
  addCoins(playerInv, coins);

  // Remove from player inventory
  playerEntry.quantity -= quantity;
  if (playerEntry.quantity <= 0) {
    const idx = playerInv.items.indexOf(playerEntry);
    if (idx !== -1) playerInv.items.splice(idx, 1);
  }

  // Add to merchant stock
  const merchantEntry = merchantInv.items.find((mi) => mi.itemId === itemId);
  if (merchantEntry) {
    merchantEntry.quantity += quantity;
  } else {
    merchantInv.items.push({ itemId, quantity });
  }

  return { ok: true, value: undefined };
}

/**
 * Restock a merchant's inventory if enough game time has passed.
 * Call this when the player interacts with a merchant.
 *
 * `currentTick` is the current game-time tick.
 * `role` and `biome` are used to regenerate the baseline stock.
 * `difficulty` is the local area difficulty tier.
 */
export function restockIfNeeded(
  merchantInv: MerchantInventory,
  currentTick: number,
  role: NPCRole,
  biome: BiomeType,
  difficulty: number,
): boolean {
  const lastRestock = merchantInv.lastRestock ?? 0;
  if (currentTick - lastRestock < merchantInv.restockInterval) return false;

  const fresh = generateMerchantInventory(role, biome, difficulty);

  // Merge: for each item in fresh stock, set quantity to max of current and fresh
  for (const freshItem of fresh.items) {
    const existing = merchantInv.items.find((mi) => mi.itemId === freshItem.itemId);
    if (existing) {
      existing.quantity = Math.max(existing.quantity, freshItem.quantity);
      existing.infinite = freshItem.infinite;
    } else {
      merchantInv.items.push({ ...freshItem });
    }
  }

  // Refresh gold
  merchantInv.gold = Math.max(merchantInv.gold, fresh.gold);
  merchantInv.lastRestock = currentTick;

  return true;
}
