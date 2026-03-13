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
    // Track user scroll to disable auto-scroll when user scrolls up
    this.listen(this.scrollContainer, 'scroll', () => {
      const { scrollTop, scrollHeight, clientHeight } = this.scrollContainer;
      this.userHasScrolledUp = scrollHeight - scrollTop - clientHeight > 60;
    });
  }

  addBlock(block: NarrativeBlock): void {
    const blockEl = this.createBlockElement(block);
    this.blockContainer.appendChild(blockEl);

    // Slide-up + fade-in animation
    blockEl.style.opacity = '0';
    blockEl.style.transform = 'translateY(20px)';
    requestAnimationFrame(() => {
      blockEl.style.transition = 'opacity 0.4s var(--ease-smooth), transform 0.4s var(--ease-out-back)';
      blockEl.style.opacity = '1';
      blockEl.style.transform = 'translateY(0)';
    });

    this.scrollToBottom(true);
  }

  addBlocks(blocks: NarrativeBlock[]): void {
    for (const block of blocks) {
      const blockEl = this.createBlockElement(block);
      this.blockContainer.appendChild(blockEl);
    }
    this.scrollToBottom(true);
  }

  clear(): void {
    this.blockContainer.innerHTML = '';
    this.userHasScrolledUp = false;
  }

  scrollToBottom(smooth = true): void {
    if (this.userHasScrolledUp) return;

    requestAnimationFrame(() => {
      this.scrollContainer.scrollTo({
        top: this.scrollContainer.scrollHeight,
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
