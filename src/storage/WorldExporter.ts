import type { OverworldData } from '@/types/overworld';
import type { Universe } from '@/types/universe';

// ── Export format types ─────────────────────────────────────────

/** v1: legacy flat overworld */
export type WorldExportDataV1 = {
  format: 'oneparty-world';
  version: 1;
  exportedAt: number;
  overworld: OverworldData;
};

/** v2: hierarchical universe */
export type WorldExportDataV2 = {
  format: 'oneparty-world';
  version: 2;
  exportedAt: number;
  universe: Universe;
};

export type WorldExportData = WorldExportDataV1 | WorldExportDataV2;

// ── Exporter ────────────────────────────────────────────────────

export class WorldExporter {
  /** Wrap a legacy OverworldData in a v1 envelope. */
  static toExportV1(overworld: OverworldData): WorldExportDataV1 {
    return {
      format: 'oneparty-world',
      version: 1,
      exportedAt: Date.now(),
      overworld,
    };
  }

  /** Wrap a Universe in a v2 envelope. */
  static toExportV2(universe: Universe): WorldExportDataV2 {
    return {
      format: 'oneparty-world',
      version: 2,
      exportedAt: Date.now(),
      universe,
    };
  }

  /** Runtime validation of an imported JSON blob. Accepts both v1 and v2. */
  static validate(data: unknown): data is WorldExportData {
    if (typeof data !== 'object' || data === null) return false;
    const d = data as Record<string, unknown>;
    if (d.format !== 'oneparty-world') return false;
    if (typeof d.version !== 'number') return false;

    if (d.version === 1) {
      return WorldExporter.validateV1(d);
    } else if (d.version === 2) {
      return WorldExporter.validateV2(d);
    }
    return false;
  }

  /** Validate a v1 export (flat overworld). */
  private static validateV1(d: Record<string, unknown>): boolean {
    const ow = d.overworld as Record<string, unknown> | undefined;
    if (!ow || typeof ow !== 'object') return false;
    if (typeof ow.id !== 'string') return false;
    if (typeof ow.name !== 'string') return false;
    if (typeof ow.seed !== 'number') return false;
    if (typeof ow.width !== 'number' || typeof ow.height !== 'number') return false;
    if (!Array.isArray(ow.tiles) || ow.tiles.length !== ow.height) return false;
    if (!Array.isArray(ow.regions)) return false;
    if (!Array.isArray(ow.history)) return false;
    const firstRow = (ow.tiles as unknown[][])[0];
    if (!Array.isArray(firstRow) || firstRow.length !== ow.width) return false;
    const sample = firstRow[0] as Record<string, unknown> | undefined;
    if (!sample || typeof sample.terrain !== 'string' || typeof sample.elevation !== 'number') return false;
    return true;
  }

  /** Validate a v2 export (hierarchical universe). */
  private static validateV2(d: Record<string, unknown>): boolean {
    const u = d.universe as Record<string, unknown> | undefined;
    if (!u || typeof u !== 'object') return false;
    if (typeof u.id !== 'string') return false;
    if (typeof u.name !== 'string') return false;
    if (!Array.isArray(u.planes) || u.planes.length === 0) return false;
    if (!Array.isArray(u.history)) return false;
    if (!u.meta || typeof u.meta !== 'object') return false;

    // Walk to first country and validate its overworld
    const plane = (u.planes as Record<string, unknown>[])[0];
    if (!plane) return false;
    const planeInline = plane.inline as Record<string, unknown> | undefined;
    if (!planeInline) return false;
    if (!Array.isArray(planeInline.continents)) return false;
    const cont = (planeInline.continents as Record<string, unknown>[])[0];
    if (!cont) return true; // empty universe is valid
    const contInline = cont.inline as Record<string, unknown> | undefined;
    if (!contInline) return true;
    if (!Array.isArray(contInline.regions)) return true;
    // Deep validation of first country's overworld
    const reg = (contInline.regions as Record<string, unknown>[])[0];
    if (!reg?.inline) return true;
    const regInline = reg.inline as Record<string, unknown>;
    if (!Array.isArray(regInline.countries)) return true;
    const country = (regInline.countries as Record<string, unknown>[])[0];
    if (!country?.inline) return true;
    const countryInline = country.inline as Record<string, unknown>;
    if (!countryInline.overworld) return false;
    // Validate the embedded overworld
    const owCheck: Record<string, unknown> = {
      format: 'oneparty-world',
      version: 1,
      overworld: countryInline.overworld,
    };
    return WorldExporter.validateV1(owCheck);
  }

  /** Trigger a browser file download. Works for both v1 and v2. */
  static download(data: OverworldData | Universe): void {
    let exportData: WorldExportData;
    let name: string;

    if ('planes' in data) {
      // Universe (v2)
      exportData = WorldExporter.toExportV2(data);
      name = data.name;
    } else {
      // OverworldData (v1)
      exportData = WorldExporter.toExportV1(data);
      name = data.name;
    }

    // Infinity is not valid JSON — encode as sentinel number for round-tripping
    const json = JSON.stringify(exportData, (_key, value) => value === Infinity ? 999999 : value);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    a.href = url;
    a.download = `${safeName}.oneparty.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
