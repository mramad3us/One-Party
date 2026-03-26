import type { GameEngine } from '@/engine/GameEngine';
import type { OverworldData } from '@/types/overworld';
import { Component } from '@/ui/Component';
import { FocusNav } from '@/ui/FocusNav';
import { el } from '@/utils/dom';
import { WorldExporter, type WorldExportData } from '@/storage/WorldExporter';

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
    dropContent.appendChild(el('div', { class: 'worldpick-dropzone-icon' }, ['\u{1F4DC}'])); // 📜
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
      this.listen(browseBtn, 'click', () => this.fileInput.click());
    }

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
      if (!this.importedOverworld) return;
      this.engine.events.emit({
        type: 'world:created',
        category: 'world',
        data: { overworld: this.importedOverworld },
      });
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
        this.importedOverworld = exportData.overworld;
        this.showPreview(exportData);
      } catch {
        this.showError('Could not parse file. Is it valid JSON?');
      }
    };
    reader.onerror = () => this.showError('Failed to read file.');
    reader.readAsText(file);
  }

  private showPreview(data: WorldExportData): void {
    const ow = data.overworld;
    this.previewEl.innerHTML = '';
    this.previewEl.style.display = '';

    const grid = el('div', { class: 'worldpick-preview-grid' });

    const addStat = (label: string, value: string) => {
      grid.appendChild(el('span', { class: 'worldpick-stat-label font-mono' }, [label]));
      grid.appendChild(el('span', { class: 'worldpick-stat-value' }, [value]));
    };

    addStat('Name', ow.name);
    addStat('Size', `${ow.width}\u00D7${ow.height}`);
    addStat('Regions', String(ow.regions.length));
    addStat('Seed', String(ow.seed));

    // Count settlements
    let settlements = 0;
    for (const row of ow.tiles) {
      for (const tile of row) {
        if (tile.settlement) settlements++;
      }
    }
    addStat('Settlements', String(settlements));

    if (data.exportedAt) {
      addStat('Exported', new Date(data.exportedAt).toLocaleDateString());
    }

    this.previewEl.appendChild(grid);

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
    this.errorEl.style.display = 'none';
    this.errorEl.textContent = '';
    this.previewEl.style.display = 'none';
    this.previewEl.innerHTML = '';
    this.acceptBtn.setAttribute('disabled', 'true');
    this.dropZone.style.display = '';
  }
}
