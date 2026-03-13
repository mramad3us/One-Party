/**
 * Singleton tooltip manager. Shows a positioned tooltip element
 * near target elements with fade + slide animation.
 */
export class TooltipSystem {
  private static instance: TooltipSystem;
  private tooltipEl: HTMLElement;
  private hideTimeout: ReturnType<typeof setTimeout> | null = null;

  private constructor() {
    this.tooltipEl = document.createElement('div');
    this.tooltipEl.className = 'tooltip';
    this.tooltipEl.setAttribute('role', 'tooltip');
    document.body.appendChild(this.tooltipEl);
  }

  static init(): TooltipSystem {
    if (!TooltipSystem.instance) {
      TooltipSystem.instance = new TooltipSystem();
    }
    return TooltipSystem.instance;
  }

  static getInstance(): TooltipSystem {
    if (!TooltipSystem.instance) {
      return TooltipSystem.init();
    }
    return TooltipSystem.instance;
  }

  show(
    target: HTMLElement,
    content: string | HTMLElement,
    position: 'top' | 'bottom' | 'left' | 'right' = 'top',
  ): void {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    // Set content
    if (typeof content === 'string') {
      this.tooltipEl.textContent = content;
    } else {
      this.tooltipEl.innerHTML = '';
      this.tooltipEl.appendChild(content);
    }

    // Make visible to measure
    this.tooltipEl.style.visibility = 'hidden';
    this.tooltipEl.classList.add('visible');

    // Position relative to target
    const targetRect = target.getBoundingClientRect();
    const tipRect = this.tooltipEl.getBoundingClientRect();
    const gap = 8;

    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = targetRect.top - tipRect.height - gap;
        left = targetRect.left + (targetRect.width - tipRect.width) / 2;
        break;
      case 'bottom':
        top = targetRect.bottom + gap;
        left = targetRect.left + (targetRect.width - tipRect.width) / 2;
        break;
      case 'left':
        top = targetRect.top + (targetRect.height - tipRect.height) / 2;
        left = targetRect.left - tipRect.width - gap;
        break;
      case 'right':
        top = targetRect.top + (targetRect.height - tipRect.height) / 2;
        left = targetRect.right + gap;
        break;
    }

    // Clamp to viewport
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (left < 8) left = 8;
    if (left + tipRect.width > vw - 8) left = vw - tipRect.width - 8;
    if (top < 8) {
      // Flip to bottom
      top = targetRect.bottom + gap;
    }
    if (top + tipRect.height > vh - 8) {
      // Flip to top
      top = targetRect.top - tipRect.height - gap;
    }

    this.tooltipEl.style.top = `${top}px`;
    this.tooltipEl.style.left = `${left}px`;
    this.tooltipEl.style.visibility = '';
  }

  hide(): void {
    this.tooltipEl.classList.remove('visible');
  }

  /**
   * Registers data-tooltip attributes on a container.
   * Handles mouseover/mouseout for all [data-tooltip] children.
   */
  registerContainer(container: HTMLElement): void {
    container.addEventListener('mouseover', (e) => {
      const target = (e.target as HTMLElement).closest?.(
        '[data-tooltip]',
      ) as HTMLElement | null;
      if (target) {
        const text = target.getAttribute('data-tooltip') ?? '';
        const pos =
          (target.getAttribute('data-tooltip-pos') as
            | 'top'
            | 'bottom'
            | 'left'
            | 'right') ?? 'top';
        if (text) this.show(target, text, pos);
      }
    });

    container.addEventListener('mouseout', (e) => {
      const target = (e.target as HTMLElement).closest?.(
        '[data-tooltip]',
      );
      if (target) {
        this.hideTimeout = setTimeout(() => this.hide(), 100);
      }
    });
  }
}
