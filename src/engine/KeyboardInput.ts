import type { GameEngine, GameSystem } from './GameEngine';

/**
 * Maps KeyboardEvent.code → logical key character.
 * Enables layout-independent matching for AZERTY, QWERTZ, and other non-QWERTY keyboards.
 * e.g. on AZERTY, the '1' physical key emits code 'Digit1' but e.key is '&'.
 */
const CODE_TO_KEY = new Map<string, string>([
  ['Digit1', '1'], ['Digit2', '2'], ['Digit3', '3'], ['Digit4', '4'], ['Digit5', '5'],
  ['Digit6', '6'], ['Digit7', '7'], ['Digit8', '8'], ['Digit9', '9'], ['Digit0', '0'],
  ['KeyA', 'a'], ['KeyB', 'b'], ['KeyC', 'c'], ['KeyD', 'd'], ['KeyE', 'e'],
  ['KeyF', 'f'], ['KeyG', 'g'], ['KeyH', 'h'], ['KeyI', 'i'], ['KeyJ', 'j'],
  ['KeyK', 'k'], ['KeyL', 'l'], ['KeyM', 'm'], ['KeyN', 'n'], ['KeyO', 'o'],
  ['KeyP', 'p'], ['KeyQ', 'q'], ['KeyR', 'r'], ['KeyS', 's'], ['KeyT', 't'],
  ['KeyU', 'u'], ['KeyV', 'v'], ['KeyW', 'w'], ['KeyX', 'x'], ['KeyY', 'y'],
  ['KeyZ', 'z'],
]);

export type InputContext =
  | 'exploration'
  | 'combat'
  | 'menu'
  | 'worldmap'
  | 'inventory'
  | 'character'
  | 'look'
  | 'traveling';

export interface KeyBinding {
  keys: string[];
  event: string;
  data: Record<string, unknown>;
  label: string;
  context: InputContext | 'global';
}

export interface KeyboardHintDef {
  key: string;
  label: string;
  category: 'movement' | 'action' | 'meta';
}

// ── Exploration bindings ─────────────────────────────────────────

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

const EXPLORATION_ACTION_BINDINGS: KeyBinding[] = [
  { keys: ['.'],      event: 'input:wait',      data: {},  label: 'Wait',      context: 'exploration' },
  { keys: ['x'],      event: 'input:look',      data: {},  label: 'Look',      context: 'exploration' },
  { keys: ['e'],      event: 'input:interact',   data: {},  label: 'Interact',  context: 'exploration' },
  { keys: [','],      event: 'input:pickup',     data: {},  label: 'Pick up',   context: 'exploration' },
  { keys: ['r'],      event: 'input:rest',       data: {},  label: 'Rest',      context: 'exploration' },
  { keys: ['f'],      event: 'input:forage',     data: {},  label: 'Forage',    context: 'exploration' },
  { keys: ['>'],      event: 'input:descend',    data: {},  label: 'Descend',   context: 'exploration' },
  { keys: ['<'],      event: 'input:ascend',     data: {},  label: 'Ascend',    context: 'exploration' },
];

const EXPLORATION_META_BINDINGS: KeyBinding[] = [
  { keys: ['i'],      event: 'input:inventory',  data: {},  label: 'Inventory', context: 'exploration' },
  { keys: ['c'],      event: 'input:character',  data: {},  label: 'Character', context: 'exploration' },
  { keys: ['m'],      event: 'input:worldmap',   data: {},  label: 'World Map', context: 'exploration' },
];

// ── World map bindings ───────────────────────────────────────────

const WORLDMAP_BINDINGS: KeyBinding[] = [
  { keys: ['k', 'ArrowUp', 'w'],    event: 'input:map_cursor', data: { dx: 0, dy: -1 },  label: 'Cursor Up',    context: 'worldmap' },
  { keys: ['j', 'ArrowDown', 's'],   event: 'input:map_cursor', data: { dx: 0, dy: 1 },   label: 'Cursor Down',  context: 'worldmap' },
  { keys: ['h', 'ArrowLeft', 'a'],   event: 'input:map_cursor', data: { dx: -1, dy: 0 },  label: 'Cursor Left',  context: 'worldmap' },
  { keys: ['l', 'ArrowRight', 'd'],  event: 'input:map_cursor', data: { dx: 1, dy: 0 },   label: 'Cursor Right', context: 'worldmap' },
  { keys: ['Enter', ' '],            event: 'input:map_travel', data: {},                  label: 'Travel',       context: 'worldmap' },
  { keys: ['m'],                     event: 'input:cancel',     data: {},                  label: 'Close Map',    context: 'worldmap' },
];

// ── Look mode bindings ──────────────────────────────────────────

const LOOK_BINDINGS: KeyBinding[] = [
  { keys: ['k', 'ArrowUp'],     event: 'input:look_move', data: { dx: 0, dy: -1 },  label: 'Look North',     context: 'look' },
  { keys: ['j', 'ArrowDown'],   event: 'input:look_move', data: { dx: 0, dy: 1 },   label: 'Look South',     context: 'look' },
  { keys: ['h', 'ArrowLeft'],   event: 'input:look_move', data: { dx: -1, dy: 0 },  label: 'Look West',      context: 'look' },
  { keys: ['l', 'ArrowRight'],  event: 'input:look_move', data: { dx: 1, dy: 0 },   label: 'Look East',      context: 'look' },
  { keys: ['y'],                event: 'input:look_move', data: { dx: -1, dy: -1 }, label: 'Look NW',         context: 'look' },
  { keys: ['u'],                event: 'input:look_move', data: { dx: 1, dy: -1 },  label: 'Look NE',         context: 'look' },
  { keys: ['b'],                event: 'input:look_move', data: { dx: -1, dy: 1 },  label: 'Look SW',         context: 'look' },
  { keys: ['n'],                event: 'input:look_move', data: { dx: 1, dy: 1 },   label: 'Look SE',         context: 'look' },
  { keys: ['x'],                event: 'input:look_exit', data: {},                  label: 'Exit Look',       context: 'look' },
];

// ── Combat bindings ─────────────────────────────────────────────

const COMBAT_MOVE_BINDINGS: KeyBinding[] = [
  { keys: ['k', 'ArrowUp'],     event: 'input:combat_move', data: { dx: 0, dy: -1 },  label: 'North',     context: 'combat' },
  { keys: ['j', 'ArrowDown'],   event: 'input:combat_move', data: { dx: 0, dy: 1 },   label: 'South',     context: 'combat' },
  { keys: ['h', 'ArrowLeft'],   event: 'input:combat_move', data: { dx: -1, dy: 0 },  label: 'West',      context: 'combat' },
  { keys: ['l', 'ArrowRight'],  event: 'input:combat_move', data: { dx: 1, dy: 0 },   label: 'East',      context: 'combat' },
  { keys: ['y'],                event: 'input:combat_move', data: { dx: -1, dy: -1 }, label: 'Northwest', context: 'combat' },
  { keys: ['u'],                event: 'input:combat_move', data: { dx: 1, dy: -1 },  label: 'Northeast', context: 'combat' },
  { keys: ['b'],                event: 'input:combat_move', data: { dx: -1, dy: 1 },  label: 'Southwest', context: 'combat' },
  { keys: ['n'],                event: 'input:combat_move', data: { dx: 1, dy: 1 },   label: 'Southeast', context: 'combat' },
];

const COMBAT_ACTION_BINDINGS: KeyBinding[] = [
  { keys: ['a'],                event: 'input:combat_attack',    data: {},  label: 'Attack',     context: 'combat' },
  { keys: ['s'],                event: 'input:combat_cast_spell', data: {}, label: 'Cast Spell', context: 'combat' },
  { keys: ['d'],                event: 'input:combat_dash',      data: {},  label: 'Dash',       context: 'combat' },
  { keys: ['o'],                event: 'input:combat_dodge',     data: {},  label: 'Dodge',      context: 'combat' },
  { keys: ['g'],                event: 'input:combat_disengage', data: {},  label: 'Disengage',  context: 'combat' },
  { keys: ['x'],                event: 'input:combat_action_surge', data: {}, label: 'Action Surge', context: 'combat' },
  { keys: ['e'],                event: 'input:combat_end_turn',  data: {},  label: 'End Turn',   context: 'combat' },
  { keys: ['Tab'],              event: 'input:combat_cycle',     data: {},  label: 'Cycle Targets', context: 'combat' },
  // Number keys 1-9 for bonus actions (mapped dynamically in main.ts)
  { keys: ['1'],                event: 'input:combat_bonus_key', data: { index: 0 }, label: 'Bonus 1', context: 'combat' },
  { keys: ['2'],                event: 'input:combat_bonus_key', data: { index: 1 }, label: 'Bonus 2', context: 'combat' },
  { keys: ['3'],                event: 'input:combat_bonus_key', data: { index: 2 }, label: 'Bonus 3', context: 'combat' },
  { keys: ['4'],                event: 'input:combat_bonus_key', data: { index: 3 }, label: 'Bonus 4', context: 'combat' },
  { keys: ['5'],                event: 'input:combat_bonus_key', data: { index: 4 }, label: 'Bonus 5', context: 'combat' },
];

// ── Traveling bindings ──────────────────────────────────────────

const TRAVELING_BINDINGS: KeyBinding[] = [
  { keys: ['Escape'],           event: 'input:cancel_travel', data: {},              label: 'Cancel Travel',   context: 'traveling' },
];

// ── Inventory bindings ───────────────────────────────────────────

const INVENTORY_BINDINGS: KeyBinding[] = [
  { keys: ['i'],      event: 'input:cancel',     data: {},  label: 'Close',     context: 'inventory' },
];

// ── Character bindings ───────────────────────────────────────────

const CHARACTER_BINDINGS: KeyBinding[] = [
  { keys: ['c'],      event: 'input:cancel',     data: {},  label: 'Close',     context: 'character' },
];

// ── Global (always active) ───────────────────────────────────────

const GLOBAL_BINDINGS: KeyBinding[] = [
  { keys: ['?'],      event: 'input:help',       data: {},  label: 'Help',      context: 'global' },
  { keys: ['Escape'], event: 'input:cancel',     data: {},  label: 'Cancel',    context: 'global' },
];

const ALL_BINDINGS = [
  ...MOVE_BINDINGS,
  ...EXPLORATION_ACTION_BINDINGS,
  ...EXPLORATION_META_BINDINGS,
  ...COMBAT_MOVE_BINDINGS,
  ...COMBAT_ACTION_BINDINGS,
  ...LOOK_BINDINGS,
  ...TRAVELING_BINDINGS,
  ...WORLDMAP_BINDINGS,
  ...INVENTORY_BINDINGS,
  ...CHARACTER_BINDINGS,
  ...GLOBAL_BINDINGS,
];

// ── Per-context help hints ───────────────────────────────────────

const CONTEXT_HINTS: Record<InputContext, KeyboardHintDef[]> = {
  exploration: [
    { key: 'k/\u2191', label: 'North',     category: 'movement' },
    { key: 'j/\u2193', label: 'South',     category: 'movement' },
    { key: 'h/\u2190', label: 'West',      category: 'movement' },
    { key: 'l/\u2192', label: 'East',      category: 'movement' },
    { key: 'y',   label: 'NW',        category: 'movement' },
    { key: 'u',   label: 'NE',        category: 'movement' },
    { key: 'b',   label: 'SW',        category: 'movement' },
    { key: 'n',   label: 'SE',        category: 'movement' },
    { key: 'e',   label: 'Interact',  category: 'action' },
    { key: 'x',   label: 'Look',      category: 'action' },
    { key: ',',   label: 'Pick up',   category: 'action' },
    { key: '.',   label: 'Wait',      category: 'action' },
    { key: 'f',   label: 'Forage',    category: 'action' },
    { key: 'r',   label: 'Rest',      category: 'action' },
    { key: '>',   label: 'Descend',   category: 'action' },
    { key: '<',   label: 'Ascend',    category: 'action' },
    { key: 'i',   label: 'Inventory', category: 'meta' },
    { key: 'c',   label: 'Character', category: 'meta' },
    { key: 'm',   label: 'World Map', category: 'meta' },
    { key: '?',   label: 'Help',      category: 'meta' },
    { key: 'Esc', label: 'Cancel',    category: 'meta' },
  ],
  combat: [
    { key: 'k/\u2191', label: 'North',       category: 'movement' },
    { key: 'j/\u2193', label: 'South',       category: 'movement' },
    { key: 'h/\u2190', label: 'West',        category: 'movement' },
    { key: 'l/\u2192', label: 'East',        category: 'movement' },
    { key: 'a',   label: 'Attack',      category: 'action' },
    { key: 'd',   label: 'Dash',        category: 'action' },
    { key: 'o',   label: 'Dodge',       category: 'action' },
    { key: 'g',   label: 'Disengage',   category: 'action' },
    { key: 'e',   label: 'End Turn',    category: 'action' },
    { key: 'Tab', label: 'Cycle Target', category: 'action' },
    { key: '?',   label: 'Help',        category: 'meta' },
    { key: 'Esc', label: 'Cancel',      category: 'meta' },
  ],
  menu: [
    { key: 'Esc', label: 'Cancel',    category: 'meta' },
  ],
  worldmap: [
    { key: '\u2191/k', label: 'Cursor Up',    category: 'movement' },
    { key: '\u2193/j', label: 'Cursor Down',  category: 'movement' },
    { key: '\u2190/h', label: 'Cursor Left',  category: 'movement' },
    { key: '\u2192/l', label: 'Cursor Right', category: 'movement' },
    { key: 'Enter',    label: 'Travel Here',  category: 'action' },
    { key: 'm',        label: 'Close Map',    category: 'meta' },
    { key: 'Esc',      label: 'Close Map',    category: 'meta' },
    { key: '?',        label: 'Help',         category: 'meta' },
  ],
  inventory: [
    { key: 'i',   label: 'Close',     category: 'meta' },
    { key: 'Esc', label: 'Close',     category: 'meta' },
    { key: '?',   label: 'Help',      category: 'meta' },
  ],
  character: [
    { key: 'c',   label: 'Close',     category: 'meta' },
    { key: 'Esc', label: 'Close',     category: 'meta' },
    { key: '?',   label: 'Help',      category: 'meta' },
  ],
  look: [
    { key: 'h/j/k/l', label: 'Move Cursor', category: 'movement' },
    { key: 'y/u/b/n', label: 'Diagonal',    category: 'movement' },
    { key: 'x',       label: 'Exit Look',   category: 'meta' },
    { key: 'Esc',     label: 'Exit Look',   category: 'meta' },
  ],
  traveling: [
    { key: 'Esc',     label: 'Cancel Travel', category: 'meta' },
  ],
};

/**
 * Translates keyboard events into semantic game actions via EventBus.
 * Supports vi-keys, arrow keys, and context-based input isolation.
 *
 * Uses a context stack: overlays push their context on open,
 * pop on close. Only the top context's bindings are active.
 */
export class KeyboardInput implements GameSystem {
  readonly name = 'keyboard-input';
  readonly priority = 0;

  private engine!: GameEngine;
  private contextStack: InputContext[] = ['menu'];
  private keyMap: Map<string, KeyBinding[]> = new Map();
  private enabled = true;

  init(engine: GameEngine): void {
    this.engine = engine;
    this.buildKeyMap();
    document.addEventListener('keydown', this.handleKeyDown);
  }

  destroy(): void {
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  /** Set the base context (replaces the bottom of the stack). */
  setContext(context: InputContext): void {
    this.contextStack = [context];
  }

  /** Push an overlay context onto the stack. */
  pushContext(context: InputContext): void {
    this.contextStack.push(context);
  }

  /** Pop the top overlay context, returning to the previous one. */
  popContext(): void {
    if (this.contextStack.length > 1) {
      this.contextStack.pop();
    }
  }

  /** Get the currently active context (top of stack). */
  getContext(): InputContext {
    return this.contextStack[this.contextStack.length - 1];
  }

  /** Get the help hints for the current context. */
  getContextHints(): KeyboardHintDef[] {
    return CONTEXT_HINTS[this.getContext()] ?? [];
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  private buildKeyMap(): void {
    // A key can map to multiple bindings (different contexts)
    for (const binding of ALL_BINDINGS) {
      for (const key of binding.keys) {
        const existing = this.keyMap.get(key);
        if (existing) {
          existing.push(binding);
        } else {
          this.keyMap.set(key, [binding]);
        }
      }
    }
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    // Always intercept Escape — never let the browser handle it
    if (e.key === 'Escape') {
      e.preventDefault();
    }

    if (!this.enabled) return;

    // Don't capture when typing in inputs (except Escape)
    const tag = (document.activeElement?.tagName ?? '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      if (e.key === 'Escape') {
        (document.activeElement as HTMLElement)?.blur();
      }
      return;
    }

    // Don't capture when a true modal dialog is open (modals handle their own input via FocusNav).
    // Character/inventory screens reuse the modal-backdrop class for z-index styling
    // but rely on the keyboard context system, so exclude them from this check.
    const ctx = this.getContext();
    if (ctx !== 'character' && ctx !== 'inventory' && document.querySelector('.modal-backdrop')) return;

    let bindings = this.keyMap.get(e.key);

    // Fallback: use e.code for layout-independent matching (AZERTY, QWERTZ, etc.)
    // e.g. on AZERTY, pressing the '1' key produces '&' as e.key but 'Digit1' as e.code
    if (!bindings) {
      const codeKey = CODE_TO_KEY.get(e.code);
      if (codeKey) {
        bindings = this.keyMap.get(codeKey);
      }
    }
    if (!bindings) return;

    const context = this.getContext();

    // Find matching binding: prefer exact context match, then global
    let match: KeyBinding | null = null;
    for (const binding of bindings) {
      if (binding.context === context) {
        match = binding;
        break;
      }
    }
    if (!match) {
      for (const binding of bindings) {
        if (binding.context === 'global') {
          match = binding;
          break;
        }
      }
    }

    if (!match) return;

    e.preventDefault();
    e.stopPropagation();

    this.engine.events.emit({
      type: match.event,
      category: 'ui',
      data: { ...match.data },
    });
  };
}
