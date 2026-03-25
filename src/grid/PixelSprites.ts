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
    // Steel armor (4 shades — top-left lit)
    A: '#dce4f0', // steel highlight (top-left faces)
    a: '#a8b8cc', // steel mid-light
    B: '#7888a0', // steel mid-shadow
    b: '#4c5868', // steel deep shadow (bottom-right faces)
    // Gold trim (3 shades)
    G: '#f8d868', // gold highlight
    g: '#c8a838', // gold mid
    Y: '#907828', // gold shadow
    // Blue cape (3 shades)
    C: '#58a0e8', // cape highlight
    c: '#3070b8', // cape mid
    U: '#1c4878', // cape deep
    // Skin (2 shades)
    S: '#f0d0a8', // skin lit
    s: '#c8a070', // skin shadow
    // Sword blade (2 shades)
    W: '#f0f4ff', // blade edge highlight
    w: '#c0ccdc', // blade flat
    // Leather (2 shades)
    L: '#988058', // boot lit
    l: '#604830', // boot shadow
    // Eyes
    E: '#1c2838', // dark eye
    // Hair
    H: '#d0b068', // sandy hair
  },
  pixels: [
    '.....ccCCcc.....',
    '....cCCCCCCc....',
    '....bBAAaABb....',
    '....BAASEsAb....',
    '.....sHSHSs.....',
    '....YgGGGGgY....',
    '...bBAAaAAaBb...',
    '.WwbBAAAAaaBCc..',
    '.Ww.BAGGAaBbcc..',
    '..w.bBaAaBb.Uc..',
    '.....BAaABb.....',
    '....bBA.ABb.....',
    '....bBa..ab.....',
    '....lL...Ll.....',
    '....lL...Ll.....',
    '................',
  ],
};

const WIZARD: SpriteDefinition = {
  palette: {
    // Purple robes (4 shades — deep, saturated)
    P: '#aa77ff', // robe highlight
    p: '#7744cc', // robe mid
    Q: '#4c2299', // robe shadow
    q: '#2e1468', // robe deepest
    // Hat (3 shades)
    H: '#8866dd', // hat highlight
    h: '#5544aa', // hat mid
    J: '#382280', // hat dark
    // Gold arcane trim (2 shades)
    G: '#f8d868', // gold bright
    g: '#c8a838', // gold mid
    // Skin (2 shades)
    S: '#f0d0a8', // skin lit
    s: '#c8a070', // skin shadow
    // White beard (2 shades)
    W: '#f0e8f0', // beard bright
    w: '#c8c0cc', // beard shadow
    // Arcane orb (3 shades — cyan glow)
    O: '#88ffff', // orb core
    o: '#44ddee', // orb mid
    V: '#2299aa', // orb edge
    // Staff (2 shades)
    T: '#a88050', // wood lit
    t: '#6a5038', // wood shadow
    // Eyes
    E: '#1c2838', // dark eye
  },
  pixels: [
    '......HHH.......',
    '.....HhhhH......',
    '....JhHHHhJ.....',
    '....JhhHhhJ.....',
    '...JJhGGhJJ....',
    '.....sSESs......',
    '.....sWWWs......',
    '.....gPPPg......',
    '..Oo.PPPPPp.....',
    '..Vt.pPGPPp.....',
    '..tT.QPPPPQq....',
    '...T.qPPPPq.....',
    '....qQPPPPQq....',
    '.....qpp.ppq....',
    '.....qp...pq....',
    '................',
  ],
};

const ROGUE: SpriteDefinition = {
  palette: {
    // Dark cloak (4 shades)
    D: '#707888', // cloak highlight
    d: '#505868', // cloak mid
    F: '#343848', // cloak dark
    f: '#202430', // cloak deepest
    // Skin (2 shades)
    S: '#e8c8a0', // skin lit
    s: '#b89868', // skin shadow
    // Dagger blades (2 shades)
    K: '#d8e0ec', // blade highlight
    k: '#a0a8b8', // blade shadow
    // Green poison vials (2 shades)
    G: '#58c070', // green bright
    g: '#388848', // green dark
    // Red scarf (2 shades)
    R: '#d84848', // red bright
    r: '#982828', // red dark
    // Belt
    B: '#3c3030', // dark belt
    // Leather boots (2 shades)
    L: '#786048', // boot lit
    l: '#483828', // boot shadow
    // Eyes
    E: '#1c2838', // dark eye
    // Hood shadow
    H: '#282830', // deep hood shadow
  },
  pixels: [
    '................',
    '.....ffFff......',
    '....FddDddF.....',
    '....FdDDDdF.....',
    '...HHsSESsHH....',
    '.....sRrRRs.....',
    '....fdDDDDdf....',
    '.Kk.dDDDDDd.....',
    '.kK.dDDgDDd.Kk..',
    '....FdDBDdF.kK..',
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
    W: '#f4ecd8', // robe highlight
    w: '#d8d0c0', // robe mid-light
    X: '#b8b0a0', // robe shadow
    x: '#908878', // robe deepest
    // Red tabard (3 shades)
    R: '#e04848', // red highlight
    r: '#b82828', // red mid
    Q: '#781818', // red deep
    // Gold holy symbol (3 shades)
    G: '#f8d868', // gold highlight
    g: '#c8a838', // gold mid
    Y: '#907828', // gold shadow
    // Skin (2 shades)
    S: '#f0d0a8', // skin lit
    s: '#c8a070', // skin shadow
    // Mace (2 shades + handle)
    M: '#c8c8d0', // mace head bright
    m: '#8888a0', // mace head shadow
    T: '#907048', // handle wood
    // Hair
    H: '#a88050', // warm brown hair
    // Eyes
    E: '#1c2838', // dark eye
    // Armor boots (2 shades)
    A: '#a0a0a8', // boot armor lit
    a: '#686878', // boot armor shadow
  },
  pixels: [
    '................',
    '.....GgYgG......',
    '....xHHHHHx.....',
    '....xwWWWwx.....',
    '....xsSESsx.....',
    '.....sSSSs......',
    '.....gGWGg......',
    '..Mm.wRRrRw.....',
    '..mT.WRRrRWx....',
    '..T..XRgRRXx....',
    '....xWRrRRWx....',
    '....xXWWWWXx....',
    '.....xww.wwx....',
    '.....Aa..aA.....',
    '.....Aa..aA.....',
    '................',
  ],
};

// ── Monster Sprites ──────────────────────────────────────────

const GOBLIN: SpriteDefinition = {
  palette: {
    // Green skin (4 shades)
    G: '#80d870', // skin highlight
    g: '#58b848', // skin mid
    N: '#389030', // skin shadow
    n: '#206818', // skin deepest
    // Eyes (2 shades)
    E: '#ff4848', // eye bright
    e: '#cc2828', // eye dark
    // Teeth
    T: '#ffffd0', // teeth
    // Weapon (2 shades)
    W: '#b8b8b8', // blade bright
    w: '#808080', // blade dark
    // Leather (2 shades)
    L: '#988858', // leather lit
    l: '#604830', // leather shadow
    // Ears
    R: '#70cc60', // ear inner
    // Nose
    O: '#48a838', // nose bridge
    // Loincloth
    C: '#704828', // cloth
  },
  pixels: [
    '................',
    '................',
    '..Rr.....rR.....',
    '..RrnNGGNnrR....',
    '....gGEeEGg.....',
    '....GGOOGGg.....',
    '....NgTTgNg.....',
    '.....gGGg.......',
    '..Ww.lLLLl......',
    '..wW.gGGGGg.....',
    '.....NlLLlN.....',
    '.....NgCCgN.....',
    '.....Ng..gN.....',
    '.....nC..Cn.....',
    '................',
    '................',
  ],
};

const SKELETON: SpriteDefinition = {
  palette: {
    // Bone (4 shades)
    B: '#f0e8d8', // bone highlight
    b: '#d0c8b0', // bone mid
    C: '#a89880', // bone shadow
    c: '#786858', // bone deepest
    // Green glow eyes
    E: '#68ff68', // eye glow bright
    e: '#48cc48', // eye glow dim
    // Dark void
    D: '#101010', // void/gaps
    // Weapon (2 shades)
    W: '#c8d0d8', // blade highlight
    w: '#8890a0', // blade shadow
    // Rusty scraps
    R: '#907060', // rust
    // Rib texture
    V: '#d0c8b0', // rib detail
  },
  pixels: [
    '................',
    '....ccBBBcc.....',
    '....cBBBBBc.....',
    '....CBEDEBc.....',
    '....cBBDBBc.....',
    '.....cBBBc......',
    '....cVBDBVc.....',
    '..Ww.VBDBVc....',
    '..wW.cBDBc......',
    '.....cBBBc......',
    '......bBb.......',
    '.....cB.Bc......',
    '.....cb.bc......',
    '.....c...c......',
    '.....c...c......',
    '................',
  ],
};

const WOLF: SpriteDefinition = {
  palette: {
    // Gray fur (4 shades)
    F: '#b8b8b8', // fur highlight
    f: '#909090', // fur mid
    G: '#686868', // fur shadow
    g: '#484848', // fur deepest
    // White belly (2 shades)
    W: '#e0e0e0', // belly bright
    w: '#c0c0c0', // belly dim
    // Eyes
    E: '#ffc800', // amber eye
    // Nose
    N: '#1c1c1c', // nose black
    // Teeth
    T: '#f8f8f8', // teeth white
    // Tail (2 shades)
    A: '#989898', // tail lit
    a: '#707070', // tail shadow
    // Paws
    P: '#808080', // paw
    // Inner ear
    R: '#d09090', // ear pink
  },
  pixels: [
    '................',
    '................',
    '................',
    '....gR..Rg......',
    '...gFFfffFFa....',
    '...FEFNNFEFAa...',
    '...FFTTTTFF.Aa..',
    '....FFFFFFf..A..',
    '...fWWWWWWfA....',
    '...GFFFFFFFGa...',
    '...G.Fff.Fg.a...',
    '...g.Pff.Pg.....',
    '...g.Pg..Pg.....',
    '................',
    '................',
    '................',
  ],
};

const BANDIT: SpriteDefinition = {
  palette: {
    // Leather (4 shades)
    L: '#a88858', // leather highlight
    l: '#887048', // leather mid
    M: '#604028', // leather shadow
    m: '#402818', // leather deepest
    // Skin (2 shades)
    S: '#e8c8a0', // skin lit
    s: '#c0a070', // skin shadow
    // Red bandana (2 shades)
    R: '#d83838', // red highlight
    r: '#982828', // red shadow
    // Mask
    K: '#303030', // mask dark
    // Weapon (2 shades)
    W: '#b8b8b8', // blade highlight
    w: '#808080', // blade shadow
    // Gold buckle
    G: '#d8b040', // gold
    // Belt
    B: '#3c3030', // belt
    // Hair
    H: '#604838', // dark hair
    // Eyes
    E: '#1c2838', // dark eye
    // Boots
    T: '#503828', // boot dark
  },
  pixels: [
    '................',
    '.....rRRRr......',
    '....rRHHHRr.....',
    '....rHHHHHr.....',
    '.....sKKESs.....',
    '......sSSs......',
    '....llLBLll.....',
    '..Ww.LLLLLL.....',
    '..wW.lLGLLl.....',
    '.....MLLLLM.....',
    '....mLLLLLLm....',
    '....mLll.lLm....',
    '.....Mll.lM.....',
    '.....TT..TT.....',
    '.....TT..TT.....',
    '................',
  ],
};

const GIANT_SPIDER: SpriteDefinition = {
  palette: {
    // Body (4 shades)
    B: '#786890', // body highlight
    b: '#584870', // body mid
    C: '#382050', // body shadow
    c: '#201038', // body deepest
    // Eyes (red cluster)
    E: '#ff3838', // eye bright
    e: '#cc1818', // eye dim
    // Legs (2 shades)
    L: '#403050', // leg shadow
    l: '#604878', // leg highlight
    // Fangs (2 shades)
    W: '#d8d0e8', // fang bright
    w: '#a898c0', // fang dim
    // Venom
    V: '#90ff48', // venom glow
    // Pattern markings (2 shades)
    P: '#887098', // pattern bright
    p: '#604878', // pattern dim
    // Abdomen (2 shades)
    A: '#604878', // abdomen lit
    a: '#402858', // abdomen dark
  },
  pixels: [
    '................',
    '.L.ll....ll.L...',
    '..Ll.l..l.lL....',
    '.L..lBBBBBl.L...',
    '..l.BEeeBBb.l...',
    '..L.bWBBBWb.L...',
    '.L..bBPPPBb..L..',
    '....CBBBBBBc....',
    '.L..CaAAAAACL...',
    '..L.caAPPAac.L..',
    '..l..aAAAAa..l..',
    '.L...cAAAAc..L..',
    '..L...cccc..L...',
    '................',
    '................',
    '................',
  ],
};

const OGRE: SpriteDefinition = {
  palette: {
    // Skin (4 shades)
    S: '#d8c090', // skin highlight
    s: '#b8a070', // skin mid
    N: '#988058', // skin shadow
    n: '#786040', // skin deepest
    // Eyes
    E: '#b85828', // brown eye
    // Tusks (2 shades)
    T: '#f0f0d8', // tusk bright
    t: '#d0d0a8', // tusk dim
    // Leather (2 shades)
    L: '#785838', // leather lit
    l: '#503828', // leather dark
    // Club (3 shades)
    C: '#a88858', // club highlight
    c: '#786848', // club mid
    D: '#585038', // club dark
    // Hair (2 shades)
    H: '#604838', // hair
    h: '#382818', // hair dark
    // Belly detail
    O: '#907850', // navel
    // Belly highlight
    B: '#c8b080', // belly lighter
  },
  pixels: [
    '................',
    '...hhHHHHhh.....',
    '...nSSSSSSn.....',
    '...SSENNESs.....',
    '...SSNtTNSSs....',
    '....STtTTSs.....',
    '...nSSSSSSSn....',
    '..CnSBBBBBSn....',
    '..cDSSBOBBSSn...',
    '..D.nSLLLSn.....',
    '....NSLLLSNn....',
    '....NSS..SSN....',
    '...nSS...SSn....',
    '...nn....nn.....',
    '...nn....nn.....',
    '................',
  ],
};

const OWLBEAR: SpriteDefinition = {
  palette: {
    // Brown body (4 shades)
    B: '#b89058', // body highlight
    b: '#907048', // body mid
    C: '#705030', // body shadow
    c: '#503820', // body deepest
    // Feathers (3 shades)
    F: '#e8d8b8', // feather bright
    f: '#c8b898', // feather mid
    G: '#a09878', // feather shadow
    // Eyes
    E: '#ffc800', // amber eye
    // Beak (2 shades)
    K: '#484848', // beak dark
    k: '#686868', // beak mid
    // Claws
    W: '#909090', // claw
    // White chest (2 shades)
    X: '#f4ecd8', // chest highlight
    x: '#d8d0c0', // chest shadow
    // Ear tufts
    H: '#d0c090', // tuft
  },
  pixels: [
    '................',
    '..H..GffG..H....',
    '...GfFFFFFfG....',
    '...FFFEFFEFf....',
    '....fFKKKFf.....',
    '....GfFFFfG.....',
    '...cBBBBBBBc....',
    '..c.BXxxxXB.c...',
    '..W.BXxxxXB.W...',
    '....bBBBBBBb....',
    '...cBBBBBBBc....',
    '....bBBB.BBb....',
    '....cBBB.BBc....',
    '....WW...WW.....',
    '................',
    '................',
  ],
};

const TROLL: SpriteDefinition = {
  palette: {
    // Green skin (4 shades)
    G: '#90c858', // skin highlight
    g: '#70a048', // skin mid
    N: '#508038', // skin shadow
    n: '#306028', // skin deepest
    // Skin highlight
    S: '#b0e070', // bright highlight
    // Eyes
    E: '#ffd000', // yellow eye
    // Teeth
    T: '#e0f0b0', // teeth
    // Claws (2 shades)
    C: '#607838', // claw shadow
    c: '#809858', // claw lit
    // Moss hair (2 shades)
    H: '#608838', // hair lit
    h: '#385828', // hair dark
    // Loincloth (2 shades)
    L: '#605838', // cloth lit
    l: '#403828', // cloth dark
    // Wart
    W: '#80a058', // wart
    // Nose
    O: '#589838', // nose
  },
  pixels: [
    '....hhHHhh......',
    '....hGGGGGh.....',
    '...nGGSGGGGn....',
    '...NGENNESGn....',
    '...NGGOOOGN.....',
    '....GGTTGGg.....',
    '...nGGGGGGn.....',
    '..cc.GGGGGg.cc..',
    '..cC.gGLLGg.Cc..',
    '..C..NGGGGgN....',
    '.....NGWWGNn....',
    '.....Ng..gN.....',
    '.....ng..gn.....',
    '.....ng..gn.....',
    '.....CC..CC.....',
    '................',
  ],
};

const GIANT_RAT: SpriteDefinition = {
  palette: {
    // Brown fur (4 shades)
    F: '#b89070', // fur highlight
    f: '#907858', // fur mid
    G: '#706048', // fur shadow
    g: '#504030', // fur deepest
    // Eyes
    E: '#ff4848', // red eye
    // Nose
    N: '#382828', // nose
    // Teeth
    T: '#f0e0d0', // teeth
    // Whiskers
    W: '#d0c0a8', // whisker
    // Belly (2 shades)
    B: '#d0b090', // belly bright
    b: '#b09070', // belly dim
    // Tail (3 shades)
    L: '#908070', // tail bright
    l: '#706858', // tail mid
    K: '#504840', // tail dark
    // Paws
    P: '#807060', // paw
    // Ears
    R: '#d0a090', // ear pink
  },
  pixels: [
    '................',
    '................',
    '................',
    '................',
    '....gR..Rg......',
    '...gFFff.fFFl...',
    '...FEFNN.FEF.l..',
    '..WFFTTTTfFF..l.',
    '....fBBBBBfL....',
    '...GFFFFFFfGK...',
    '...G.Pff.PgK....',
    '...g.Pff.Pg.K...',
    '............K...',
    '................',
    '................',
    '................',
  ],
};

const KOBOLD: SpriteDefinition = {
  palette: {
    // Red-brown scales (4 shades)
    R: '#d88048', // scales highlight
    r: '#b06038', // scales mid
    N: '#884828', // scales shadow
    n: '#683818', // scales deepest
    // Eyes
    E: '#ffe000', // yellow eye
    // Belly scales (2 shades)
    S: '#e0b068', // belly bright
    s: '#c09048', // belly dim
    // Spear (3 shades)
    W: '#c8c8c8', // tip bright
    w: '#909090', // tip dark
    T: '#907048', // shaft lit
    t: '#685038', // shaft dark
    // Horn (2 shades)
    H: '#b87040', // horn lit
    h: '#885028', // horn dark
    // Tail (2 shades)
    A: '#a07038', // tail lit
    a: '#807028', // tail dark
    // Leather
    L: '#686030', // leather
  },
  pixels: [
    '................',
    '................',
    '.....hHHh.......',
    '....nRRRRn......',
    '....rRESsRr.....',
    '.....rRRRr......',
    '......rr........',
    '.....rRRRr......',
    '..Ww.rLLRr......',
    '..tT.NRSSRNa....',
    '..t..nRRRrn.a...',
    '.....nr..rn..a..',
    '.....n...n..a...',
    '.....n...n.a....',
    '..........a.....',
    '................',
  ],
};

const ZOMBIE: SpriteDefinition = {
  palette: {
    // Green-gray skin (4 shades)
    Z: '#90b080', // skin highlight
    z: '#709060', // skin mid
    N: '#507040', // skin shadow
    n: '#305028', // skin deepest
    // Wounds (2 shades)
    R: '#b04848', // wound bright
    r: '#803838', // wound dark
    // Tattered clothes (4 shades)
    C: '#808878', // cloth highlight
    c: '#606860', // cloth mid
    D: '#404840', // cloth shadow
    d: '#282828', // cloth deepest
    // Glowing eyes
    E: '#d0ff48', // eye glow
    // Exposed bone
    B: '#d8d0b8', // bone
    // Blood
    V: '#703030', // dried blood
    // Skin highlight
    S: '#a0b890', // lighter skin
  },
  pixels: [
    '................',
    '....nnzznn......',
    '....nZZZZn......',
    '....ZERZEZn.....',
    '.....ZSRZzn.....',
    '.....CzZZC......',
    '....cCCCCCc.....',
    '...ZcCCCCCcZ....',
    '...z.CRVCCc.....',
    '.....CCBCCc.....',
    '....dCCCCCCd....',
    '....dCc..cCd....',
    '.....dc..cd.....',
    '.....nz..zn.....',
    '.....nz..zn.....',
    '................',
  ],
};

const STIRGE: SpriteDefinition = {
  palette: {
    // Body (4 shades)
    B: '#985858', // body highlight
    b: '#784040', // body mid
    C: '#582828', // body shadow
    c: '#381818', // body deepest
    // Wings (3 shades)
    W: '#b88080', // wing highlight
    w: '#906868', // wing mid
    V: '#705050', // wing shadow
    // Eyes
    E: '#ff4848', // red eye
    // Proboscis (3 shades)
    P: '#b85858', // prob bright
    p: '#904848', // prob mid
    Q: '#703838', // prob dark
    // Legs
    L: '#583838', // leg
    // Wing veins
    R: '#a07070', // vein
  },
  pixels: [
    '................',
    '................',
    '................',
    '.wWWR...RWWw....',
    '..WWww.bbwWW....',
    '..VWwBEEBwWV....',
    '...VwBBBBwV.....',
    '....bBBBBBb.....',
    '....cBBBBBc.....',
    '...L.cPPPc.L....',
    '.....pPPPp......',
    '......QPp.......',
    '......QQ........',
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
