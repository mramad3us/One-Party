// ── Pixel Art Sprite System ──────────────────────────────────
// 16×16 modern pixel art sprites for player classes & monsters.
// Each sprite is defined as a palette + pixel rows.
// Auto-outline generation adds 1px dark border around all opaque pixels.
// Rendered to offscreen canvases and cached for fast blitting.

// ── Types ────────────────────────────────────────────────────

interface SpriteDefinition {
  pixels: string[];                 // N rows of N chars, '.' = transparent
  palette: Record<string, string>;  // char → hex color
  size?: number;                    // pixel dimensions (default 16)
}

interface ImageSpriteDefinition {
  src: string; // path served from /public (e.g. '/sprites/naelia.png')
}

// ── Image Sprite Registry ─────────────────────────────────────
// PNG sprites take priority over text-encoded sprites of the same ID.

const IMAGE_SPRITE_REGISTRY: Record<string, ImageSpriteDefinition> = {
  // PNG sprites can be added here — they take priority over text-encoded sprites.
  // Example: naelia: { src: '/sprites/naelia.png' },
};

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
    '...JJhGGhJJ.....',
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
    '..Ww.VBDBVc.....',
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


const GELATINOUS_CUBE: SpriteDefinition = {
  palette: {
    // Cyan-blue jelly body (5 shades — translucent look)
    C: '#88e8e0', // jelly highlight (bright surface)
    c: '#60c8c0', // jelly mid-light
    T: '#40a8a0', // jelly mid
    t: '#288888', // jelly shadow
    D: '#186868', // jelly deep
    // Inner glow (2 shades — deeper translucency)
    G: '#50b8b0', // inner glow bright
    g: '#389090', // inner glow dim
    // Edge sheen (2 shades — surface reflection)
    E: '#a8f0f0', // edge highlight
    e: '#78d8d8', // edge mid
    // Floating bones/items inside (3 shades)
    W: '#f0e8d8', // bone bright
    w: '#c8c0a8', // bone dim
    B: '#d8d098', // skull fragment
    // Rust bits (absorbed gear)
    R: '#a08060', // rusty item
    r: '#807050', // rusty dark
    // Acidic core
    A: '#70d0c8', // acid bright
  },
  pixels: [
    '................',
    '................',
    '..EeCCCCCCCCeE..',
    '..CcTTTTTTTTcC..',
    '..CTtGgWgGttTC..',
    '..TtgGtGtgBtTc..',
    '..TtGtwRgGttTc..',
    '..TgttGgGtWgTc..',
    '..TtgGtAtGgtTc..',
    '..TtGtwgGgrtTc..',
    '..TtgtGgGtgtTc..',
    '..TtgGtgGgWtTc..',
    '..CtTTtGtTTTCc..',
    '..cDDDDDDDDDcc..',
    '................',
    '................',
  ],
};

const WRAITH: SpriteDefinition = {
  palette: {
    // Shadowy cloak (5 shades — darkest at core)
    D: '#282838', // cloak deepest
    d: '#383848', // cloak dark
    F: '#484860', // cloak mid
    f: '#585870', // cloak light
    K: '#686880', // cloak highlight
    // Wispy edges (3 shades — fade to transparency)
    W: '#505068', // wisp dark
    w: '#606880', // wisp mid
    V: '#787898', // wisp light
    // Glowing red eyes (2 shades)
    E: '#ff3030', // eye core
    e: '#cc1818', // eye dim
    // Skeletal hands (2 shades)
    B: '#c8c0a8', // bone bright
    b: '#989080', // bone dim
    // Inner shadow glow (2 shades)
    G: '#303048', // inner glow dark
    g: '#404058', // inner glow mid
    // Ethereal wisps
    P: '#707090', // pale wisp
  },
  pixels: [
    '......wWw.......',
    '.....WdDDdW.....',
    '....KDDDDDDKw...',
    '....dDEeGEDd....',
    '...wDDgGGgDDw...',
    '...WdDDDDDDdW...',
    '..BbFDDDDDDfbB..',
    '..b.FDDGGDDFKb..',
    '...wWdDDDDdWw...',
    '....wFdDDdfW....',
    '..Vw..dDDd..wV..',
    '...V..WdDW..V...',
    '..P..w.Wd.w..P..',
    '..V....WW....V..',
    '.......w........',
    '................',
  ],
};

const GHAST: SpriteDefinition = {
  palette: {
    // Putrid gray-green skin (4 shades)
    S: '#b0b898', // skin highlight
    s: '#8a9878', // skin mid
    N: '#687858', // skin shadow
    n: '#486040', // skin deepest
    // Exposed bone/ribs (3 shades)
    B: '#e0d8c0', // bone bright
    b: '#c0b8a0', // bone mid
    C: '#a09880', // bone shadow
    // Eyes (2 shades — sickly glow)
    E: '#d0ff40', // eye glow bright
    e: '#a0cc20', // eye glow dim
    // Elongated jaw/teeth (2 shades)
    T: '#d8d0b8', // teeth bright
    t: '#b0a890', // teeth dim
    // Claws (2 shades)
    W: '#c8c0a0', // claw bright
    w: '#989078', // claw dim
    // Stench clouds (3 shades — yellow-green wisps)
    Y: '#b8c848', // stench bright
    y: '#90a838', // stench mid
    Z: '#708828', // stench dim
    // Wound/rot
    R: '#784838', // rot
  },
  pixels: [
    '..y..........Y..',
    '..Y.nnSSSnn.y...',
    '...nSSSSSSn.....',
    '...SEeSRsESn....',
    '...SSNNNNSSn.Z..',
    '..Z.sTTtTsn.....',
    '.....sSSss......',
    '..Ww.CbBbCsn....',
    '..wW.NBBBBNn....',
    '.....NSRSNNn.y..',
    '..y..NssSNn.....',
    '.....Ns..sN.....',
    '.....ns..sn.....',
    '....Wns..snW....',
    '.....nn..nn.....',
    '................',
  ],
};

const MINOTAUR: SpriteDefinition = {
  palette: {
    // Brown fur (4 shades)
    F: '#c89868', // fur highlight
    f: '#a07848', // fur mid
    G: '#785830', // fur shadow
    g: '#583820', // fur deepest
    // Horns (3 shades)
    H: '#e8d8b0', // horn highlight
    h: '#c0b088', // horn mid
    J: '#988868', // horn shadow
    // Eyes (red fierce)
    E: '#ff3030', // eye bright
    // Snout (2 shades)
    S: '#d8b888', // snout bright
    s: '#b09868', // snout mid
    // Nose ring
    R: '#c8c838', // gold ring
    // Muscular torso (2 shades)
    T: '#b08858', // torso lit
    t: '#906838', // torso shadow
    // Axe blade (3 shades)
    A: '#d0d8e0', // axe highlight
    a: '#a0a8b8', // axe mid
    B: '#707888', // axe shadow
    // Axe handle (2 shades)
    W: '#906840', // handle lit
    w: '#684828', // handle dark
    // Hooves
    K: '#484038', // hoof
    // Loincloth (2 shades)
    L: '#704830', // cloth lit
    l: '#503018', // cloth dark
  },
  pixels: [
    'H...gFFFFg...H..',
    '.h.gFFFFFfg.h...',
    '.JgFEFffFEFgJ...',
    '..gFFFSSFFFg....',
    '...fFSRRsFf.....',
    '....gfFFfg......',
    '...gFFFFFFfg....',
    '.AagTTTTTTfg....',
    '.Ba.fTtTTTfg....',
    '.W...GfLlfG.....',
    '.w..gfLlLfgG....',
    '....gFf..fFg....',
    '....Gff..ffG....',
    '....gf....fg....',
    '....KK....KK....',
    '................',
  ],
};

const OGRE_ZOMBIE: SpriteDefinition = {
  palette: {
    // Rotting green-gray skin (4 shades)
    Z: '#a0b890', // skin highlight (sickly pale green)
    z: '#809870', // skin mid
    N: '#607850', // skin shadow
    n: '#486038', // skin deepest
    // Exposed bone (2 shades)
    B: '#d8d0b8', // bone bright
    b: '#b0a888', // bone shadow
    // Wounds / rot (2 shades)
    R: '#904040', // wound bright
    r: '#603030', // wound dark
    // Eyes (undead glow)
    E: '#c8ff48', // sickly yellow-green glow
    // Tusks (2 shades — yellowed)
    T: '#d0c898', // tusk bright
    t: '#a89868', // tusk dim
    // Tattered loincloth (2 shades)
    L: '#585048', // cloth lit
    l: '#383028', // cloth dark
    // Club (3 shades)
    C: '#988858', // club highlight
    c: '#786840', // club mid
    D: '#585030', // club dark
    // Hair patches
    H: '#505040', // sparse dark hair
  },
  pixels: [
    '................',
    '...HnZZZZnH.....',
    '...nZZRZZZn.....',
    '...ZEZNNEZz.....',
    '...ZZNtTNZZz....',
    '....ZTtTTZz.....',
    '...nZRZZRZZn....',
    '..CnZBZZZBZn....',
    '..cDZzRrZZZzn...',
    '..D.nZLLLZn.....',
    '....NZLLLZNn....',
    '....NZZ..ZZN....',
    '...nZZ...ZZn....',
    '...nn....nn.....',
    '...nn....nn.....',
    '................',
  ],
};

const WEREWOLF: SpriteDefinition = {
  palette: {
    // Dark gray-brown fur (4 shades)
    F: '#a09080', // fur highlight
    f: '#807060', // fur mid
    G: '#605848', // fur shadow
    g: '#403830', // fur deepest
    // Light belly/chest (2 shades)
    W: '#c8b8a0', // chest bright
    w: '#a89878', // chest mid
    // Eyes
    E: '#ffe020', // yellow eye
    // Nose
    N: '#202020', // black nose
    // Teeth/fangs (2 shades)
    T: '#f0e8e0', // fang bright
    t: '#c0b8a8', // fang dim
    // Claws (2 shades)
    C: '#b0a890', // claw bright
    c: '#808070', // claw shadow
    // Inner ear
    R: '#c08888', // ear pink
    // Tongue
    P: '#c06060', // tongue red
    // Muzzle highlight
    S: '#b8a890', // snout lit
  },
  pixels: [
    '...gR...Rg......',
    '...GFF.FFG......',
    '...FFFfFFFg.....',
    '...fFEFfFEf.....',
    '....FFNNNFF.....',
    '....gTTPTTg.....',
    '...gfFFSFFfg....',
    '..CcfFWWWFFf....',
    '..cCGfWwWFfGg...',
    '.....GFFFFfG....',
    '....gFFfFFFg....',
    '....GFff.fFg....',
    '....gff..ffg....',
    '....gC...Cg.....',
    '....CC...CC.....',
    '................',
  ],
};

const BASILISK: SpriteDefinition = {
  palette: {
    // Dark olive-brown scales (4 shades)
    S: '#90884c', // scales highlight
    s: '#707038', // scales mid
    N: '#505028', // scales shadow
    n: '#383818', // scales deepest
    // Belly (2 shades)
    B: '#b0a860', // belly bright
    b: '#908848', // belly mid
    // Glowing green eyes (2 shades — petrifying)
    E: '#48ff48', // eye bright glow
    e: '#30c830', // eye dim glow
    // Back spines (2 shades)
    K: '#a09848', // spine bright
    k: '#787030', // spine shadow
    // Teeth (2 shades)
    T: '#e0d8c0', // teeth bright
    t: '#b8b098', // teeth dim
    // Legs (2 shades)
    L: '#606030', // leg lit
    l: '#404020', // leg dark
    // Tail (2 shades)
    A: '#686830', // tail lit
    a: '#484820', // tail shadow
    // Claws
    C: '#989068', // claw
  },
  pixels: [
    '................',
    '................',
    '................',
    '....K.K.K.K.....',
    '...nkSkSkSkn....',
    '..nnSSSSSSSnn...',
    '..nEeSSSSSSSnaa.',
    '..NSTTSSSSSsn.a.',
    '..nssBBBBBBsna..',
    '.LlNsSSSSSsNLa..',
    '.CL.NsSSSsNLa...',
    '.ClLlnNNNnlLa...',
    '..CLl.nnn.la....',
    '...C.l...a......',
    '................',
    '................',
  ],
};

const OWLBEAR_CUB: SpriteDefinition = {
  palette: {
    // Brown body (4 shades)
    B: '#c0a068', // body highlight
    b: '#a08050', // body mid
    C: '#806038', // body shadow
    c: '#604828', // body deepest
    // Feathers (3 shades)
    F: '#e8d8b8', // feather bright
    f: '#d0c0a0', // feather mid
    G: '#b0a080', // feather shadow
    // Owl face disc (2 shades)
    D: '#f0e4d0', // face disc bright
    d: '#d8ccb0', // face disc dim
    // Eyes
    E: '#ffc000', // amber eye
    // Beak (2 shades)
    K: '#505050', // beak dark
    k: '#707070', // beak light
    // White chest (2 shades)
    W: '#f0e8d8', // chest bright
    w: '#d8d0b8', // chest dim
    // Claws
    A: '#888078', // claw
    // Ear tufts
    H: '#c8b088', // tuft
  },
  pixels: [
    '................',
    '................',
    '..H..GffG..H....',
    '...GfFFFFfG.....',
    '..GFDdEdEDFG....',
    '...FdDKKDdFf....',
    '...GGfFFfGG.....',
    '..ccBBBBBBBcc...',
    '..cBBWwwwWBBc...',
    '..cBBBWWBBBBc...',
    '...bBBBBBBBb....',
    '...cBBBBBBBc....',
    '....cBBBBBc.....',
    '....AA..AA......',
    '................',
    '................',
  ],
};

const GHOUL: SpriteDefinition = {
  palette: {
    // Decayed skin (4 shades — gray-green)
    G: '#a0aa90', // skin highlight
    g: '#808870', // skin mid
    N: '#606850', // skin shadow
    n: '#404838', // skin deepest
    // Exposed flesh (2 shades)
    R: '#905858', // wound bright
    r: '#684040', // wound dark
    // Glowing eyes
    E: '#c8ff60', // eye glow
    // Claws (3 shades)
    C: '#d0d0b8', // claw bright
    c: '#a8a890', // claw mid
    K: '#808870', // claw dark
    // Tattered rags (3 shades)
    T: '#706860', // rag highlight
    t: '#504840', // rag mid
    D: '#383028', // rag dark
    // Teeth
    W: '#c8c0a0', // teeth
    // Hair wisps
    H: '#505848', // hair
  },
  pixels: [
    '................',
    '.....HnGGnH.....',
    '....nGGGGGGn....',
    '....GEgGgEGn....',
    '....gGGGGGgn....',
    '.....gWWGgn.....',
    '....nTTTTTtn....',
    '..CC.TtRtTtN....',
    '..cK.tTTTTtDN...',
    '..K.NTTrTTTN....',
    '....NtTTTTtN....',
    '....DtTT.TtD....',
    '.....ng..gn.....',
    '.....ng..gn.....',
    '.....CC..CC.....',
    '................',
  ],
};

const BUGBEAR: SpriteDefinition = {
  palette: {
    // Shaggy fur (4 shades)
    F: '#c8a060', // fur highlight
    f: '#a08048', // fur mid
    B: '#806038', // fur shadow
    b: '#604828', // fur deepest
    // Eyes
    E: '#e8d020', // yellow eye
    // Snout / nose
    N: '#584030', // nose dark
    // Skin (2 shades)
    S: '#d8b878', // skin lit
    s: '#b09058', // skin shadow
    // Teeth
    T: '#e0d8c0', // teeth
    // Morningstar head (3 shades)
    M: '#b0b0b8', // metal highlight
    m: '#808088', // metal mid
    K: '#585860', // metal dark
    // Shaft (2 shades)
    W: '#907048', // wood lit
    w: '#685038', // wood shadow
    // Armor leather (2 shades)
    L: '#786040', // leather lit
    l: '#583828', // leather dark
    // Spikes
    X: '#c8c8d0', // spike bright
  },
  pixels: [
    '...bfFFFFFfb....',
    '...BFFFFFFfB....',
    '...FFFEFEFFb....',
    '...fSSNNSSfb....',
    '....sSTTSsf.....',
    '...bfFFFFfb.....',
    '..bBLLLLLBbW....',
    '..SBLLLLLBbW....',
    '..s.BLLLBb.w....',
    '.....BffBb.XmX..',
    '....bBFFBb.mMm..',
    '....bBf.fBbKmK..',
    '....bBf..Bb.....',
    '....lb...bl.....',
    '....lb...bl.....',
    '................',
  ],
};

const MIMIC: SpriteDefinition = {
  palette: {
    // Wood body (4 shades)
    W: '#c89050', // wood highlight
    w: '#a07038', // wood mid
    B: '#805828', // wood shadow
    b: '#604018', // wood deepest
    // Gold trim (3 shades)
    G: '#f8d868', // gold highlight
    g: '#c8a838', // gold mid
    Y: '#907828', // gold shadow
    // Teeth (3 shades)
    T: '#f0ead0', // teeth bright
    t: '#d0c8a8', // teeth mid
    K: '#b0a888', // teeth shadow
    // Tongue (3 shades)
    R: '#e85878', // tongue bright
    r: '#c03858', // tongue mid
    P: '#902840', // tongue dark
    // Eye
    E: '#ff3030', // red eye
    // Lock
    L: '#a0a0a8', // lock metal
    // Lid interior
    D: '#482818', // dark interior
  },
  pixels: [
    '................',
    '................',
    '................',
    '................',
    '..GgYYYYYYYgG...',
    '..GWWWWWWWWWG...',
    '..DTtTtDtTtTD...',
    '..DEDDRrrDDEDb..',
    '..DTTrRRRrTTDb..',
    '..bwTtPPPtTwBb..',
    '..bwwwwLwwwwBb..',
    '..bwWWWLWWWwBb..',
    '..bBBBBBBBBBBb..',
    '..YgGGGGGGGgY...',
    '................',
    '................',
  ],
};

const GARGOYLE: SpriteDefinition = {
  palette: {
    // Stone body (4 shades — gray with blue tinge)
    S: '#b0b8c0', // stone highlight
    s: '#8890a0', // stone mid
    N: '#606878', // stone shadow
    n: '#404858', // stone deepest
    // Wing membrane (3 shades)
    W: '#9098a8', // wing highlight
    w: '#707880', // wing mid
    V: '#505860', // wing shadow
    // Horns (2 shades)
    H: '#787880', // horn lit
    h: '#505058', // horn dark
    // Eyes
    E: '#ff5030', // glowing eye
    // Claws (2 shades)
    C: '#707078', // claw lit
    c: '#484850', // claw dark
    // Mouth / detail
    M: '#585060', // mouth
    // Stone highlight
    X: '#c8d0d8', // bright stone
    // Stone crack detail
    K: '#506070', // crack
  },
  pixels: [
    '................',
    '..h..nSSn..h....',
    '..H.nSSSSSn.H...',
    '.Ww.NSSESEsN.wW.',
    '.WwW.sSMSsN.WwW.',
    '.VWw.NSSSSn.wWV.',
    '..Vw.sXSSsN.wV..',
    '...w.NSSSXN.w...',
    '...V.nSKSsn.V...',
    '.....NSSSSn.....',
    '.....Ns.sNn.....',
    '....nNs..Nn.....',
    '....cN...Nc.....',
    '....cN...Nc.....',
    '....cc...cc.....',
    '................',
  ],
};



const BAT: SpriteDefinition = {
  palette: {
    // Wing membrane (4 shades)
    W: '#8c7868', // wing highlight
    w: '#6c5848', // wing mid
    D: '#4c3828', // wing shadow
    d: '#302018', // wing deepest
    // Body fur (3 shades)
    B: '#786050', // body highlight
    b: '#584030', // body mid
    C: '#3c2818', // body deepest
    // Eyes
    E: '#ff3030', // red eye
    // Ears (2 shades)
    R: '#907060', // ear outer
    r: '#a08070', // ear inner
    // Fangs
    T: '#e8e0d0', // fang white
    // Nose
    N: '#503838', // nose
    // Claws
    K: '#484040', // claw
  },
  pixels: [
    '................',
    '................',
    '................',
    '.Rr.........rR..',
    'DWWww...wwWWWWD.',
    'DWWWwBbBbwWWWWD.',
    '.DWwwbEbEbwwWD..',
    '.dDWwBNNNBwWDd..',
    '..dDwBTBTBwDd...',
    '...dwbBBBbwd....',
    '...dDCbBbCDd....',
    '....KdCBCdK.....',
    '................',
    '................',
    '................',
    '................',
  ],
};

const HAWK: SpriteDefinition = {
  palette: {
    // Brown feathers (4 shades)
    F: '#c8a060', // feather highlight
    f: '#a08048', // feather mid
    G: '#786030', // feather shadow
    g: '#584020', // feather deepest
    // Tawny wing feathers (3 shades)
    W: '#d8b870', // wing highlight
    w: '#b09050', // wing mid
    D: '#887038', // wing shadow
    // White chest (2 shades)
    X: '#f0e8d8', // chest bright
    x: '#d0c8b0', // chest dim
    // Beak (2 shades)
    K: '#f8d030', // beak bright yellow
    k: '#c8a020', // beak shadow
    // Eyes
    E: '#f0a000', // amber eye
    // Talons (2 shades)
    T: '#787070', // talon lit
    t: '#504848', // talon shadow
    // Tail
    A: '#907848', // tail feather
  },
  pixels: [
    '................',
    '................',
    '.......gFg......',
    '.....gfFFfg.....',
    '..GgfFFFFFFfgG..',
    'DwWWfFEfFEFWWwD.',
    '.DWWffKkFFFWWD..',
    '..DwfXxxXFfwD...',
    '..DgfXxxXffgD...',
    '...gffFFfffg....',
    '....gfFAfFg.....',
    '...Tt.gAAAg.....',
    '................',
    '................',
    '................',
    '................',
  ],
};

const POISONOUS_SNAKE: SpriteDefinition = {
  palette: {
    // Green scales (4 shades)
    G: '#68c848', // scales highlight
    g: '#48a830', // scales mid
    N: '#308820', // scales shadow
    n: '#206818', // scales deepest
    // Yellow diamond pattern (2 shades)
    Y: '#f0d848', // diamond bright
    y: '#c8b030', // diamond dim
    // Belly scales (2 shades)
    B: '#a8d870', // belly highlight
    b: '#80b050', // belly dim
    // Eyes
    E: '#d83030', // red eye
    // Tongue (2 shades)
    R: '#e83030', // tongue bright
    r: '#b82020', // tongue shadow
    // Head detail
    H: '#58b838', // head highlight
    // Mouth
    M: '#903838', // mouth interior
  },
  pixels: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '.Rr.nNGGn.......',
    '.rM.GEGEGGn.....',
    '....nGHGGGNn....',
    '...nGGyGGgNn....',
    '..NGgYGgNn.nNn..',
    '..ngBbGgNn.nGgN.',
    '.nGgNNnn.nGyGgn.',
    '.NgYGgNnNGgYgNn.',
    '..ngbBgGGbgngn..',
    '................',
    '................',
  ],
};

const SKELETON_WARRIOR: SpriteDefinition = {
  palette: {
    // Bone (4 shades)
    B: '#f0e8d8', // bone highlight
    b: '#d0c8b0', // bone mid
    C: '#a89880', // bone shadow
    c: '#786858', // bone deepest
    // Green glow eyes
    E: '#68ff68', // eye glow bright
    // Dark void
    D: '#101010', // void/gaps
    // Rusty sword (3 shades)
    W: '#b89070', // blade highlight
    w: '#907050', // blade mid
    R: '#705838', // blade shadow
    // Rusty shield (4 shades)
    S: '#a88860', // shield highlight
    s: '#887048', // shield mid
    T: '#685030', // shield shadow
    t: '#503820', // shield edge
    // Shield boss
    G: '#c8a050', // boss gold
    // Rib texture
    V: '#d0c8b0', // rib detail
    // Tattered cloth
    L: '#605848', // cloth
  },
  pixels: [
    '....ccBBBcc.....',
    '....cBBBBBc.....',
    '....CBEDEBc.....',
    '....cBBDBBc.....',
    '.....cBBBc......',
    '....cVBDBVc.....',
    '..Ww.VBDBVsTt...',
    '..wR.cBDBcsGSt..',
    '..R...BBBcsGSt..',
    '......bBb.sTt...',
    '.....cB.Bc......',
    '.....cb.bc......',
    '.....cL.Lc......',
    '.....c...c......',
    '.....c...c......',
    '................',
  ],
};

// ── NPC Sprites ────────────────────────────────────────────

const NPC_INNKEEPER: SpriteDefinition = {
  palette: {
    // Hair (2 shades)
    H: '#a07050', // hair highlight
    h: '#704830', // hair shadow
    // Skin (2 shades)
    S: '#f0d0a8', // skin lit
    s: '#c8a070', // skin shadow
    // Eyes
    E: '#1c2838', // dark eye
    // Apron (3 shades)
    W: '#f0e8d8', // apron highlight
    w: '#d8cbb8', // apron mid
    X: '#b8a898', // apron shadow
    // Shirt (3 shades)
    R: '#c86838', // shirt highlight (warm rust)
    r: '#a04828', // shirt mid
    Q: '#783018', // shirt shadow
    // Tankard (3 shades)
    T: '#d0b878', // tankard bright
    t: '#a89058', // tankard mid
    K: '#786838', // tankard dark
    // Belt
    B: '#403028', // belt dark
    // Pants (2 shades)
    P: '#786050', // pants lit
    p: '#584038', // pants shadow
    // Boots (2 shades)
    L: '#685040', // boot lit
    l: '#483028', // boot shadow
    // Mustache
    M: '#906838', // mustache
  },
  pixels: [
    '................',
    '.....hHHHh......',
    '....hHHHHHh.....',
    '....sSSSSSs.....',
    '....sSEsESs.....',
    '.....sMMMs......',
    '....QrRBRrQ.....',
    '..Tt.rRBRrQ.....',
    '..tK.QWWWrQ.....',
    '.....XWWWX......',
    '....pPWWWPp.....',
    '....pPP.PPp.....',
    '....pP...Pp.....',
    '....lL...Ll.....',
    '....lL...Ll.....',
    '................',
  ],
};

const NPC_MERCHANT: SpriteDefinition = {
  palette: {
    // Hat (3 shades)
    H: '#508040', // hat highlight (green)
    h: '#386830', // hat mid
    J: '#285020', // hat dark
    // Skin (2 shades)
    S: '#f0d0a8', // skin lit
    s: '#c8a070', // skin shadow
    // Eyes
    E: '#1c2838', // dark eye
    // Tunic (4 shades — rich green)
    G: '#60a850', // tunic highlight
    g: '#488838', // tunic mid
    N: '#306828', // tunic shadow
    n: '#205018', // tunic deepest
    // Gold trim / coin (3 shades)
    Y: '#f8d868', // gold highlight
    y: '#c8a838', // gold mid
    Z: '#907828', // gold shadow
    // Belt (2 shades)
    B: '#503828', // belt dark
    b: '#785838', // belt mid
    // Pants (2 shades)
    P: '#706048', // pants lit
    p: '#504030', // pants shadow
    // Boots (2 shades)
    L: '#685040', // boot lit
    l: '#483028', // boot shadow
    // Hair
    K: '#383030', // dark hair
  },
  pixels: [
    '....JhHHHhJ.....',
    '...JhHHHHHhJ....',
    '...JJJJJJJJJ....',
    '....sSSSSSSs....',
    '....sSEsSESs....',
    '......sSs.......',
    '....NgGBGgN.....',
    '...s.GGBGGg.....',
    '...s.GGyGGg.....',
    '.....gGYGgN.....',
    '....nGGGGGn.....',
    '....pPG.GPp.....',
    '....pP...Pp.....',
    '....lL...Ll.....',
    '....lL...Ll.....',
    '................',
  ],
};

const NPC_BLACKSMITH: SpriteDefinition = {
  palette: {
    // Hair (2 shades)
    H: '#383030', // dark hair
    h: '#282020', // hair shadow
    // Skin (3 shades — tanned/sooty)
    S: '#d8b080', // skin lit
    s: '#b89060', // skin mid
    N: '#987048', // skin shadow
    // Eyes
    E: '#1c2838', // dark eye
    // Leather apron (3 shades)
    A: '#906838', // apron highlight
    a: '#704828', // apron mid
    D: '#503018', // apron shadow
    // Forge glow accents (2 shades)
    F: '#e87830', // forge orange
    f: '#c85818', // forge dark orange
    // Hammer (3 shades)
    W: '#c0c8d0', // hammer head bright
    w: '#8890a0', // hammer head shadow
    T: '#806040', // handle
    // Pants (2 shades)
    P: '#584838', // pants lit
    p: '#403028', // pants shadow
    // Boots (2 shades)
    L: '#504030', // boot lit
    l: '#382818', // boot shadow
    // Belt
    B: '#382820', // belt
    // Soot marks
    K: '#484040', // soot
  },
  pixels: [
    '................',
    '.....hHHHh......',
    '....hHHHHHh.....',
    '....KSSSSSKN....',
    '....sSEsESs.....',
    '.....sSSss......',
    '....DaABAaD.....',
    '..Ww.SAAAS......',
    '..wT.SAKAS......',
    '..T..NaFaaN.....',
    '.....DAfAD......',
    '....pPA.APp.....',
    '....pP...Pp.....',
    '....lL...Ll.....',
    '....lL...Ll.....',
    '................',
  ],
};

const NPC_PRIEST: SpriteDefinition = {
  palette: {
    // Robes (4 shades — white/cream)
    W: '#f4ecd8', // robe highlight
    w: '#dcd4c0', // robe mid-light
    X: '#c0b8a8', // robe shadow
    x: '#a09888', // robe deepest
    // Gold trim / holy symbol (3 shades)
    G: '#f8d868', // gold highlight
    g: '#c8a838', // gold mid
    Y: '#907828', // gold shadow
    // Skin (2 shades)
    S: '#f0d0a8', // skin lit
    s: '#c8a070', // skin shadow
    // Eyes
    E: '#1c2838', // dark eye
    // Hair (2 shades — tonsured)
    H: '#b09060', // hair lit
    h: '#806838', // hair shadow
    // Hood (2 shades)
    C: '#e0d8c8', // hood highlight
    c: '#c8c0b0', // hood shadow
    // Holy glow (2 shades)
    O: '#fff0a0', // glow bright
    o: '#e8d080', // glow dim
  },
  pixels: [
    '................',
    '.....cCCCc......',
    '....cCHHHCc.....',
    '....cSSSSScx....',
    '....sSEsESsx....',
    '.....sSSss......',
    '....xWGOGWx.....',
    '...s.WGgGWx.....',
    '...s.wWWWwx.....',
    '.....xWWWx......',
    '....xWWWWWx.....',
    '....xwWW.Wwx....',
    '....xwW..Wwx....',
    '.....xw..wx.....',
    '.....xw..wx.....',
    '................',
  ],
};

const NPC_GUARD: SpriteDefinition = {
  palette: {
    // Armor (4 shades — steel)
    A: '#c8d0e0', // armor highlight
    a: '#98a0b8', // armor mid
    B: '#687898', // armor shadow
    b: '#485068', // armor deepest
    // Helmet (3 shades)
    H: '#b0b8c8', // helm highlight
    h: '#808898', // helm mid
    J: '#586070', // helm dark
    // Skin (2 shades)
    S: '#f0d0a8', // skin lit
    s: '#c8a070', // skin shadow
    // Eyes
    E: '#1c2838', // dark eye
    // Tabard (3 shades — blue)
    T: '#4878c8', // tabard highlight
    t: '#305898', // tabard mid
    U: '#203868', // tabard dark
    // Spear (3 shades)
    W: '#d0d0d8', // spear tip bright
    w: '#a0a0a8', // spear tip shadow
    P: '#806040', // shaft
    // Boots (2 shades)
    L: '#606068', // boot lit
    l: '#404048', // boot shadow
    // Gold accent
    G: '#d8b040', // gold buckle
  },
  pixels: [
    '..W.............',
    '..w.JhHHHhJ.....',
    '..P.hHHHHHh.....',
    '..P.JJHHHJJb....',
    '..P..sSESs......',
    '..P...sSs.......',
    '..P.baTGTaB.....',
    '..P.AATTTAAb....',
    '..P.aATTTaab....',
    '.....BaTaBb.....',
    '....bBaAaBb.....',
    '....bBa.aBb.....',
    '....bB...Bb.....',
    '....lL...Ll.....',
    '....lL...Ll.....',
    '................',
  ],
};

const NPC_COMMONER: SpriteDefinition = {
  palette: {
    // Hair (2 shades)
    H: '#907050', // hair highlight
    h: '#604830', // hair shadow
    // Skin (2 shades)
    S: '#f0d0a8', // skin lit
    s: '#c8a070', // skin shadow
    // Eyes
    E: '#1c2838', // dark eye
    // Tunic (3 shades — plain brown)
    T: '#a89070', // tunic highlight
    t: '#887050', // tunic mid
    U: '#685038', // tunic shadow
    // Pants (2 shades)
    P: '#786850', // pants lit
    p: '#584838', // pants shadow
    // Belt
    B: '#504030', // belt
    // Boots (2 shades)
    L: '#685040', // boot lit
    l: '#483028', // boot shadow
    // Pitchfork (3 shades)
    W: '#a0a0a0', // tines
    w: '#787878', // tines shadow
    K: '#806040', // handle
    // Patch
    R: '#907848', // patch on tunic
  },
  pixels: [
    '................',
    '.....hHHHh......',
    '....hHHHHHh.....',
    '....sSSSSSs.....',
    '....sSEsESs.....',
    '......sSs.......',
    '....UtTBTtU.....',
    '..Ww.TTBTTt.....',
    '..wK.tTRTtu.....',
    '..K..UtTtU......',
    '.....UTTTUu.....',
    '....pPT.TPp.....',
    '....pP...Pp.....',
    '....lL...Ll.....',
    '....lL...Ll.....',
    '................',
  ],
};

const NPC_BANKER: SpriteDefinition = {
  palette: {
    // Hair (2 shades — neat, graying)
    H: '#787070', // hair lit
    h: '#585050', // hair shadow
    // Skin (2 shades)
    S: '#f0d0a8', // skin lit
    s: '#c8a070', // skin shadow
    // Eyes / spectacles
    E: '#1c2838', // dark eye
    O: '#c8b890', // spectacles gold frame
    // Coat (4 shades — dark formal navy)
    C: '#384868', // coat highlight
    c: '#283850', // coat mid
    D: '#182838', // coat shadow
    d: '#101820', // coat deepest
    // Vest/waistcoat (3 shades — rich burgundy)
    V: '#983838', // vest highlight
    v: '#782828', // vest mid
    W: '#581818', // vest shadow
    // Gold chain / coins (3 shades)
    G: '#f8d868', // gold highlight
    g: '#c8a838', // gold mid
    Y: '#907828', // gold shadow
    // Pants (2 shades — dark)
    P: '#383838', // pants lit
    p: '#282828', // pants shadow
    // Boots (2 shades — polished)
    L: '#302020', // boot lit
    l: '#201010', // boot shadow
  },
  pixels: [
    '................',
    '....hhHHHhh.....',
    '....hHHHHHh.....',
    '....sSSSSSSs....',
    '....sOEsOESs....',
    '......sSs.......',
    '....DcCVCcD.....',
    '...s.CVGVCc.....',
    '...s.CVgVCc.....',
    '.....cCYCcD.....',
    '....DcCCCcD.....',
    '....pPC.CPp.....',
    '....pP...Pp.....',
    '....lL...Ll.....',
    '....lL...Ll.....',
    '................',
  ],
};

const NPC_NOBLE: SpriteDefinition = {
  palette: {
    // Hair (2 shades)
    H: '#383040', // dark noble hair
    h: '#201828', // hair shadow
    // Circlet (2 shades)
    C: '#f8d868', // circlet gold
    c: '#c8a838', // circlet shadow
    // Skin (2 shades)
    S: '#f0d0a8', // skin lit
    s: '#c8a070', // skin shadow
    // Eyes
    E: '#1c2838', // dark eye
    // Robes (4 shades — rich purple)
    P: '#a060c8', // robe highlight
    p: '#7840a0', // robe mid
    Q: '#582878', // robe shadow
    q: '#381858', // robe deepest
    // Gold trim (3 shades)
    G: '#f8d868', // gold highlight
    g: '#c8a838', // gold mid
    Y: '#907828', // gold shadow
    // Cape (3 shades — deep red)
    R: '#c83838', // cape highlight
    r: '#982020', // cape mid
    V: '#681818', // cape deep
    // Boots (2 shades)
    L: '#503040', // boot lit
    l: '#382028', // boot shadow
    // Gem
    J: '#48c8f0', // jewel blue
  },
  pixels: [
    '................',
    '.....hHHHh......',
    '....hCcCcCh.....',
    '....sSSSSss.....',
    '....sSEsESs.....',
    '......sSs.......',
    '...RGpPGPpGr....',
    '...R.PPJPPp.r...',
    '...r.pPGPPp.V...',
    '...V.QPPPQq.V...',
    '....qPPPPPq.....',
    '....qPpq.pPq....',
    '....qPq..pPq....',
    '....lL....Ll....',
    '....lL....Ll....',
    '................',
  ],
};

// ── Additional Player Class Sprites ────────────────────────

const BARBARIAN: SpriteDefinition = {
  palette: {
    // Hair (2 shades — wild)
    H: '#c87830', // hair highlight
    h: '#905020', // hair shadow
    // Skin (3 shades — tanned)
    S: '#e0b878', // skin lit
    s: '#c09858', // skin mid
    N: '#987040', // skin shadow
    // Eyes
    E: '#1c2838', // dark eye
    // Fur (3 shades)
    F: '#c0a878', // fur highlight
    f: '#988060', // fur mid
    D: '#706048', // fur dark
    // Leather (2 shades)
    L: '#785838', // leather lit
    l: '#503018', // leather dark
    // Greataxe blade (3 shades)
    A: '#d0d0d8', // axe highlight
    a: '#a0a0a8', // axe mid
    B: '#707078', // axe shadow
    // Axe handle
    T: '#806040', // handle wood
    // Belt
    K: '#403020', // belt
    // Pants (2 shades)
    P: '#706048', // pants lit
    p: '#504030', // pants shadow
    // Boots
    W: '#584030', // boot
    // War paint
    R: '#c83838', // red war paint
  },
  pixels: [
    '..A..hHHHh......',
    '..aA.HhHhHH.....',
    '..Ba.NSSSSN.....',
    '..T..sRESERs....',
    '..T...sSSs......',
    '..T..DfFKFfD....',
    '..T.s.SSKSS.s...',
    '..T.S.SSKSS.N...',
    '..T..NlKKlN.....',
    '.....NSSSSN.....',
    '....pPSSSPp.....',
    '....pPP.PPp.....',
    '....pP...Pp.....',
    '....WW...WW.....',
    '....WW...WW.....',
    '................',
  ],
};

const BARD: SpriteDefinition = {
  palette: {
    // Feathered hat (3 shades)
    H: '#c84848', // hat highlight (red)
    h: '#982838', // hat mid
    J: '#681828', // hat dark
    // Feather (2 shades)
    F: '#f0d848', // feather bright
    f: '#c8a828', // feather shadow
    // Skin (2 shades)
    S: '#f0d0a8', // skin lit
    s: '#c8a070', // skin shadow
    // Eyes
    E: '#1c2838', // dark eye
    // Tunic (4 shades — colorful teal)
    T: '#48b8a8', // tunic highlight
    t: '#389888', // tunic mid
    U: '#287868', // tunic shadow
    u: '#185848', // tunic deepest
    // Gold trim (2 shades)
    G: '#f8d868', // gold highlight
    g: '#c8a838', // gold mid
    // Lute body (3 shades)
    L: '#c8a050', // lute highlight
    l: '#a08038', // lute mid
    K: '#786028', // lute dark
    // Pants (2 shades)
    P: '#706050', // pants lit
    p: '#504038', // pants shadow
    // Boots (2 shades)
    B: '#685040', // boot lit
    b: '#483028', // boot shadow
    // Cape (2 shades)
    C: '#d85050', // cape bright
    c: '#a83838', // cape shadow
  },
  pixels: [
    '....F...........',
    '...fJhHHHhC.....',
    '....JhHHHhCc....',
    '....sSSSSSsc....',
    '....sSEsESs.....',
    '......sSs.......',
    '....uTGGGTu.....',
    '...Ll.TTTTtc....',
    '...lK.tTGTtUc...',
    '...K..UtTtU.....',
    '.....UTTTTu.....',
    '....pPT.TPp.....',
    '....pP...Pp.....',
    '....bB...Bb.....',
    '....bB...Bb.....',
    '................',
  ],
};

const DRUID: SpriteDefinition = {
  palette: {
    // Hair (2 shades — earthy)
    H: '#908060', // hair highlight
    h: '#605040', // hair shadow
    // Skin (2 shades)
    S: '#f0d0a8', // skin lit
    s: '#c8a070', // skin shadow
    // Eyes
    E: '#1c2838', // dark eye
    // Robe (4 shades — forest green)
    G: '#68a050', // robe highlight
    g: '#488838', // robe mid
    N: '#306828', // robe shadow
    n: '#205018', // robe deepest
    // Leaf accents (2 shades)
    L: '#90d060', // leaf bright
    l: '#60a838', // leaf mid
    // Staff (3 shades)
    T: '#a88050', // wood lit
    t: '#786038', // wood mid
    K: '#584028', // wood dark
    // Vine (2 shades)
    V: '#58a040', // vine bright
    v: '#388028', // vine shadow
    // Belt
    B: '#504030', // belt
    // Boots (2 shades)
    W: '#685840', // boot lit
    w: '#484030', // boot shadow
  },
  pixels: [
    '....L.lL........',
    '..V.ThHHHh......',
    '..v.ThHHHHh.....',
    '..T..sSSSSSs....',
    '..T..sSEsESs....',
    '..T...sSSs......',
    '..T.nGgBgGn.....',
    '..T.s.GBGGg.....',
    '..T.s.gGLGgN....',
    '.....NgGGgN.....',
    '....nGGLGGn.....',
    '....nGg..gGn....',
    '....nGg..gGn....',
    '....wW....Ww....',
    '....wW....Ww....',
    '................',
  ],
};

const MONK: SpriteDefinition = {
  palette: {
    // Bald head — just skin shading
    // Skin (3 shades)
    S: '#e8c8a0', // skin lit
    s: '#c0a070', // skin mid
    N: '#988058', // skin shadow
    // Eyes
    E: '#1c2838', // dark eye
    // Robe (4 shades — saffron/orange)
    R: '#e8a848', // robe highlight
    r: '#c88838', // robe mid
    Q: '#a06828', // robe shadow
    q: '#785018', // robe deepest
    // Sash/belt (2 shades)
    B: '#c87838', // sash lit
    b: '#985828', // sash dark
    // Hand wraps (2 shades)
    W: '#d8d0c0', // wrap bright
    w: '#b0a890', // wrap shadow
    // Pants (2 shades)
    P: '#a08040', // pants lit
    p: '#786030', // pants shadow
    // Sandals
    L: '#806040', // sandal
    l: '#604028', // sandal shadow
  },
  pixels: [
    '................',
    '.....NSSN.......',
    '....NSSSSSN.....',
    '....NSSSSsN.....',
    '....sSEsESs.....',
    '......sSs.......',
    '....qRrBrRq.....',
    '..Ww.RrBrRq.....',
    '..wW.QRrRRQ.....',
    '.....qRRRq......',
    '....qRRRRRq.....',
    '....pPR.RPp.....',
    '....pP...Pp.....',
    '....lL...Ll.....',
    '....l.....l.....',
    '................',
  ],
};

const PALADIN: SpriteDefinition = {
  palette: {
    // Armor (4 shades — bright silver)
    A: '#e0e8f0', // armor highlight
    a: '#b0b8c8', // armor mid
    B: '#8090a8', // armor shadow
    b: '#586878', // armor deepest
    // Gold trim / holy symbol (3 shades)
    G: '#f8d868', // gold highlight
    g: '#c8a838', // gold mid
    Y: '#907828', // gold shadow
    // Skin (2 shades)
    S: '#f0d0a8', // skin lit
    s: '#c8a070', // skin shadow
    // Eyes
    E: '#1c2838', // dark eye
    // Hair
    H: '#d0b068', // sandy hair
    // Cape (3 shades — holy white/blue)
    C: '#a0c0e8', // cape highlight
    c: '#7098c8', // cape mid
    U: '#4870a0', // cape deep
    // Sword (2 shades)
    W: '#f0f4ff', // blade highlight
    w: '#c0ccdc', // blade shadow
    // Shield (2 shades)
    D: '#b8c0d0', // shield lit
    d: '#8890a0', // shield shadow
    // Boots (2 shades)
    L: '#707888', // boot lit
    l: '#505060', // boot shadow
  },
  pixels: [
    '................',
    '.....bBAABb.....',
    '....bAHHHAb.....',
    '....bASSSAb.....',
    '....bSEsESb.....',
    '.......Ss.......',
    '...CGaAGAaBCc...',
    '..Ww.AAGAAa.cc..',
    '..Ww.aAGAaB.Uc..',
    '..w..BaGaBb.....',
    '.....BAaABb.....',
    '....bBA.ABb.....',
    '....bB...Bb.....',
    '....lL...Ll.....',
    '....lL...Ll.....',
    '................',
  ],
};

const RANGER: SpriteDefinition = {
  palette: {
    // Hood/cloak (4 shades — forest green)
    G: '#68a058', // cloak highlight
    g: '#488838', // cloak mid
    N: '#306828', // cloak shadow
    n: '#205018', // cloak deepest
    // Skin (2 shades)
    S: '#e8c8a0', // skin lit
    s: '#b89868', // skin shadow
    // Eyes
    E: '#1c2838', // dark eye
    // Leather armor (3 shades)
    L: '#a08050', // leather highlight
    l: '#786038', // leather mid
    K: '#584028', // leather dark
    // Bow (2 shades)
    B: '#906838', // bow wood lit
    b: '#685028', // bow wood dark
    // Arrow
    W: '#c8c8c8', // arrowhead
    // Quiver (2 shades)
    Q: '#785838', // quiver lit
    q: '#583828', // quiver shadow
    // Belt
    T: '#403020', // belt
    // Pants (2 shades)
    P: '#606848', // pants lit
    p: '#404830', // pants shadow
    // Boots (2 shades)
    D: '#605040', // boot lit
    d: '#403028', // boot shadow
  },
  pixels: [
    '................',
    '.....nNGGNn.....',
    '....ngGGGGgn....',
    '....ngGGGGgn....',
    '....nsSESsn.....',
    '......sSs.......',
    '....KlLTLlKQ....',
    '..B..LLTLLlQq...',
    '..bB.lLTLlKQq...',
    '..b..KlLlK......',
    '....KlLLLlK.....',
    '....pPL.LPp.....',
    '....pP...Pp.....',
    '....dD...Dd.....',
    '....dD...Dd.....',
    '................',
  ],
};

const SORCERER: SpriteDefinition = {
  palette: {
    // Wild hair (3 shades)
    H: '#d84040', // hair bright red
    h: '#a82828', // hair mid
    J: '#781818', // hair dark
    // Skin (2 shades)
    S: '#f0d0a8', // skin lit
    s: '#c8a070', // skin shadow
    // Eyes
    E: '#1c2838', // dark eye
    // Robe (4 shades — deep crimson/dark)
    R: '#b83848', // robe highlight
    r: '#902838', // robe mid
    Q: '#681828', // robe shadow
    q: '#481018', // robe deepest
    // Arcane energy (3 shades — blue glow)
    O: '#80d0ff', // energy bright
    o: '#4898d8', // energy mid
    V: '#2868a8', // energy dim
    // Gold trim (2 shades)
    G: '#f8d868', // gold bright
    g: '#c8a838', // gold shadow
    // Belt
    B: '#403030', // belt
    // Boots (2 shades)
    L: '#604038', // boot lit
    l: '#402828', // boot shadow
  },
  pixels: [
    '.....JHhHJ......',
    '....JHHhHHHJ....',
    '....HhHHHhH.....',
    '....sSSSSSs.....',
    '....sSEsESs.....',
    '......sSs.......',
    '....qRrGrRq.....',
    '..Oo.RrGrRq.....',
    '..oV.QRBRRQq....',
    '.....qRrRq......',
    '....qRRRRRq.....',
    '....qRr..rRq....',
    '....qRr..rRq....',
    '....lL....Ll....',
    '....lL....Ll....',
    '................',
  ],
};

const WARLOCK: SpriteDefinition = {
  palette: {
    // Hood (3 shades — deep purple/black)
    H: '#483868', // hood highlight
    h: '#302050', // hood mid
    J: '#201038', // hood dark
    // Skin (2 shades — pale)
    S: '#e0d0c0', // skin lit (pale)
    s: '#b8a898', // skin shadow
    // Eyes (eldritch glow)
    E: '#a848d8', // purple eye glow
    // Robe (4 shades — dark purple)
    P: '#584078', // robe highlight
    p: '#402858', // robe mid
    Q: '#281840', // robe shadow
    q: '#180c28', // robe deepest
    // Eldritch symbols (2 shades — green glow)
    G: '#48d868', // symbol bright
    g: '#28a848', // symbol dim
    // Dark energy (2 shades)
    O: '#8838c8', // energy bright
    o: '#5828a0', // energy dim
    // Belt (2 shades)
    B: '#302030', // belt dark
    b: '#483050', // belt lit
    // Boots (2 shades)
    L: '#383048', // boot lit
    l: '#282038', // boot shadow
    // Tome
    T: '#582838', // tome cover
  },
  pixels: [
    '................',
    '.....JhHhJ......',
    '....JhHHHhJ.....',
    '....JhHHHhJ.....',
    '....JsSESsJ.....',
    '......sSs.......',
    '....qPpBpPq.....',
    '..Oo.PPBPPp.....',
    '..oT.pPGPpQ.....',
    '.....QPgPQ......',
    '....qPPPPPq.....',
    '....qPp..pPq....',
    '....qPp..pPq....',
    '....lL....Ll....',
    '....lL....Ll....',
    '................',
  ],
};


const BLACK_BEAR: SpriteDefinition = {
  palette: {
    // Dark fur (4 shades)
    F: '#484848', // fur highlight
    f: '#343434', // fur mid
    G: '#242424', // fur shadow
    g: '#181818', // fur deepest
    // Brown muzzle (3 shades)
    B: '#a08060', // muzzle highlight
    b: '#806048', // muzzle mid
    M: '#604830', // muzzle shadow
    // Eyes
    E: '#1c1c1c', // dark eye
    // Eye shine
    S: '#c0c0c0', // eye glint
    // Nose
    N: '#101010', // nose black
    // Ears (2 shades)
    R: '#383838', // ear outer
    r: '#282828', // ear inner
    // Claws
    C: '#a0a098', // claw pale
    // Belly (2 shades)
    W: '#505050', // belly lit
    w: '#383838', // belly shadow
  },
  pixels: [
    '................',
    '................',
    '................',
    '...Rr....rR.....',
    '..gFFffffFFGg...',
    '.gGFFffffFFGGg..',
    '.GFSFBBBFEFGGg..',
    '.GFFBNNNBFFGgg..',
    '..FFFbbbFFFfGg..',
    '.gFFFFFFFFFfGg..',
    '.GFWWWWWWWFGGg..',
    '.GfwFFFFFwfGgg..',
    '.gCffFF.FffCgg..',
    '.gCfGG..GfCggg..',
    '................',
    '................',
  ],
};

const CROCODILE: SpriteDefinition = {
  palette: {
    // Scales (4 shades)
    S: '#8a9848', // scales highlight
    s: '#6a7838', // scales mid
    N: '#4a5828', // scales shadow
    n: '#384420', // scales deepest
    // Belly (2 shades)
    B: '#c8b878', // belly bright
    b: '#a09058', // belly dim
    // Eyes
    E: '#d8c020', // yellow eye
    // Pupil
    P: '#181810', // slit pupil
    // Teeth (2 shades)
    T: '#f0e8d0', // teeth bright
    t: '#d0c8a8', // teeth dim
    // Jaw inner
    R: '#c04838', // mouth red
    // Ridge (2 shades)
    D: '#7a8838', // ridge highlight
    d: '#5a6830', // ridge shadow
    // Claws
    C: '#888868', // claws
    // Tail tip
    K: '#506028', // tail dark
  },
  pixels: [
    '................',
    '................',
    '................',
    '................',
    '..nDdDdDdDdn....',
    '.nNDdDdDdDdNn...',
    '.nSSSSSSSSSSsKK.',
    '.EPSSSSSSSsSsKKK',
    '.nTTRRRRsSsssKK.',
    '.ntTRRRssBBbsKK.',
    '..NsSSSBBBbsNKK.',
    '..nCsss.sssCnK..',
    '..nCss...sCn....',
    '................',
    '................',
    '................',
  ],
};

const WORG: SpriteDefinition = {
  palette: {
    // Dark fur (4 shades)
    F: '#787878', // fur highlight
    f: '#585858', // fur mid
    G: '#383838', // fur shadow
    g: '#202020', // fur deepest
    // Red eyes (2 shades)
    E: '#ff2020', // eye bright
    e: '#cc0000', // eye dark
    // Teeth (2 shades)
    T: '#f0f0e0', // teeth bright
    t: '#d0d0b8', // teeth shadow
    // Nose
    N: '#101010', // nose
    // White markings (2 shades)
    W: '#b0b0b0', // marking bright
    w: '#888888', // marking dim
    // Tail (2 shades)
    A: '#606060', // tail lit
    a: '#404040', // tail shadow
    // Claws
    C: '#909088', // claw pale
    // Ears
    R: '#804040', // ear inner
    // Belly
    B: '#686868', // belly
  },
  pixels: [
    '................',
    '................',
    '................',
    '..gR....Rg......',
    '..gFGffGFFAa....',
    '.gFFffffFFfAa...',
    '.GEFNNNNFEf.Aa..',
    '.gTTTTTTTTf..a..',
    '..tFFFFFFFfA....',
    '.gGFFFFFFFfGa...',
    '.GGfBFFFBffGa...',
    '.Gg.CfFf.CGg....',
    '.gg.CfGf.Cgg....',
    '.g..Cg...Cg.....',
    '................',
    '................',
  ],
};

const ORC: SpriteDefinition = {
  palette: {
    // Green skin (4 shades)
    G: '#78b058', // skin highlight
    g: '#589840', // skin mid
    N: '#408030', // skin shadow
    n: '#286020', // skin deepest
    // Eyes (2 shades)
    E: '#ff3030', // eye bright
    e: '#cc1010', // eye dim
    // Tusks (2 shades)
    T: '#f0e8c8', // tusk bright
    t: '#d0c8a0', // tusk shadow
    // Iron armor (4 shades)
    A: '#909098', // armor highlight
    a: '#686870', // armor mid
    B: '#484850', // armor shadow
    b: '#303038', // armor deepest
    // Leather (2 shades)
    L: '#785838', // leather lit
    l: '#503820', // leather dark
    // Greataxe (3 shades)
    W: '#c0c0c8', // axe blade bright
    w: '#888890', // axe blade mid
    H: '#685038', // axe handle
    // Hair
    K: '#202018', // hair dark
    // Belt
    D: '#403020', // belt
  },
  pixels: [
    '....KKKKKn......',
    '...nGGGGGGn.....',
    '...gGGGGGGgn....',
    '...NGEgNEGNn....',
    '...NgTGGtgN.....',
    '....NGGGGNg.....',
    '..W.BaADAaBn....',
    '.Ww.aAAAAaBn....',
    '.wH.aAAAaaBn....',
    '..H.BaAaaBb.....',
    '..H..BLLB.......',
    '.....NLDLNn.....',
    '.....Ng..gN.....',
    '.....ng..gn.....',
    '.....ll..ll.....',
    '................',
  ],
};


const HELL_HOUND: SpriteDefinition = {
  palette: {
    // Black fur (4 shades)
    B: '#484848', // fur highlight
    b: '#303030', // fur mid
    D: '#1c1c1c', // fur shadow
    d: '#0e0e0e', // fur deepest
    // Fire orange (3 shades)
    F: '#ff8820', // flame bright
    f: '#e05800', // flame mid
    O: '#b83800', // flame deep
    // Fire red (2 shades)
    R: '#ff3020', // fire red bright
    r: '#c01810', // fire red dark
    // Eyes
    E: '#ff0000', // glowing red eye
    // Ember glow (2 shades)
    G: '#ffcc00', // ember bright
    g: '#ff9900', // ember mid
    // Teeth
    T: '#e8e0d0', // teeth
    // Paws
    P: '#383838', // paw dark
    // Smoke
    S: '#604838', // smoke wisp
  },
  pixels: [
    '................',
    '................',
    '....d....d......',
    '....dS..SdGGf...',
    '...dBBbbBBdggF..',
    '...BEBffBEBfFg..',
    '...BBTrrTBBOFf..',
    '....BBRRBBbfg...',
    '...bBBBBBBBbd...',
    '..fFBBBBBBBDd...',
    '..gfDBBbBBBd.f..',
    '...dDBBbBBBd.g..',
    '...dPb..bPd.....',
    '...dPb..bPd.....',
    '................',
    '................',
  ],
};

const MANTICORE: SpriteDefinition = {
  palette: {
    // Tawny lion fur (4 shades)
    F: '#e8b868', // fur highlight
    f: '#c89848', // fur mid
    G: '#a07838', // fur shadow
    g: '#785828', // fur deepest
    // Wing membrane (3 shades)
    W: '#886858', // wing highlight
    w: '#604838', // wing mid
    M: '#483028', // wing dark
    // Mane (2 shades)
    H: '#c88838', // mane bright
    h: '#905818', // mane dark
    // Face skin (2 shades)
    S: '#e8c8a0', // face lit
    s: '#c0a070', // face shadow
    // Eyes
    E: '#ff4040', // red eye
    // Teeth
    T: '#f0e8d8', // teeth
    // Tail spikes (2 shades)
    K: '#786060', // spike lit
    k: '#584040', // spike dark
    // Tail (2 shades)
    A: '#b09048', // tail lit
    a: '#887038', // tail dark
  },
  pixels: [
    '................',
    '................',
    '...hHHHh......Kk',
    '..gSSSSSg....kAK',
    '..gSESESg..kaAak',
    '..gssTTsg.kAaag.',
    '.W.gSSSSgAaag...',
    'Ww.gFFFFFfGg....',
    'wM.GFFFFFFGg....',
    '.M.G.FfFf.Gg....',
    '..MG.Gff..Gg....',
    '....gGf..fGg....',
    '....gGf..fGg....',
    '....gg....gg....',
    '................',
    '................',
  ],
};

const HILL_GIANT: SpriteDefinition = {
  palette: {
    // Ruddy skin (4 shades)
    S: '#d8a878', // skin highlight
    s: '#c08858', // skin mid
    N: '#a07048', // skin shadow
    n: '#805838', // skin deepest
    // Hide clothing (3 shades)
    L: '#a08050', // hide highlight
    l: '#786038', // hide mid
    M: '#584028', // hide dark
    // Club wood (3 shades)
    C: '#b89060', // club highlight
    c: '#907040', // club mid
    D: '#685030', // club dark
    // Eyes
    E: '#382818', // dark beady eye
    // Teeth
    T: '#e8e0c8', // teeth
    // Jaw/brow ridge
    J: '#987058', // brow
    // Belt
    B: '#504030', // belt
    // Toenails
    W: '#c0b898', // nail
  },
  pixels: [
    '...nnNNNNnn.....',
    '...nSSSSSSn.....',
    '...SSESsESS.....',
    '...SsJTTJsS.....',
    '....SSTTSS......',
    '...nSSSSSSn.....',
    '..CnSSSSSSSnc...',
    '..cDsSLLLSSsDc..',
    '..D.sSBBBSSs....',
    '....NsLLLsNn....',
    '...NsLLLLLsN....',
    '...NSSss.SSN....',
    '...nSSs..SSn....',
    '..nnNNs..NNnn...',
    '..WNN....NNW....',
    '................',
  ],
};

const YOUNG_GREEN_DRAGON: SpriteDefinition = {
  palette: {
    // Forest green scales (4 shades)
    G: '#58b848', // scale highlight
    g: '#389030', // scale mid
    N: '#207020', // scale shadow
    n: '#105010', // scale deepest
    // Belly scales (2 shades)
    B: '#90d868', // belly highlight
    b: '#70b850', // belly mid
    // Wing membrane (2 shades)
    W: '#308828', // wing lit
    w: '#186818', // wing dark
    // Horns (2 shades)
    H: '#c8b878', // horn bright
    h: '#988848', // horn dark
    // Eyes
    E: '#ffcc00', // amber eye
    // Claws
    C: '#889868', // claw
    // Poison breath (3 shades)
    P: '#80ff60', // poison bright
    p: '#40cc30', // poison mid
    V: '#209818', // poison dim
    // Teeth
    T: '#e0e8d0', // teeth
  },
  pixels: [
    '................',
    '..H..........h..',
    '..HgGGGg....hN..',
    '..nGEGGGgWwNn...',
    '...GGTGGgWwn....',
    '.PpgGGGGGgNn....',
    '.pV.nGBBGGgn....',
    '....nGBbBGgn....',
    '....NgGGGGNn....',
    '...WNgGGGGNnw...',
    '...wN.gGg.Nn.w..',
    '....n.gGg..nN...',
    '....n.Cg...nNn..',
    '....n.Cg....nn..',
    '..........nnN...',
    '................',
  ],
};

// ── Ambient Creature Sprites ─────────────────────────────────

const AMBIENT_CAT: SpriteDefinition = {
  palette: {
    B: '#584838', // body dark
    b: '#786858', // body mid
    F: '#a09080', // body light/belly
    E: '#40c840', // eye green
    N: '#382820', // nose/mouth
    T: '#584838', // tail
    W: '#c8c0b0', // whisker
  },
  pixels: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '......Bb.bB.....',
    '......BEEB......',
    '.......NF.......',
    '......WbFW......',
    '.....BbbFbB.....',
    '......bFFb......',
    '......b..b......',
    '.....T..........',
    '................',
    '................',
    '................',
  ],
};

const AMBIENT_DOG: SpriteDefinition = {
  palette: {
    B: '#8a6a40', // body golden
    b: '#6a5030', // body shadow
    F: '#c8a870', // belly/chest light
    E: '#201810', // eye dark
    N: '#302018', // nose
    T: '#8a6a40', // tail
    R: '#604020', // ear
  },
  pixels: [
    '................',
    '................',
    '................',
    '................',
    '.....Rb..bR.....',
    '.....RBBBR......',
    '......BEEB......',
    '.......N........',
    '......BFFB......',
    '.....BbFFbB.....',
    '.....bBFFBb.....',
    '......b..b......',
    '......b..b......',
    '.........T......',
    '................',
    '................',
  ],
};

const AMBIENT_CHICKEN: SpriteDefinition = {
  palette: {
    B: '#c8b890', // body cream
    b: '#a09070', // body shadow
    W: '#e8e0d0', // wing white
    R: '#c83020', // comb red
    Y: '#d8a830', // beak yellow
    E: '#181010', // eye
    L: '#c87828', // legs orange
  },
  pixels: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.......R........',
    '......BRB.......',
    '......BEB.......',
    '.......Y........',
    '......bWb.......',
    '.....bBWBb......',
    '......b.b.......',
    '......L.L.......',
    '................',
    '................',
  ],
};

const AMBIENT_RAT: SpriteDefinition = {
  palette: {
    B: '#585048', // body grey-brown
    b: '#403830', // body dark
    F: '#787068', // belly
    E: '#100808', // eye
    N: '#c88888', // nose pink
    T: '#c8a8a0', // tail pink
  },
  pixels: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.......bBb......',
    '......bBEB......',
    '.......NF.......',
    '......bFFb......',
    '......b..b......',
    '...........T....',
    '................',
    '................',
  ],
};

// ── Special Character Sprites ────────────────────────────────

const NAELIA: SpriteDefinition = {
  palette: {
    // Silver hair (4 shades — strand texture via alternating bright/shadow)
    A: '#e8e0f0', // hair brightest silver
    H: '#c8c0d8', // hair mid silver
    h: '#9890a8', // hair shadow
    j: '#585080', // hair darkest edge
    // White divine gown (3 shades)
    W: '#f0e8f0', // gown highlight — divine white
    w: '#d0c8d8', // gown mid
    X: '#a8a0b0', // gown shadow / fold
    // Dark cloak (3 shades)
    C: '#4c5c78', // cloak highlight
    c: '#283858', // cloak mid navy
    D: '#1c2840', // cloak deepest
    // Skin (2 shades)
    S: '#f0c8a0', // skin lit
    s: '#d0a078', // skin shadow
    // Eyes
    E: '#40c8d8', // iris cyan
    B: '#182030', // brow / pupil
    // Gold accents (2 shades)
    G: '#f0c850', // gold bright
    g: '#c09830', // gold shadow
    // Gem
    T: '#40d0e0', // gem bright cyan
    // Belt
    L: '#3c6480', // belt leather
    // Lips
    M: '#d08880', // mouth
    // Shoes
    P: '#c04030', // shoe red
  },
  pixels: [
    '................', // 00
    '.....hHAHHh.....', // 01 hair top
    '....hHAHAHAh....', // 02 hair wider
    '...hhSSSSSShhh..', // 03 forehead, hair frames
    '...hSSESSESSh...', // 04 eyes — cyan
    '...hhSSSSSShh...', // 05 chin
    '...h.sSSSs.h....', // 06 neck, hair drapes
    '..hXwWWWWwXh....', // 07 shoulders, hair sides
    '..hXWWWWWWwXh...', // 08 upper torso
    '..hXgGTTGgXh....', // 09 belt with gems
    '..hXWWWWWWwXh...', // 10 upper skirt
    '...XwWWWWwwX....', // 11 mid skirt
    '...XwWWWWwwX....', // 12 lower
    '...XXwwwwXX.....', // 13 hem
    '......Ss.sS.....', // 14 feet
    '................', // 15
  ],
};

// ── Sprite Registry ──────────────────────────────────────────

const SPRITE_REGISTRY: Record<string, SpriteDefinition> = {
  // Special characters
  naelia:           NAELIA,
  god:              NAELIA,
  // Player classes
  fighter:          FIGHTER,
  wizard:           WIZARD,
  rogue:            ROGUE,
  cleric:           CLERIC,
  barbarian:        BARBARIAN,
  bard:             BARD,
  druid:            DRUID,
  monk:             MONK,
  paladin:          PALADIN,
  ranger:           RANGER,
  sorcerer:         SORCERER,
  warlock:          WARLOCK,
  // NPCs
  npc_innkeeper:    NPC_INNKEEPER,
  npc_merchant:     NPC_MERCHANT,
  npc_blacksmith:   NPC_BLACKSMITH,
  npc_priest:       NPC_PRIEST,
  npc_guard:        NPC_GUARD,
  npc_commoner:     NPC_COMMONER,
  npc_noble:        NPC_NOBLE,
  npc_banker:       NPC_BANKER,
  // Ambient creatures
  ambient_cat:      AMBIENT_CAT,
  ambient_dog:      AMBIENT_DOG,
  ambient_chicken:  AMBIENT_CHICKEN,
  ambient_rat:      AMBIENT_RAT,
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
  monster_bat:              BAT,
  monster_hawk:             HAWK,
  monster_poisonous_snake:  POISONOUS_SNAKE,
  monster_skeleton_warrior: SKELETON_WARRIOR,
  monster_ogre_zombie:      OGRE_ZOMBIE,
  monster_werewolf:         WEREWOLF,
  monster_basilisk:         BASILISK,
  monster_owlbear_cub:      OWLBEAR_CUB,
  monster_gelatinous_cube:  GELATINOUS_CUBE,
  monster_wraith:           WRAITH,
  monster_ghast:            GHAST,
  monster_minotaur:         MINOTAUR,
  monster_hell_hound:        HELL_HOUND,
  monster_manticore:         MANTICORE,
  monster_hill_giant:        HILL_GIANT,
  monster_young_green_dragon: YOUNG_GREEN_DRAGON,
  monster_ghoul:            GHOUL,
  monster_bugbear:          BUGBEAR,
  monster_mimic:            MIMIC,
  monster_gargoyle:         GARGOYLE,
  monster_black_bear:       BLACK_BEAR,
  monster_crocodile:        CROCODILE,
  monster_worg:             WORG,
  monster_orc:              ORC,
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
  private imageBitmapCache = new Map<string, ImageBitmap>();

  /** Check if a sprite exists for the given ID (text or image). */
  has(id: string): boolean {
    return id in IMAGE_SPRITE_REGISTRY || id in SPRITE_REGISTRY;
  }

  /**
   * Preload all PNG image sprites into ImageBitmap cache.
   * Call once at game startup before any rendering occurs.
   */
  async preloadImages(): Promise<void> {
    const loads = Object.entries(IMAGE_SPRITE_REGISTRY).map(async ([id, def]) => {
      if (this.imageBitmapCache.has(id)) return;
      try {
        const resp = await fetch(def.src);
        const blob = await resp.blob();
        const bitmap = await createImageBitmap(blob);
        this.imageBitmapCache.set(id, bitmap);
      } catch {
        // Silently skip — will fall back to text sprite if available
      }
    });
    await Promise.all(loads);
  }

  /** Get or create the cached canvas for a text-encoded sprite (with auto-outline). */
  private getSpriteCanvas(id: string): HTMLCanvasElement | null {
    if (this.cache.has(id)) return this.cache.get(id)!;

    const def = SPRITE_REGISTRY[id];
    if (!def) return null;

    const size = def.size ?? 16;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.createImageData(size, size);
    const data = imageData.data;

    // Render sprite pixels
    for (let y = 0; y < size; y++) {
      const row = def.pixels[y] ?? '';
      for (let x = 0; x < size; x++) {
        const ch = row[x];
        if (!ch || ch === '.') continue;
        const color = def.palette[ch];
        if (!color) continue;
        const [r, g, b, a] = hexToRGBA(color);
        const idx = (y * size + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = a;
      }
    }

    // Auto-generate outline
    applyAutoOutline(data, size, size);

    ctx.putImageData(imageData, 0, 0);
    this.cache.set(id, canvas);
    return canvas;
  }

  /**
   * Draw a sprite onto a canvas context, scaled to fill the target rect.
   * PNG ImageBitmap sprites are drawn with smoothing (they're high-res).
   * Text-encoded sprites use nearest-neighbor for crisp pixel art.
   */
  renderSprite(
    ctx: CanvasRenderingContext2D,
    id: string,
    x: number,
    y: number,
    w: number,
    h: number,
  ): boolean {
    // PNG image sprite takes priority — nearest-neighbor for pixel art look
    const bitmap = this.imageBitmapCache.get(id);
    if (bitmap) {
      const prev = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(bitmap, x, y, w, h);
      ctx.imageSmoothingEnabled = prev;
      return true;
    }

    // Fall back to text-encoded sprite
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
    const dpr = window.devicePixelRatio || 1;
    const canvas = document.createElement('canvas');
    canvas.width = displaySize * dpr;
    canvas.height = displaySize * dpr;
    canvas.style.width = `${displaySize}px`;
    canvas.style.height = `${displaySize}px`;
    canvas.style.imageRendering = 'pixelated';
    const ctx = canvas.getContext('2d')!;

    // PNG image sprite — nearest-neighbor for pixel art look
    const bitmap = this.imageBitmapCache.get(id);
    if (bitmap) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      return canvas;
    }

    // Text-encoded sprite
    const src = this.getSpriteCanvas(id);
    if (!src) return null;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  /** Clear the cache (e.g. on theme change). */
  clearCache(): void {
    this.cache.clear();
    // ImageBitmaps are permanent — no need to re-fetch on theme change
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
