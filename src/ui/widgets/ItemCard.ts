import type { GameEngine } from '@/engine/GameEngine';
import type { Item, Rarity, ItemType } from '@/types';
import { Component } from '@/ui/Component';
import { el } from '@/utils/dom';
import { formatCoin } from '@/utils/format';

const RARITY_CLASSES: Record<Rarity, string> = {
  common: 'item-card--common',
  uncommon: 'item-card--uncommon',
  rare: 'item-card--rare',
  very_rare: 'item-card--very-rare',
  legendary: 'item-card--legendary',
  artifact: 'item-card--artifact',
};

const ITEM_TYPE_SYMBOLS: Record<ItemType, string> = {
  weapon: '\u2694',     // crossed swords
  armor: '\u{1F6E1}',  // shield
  potion: '\u2697',     // alembic
  scroll: '\u{1F4DC}', // scroll
  mundane: '\u25CB',    // circle
  wondrous: '\u2728',   // sparkles
  ammunition: '\u2192', // arrow
  tool: '\u2692',       // hammer and pick
  food: '\u{1F356}',    // meat on bone
  drink: '\u{1F3FA}',   // amphora
  container: '\u{1F4B0}', // money bag
};

/**
 * Item display card with rarity-colored border, type icon,
 * stats, and hover-expand description.
 */
export class ItemCard extends Component {
  private item: Item;

  constructor(parent: HTMLElement, engine: GameEngine, item: Item) {
    super(parent, engine);
    this.item = item;
  }

  protected createElement(): HTMLElement {
    const { item } = this;
    const rarityClass = RARITY_CLASSES[item.rarity] ?? '';
    const card = el('div', { class: `item-card ${rarityClass}` });

    // Header: icon + name
    const header = el('div', { class: 'item-card-header' });

    const typeIcon = el('span', { class: 'item-card-type-icon' }, [
      ITEM_TYPE_SYMBOLS[item.itemType] ?? '\u25CB',
    ]);
    header.appendChild(typeIcon);

    header.appendChild(el('span', { class: 'item-card-name' }, [item.name]));
    card.appendChild(header);

    // Rarity + type line
    const metaLine = el('div', { class: 'item-card-meta' }, [
      `${item.rarity.replace('_', ' ')} ${item.itemType}`,
    ]);
    card.appendChild(metaLine);

    // Stats (weapon damage, armor AC, etc.)
    const statsLine = this.getStatsLine();
    if (statsLine) {
      card.appendChild(el('div', { class: 'item-card-stats' }, [statsLine]));
    }

    // Bottom: weight + value
    const bottom = el('div', { class: 'item-card-bottom' });
    bottom.appendChild(el('span', { class: 'item-card-weight' }, [`${item.weight} lb`]));
    bottom.appendChild(el('span', { class: 'item-card-value' }, [
      formatCoin(item.value.gold, item.value.silver, item.value.copper),
    ]));
    card.appendChild(bottom);

    // Description (shown on hover via CSS max-height transition)
    if (item.description) {
      const desc = el('div', { class: 'item-card-desc' }, [item.description]);
      card.appendChild(desc);
    }

    // Attunement indicator
    if (item.requiresAttunement) {
      card.appendChild(el('div', { class: 'item-card-attunement' }, ['Requires Attunement']));
    }

    return card;
  }

  private getStatsLine(): string | null {
    const props = this.item.properties;
    if (!props) return null;

    if ('damage' in props && 'weaponType' in props) {
      const wp = props as { damage: { count: number; die: number; bonus?: number; type: string }; range: string; reach: number };
      const dmg = `${wp.damage.count}d${wp.damage.die}${wp.damage.bonus ? `+${wp.damage.bonus}` : ''} ${wp.damage.type}`;
      return `${dmg}`;
    }

    if ('baseAC' in props && 'armorType' in props) {
      const ap = props as { baseAC: number; armorType: string };
      return `AC ${ap.baseAC} (${ap.armorType})`;
    }

    if ('effect' in props) {
      const pp = props as { effect: string };
      return pp.effect;
    }

    return null;
  }
}
