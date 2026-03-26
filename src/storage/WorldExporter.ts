import type { OverworldData } from '@/types/overworld';

/** Versioned envelope for world JSON export/import. */
export type WorldExportData = {
  format: 'oneparty-world';
  version: number;
  exportedAt: number;
  overworld: OverworldData;
};

export class WorldExporter {
  /** Wrap an OverworldData in the export envelope. */
  static toExport(overworld: OverworldData): WorldExportData {
    return {
      format: 'oneparty-world',
      version: 1,
      exportedAt: Date.now(),
      overworld,
    };
  }

  /** Runtime validation of an imported JSON blob. */
  static validate(data: unknown): data is WorldExportData {
    if (typeof data !== 'object' || data === null) return false;
    const d = data as Record<string, unknown>;
    if (d.format !== 'oneparty-world') return false;
    if (typeof d.version !== 'number') return false;
    const ow = d.overworld as Record<string, unknown> | undefined;
    if (!ow || typeof ow !== 'object') return false;
    if (typeof ow.id !== 'string') return false;
    if (typeof ow.name !== 'string') return false;
    if (typeof ow.seed !== 'number') return false;
    if (typeof ow.width !== 'number' || typeof ow.height !== 'number') return false;
    if (!Array.isArray(ow.tiles) || ow.tiles.length !== ow.height) return false;
    if (!Array.isArray(ow.regions)) return false;
    if (!Array.isArray(ow.history)) return false;
    // Spot-check first row
    const firstRow = (ow.tiles as unknown[][])[0];
    if (!Array.isArray(firstRow) || firstRow.length !== ow.width) return false;
    const sample = firstRow[0] as Record<string, unknown> | undefined;
    if (!sample || typeof sample.terrain !== 'string' || typeof sample.elevation !== 'number') return false;
    return true;
  }

  /** Trigger a browser file download of the world JSON. */
  static download(overworld: OverworldData): void {
    const exportData = WorldExporter.toExport(overworld);
    const json = JSON.stringify(exportData);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = overworld.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    a.href = url;
    a.download = `${safeName}.oneparty.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
