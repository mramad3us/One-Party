import type { GameEngine } from '@/engine/GameEngine';
import { Component } from '@/ui/Component';
import { AnimationSystem } from '@/ui/AnimationSystem';
import { el } from '@/utils/dom';

export interface ProgressBarOptions {
  value: number;
  max: number;
  variant?: 'hp' | 'xp' | 'mana' | 'default';
  showLabel?: boolean;
  animated?: boolean;
}

/**
 * Animated progress/health bar with color transitions
 * and damage chunk effects.
 */
export class ProgressBar extends Component {
  private fillEl!: HTMLElement;
  private labelEl!: HTMLElement;
  private damageEl!: HTMLElement;
  private currentValue: number;
  private currentMax: number;

  constructor(
    parent: HTMLElement,
    engine: GameEngine,
    private options: ProgressBarOptions,
  ) {
    super(parent, engine);
    this.currentValue = options.value;
    this.currentMax = options.max;
  }

  protected createElement(): HTMLElement {
    const { value, max, variant = 'default', showLabel = true } = this.options;

    const bar = el('div', { class: `hp-bar hp-bar--${variant}` });

    // Damage chunk (hidden initially)
    this.damageEl = el('div', { class: 'hp-bar-damage' });
    this.damageEl.style.opacity = '0';
    bar.appendChild(this.damageEl);

    // Fill
    this.fillEl = el('div', { class: 'hp-bar-fill' });
    const pct = max > 0 ? (value / max) * 100 : 0;
    this.fillEl.style.width = `${pct}%`;
    this.updateFillColor(value, max);
    bar.appendChild(this.fillEl);

    // Label
    this.labelEl = el('div', { class: 'hp-bar-label' });
    if (showLabel) {
      this.labelEl.textContent = `${value} / ${max}`;
    }
    bar.appendChild(this.labelEl);

    return bar;
  }

  /**
   * Update the bar value with optional smooth animation.
   * Shows a damage chunk when value decreases.
   */
  setValue(newValue: number, animate = true): void {
    const oldValue = this.currentValue;
    const max = this.currentMax;
    this.currentValue = Math.max(0, Math.min(newValue, max));

    const pct = max > 0 ? (this.currentValue / max) * 100 : 0;
    const oldPct = max > 0 ? (oldValue / max) * 100 : 0;

    // Show damage chunk on decrease
    if (this.currentValue < oldValue && animate) {
      this.showDamageChunk(oldPct, pct);
    }

    // Animate fill width
    if (animate && this.options.animated !== false) {
      this.fillEl.style.width = `${pct}%`;
      this.updateFillColor(this.currentValue, max);

      // Animate label number
      AnimationSystem.tweenValue(
        oldValue,
        this.currentValue,
        500,
        (v) => {
          if (this.options.showLabel !== false) {
            this.labelEl.textContent = `${Math.round(v)} / ${max}`;
          }
        },
      );
    } else {
      this.fillEl.style.width = `${pct}%`;
      this.updateFillColor(this.currentValue, max);
      if (this.options.showLabel !== false) {
        this.labelEl.textContent = `${this.currentValue} / ${max}`;
      }
    }
  }

  /** Update the maximum value. */
  setMax(max: number): void {
    this.currentMax = max;
    const pct = max > 0 ? (this.currentValue / max) * 100 : 0;
    this.fillEl.style.width = `${pct}%`;
    this.updateFillColor(this.currentValue, max);
    if (this.options.showLabel !== false) {
      this.labelEl.textContent = `${this.currentValue} / ${max}`;
    }
  }

  private updateFillColor(value: number, max: number): void {
    const ratio = max > 0 ? value / max : 0;
    this.fillEl.classList.remove('hp-medium', 'hp-low');
    if (ratio <= 0.25) {
      this.fillEl.classList.add('hp-low');
    } else if (ratio <= 0.5) {
      this.fillEl.classList.add('hp-medium');
    }
  }

  private showDamageChunk(oldPct: number, newPct: number): void {
    // Position the damage overlay where HP was lost
    this.damageEl.style.left = `${newPct}%`;
    this.damageEl.style.width = `${oldPct - newPct}%`;
    this.damageEl.style.opacity = '1';

    // Fade out the damage chunk
    setTimeout(() => {
      this.damageEl.style.opacity = '0';
      this.damageEl.style.width = '0';
    }, 600);
  }
}
