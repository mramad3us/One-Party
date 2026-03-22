import type { GameEngine } from '@/engine/GameEngine';
import { Component } from '@/ui/Component';
import { Button } from '@/ui/widgets/Button';
import { el } from '@/utils/dom';

export interface DeathScreenOptions {
  characterName: string;
  causeOfDeath: string;
  level: number;
  timePlayed: string;
  enemiesDefeated: number;
}

/**
 * Game over screen with slow fade-in, skull imagery,
 * death stats, and somber dark particle effect.
 */
export class DeathScreen extends Component {
  private options: DeathScreenOptions;

  constructor(parent: HTMLElement, engine: GameEngine, options: DeathScreenOptions) {
    super(parent, engine);
    this.options = options;
  }

  protected createElement(): HTMLElement {
    const { options } = this;
    const screen = el('div', { class: 'death-screen screen' });

    // Skull SVG
    const skullWrap = el('div', { class: 'death-skull' });
    skullWrap.innerHTML = `<svg viewBox="0 0 64 64" class="death-skull-svg" aria-hidden="true">
      <ellipse cx="32" cy="28" rx="20" ry="22" fill="none" stroke="currentColor" stroke-width="2"/>
      <ellipse cx="24" cy="24" rx="5" ry="6" fill="currentColor" opacity="0.8"/>
      <ellipse cx="40" cy="24" rx="5" ry="6" fill="currentColor" opacity="0.8"/>
      <path d="M28 36 L32 40 L36 36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <line x1="29" y1="44" x2="29" y2="50" stroke="currentColor" stroke-width="1.5"/>
      <line x1="32" y1="44" x2="32" y2="52" stroke="currentColor" stroke-width="1.5"/>
      <line x1="35" y1="44" x2="35" y2="50" stroke="currentColor" stroke-width="1.5"/>
      <path d="M20 50 Q32 56 44 50" fill="none" stroke="currentColor" stroke-width="2"/>
    </svg>`;
    screen.appendChild(skullWrap);

    // Title
    screen.appendChild(el('h1', { class: 'death-title font-heading' }, ['You Have Fallen']));

    // Character name + cause
    screen.appendChild(el('div', { class: 'death-name' }, [options.characterName]));
    screen.appendChild(el('div', { class: 'death-cause' }, [options.causeOfDeath]));

    // Divider
    screen.appendChild(el('hr', { class: 'divider death-divider' }));

    // Stats
    const stats = el('div', { class: 'death-stats' });

    const statItems: [string, string][] = [
      ['Level Reached', String(options.level)],
      ['Time Played', options.timePlayed],
      ['Enemies Defeated', String(options.enemiesDefeated)],
    ];

    for (const [label, value] of statItems) {
      const stat = el('div', { class: 'death-stat' });
      stat.appendChild(el('div', { class: 'death-stat-value font-mono' }, [value]));
      stat.appendChild(el('div', { class: 'death-stat-label' }, [label]));
      stats.appendChild(stat);
    }
    screen.appendChild(stats);

    // Buttons
    const actions = el('div', { class: 'death-actions' });

    const loadBtn = new Button(actions, this.engine, {
      label: 'Load Last Save',
      variant: 'primary',
      size: 'lg',
      onClick: () => {
        this.engine.events.emit({ type: 'ui:action:load-save', category: 'ui', data: {} });
      },
    });
    this.children.push(loadBtn);

    const menuBtn = new Button(actions, this.engine, {
      label: 'Return to Menu',
      variant: 'secondary',
      size: 'lg',
      onClick: () => {
        this.engine.events.emit({ type: 'ui:navigate', category: 'ui', data: { screen: 'menu', direction: 'right' } });
      },
    });
    this.children.push(menuBtn);

    screen.appendChild(actions);

    return screen;
  }

  mount(): void {
    super.mount();

    // Mount buttons after screen is in DOM
    for (const child of this.children) {
      child.mount();
    }

    // Stagger fade-in of elements
    const elements = [
      this.$('.death-skull'),
      this.$('.death-title'),
      this.$('.death-name'),
      this.$('.death-cause'),
      this.$('.death-divider'),
      this.$('.death-stats'),
      this.$('.death-actions'),
    ].filter(Boolean) as HTMLElement[];

    for (const elem of elements) {
      elem.style.opacity = '0';
      elem.style.transform = 'translateY(15px)';
    }

    elements.forEach((elem, i) => {
      setTimeout(() => {
        elem.style.transition = 'opacity 0.8s var(--ease-smooth), transform 0.8s var(--ease-out-back)';
        elem.style.opacity = '1';
        elem.style.transform = 'translateY(0)';
      }, 500 + i * 300);
    });
  }
}
