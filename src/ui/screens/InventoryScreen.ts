import type { GameEngine } from '@/engine/GameEngine';
import type { EntityId, Inventory, EquipmentSlots, Item } from '@/types';
import { Component } from '@/ui/Component';
import { FocusNav } from '@/ui/FocusNav';
import { ItemCard } from '@/ui/widgets/ItemCard';
import { IconSystem } from '@/ui/IconSystem';
import { TooltipSystem } from '@/ui/TooltipSystem';
import { el } from '@/utils/dom';
import { formatCoin } from '@/utils/format';

const EQUIP_SLOT_LABELS: Record<keyof EquipmentSlots, string> = {
  mainHand: 'Main Hand',
  offHand: 'Off Hand',
  armor: 'Armor',
  helmet: 'Helmet',
  cloak: 'Cloak',
  gloves: 'Gloves',
  boots: 'Boots',
  ring1: 'Ring',
  ring2: 'Ring',
  amulet: 'Amulet',
  belt: 'Belt',
};

const EQUIP_SLOT_ORDER: (keyof EquipmentSlots)[] = [
  'helmet', 'amulet', 'cloak',
  'armor', 'mainHand', 'offHand',
  'gloves', 'belt', 'ring1',
  'boots', 'ring2',
];

/** Maps item types to their default equipment slot. */
const ITEM_TYPE_TO_SLOT: Partial<Record<string, keyof EquipmentSlots>> = {
  weapon: 'mainHand',
  armor: 'armor',
};

/** Item types that can be consumed (used) rather than equipped. */
const CONSUMABLE_TYPES = new Set(['food', 'drink', 'potion']);

/**
 * Inventory management screen — fullscreen overlay.
 * Equipment paperdoll (left) and inventory grid (right),
 * with click-to-equip, click-to-use, and click-to-unequip interactions.
 */
export class InventoryScreen extends Component {
  private equipmentEl!: HTMLElement;
  private inventoryGrid!: HTMLElement;
  private goldDisplay!: HTMLElement;
  private encumbranceBar!: HTMLElement;
  private encumbranceFill!: HTMLElement;
  private encumbranceLabel!: HTMLElement;
  private itemCards: ItemCard[] = [];
  private focusNav: FocusNav;

  // @ts-expect-error Reserved for future drag-and-drop interactions
  private currentItems = new Map<EntityId, Item>();

  constructor(parent: HTMLElement, engine: GameEngine) {
    super(parent, engine);
    this.focusNav = new FocusNav({
      columns: 3,
      onSelect: (el) => {
        // Find and click the first action button inside the card, or the card itself
        const actionBtn = el.querySelector('.item-action-btn') as HTMLElement | null;
        if (actionBtn) actionBtn.click();
        else el.click();
      },
      onCancel: () => this.close(),
    });
  }

  protected createElement(): HTMLElement {
    // Modal backdrop
    const backdrop = el('div', { class: 'inventory-screen modal-backdrop' });

    const dialog = el('div', { class: 'inventory-dialog' });

    // Header
    const header = el('div', { class: 'inventory-header' });
    const icon = IconSystem.icon('backpack');
    header.appendChild(icon);
    header.appendChild(el('h2', { class: 'inventory-title font-heading' }, ['Inventory']));

    const closeBtn = el('button', { class: 'modal-close btn btn-ghost', 'aria-label': 'Close' }, ['\u00D7']);
    closeBtn.addEventListener('click', () => this.close());
    header.appendChild(closeBtn);
    dialog.appendChild(header);

    // Body: two columns
    const body = el('div', { class: 'inventory-body' });

    // Left: Equipment slots
    const equipCol = el('div', { class: 'inventory-equipment' });
    equipCol.appendChild(el('h3', { class: 'inventory-section-title font-heading' }, ['Equipment']));
    this.equipmentEl = el('div', { class: 'inventory-equip-grid' });
    equipCol.appendChild(this.equipmentEl);
    body.appendChild(equipCol);

    // Right: Inventory grid
    const invCol = el('div', { class: 'inventory-items' });
    invCol.appendChild(el('h3', { class: 'inventory-section-title font-heading' }, ['Items']));
    this.inventoryGrid = el('div', { class: 'inventory-item-grid' });
    invCol.appendChild(this.inventoryGrid);
    body.appendChild(invCol);

    dialog.appendChild(body);

    // Footer: gold + encumbrance
    const footer = el('div', { class: 'inventory-footer' });

    this.goldDisplay = el('div', { class: 'inventory-gold' });
    footer.appendChild(this.goldDisplay);

    const encWrap = el('div', { class: 'inventory-encumbrance' });
    encWrap.appendChild(el('span', { class: 'inventory-enc-label' }, ['Encumbrance']));
    this.encumbranceBar = el('div', { class: 'inventory-enc-bar' });
    this.encumbranceFill = el('div', { class: 'inventory-enc-fill' });
    this.encumbranceBar.appendChild(this.encumbranceFill);
    this.encumbranceLabel = el('span', { class: 'inventory-enc-value font-mono' });
    this.encumbranceBar.appendChild(this.encumbranceLabel);
    encWrap.appendChild(this.encumbranceBar);
    footer.appendChild(encWrap);

    dialog.appendChild(footer);
    backdrop.appendChild(dialog);

    return backdrop;
  }

  protected setupEvents(): void {
    TooltipSystem.getInstance().registerContainer(this.el);

    // Close on backdrop click
    this.listen(this.el, 'click', (e: Event) => {
      if (e.target === this.el) this.close();
    });

    // Keyboard navigation
    this.focusNav.attach();
  }

  mount(): void {
    super.mount();
    this.focusNav.attach();
  }

  destroy(): void {
    this.focusNav.detach();
    super.destroy();
  }

  setInventory(inventory: Inventory, items: Map<EntityId, Item>): void {
    this.currentItems = items;

    // Clear old item cards
    for (const card of this.itemCards) {
      card.destroy();
    }
    this.itemCards = [];
    this.inventoryGrid.innerHTML = '';

    // Render inventory items with action buttons
    for (const entry of inventory.items) {
      const item = items.get(entry.itemId);
      if (!item) continue;

      const cardWrap = el('div', { class: 'inventory-item-slot' });
      if (entry.quantity > 1) {
        cardWrap.appendChild(el('span', { class: 'inventory-item-qty badge badge-gold' }, [
          `x${entry.quantity}`,
        ]));
      }
      if (item.maxCharges != null) {
        const charges = entry.charges ?? item.charges ?? 0;
        cardWrap.appendChild(el('span', { class: 'inventory-item-qty badge badge-gold', style: 'top:auto;bottom:6px' }, [
          `${charges}/${item.maxCharges}`,
        ]));
      }

      const card = new ItemCard(cardWrap, this.engine, item);
      this.addChild(card);
      this.itemCards.push(card);

      // Action overlay on the card
      const actions = el('div', { class: 'item-card-actions' });

      if (CONSUMABLE_TYPES.has(item.itemType)) {
        const useBtn = el('button', { class: 'btn btn-primary btn-sm item-action-btn' }, ['Use']);
        useBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.engine.events.emit({
            type: 'inventory:use',
            category: 'character',
            data: { itemId: item.id },
          });
        });
        actions.appendChild(useBtn);
      } else if (item.itemType === 'weapon' || item.itemType === 'armor') {
        const equipBtn = el('button', { class: 'btn btn-primary btn-sm item-action-btn' }, ['Equip']);
        equipBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.engine.events.emit({
            type: 'inventory:equip',
            category: 'character',
            data: { itemId: item.id, slot: this.getDefaultSlot(item) },
          });
        });
        actions.appendChild(equipBtn);
      }

      // Mount the card, then append actions into the card element
      cardWrap.querySelector('.item-card')?.appendChild(actions);
      this.inventoryGrid.appendChild(cardWrap);
    }

    // Gold display
    this.goldDisplay.innerHTML = '';
    const coinIcon = IconSystem.icon('coins');
    coinIcon.classList.add('inventory-coin-icon');
    this.goldDisplay.appendChild(coinIcon);
    this.goldDisplay.appendChild(
      document.createTextNode(formatCoin(inventory.gold, inventory.silver, inventory.copper)),
    );

    // Update keyboard-focusable items
    const focusableItems = Array.from(this.inventoryGrid.querySelectorAll('.item-card')) as HTMLElement[];
    this.focusNav.setItems(focusableItems);

    // Encumbrance
    const pct = inventory.capacity > 0 ? (inventory.currentWeight / inventory.capacity) * 100 : 0;
    this.encumbranceFill.style.width = `${Math.min(pct, 100)}%`;
    if (pct > 100) {
      this.encumbranceFill.classList.add('inventory-enc-fill--over');
    } else {
      this.encumbranceFill.classList.remove('inventory-enc-fill--over');
    }
    this.encumbranceLabel.textContent = `${inventory.currentWeight} / ${inventory.capacity} lb`;
  }

  setEquipment(equipment: EquipmentSlots, items: Map<EntityId, Item>): void {
    this.currentItems = items;
    this.equipmentEl.innerHTML = '';

    for (const slot of EQUIP_SLOT_ORDER) {
      const slotEl = el('div', { class: 'inventory-equip-slot' });

      const label = el('div', { class: 'inventory-equip-label' }, [EQUIP_SLOT_LABELS[slot]]);
      slotEl.appendChild(label);

      const itemId = equipment[slot];
      if (itemId) {
        const item = items.get(itemId);
        if (item) {
          const rarityClass = `inventory-equip-item--${item.rarity}`;
          const itemEl = el('div', {
            class: `inventory-equip-item ${rarityClass}`,
            'data-tooltip': `${item.name}\n${item.description}\nClick to unequip`,
          }, [item.name]);
          slotEl.appendChild(itemEl);

          // Click to unequip
          slotEl.classList.add('inventory-equip-slot--filled');
          slotEl.addEventListener('click', () => {
            this.engine.events.emit({
              type: 'inventory:unequip',
              category: 'character',
              data: { slot },
            });
          });
        } else {
          slotEl.appendChild(el('div', { class: 'inventory-equip-empty' }, ['Empty']));
        }
      } else {
        slotEl.appendChild(el('div', { class: 'inventory-equip-empty' }, ['Empty']));
      }

      this.equipmentEl.appendChild(slotEl);
    }
  }

  /** Determine the best equipment slot for an item. */
  private getDefaultSlot(item: Item): keyof EquipmentSlots {
    if (item.itemType === 'armor') {
      const props = item.properties as { armorType?: string };
      if (props.armorType === 'shield') return 'offHand';
      return 'armor';
    }
    return ITEM_TYPE_TO_SLOT[item.itemType] ?? 'mainHand';
  }

  async close(): Promise<void> {
    this.engine.events.emit({
      type: 'ui:navigate',
      category: 'ui',
      data: { screen: 'game', direction: 'down' },
    });
  }
}
