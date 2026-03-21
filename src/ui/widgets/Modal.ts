import type { GameEngine } from '@/engine/GameEngine';
import { Component } from '@/ui/Component';
import { el } from '@/utils/dom';

interface ModalAction {
  label: string;
  variant?: string;
  onClick: () => void;
}

export interface ModalOptions {
  title: string;
  content: HTMLElement | string;
  actions?: ModalAction[];
  closable?: boolean;
  width?: string;
}

/**
 * Modal dialog with backdrop fade-in, bounce-in dialog,
 * and smooth close animation. Can be used for confirms, alerts, etc.
 */
export class Modal extends Component {
  private resolve?: (value: boolean) => void;

  constructor(
    parent: HTMLElement,
    engine: GameEngine,
    private options: ModalOptions,
  ) {
    super(parent, engine);
  }

  protected createElement(): HTMLElement {
    const { title, content, actions, closable = true, width } = this.options;

    // Backdrop
    const backdrop = el('div', { class: 'modal-backdrop' });

    // Dialog
    const dialog = el('div', { class: 'modal-dialog' });
    if (width) dialog.style.width = width;

    // Header
    const header = el('div', { class: 'modal-header' }, [
      el('h3', { class: 'modal-title font-heading' }, [title]),
    ]);

    if (closable) {
      const closeBtn = el('button', {
        class: 'modal-close btn btn-ghost',
        'aria-label': 'Close',
      }, ['\u00D7']);
      closeBtn.addEventListener('click', () => this.close());
      header.appendChild(closeBtn);
    }

    dialog.appendChild(header);

    // Body
    const body = el('div', { class: 'modal-body' });
    if (typeof content === 'string') {
      body.innerHTML = content;
    } else {
      body.appendChild(content);
    }
    dialog.appendChild(body);

    // Footer (actions)
    if (actions && actions.length > 0) {
      const footer = el('div', { class: 'modal-footer' });
      for (const action of actions) {
        const btn = el(
          'button',
          {
            class: `btn ${action.variant ? `btn-${action.variant}` : 'btn-secondary'}`,
          },
          [action.label],
        );
        btn.addEventListener('click', () => {
          action.onClick();
        });
        footer.appendChild(btn);
      }
      dialog.appendChild(footer);
    }

    backdrop.appendChild(dialog);
    return backdrop;
  }

  protected setupEvents(): void {
    const closable = this.options.closable ?? true;

    // Close on backdrop click
    if (closable) {
      this.listen(this.el, 'click', (e: Event) => {
        if (e.target === this.el) {
          this.close();
        }
      });

      // Close on Escape
      this.listen(document, 'keydown', (e: Event) => {
        if ((e as KeyboardEvent).key === 'Escape') {
          this.close();
        }
      });
    }
  }

  mount(): void {
    // Add modal styles if not present
    if (!document.querySelector('.modal-styles')) {
      const style = document.createElement('style');
      style.className = 'modal-styles';
      style.textContent = `
        .modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: var(--z-modal-backdrop);
          background: rgba(0, 0, 0, 0);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background var(--duration-normal) var(--ease-smooth);
        }
        .modal-backdrop.mounted {
          background: rgba(0, 0, 0, 0.7);
        }
        .modal-dialog {
          z-index: var(--z-modal);
          background: var(--bg-panel);
          border: 1px solid var(--border-gold);
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-lg), var(--shadow-glow);
          max-width: 500px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
          transform: scale(0.92) translateY(12px);
          opacity: 0;
          transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1),
                      opacity 0.25s ease-out;
        }
        .modal-backdrop.mounted .modal-dialog {
          transform: scale(1) translateY(0);
          opacity: 1;
        }
        .modal-backdrop.exiting {
          background: rgba(0, 0, 0, 0) !important;
        }
        .modal-backdrop.exiting .modal-dialog {
          transform: scale(0.95) translateY(8px) !important;
          opacity: 0 !important;
        }
        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-md) var(--space-lg);
          border-bottom: 1px solid var(--border-subtle);
        }
        .modal-title {
          font-size: var(--text-xl);
          color: var(--gold);
        }
        .modal-close {
          font-size: var(--text-xl);
          padding: var(--space-xs) var(--space-sm);
        }
        .modal-body {
          padding: var(--space-lg);
          color: var(--text-secondary);
          font-family: var(--font-body);
          line-height: var(--leading-relaxed);
        }
        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: var(--space-sm);
          padding: var(--space-md) var(--space-lg);
          border-top: 1px solid var(--border-subtle);
        }
      `;
      document.head.appendChild(style);
    }

    super.mount();
  }

  /** Close the modal with exit animation. */
  async close(): Promise<void> {
    this.resolve?.(false);
    await this.unmount();
  }

  /**
   * Static helper: show a confirm dialog and return a boolean promise.
   */
  static confirm(
    engine: GameEngine,
    message: string,
    title = 'Confirm',
  ): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const modal = new Modal(document.body, engine, {
        title,
        content: message,
        closable: true,
        actions: [
          {
            label: 'Cancel',
            variant: 'secondary',
            onClick: () => {
              resolve(false);
              modal.close();
            },
          },
          {
            label: 'Confirm',
            variant: 'primary',
            onClick: () => {
              resolve(true);
              modal.close();
            },
          },
        ],
      });
      modal.resolve = resolve;
      modal.mount();
    });
  }
}
