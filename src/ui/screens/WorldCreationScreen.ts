import type { GameEngine } from '@/engine/GameEngine';
import type { OverworldData, WorldSize } from '@/types/overworld';
import { WORLD_SIZES } from '@/types/overworld';
import { Component } from '@/ui/Component';
import { el } from '@/utils/dom';
import { OverworldGenerator } from '@/world/OverworldGenerator';

// ── Terrain color map for canvas preview ────────────────────────────

const TERRAIN_COLORS: Record<string, string> = {
  deep_water:   '#0f2942',
  shallow_water: '#1a4a70',
  beach:        '#c8b060',
  plains:       '#4a7a2a',
  forest:       '#2a5a1a',
  dense_forest: '#1a3a10',
  hills:        '#8a7a4a',
  mountain:     '#6a6a6a',
  peak:         '#d0d0d0',
  snow:         '#c8d8e0',
  desert:       '#c8a848',
  swamp:        '#3a4a20',
  tundra:       '#8a9aa0',
  volcanic:     '#6a2218',
};

const SETTLEMENT_COLORS: Record<string, string> = {
  village:  '#e8d040',
  town:     '#f0c020',
  city:     '#ffffff',
  fortress: '#a0a0a0',
  ruins:    '#8a6a3a',
  temple:   '#d0b8ff',
};

/**
 * World creation screen — DF-inspired world generation with
 * seed input, size selector, progress log, and canvas preview.
 */
export class WorldCreationScreen extends Component {
  private seedInput!: HTMLInputElement;
  private sizeRadios!: Map<WorldSize, HTMLInputElement>;
  private createBtn!: HTMLButtonElement;
  private logContainer!: HTMLElement;
  private progressBar!: HTMLElement;
  private progressFill!: HTMLElement;
  private progressText!: HTMLElement;
  private previewWrap!: HTMLElement;
  private acceptBtn!: HTMLButtonElement;
  private regenBtn!: HTMLButtonElement;
  private controlsWrap!: HTMLElement;
  private postGenControls!: HTMLElement;

  private generating = false;
  private generatedWorld: OverworldData | null = null;

  constructor(parent: HTMLElement, engine: GameEngine) {
    super(parent, engine);
  }

  protected createElement(): HTMLElement {
    const screen = el('div', { class: 'worldcreation-screen screen' });

    // ── Atmospheric particles ──
    const particles = el('div', { class: 'worldcreation-particles' });
    for (let i = 0; i < 12; i++) {
      particles.appendChild(el('div', { class: 'worldcreation-particle' }));
    }
    screen.appendChild(particles);

    // ── Content container ──
    const content = el('div', { class: 'worldcreation-content' });

    // Title
    const header = el('div', { class: 'worldcreation-header' });
    header.appendChild(el('h1', { class: 'worldcreation-title font-heading' }, ['FORGE YOUR WORLD']));
    header.appendChild(el('div', { class: 'worldcreation-ornament' }));
    header.appendChild(el('p', { class: 'worldcreation-subtitle font-mono' }, [
      'Shape the land, sea, and sky before your journey begins',
    ]));
    content.appendChild(header);

    // ── Controls ──
    this.controlsWrap = el('div', { class: 'worldcreation-controls' });

    // Seed input
    const seedGroup = el('div', { class: 'worldcreation-field' });
    seedGroup.appendChild(el('label', { class: 'worldcreation-label font-mono' }, ['World Seed']));
    const seedRow = el('div', { class: 'worldcreation-seed-row' });
    this.seedInput = document.createElement('input');
    this.seedInput.type = 'text';
    this.seedInput.className = 'worldcreation-input font-mono';
    this.seedInput.placeholder = 'Enter a word or number...';
    this.seedInput.value = String(Math.floor(Math.random() * 999999));
    seedRow.appendChild(this.seedInput);
    const randomBtn = el('button', { class: 'btn btn-ghost worldcreation-random-btn font-mono' }, ['Random']);
    seedRow.appendChild(randomBtn);
    seedGroup.appendChild(seedRow);
    this.controlsWrap.appendChild(seedGroup);

    // Size selector
    const sizeGroup = el('div', { class: 'worldcreation-field' });
    sizeGroup.appendChild(el('label', { class: 'worldcreation-label font-mono' }, ['World Size']));
    const sizeRow = el('div', { class: 'worldcreation-size-row' });
    this.sizeRadios = new Map();

    for (const [key, config] of Object.entries(WORLD_SIZES)) {
      const ws = key as WorldSize;
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'world-size';
      radio.value = key;
      radio.id = `size-${key}`;
      if (key === 'small') radio.checked = true;
      this.sizeRadios.set(ws, radio);

      const label = el('label', { class: 'worldcreation-size-option font-mono', for: `size-${key}` });
      label.appendChild(radio);
      label.appendChild(el('span', { class: 'worldcreation-size-label' }, [config.label]));
      sizeRow.appendChild(label);
    }
    sizeGroup.appendChild(sizeRow);
    this.controlsWrap.appendChild(sizeGroup);

    // Create button
    this.createBtn = document.createElement('button');
    this.createBtn.className = 'btn btn-primary btn-lg worldcreation-create-btn';
    this.createBtn.textContent = 'Create World';
    this.controlsWrap.appendChild(this.createBtn);

    content.appendChild(this.controlsWrap);

    // ── Generation Log ──
    this.logContainer = el('div', { class: 'worldcreation-log font-mono' });
    content.appendChild(this.logContainer);

    // ── Progress Bar ──
    const progressWrap = el('div', { class: 'worldcreation-progress' });
    this.progressBar = el('div', { class: 'worldcreation-progress-bar' });
    this.progressFill = el('div', { class: 'worldcreation-progress-fill' });
    this.progressBar.appendChild(this.progressFill);
    progressWrap.appendChild(this.progressBar);
    this.progressText = el('span', { class: 'worldcreation-progress-text font-mono' });
    progressWrap.appendChild(this.progressText);
    content.appendChild(progressWrap);

    // ── Preview ──
    this.previewWrap = el('div', { class: 'worldcreation-preview' });
    content.appendChild(this.previewWrap);

    // ── Post-generation controls ──
    this.postGenControls = el('div', { class: 'worldcreation-post-controls' });
    this.acceptBtn = document.createElement('button');
    this.acceptBtn.className = 'btn btn-primary btn-lg';
    this.acceptBtn.textContent = 'Accept World';
    this.regenBtn = document.createElement('button');
    this.regenBtn.className = 'btn btn-secondary btn-lg';
    this.regenBtn.textContent = 'Regenerate';
    this.postGenControls.appendChild(this.acceptBtn);
    this.postGenControls.appendChild(this.regenBtn);
    this.postGenControls.style.display = 'none';
    content.appendChild(this.postGenControls);

    screen.appendChild(content);
    return screen;
  }

  protected setupEvents(): void {
    // Random seed button
    const randomBtn = this.el.querySelector('.worldcreation-random-btn');
    if (randomBtn) {
      this.listen(randomBtn, 'click', () => {
        this.seedInput.value = String(Math.floor(Math.random() * 999999));
      });
    }

    // Create world
    this.listen(this.createBtn, 'click', () => {
      if (!this.generating) this.startGeneration();
    });

    // Accept world
    this.listen(this.acceptBtn, 'click', () => {
      if (this.generatedWorld) {
        this.engine.events.emit({
          type: 'world:created',
          category: 'world',
          data: { overworld: this.generatedWorld },
        });
      }
    });

    // Regenerate
    this.listen(this.regenBtn, 'click', () => {
      if (!this.generating) {
        this.seedInput.value = String(Math.floor(Math.random() * 999999));
        this.startGeneration();
      }
    });
  }

  private getSelectedSize(): WorldSize {
    for (const [key, radio] of this.sizeRadios) {
      if (radio.checked) return key;
    }
    return 'small';
  }

  private getSeedNumber(): number {
    const raw = this.seedInput.value.trim();
    if (!raw) return Date.now();

    // If it's a number, use directly
    const num = Number(raw);
    if (!isNaN(num) && isFinite(num)) return Math.floor(Math.abs(num));

    // Otherwise hash the string (djb2)
    let hash = 5381;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) + hash + raw.charCodeAt(i)) >>> 0;
    }
    return hash;
  }

  private async startGeneration(): Promise<void> {
    this.generating = true;
    this.generatedWorld = null;

    // Reset UI
    this.logContainer.innerHTML = '';
    this.logContainer.style.display = 'block';
    this.progressFill.style.width = '0%';
    this.progressText.textContent = '0%';
    this.previewWrap.innerHTML = '';
    this.postGenControls.style.display = 'none';
    this.createBtn.setAttribute('disabled', '');
    this.createBtn.textContent = 'Generating...';

    const seed = this.getSeedNumber();
    const size = this.getSelectedSize();
    const { width, height } = WORLD_SIZES[size];

    const generator = new OverworldGenerator(seed, width, height);

    try {
      const overworld = await generator.generate((message, progress) => {
        this.addLogEntry(message);
        const pct = Math.floor(progress * 100);
        this.progressFill.style.width = `${pct}%`;
        this.progressText.textContent = `${pct}%`;
      });

      this.generatedWorld = overworld;
      this.renderPreview(overworld);
      this.addLogEntry(`World "${overworld.name}" forged with ${overworld.regions.length} regions.`);

      // Show post-gen controls
      this.postGenControls.style.display = '';
      this.controlsWrap.style.display = 'none';
    } catch (err) {
      this.addLogEntry(`Error: ${(err as Error).message}`);
    } finally {
      this.generating = false;
      this.createBtn.removeAttribute('disabled');
      this.createBtn.textContent = 'Create World';
    }
  }

  private addLogEntry(message: string): void {
    const entry = el('div', { class: 'worldcreation-log-entry' }, [message]);
    this.logContainer.appendChild(entry);
    this.logContainer.scrollTop = this.logContainer.scrollHeight;
  }

  private renderPreview(overworld: OverworldData): void {
    this.previewWrap.innerHTML = '';

    // World name header
    const nameEl = el('h2', { class: 'worldcreation-world-name font-heading' }, [overworld.name]);
    this.previewWrap.appendChild(nameEl);

    // Stats line
    const stats = el('div', { class: 'worldcreation-stats font-mono' }, [
      `${overworld.width}\u00d7${overworld.height} tiles \u2022 ${overworld.regions.length} regions \u2022 Seed: ${this.seedInput.value}`,
    ]);
    this.previewWrap.appendChild(stats);

    // Canvas map
    const scale = overworld.width <= 64 ? 4 : overworld.width <= 128 ? 3 : 2;
    const canvas = document.createElement('canvas');
    canvas.width = overworld.width * scale;
    canvas.height = overworld.height * scale;
    canvas.className = 'worldcreation-canvas';

    const ctx = canvas.getContext('2d')!;

    for (let y = 0; y < overworld.height; y++) {
      for (let x = 0; x < overworld.width; x++) {
        const tile = overworld.tiles[y][x];

        // Base terrain color
        let color = TERRAIN_COLORS[tile.terrain] ?? '#333333';

        // River override
        if (tile.river && tile.terrain !== 'deep_water' && tile.terrain !== 'shallow_water') {
          color = '#2a6aaa';
        }

        ctx.fillStyle = color;
        ctx.fillRect(x * scale, y * scale, scale, scale);

        // Settlement dot (larger)
        if (tile.settlement) {
          const sColor = SETTLEMENT_COLORS[tile.settlement] ?? '#ffffff';
          ctx.fillStyle = sColor;
          const dotSize = Math.max(2, scale);
          const offset = (scale - dotSize) / 2;
          ctx.fillRect(x * scale + offset, y * scale + offset, dotSize, dotSize);
        }
      }
    }

    this.previewWrap.appendChild(canvas);

    // Legend
    const legend = el('div', { class: 'worldcreation-legend font-mono' });
    const legendItems: [string, string][] = [
      ['#0f2942', 'Ocean'], ['#1a4a70', 'Coast'], ['#c8b060', 'Beach'],
      ['#4a7a2a', 'Plains'], ['#2a5a1a', 'Forest'], ['#1a3a10', 'Dense Forest'],
      ['#8a7a4a', 'Hills'], ['#6a6a6a', 'Mountain'], ['#d0d0d0', 'Peak'],
      ['#c8a848', 'Desert'], ['#3a4a20', 'Swamp'], ['#8a9aa0', 'Tundra'],
      ['#2a6aaa', 'River'],
    ];
    for (const [color, label] of legendItems) {
      const item = el('div', { class: 'worldcreation-legend-item' });
      const swatch = el('span', { class: 'worldcreation-legend-swatch' });
      swatch.style.backgroundColor = color;
      item.appendChild(swatch);
      item.appendChild(document.createTextNode(label));
      legend.appendChild(item);
    }

    // Settlement legend
    const settlementItems: [string, string][] = [
      ['#e8d040', 'Village'], ['#f0c020', 'Town'], ['#ffffff', 'City'],
      ['#a0a0a0', 'Fortress'], ['#8a6a3a', 'Ruins'], ['#d0b8ff', 'Temple'],
    ];
    for (const [color, label] of settlementItems) {
      const item = el('div', { class: 'worldcreation-legend-item' });
      const swatch = el('span', { class: 'worldcreation-legend-swatch' });
      swatch.style.backgroundColor = color;
      item.appendChild(swatch);
      item.appendChild(document.createTextNode(label));
      legend.appendChild(item);
    }

    this.previewWrap.appendChild(legend);

    // History section
    if (overworld.history.length > 0) {
      const historySection = el('div', { class: 'worldcreation-history' });
      historySection.appendChild(el('h3', { class: 'worldcreation-history-title font-heading' }, ['World History']));
      for (const entry of overworld.history) {
        historySection.appendChild(
          el('p', { class: 'worldcreation-history-entry font-mono' }, [entry.event]),
        );
      }
      this.previewWrap.appendChild(historySection);
    }
  }
}
