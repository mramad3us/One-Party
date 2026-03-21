import { Component } from '@/ui/Component';
import type { GameEngine } from '@/engine/GameEngine';
import type { GameTime } from '@/types/core';
import type { ForageHourResult } from '@/rules/ForageRules';
import { SunArc } from '@/ui/widgets/SunArc';
import { DiceDisplay } from '@/ui/widgets/DiceDisplay';
import { getItem } from '@/data/items';
import { el } from '@/utils/dom';

export interface TimeActivityConfig {
  title: string;
  totalHours: number;
  startTime: GameTime;
  skillName: string;
  dc: number;
}

/**
 * Full-screen overlay for time-spending activities (foraging, hunting, etc.).
 * Shows sun arc progression, hourly dice rolls, and accumulated results.
 * Pacing: 1 hour ticks every 1.5 seconds.
 */
export class TimeActivity extends Component {
  private sunArc!: SunArc;
  private resultsEl!: HTMLElement;
  private hourLabelEl!: HTMLElement;
  private totalEl!: HTMLElement;
  private diceContainer!: HTMLElement;
  private cancelled = false;
  private config: TimeActivityConfig;

  constructor(parent: HTMLElement, engine: GameEngine, config: TimeActivityConfig) {
    super(parent, engine);
    this.config = config;
  }

  protected createElement(): HTMLElement {
    const overlay = el('div', { class: 'time-activity-overlay' });
    const inner = el('div', { class: 'time-activity-inner' });

    // Title
    inner.appendChild(el('h2', { class: 'time-activity-title font-heading' }, [this.config.title]));

    // Skill & DC info
    const infoRow = el('div', { class: 'time-activity-info font-mono' }, [
      `${this.config.skillName} check \u2022 DC ${this.config.dc}`,
    ]);
    inner.appendChild(infoRow);

    // Sun arc (large, prominent)
    const arcWrap = el('div', { class: 'time-activity-arc' });
    this.sunArc = new SunArc(arcWrap, this.engine, 'large');
    inner.appendChild(arcWrap);

    // Hour label
    this.hourLabelEl = el('div', { class: 'time-activity-hour font-mono' }, ['Preparing...']);
    inner.appendChild(this.hourLabelEl);

    // Dice display area (centered, floating above results)
    this.diceContainer = el('div', { class: 'time-activity-dice' });
    inner.appendChild(this.diceContainer);

    // Results list (scrollable)
    this.resultsEl = el('div', { class: 'time-activity-results' });
    inner.appendChild(this.resultsEl);

    // Totals
    this.totalEl = el('div', { class: 'time-activity-total font-mono' });
    inner.appendChild(this.totalEl);

    // Cancel button
    const cancelBtn = el('button', { class: 'btn btn-ghost time-activity-cancel' }, ['Stop Early']);
    cancelBtn.addEventListener('click', () => { this.cancelled = true; });
    inner.appendChild(cancelBtn);

    overlay.appendChild(inner);
    return overlay;
  }

  protected setupEvents(): void {
    this.addChild(this.sunArc);
  }

  isCancelled(): boolean { return this.cancelled; }

  /** Initialize the sun arc to the starting time. */
  initTime(time: GameTime): void {
    this.sunArc.updateTime(time);
  }

  /** Animate the sun arc to a new time. */
  async animateSunTo(time: GameTime, durationMs: number): Promise<void> {
    await this.sunArc.animateToTime(time, durationMs);
  }

  /** Update the hour counter label. */
  setHourLabel(hourIndex: number): void {
    this.hourLabelEl.textContent = `Hour ${hourIndex + 1} of ${this.config.totalHours}`;
  }

  /** Show the dice roll animation for this hour's result. */
  async showDiceRoll(result: ForageHourResult): Promise<void> {
    await DiceDisplay.showRoll(this.diceContainer, result.rollResult, this.engine);
  }

  /** Add a result row for a completed hour. */
  addResultRow(result: ForageHourResult): void {
    const row = el('div', { class: 'time-activity-result-row' });

    const statusIcon = result.success ? '\u2714' : '\u2718';
    const statusClass = result.success ? 'time-activity-success' : 'time-activity-fail';
    row.appendChild(el('span', { class: statusClass }, [statusIcon]));

    const rollText = ` ${result.rollResult.total} vs DC ${result.dc}`;
    row.appendChild(el('span', { class: 'time-activity-roll-text font-mono' }, [rollText]));

    if (result.success && result.itemId) {
      const itemDef = getItem(result.itemId);
      const itemName = itemDef?.name ?? 'item';
      row.appendChild(el('span', { class: 'time-activity-loot font-mono' }, [
        ` \u2014 +${result.quantity} ${itemName}`,
      ]));
    } else if (!result.success) {
      row.appendChild(el('span', { class: 'time-activity-nothing font-mono' }, [
        ' \u2014 nothing found',
      ]));
    }

    this.resultsEl.appendChild(row);
    this.resultsEl.scrollTop = this.resultsEl.scrollHeight;
  }

  /** Update the running total display. */
  updateTotal(items: Map<string, number>): void {
    if (items.size === 0) {
      this.totalEl.textContent = 'Nothing found yet...';
      return;
    }
    const parts: string[] = [];
    for (const [itemId, qty] of items) {
      const itemDef = getItem(itemId);
      parts.push(`${qty}\u00d7 ${itemDef?.name ?? itemId}`);
    }
    this.totalEl.textContent = `Found: ${parts.join(', ')}`;
  }

  /** Show final summary. */
  showComplete(items: Map<string, number>): void {
    this.hourLabelEl.textContent = 'Complete';
    if (items.size === 0) {
      this.totalEl.textContent = 'The search yielded nothing.';
      this.totalEl.classList.add('time-activity-total--empty');
    } else {
      this.updateTotal(items);
      this.totalEl.classList.add('time-activity-total--done');
    }
  }
}
