import type { GameEngine } from '@/engine/GameEngine';
import type { Character, SurvivalState } from '@/types';
import { Component } from '@/ui/Component';
import { ProgressBar } from '@/ui/widgets/ProgressBar';
import { el } from '@/utils/dom';
import { SurvivalRules } from '@/rules/SurvivalRules';

/**
 * CDDA-inspired dense status readout.
 * Shows character vitals and survival state with
 * color-coded bars and threshold labels.
 */
export class StatusPanel extends Component {
  private nameEl!: HTMLElement;
  private infoEl!: HTMLElement;
  private hpBar!: ProgressBar;
  private hpLabel!: HTMLElement;
  private acEl!: HTMLElement;
  private speedEl!: HTMLElement;
  private hungerBar!: ProgressBar;
  private hungerLabel!: HTMLElement;
  private thirstBar!: ProgressBar;
  private thirstLabel!: HTMLElement;
  private fatigueBar!: ProgressBar;
  private fatigueLabel!: HTMLElement;
  private exhaustionEl!: HTMLElement;
  private conditionsEl!: HTMLElement;

  constructor(parent: HTMLElement, engine: GameEngine) {
    super(parent, engine);
  }

  protected createElement(): HTMLElement {
    const panel = el('div', { class: 'status-panel' });

    // ── Character Identity ──
    const identity = el('div', { class: 'status-identity' });
    this.nameEl = el('div', { class: 'status-name font-heading' });
    this.infoEl = el('div', { class: 'status-info font-mono' });
    identity.appendChild(this.nameEl);
    identity.appendChild(this.infoEl);
    panel.appendChild(identity);

    panel.appendChild(el('div', { class: 'status-divider' }));

    // ── Vitals ──
    const vitals = el('div', { class: 'status-section' });

    const hpRow = el('div', { class: 'status-row' });
    this.hpLabel = el('span', { class: 'status-label font-mono' }, ['HP']);
    const hpBarWrap = el('div', { class: 'status-bar-wrap' });
    this.hpBar = new ProgressBar(hpBarWrap, this.engine, {
      value: 0, max: 1, variant: 'hp', showLabel: true, animated: true,
    });
    hpRow.appendChild(this.hpLabel);
    hpRow.appendChild(hpBarWrap);
    vitals.appendChild(hpRow);

    const statsRow = el('div', { class: 'status-stats font-mono' });
    this.acEl = el('span', { class: 'status-stat' });
    this.speedEl = el('span', { class: 'status-stat' });
    statsRow.appendChild(this.acEl);
    statsRow.appendChild(this.speedEl);
    vitals.appendChild(statsRow);
    panel.appendChild(vitals);

    panel.appendChild(el('div', { class: 'status-divider' }));

    // ── Survival Tracks ──
    const survival = el('div', { class: 'status-section' });

    // Hunger
    const hungerRow = el('div', { class: 'status-row' });
    this.hungerLabel = el('span', { class: 'status-label status-label--hunger font-mono' }, ['Hunger']);
    const hungerBarWrap = el('div', { class: 'status-bar-wrap' });
    this.hungerBar = new ProgressBar(hungerBarWrap, this.engine, {
      value: 0, max: 100, variant: 'default', showLabel: false, animated: true,
    });
    hungerRow.appendChild(this.hungerLabel);
    hungerRow.appendChild(hungerBarWrap);
    survival.appendChild(hungerRow);

    // Thirst
    const thirstRow = el('div', { class: 'status-row' });
    this.thirstLabel = el('span', { class: 'status-label status-label--thirst font-mono' }, ['Thirst']);
    const thirstBarWrap = el('div', { class: 'status-bar-wrap' });
    this.thirstBar = new ProgressBar(thirstBarWrap, this.engine, {
      value: 0, max: 100, variant: 'default', showLabel: false, animated: true,
    });
    thirstRow.appendChild(this.thirstLabel);
    thirstRow.appendChild(thirstBarWrap);
    survival.appendChild(thirstRow);

    // Fatigue
    const fatigueRow = el('div', { class: 'status-row' });
    this.fatigueLabel = el('span', { class: 'status-label status-label--fatigue font-mono' }, ['Fatigue']);
    const fatigueBarWrap = el('div', { class: 'status-bar-wrap' });
    this.fatigueBar = new ProgressBar(fatigueBarWrap, this.engine, {
      value: 0, max: 100, variant: 'default', showLabel: false, animated: true,
    });
    fatigueRow.appendChild(this.fatigueLabel);
    fatigueRow.appendChild(fatigueBarWrap);
    survival.appendChild(fatigueRow);

    // Exhaustion
    this.exhaustionEl = el('div', { class: 'status-exhaustion font-mono' });
    survival.appendChild(this.exhaustionEl);
    panel.appendChild(survival);

    panel.appendChild(el('div', { class: 'status-divider' }));

    // ── Conditions ──
    this.conditionsEl = el('div', { class: 'status-conditions font-mono' });
    panel.appendChild(this.conditionsEl);

    return panel;
  }

  protected setupEvents(): void {
    this.addChild(this.hpBar);
    this.addChild(this.hungerBar);
    this.addChild(this.thirstBar);
    this.addChild(this.fatigueBar);
  }

  /** Full update from character data. */
  setCharacter(character: Character): void {
    this.nameEl.textContent = character.name;
    const className = character.class.charAt(0).toUpperCase() + character.class.slice(1);
    const raceName = character.race.charAt(0).toUpperCase() + character.race.slice(1);
    this.infoEl.textContent = `Lvl ${character.level} ${raceName} ${className}`;

    this.hpBar.setMax(character.maxHp);
    this.hpBar.setValue(character.currentHp);

    this.acEl.textContent = `AC ${character.armorClass}`;
    this.speedEl.textContent = `Speed ${character.speed}ft`;

    this.updateSurvival(character.survival);
    this.updateConditions(character);
  }

  /** Update survival bars and labels. */
  updateSurvival(survival: SurvivalState): void {
    const hungerThreshold = SurvivalRules.getHungerThreshold(survival.hunger);
    const thirstThreshold = SurvivalRules.getThirstThreshold(survival.thirst);
    const fatigueThreshold = SurvivalRules.getFatigueThreshold(survival.fatigue);

    // Update bars (inverted: 0=full bar, 100=empty bar)
    this.hungerBar.setValue(100 - survival.hunger);
    this.thirstBar.setValue(100 - survival.thirst);
    this.fatigueBar.setValue(100 - survival.fatigue);

    // Update labels with threshold names
    this.hungerLabel.textContent = `${SurvivalRules.formatThreshold(hungerThreshold)}`;
    this.thirstLabel.textContent = `${SurvivalRules.formatThreshold(thirstThreshold)}`;
    this.fatigueLabel.textContent = `${SurvivalRules.formatThreshold(fatigueThreshold)}`;

    // Color code labels
    this.setTrackColor(this.hungerLabel, survival.hunger);
    this.setTrackColor(this.thirstLabel, survival.thirst);
    this.setTrackColor(this.fatigueLabel, survival.fatigue);

    // Color code bar fills
    this.setBarColor(this.hungerBar, survival.hunger);
    this.setBarColor(this.thirstBar, survival.thirst);
    this.setBarColor(this.fatigueBar, survival.fatigue);

    // Exhaustion
    if (survival.exhaustionLevel > 0) {
      this.exhaustionEl.textContent = `Exhaustion Level ${survival.exhaustionLevel}`;
      this.exhaustionEl.className = 'status-exhaustion font-mono status-critical';
      this.exhaustionEl.style.display = '';
    } else {
      this.exhaustionEl.style.display = 'none';
    }
  }

  private updateConditions(character: Character): void {
    this.conditionsEl.innerHTML = '';
    if (character.conditions.length === 0) {
      this.conditionsEl.textContent = 'No conditions';
      this.conditionsEl.classList.add('status-dim');
    } else {
      this.conditionsEl.classList.remove('status-dim');
      for (const cond of character.conditions) {
        const badge = el('span', { class: 'badge badge-red status-condition-badge' }, [
          cond.type.charAt(0).toUpperCase() + cond.type.slice(1),
        ]);
        this.conditionsEl.appendChild(badge);
      }
    }
  }

  private setTrackColor(element: HTMLElement, value: number): void {
    element.classList.remove('status-good', 'status-warn', 'status-danger', 'status-critical');
    if (value <= 30) element.classList.add('status-good');
    else if (value <= 50) element.classList.add('status-warn');
    else if (value <= 75) element.classList.add('status-danger');
    else element.classList.add('status-critical');
  }

  private setBarColor(bar: ProgressBar, value: number): void {
    const barEl = (bar as unknown as { el: HTMLElement }).el;
    if (!barEl) return;
    const fill = barEl.querySelector('.hp-bar-fill') as HTMLElement;
    if (!fill) return;
    fill.classList.remove('survival-good', 'survival-warn', 'survival-danger', 'survival-critical');
    if (value <= 30) fill.classList.add('survival-good');
    else if (value <= 50) fill.classList.add('survival-warn');
    else if (value <= 75) fill.classList.add('survival-danger');
    else fill.classList.add('survival-critical');
  }
}
