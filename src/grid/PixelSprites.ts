// ── Pixel Art Sprite System ──────────────────────────────────
// 16×16 modern pixel art sprites for player classes & monsters.
// Each sprite is defined as a palette + pixel rows.
// Auto-outline generation adds 1px dark border around all opaque pixels.
// Rendered to offscreen canvases and cached for fast blitting.

// ── Types ────────────────────────────────────────────────────

interface SpriteDefinition {
  pixels: string[];                 // 16 rows of 16 chars, '.' = transparent
  palette: Record<string, string>;  // char → hex color
}

// ── Character Class Sprites ──────────────────────────────────

const FIGHTER: SpriteDefinition = {
  palette: {
    // Steel armor (4 shades)
    A: '#d0d8e4', // bright steel highlight
    a: '#a0aab8', // mid steel
    B: '#707880', // dark steel
    b: '#484e56', // deepest steel shadow
    // Gold trim (3 shades)
    G: '#f0d060', // bright gold
    g: '#c4a030', // mid gold
    Y: '#8a7020', // dark gold
    // Blue cape/plume
    C: '#4488dd', // bright blue
    c: '#2860a8', // mid blue
    U: '#1a3870', // dark blue
    // Skin
    S: '#e8c8a0', // skin light
    s: '#c0a070', // skin shadow
    // Sword
    W: '#e8eef8', // blade highlight
    w: '#b0b8c8', // blade body
    // Brown leather
    L: '#8a6840', // boot/belt
    l: '#5a4428', // dark leather
    // Eyes
    E: '#182030', // dark eye
    // Hair
    H: '#c8a860', // hair
  },
  pixels: [
    '......cCCc......',
    '.....cCCCCc.....',
    '....bBaAaBb.....',
    '....BaSESaB.....',
    '.....sHSHs......',
    '....YgGaGgY.....',
    '...bBaAaAaBb....',
    '..Ww.aAAAAa.Cc..',
    '..Ww.BaGaBB.cc..',
    '...w.bBaBBb.Uc..',
    '.....BaLaBB.....',
    '....bBa.aBb.....',
    '....Ba...aB.....',
    '....lL...Ll.....',
    '....lL...Ll.....',
    '................',
  ],
};

const WIZARD: SpriteDefinition = {
  palette: {
    // Purple robes (4 shades)
    P: '#9966ee', // bright purple
    p: '#6644bb', // mid purple
    Q: '#442288', // dark purple
    q: '#2a1460', // deepest purple shadow
    // Hat
    H: '#7755cc', // hat mid
    h: '#5533aa', // hat dark
    J: '#3a2280', // hat darkest
    // Gold/arcane trim
    G: '#f0d060', // gold bright
    g: '#c4a030', // gold mid
    // Skin
    S: '#e8c8a0', // skin
    s: '#c0a070', // skin shadow
    // Beard
    W: '#e8e0e8', // white beard
    w: '#c0b8c0', // gray beard
    // Orb glow (3 shades)
    O: '#88ffff', // bright orb
    o: '#44ddee', // mid orb
    V: '#2299aa', // dark orb
    // Staff wood
    T: '#a07840', // wood light
    t: '#6a5030', // wood dark
    // Eyes
    E: '#182030',
  },
  pixels: [
    '.......H........',
    '......HhH.......',
    '.....HhhhH......',
    '....JhHHHhJ.....',
    '....JhHHHhJ.....',
    '.....sSESs......',
    '.....sWwWs......',
    '......gPg.......',
    '..Oo.pPPPp......',
    '..Vt.QPGPQ......',
    '..tT.qPPPq......',
    '....qQPPPQq.....',
    '....qqPPPqq.....',
    '.....qp.pq......',
    '.....qp.pq......',
    '................',
  ],
};

const ROGUE: SpriteDefinition = {
  palette: {
    // Dark leather/cloak (4 shades)
    D: '#686878', // cloak highlight
    d: '#484858', // cloak mid
    F: '#303040', // cloak dark
    f: '#1e1e2a', // cloak deepest
    // Skin
    S: '#e0c098', // skin
    s: '#b89868', // skin shadow
    // Daggers
    K: '#d0d8e0', // blade bright
    k: '#a0a8b0', // blade dim
    // Green accent
    G: '#55aa66', // green bright
    g: '#337744', // green dark
    // Red scarf
    R: '#cc4444', // red bright
    r: '#8a2828', // red dark
    // Belt
    B: '#3a3030', // belt
    // Leather boots
    L: '#6a5038', // boot
    l: '#443020', // boot dark
    // Eyes
    E: '#182030',
    // Hood shadow
    H: '#252530',
  },
  pixels: [
    '................',
    '......fFf.......',
    '.....FdDdF......',
    '....FdDDDdF.....',
    '....HsSESsH.....',
    '.....sRrRs......',
    '.....dDDDd......',
    '..Kk.DDDDD......',
    '..kK.dDgDd.Kk...',
    '.....FdBdF......',
    '....fdD.Ddf.....',
    '....fDL.LDf.....',
    '.....dL.Ld......',
    '.....lL.Ll......',
    '.....ll.ll......',
    '................',
  ],
};

const CLERIC: SpriteDefinition = {
  palette: {
    // White/cream robes (4 shades)
    W: '#f0e8d8', // bright white
    w: '#d0c8b8', // mid cream
    X: '#b0a898', // dark cream
    x: '#888078', // deepest shadow
    // Red tabard (3 shades)
    R: '#dd4444', // red bright
    r: '#aa2828', // red mid
    Q: '#701818', // red dark
    // Gold holy symbol
    G: '#f0d060', // gold bright
    g: '#c4a030', // gold mid
    Y: '#8a7020', // gold dark
    // Skin
    S: '#e8c8a0', // skin
    s: '#c0a070', // skin shadow
    // Mace
    M: '#c0c0c8', // mace head bright
    m: '#808088', // mace head dark
    T: '#8a6a40', // handle
    // Hair
    H: '#a07848', // brown hair
    // Eyes
    E: '#182030',
    // Armor boots
    A: '#909098', // gray armor
  },
  pixels: [
    '................',
    '.....GgGgG......',
    '.....HHHHH......',
    '....xwWWWwx.....',
    '....xsSESsx.....',
    '.....sSSSs......',
    '......GWG.......',
    '..Mm.wRrRw......',
    '..mT.WRrRW......',
    '..T..XRgRX......',
    '....xWRrRWx.....',
    '....xXWWWXx.....',
    '.....xw.wx......',
    '.....AA.AA......',
    '.....AA.AA......',
    '................',
  ],
};

// ── Monster Sprites ──────────────────────────────────────────

const GOBLIN: SpriteDefinition = {
  palette: {
    // Green skin (4 shades)
    G: '#77cc66', // bright green
    g: '#55aa44', // mid green
    N: '#338822', // dark green
    n: '#1a5510', // deepest green
    // Eyes
    E: '#ff4444', // red eyes
    e: '#cc2222', // red dark
    // Teeth
    T: '#ffffcc', // bright teeth
    // Weapon
    W: '#b0b0b0', // weapon bright
    w: '#787878', // weapon dark
    // Leather armor
    L: '#8a6a40', // leather bright
    l: '#5a4428', // leather dark
    // Ears
    R: '#66bb55', // ear color
    // Nose
    O: '#449933', // nose
    // Loincloth
    C: '#664422', // cloth
  },
  pixels: [
    '................',
    '................',
    '...R.....R......',
    '...RnNGNnR......',
    '....gGEEGg......',
    '....GGOGG.......',
    '....NgTgN.......',
    '.....gGg........',
    '..Ww.lLl........',
    '..wW.gGGg.......',
    '.....NlLN.......',
    '.....NgCgN......',
    '.....Ng.gN......',
    '.....nC.Cn......',
    '................',
    '................',
  ],
};

const SKELETON: SpriteDefinition = {
  palette: {
    // Bone (4 shades)
    B: '#f0e8d8', // bright bone
    b: '#d0c8b0', // mid bone
    C: '#a09880', // dark bone
    c: '#706858', // deepest bone shadow
    // Green glow eyes
    E: '#66ff66', // bright glow
    e: '#44cc44', // glow edge
    // Dark void (ribs, mouth)
    D: '#0a0a0a', // void
    // Weapon
    W: '#c0c8d0', // blade bright
    w: '#8890a0', // blade dark
    // Shield/armor scraps
    R: '#887060', // rusted metal
    // Rib detail
    V: '#c8c0a8', // rib mid
  },
  pixels: [
    '................',
    '.....cBBBc......',
    '....cBBBBBc.....',
    '....CBEDEBB.....',
    '....cBBBBBc.....',
    '.....cbBbc......',
    '....cVBDBVc.....',
    '..Ww.VBDBV......',
    '..wW.cBDBc......',
    '.....cbBbc......',
    '......bBb.......',
    '.....cB.Bc......',
    '.....c...c......',
    '.....c...c......',
    '.....c...c......',
    '................',
  ],
};

const WOLF: SpriteDefinition = {
  palette: {
    // Gray fur (4 shades)
    F: '#b0b0b0', // bright fur
    f: '#888888', // mid fur
    G: '#606060', // dark fur
    g: '#404040', // deepest fur
    // White belly/chest
    W: '#d8d8d8', // white bright
    w: '#b8b8b8', // white dim
    // Eyes
    E: '#ffbb00', // amber eye
    // Nose
    N: '#1a1a1a', // nose
    // Teeth
    T: '#f0f0f0', // teeth
    // Tail
    A: '#909090', // tail mid
    a: '#707070', // tail dark
    // Paws
    P: '#787878', // paw
    // Inner ear
    R: '#cc8888', // ear pink
  },
  pixels: [
    '................',
    '................',
    '................',
    '....gR..Rg......',
    '...gFFf.fFFa....',
    '...FEFN.FEFAa...',
    '...FFTTTTFF.a...',
    '....FFFFFf..A...',
    '...fWWWWWfA.....',
    '...GFFFFFfGA....',
    '...G.Ff.Fg.a....',
    '...g.Pf.Pg......',
    '...g.Pg.Pg......',
    '................',
    '................',
    '................',
  ],
};

const BANDIT: SpriteDefinition = {
  palette: {
    // Leather (4 shades)
    L: '#9a7a50', // leather bright
    l: '#7a5a38', // leather mid
    M: '#5a3a20', // leather dark
    m: '#3a2410', // leather deepest
    // Skin
    S: '#e0c098', // skin
    s: '#b89868', // skin shadow
    // Red bandana
    R: '#cc3333', // red bright
    r: '#882222', // red dark
    // Mask
    K: '#2a2a2a', // mask dark
    // Weapon
    W: '#b0b0b0', // weapon bright
    w: '#787878', // weapon dark
    // Belt/gold
    G: '#d4aa3c', // gold buckle
    B: '#3a3030', // belt
    // Hair
    H: '#5a4030', // hair
    // Eyes
    E: '#182030',
    // Boots
    T: '#4a3420', // boot
  },
  pixels: [
    '................',
    '.....rRRr.......',
    '....rRHHRr......',
    '....rHHHHr......',
    '.....sKESs......',
    '......sSs.......',
    '.....lLBLl......',
    '..Ww.LLLLL......',
    '..wW.lLGLl......',
    '.....MLLLM......',
    '....mLLLLLm.....',
    '....mLl.lLm.....',
    '.....Ml.lM......',
    '.....TT.TT......',
    '.....TT.TT......',
    '................',
  ],
};

const GIANT_SPIDER: SpriteDefinition = {
  palette: {
    // Body (4 shades)
    B: '#6a5878', // body bright
    b: '#4a3858', // body mid
    C: '#2a1838', // body dark
    c: '#180e28', // body deepest
    // Eyes (red cluster)
    E: '#ff3333', // red eye
    e: '#cc1111', // dark eye
    // Legs
    L: '#3a2848', // leg dark
    l: '#5a4868', // leg bright
    // Fang/web
    W: '#d0c8e0', // fang bright
    w: '#a098b0', // fang dim
    // Venom
    V: '#88ff44', // venom glow
    // Pattern markings
    P: '#7a6888', // pattern bright
    p: '#5a4868', // pattern dim
    // Abdomen
    A: '#5a4068', // abdomen
    a: '#3a2848', // abdomen dark
  },
  pixels: [
    '................',
    '..L.l....l.L....',
    '..Ll.l..l.lL....',
    '.L..lBBBBl..L...',
    '..l.BEeeBB.l....',
    '..L.bWBBWb.L....',
    '.L..bBPPBb..L...',
    '....CBBBBBC.....',
    '.L..CaAAAAC.L...',
    '..L.caAPAac.L...',
    '..l..aAAAA..l...',
    '.L...cAAc...L...',
    '..L...cc...L....',
    '................',
    '................',
    '................',
  ],
};

const OGRE: SpriteDefinition = {
  palette: {
    // Skin (4 shades)
    S: '#d0b888', // skin bright
    s: '#b09868', // skin mid
    N: '#907850', // skin dark
    n: '#706038', // skin deepest
    // Eyes
    E: '#aa5522', // brown eye
    // Teeth/tusks
    T: '#f0f0d0', // tusk bright
    t: '#d0d0a0', // tusk dim
    // Leather loincloth
    L: '#6a5030', // leather
    l: '#4a3420', // leather dark
    // Club
    C: '#a08050', // club bright
    c: '#706040', // club dark
    D: '#504030', // club darkest
    // Hair
    H: '#5a4430', // hair
    h: '#3a2a1a', // hair dark
    // Navel/features
    O: '#8a7048', // navel shadow
    // Belly
    B: '#c0a878', // belly lighter
  },
  pixels: [
    '................',
    '....hHHHHh......',
    '...nSSSSSn......',
    '...SSENESS......',
    '...SSNtNSS......',
    '....STtTTS......',
    '...nSSSSSSn.....',
    '..CnSBBBBSn....',
    '..cDSSBOBSSn....',
    '..D.nSLLSn......',
    '....NSLLSN......',
    '....NSS.SSN.....',
    '...nSS..SSn.....',
    '...nn...nn......',
    '...nn...nn......',
    '................',
  ],
};

const OWLBEAR: SpriteDefinition = {
  palette: {
    // Brown body (4 shades)
    B: '#b08855', // body bright
    b: '#8a6a40', // body mid
    C: '#6a4a28', // body dark
    c: '#4a3018', // body deepest
    // Feathers/face (owl part)
    F: '#e0d0b0', // feather bright
    f: '#c0b090', // feather mid
    G: '#a09070', // feather dark
    // Eyes
    E: '#ffbb00', // amber eye
    // Beak
    K: '#444444', // beak dark
    k: '#666666', // beak mid
    // Claws
    W: '#888888', // claw
    // White chest
    X: '#f0e8d0', // white bright
    x: '#d8d0b8', // white dim
    // Horns/ear tufts
    H: '#c8b888', // tuft
  },
  pixels: [
    '................',
    '...H.GfG.H......',
    '...GfFFFfG......',
    '...FFFEFEF......',
    '....fFKKFf......',
    '....GfFFfG......',
    '...cBBBBBBc.....',
    '..c.BXxxXB.c....',
    '..W.BXxxXB.W....',
    '....bBBBBBb.....',
    '...cBBBBBBc.....',
    '....bBB.BBb.....',
    '....cBB.BBc.....',
    '....WW..WW......',
    '................',
    '................',
  ],
};

const TROLL: SpriteDefinition = {
  palette: {
    // Green skin (4 shades)
    G: '#88bb55', // bright green
    g: '#668844', // mid green
    N: '#446633', // dark green
    n: '#2a4420', // deepest green
    // Lighter green highlights
    S: '#aadd77', // highlight
    // Eyes
    E: '#ffcc00', // yellow eye
    // Teeth
    T: '#ddeeaa', // teeth
    // Claws
    C: '#556633', // claw dark
    c: '#778855', // claw bright
    // Moss/hair
    H: '#557733', // moss hair
    h: '#335522', // dark moss
    // Loincloth
    L: '#5a5030', // cloth
    l: '#3a3420', // cloth dark
    // Warts
    W: '#779955', // wart
    // Nose
    O: '#558833', // nose
  },
  pixels: [
    '.....hHHh.......',
    '....hGGGGh......',
    '...nGGSGGGn.....',
    '...NGENESS......',
    '...NGGOGGG......',
    '....GGTGg.......',
    '...nGGGGGn......',
    '..cc.GGGGg.cc...',
    '..cC.gGLGg.Cc...',
    '..C..NGGGgN.....',
    '.....NGWGN......',
    '.....Ng.gN......',
    '.....ng.gn......',
    '.....ng.gn......',
    '.....CC.CC......',
    '................',
  ],
};

const GIANT_RAT: SpriteDefinition = {
  palette: {
    // Brown fur (4 shades)
    F: '#aa8868', // fur bright
    f: '#887050', // fur mid
    G: '#665838', // fur dark
    g: '#443820', // fur deepest
    // Eyes
    E: '#ff4444', // red eye
    // Nose
    N: '#332222', // nose
    // Teeth
    T: '#eeddcc', // teeth
    // Whiskers
    W: '#ccbbaa', // whisker
    // Belly
    B: '#ccaa88', // belly bright
    b: '#aa8868', // belly dim
    // Tail
    L: '#887060', // tail bright
    l: '#665848', // tail mid
    K: '#444038', // tail dark
    // Paws
    P: '#776858', // paw
    // Ears
    R: '#cc9988', // ear pink
  },
  pixels: [
    '................',
    '................',
    '................',
    '................',
    '....gR..Rg......',
    '...gFFf.fFFl....',
    '...FEFN.FEF.l...',
    '..WFFTTTTFF..l..',
    '....fBBBBfL.....',
    '...GFFFFFfGK....',
    '...G.Pf.PgK.....',
    '...g.Pf.Pg.K....',
    '............K...',
    '................',
    '................',
    '................',
  ],
};

const KOBOLD: SpriteDefinition = {
  palette: {
    // Red-brown scales (4 shades)
    R: '#cc7744', // scales bright
    r: '#aa5533', // scales mid
    N: '#884422', // scales dark
    n: '#663318', // scales deepest
    // Yellow eyes
    E: '#ffdd00', // eye
    // Lighter scales (belly)
    S: '#ddaa66', // belly bright
    s: '#bb8844', // belly dim
    // Spear
    W: '#c0c0c0', // spear tip
    w: '#888888', // spear dark
    T: '#8a6a40', // shaft
    t: '#6a5030', // shaft dark
    // Horn/crest
    H: '#aa6633', // horn
    h: '#884422', // horn dark
    // Tail
    A: '#996633', // tail
    a: '#774422', // tail dark
    // Leather
    L: '#665530', // leather
  },
  pixels: [
    '................',
    '................',
    '.....hHh........',
    '....nRRRn.......',
    '....rRESRr......',
    '.....rRRr.......',
    '......r.........',
    '.....rRRr.......',
    '..Ww.rLRr.......',
    '..tT.NRSRNa.....',
    '..t..nRRrn.a....',
    '.....nr.rn..a...',
    '.....n..n..a....',
    '.....n..n.a.....',
    '..........a.....',
    '................',
  ],
};

const ZOMBIE: SpriteDefinition = {
  palette: {
    // Green-gray skin (4 shades)
    Z: '#8aaa7a', // skin bright
    z: '#6a8a5a', // skin mid
    N: '#4a6a3a', // skin dark
    n: '#2a4a20', // skin deepest
    // Red wounds
    R: '#aa4444', // wound bright
    r: '#773333', // wound dark
    // Tattered clothes (4 shades)
    C: '#7a7a70', // cloth bright
    c: '#5a5a50', // cloth mid
    D: '#3a3a30', // cloth dark
    d: '#2a2a20', // cloth deepest
    // Glowing eyes
    E: '#ccff44', // eye glow
    // Exposed bone
    B: '#d0c8b0', // bone
    // Blood
    V: '#663030', // dried blood
    // Skin highlight
    S: '#9aaa8a', // lighter skin
  },
  pixels: [
    '................',
    '.....nzzn.......',
    '....nZZZZn......',
    '....ZERZEZ......',
    '.....ZSRZz......',
    '.....CzZC.......',
    '....cCCCCc......',
    '...ZcCCCCcZ.....',
    '...z.CRVCc.....',
    '.....CCBCC......',
    '....dCCCCCd.....',
    '....dCc.cCd.....',
    '.....dc.cd......',
    '.....nz.zn......',
    '.....nz.zn......',
    '................',
  ],
};

const STIRGE: SpriteDefinition = {
  palette: {
    // Body (4 shades)
    B: '#8a5555', // body bright
    b: '#6a3838', // body mid
    C: '#4a2020', // body dark
    c: '#301010', // body deepest
    // Wings (3 shades)
    W: '#aa7777', // wing bright
    w: '#886060', // wing mid
    V: '#664848', // wing dark
    // Eyes
    E: '#ff4444', // red eye
    // Proboscis
    P: '#aa5555', // proboscis bright
    p: '#884444', // proboscis mid
    Q: '#663333', // proboscis dark
    // Legs
    L: '#553333', // leg
    // Veins on wings
    R: '#996666', // wing vein
  },
  pixels: [
    '................',
    '................',
    '................',
    '.wWR....RWw.....',
    '..WWw.bb.WWw....',
    '..VWwBEEBwWV....',
    '...VwBBBBwV.....',
    '....bBBBBb......',
    '....cBBBBc......',
    '...L.cPPc.L.....',
    '.....pPPp.......',
    '......Qp........',
    '......Q.........',
    '................',
    '................',
    '................',
  ],
};

// ── Sprite Registry ──────────────────────────────────────────

const SPRITE_REGISTRY: Record<string, SpriteDefinition> = {
  // Player classes
  fighter:          FIGHTER,
  wizard:           WIZARD,
  rogue:            ROGUE,
  cleric:           CLERIC,
  // Monsters
  monster_goblin:       GOBLIN,
  monster_skeleton:     SKELETON,
  monster_wolf:         WOLF,
  monster_bandit:       BANDIT,
  monster_giant_spider: GIANT_SPIDER,
  monster_ogre:         OGRE,
  monster_owlbear:      OWLBEAR,
  monster_troll:        TROLL,
  monster_giant_rat:    GIANT_RAT,
  monster_kobold:       KOBOLD,
  monster_zombie:       ZOMBIE,
  monster_stirge:       STIRGE,
};

// ── Sprite Renderer ──────────────────────────────────────────

/** Parse hex color to RGBA bytes. */
function hexToRGBA(hex: string): [number, number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b, 255];
}

/** Outline color — dark but visible on the #0a0a0a cell background. */
const OUTLINE_COLOR: [number, number, number, number] = [22, 22, 38, 255];

/**
 * Auto-generate 1px outline around all opaque pixels.
 * Checks 8 neighbors (cardinal + diagonal) for each transparent pixel.
 * If any neighbor is opaque, that transparent pixel becomes an outline pixel.
 */
function applyAutoOutline(data: Uint8ClampedArray, w: number, h: number): void {
  // First pass: collect outline positions
  const outlinePositions: number[] = [];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      // Only process transparent pixels
      if (data[idx + 3] > 0) continue;

      // Check 8 neighbors
      let hasOpaqueNeighbor = false;
      for (let dy = -1; dy <= 1 && !hasOpaqueNeighbor; dy++) {
        for (let dx = -1; dx <= 1 && !hasOpaqueNeighbor; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          const nIdx = (ny * w + nx) * 4;
          if (data[nIdx + 3] > 0) {
            hasOpaqueNeighbor = true;
          }
        }
      }

      if (hasOpaqueNeighbor) {
        outlinePositions.push(idx);
      }
    }
  }

  // Second pass: apply outline color
  for (const idx of outlinePositions) {
    data[idx] = OUTLINE_COLOR[0];
    data[idx + 1] = OUTLINE_COLOR[1];
    data[idx + 2] = OUTLINE_COLOR[2];
    data[idx + 3] = OUTLINE_COLOR[3];
  }
}

class SpriteRenderer {
  private cache = new Map<string, HTMLCanvasElement>();

  /** Check if a sprite exists for the given ID. */
  has(id: string): boolean {
    return id in SPRITE_REGISTRY;
  }

  /** Get or create the cached 16×16 canvas for a sprite (with auto-outline). */
  private getSpriteCanvas(id: string): HTMLCanvasElement | null {
    if (this.cache.has(id)) return this.cache.get(id)!;

    const def = SPRITE_REGISTRY[id];
    if (!def) return null;

    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.createImageData(16, 16);
    const data = imageData.data;

    // Render sprite pixels
    for (let y = 0; y < 16; y++) {
      const row = def.pixels[y] ?? '';
      for (let x = 0; x < 16; x++) {
        const ch = row[x];
        if (!ch || ch === '.') continue;
        const color = def.palette[ch];
        if (!color) continue;
        const [r, g, b, a] = hexToRGBA(color);
        const idx = (y * 16 + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = a;
      }
    }

    // Auto-generate outline
    applyAutoOutline(data, 16, 16);

    ctx.putImageData(imageData, 0, 0);
    this.cache.set(id, canvas);
    return canvas;
  }

  /**
   * Draw a sprite onto a canvas context, scaled to fill the target rect.
   * Uses nearest-neighbor interpolation for crisp pixel art.
   */
  renderSprite(
    ctx: CanvasRenderingContext2D,
    id: string,
    x: number,
    y: number,
    w: number,
    h: number,
  ): boolean {
    const src = this.getSpriteCanvas(id);
    if (!src) return false;

    const prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, x, y, w, h);
    ctx.imageSmoothingEnabled = prev;
    return true;
  }

  /**
   * Draw a shadow ellipse beneath an entity.
   * Call before renderSprite for correct layering.
   */
  renderShadow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    const cx = x + w / 2;
    const cy = y + h - 2;
    const rx = w * 0.35;
    const ry = h * 0.12;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Create a standalone mini-canvas element for use in DOM (e.g. initiative bar).
   * Returns a canvas element sized to displaySize × displaySize with crisp pixel art.
   */
  createMiniCanvas(id: string, displaySize: number): HTMLCanvasElement | null {
    const src = this.getSpriteCanvas(id);
    if (!src) return null;

    const dpr = window.devicePixelRatio || 1;
    const canvas = document.createElement('canvas');
    canvas.width = displaySize * dpr;
    canvas.height = displaySize * dpr;
    canvas.style.width = `${displaySize}px`;
    canvas.style.height = `${displaySize}px`;
    canvas.style.imageRendering = 'pixelated';

    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  /** Clear the cache (e.g. on theme change). */
  clearCache(): void {
    this.cache.clear();
  }
}

/** Singleton sprite renderer. */
export const spriteRenderer = new SpriteRenderer();

/** Animation tick — returns a Y pixel offset for idle breathing bob. */
export function getSpriteAnimOffset(): number {
  // 2-second cycle, ±1px bob
  const t = (Date.now() % 2000) / 2000;
  return Math.sin(t * Math.PI * 2) * 1;
}
