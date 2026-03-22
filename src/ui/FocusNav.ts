/**
 * Keyboard focus navigation for lists of interactive elements.
 * Supports arrow keys, hjkl, Enter, and Escape.
 * Manages a visible focus indicator without relying on browser focus.
 */
export class FocusNav {
  private items: HTMLElement[] = [];
  private index = -1;
  private handler: ((e: KeyboardEvent) => void) | null = null;
  private onSelect?: (el: HTMLElement, index: number) => void;
  private onCancel?: () => void;
  private columns: number;
  private wrapAround: boolean;

  constructor(options: {
    /** Columns in grid layout (1 = vertical list) */
    columns?: number;
    /** Wrap around at edges */
    wrap?: boolean;
    /** Called when Enter is pressed on focused item */
    onSelect?: (el: HTMLElement, index: number) => void;
    /** Called when Escape is pressed */
    onCancel?: () => void;
  } = {}) {
    this.columns = options.columns ?? 1;
    this.wrapAround = options.wrap ?? true;
    this.onSelect = options.onSelect;
    this.onCancel = options.onCancel;
  }

  /** Set the navigable items. Resets focus to first non-disabled item. */
  setItems(items: HTMLElement[]): void {
    this.clearFocus();
    this.items = items.filter(el => !el.hasAttribute('disabled'));
    this.index = -1;
  }

  /** Attach keyboard listener to document. */
  attach(): void {
    if (this.handler) return;
    this.handler = this.handleKey.bind(this);
    document.addEventListener('keydown', this.handler, true);
  }

  /** Remove keyboard listener. */
  detach(): void {
    if (this.handler) {
      document.removeEventListener('keydown', this.handler, true);
      this.handler = null;
    }
    this.clearFocus();
  }

  /** Focus a specific index. */
  focusIndex(i: number): void {
    if (i < 0 || i >= this.items.length) return;
    this.clearFocus();
    this.index = i;
    this.items[i].classList.add('kbd-focus');
    this.items[i].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  /** Get currently focused element. */
  getFocused(): HTMLElement | null {
    return this.index >= 0 ? this.items[this.index] : null;
  }

  private clearFocus(): void {
    if (this.index >= 0 && this.index < this.items.length) {
      this.items[this.index].classList.remove('kbd-focus');
    }
  }

  private move(delta: number): void {
    if (this.items.length === 0) return;

    let next = this.index + delta;

    if (this.wrapAround) {
      if (next < 0) next = this.items.length - 1;
      if (next >= this.items.length) next = 0;
    } else {
      next = Math.max(0, Math.min(next, this.items.length - 1));
    }

    // Skip disabled
    if (this.items[next]?.hasAttribute('disabled')) return;

    this.focusIndex(next);
  }

  private handleKey(e: KeyboardEvent): void {
    // Don't interfere with input fields
    const tag = (document.activeElement?.tagName ?? '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      // But still catch Escape
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        (document.activeElement as HTMLElement)?.blur();
        this.onCancel?.();
      }
      return;
    }

    const key = e.key;

    // Navigation
    if (key === 'ArrowUp' || key === 'k') {
      e.preventDefault();
      e.stopPropagation();
      this.move(this.columns === 1 ? -1 : -this.columns);
    } else if (key === 'ArrowDown' || key === 'j') {
      e.preventDefault();
      e.stopPropagation();
      this.move(this.columns === 1 ? 1 : this.columns);
    } else if (key === 'ArrowLeft' || key === 'h') {
      e.preventDefault();
      e.stopPropagation();
      this.move(-1);
    } else if (key === 'ArrowRight' || key === 'l') {
      e.preventDefault();
      e.stopPropagation();
      this.move(1);
    } else if (key === 'Enter' || key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      if (this.index >= 0 && this.index < this.items.length) {
        this.onSelect?.(this.items[this.index], this.index);
      } else if (this.items.length > 0) {
        // Auto-focus first item if none focused
        this.focusIndex(0);
      }
    } else if (key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.onCancel?.();
    }
  }
}
