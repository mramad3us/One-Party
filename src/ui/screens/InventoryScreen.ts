import type { GameEngine } from '@/engine/GameEngine';
import type { EntityId, Inventory, EquipmentSlots, Item } from '@/types';
import { Component } from '@/ui/Component';
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

/**
 * Inventory management modal overlay.
 * Equipment slots (left) and inventory grid (right),
 * with item cards, tooltips, gold display, and encumbrance bar.
 */
export class InventoryScreen extends Component {
  private equipmentEl!: HTMLElement;
  private inventoryGrid!: HTMLElement;
  private goldDisplay!: HTMLElement;
  private encumbranceBar!: HTMLElement;
  private encumbranceFill!: HTMLElement;
  private encumbranceLabel!: HTMLElement;
  private itemCards: ItemCard[] = [];

  constructor(parent: HTMLElement, engine: GameEngine) {
    super(parent, engine);
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

    // Close on Escape
    this.listen(document, 'keydown', (e: Event) => {
      if ((e as KeyboardEvent).key === 'Escape') this.close();
    });
  }

  setInventory(inventory: Inventory, items: Map<EntityId, Item>): void {
    // Clear old item cards
    for (const card of this.itemCards) {
      card.destroy();
    }
    this.itemCards = [];
    this.inventoryGrid.innerHTML = '';

    // Render inventory items
    for (const entry of inventory.items) {
      const item = items.get(entry.itemId);
      if (!item) continue;

      const cardWrap = el('div', { class: 'inventory-item-slot' });
      if (entry.quantity > 1) {
        cardWrap.appendChild(el('span', { class: 'inventory-item-qty badge badge-gold' }, [
          `x${entry.quantity}`,
        ]));
      }

      const card = new ItemCard(cardWrap, this.engine, item);
      this.addChild(card);
      this.itemCards.push(card);
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
            'data-tooltip': `${item.name}\n${item.description}`,
          }, [item.name]);
          slotEl.appendChild(itemEl);
        } else {
          slotEl.appendChild(el('div', { class: 'inventory-equip-empty' }, ['Empty']));
        }
      } else {
        slotEl.appendChild(el('div', { class: 'inventory-equip-empty' }, ['Empty']));
      }

      this.equipmentEl.appendChild(slotEl);
    }
  }

  async close(): Promise<void> {
    await this.unmount();
  }
}
