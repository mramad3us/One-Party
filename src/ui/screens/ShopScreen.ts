import type { GameEngine } from '@/engine/GameEngine';
import type { Inventory, NPC, MerchantInventory } from '@/types';
import { Component } from '@/ui/Component';
import { FocusNav } from '@/ui/FocusNav';
import { IconSystem } from '@/ui/IconSystem';
import { el } from '@/utils/dom';
import { formatCoinHtml, formatCurrencyHtml } from '@/utils/format';
import { getItem } from '@/data/items';
import { TooltipSystem } from '@/ui/TooltipSystem';
import {
  getBuyPrice,
  getSellPrice,
  buyItem,
  sellItem,
} from '@/npc/MerchantSystem';
import { fromCopper, canAfford, totalPlayerDenominations } from '@/rules/CurrencyRules';

type ShopPanel = 'buy' | 'sell';

/**
 * Shop / merchant trading screen — fullscreen modal overlay.
 *
 * Two-panel layout: left panel shows the merchant's wares (BUY),
 * right panel shows the player's inventory (SELL).
 * Tab switches active panel. Number keys select items.
 * Esc closes the shop.
 */
export class ShopScreen extends Component {
  private npc!: NPC;
  private merchantInv!: MerchantInventory;
  private playerInv!: Inventory;

  private activePanel: ShopPanel = 'buy';
  private buyListEl!: HTMLElement;
  private sellListEl!: HTMLElement;
  private goldDisplayEl!: HTMLElement;
  private merchantGoldEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private buyPanelEl!: HTMLElement;
  private sellPanelEl!: HTMLElement;
  private focusNav: FocusNav;

  constructor(parent: HTMLElement, engine: GameEngine) {
    super(parent, engine);
    this.focusNav = new FocusNav({
      columns: 1,
      onSelect: (focusedEl) => {
        const btn = focusedEl.querySelector('.shop-item-action') as HTMLElement | null;
        if (btn) btn.click();
      },
      onCancel: () => this.close(),
    });
  }

  protected createElement(): HTMLElement {
    const backdrop = el('div', { class: 'shop-screen modal-backdrop' });
    const dialog = el('div', { class: 'shop-dialog' });

    // ── Header ──
    const header = el('div', { class: 'shop-header' });
    const icon = IconSystem.icon('coins');
    header.appendChild(icon);
    this.merchantGoldEl = el('span', { class: 'shop-merchant-name font-heading' }, ['Shop']);
    header.appendChild(this.merchantGoldEl);
    const closeBtn = el('button', { class: 'modal-close btn btn-ghost', 'aria-label': 'Close' }, ['\u00D7']);
    closeBtn.addEventListener('click', () => this.close());
    header.appendChild(closeBtn);
    dialog.appendChild(header);

    // ── Gold bar ──
    const goldBar = el('div', { class: 'shop-gold-bar' });
    const coinIcon = IconSystem.icon('coins');
    coinIcon.classList.add('shop-coin-icon');
    goldBar.appendChild(coinIcon);
    this.goldDisplayEl = el('span', { class: 'shop-gold-amount font-mono' }, ['0g']);
    goldBar.appendChild(this.goldDisplayEl);
    dialog.appendChild(goldBar);

    // ── Body: two panels ──
    const body = el('div', { class: 'shop-body' });

    // Buy panel (left)
    this.buyPanelEl = el('div', { class: 'shop-panel shop-panel--buy shop-panel--active' });
    const buyHeader = el('div', { class: 'shop-panel-header' });
    buyHeader.appendChild(el('h3', { class: 'shop-panel-title font-heading' }, ['Buy']));
    this.buyPanelEl.appendChild(buyHeader);
    this.buyListEl = el('div', { class: 'shop-item-list' });
    this.buyPanelEl.appendChild(this.buyListEl);
    body.appendChild(this.buyPanelEl);

    // Divider
    body.appendChild(el('div', { class: 'shop-divider' }));

    // Sell panel (right)
    this.sellPanelEl = el('div', { class: 'shop-panel shop-panel--sell' });
    const sellHeader = el('div', { class: 'shop-panel-header' });
    sellHeader.appendChild(el('h3', { class: 'shop-panel-title font-heading' }, ['Sell']));
    this.sellPanelEl.appendChild(sellHeader);
    this.sellListEl = el('div', { class: 'shop-item-list' });
    this.sellPanelEl.appendChild(this.sellListEl);
    body.appendChild(this.sellPanelEl);

    dialog.appendChild(body);

    // ── Status message area ──
    this.statusEl = el('div', { class: 'shop-status' });
    dialog.appendChild(this.statusEl);

    // ── Footer: keyboard hints ──
    const footer = el('div', { class: 'shop-footer' });
    footer.appendChild(el('span', { class: 'shop-hint font-mono' }, ['[Tab] Switch Panel']));
    footer.appendChild(el('span', { class: 'shop-hint font-mono' }, ['[1-9] Select']));
    footer.appendChild(el('span', { class: 'shop-hint font-mono' }, ['[Esc] Close']));
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

    // Keyboard handling
    this.listen(document, 'keydown', (e: Event) => {
      const ke = e as KeyboardEvent;
      if (ke.key === 'Escape') {
        ke.preventDefault();
        ke.stopPropagation();
        this.close();
        return;
      }
      if (ke.key === 'Tab') {
        ke.preventDefault();
        ke.stopPropagation();
        this.togglePanel();
        return;
      }
      // Number keys 1-9 to select items
      const num = parseInt(ke.key, 10);
      if (num >= 1 && num <= 9) {
        ke.preventDefault();
        this.selectItemByIndex(num - 1);
      }
    });

    this.focusNav.attach();
  }

  mount(): void {
    super.mount();
  }

  destroy(): void {
    this.focusNav.detach();
    super.destroy();
  }

  /**
   * Initialize the shop with an NPC's merchant data and the player's inventory.
   */
  setShopData(npc: NPC, playerInv: Inventory): void {
    if (!npc.merchantInventory) return;
    this.npc = npc;
    this.merchantInv = npc.merchantInventory;
    this.playerInv = playerInv;

    // Set header
    this.merchantGoldEl.textContent = `${npc.name}'s Wares`;

    this.refresh();
  }

  /** Rebuild both item lists and gold display. */
  private refresh(): void {
    this.renderGold();
    this.renderBuyList();
    this.renderSellList();
    this.updatePanelClasses();
    this.updateFocusNav();
  }

  private renderGold(): void {
    const total = totalPlayerDenominations(this.playerInv);
    this.goldDisplayEl.innerHTML = formatCoinHtml(total.gold, total.silver, total.copper);
  }

  private renderBuyList(): void {
    this.buyListEl.innerHTML = '';

    if (!this.merchantInv || this.merchantInv.items.length === 0) {
      this.buyListEl.appendChild(
        el('div', { class: 'shop-empty font-body' }, ['The merchant has nothing to sell.']),
      );
      return;
    }

    this.merchantInv.items.forEach((mi, idx) => {
      const item = getItem(mi.itemId);
      if (!item) return;

      const priceCopper = getBuyPrice(mi.itemId, mi);
      const priceDisplay = this.formatPrice(priceCopper);
      const affordable = canAfford(this.playerInv, priceCopper);
      const shortcut = idx < 9 ? `${idx + 1}` : '';

      const rarityLabel = item.rarity === 'common' ? '' : ` (${item.rarity.replace('_', ' ')})`;
      const itemTooltip = `${item.name}${rarityLabel}\n${item.description}`;
      const row = el('div', {
        class: `shop-item-row ${!affordable ? 'shop-item-row--disabled' : ''}`,
        'data-index': String(idx),
        'data-panel': 'buy',
        'data-tooltip': itemTooltip,
      });

      // Shortcut badge
      if (shortcut) {
        row.appendChild(el('span', { class: 'shop-item-key font-mono' }, [shortcut]));
      }

      // Item info
      const info = el('div', { class: 'shop-item-info' });
      info.appendChild(el('span', { class: 'shop-item-name' }, [item.name]));

      // Quantity indicator
      if (mi.infinite) {
        info.appendChild(el('span', { class: 'shop-item-qty font-mono' }, ['\u221E']));
      } else if (mi.quantity > 1) {
        info.appendChild(el('span', { class: 'shop-item-qty font-mono' }, [`\u00D7${mi.quantity}`]));
      }

      row.appendChild(info);

      // Price
      const priceEl = el('span', { class: 'shop-item-price font-mono' });
      priceEl.innerHTML = priceDisplay;
      row.appendChild(priceEl);

      // Buy button
      const buyBtn = el('button', {
        class: 'shop-item-action btn btn-sm',
        ...(affordable ? {} : { disabled: 'true' }),
      }, ['Buy']);
      buyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleBuy(mi.itemId, 1);
      });
      row.appendChild(buyBtn);

      this.buyListEl.appendChild(row);
    });
  }

  private renderSellList(): void {
    this.sellListEl.innerHTML = '';

    const sellableItems = this.playerInv.items.filter((entry) => {
      const item = getItem(entry.itemId);
      return item != null;
    });

    if (sellableItems.length === 0) {
      this.sellListEl.appendChild(
        el('div', { class: 'shop-empty font-body' }, ['You have nothing to sell.']),
      );
      return;
    }

    sellableItems.forEach((entry, idx) => {
      const item = getItem(entry.itemId);
      if (!item) return;

      const priceCopper = getSellPrice(entry.itemId);
      const priceDisplay = this.formatPrice(priceCopper);
      const merchantCanAfford = this.merchantInv.gold * 100 >= priceCopper;
      const shortcut = idx < 9 ? `${idx + 1}` : '';

      const sellRarityLabel = item.rarity === 'common' ? '' : ` (${item.rarity.replace('_', ' ')})`;
      const sellTooltip = `${item.name}${sellRarityLabel}\n${item.description}`;
      const row = el('div', {
        class: `shop-item-row ${!merchantCanAfford ? 'shop-item-row--disabled' : ''}`,
        'data-index': String(idx),
        'data-panel': 'sell',
        'data-tooltip': sellTooltip,
      });

      if (shortcut) {
        row.appendChild(el('span', { class: 'shop-item-key font-mono' }, [shortcut]));
      }

      const info = el('div', { class: 'shop-item-info' });
      info.appendChild(el('span', { class: 'shop-item-name' }, [item.name]));
      if (entry.quantity > 1) {
        info.appendChild(el('span', { class: 'shop-item-qty font-mono' }, [`\u00D7${entry.quantity}`]));
      }
      row.appendChild(info);

      const priceEl = el('span', { class: 'shop-item-price font-mono' });
      priceEl.innerHTML = priceDisplay;
      row.appendChild(priceEl);

      const sellBtn = el('button', {
        class: 'shop-item-action btn btn-sm',
        ...(merchantCanAfford ? {} : { disabled: 'true' }),
      }, ['Sell']);
      sellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleSell(entry.itemId, 1);
      });
      row.appendChild(sellBtn);

      this.sellListEl.appendChild(row);
    });
  }

  /** Execute a buy transaction. */
  private handleBuy(itemId: string, quantity: number): void {
    const result = buyItem(this.merchantInv, this.playerInv, itemId, quantity);
    if (result.ok) {
      const item = getItem(itemId);
      const priceCopper = getBuyPrice(itemId);
      const priceStr = this.formatPrice(priceCopper * quantity);
      this.showStatus(`Purchased ${item?.name ?? itemId} for ${priceStr}`, 'success');

      this.engine.events.emit({
        type: 'npc:buy',
        category: 'world',
        data: { npcId: this.npc.id, itemId, quantity, totalCost: priceCopper * quantity },
      });

      this.refresh();
    } else {
      this.showStatus(result.error, 'error');
    }
  }

  /** Execute a sell transaction. */
  private handleSell(itemId: string, quantity: number): void {
    const result = sellItem(this.merchantInv, this.playerInv, itemId, quantity);
    if (result.ok) {
      const item = getItem(itemId);
      const priceCopper = getSellPrice(itemId);
      const priceStr = this.formatPrice(priceCopper * quantity);
      this.showStatus(`Sold ${item?.name ?? itemId} for ${priceStr}`, 'success');

      this.engine.events.emit({
        type: 'npc:sell',
        category: 'world',
        data: { npcId: this.npc.id, itemId, quantity, totalCost: priceCopper * quantity },
      });

      this.refresh();
    } else {
      this.showStatus(result.error, 'error');
    }
  }

  /** Toggle between buy and sell panels. */
  private togglePanel(): void {
    this.activePanel = this.activePanel === 'buy' ? 'sell' : 'buy';
    this.updatePanelClasses();
    this.updateFocusNav();
  }

  private updatePanelClasses(): void {
    this.buyPanelEl.classList.toggle('shop-panel--active', this.activePanel === 'buy');
    this.sellPanelEl.classList.toggle('shop-panel--active', this.activePanel === 'sell');
  }

  /** Select item by number key index in the active panel. */
  private selectItemByIndex(index: number): void {
    const panel = this.activePanel === 'buy' ? this.buyListEl : this.sellListEl;
    const rows = Array.from(panel.querySelectorAll('.shop-item-row')) as HTMLElement[];
    if (index >= rows.length) return;

    const row = rows[index];
    if (row.classList.contains('shop-item-row--disabled')) return;

    const btn = row.querySelector('.shop-item-action') as HTMLElement | null;
    if (btn) btn.click();
  }

  private updateFocusNav(): void {
    const panel = this.activePanel === 'buy' ? this.buyListEl : this.sellListEl;
    const rows = Array.from(panel.querySelectorAll('.shop-item-row:not(.shop-item-row--disabled)')) as HTMLElement[];
    this.focusNav.setItems(rows);
  }

  /** Format a copper amount into HTML with coin icons. */
  private formatPrice(copper: number): string {
    const coins = fromCopper(copper);
    return formatCurrencyHtml(coins.gold, coins.silver, coins.copper);
  }

  private statusSeq = 0;

  /** Flash a status message below the panels. */
  private showStatus(message: string, type: 'success' | 'error'): void {
    this.statusEl.innerHTML = message;
    this.statusEl.className = `shop-status shop-status--${type}`;

    // Auto-clear after a few seconds (use sequence counter to avoid innerHTML comparison issues)
    const seq = ++this.statusSeq;
    setTimeout(() => {
      if (this.statusSeq === seq) {
        this.statusEl.innerHTML = '';
        this.statusEl.className = 'shop-status';
      }
    }, 3000);
  }

  async close(): Promise<void> {
    this.engine.events.emit({
      type: 'npc:shop_close',
      category: 'world',
      data: {},
    });
    this.engine.events.emit({
      type: 'ui:navigate',
      category: 'ui',
      data: { screen: 'game', direction: 'down' },
    });
  }
}
