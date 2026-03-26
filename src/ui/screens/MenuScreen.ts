import type { GameEngine } from '@/engine/GameEngine';
import { Component } from '@/ui/Component';
import { FocusNav } from '@/ui/FocusNav';
import { el } from '@/utils/dom';

/**
 * Main menu screen — the first thing the player sees.
 * Candlelit manuscript aesthetic: near-black with a single warm glow,
 * letter-by-letter title reveal, and editorial text-link buttons.
 */
export class MenuScreen extends Component {
  private focusNav: FocusNav;

  constructor(parent: HTMLElement, engine: GameEngine) {
    super(parent, engine);
    this.focusNav = new FocusNav({
      onSelect: (el) => (el as HTMLButtonElement).click(),
    });
  }

  protected createElement(): HTMLElement {
    const screen = el('div', { class: 'menu-screen screen' });

    // ── Logo Area ──
    const logo = el('div', { class: 'menu-logo' });

    // Title with per-letter stagger animation
    const title = el('h1', { class: 'menu-title' });
    const letters = 'ONE PARTY';
    letters.split('').forEach((char, i) => {
      const span = el('span', {
        class: 'menu-title-letter',
        style: `animation-delay: ${200 + i * 70}ms`,
      }, [char === ' ' ? '\u2004' : char]); // thin space for visual gap
      title.appendChild(span);
    });

    const subtitle = el('p', { class: 'menu-subtitle' }, [
      'A Solo D\u2009&\u2009D 5e Adventure',
    ]);

    logo.appendChild(title);
    logo.appendChild(subtitle);
    screen.appendChild(logo);

    // ── Menu Buttons ──
    const actions = el('div', { class: 'menu-actions' });

    const newBtn = el(
      'button',
      { class: 'btn btn-primary btn-lg', 'data-action': 'new' },
      ['New Adventure'],
    );

    const continueBtn = el(
      'button',
      {
        class: 'btn btn-secondary btn-lg',
        'data-action': 'continue',
        disabled: '',
      },
      ['Continue Journey'],
    );

    const loadBtn = el(
      'button',
      {
        class: 'btn btn-secondary btn-lg',
        'data-action': 'load',
        disabled: '',
      },
      ['Load Game'],
    );

    const settingsBtn = el(
      'button',
      { class: 'btn btn-secondary btn-lg', 'data-action': 'settings' },
      ['Settings'],
    );

    const exportWorldBtn = el(
      'button',
      { class: 'btn btn-ghost btn-lg menu-export-world', 'data-action': 'export-world' },
      ['Export World'],
    );

    const deleteWorldBtn = el(
      'button',
      { class: 'btn btn-ghost btn-lg menu-delete-world', 'data-action': 'delete-world' },
      ['Delete World'],
    );

    actions.appendChild(newBtn);
    actions.appendChild(continueBtn);
    actions.appendChild(loadBtn);
    actions.appendChild(settingsBtn);
    actions.appendChild(exportWorldBtn);
    actions.appendChild(deleteWorldBtn);
    screen.appendChild(actions);

    // ── Footer ──
    const footer = el('div', { class: 'menu-footer' });
    footer.appendChild(
      el('span', { class: 'menu-version' }, [`v${__APP_VERSION__}`]),
    );
    footer.appendChild(
      el('p', { class: 'menu-footer-text' }, [
        'Built with dice and determination',
      ]),
    );
    screen.appendChild(footer);

    return screen;
  }

  protected setupEvents(): void {
    // New Adventure — main.ts decides whether to go to creation or world selection
    const newBtn = this.el.querySelector('[data-action="new"]');
    if (newBtn) {
      this.listen(newBtn, 'click', () => {
        this.engine.events.emit({
          type: 'ui:new_adventure',
          category: 'ui',
          data: {},
        });
      });
    }

    // Continue Journey — load most recent save, then navigate
    const contBtn = this.el.querySelector('[data-action="continue"]');
    if (contBtn) {
      this.listen(contBtn, 'click', () => {
        this.engine.events.emit({
          type: 'ui:continue_game',
          category: 'ui',
          data: {},
        });
      });
    }

    // Load Game
    const loadBtn = this.el.querySelector('[data-action="load"]');
    if (loadBtn) {
      this.listen(loadBtn, 'click', () => {
        this.engine.events.emit({
          type: 'ui:modal:load',
          category: 'ui',
          data: {},
        });
      });
    }

    // Export World
    const exportBtn = this.el.querySelector('[data-action="export-world"]');
    if (exportBtn) {
      this.listen(exportBtn, 'click', () => {
        this.engine.events.emit({
          type: 'world:export',
          category: 'world',
          data: {},
        });
      });
    }

    // Delete World
    const delWorldBtn = this.el.querySelector('[data-action="delete-world"]');
    if (delWorldBtn) {
      this.listen(delWorldBtn, 'click', () => {
        this.engine.events.emit({
          type: 'world:delete',
          category: 'world',
          data: {},
        });
      });
    }

    // Settings
    const settingsBtn = this.el.querySelector('[data-action="settings"]');
    if (settingsBtn) {
      this.listen(settingsBtn, 'click', () => {
        this.engine.events.emit({
          type: 'ui:modal:settings',
          category: 'ui',
          data: {},
        });
      });
    }

    // Check if saves exist to enable continue/load buttons
    this.checkSaves();

    // Keyboard navigation for menu buttons
    const buttons = Array.from(this.el.querySelectorAll('.menu-actions .btn')) as HTMLElement[];
    this.focusNav.setItems(buttons);
    this.focusNav.attach();
  }

  mount(): void {
    super.mount();
    // Re-attach focus nav when remounting
    const buttons = Array.from(this.el.querySelectorAll('.menu-actions .btn')) as HTMLElement[];
    this.focusNav.setItems(buttons);
    this.focusNav.attach();
  }

  destroy(): void {
    this.focusNav.detach();
    super.destroy();
  }

  private checkSaves(): void {
    // Check localStorage for saved games
    const hasSaves = localStorage.getItem('oneparty-saves') !== null;
    if (hasSaves) {
      const contBtn = this.el.querySelector(
        '[data-action="continue"]',
      ) as HTMLButtonElement | null;
      const loadBtn = this.el.querySelector(
        '[data-action="load"]',
      ) as HTMLButtonElement | null;
      if (contBtn) contBtn.removeAttribute('disabled');
      if (loadBtn) loadBtn.removeAttribute('disabled');
    }
  }
}
