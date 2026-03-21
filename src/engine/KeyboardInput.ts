import type { GameEngine, GameSystem } from './GameEngine';

export type InputContext = 'exploration' | 'combat' | 'menu';

interface KeyBinding {
  keys: string[];
  event: string;
  data: Record<string, unknown>;
  label: string;
  context: InputContext | 'global';
}

const MOVE_BINDINGS: KeyBinding[] = [
  { keys: ['k', 'ArrowUp'],     event: 'input:move', data: { dx: 0, dy: -1 },  label: 'North',     context: 'exploration' },
  { keys: ['j', 'ArrowDown'],   event: 'input:move', data: { dx: 0, dy: 1 },   label: 'South',     context: 'exploration' },
  { keys: ['h', 'ArrowLeft'],   event: 'input:move', data: { dx: -1, dy: 0 },  label: 'West',      context: 'exploration' },
  { keys: ['l', 'ArrowRight'],  event: 'input:move', data: { dx: 1, dy: 0 },   label: 'East',      context: 'exploration' },
  { keys: ['y'],                event: 'input:move', data: { dx: -1, dy: -1 }, label: 'Northwest', context: 'exploration' },
  { keys: ['u'],                event: 'input:move', data: { dx: 1, dy: -1 },  label: 'Northeast', context: 'exploration' },
  { keys: ['b'],                event: 'input:move', data: { dx: -1, dy: 1 },  label: 'Southwest', context: 'exploration' },
  { keys: ['n'],                event: 'input:move', data: { dx: 1, dy: 1 },   label: 'Southeast', context: 'exploration' },
];

const ACTION_BINDINGS: KeyBinding[] = [
  { keys: ['.'],      event: 'input:wait',      data: {},  label: 'Wait',      context: 'exploration' },
  { keys: ['x'],      event: 'input:look',      data: {},  label: 'Look',      context: 'exploration' },
  { keys: ['e'],      event: 'input:interact',   data: {},  label: 'Interact',  context: 'exploration' },
  { keys: [','],      event: 'input:pickup',     data: {},  label: 'Pick up',   context: 'exploration' },
  { keys: ['>'],      event: 'input:descend',    data: {},  label: 'Descend',   context: 'exploration' },
  { keys: ['<'],      event: 'input:ascend',     data: {},  label: 'Ascend',    context: 'exploration' },
];

const META_BINDINGS: KeyBinding[] = [
  { keys: ['i'],      event: 'input:inventory',  data: {},  label: 'Inventory', context: 'global' },
  { keys: ['c'],      event: 'input:character',  data: {},  label: 'Character', context: 'global' },
  { keys: ['m'],      event: 'input:worldmap',   data: {},  label: 'World Map', context: 'global' },
  { keys: ['?'],      event: 'input:help',       data: {},  label: 'Help',      context: 'global' },
  { keys: ['Escape'], event: 'input:cancel',     data: {},  label: 'Cancel',    context: 'global' },
];

const ALL_BINDINGS = [...MOVE_BINDINGS, ...ACTION_BINDINGS, ...META_BINDINGS];

/**
 * Translates keyboard events into semantic game actions via EventBus.
 * Supports vi-keys, arrow keys, and numpad for CDDA-style input.
 */
export class KeyboardInput implements GameSystem {
  readonly name = 'keyboard-input';
  readonly priority = 0;

  private engine!: GameEngine;
  private context: InputContext = 'menu';
  private keyMap: Map<string, KeyBinding> = new Map();
  private enabled = true;

  init(engine: GameEngine): void {
    this.engine = engine;
    this.buildKeyMap();
    document.addEventListener('keydown', this.handleKeyDown);
  }

  destroy(): void {
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  setContext(context: InputContext): void {
    this.context = context;
  }

  getContext(): InputContext {
    return this.context;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  private buildKeyMap(): void {
    for (const binding of ALL_BINDINGS) {
      for (const key of binding.keys) {
        this.keyMap.set(key, binding);
      }
    }
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (!this.enabled) return;

    // Don't capture when typing in inputs
    const tag = (document.activeElement?.tagName ?? '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    // Don't capture when a modal is open
    if (document.querySelector('.modal-overlay')) return;

    const binding = this.keyMap.get(e.key);
    if (!binding) return;

    // Check context match
    if (binding.context !== 'global' && binding.context !== this.context) return;

    e.preventDefault();
    e.stopPropagation();

    this.engine.events.emit({
      type: binding.event,
      category: 'ui',
      data: { ...binding.data },
    });
  };
}
