import type {
  Character,
  EntityId,
  EquipmentSlots,
  Item,
  Result,
  ArmorProperties,
  WeaponProperties,
} from '@/types';
import { getItem } from '@/data/items';

function isWeaponProperties(props: unknown): props is WeaponProperties {
  return typeof props === 'object' && props !== null && 'damage' in props && 'weaponType' in props;
}

function isArmorProperties(props: unknown): props is ArmorProperties {
  return typeof props === 'object' && props !== null && 'baseAC' in props && 'armorType' in props;
}

/** Slots that accept weapons. */
const WEAPON_SLOTS: (keyof EquipmentSlots)[] = ['mainHand', 'offHand'];

/** Slots that accept armor (body armor only). */
const ARMOR_SLOT: keyof EquipmentSlots = 'armor';

/** The shield slot. */
const SHIELD_SLOT: keyof EquipmentSlots = 'offHand';

export class EquipmentRules {
  /** Check if a character can equip an item in the given slot. */
  canEquip(_character: Character, item: Item, slot: keyof EquipmentSlots): boolean {
    if (item.itemType === 'weapon') {
      if (!WEAPON_SLOTS.includes(slot)) return false;
      if (!isWeaponProperties(item.properties)) return false;
      // Can equip any weapon regardless of proficiency (no prof bonus if not proficient)
      return true;
    }

    if (item.itemType === 'armor') {
      if (!isArmorProperties(item.properties)) return false;
      const ap = item.properties;
      if (ap.armorType === 'shield') {
        return slot === SHIELD_SLOT;
      }
      return slot === ARMOR_SLOT;
    }

    // Mundane charge-based items (torches) go in off hand only
    const itemDef = getItem(item.id);
    if (item.itemType === 'mundane' && itemDef?.maxCharges != null) {
      return slot === 'offHand';
    }

    // Other equippable items (rings, amulets, etc.)
    return true;
  }

  /** Equip an item from inventory to a slot. */
  equip(character: Character, itemId: EntityId, slot: keyof EquipmentSlots): Result<void, string> {
    // Check item is in inventory
    const invEntry = character.inventory.items.find((e) => e.itemId === itemId);
    if (!invEntry) {
      return { ok: false, error: 'Item not found in inventory.' };
    }

    // Check slot is empty
    if (character.equipment[slot] !== null) {
      return { ok: false, error: `Slot '${slot}' is already occupied. Unequip first.` };
    }

    // Save charges for charge-based items (e.g. torches)
    const itemDef = getItem(itemId);
    if (itemDef?.maxCharges != null) {
      character.equipmentCharges[slot] = invEntry.charges ?? itemDef.charges ?? 0;
    }

    // Remove from inventory (or decrement quantity)
    if (invEntry.quantity <= 1) {
      const idx = character.inventory.items.indexOf(invEntry);
      if (idx !== -1) character.inventory.items.splice(idx, 1);
    } else {
      invEntry.quantity -= 1;
    }

    character.equipment[slot] = itemId;
    return { ok: true, value: undefined };
  }

  /** Unequip an item from a slot back to inventory. */
  unequip(character: Character, slot: keyof EquipmentSlots): Result<EntityId, string> {
    const itemId = character.equipment[slot];
    if (itemId === null) {
      return { ok: false, error: `Slot '${slot}' is already empty.` };
    }

    character.equipment[slot] = null;

    // Restore charges for charge-based items
    const savedCharges = character.equipmentCharges[slot];
    delete character.equipmentCharges[slot];

    // Add back to inventory
    const itemDef = getItem(itemId);
    if (itemDef?.maxCharges != null) {
      // Charge-based items are non-stackable; add as new entry with charges
      character.inventory.items.push({ itemId, quantity: 1, charges: savedCharges ?? 0 });
    } else {
      const existing = character.inventory.items.find((e) => e.itemId === itemId);
      if (existing) {
        existing.quantity += 1;
      } else {
        character.inventory.items.push({ itemId, quantity: 1 });
      }
    }

    return { ok: true, value: itemId };
  }

  /** Get the currently equipped main-hand weapon, if any. */
  getEquippedWeapon(character: Character, items: Map<EntityId, Item>): Item | null {
    const weaponId = character.equipment.mainHand;
    if (!weaponId) return null;
    return items.get(weaponId) ?? null;
  }

  /** Get the currently equipped body armor, if any. */
  getEquippedArmor(character: Character, items: Map<EntityId, Item>): Item | null {
    const armorId = character.equipment.armor;
    if (!armorId) return null;
    const item = items.get(armorId) ?? null;
    if (item && item.itemType === 'armor' && isArmorProperties(item.properties) && item.properties.armorType !== 'shield') {
      return item;
    }
    return null;
  }

  /** Get the currently equipped shield, if any. */
  getEquippedShield(character: Character, items: Map<EntityId, Item>): Item | null {
    const shieldId = character.equipment.offHand;
    if (!shieldId) return null;
    const item = items.get(shieldId) ?? null;
    if (item && item.itemType === 'armor' && isArmorProperties(item.properties) && item.properties.armorType === 'shield') {
      return item;
    }
    return null;
  }

  /** Calculate encumbrance based on carried items. */
  calculateEncumbrance(
    character: Character,
    items: Map<EntityId, Item>,
  ): { currentWeight: number; capacity: number; encumbered: boolean } {
    let currentWeight = 0;

    // Inventory items
    for (const entry of character.inventory.items) {
      const item = items.get(entry.itemId);
      if (item) {
        currentWeight += item.weight * entry.quantity;
      }
    }

    // Equipped items
    const slots = Object.values(character.equipment);
    for (const slotItemId of slots) {
      if (slotItemId) {
        const item = items.get(slotItemId);
        if (item) {
          currentWeight += item.weight;
        }
      }
    }

    // Carrying capacity = Strength score * 15
    const capacity = character.abilityScores.strength * 15;
    const encumbered = currentWeight > capacity;

    return { currentWeight, capacity, encumbered };
  }
}
