import type { GameEngine } from '@/engine/GameEngine';
import type { NarrativeBlock } from '@/types/narrative';
import { Component } from '@/ui/Component';
import { el } from '@/utils/dom';
import { IconSystem } from '@/ui/IconSystem';

/**
 * Scrolling narrative text log -- the "DM talking to you" experience.
 * Each block is styled by category and animates in from the bottom.
 */
export class NarrativePanel extends Component {
  private scrollContainer!: HTMLElement;
  private blockContainer!: HTMLElement;
  private userHasScrolledUp = false;

  constructor(parent: HTMLElement, engine: GameEngine) {
    super(parent, engine);
  }

  protected createElement(): HTMLElement {
    const wrapper = el('div', { class: 'narrative-panel' });

    // Header
    const header = el('div', { class: 'narrative-header' });
    const icon = IconSystem.icon('scroll');
    header.appendChild(icon);
    header.appendChild(el('span', { class: 'narrative-header-title font-heading' }, ['Chronicle']));
    wrapper.appendChild(header);

    // Scrollable log
    this.scrollContainer = el('div', { class: 'narrative-scroll' });
    this.blockContainer = el('div', { class: 'narrative-blocks' });
    this.scrollContainer.appendChild(this.blockContainer);
    wrapper.appendChild(this.scrollContainer);

    return wrapper;
  }

  protected setupEvents(): void {
    // Track user scroll — disable auto-scroll-to-top when user scrolls down
    this.listen(this.scrollContainer, 'scroll', () => {
      this.userHasScrolledUp = this.scrollContainer.scrollTop > 60;
    });
  }

  addBlock(block: NarrativeBlock): void {
    const blockEl = this.createBlockElement(block);

    // Prepend: newest entries appear at the top
    this.blockContainer.insertBefore(blockEl, this.blockContainer.firstChild);

    // Slide-down + fade-in animation (enters from above)
    blockEl.style.opacity = '0';
    blockEl.style.transform = 'translateY(-12px)';
    requestAnimationFrame(() => {
      blockEl.style.transition = 'opacity 0.4s var(--ease-smooth), transform 0.4s var(--ease-out-back)';
      blockEl.style.opacity = '1';
      blockEl.style.transform = 'translateY(0)';
    });

    this.scrollToTop(true);
  }

  addBlocks(blocks: NarrativeBlock[]): void {
    // Prepend in reverse order so they appear in correct chronological order
    for (let i = blocks.length - 1; i >= 0; i--) {
      const blockEl = this.createBlockElement(blocks[i]);
      this.blockContainer.insertBefore(blockEl, this.blockContainer.firstChild);
    }
    this.scrollToTop(true);
  }

  clear(): void {
    this.blockContainer.innerHTML = '';
    this.userHasScrolledUp = false;
  }

  scrollToTop(smooth = true): void {
    if (this.userHasScrolledUp) return;

    requestAnimationFrame(() => {
      this.scrollContainer.scrollTo({
        top: 0,
        behavior: smooth ? 'smooth' : 'instant',
      });
    });
  }

  private createBlockElement(block: NarrativeBlock): HTMLElement {
    const classes = ['narrative-block', `narrative-block--${block.category}`];
    const blockEl = el('div', { class: classes.join(' ') });

    // Timestamp (shown on hover via CSS)
    if (block.timestamp) {
      const ts = el('span', { class: 'narrative-timestamp' }, [
        `Round ${block.timestamp.totalRounds}`,
      ]);
      blockEl.appendChild(ts);
    }

    // Speaker for dialogue
    if (block.category === 'dialogue' && block.speaker) {
      const speaker = el('span', { class: 'narrative-speaker font-heading' }, [
        `${block.speaker}:`,
      ]);
      blockEl.appendChild(speaker);
    }

    // Loot icon
    if (block.category === 'loot') {
      const lootIcon = IconSystem.icon('coins');
      lootIcon.classList.add('narrative-loot-icon');
      blockEl.appendChild(lootIcon);
    }

    // Text content
    const textEl = el('span', { class: 'narrative-text' }, [block.text]);
    blockEl.appendChild(textEl);

    return blockEl;
  }
}
