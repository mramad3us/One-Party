import type { GameEngine } from '@/engine/GameEngine';
import { Component } from '@/ui/Component';
import { FocusNav } from '@/ui/FocusNav';
import { el } from '@/utils/dom';

/**
 * World selection screen — choose between procedural generation
 * or importing a handcrafted world.
 */
export class WorldSelectionScreen extends Component {
  private focusNav: FocusNav;

  constructor(parent: HTMLElement, engine: GameEngine) {
    super(parent, engine);
    this.focusNav = new FocusNav({
      onSelect: (el) => (el as HTMLButtonElement).click(),
    });
  }

  protected createElement(): HTMLElement {
    const screen = el('div', { class: 'worldsel-screen screen' });

    // ── Header ──
    const header = el('div', { class: 'worldsel-header' });
    const title = el('h1', { class: 'worldsel-title font-heading' }, ['Choose Your World']);
    const subtitle = el('p', { class: 'worldsel-subtitle' }, [
      'Every adventure begins with a world to explore',
    ]);
    header.appendChild(title);
    header.appendChild(subtitle);
    screen.appendChild(header);

    // ── Choice cards ──
    const choices = el('div', { class: 'worldsel-choices' });

    // Procedural card
    const procCard = el('button', { class: 'worldsel-card', 'data-action': 'procedural' });
    const procIcon = el('div', { class: 'worldsel-card-icon' }, ['\u2726']); // ✦
    procCard.appendChild(procIcon);
    procCard.appendChild(el('h2', { class: 'worldsel-card-title font-heading' }, ['Forge a World']));
    procCard.appendChild(el('p', { class: 'worldsel-card-desc' }, [
      'Procedurally generate a unique world with randomized terrain, settlements, and regions.',
    ]));
    procCard.appendChild(el('span', { class: 'worldsel-card-hint font-mono' }, ['[1]']));
    choices.appendChild(procCard);

    // Handcrafted card
    const craftCard = el('button', { class: 'worldsel-card', 'data-action': 'handcrafted' });
    const craftIcon = el('div', { class: 'worldsel-card-icon' }, ['\u270D']); // ✍
    craftCard.appendChild(craftIcon);
    craftCard.appendChild(el('h2', { class: 'worldsel-card-title font-heading' }, ['Import a World']));
    craftCard.appendChild(el('p', { class: 'worldsel-card-desc' }, [
      'Load a handcrafted world from a JSON file \u2014 curated adventures designed by hand.',
    ]));
    craftCard.appendChild(el('span', { class: 'worldsel-card-hint font-mono' }, ['[2]']));
    choices.appendChild(craftCard);

    screen.appendChild(choices);

    // ── Back link ──
    const back = el('button', { class: 'worldsel-back btn btn-ghost', 'data-action': 'back' }, [
      '\u2190 Back to Menu',
    ]);
    screen.appendChild(back);

    return screen;
  }

  protected setupEvents(): void {
    const procBtn = this.el.querySelector('[data-action="procedural"]');
    if (procBtn) {
      this.listen(procBtn, 'click', () => {
        this.engine.events.emit({
          type: 'ui:navigate',
          category: 'ui',
          data: { screen: 'worldcreation', direction: 'left' },
        });
      });
    }

    const craftBtn = this.el.querySelector('[data-action="handcrafted"]');
    if (craftBtn) {
      this.listen(craftBtn, 'click', () => {
        this.engine.events.emit({
          type: 'ui:navigate',
          category: 'ui',
          data: { screen: 'worldpicker', direction: 'left' },
        });
      });
    }

    const backBtn = this.el.querySelector('[data-action="back"]');
    if (backBtn) {
      this.listen(backBtn, 'click', () => {
        this.engine.events.emit({
          type: 'ui:navigate',
          category: 'ui',
          data: { screen: 'menu', direction: 'right' },
        });
      });
    }

    // Keyboard shortcuts: 1 = procedural, 2 = handcrafted
    this.listen(document, 'keydown', (e: Event) => {
      const ke = e as KeyboardEvent;
      if (ke.key === '1') {
        ke.preventDefault();
        (procBtn as HTMLElement)?.click();
      } else if (ke.key === '2') {
        ke.preventDefault();
        (craftBtn as HTMLElement)?.click();
      }
    });

    const buttons = Array.from(this.el.querySelectorAll('.worldsel-card, .worldsel-back')) as HTMLElement[];
    this.focusNav.setItems(buttons);
    this.focusNav.attach();
  }

  destroy(): void {
    this.focusNav.detach();
    super.destroy();
  }
}
