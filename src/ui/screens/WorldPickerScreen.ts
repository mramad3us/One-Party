import type { GameEngine } from '@/engine/GameEngine';
import type { OverworldData } from '@/types/overworld';
import type { Universe } from '@/types/universe';
import { getFirstCountry } from '@/types/universe';
import { Component } from '@/ui/Component';
import { FocusNav } from '@/ui/FocusNav';
import { el } from '@/utils/dom';
import { IconSystem } from '@/ui/IconSystem';
import { WorldExporter, type WorldExportData, type WorldExportDataV1, type WorldExportDataV2 } from '@/storage/WorldExporter';

// ── Terrain color map for canvas preview ────────────────────────────
const TERRAIN_COLORS: Record<string, string> = {
  deep_water:    '#0f2942',
  shallow_water: '#1a4a70',
  beach:         '#c8b060',
  plains:        '#4a7a2a',
  forest:        '#2a5a1a',
  dense_forest:  '#1a3a10',
  hills:         '#8a7a4a',
  mountain:      '#6a6a6a',
  peak:          '#d0d0d0',
  snow:          '#c8d8e0',
  desert:        '#c8a848',
  swamp:         '#3a4a20',
  tundra:        '#8a9aa0',
  volcanic:      '#6a2218',
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
 * World picker screen — import a handcrafted world from JSON.
 * Supports file input and drag-and-drop. Shows a preview after
 * validation, then lets the player accept and proceed to character creation.
 */
export class WorldPickerScreen extends Component {
  private focusNav: FocusNav;
  private dropZone!: HTMLElement;
  private fileInput!: HTMLInputElement;
  private previewEl!: HTMLElement;
  private errorEl!: HTMLElement;
  private acceptBtn!: HTMLButtonElement;
  private importedOverworld: OverworldData | null = null;
  private importedUniverse: Universe | null = null;

  constructor(parent: HTMLElement, engine: GameEngine) {
    super(parent, engine);
    this.focusNav = new FocusNav({
      onSelect: (el) => (el as HTMLButtonElement).click(),
    });
  }

  protected createElement(): HTMLElement {
    const screen = el('div', { class: 'worldpick-screen screen' });

    // ── Header ──
    const header = el('div', { class: 'worldpick-header' });
    header.appendChild(el('h1', { class: 'worldpick-title font-heading' }, ['Import World']));
    header.appendChild(el('p', { class: 'worldpick-subtitle' }, [
      'Load a handcrafted .oneparty.json world file',
    ]));
    screen.appendChild(header);

    // ── Drop zone ──
    this.dropZone = el('div', { class: 'worldpick-dropzone' });
    const dropContent = el('div', { class: 'worldpick-dropzone-content' });
    const dropIcon = IconSystem.icon('import', 'worldpick-dropzone-icon');
    dropContent.appendChild(dropIcon);
    dropContent.appendChild(el('p', { class: 'worldpick-dropzone-text' }, [
      'Drag & drop a world file here',
    ]));
    dropContent.appendChild(el('p', { class: 'worldpick-dropzone-or' }, ['or']));

    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = '.json';
    this.fileInput.style.display = 'none';

    const browseBtn = el('button', { class: 'btn btn-secondary worldpick-browse' }, ['Browse Files']);
    dropContent.appendChild(browseBtn);
    this.dropZone.appendChild(dropContent);
    this.dropZone.appendChild(this.fileInput);
    screen.appendChild(this.dropZone);

    // ── Error display ──
    this.errorEl = el('div', { class: 'worldpick-error' });
    this.errorEl.style.display = 'none';
    screen.appendChild(this.errorEl);

    // ── Preview ──
    this.previewEl = el('div', { class: 'worldpick-preview' });
    this.previewEl.style.display = 'none';
    screen.appendChild(this.previewEl);

    // ── Actions ──
    const actions = el('div', { class: 'worldpick-actions' });
    this.acceptBtn = el('button', {
      class: 'btn btn-primary btn-lg worldpick-accept',
      disabled: 'true',
    }, ['Accept World']) as HTMLButtonElement;
    actions.appendChild(this.acceptBtn);

    const backBtn = el('button', { class: 'btn btn-ghost worldpick-back', 'data-action': 'back' }, [
      '\u2190 Back',
    ]);
    actions.appendChild(backBtn);
    screen.appendChild(actions);

    return screen;
  }

  protected setupEvents(): void {
    // Browse button opens file picker
    const browseBtn = this.el.querySelector('.worldpick-browse');
    if (browseBtn) {
      this.listen(browseBtn, 'click', (e: Event) => {
        e.stopPropagation();
        this.fileInput.click();
      });
    }

    // Click anywhere on drop zone also triggers file picker
    this.listen(this.dropZone, 'click', () => this.fileInput.click());

    // File input change
    this.listen(this.fileInput, 'change', () => {
      const file = this.fileInput.files?.[0];
      if (file) this.handleFile(file);
    });

    // Drag & drop
    this.listen(this.dropZone, 'dragover', (e: Event) => {
      e.preventDefault();
      this.dropZone.classList.add('worldpick-dropzone--hover');
    });
    this.listen(this.dropZone, 'dragleave', () => {
      this.dropZone.classList.remove('worldpick-dropzone--hover');
    });
    this.listen(this.dropZone, 'drop', (e: Event) => {
      e.preventDefault();
      this.dropZone.classList.remove('worldpick-dropzone--hover');
      const de = e as DragEvent;
      const file = de.dataTransfer?.files[0];
      if (file) this.handleFile(file);
    });

    // Accept button
    this.listen(this.acceptBtn, 'click', () => {
      if (this.importedUniverse) {
        // v2 universe import
        const firstCountry = getFirstCountry(this.importedUniverse);
        if (!firstCountry) return;
        this.engine.events.emit({
          type: 'universe:created',
          category: 'world',
          data: { universe: this.importedUniverse, overworld: firstCountry.overworld },
        });
      } else if (this.importedOverworld) {
        // v1 legacy import
        this.engine.events.emit({
          type: 'world:created',
          category: 'world',
          data: { overworld: this.importedOverworld },
        });
      }
    });

    // Back button
    const backBtn = this.el.querySelector('[data-action="back"]');
    if (backBtn) {
      this.listen(backBtn, 'click', () => {
        this.engine.events.emit({
          type: 'ui:navigate',
          category: 'ui',
          data: { screen: 'worldselection', direction: 'right' },
        });
      });
    }

    const buttons = Array.from(this.el.querySelectorAll('.worldpick-accept, .worldpick-back')) as HTMLElement[];
    this.focusNav.setItems(buttons);
    this.focusNav.attach();
  }

  destroy(): void {
    this.focusNav.detach();
    super.destroy();
  }

  private handleFile(file: File): void {
    this.clearState();

    if (!file.name.endsWith('.json')) {
      this.showError('Please select a .json file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result as string);
        if (!WorldExporter.validate(raw)) {
          this.showError('Invalid world file. Expected a .oneparty.json export.');
          return;
        }
        const exportData = raw as WorldExportData;
        if (exportData.version === 2) {
          const v2 = exportData as WorldExportDataV2;
          this.importedUniverse = v2.universe;
          const firstCountry = getFirstCountry(v2.universe);
          this.importedOverworld = firstCountry?.overworld ?? null;
        } else {
          const v1 = exportData as WorldExportDataV1;
          this.importedOverworld = v1.overworld;
          this.importedUniverse = null;
        }
        this.showPreview(exportData);
      } catch {
        this.showError('Could not parse file. Is it valid JSON?');
      }
    };
    reader.onerror = () => this.showError('Failed to read file.');
    reader.readAsText(file);
  }

  private renderOverworldCanvas(overworld: OverworldData): HTMLCanvasElement {
    const scale = overworld.width <= 64 ? 4 : overworld.width <= 128 ? 3 : 2;
    const canvas = document.createElement('canvas');
    canvas.width = overworld.width * scale;
    canvas.height = overworld.height * scale;
    canvas.className = 'worldpick-canvas';

    const ctx = canvas.getContext('2d')!;

    for (let y = 0; y < overworld.height; y++) {
      for (let x = 0; x < overworld.width; x++) {
        const tile = overworld.tiles[y][x];

        let color = TERRAIN_COLORS[tile.terrain] ?? '#333333';

        // River override
        if (tile.river && tile.terrain !== 'deep_water' && tile.terrain !== 'shallow_water') {
          color = '#2a6aaa';
        }

        ctx.fillStyle = color;
        ctx.fillRect(x * scale, y * scale, scale, scale);

        // Settlement dot
        if (tile.settlement) {
          const sColor = SETTLEMENT_COLORS[tile.settlement] ?? '#ffffff';
          ctx.fillStyle = sColor;
          const dotSize = Math.max(2, scale);
          const offset = (scale - dotSize) / 2;
          ctx.fillRect(x * scale + offset, y * scale + offset, dotSize, dotSize);
        }
      }
    }

    return canvas;
  }

  private showPreview(data: WorldExportData): void {
    this.previewEl.innerHTML = '';
    this.previewEl.style.display = '';

    // ── Overworld map canvas ──
    if (this.importedOverworld) {
      const mapWrap = el('div', { class: 'worldpick-map-wrap' });
      const mapLabel = el('span', { class: 'worldpick-map-label font-mono' }, [
        this.importedOverworld.name,
      ]);
      mapWrap.appendChild(this.renderOverworldCanvas(this.importedOverworld));
      mapWrap.appendChild(mapLabel);
      this.previewEl.appendChild(mapWrap);
    }

    // ── Stats grid ──
    const grid = el('div', { class: 'worldpick-preview-grid' });

    const addStat = (label: string, value: string) => {
      grid.appendChild(el('span', { class: 'worldpick-stat-label font-mono' }, [label]));
      grid.appendChild(el('span', { class: 'worldpick-stat-value' }, [value]));
    };

    if (data.version === 2) {
      const v2 = data as WorldExportDataV2;
      const u = v2.universe;
      addStat('Universe', u.name);
      addStat('Format', 'v2 (Hierarchical)');
      addStat('Planes', String(u.planes.length));

      // Count continents, regions, countries
      let continents = 0, regions = 0, countries = 0;
      for (const p of u.planes) {
        if (!p.inline) continue;
        continents += p.inline.continents.length;
        for (const c of p.inline.continents) {
          if (!c.inline) continue;
          regions += c.inline.regions.length;
          for (const r of c.inline.regions) {
            if (!r.inline) continue;
            countries += r.inline.countries.length;
          }
        }
      }
      addStat('Continents', String(continents));
      addStat('Countries', String(countries));

      if (u.meta?.author) {
        addStat('Author', u.meta.author);
      }
    } else {
      const v1 = data as WorldExportDataV1;
      const ow = v1.overworld;
      addStat('Name', ow.name);
      addStat('Format', 'v1 (Legacy)');
      addStat('Size', `${ow.width}\u00D7${ow.height}`);
      addStat('Regions', String(ow.regions.length));
      addStat('Seed', String(ow.seed));

      let settlements = 0;
      for (const row of ow.tiles) {
        for (const tile of row) {
          if (tile.settlement) settlements++;
        }
      }
      addStat('Settlements', String(settlements));
    }

    if (data.exportedAt) {
      addStat('Exported', new Date(data.exportedAt).toLocaleDateString());
    }

    // "Choose different file" link
    const changeBtn = el('button', { class: 'btn btn-ghost worldpick-change' }, [
      'Choose a different file',
    ]);
    changeBtn.addEventListener('click', () => this.clearState());

    this.previewEl.appendChild(grid);
    this.previewEl.appendChild(changeBtn);

    // Enable accept
    this.acceptBtn.removeAttribute('disabled');

    // Hide drop zone
    this.dropZone.style.display = 'none';
  }

  private showError(msg: string): void {
    this.errorEl.textContent = msg;
    this.errorEl.style.display = '';
  }

  private clearState(): void {
    this.importedOverworld = null;
    this.importedUniverse = null;
    this.errorEl.style.display = 'none';
    this.errorEl.textContent = '';
    this.previewEl.style.display = 'none';
    this.previewEl.innerHTML = '';
    this.acceptBtn.setAttribute('disabled', 'true');
    this.dropZone.style.display = '';
  }
}
