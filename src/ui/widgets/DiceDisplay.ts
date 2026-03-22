import type { GameEngine } from '@/engine/GameEngine';
import type { DiceRollResult } from '@/types';
import { Component } from '@/ui/Component';
import { IconSystem } from '@/ui/IconSystem';
import { el } from '@/utils/dom';

/**
 * Animated dice roll display.
 * Shows the correct die shape (d4–d100), tumbles, reveals result, then fades out.
 */
export class DiceDisplay extends Component {
  private result: DiceRollResult;

  constructor(parent: HTMLElement, engine: GameEngine, result: DiceRollResult) {
    super(parent, engine);
    this.result = result;
  }

  protected createElement(): HTMLElement {
    const { result } = this;
    const wrapper = el('div', { class: 'dice-display' });

    // Dice icon(s) with correct die type
    const dieType = result.dieType ?? 20;
    const iconName = `dice-d${dieType}`;
    const iconWrap = el('div', { class: 'dice-display-icon' });

    // Show correct number of dice for multi-die rolls
    const diceCount = result.rolls.length;
    const showMultiple = diceCount > 1 && diceCount <= 4;

    if (showMultiple) {
      for (let i = 0; i < diceCount; i++) {
        const dieWrap = el('div', { class: 'dice-display-die-single' });
        const diceIcon = IconSystem.icon(iconName);
        diceIcon.classList.add('dice-display-die');
        dieWrap.appendChild(diceIcon);
        iconWrap.appendChild(dieWrap);
      }
      iconWrap.classList.add('dice-display-icon--multi');
    } else {
      const diceIcon = IconSystem.icon(iconName);
      diceIcon.classList.add('dice-display-die');
      iconWrap.appendChild(diceIcon);
    }

    wrapper.appendChild(iconWrap);

    // Individual dice results
    if (result.rolls.length > 0) {
      const rollsRow = el('div', { class: 'dice-display-rolls' });
      for (const roll of result.rolls) {
        const dieEl = el('span', { class: 'dice-display-roll' }, [String(roll)]);
        rollsRow.appendChild(dieEl);
      }
      if (result.modifier !== 0) {
        const modStr = result.modifier > 0 ? `+${result.modifier}` : String(result.modifier);
        rollsRow.appendChild(el('span', { class: 'dice-display-modifier' }, [modStr]));
      }
      wrapper.appendChild(rollsRow);
    }

    // Total
    const totalClasses = ['dice-display-total'];
    if (result.isCritical) totalClasses.push('dice-display-total--crit');
    if (result.isFumble) totalClasses.push('dice-display-total--fumble');

    const totalEl = el('div', { class: totalClasses.join(' ') }, [String(result.total)]);
    wrapper.appendChild(totalEl);

    // Critical/fumble label
    if (result.isCritical) {
      wrapper.appendChild(el('div', { class: 'dice-display-crit-label font-heading' }, ['CRITICAL!']));
    } else if (result.isFumble) {
      wrapper.appendChild(el('div', { class: 'dice-display-fumble-label font-heading' }, ['FUMBLE!']));
    }

    // Description
    if (result.description) {
      wrapper.appendChild(el('div', { class: 'dice-display-desc' }, [result.description]));
    }

    // Advantage/disadvantage indicator
    if (result.advantage || result.disadvantage) {
      const advLabel = result.advantage ? 'Advantage' : 'Disadvantage';
      wrapper.appendChild(el('div', {
        class: `dice-display-adv ${result.advantage ? 'dice-display-adv--adv' : 'dice-display-adv--dis'}`,
      }, [advLabel]));
    }

    return wrapper;
  }

  /**
   * Mini dice roll shown on top of an element (e.g. initiative bar icon for NPC rolls).
   * Much faster and more compact than the full-screen version.
   */
  static async showRollMini(anchor: HTMLElement, result: DiceRollResult, _engine: GameEngine): Promise<void> {
    const mini = el('div', { class: 'dice-mini-overlay' });

    // Die icon
    const dieType = result.dieType ?? 20;
    const dieIcon = IconSystem.icon(`dice-d${dieType}`);
    dieIcon.classList.add('dice-mini-die');
    mini.appendChild(dieIcon);

    // Total number
    const totalClasses = ['dice-mini-total'];
    if (result.isCritical) totalClasses.push('dice-mini-total--crit');
    if (result.isFumble) totalClasses.push('dice-mini-total--fumble');
    const totalEl = el('span', { class: totalClasses.join(' ') }, [String(result.total)]);
    mini.appendChild(totalEl);

    anchor.appendChild(mini);

    // Phase 1: Slide in + quick tumble (die spins while panel enters)
    mini.animate([
      { opacity: '0', transform: 'translateX(-50%) translateY(calc(100% - 4px))' },
      { opacity: '1', transform: 'translateX(-50%) translateY(100%)' },
    ], { duration: 200, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' });

    dieIcon.animate([
      { transform: 'rotate(0deg) scale(0.5)', opacity: '0.3' },
      { transform: 'rotate(540deg) scale(1)', opacity: '1' },
    ], { duration: 300, easing: 'ease-out', fill: 'forwards' });

    // Hide total initially, reveal after tumble
    totalEl.style.opacity = '0';
    await new Promise<void>((r) => setTimeout(r, 300));

    // Phase 2: Reveal total with a quick pop
    totalEl.animate([
      { opacity: '0', transform: 'scale(0.7)' },
      { opacity: '1', transform: 'scale(1)' },
    ], { duration: 150, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' });

    // Hold — just enough to read the number
    const holdTime = result.isCritical || result.isFumble ? 650 : 400;
    await new Promise<void>((r) => setTimeout(r, holdTime));

    // Phase 3: Fade out downward
    mini.animate([
      { opacity: '1', transform: 'translateX(-50%) translateY(100%)' },
      { opacity: '0', transform: 'translateX(-50%) translateY(calc(100% + 6px))' },
    ], { duration: 180, easing: 'ease-in', fill: 'forwards' });
    await new Promise<void>((r) => setTimeout(r, 180));

    mini.remove();
  }

  /**
   * Static helper: show a dice roll with tumbling animation, wait, then auto-remove.
   */
  static async showRoll(parent: HTMLElement, result: DiceRollResult, engine: GameEngine): Promise<void> {
    const display = new DiceDisplay(parent, engine, result);
    display.mount();

    // Start with the whole display visible but results hidden
    display.el.style.opacity = '1';

    // Phase 1: Tumble animation on each die
    const diceEls = display.el.querySelectorAll('.dice-display-die');
    diceEls.forEach((die, i) => {
      (die as HTMLElement).classList.add('dice-display-die--tumbling');
      (die as HTMLElement).style.animationDelay = `${i * 100}ms`;
    });

    // Hide results during tumble
    const rollsRow = display.el.querySelector('.dice-display-rolls') as HTMLElement | null;
    const totalEl = display.el.querySelector('.dice-display-total') as HTMLElement | null;
    const critLabel = display.el.querySelector('.dice-display-crit-label, .dice-display-fumble-label') as HTMLElement | null;
    const descEl = display.el.querySelector('.dice-display-desc') as HTMLElement | null;
    const advEl = display.el.querySelector('.dice-display-adv') as HTMLElement | null;

    if (rollsRow) rollsRow.style.opacity = '0';
    if (totalEl) totalEl.style.opacity = '0';
    if (critLabel) critLabel.style.opacity = '0';
    if (descEl) descEl.style.opacity = '0';
    if (advEl) advEl.style.opacity = '0';

    // Wait for tumble to finish
    await new Promise<void>((r) => setTimeout(r, 1000));

    // Phase 2: Stop tumbling, reveal results with staggered fade-in
    diceEls.forEach((die) => {
      (die as HTMLElement).classList.remove('dice-display-die--tumbling');
    });

    // Staggered reveal: rolls → total → labels
    if (rollsRow) {
      rollsRow.style.transition = 'opacity 0.3s ease-out';
      rollsRow.style.opacity = '1';
    }
    await new Promise<void>((r) => setTimeout(r, 150));

    if (totalEl) {
      totalEl.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
      totalEl.style.opacity = '1';
    }
    await new Promise<void>((r) => setTimeout(r, 100));

    // Critical/fumble flash + label
    if (result.isCritical) {
      display.el.classList.add('dice-display--crit-flash');
    } else if (result.isFumble) {
      display.el.classList.add('dice-display--fumble-flash');
    }

    if (critLabel) {
      critLabel.style.transition = 'opacity 0.3s ease-out';
      critLabel.style.opacity = '1';
    }
    if (descEl) {
      descEl.style.transition = 'opacity 0.3s ease-out';
      descEl.style.opacity = '1';
    }
    if (advEl) {
      advEl.style.transition = 'opacity 0.3s ease-out';
      advEl.style.opacity = '1';
    }

    // Hold for reading
    await new Promise<void>((r) => setTimeout(r, result.isCritical || result.isFumble ? 2000 : 1200));

    // Fade out smoothly — preserve the centering transform to avoid position jump
    await display.animateEl(display.el, [
      { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
      { opacity: '0', transform: 'translate(-50%, -50%) scale(0.95) translateY(-12px)' },
    ], { duration: 350 });

    display.destroy();
    display.el.remove();
  }
}
