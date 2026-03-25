import type { CellTerrain, CellFeature } from '@/types';
import type { Tileset, TilesetRenderContext } from './Tileset';
import { getWallChar } from './Tileset';
import { spriteRenderer } from './PixelSprites';

// ── Pixel-Art Tileset ─────────────────────────────────────────
// Every terrain and feature is rendered as an 8×8 pixel pattern
// scaled to fill the cell. No arcs, strokes, or anti-aliased
// shapes — pure rectangles for a chunky pixel-art aesthetic.

type RGB = [number, number, number];

// ── Tile Pattern System ──────────────────────────────────────

interface TilePattern {
  pixels: string[];                // 8 rows of 8 chars, '.' = base color
  palette: Record<string, RGB>;   // char → RGB color
}

/** Draw an 8×8 pixel pattern onto a cell, scaling each "pixel" to fill. */
function drawPattern(
  ctx: CanvasRenderingContext2D,
  px: number, py: number, cw: number, ch: number,
  pattern: TilePattern,
  dim: number,
  baseColor?: RGB,
): void {
  const pw = cw / 8;
  const ph = ch / 8;
  for (let y = 0; y < 8; y++) {
    const row = pattern.pixels[y];
    if (!row) continue;
    for (let x = 0; x < 8; x++) {
      const ch2 = row[x];
      if (!ch2) continue;
      let color: RGB;
      if (ch2 === '.') {
        if (!baseColor) continue;
        color = baseColor;
      } else {
        const c = pattern.palette[ch2];
        if (!c) continue;
        color = c;
      }
      ctx.fillStyle = rgb(color, dim);
      ctx.fillRect(
        px + Math.floor(x * pw),
        py + Math.floor(y * ph),
        Math.ceil(pw),
        Math.ceil(ph),
      );
    }
  }
}

function blend(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.floor(a[0] + (b[0] - a[0]) * t),
    Math.floor(a[1] + (b[1] - a[1]) * t),
    Math.floor(a[2] + (b[2] - a[2]) * t),
  ];
}

function rgb(c: RGB, dim = 1): string {
  return `rgb(${Math.floor(c[0] * dim)},${Math.floor(c[1] * dim)},${Math.floor(c[2] * dim)})`;
}

// ── Terrain Palettes ─────────────────────────────────────────
// Richer, more saturated colors for faux-isometric 3/4 view look

const TERRAIN_COLORS: Record<CellTerrain, { base: RGB; alt: RGB; accent: RGB }> = {
  floor:  { base: [52, 46, 38],   alt: [58, 50, 42],   accent: [65, 56, 46] },
  wall:   { base: [78, 72, 62],   alt: [88, 80, 70],   accent: [65, 58, 50] },
  grass:  { base: [48, 110, 42],  alt: [38, 95, 35],   accent: [60, 130, 52] },
  water:  { base: [25, 90, 175],  alt: [35, 100, 185],  accent: [18, 75, 150] },
  lava:   { base: [210, 65, 12],  alt: [230, 85, 22],  accent: [190, 45, 8] },
  stone:  { base: [100, 95, 88],  alt: [112, 106, 96], accent: [88, 82, 76] },
  ice:    { base: [170, 210, 228],alt: [180, 218, 236], accent: [150, 195, 218] },
  mud:    { base: [100, 68, 35],  alt: [112, 76, 40],  accent: [88, 58, 28] },
  sand:   { base: [200, 180, 110],alt: [210, 190, 120],accent: [188, 168, 98] },
  wood:   { base: [128, 86, 44],  alt: [138, 94, 50],  accent: [118, 78, 38] },
  pit:    { base: [8, 6, 4],      alt: [12, 10, 8],    accent: [5, 4, 3] },
};

const FEATURE_COLORS: Record<CellFeature, { primary: RGB; secondary: RGB; bg: RGB }> = {
  door:        { primary: [200, 140, 40],  secondary: [160, 110, 30],  bg: [80, 55, 20] },
  door_locked: { primary: [200, 50, 50],   secondary: [160, 40, 40],   bg: [80, 20, 20] },
  chest:       { primary: [240, 200, 40],  secondary: [200, 160, 30],  bg: [80, 65, 15] },
  trap:        { primary: [220, 40, 40],   secondary: [180, 30, 30],   bg: [60, 15, 15] },
  stairs_up:   { primary: [200, 210, 220], secondary: [150, 160, 170], bg: [30, 50, 80] },
  stairs_down: { primary: [200, 210, 220], secondary: [150, 160, 170], bg: [30, 50, 80] },
  fountain:    { primary: [40, 180, 240],  secondary: [30, 140, 200],  bg: [15, 50, 80] },
  fire:        { primary: [255, 140, 20],  secondary: [255, 80, 10],   bg: [80, 30, 5] },
  altar:       { primary: [180, 80, 240],  secondary: [140, 60, 200],  bg: [50, 20, 80] },
  pillar:      { primary: [160, 155, 145], secondary: [130, 125, 115], bg: [70, 68, 62] },
  tree:        { primary: [50, 120, 40],   secondary: [100, 70, 30],   bg: [20, 45, 15] },
  rock:        { primary: [120, 115, 108], secondary: [95, 90, 82],    bg: [55, 52, 48] },
  running_water: { primary: [60, 180, 255], secondary: [30, 140, 220], bg: [10, 40, 70] },
  torch_wall:       { primary: [255, 170, 50], secondary: [200, 120, 30], bg: [80, 40, 10] },
  torch_wall_spent: { primary: [85, 80, 65],  secondary: [60, 55, 45],  bg: [30, 28, 22] },
  brazier:          { primary: [255, 120, 20], secondary: [220, 80, 10],  bg: [80, 30, 5] },
};

// ── Terrain Patterns (8×8) — Faux-Isometric 3/4 View ────────
// Bottom rows show a south-facing edge/lip for depth.
// Top-left lighting: highlights top-left, shadows bottom-right.
// '.' = base color, letters = palette entries

function makeFloorPatterns(base: RGB, accent: RGB): TilePattern[] {
  const hi: RGB = blend(base, [120, 110, 95], 0.2);
  const dark: RGB = blend(base, [18, 15, 12], 0.4);
  const edge: RGB = blend(base, [15, 12, 10], 0.55);
  const mortar: RGB = blend(base, [25, 22, 18], 0.45);
  const scuff: RGB = blend(accent, base, 0.4);
  return [
    // Cobblestone variant A
    { pixels: [
      'h..m..h.',
      '...m....',
      '...m....',
      'mmmmmmmm',
      '.m..h..m',
      '.m......',
      '.m......',
      'eeeeeeee',
    ], palette: { h: hi, d: dark, e: edge, m: mortar, s: scuff } },
    // Cobblestone variant B
    { pixels: [
      '.m.h..m.',
      '.m.....m',
      '.m.....m',
      'mmmmmmmm',
      '..m..s.m',
      '..m....m',
      '..m....m',
      'eeeeeeee',
    ], palette: { h: hi, d: dark, e: edge, m: mortar, s: scuff } },
    // Cobblestone variant C
    { pixels: [
      'h.m...m.',
      '..m...m.',
      '..m...m.',
      'mmmmmmmm',
      '.m..m..h',
      '.m..m...',
      '.m..m...',
      'eeeeeeee',
    ], palette: { h: hi, d: dark, e: edge, m: mortar } },
  ];
}

function makeWallPattern(base: RGB, hash: number, wallChar: string): TilePattern {
  const hi: RGB = blend(base, [190, 185, 175], 0.3);
  const mid: RGB = blend(base, [140, 135, 125], 0.15);
  const sh: RGB = blend(base, [25, 22, 18], 0.45);
  const mortar: RGB = blend(base, [35, 30, 24], 0.5);
  const face: RGB = blend(base, [40, 36, 30], 0.35);
  const faceDark: RGB = blend(base, [22, 18, 14], 0.55);

  const hasH = wallChar === '\u2501' || wallChar === '\u254B' || wallChar === '\u2533' || wallChar === '\u253B' || wallChar === '\u2523' || wallChar === '\u252B';
  const hasV = wallChar === '\u2503' || wallChar === '\u254B' || wallChar === '\u2533' || wallChar === '\u253B' || wallChar === '\u2523' || wallChar === '\u252B';

  // Top 5 rows = top face of wall, bottom 3 = south-facing front face
  const rows = hash % 2 === 0 ? [
    'hhhhhhhh',
    'hm.b.mbh',
    'h....m.h',
    'mmmmmmmm',
    'hb.m...h',
    'FFFFFFFF',
    'FFffFFff',
    'DDDDDDDD',
  ] : [
    'hhhhhhhh',
    'hm...bmh',
    'h..m...h',
    'mmmmmmmm',
    'h.bm..bh',
    'FFFFFFFF',
    'FffFFFff',
    'DDDDDDDD',
  ];

  if (hasH) {
    rows[3] = 'mmmmmmmm';
  }
  if (hasV) {
    for (let i = 0; i < 5; i++) {
      const r = rows[i].split('');
      r[3] = 'm';
      rows[i] = r.join('');
    }
  }

  return {
    pixels: rows,
    palette: { h: hi, s: sh, m: mortar, b: mid, F: face, f: faceDark, D: faceDark },
  };
}

function makeGrassPatterns(base: RGB, accent: RGB): TilePattern[] {
  const dark: RGB = blend(base, [20, 60, 22], 0.4);
  const light: RGB = blend(accent, [75, 155, 65], 0.35);
  const dirt: RGB = blend(base, [90, 65, 35], 0.3);
  const flower: RGB = [195, 155, 55];
  const blade: RGB = blend(accent, [55, 135, 48], 0.25);
  const edge: RGB = blend(base, [28, 65, 25], 0.45);
  return [
    { pixels: [
      '..l..b..',
      '.l..d..l',
      '....b...',
      '.b.l...b',
      '..d...l.',
      '.....b..',
      '.b..d...',
      'eeeeeeee',
    ], palette: { l: light, d: dark, b: blade, e: edge } },
    { pixels: [
      '.b....l.',
      '...b....',
      '.l...b..',
      '...d..l.',
      'b....d..',
      '..l....b',
      '....b...',
      'eeeeeeee',
    ], palette: { l: light, d: dark, b: blade, e: edge } },
    { pixels: [
      '....b...',
      '.b..l.b.',
      '..f...l.',
      '.l...b..',
      '...d..r.',
      '.b....l.',
      '..l..b..',
      'eeeeeeee',
    ], palette: { l: light, d: dark, b: blade, f: flower, r: dirt, e: edge } },
    { pixels: [
      '.l...b..',
      '..b....l',
      '...l.r..',
      '.b...b..',
      '..d..l..',
      'l....b..',
      '..b...d.',
      'eeeeeeee',
    ], palette: { l: light, d: dark, b: blade, r: dirt, e: edge } },
  ];
}

function makeWaterPatterns(base: RGB, accent: RGB): TilePattern[] {
  const light: RGB = blend(base, [80, 165, 245], 0.3);
  const foam: RGB = [110, 190, 235];
  const deep: RGB = blend(accent, [12, 55, 125], 0.3);
  const sparkle: RGB = [190, 228, 255];
  const dark: RGB = blend(base, [10, 50, 120], 0.4);
  return [
    { pixels: [
      'd.......',
      '.ff..ff.',
      '........',
      '...l....',
      '..ff..ff',
      '........',
      'd.......',
      'dddddddd',
    ], palette: { f: foam, l: light, d: dark } },
    { pixels: [
      '...ll...',
      '........',
      'ff....ff',
      '........',
      '...s....',
      '..ff..ff',
      '........',
      'dddddddd',
    ], palette: { f: foam, l: light, s: sparkle, d: dark } },
    { pixels: [
      '........',
      'dff..dff',
      '........',
      '....l...',
      '........',
      '.dff..df',
      '........',
      'dddddddd',
    ], palette: { f: foam, d: deep, l: light } },
  ];
}

function makeLavaPatterns(_base: RGB, accent: RGB): TilePattern[] {
  const hot: RGB = [255, 185, 45];
  const glow: RGB = [255, 225, 85];
  const crust: RGB = blend(accent, [85, 22, 6], 0.5);
  const dark: RGB = [120, 30, 5];
  return [
    { pixels: [
      '........',
      '..hh....',
      '.hgg.c..',
      '..hh....',
      '........',
      '....hh..',
      'c..hggh.',
      'dddddddd',
    ], palette: { h: hot, g: glow, c: crust, d: dark } },
    { pixels: [
      '..c.....',
      '........',
      '...hgh..',
      '...hhh..',
      '........',
      '.hh..c..',
      '.hgh....',
      'dddddddd',
    ], palette: { h: hot, g: glow, c: crust, d: dark } },
  ];
}

function makeIcePatterns(base: RGB): TilePattern[] {
  const crack: RGB = blend(base, [225, 242, 255], 0.3);
  const shine: RGB = [235, 248, 255];
  const dark: RGB = blend(base, [125, 165, 195], 0.3);
  const edge: RGB = blend(base, [110, 150, 180], 0.4);
  return [
    { pixels: [
      's.......',
      '..c.....',
      '...c....',
      '....c..s',
      '...c....',
      '........',
      '.s......',
      'eeeeeeee',
    ], palette: { c: crack, s: shine, d: dark, e: edge } },
    { pixels: [
      '........',
      '.....c..',
      '....c...',
      '...c....',
      '........',
      '..s.....',
      '......s.',
      'eeeeeeee',
    ], palette: { c: crack, s: shine, d: dark, e: edge } },
  ];
}

function makeSandPatterns(base: RGB, accent: RGB): TilePattern[] {
  const grain: RGB = blend(accent, [215, 195, 125], 0.3);
  const dark: RGB = blend(base, [165, 145, 85], 0.3);
  const edge: RGB = blend(base, [155, 135, 75], 0.4);
  const pebble: RGB = blend(base, [140, 120, 70], 0.35);
  return [
    { pixels: [
      '........',
      '...g....',
      '.p......',
      '.g....g.',
      '........',
      '......d.',
      '........',
      'eeeeeeee',
    ], palette: { g: grain, d: dark, e: edge, p: pebble } },
    { pixels: [
      '.....g..',
      '........',
      '.d......',
      '........',
      '....g...',
      '........',
      '.g...p..',
      'eeeeeeee',
    ], palette: { g: grain, d: dark, e: edge, p: pebble } },
  ];
}

function makeMudPatterns(base: RGB): TilePattern[] {
  const wet: RGB = blend(base, [65, 45, 22], 0.3);
  const puddle: RGB = blend(base, [45, 32, 16], 0.45);
  const edge: RGB = blend(base, [55, 38, 18], 0.5);
  return [
    { pixels: [
      '........',
      '..ww....',
      '..ww....',
      '........',
      '.....pp.',
      '.....pp.',
      '........',
      'eeeeeeee',
    ], palette: { w: wet, p: puddle, e: edge } },
    { pixels: [
      '........',
      '........',
      '....ww..',
      '........',
      '........',
      '.pp.....',
      '.pp.....',
      'eeeeeeee',
    ], palette: { w: wet, p: puddle, e: edge } },
  ];
}

function makeStonePatterns(base: RGB, accent: RGB): TilePattern[] {
  const crack: RGB = blend(base, [55, 52, 48], 0.4);
  const pebble: RGB = blend(accent, base, 0.5);
  const hi: RGB = blend(base, [150, 145, 138], 0.15);
  const edge: RGB = blend(base, [60, 56, 50], 0.45);
  return [
    { pixels: [
      'h.......',
      '...c....',
      '...c....',
      '...c....',
      '........',
      '.p......',
      '........',
      'eeeeeeee',
    ], palette: { c: crack, p: pebble, h: hi, e: edge } },
    { pixels: [
      '........',
      '......h.',
      '......c.',
      '......c.',
      '........',
      '........',
      '..p.....',
      'eeeeeeee',
    ], palette: { c: crack, p: pebble, h: hi, e: edge } },
  ];
}

function makeWoodPatterns(base: RGB, accent: RGB): TilePattern[] {
  const grain: RGB = blend(base, accent, 0.3);
  const knot: RGB = blend(base, [85, 54, 28], 0.5);
  const hi: RGB = blend(base, [165, 120, 70], 0.2);
  const edge: RGB = blend(base, [70, 48, 22], 0.45);
  return [
    { pixels: [
      'h.......',
      'gggggggg',
      '........',
      '........',
      '........',
      'gggggggg',
      '........',
      'eeekeeee',
    ], palette: { g: grain, k: knot, h: hi, e: edge } },
    { pixels: [
      '........',
      '..h.....',
      'gggggggg',
      '........',
      '.k......',
      '........',
      'gggggggg',
      'eeeeeeee',
    ], palette: { g: grain, k: knot, h: hi, e: edge } },
  ];
}

function makePitPattern(): TilePattern {
  const edge: RGB = [28, 24, 18];
  const lip: RGB = [42, 36, 28];
  const void_: RGB = [3, 2, 1];
  return { pixels: [
    'llllllll',
    'le....el',
    'e......e',
    '........',
    '........',
    'e......e',
    'ev....ve',
    'eeeeeeee',
  ], palette: { e: edge, v: void_, l: lip } };
}

// ── Feature Patterns (8×8) — Faux-Isometric 3/4 View ────────
// Features show a south-facing front face for depth.

function makeDoorPattern(primary: RGB, secondary: RGB, locked: boolean, isOpen: boolean): TilePattern {
  const frame: RGB = secondary;
  const panel: RGB = primary;
  const handle: RGB = locked ? [255, 60, 60] : [240, 220, 100];
  const dark: RGB = blend(secondary, [20, 16, 10], 0.5);
  const face: RGB = blend(secondary, [30, 25, 18], 0.45);

  if (isOpen) {
    return { pixels: [
      '.ff.....',
      '.fp.....',
      '.fH.....',
      '.fp.....',
      '.fp.....',
      '.ff.....',
      '.dd.....',
      '........',
    ], palette: { f: frame, p: panel, H: handle, d: dark } };
  }
  return { pixels: [
    '.ffffff.',
    '.fpppf.',
    '.fppHf.',
    '.fpppf.',
    '.fpppf.',
    '.ffffff.',
    '.FFFFFF.',
    '.dddddd.',
  ], palette: { f: frame, p: panel, H: handle, F: face, d: dark } };
}

function makeChestPattern(primary: RGB, secondary: RGB): TilePattern {
  const latch: RGB = [255, 255, 200];
  const hi: RGB = blend(primary, [255, 240, 180], 0.25);
  const face: RGB = blend(secondary, [30, 22, 8], 0.35);
  const dark: RGB = blend(secondary, [20, 15, 5], 0.5);
  return { pixels: [
    '........',
    '..hppp..',
    '..pppp..',
    '..sLss..',
    '..FFFF..',
    '..FFFF..',
    '..dddd..',
    '........',
  ], palette: { p: primary, s: secondary, L: latch, h: hi, F: face, d: dark } };
}

function makeTrapPattern(primary: RGB, secondary: RGB): TilePattern {
  const warn: RGB = [255, 200, 60];
  return { pixels: [
    '........',
    '........',
    '..pssp..',
    '.ppwwpp.',
    '.pswwsp.',
    '..pssp..',
    '........',
    '........',
  ], palette: { p: primary, s: secondary, w: warn } };
}

function makeStairsPattern(primary: RGB, secondary: RGB, up: boolean): TilePattern {
  const s1 = secondary;
  const s2 = blend(secondary, primary, 0.33);
  const s3 = blend(secondary, primary, 0.66);
  const s4 = primary;
  const face: RGB = blend(secondary, [20, 18, 14], 0.5);
  if (up) {
    return { pixels: [
      '........',
      '.....444',
      '...33344',
      '...33F44',
      '.2223F44',
      '.222FF44',
      '111FF.44',
      '111F....',
    ], palette: { '1': s1, '2': s2, '3': s3, '4': s4, F: face } };
  }
  return { pixels: [
    '111F....',
    '111FF.44',
    '.222FF44',
    '.2223F44',
    '...33F44',
    '...33344',
    '.....444',
    '........',
  ], palette: { '1': s4, '2': s3, '3': s2, '4': s1, F: face } };
}

function makeFountainPattern(primary: RGB, secondary: RGB): TilePattern {
  const sparkle: RGB = [190, 228, 255];
  const rim: RGB = blend(secondary, [160, 155, 145], 0.3);
  const face: RGB = blend(secondary, [20, 35, 60], 0.45);
  return { pixels: [
    '...sk...',
    '..spps..',
    '.spppps.',
    '.spppps.',
    '.srrrrs.',
    '..FFFF..',
    '..FFFF..',
    '..ffff..',
  ], palette: { s: secondary, p: primary, k: sparkle, r: rim, F: face, f: blend(face, [10, 10, 10], 0.3) } };
}

function makeFirePattern(primary: RGB, secondary: RGB): TilePattern {
  const core: RGB = [255, 245, 130];
  const tip: RGB = [255, 200, 60];
  return { pixels: [
    '...tt...',
    '...sp...',
    '..spps..',
    '..spps..',
    '.ssppss.',
    '.ssccss.',
    '..ssss..',
    '........',
  ], palette: { s: secondary, p: primary, c: core, t: tip } };
}

function makeAltarPattern(primary: RGB, secondary: RGB): TilePattern {
  const glow: RGB = [225, 165, 255];
  const face: RGB = blend(secondary, [30, 14, 50], 0.45);
  const dark: RGB = blend(secondary, [18, 8, 35], 0.55);
  return { pixels: [
    '...gg...',
    '..gpgp..',
    '...gg...',
    '.pppppp.',
    '.pppppp.',
    '.FFFFFF.',
    '.FFFFFF.',
    '.dddddd.',
  ], palette: { p: primary, s: secondary, g: glow, F: face, d: dark } };
}

function makePillarPattern(primary: RGB, secondary: RGB): TilePattern {
  const cap: RGB = blend(primary, [205, 200, 190], 0.3);
  const hi: RGB = blend(primary, [180, 175, 165], 0.2);
  const face: RGB = blend(secondary, [40, 38, 34], 0.4);
  const dark: RGB = blend(secondary, [22, 20, 16], 0.55);
  return { pixels: [
    '..cccc..',
    '..hpps..',
    '..hpps..',
    '..hpps..',
    '..hpps..',
    '..FFFF..',
    '..FFFF..',
    '..dddd..',
  ], palette: { p: primary, s: secondary, c: cap, h: hi, F: face, d: dark } };
}

function makeTreePattern(primary: RGB, secondary: RGB): TilePattern {
  const light: RGB = blend(primary, [85, 170, 65], 0.4);
  const dark: RGB = blend(primary, [22, 55, 18], 0.4);
  const trunk: RGB = blend(secondary, [60, 40, 20], 0.3);
  return { pixels: [
    '..llpp..',
    '.llpppp.',
    '.lpppdd.',
    '.ppppdd.',
    '..ppdd..',
    '...tt...',
    '...tt...',
    '..tttt..',
  ], palette: { p: primary, l: light, d: dark, t: trunk } };
}

function makeRockPattern(primary: RGB): TilePattern {
  const hi: RGB = blend(primary, [190, 185, 175], 0.3);
  const sh: RGB = blend(primary, [45, 42, 38], 0.3);
  const face: RGB = blend(primary, [55, 52, 46], 0.35);
  return { pixels: [
    '........',
    '..hhpp..',
    '.hhppps.',
    '.hpppps.',
    '.ppppss.',
    '.FFFFFF.',
    '..FFFs..',
    '........',
  ], palette: { p: primary, h: hi, s: sh, F: face } };
}

function makeRunningWaterPattern(primary: RGB, secondary: RGB): TilePattern {
  const sparkle: RGB = [190, 235, 255];
  const dark: RGB = blend(secondary, [10, 40, 70], 0.4);
  return { pixels: [
    'ss.ss.ss',
    '........',
    '.pp..pp.',
    '........',
    's..ss..s',
    '........',
    '..pp..pp',
    'dddddddd',
  ], palette: { p: primary, s: secondary, k: sparkle, d: dark } };
}

function makeTorchPattern(primary: RGB, secondary: RGB): TilePattern {
  const glow: RGB = [255, 245, 130];
  const tip: RGB = [255, 200, 60];
  return { pixels: [
    '...tg...',
    '...pp...',
    '...pp...',
    '...ss...',
    '...ss...',
    '...ss...',
    '...ss...',
    '........',
  ], palette: { p: primary, s: secondary, g: glow, t: tip } };
}

function makeBrazierPattern(primary: RGB, secondary: RGB): TilePattern {
  const glow: RGB = [255, 245, 130];
  const tip: RGB = [255, 200, 60];
  const face: RGB = blend(secondary, [50, 25, 5], 0.4);
  const dark: RGB = blend(secondary, [28, 14, 3], 0.55);
  return { pixels: [
    '...tg...',
    '..pppp..',
    '..pppp..',
    '..ssss..',
    '.ssssss.',
    '.FFFFFF.',
    '.FFFFFF.',
    '.dddddd.',
  ], palette: { p: primary, s: secondary, g: glow, t: tip, F: face, d: dark } };
}

// ── Fantasy Tileset ──────────────────────────────────────────

export class FantasyTileset implements Tileset {
  readonly name = 'Fantasy';
  readonly id = 'fantasy';
  readonly squareCells = true;
  readonly baseCellSize = 40;

  renderTerrain(rc: TilesetRenderContext, terrain: CellTerrain): void {
    const { ctx, px, py, cw, ch, gx, gy, hash, grid, dim } = rc;
    const colors = TERRAIN_COLORS[terrain] ?? TERRAIN_COLORS.floor;

    // Pick a subtle variation based on hash
    const variation = (hash % 7) / 7;
    const baseColor = blend(colors.base, colors.alt, variation);

    // Fill base color first
    ctx.fillStyle = rgb(baseColor, dim);
    ctx.fillRect(px, py, cw, ch);

    // Terrain-specific pixel patterns
    switch (terrain) {
      case 'wall': {
        const wallChar = getWallChar(grid, gx, gy);
        const pattern = makeWallPattern(baseColor, hash, wallChar);
        drawPattern(ctx, px, py, cw, ch, pattern, dim);
        break;
      }
      case 'grass': {
        const patterns = makeGrassPatterns(baseColor, colors.accent);
        drawPattern(ctx, px, py, cw, ch, patterns[hash % patterns.length], dim, baseColor);
        break;
      }
      case 'water': {
        const patterns = makeWaterPatterns(baseColor, colors.accent);
        drawPattern(ctx, px, py, cw, ch, patterns[hash % patterns.length], dim, baseColor);
        break;
      }
      case 'lava': {
        const patterns = makeLavaPatterns(baseColor, colors.accent);
        drawPattern(ctx, px, py, cw, ch, patterns[hash % patterns.length], dim, baseColor);
        break;
      }
      case 'ice': {
        const patterns = makeIcePatterns(baseColor);
        drawPattern(ctx, px, py, cw, ch, patterns[hash % patterns.length], dim, baseColor);
        break;
      }
      case 'sand': {
        const patterns = makeSandPatterns(baseColor, colors.accent);
        drawPattern(ctx, px, py, cw, ch, patterns[hash % patterns.length], dim, baseColor);
        break;
      }
      case 'mud': {
        const patterns = makeMudPatterns(baseColor);
        drawPattern(ctx, px, py, cw, ch, patterns[hash % patterns.length], dim, baseColor);
        break;
      }
      case 'stone': {
        const patterns = makeStonePatterns(baseColor, colors.accent);
        drawPattern(ctx, px, py, cw, ch, patterns[hash % patterns.length], dim, baseColor);
        break;
      }
      case 'wood': {
        const patterns = makeWoodPatterns(baseColor, colors.accent);
        drawPattern(ctx, px, py, cw, ch, patterns[hash % patterns.length], dim, baseColor);
        break;
      }
      case 'floor': {
        const patterns = makeFloorPatterns(baseColor, colors.accent);
        drawPattern(ctx, px, py, cw, ch, patterns[hash % patterns.length], dim, baseColor);
        break;
      }
      case 'pit': {
        const pattern = makePitPattern();
        drawPattern(ctx, px, py, cw, ch, pattern, dim, baseColor);
        break;
      }
    }
  }

  renderFeature(rc: TilesetRenderContext, feature: CellFeature, _terrain: CellTerrain): void {
    const { ctx, px, py, cw, ch, dim } = rc;
    const colors = FEATURE_COLORS[feature];
    if (!colors) return;

    let pattern: TilePattern | null = null;

    switch (feature) {
      case 'door':
      case 'door_locked': {
        const doorCell = rc.grid.getCell(rc.gx, rc.gy);
        const isOpen = doorCell ? doorCell.movementCost < Infinity : false;
        pattern = makeDoorPattern(colors.primary, colors.secondary, feature === 'door_locked', isOpen);
        break;
      }
      case 'chest':
        pattern = makeChestPattern(colors.primary, colors.secondary);
        break;
      case 'trap':
        pattern = makeTrapPattern(colors.primary, colors.secondary);
        break;
      case 'stairs_up':
        pattern = makeStairsPattern(colors.primary, colors.secondary, true);
        break;
      case 'stairs_down':
        pattern = makeStairsPattern(colors.primary, colors.secondary, false);
        break;
      case 'fountain':
        pattern = makeFountainPattern(colors.primary, colors.secondary);
        break;
      case 'fire':
        pattern = makeFirePattern(colors.primary, colors.secondary);
        break;
      case 'altar':
        pattern = makeAltarPattern(colors.primary, colors.secondary);
        break;
      case 'pillar':
        pattern = makePillarPattern(colors.primary, colors.secondary);
        break;
      case 'tree':
        pattern = makeTreePattern(colors.primary, colors.secondary);
        break;
      case 'rock':
        pattern = makeRockPattern(colors.primary);
        break;
      case 'running_water':
        pattern = makeRunningWaterPattern(colors.primary, colors.secondary);
        break;
      case 'torch_wall':
        pattern = makeTorchPattern(colors.primary, colors.secondary);
        break;
      case 'torch_wall_spent':
        pattern = makeTorchPattern(colors.primary, colors.secondary);
        break;
      case 'brazier':
        pattern = makeBrazierPattern(colors.primary, colors.secondary);
        break;
    }

    if (pattern) {
      drawPattern(ctx, px, py, cw, ch, pattern, dim);
    }
  }

  renderEntity(
    rc: TilesetRenderContext,
    symbol: string,
    color: string,
    isPlayer: boolean,
    isAlly: boolean,
    spriteId?: string,
  ): void {
    const { ctx, px, py, cw, ch } = rc;

    // Try pixel sprite first — rendered directly on terrain, no background box
    if (spriteId && spriteRenderer.has(spriteId)) {
      // Render shadow beneath entity
      spriteRenderer.renderShadow(ctx, px, py, cw, ch);

      const rendered = spriteRenderer.renderSprite(ctx, spriteId, px, py, cw, ch);
      if (rendered) return;
    }

    // Fallback: pixel-art style colored block + symbol
    const pw = cw / 8;
    const ph = ch / 8;
    let c = color;
    if (isPlayer) c = '#ffffff';
    else if (isAlly) c = '#44aaff';

    // Draw a blocky diamond/circle shape
    const shape = [
      '...CC...',
      '..CCCC..',
      '.CCCCCC.',
      '.CCCCCC.',
      '.CCCCCC.',
      '.CCCCCC.',
      '..CCCC..',
      '...CC...',
    ];
    ctx.fillStyle = c;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (shape[y][x] === 'C') {
          ctx.fillRect(
            px + Math.floor(x * pw),
            py + Math.floor(y * ph),
            Math.ceil(pw),
            Math.ceil(ph),
          );
        }
      }
    }

    // Symbol text on top
    ctx.fillStyle = '#0a0a0a';
    ctx.font = `bold ${Math.floor(Math.min(cw, ch) * 0.45)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(symbol, px + cw / 2, py + ch / 2);
  }
}
