import type { SaveMeta, ExportData } from '@/types';
import { StorageEngine } from './StorageEngine';
import { Migration } from './Migration';
import { generateId } from '@/engine/IdGenerator';

/**
 * JSON export/import with integrity checking.
 * Produces a self-contained file that can be shared or backed up.
 */
export class ExportImport {
  /** Export a save as a JSON string with header, meta, and data. */
  static async exportSave(
    storage: StorageEngine,
    saveId: string,
  ): Promise<string> {
    const meta = await storage.getSaveMeta(saveId);
    const data = await storage.loadSave(saveId);

    if (!meta || !data) {
      throw new Error(`Save "${saveId}" not found`);
    }

    const dataString = JSON.stringify(data);
    const checksum = ExportImport.calculateChecksum(dataString);

    const exportBundle: ExportData = {
      header: {
        version: Migration.getCurrentVersion(),
        exportedAt: Date.now(),
        checksum,
      },
      meta,
      save: data,
    };

    return JSON.stringify(exportBundle, null, 2);
  }

  /** Import a save from a JSON string. Validates structure and checksum. */
  static async importSave(
    storage: StorageEngine,
    jsonString: string,
  ): Promise<SaveMeta> {
    let parsed: ExportData;

    try {
      parsed = JSON.parse(jsonString) as ExportData;
    } catch {
      throw new Error('Invalid JSON — could not parse file');
    }

    // Validate structure
    if (!parsed.header || !parsed.meta || !parsed.save) {
      throw new Error('Invalid save file — missing required fields');
    }

    if (typeof parsed.header.version !== 'number') {
      throw new Error('Invalid save file — missing version');
    }

    // Verify checksum
    const dataString = JSON.stringify(parsed.save);
    const expectedChecksum = ExportImport.calculateChecksum(dataString);

    if (parsed.header.checksum !== expectedChecksum) {
      throw new Error('Save file integrity check failed — data may be corrupted');
    }

    // Migrate if needed
    const currentVersion = Migration.getCurrentVersion();
    if (parsed.header.version < currentVersion) {
      parsed.save.state = Migration.migrate(
        parsed.save.state,
        parsed.header.version,
        currentVersion,
      );
      parsed.save.version = currentVersion;
      parsed.meta.version = currentVersion;
    }

    // Generate a new id to avoid collisions with existing saves
    const newId = generateId();
    const meta: SaveMeta = {
      ...parsed.meta,
      id: newId,
      name: `${parsed.meta.name} (Imported)`,
      lastSaved: Date.now(),
    };
    const data = {
      ...parsed.save,
      id: newId,
    };

    await storage.save(meta, data);
    return meta;
  }

  /** Trigger a browser download for a JSON string. */
  static downloadAsFile(jsonString: string, filename: string): void {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();

    // Cleanup after a short delay
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 100);
  }

  /** Open a file picker and read the selected JSON file. */
  static readFromFile(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.style.display = 'none';

      input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (!file) {
          reject(new Error('No file selected'));
          input.remove();
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          resolve(reader.result as string);
          input.remove();
        };
        reader.onerror = () => {
          reject(new Error('Failed to read file'));
          input.remove();
        };
        reader.readAsText(file);
      });

      // Handle cancel (user closes the dialog without selecting)
      input.addEventListener('cancel', () => {
        reject(new Error('File selection cancelled'));
        input.remove();
      });

      document.body.appendChild(input);
      input.click();
    });
  }

  /** Simple DJB2 hash for integrity checking. */
  private static calculateChecksum(data: string): string {
    let hash = 5381;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) + hash + data.charCodeAt(i)) | 0;
    }
    // Convert to unsigned hex string
    return (hash >>> 0).toString(16).padStart(8, '0');
  }
}
