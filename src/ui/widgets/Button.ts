import type { GameEngine } from '@/engine/GameEngine';
import { Component } from '@/ui/Component';
import { IconSystem } from '@/ui/IconSystem';
import { el } from '@/utils/dom';

export interface ButtonOptions {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
  icon?: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
  tooltip?: string;
  className?: string;
}

/**
 * Reusable button widget with icon support, loading state,
 * ripple effect on click, and bouncy hover/active animations.
 */
export class Button extends Component {
  constructor(
    parent: HTMLElement,
    engine: GameEngine,
    private options: ButtonOptions,
  ) {
    super(parent, engine);
  }

  protected createElement(): HTMLElement {
    const { label, variant, icon, size, disabled, loading, tooltip, className } =
      this.options;

    const classes = ['btn'];
    if (variant) classes.push(`btn-${variant}`);
    if (size && size !== 'md') classes.push(`btn-${size}`);
    if (loading) classes.push('btn-loading');
    if (className) classes.push(className);

    const btn = el('button', { class: classes.join(' ') });
    if (disabled || loading) btn.setAttribute('disabled', '');
    if (tooltip) {
      btn.setAttribute('data-tooltip', tooltip);
      btn.setAttribute('title', tooltip);
    }

    if (icon) {
      btn.appendChild(IconSystem.icon(icon));
    }

    const labelSpan = el('span', { class: 'btn-label' }, [label]);
    btn.appendChild(labelSpan);

    return btn;
  }

  protected setupEvents(): void {
    this.listen(this.el, 'click', (e: Event) => {
      if (
        this.el.hasAttribute('disabled') ||
        this.el.classList.contains('btn-loading')
      ) {
        return;
      }

      // Ripple effect
      this.createRipple(e as MouseEvent);
      this.options.onClick();
    });
  }

  /** Show or hide the loading spinner. */
  setLoading(loading: boolean): void {
    if (loading) {
      this.el.classList.add('btn-loading');
      this.el.setAttribute('disabled', '');
    } else {
      this.el.classList.remove('btn-loading');
      if (!this.options.disabled) {
        this.el.removeAttribute('disabled');
      }
    }
  }

  /** Enable or disable the button. */
  setDisabled(disabled: boolean): void {
    this.options.disabled = disabled;
    if (disabled) {
      this.el.setAttribute('disabled', '');
    } else if (!this.el.classList.contains('btn-loading')) {
      this.el.removeAttribute('disabled');
    }
  }

  /** Update the button's label text. */
  setLabel(label: string): void {
    const labelEl = this.el.querySelector('.btn-label');
    if (labelEl) labelEl.textContent = label;
  }

  private createRipple(e: MouseEvent): void {
    const rect = this.el.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'btn-ripple';
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
    this.el.appendChild(ripple);

    ripple.addEventListener('animationend', () => ripple.remove());
  }
}
