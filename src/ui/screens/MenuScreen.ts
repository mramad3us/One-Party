import type { GameEngine } from '@/engine/GameEngine';
import { Component } from '@/ui/Component';
import { el } from '@/utils/dom';

/**
 * Main menu screen — the first thing the player sees.
 * Full-screen dark fantasy layout with animated ember particles,
 * gold gradient title, and stagger-animated buttons.
 */
export class MenuScreen extends Component {
  constructor(parent: HTMLElement, engine: GameEngine) {
    super(parent, engine);
  }

  protected createElement(): HTMLElement {
    const screen = el('div', { class: 'menu-screen screen' });

    // ── Ember Particles ──
    const embers = el('div', { class: 'menu-embers' });
    for (let i = 0; i < 8; i++) {
      embers.appendChild(el('div', { class: 'menu-ember' }));
    }
    screen.appendChild(embers);

    // ── Logo Area ──
    const logo = el('div', { class: 'menu-logo' });

    const title = el('h1', { class: 'menu-title' }, ['ONE PARTY']);
    const subtitle = el('p', { class: 'menu-subtitle' }, [
      'A Solo D&D 5e Adventure',
    ]);
    const version = el('span', { class: 'menu-version' }, ['v0.3.15']);
    const ornament = el('div', { class: 'menu-ornament' });

    logo.appendChild(title);
    logo.appendChild(subtitle);
    logo.appendChild(ornament);
    logo.appendChild(version);
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

    const deleteWorldBtn = el(
      'button',
      { class: 'btn btn-ghost btn-lg menu-delete-world', 'data-action': 'delete-world' },
      ['Delete World'],
    );

    actions.appendChild(newBtn);
    actions.appendChild(continueBtn);
    actions.appendChild(loadBtn);
    actions.appendChild(settingsBtn);
    actions.appendChild(deleteWorldBtn);
    screen.appendChild(actions);

    // ── Footer ──
    const footer = el('div', { class: 'menu-footer' });
    footer.appendChild(
      el('p', { class: 'menu-footer-text' }, [
        'Built with dice and determination',
      ]),
    );
    screen.appendChild(footer);

    return screen;
  }

  protected setupEvents(): void {
    // New Adventure
    const newBtn = this.el.querySelector('[data-action="new"]');
    if (newBtn) {
      this.listen(newBtn, 'click', () => {
        this.engine.events.emit({
          type: 'ui:navigate',
          category: 'ui',
          data: { screen: 'creation', direction: 'left' },
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
