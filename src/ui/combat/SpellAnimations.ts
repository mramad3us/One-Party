import type { Spell } from '@/types/spell';
import type { Coordinate } from '@/types';

/* ================================================================
   ONE PARTY — Spell Animation System
   DOM-based particle effects using Web Animations API.
   Each spell maps to a visual category; intensity scales with level.
   ================================================================ */

type SpellVisual =
  | 'projectile' | 'missile' | 'explosion' | 'wave' | 'beam'
  | 'radiance' | 'impact' | 'heal' | 'aura' | 'dark'
  | 'enchant' | 'storm' | 'word';

interface Colors {
  primary: string;
  secondary: string;
  glow: string;
}

interface Intensity {
  level: number;
  particles: number;
  duration: number;
  scale: number;
  shake: number;
  windupMs: number;
  trailCount: number;
}

/** Callback that converts a grid coordinate to screen-space pixel center. */
export type GridToScreen = (pos: Coordinate) => { x: number; y: number };

/* ── Helpers ───────────────────────────────────────────────── */

function angleBetween(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function wait(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

/* ── Intensity by spell level ─────────────────────────────── */

function getIntensity(level: number): Intensity {
  return {
    level,
    particles: 2 + level * 2,
    duration: 400 + level * 80,
    scale: 0.8 + level * 0.15,
    shake: Math.max(0, level - 1),
    windupMs: 150 + level * 30,
    trailCount: Math.min(8, 2 + level),
  };
}

/* ── Visual type mapping ──────────────────────────────────── */

const VISUAL_OVERRIDES: Partial<Record<string, SpellVisual>> = {
  spell_magic_missile: 'missile',
  spell_lightning_bolt: 'beam',
  spell_chain_lightning: 'storm',
  spell_meteor_swarm: 'storm',
  spell_call_lightning: 'storm',
  spell_sunbeam: 'beam',
  spell_moonbeam: 'radiance',
  spell_flame_strike: 'radiance',
  spell_sacred_flame: 'radiance',
  spell_guiding_bolt: 'radiance',
  spell_spiritual_weapon: 'radiance',
  spell_power_word_kill: 'word',
  spell_power_word_stun: 'word',
  spell_prismatic_spray: 'storm',
  spell_fire_storm: 'storm',
  spell_scorching_ray: 'missile',
  spell_eldritch_blast: 'projectile',
  spell_witch_bolt: 'beam',
  spell_disintegrate: 'beam',
  spell_finger_of_death: 'dark',
  spell_circle_of_death: 'dark',
  spell_blight: 'dark',
  spell_animate_dead: 'dark',
  spell_bestow_curse: 'dark',
  spell_prismatic_wall: 'aura',
  spell_globe_of_invulnerability: 'aura',
  spell_antimagic_field: 'aura',
};

function getVisualType(spell: Spell): SpellVisual {
  if (VISUAL_OVERRIDES[spell.id]) return VISUAL_OVERRIDES[spell.id]!;

  if (spell.effects.some(e => e.healing)) return 'heal';
  if (spell.targetType === 'self' && !spell.effects.some(e => e.damage)) return 'aura';

  if (['sphere', 'cube', 'cylinder'].includes(spell.targetType) && spell.effects.some(e => e.areaSize || e.damage)) return 'explosion';
  if (spell.targetType === 'cone') return 'wave';
  if (spell.targetType === 'line') return 'beam';
  if (spell.targetType === 'area' && spell.effects.some(e => e.damage)) return 'explosion';

  const dmgType = spell.effects.find(e => e.damage)?.damage?.type;
  if (dmgType === 'necrotic') return 'dark';
  if (dmgType === 'radiant') return 'radiance';
  if (dmgType === 'psychic') return 'enchant';

  if (spell.range === -1 || spell.targetType === 'touch') return 'impact';
  if (spell.targetType === 'single' && spell.range > 0) return 'projectile';
  if (['enchantment'].includes(spell.school) && spell.effects.some(e => e.condition)) return 'enchant';

  if (spell.targetType === 'self') return 'aura';
  return 'projectile';
}

/* ── Color palettes ───────────────────────────────────────── */

const DMG_COLORS: Record<string, Colors> = {
  fire:      { primary: '#ff6600', secondary: '#ff3300', glow: 'rgba(255,100,0,0.6)' },
  cold:      { primary: '#88ccff', secondary: '#4499ff', glow: 'rgba(100,180,255,0.6)' },
  lightning: { primary: '#ffff66', secondary: '#ccddff', glow: 'rgba(255,255,100,0.7)' },
  thunder:   { primary: '#9977cc', secondary: '#6644aa', glow: 'rgba(150,120,200,0.5)' },
  acid:      { primary: '#44dd44', secondary: '#22aa22', glow: 'rgba(60,200,60,0.6)' },
  poison:    { primary: '#88cc44', secondary: '#668833', glow: 'rgba(130,200,60,0.5)' },
  necrotic:  { primary: '#aa66cc', secondary: '#772288', glow: 'rgba(150,80,180,0.5)' },
  radiant:   { primary: '#ffdd44', secondary: '#ffcc00', glow: 'rgba(255,220,60,0.7)' },
  force:     { primary: '#8888ff', secondary: '#6666dd', glow: 'rgba(130,130,255,0.5)' },
  psychic:   { primary: '#dd66dd', secondary: '#bb22bb', glow: 'rgba(220,100,220,0.5)' },
};

const SCHOOL_COLORS: Record<string, Colors> = {
  abjuration:    { primary: '#66aaff', secondary: '#4488dd', glow: 'rgba(100,170,255,0.5)' },
  conjuration:   { primary: '#ffaa44', secondary: '#dd8822', glow: 'rgba(255,170,60,0.5)' },
  divination:    { primary: '#aaddff', secondary: '#88bbdd', glow: 'rgba(170,220,255,0.4)' },
  enchantment:   { primary: '#ff88cc', secondary: '#dd66aa', glow: 'rgba(255,130,200,0.5)' },
  evocation:     { primary: '#ff6644', secondary: '#dd4422', glow: 'rgba(255,100,60,0.6)' },
  illusion:      { primary: '#cc88ff', secondary: '#aa66dd', glow: 'rgba(200,130,255,0.5)' },
  necromancy:    { primary: '#88aa66', secondary: '#668844', glow: 'rgba(130,170,100,0.4)' },
  transmutation: { primary: '#ddaa44', secondary: '#bb8822', glow: 'rgba(220,170,60,0.5)' },
};

function getColors(spell: Spell): Colors {
  const dmgType = spell.effects.find(e => e.damage)?.damage?.type;
  if (dmgType && DMG_COLORS[dmgType]) return DMG_COLORS[dmgType];
  if (spell.effects.some(e => e.healing)) return { primary: '#44ddaa', secondary: '#22aa77', glow: 'rgba(60,220,160,0.6)' };
  return SCHOOL_COLORS[spell.school] ?? { primary: '#cccccc', secondary: '#999999', glow: 'rgba(200,200,200,0.4)' };
}

/* ================================================================
   SpellAnimationSystem
   ================================================================ */

export class SpellAnimationSystem {
  private container: HTMLElement;
  private screenEl: HTMLElement;
  private gridToScreen: GridToScreen;

  constructor(container: HTMLElement, screenEl: HTMLElement, gridToScreen: GridToScreen) {
    this.container = container;
    this.screenEl = screenEl;
    this.gridToScreen = gridToScreen;
  }

  /* ── Main entry ─────────────────────────────────────────── */

  async playSpellCast(
    spell: Spell,
    casterPos: Coordinate,
    targetPos: Coordinate | null,
    level: number,
  ): Promise<void> {
    const visual = getVisualType(spell);
    const colors = getColors(spell);
    const int = getIntensity(level);
    const caster = this.gridToScreen(casterPos);
    const target = targetPos ? this.gridToScreen(targetPos) : caster;

    await this.windup(caster, colors, int);

    switch (visual) {
      case 'projectile': await this.projectile(caster, target, colors, int); break;
      case 'missile':    await this.missiles(caster, target, colors, int); break;
      case 'explosion':  await this.explosion(target, colors, int); this.shakeScreen(int.shake); break;
      case 'wave':       await this.wave(caster, colors, int); this.shakeScreen(Math.ceil(int.shake * 0.7)); break;
      case 'beam':       await this.beam(caster, target, colors, int); break;
      case 'radiance':   await this.radiance(target, colors, int); break;
      case 'impact':     await this.impact(target, colors, int); break;
      case 'heal':       await this.heal(target, colors, int); break;
      case 'aura':       await this.aura(caster, colors, int); break;
      case 'dark':       await this.dark(target, colors, int); break;
      case 'enchant':    await this.enchant(target, colors, int); break;
      case 'storm':      await this.storm(caster, target, colors, int); this.shakeScreen(int.shake); break;
      case 'word':       await this.powerWord(caster, colors, int); this.shakeScreen(Math.ceil(int.shake * 0.5)); break;
    }
  }

  /* ── Critical Hit Overlay ───────────────────────────────── */

  async showCriticalHit(): Promise<void> {
    const overlay = document.createElement('div');
    overlay.className = 'crit-hit-overlay';

    const text = document.createElement('div');
    text.className = 'crit-hit-text';
    text.textContent = 'CRITICAL HIT!';
    overlay.appendChild(text);

    document.body.appendChild(overlay);

    overlay.animate([
      { opacity: '0', background: 'radial-gradient(circle,transparent 30%,rgba(180,30,10,0.5) 100%)' },
      { opacity: '1', background: 'radial-gradient(circle,transparent 40%,rgba(180,30,10,0.35) 100%)', offset: 0.08 },
      { opacity: '1', background: 'radial-gradient(circle,transparent 50%,rgba(140,20,5,0.2) 100%)', offset: 0.2 },
      { opacity: '1', background: 'radial-gradient(circle,transparent 60%,rgba(100,10,0,0.1) 100%)', offset: 0.35 },
      { opacity: '1', background: 'transparent', offset: 0.5 },
      { opacity: '1', background: 'transparent', offset: 0.7 },
      { opacity: '0', background: 'transparent' },
    ], { duration: 1400, easing: 'ease-out', fill: 'forwards' });

    text.animate([
      { transform: 'scale(0) rotate(-10deg)', opacity: '0', filter: 'blur(8px)' },
      { transform: 'scale(2.4) rotate(2deg)', opacity: '1', filter: 'blur(0px)', offset: 0.1 },
      { transform: 'scale(1.8) rotate(-1deg)', opacity: '1', filter: 'blur(0px)', offset: 0.18 },
      { transform: 'scale(2.1) rotate(0.5deg)', opacity: '1', filter: 'blur(0px)', offset: 0.28 },
      { transform: 'scale(2.0) rotate(0deg)', opacity: '1', filter: 'blur(0px)', offset: 0.4 },
      { transform: 'scale(2.0) rotate(0deg)', opacity: '1', filter: 'blur(0px)', offset: 0.55 },
      { transform: 'scale(2.0) rotate(0deg)', opacity: '1', filter: 'blur(0px)', offset: 0.65 },
      { transform: 'scale(2.1) rotate(-0.5deg)', opacity: '0.9', filter: 'blur(0px)', offset: 0.75 },
      { transform: 'scale(2.3) rotate(0deg)', opacity: '0.5', filter: 'blur(2px)', offset: 0.88 },
      { transform: 'scale(2.8) rotate(0deg)', opacity: '0', filter: 'blur(6px)' },
    ], { duration: 1400, easing: 'cubic-bezier(0.16,1,0.3,1)', fill: 'forwards' });

    this.shakeScreen(4);
    await wait(1400);
    overlay.remove();
  }

  /* ── Screen Shake ───────────────────────────────────────── */

  shakeScreen(intensity: number): void {
    if (intensity <= 0) return;
    const i = intensity;
    this.screenEl.animate([
      { transform: 'translate(0,0)' },
      { transform: `translate(${-i * 3}px,${i}px)`, offset: 0.1 },
      { transform: `translate(${i * 4}px,${-i * 2}px)`, offset: 0.2 },
      { transform: `translate(${-i * 2}px,${i * 3}px)`, offset: 0.3 },
      { transform: `translate(${i * 3}px,${-i}px)`, offset: 0.4 },
      { transform: `translate(${-i}px,${-i * 2}px)`, offset: 0.5 },
      { transform: `translate(${i * 2}px,${i}px)`, offset: 0.6 },
      { transform: `translate(${-i * 2}px,${-i}px)`, offset: 0.7 },
      { transform: `translate(${i}px,${i * 0.5}px)`, offset: 0.8 },
      { transform: `translate(${-i * 0.5}px,0)`, offset: 0.9 },
      { transform: 'translate(0,0)' },
    ], { duration: 200 + intensity * 80, easing: 'ease-out' });
  }

  /* ── Particle factory ───────────────────────────────────── */

  private particle(x: number, y: number, size: number, colors: Colors): HTMLElement {
    const p = document.createElement('div');
    p.style.cssText = `position:absolute;left:${x}px;top:${y}px;`
      + `width:${size}px;height:${size}px;border-radius:50%;`
      + `background:radial-gradient(circle at 35% 35%,#fff 0%,${colors.primary} 40%,${colors.secondary} 100%);`
      + `box-shadow:0 0 ${size * 1.5}px ${colors.glow},0 0 ${size * 3}px ${colors.glow};`
      + `pointer-events:none;transform:translate(-50%,-50%);will-change:transform,opacity;`;
    this.container.appendChild(p);
    return p;
  }

  private async animRemove(el: HTMLElement, keyframes: Keyframe[], opts: KeyframeAnimationOptions): Promise<void> {
    const anim = el.animate(keyframes, { ...opts, fill: 'forwards' });
    await anim.finished;
    el.remove();
  }

  /* ── Casting Windup ─────────────────────────────────────── */

  private async windup(
    pos: { x: number; y: number },
    colors: Colors,
    int: Intensity,
  ): Promise<void> {
    const size = 6 + int.level * 2;
    const p = this.particle(pos.x, pos.y, size, colors);
    await this.animRemove(p, [
      { transform: 'translate(-50%,-50%) scale(0)', opacity: '0' },
      { transform: 'translate(-50%,-50%) scale(1.5)', opacity: '1', offset: 0.25 },
      { transform: 'translate(-50%,-50%) scale(1.0)', opacity: '1', offset: 0.45 },
      { transform: 'translate(-50%,-50%) scale(1.4)', opacity: '0.8', offset: 0.6 },
      { transform: 'translate(-50%,-50%) scale(0.9)', opacity: '0.7', offset: 0.72 },
      { transform: 'translate(-50%,-50%) scale(1.3)', opacity: '0.5', offset: 0.82 },
      { transform: 'translate(-50%,-50%) scale(1.0)', opacity: '0.3', offset: 0.91 },
      { transform: 'translate(-50%,-50%) scale(0.6)', opacity: '0' },
    ], { duration: int.windupMs, easing: 'ease-out' });
  }

  /* ================================================================
     PROJECTILE — Fire Bolt, Ray of Frost, Acid Splash, Poison Spray
     Fast-traveling particle from caster → target with trailing sparks
     and an impact flash at arrival.
     ================================================================ */

  private async projectile(
    from: { x: number; y: number },
    to: { x: number; y: number },
    colors: Colors,
    int: Intensity,
  ): Promise<void> {
    const size = 8 + int.level * 2;
    const dur = 300 + int.level * 40;
    const dx = to.x - from.x;
    const dy = to.y - from.y;

    // Trailing sparks
    const trails: Promise<void>[] = [];
    for (let i = 0; i < int.trailCount; i++) {
      const delay = i * 25;
      const tSize = size * (0.25 + Math.random() * 0.3);
      trails.push((async () => {
        await wait(delay);
        const t = this.particle(from.x, from.y, tSize, { ...colors, primary: colors.secondary });
        t.style.opacity = '0.6';
        await this.animRemove(t, [
          { transform: 'translate(-50%,-50%) translate(0,0) scale(1)', opacity: '0.6' },
          { transform: `translate(-50%,-50%) translate(${dx * 0.25}px,${dy * 0.25}px) scale(0.8)`, opacity: '0.5', offset: 0.25 },
          { transform: `translate(-50%,-50%) translate(${dx * 0.5}px,${dy * 0.5}px) scale(0.6)`, opacity: '0.35', offset: 0.5 },
          { transform: `translate(-50%,-50%) translate(${dx * 0.7}px,${dy * 0.7}px) scale(0.4)`, opacity: '0.2', offset: 0.7 },
          { transform: `translate(-50%,-50%) translate(${dx * 0.85}px,${dy * 0.85}px) scale(0.2)`, opacity: '0.1', offset: 0.85 },
          { transform: `translate(-50%,-50%) translate(${dx}px,${dy}px) scale(0)`, opacity: '0' },
        ], { duration: dur + 50, easing: 'ease-in' });
      })());
    }

    // Main bolt
    const main = this.particle(from.x, from.y, size, colors);
    const mainP = this.animRemove(main, [
      { transform: 'translate(-50%,-50%) translate(0,0) scale(0.4)', opacity: '0.5' },
      { transform: 'translate(-50%,-50%) translate(0,0) scale(1.3)', opacity: '1', offset: 0.07 },
      { transform: `translate(-50%,-50%) translate(${dx * 0.08}px,${dy * 0.08}px) scale(1)`, opacity: '1', offset: 0.12 },
      { transform: `translate(-50%,-50%) translate(${dx * 0.22}px,${dy * 0.22}px) scale(1)`, opacity: '1', offset: 0.22 },
      { transform: `translate(-50%,-50%) translate(${dx * 0.4}px,${dy * 0.4}px) scale(1)`, opacity: '1', offset: 0.35 },
      { transform: `translate(-50%,-50%) translate(${dx * 0.6}px,${dy * 0.6}px) scale(1)`, opacity: '1', offset: 0.5 },
      { transform: `translate(-50%,-50%) translate(${dx * 0.78}px,${dy * 0.78}px) scale(1)`, opacity: '1', offset: 0.63 },
      { transform: `translate(-50%,-50%) translate(${dx * 0.9}px,${dy * 0.9}px) scale(1.1)`, opacity: '1', offset: 0.75 },
      { transform: `translate(-50%,-50%) translate(${dx * 0.97}px,${dy * 0.97}px) scale(1.3)`, opacity: '1', offset: 0.83 },
      { transform: `translate(-50%,-50%) translate(${dx}px,${dy}px) scale(2.5)`, opacity: '0.6', offset: 0.92 },
      { transform: `translate(-50%,-50%) translate(${dx}px,${dy}px) scale(3.5)`, opacity: '0' },
    ], { duration: dur, easing: 'cubic-bezier(0.12,0,0.39,0)' });

    // Impact flash
    const impactP = (async () => {
      await wait(dur * 0.8);
      const flash = this.particle(to.x, to.y, size * 3, colors);
      flash.style.background = `radial-gradient(circle,#fff 0%,${colors.primary} 50%,transparent 100%)`;
      flash.style.mixBlendMode = 'screen';
      await this.animRemove(flash, [
        { transform: 'translate(-50%,-50%) scale(0)', opacity: '1' },
        { transform: 'translate(-50%,-50%) scale(1.2)', opacity: '1', offset: 0.12 },
        { transform: 'translate(-50%,-50%) scale(1.8)', opacity: '0.7', offset: 0.3 },
        { transform: 'translate(-50%,-50%) scale(2.2)', opacity: '0.35', offset: 0.55 },
        { transform: 'translate(-50%,-50%) scale(2.5)', opacity: '0' },
      ], { duration: 200 + int.level * 25 });

      // Impact scatter sparks
      const scatterCount = Math.ceil(int.level * 0.8);
      const scatterP: Promise<void>[] = [];
      for (let s = 0; s < scatterCount; s++) {
        const sa = Math.random() * Math.PI * 2;
        const sr = 8 + Math.random() * 18;
        const sp = this.particle(to.x, to.y, 1.5 + Math.random() * 2, colors);
        scatterP.push(this.animRemove(sp, [
          { transform: 'translate(-50%,-50%) translate(0,0) scale(1)', opacity: '0.9' },
          { transform: `translate(-50%,-50%) translate(${Math.cos(sa) * sr * 0.6}px,${Math.sin(sa) * sr * 0.6}px) scale(0.6)`, opacity: '0.5', offset: 0.4 },
          { transform: `translate(-50%,-50%) translate(${Math.cos(sa) * sr}px,${Math.sin(sa) * sr}px) scale(0)`, opacity: '0' },
        ], { duration: 150 + Math.random() * 100, easing: 'ease-out' }));
      }
      await Promise.all(scatterP);
    })();

    await Promise.all([mainP, impactP, ...trails]);
  }

  /* ================================================================
     MISSILE — Magic Missile, Scorching Ray
     Multiple darts curving independently to the target.
     ================================================================ */

  private async missiles(
    from: { x: number; y: number },
    to: { x: number; y: number },
    colors: Colors,
    int: Intensity,
  ): Promise<void> {
    const count = Math.min(8, 3 + Math.floor(int.level / 2));
    const dur = 350 + int.level * 30;
    const dx = to.x - from.x;
    const dy = to.y - from.y;

    const darts: Promise<void>[] = [];
    for (let i = 0; i < count; i++) {
      darts.push((async () => {
        await wait(i * 70);
        const dart = this.particle(from.x, from.y, 5 + int.level, colors);

        const curve = (i - count / 2) * 18;
        const midX = dx / 2 + curve;
        const midY = dy / 2 - Math.abs(curve) * 0.6;

        await this.animRemove(dart, [
          { transform: 'translate(-50%,-50%) translate(0,0) scale(0.3)', opacity: '0' },
          { transform: 'translate(-50%,-50%) translate(0,0) scale(1)', opacity: '1', offset: 0.08 },
          { transform: `translate(-50%,-50%) translate(${midX * 0.3}px,${midY * 0.3}px) scale(1)`, opacity: '1', offset: 0.2 },
          { transform: `translate(-50%,-50%) translate(${midX * 0.7}px,${midY * 0.7}px) scale(1)`, opacity: '1', offset: 0.38 },
          { transform: `translate(-50%,-50%) translate(${midX}px,${midY}px) scale(1)`, opacity: '1', offset: 0.5 },
          { transform: `translate(-50%,-50%) translate(${dx * 0.65}px,${dy * 0.65}px) scale(1)`, opacity: '1', offset: 0.62 },
          { transform: `translate(-50%,-50%) translate(${dx * 0.8}px,${dy * 0.8}px) scale(1)`, opacity: '1', offset: 0.74 },
          { transform: `translate(-50%,-50%) translate(${dx * 0.93}px,${dy * 0.93}px) scale(1.3)`, opacity: '1', offset: 0.85 },
          { transform: `translate(-50%,-50%) translate(${dx}px,${dy}px) scale(2)`, opacity: '0.5', offset: 0.93 },
          { transform: `translate(-50%,-50%) translate(${dx}px,${dy}px) scale(0)`, opacity: '0' },
        ], { duration: dur, easing: 'ease-in' });
      })());
    }

    await Promise.all(darts);
  }

  /* ================================================================
     EXPLOSION — Fireball, Shatter, Circle of Death
     Core flash → expanding ring → outward sparks. Screen shakes.
     ================================================================ */

  private async explosion(
    pos: { x: number; y: number },
    colors: Colors,
    int: Intensity,
  ): Promise<void> {
    const maxR = 30 + int.level * 15;
    const dur = 500 + int.level * 60;

    // White-hot core
    const core = this.particle(pos.x, pos.y, 4, { ...colors, primary: '#ffffff' });
    core.style.mixBlendMode = 'screen';
    const coreP = this.animRemove(core, [
      { transform: 'translate(-50%,-50%) scale(0)', opacity: '1' },
      { transform: 'translate(-50%,-50%) scale(2)', opacity: '1', offset: 0.08 },
      { transform: 'translate(-50%,-50%) scale(5)', opacity: '0.9', offset: 0.15 },
      { transform: 'translate(-50%,-50%) scale(4)', opacity: '0.7', offset: 0.25 },
      { transform: 'translate(-50%,-50%) scale(3)', opacity: '0.5', offset: 0.4 },
      { transform: 'translate(-50%,-50%) scale(2)', opacity: '0.3', offset: 0.6 },
      { transform: 'translate(-50%,-50%) scale(1)', opacity: '0' },
    ], { duration: dur * 0.5 });

    // Expanding blast ring
    const ring = document.createElement('div');
    ring.style.cssText = `position:absolute;left:${pos.x}px;top:${pos.y}px;`
      + `width:${maxR * 2}px;height:${maxR * 2}px;border-radius:50%;`
      + `border:2px solid ${colors.primary};`
      + `background:radial-gradient(circle,${colors.glow} 0%,transparent 70%);`
      + `box-shadow:0 0 ${maxR * 0.6}px ${colors.glow},inset 0 0 ${maxR * 0.3}px ${colors.glow};`
      + `pointer-events:none;transform:translate(-50%,-50%) scale(0);will-change:transform,opacity;`;
    this.container.appendChild(ring);

    const ringP = this.animRemove(ring, [
      { transform: 'translate(-50%,-50%) scale(0)', opacity: '1' },
      { transform: 'translate(-50%,-50%) scale(0.15)', opacity: '1', offset: 0.06 },
      { transform: 'translate(-50%,-50%) scale(0.35)', opacity: '0.95', offset: 0.13 },
      { transform: 'translate(-50%,-50%) scale(0.55)', opacity: '0.85', offset: 0.22 },
      { transform: 'translate(-50%,-50%) scale(0.7)', opacity: '0.7', offset: 0.33 },
      { transform: 'translate(-50%,-50%) scale(0.82)', opacity: '0.55', offset: 0.45 },
      { transform: 'translate(-50%,-50%) scale(0.9)', opacity: '0.4', offset: 0.58 },
      { transform: 'translate(-50%,-50%) scale(0.95)', opacity: '0.25', offset: 0.72 },
      { transform: 'translate(-50%,-50%) scale(0.98)', opacity: '0.12', offset: 0.86 },
      { transform: 'translate(-50%,-50%) scale(1)', opacity: '0.05', offset: 0.94 },
      { transform: 'translate(-50%,-50%) scale(1.05)', opacity: '0' },
    ], { duration: dur, easing: 'cubic-bezier(0.22,1,0.36,1)' });

    // Outward sparks
    const sparks: Promise<void>[] = [];
    for (let i = 0; i < int.particles; i++) {
      const a = (i / int.particles) * Math.PI * 2 + Math.random() * 0.5;
      const r = maxR * (0.5 + Math.random() * 0.8);
      const sx = Math.cos(a) * r;
      const sy = Math.sin(a) * r;
      const sparkSize = 3 + Math.random() * 4;

      sparks.push((async () => {
        await wait(Math.random() * 60);
        const spark = this.particle(pos.x, pos.y, sparkSize, colors);
        await this.animRemove(spark, [
          { transform: 'translate(-50%,-50%) translate(0,0) scale(1)', opacity: '1' },
          { transform: `translate(-50%,-50%) translate(${sx * 0.2}px,${sy * 0.2}px) scale(1)`, opacity: '1', offset: 0.1 },
          { transform: `translate(-50%,-50%) translate(${sx * 0.45}px,${sy * 0.45}px) scale(0.9)`, opacity: '0.9', offset: 0.25 },
          { transform: `translate(-50%,-50%) translate(${sx * 0.65}px,${sy * 0.65}px) scale(0.7)`, opacity: '0.7', offset: 0.4 },
          { transform: `translate(-50%,-50%) translate(${sx * 0.8}px,${sy * 0.8}px) scale(0.5)`, opacity: '0.5', offset: 0.6 },
          { transform: `translate(-50%,-50%) translate(${sx}px,${sy}px) scale(0.2)`, opacity: '0' },
        ], { duration: dur * 0.7, easing: 'ease-out' });
      })());
    }

    // Drifting embers (lingering aftermath)
    const embers: Promise<void>[] = [];
    const emberCount = Math.ceil(int.particles * 0.4);
    for (let i = 0; i < emberCount; i++) {
      embers.push((async () => {
        await wait(dur * 0.3 + Math.random() * dur * 0.3);
        const ex = pos.x + (Math.random() - 0.5) * maxR * 1.2;
        const ey = pos.y + (Math.random() - 0.5) * maxR * 0.8;
        const ember = this.particle(ex, ey, 1.5 + Math.random() * 2, colors);
        const rise = 25 + Math.random() * 45;
        const drift = (Math.random() - 0.5) * 30;
        await this.animRemove(ember, [
          { transform: 'translate(-50%,-50%) translate(0,0) scale(1)', opacity: '0.8' },
          { transform: `translate(-50%,-50%) translate(${drift * 0.3}px,${-rise * 0.2}px) scale(0.9)`, opacity: '0.7', offset: 0.25 },
          { transform: `translate(-50%,-50%) translate(${drift * 0.6}px,${-rise * 0.5}px) scale(0.7)`, opacity: '0.5', offset: 0.5 },
          { transform: `translate(-50%,-50%) translate(${drift}px,${-rise}px) scale(0.3)`, opacity: '0' },
        ], { duration: 500 + Math.random() * 400, easing: 'ease-out' });
      })());
    }

    await Promise.all([coreP, ringP, ...sparks, ...embers]);
  }

  /* ================================================================
     WAVE — Thunderwave, Burning Hands, Cone of Cold
     Expanding arc emanating from the caster outward.
     ================================================================ */

  private async wave(
    pos: { x: number; y: number },
    colors: Colors,
    int: Intensity,
  ): Promise<void> {
    const maxR = 40 + int.level * 12;
    const dur = 400 + int.level * 50;

    const wave = document.createElement('div');
    wave.style.cssText = `position:absolute;left:${pos.x}px;top:${pos.y}px;`
      + `width:${maxR * 2}px;height:${maxR * 2}px;border-radius:50%;`
      + `background:conic-gradient(from -90deg,${colors.glow} 0deg,transparent 180deg,transparent 360deg);`
      + `pointer-events:none;transform:translate(-50%,-50%) scale(0);will-change:transform,opacity;`;
    this.container.appendChild(wave);

    const waveP = this.animRemove(wave, [
      { transform: 'translate(-50%,-50%) scale(0)', opacity: '1' },
      { transform: 'translate(-50%,-50%) scale(0.2)', opacity: '0.95', offset: 0.08 },
      { transform: 'translate(-50%,-50%) scale(0.4)', opacity: '0.85', offset: 0.17 },
      { transform: 'translate(-50%,-50%) scale(0.55)', opacity: '0.75', offset: 0.26 },
      { transform: 'translate(-50%,-50%) scale(0.68)', opacity: '0.6', offset: 0.36 },
      { transform: 'translate(-50%,-50%) scale(0.78)', opacity: '0.48', offset: 0.47 },
      { transform: 'translate(-50%,-50%) scale(0.87)', opacity: '0.35', offset: 0.58 },
      { transform: 'translate(-50%,-50%) scale(0.93)', opacity: '0.22', offset: 0.7 },
      { transform: 'translate(-50%,-50%) scale(0.97)', opacity: '0.1', offset: 0.84 },
      { transform: 'translate(-50%,-50%) scale(1)', opacity: '0.04', offset: 0.93 },
      { transform: 'translate(-50%,-50%) scale(1.05)', opacity: '0' },
    ], { duration: dur });

    // Forward-scatter particles
    const sparks: Promise<void>[] = [];
    for (let i = 0; i < int.particles; i++) {
      const a = Math.random() * Math.PI - Math.PI / 2;
      const r = maxR * (0.4 + Math.random() * 0.6);
      const sx = Math.cos(a) * r;
      const sy = Math.sin(a) * r;

      sparks.push((async () => {
        await wait(Math.random() * 80);
        const s = this.particle(pos.x, pos.y, 3 + Math.random() * 3, colors);
        await this.animRemove(s, [
          { transform: 'translate(-50%,-50%) translate(0,0)', opacity: '0.8' },
          { transform: `translate(-50%,-50%) translate(${sx * 0.4}px,${sy * 0.4}px)`, opacity: '0.6', offset: 0.3 },
          { transform: `translate(-50%,-50%) translate(${sx * 0.7}px,${sy * 0.7}px)`, opacity: '0.35', offset: 0.6 },
          { transform: `translate(-50%,-50%) translate(${sx}px,${sy}px)`, opacity: '0' },
        ], { duration: dur * 0.7, easing: 'ease-out' });
      })());
    }

    await Promise.all([waveP, ...sparks]);
  }

  /* ================================================================
     BEAM — Lightning Bolt, Sunbeam, Witch Bolt, Disintegrate
     Line from caster to target that flashes, crackles, then fades.
     ================================================================ */

  private async beam(
    from: { x: number; y: number },
    to: { x: number; y: number },
    colors: Colors,
    int: Intensity,
  ): Promise<void> {
    const d = distance(from, to);
    const a = angleBetween(from, to) * (180 / Math.PI);
    const w = 3 + int.level * 1.5;
    const dur = 300 + int.level * 40;

    // Outer haze (wider, softer glow behind the beam)
    const haze = document.createElement('div');
    haze.style.cssText = `position:absolute;left:${from.x}px;top:${from.y - w * 1.5}px;`
      + `width:${d}px;height:${w * 3}px;`
      + `background:linear-gradient(90deg,transparent 0%,${colors.glow} 15%,${colors.glow} 85%,transparent 100%);`
      + `filter:blur(${w}px);opacity:0;`
      + `pointer-events:none;transform-origin:0 50%;`
      + `transform:rotate(${a}deg) scaleX(0);will-change:transform,opacity;`;
    this.container.appendChild(haze);

    const hazeP = this.animRemove(haze, [
      { transform: `rotate(${a}deg) scaleX(0)`, opacity: '0' },
      { transform: `rotate(${a}deg) scaleX(0.5)`, opacity: '0.6', offset: 0.12 },
      { transform: `rotate(${a}deg) scaleX(1)`, opacity: '0.5', offset: 0.2 },
      { transform: `rotate(${a}deg) scaleX(1)`, opacity: '0.4', offset: 0.5 },
      { transform: `rotate(${a}deg) scaleX(1)`, opacity: '0.15', offset: 0.75 },
      { transform: `rotate(${a}deg) scaleX(1)`, opacity: '0' },
    ], { duration: dur * 1.1, easing: 'ease-out' });

    const beam = document.createElement('div');
    beam.style.cssText = `position:absolute;left:${from.x}px;top:${from.y - w / 2}px;`
      + `width:${d}px;height:${w}px;`
      + `background:linear-gradient(90deg,${colors.primary},${colors.secondary});`
      + `box-shadow:0 0 ${w * 2}px ${colors.glow},0 0 ${w * 4}px ${colors.glow};`
      + `pointer-events:none;transform-origin:0 50%;`
      + `transform:rotate(${a}deg) scaleX(0);will-change:transform,opacity;`;
    this.container.appendChild(beam);

    const beamP = this.animRemove(beam, [
      { transform: `rotate(${a}deg) scaleX(0)`, opacity: '0.5' },
      { transform: `rotate(${a}deg) scaleX(0.2)`, opacity: '1', offset: 0.06 },
      { transform: `rotate(${a}deg) scaleX(0.5)`, opacity: '1', offset: 0.12 },
      { transform: `rotate(${a}deg) scaleX(1)`, opacity: '1', offset: 0.2 },
      { transform: `rotate(${a}deg) scaleX(1) scaleY(1.8)`, opacity: '1', offset: 0.3 },
      { transform: `rotate(${a}deg) scaleX(1) scaleY(0.7)`, opacity: '0.9', offset: 0.4 },
      { transform: `rotate(${a}deg) scaleX(1) scaleY(1.4)`, opacity: '0.8', offset: 0.5 },
      { transform: `rotate(${a}deg) scaleX(1) scaleY(1)`, opacity: '0.7', offset: 0.6 },
      { transform: `rotate(${a}deg) scaleX(1) scaleY(0.6)`, opacity: '0.5', offset: 0.75 },
      { transform: `rotate(${a}deg) scaleX(1) scaleY(0.3)`, opacity: '0.25', offset: 0.88 },
      { transform: `rotate(${a}deg) scaleX(1) scaleY(0)`, opacity: '0' },
    ], { duration: dur, easing: 'ease-out' });

    // Crackle particles along the beam
    const crackles: Promise<void>[] = [];
    for (let i = 0; i < int.particles; i++) {
      const t = Math.random();
      const px = lerp(from.x, to.x, t);
      const py = lerp(from.y, to.y, t) + (Math.random() - 0.5) * 20;

      crackles.push((async () => {
        await wait(dur * 0.15 + Math.random() * dur * 0.35);
        const c = this.particle(px, py, 2 + Math.random() * 3, colors);
        await this.animRemove(c, [
          { transform: 'translate(-50%,-50%) scale(1)', opacity: '1' },
          { transform: `translate(-50%,-50%) translate(${(Math.random() - 0.5) * 24}px,${(Math.random() - 0.5) * 24}px) scale(0.5)`, opacity: '0.5', offset: 0.4 },
          { transform: `translate(-50%,-50%) translate(${(Math.random() - 0.5) * 30}px,${(Math.random() - 0.5) * 30}px) scale(0)`, opacity: '0' },
        ], { duration: 180 + Math.random() * 180 });
      })());
    }

    await Promise.all([beamP, hazeP, ...crackles]);
  }

  /* ================================================================
     RADIANCE — Sacred Flame, Guiding Bolt, Flame Strike, Moonbeam
     Pillar of divine light descending from above with ground glow.
     ================================================================ */

  private async radiance(
    pos: { x: number; y: number },
    colors: Colors,
    int: Intensity,
  ): Promise<void> {
    const dur = 500 + int.level * 50;
    const h = 80 + int.level * 20;
    const w = 12 + int.level * 3;

    // Light pillar from above
    const pillar = document.createElement('div');
    pillar.style.cssText = `position:absolute;left:${pos.x}px;top:${pos.y - h}px;`
      + `width:${w}px;height:${h}px;`
      + `background:linear-gradient(180deg,transparent 0%,${colors.glow} 30%,${colors.primary} 100%);`
      + `pointer-events:none;transform:translate(-50%,0) scaleY(0);`
      + `transform-origin:bottom center;will-change:transform,opacity;`;
    this.container.appendChild(pillar);

    const pillarP = this.animRemove(pillar, [
      { transform: 'translate(-50%,0) scaleY(0)', opacity: '0' },
      { transform: 'translate(-50%,0) scaleY(0.3)', opacity: '0.7', offset: 0.08 },
      { transform: 'translate(-50%,0) scaleY(0.7)', opacity: '1', offset: 0.16 },
      { transform: 'translate(-50%,0) scaleY(1)', opacity: '1', offset: 0.25 },
      { transform: 'translate(-50%,0) scaleY(1) scaleX(1.6)', opacity: '1', offset: 0.35 },
      { transform: 'translate(-50%,0) scaleY(1) scaleX(1)', opacity: '0.9', offset: 0.45 },
      { transform: 'translate(-50%,0) scaleY(1) scaleX(1.3)', opacity: '0.7', offset: 0.57 },
      { transform: 'translate(-50%,0) scaleY(1) scaleX(0.8)', opacity: '0.5', offset: 0.7 },
      { transform: 'translate(-50%,0) scaleY(0.7) scaleX(0.4)', opacity: '0.25', offset: 0.85 },
      { transform: 'translate(-50%,0) scaleY(0.4) scaleX(0.2)', opacity: '0' },
    ], { duration: dur });

    // Ground glow
    const glow = this.particle(pos.x, pos.y, 20 + int.level * 5, colors);
    glow.style.mixBlendMode = 'screen';
    const glowP = this.animRemove(glow, [
      { transform: 'translate(-50%,-50%) scale(0)', opacity: '0' },
      { transform: 'translate(-50%,-50%) scale(1)', opacity: '0.7', offset: 0.25 },
      { transform: 'translate(-50%,-50%) scale(1.5)', opacity: '1', offset: 0.35 },
      { transform: 'translate(-50%,-50%) scale(1.2)', opacity: '0.7', offset: 0.55 },
      { transform: 'translate(-50%,-50%) scale(1.8)', opacity: '0.3', offset: 0.78 },
      { transform: 'translate(-50%,-50%) scale(2.5)', opacity: '0' },
    ], { duration: dur * 0.8 });

    // Rising motes
    const motes: Promise<void>[] = [];
    for (let i = 0; i < Math.ceil(int.particles * 0.6); i++) {
      motes.push((async () => {
        await wait(dur * 0.25 + Math.random() * dur * 0.2);
        const s = this.particle(pos.x + (Math.random() - 0.5) * 24, pos.y, 2 + Math.random() * 2, colors);
        const rise = 20 + Math.random() * 40;
        await this.animRemove(s, [
          { transform: 'translate(-50%,-50%) translateY(0) scale(1)', opacity: '1' },
          { transform: `translate(-50%,-50%) translateY(${-rise * 0.4}px) scale(0.8)`, opacity: '0.7', offset: 0.4 },
          { transform: `translate(-50%,-50%) translateY(${-rise}px) scale(0.3)`, opacity: '0' },
        ], { duration: 300 + Math.random() * 300, easing: 'ease-out' });
      })());
    }

    await Promise.all([pillarP, glowP, ...motes]);
  }

  /* ================================================================
     IMPACT — Shocking Grasp, Inflict Wounds, touch-range attacks
     Short, punchy burst at the target with radiating sparks.
     ================================================================ */

  private async impact(
    pos: { x: number; y: number },
    colors: Colors,
    int: Intensity,
  ): Promise<void> {
    const dur = 280 + int.level * 30;
    const size = 15 + int.level * 4;

    const flash = this.particle(pos.x, pos.y, size, colors);
    flash.style.mixBlendMode = 'screen';
    const flashP = this.animRemove(flash, [
      { transform: 'translate(-50%,-50%) scale(0)', opacity: '0' },
      { transform: 'translate(-50%,-50%) scale(0.6)', opacity: '1', offset: 0.08 },
      { transform: 'translate(-50%,-50%) scale(1.6)', opacity: '1', offset: 0.18 },
      { transform: 'translate(-50%,-50%) scale(1)', opacity: '0.85', offset: 0.3 },
      { transform: 'translate(-50%,-50%) scale(1.9)', opacity: '0.6', offset: 0.45 },
      { transform: 'translate(-50%,-50%) scale(1.3)', opacity: '0.45', offset: 0.58 },
      { transform: 'translate(-50%,-50%) scale(2.1)', opacity: '0.25', offset: 0.72 },
      { transform: 'translate(-50%,-50%) scale(1.8)', opacity: '0.12', offset: 0.85 },
      { transform: 'translate(-50%,-50%) scale(2.5)', opacity: '0' },
    ], { duration: dur });

    // Radiating sparks
    const sparks: Promise<void>[] = [];
    for (let i = 0; i < Math.ceil(int.particles * 0.5); i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 15 + Math.random() * 25;

      sparks.push((async () => {
        await wait(dur * 0.12);
        const s = this.particle(pos.x, pos.y, 2 + Math.random() * 2, colors);
        await this.animRemove(s, [
          { transform: 'translate(-50%,-50%) translate(0,0) scale(1)', opacity: '1' },
          { transform: `translate(-50%,-50%) translate(${Math.cos(a) * r * 0.5}px,${Math.sin(a) * r * 0.5}px) scale(0.7)`, opacity: '0.6', offset: 0.4 },
          { transform: `translate(-50%,-50%) translate(${Math.cos(a) * r}px,${Math.sin(a) * r}px) scale(0)`, opacity: '0' },
        ], { duration: 180 + Math.random() * 120, easing: 'ease-out' });
      })());
    }

    await Promise.all([flashP, ...sparks]);
  }

  /* ================================================================
     HEAL — Cure Wounds, Healing Word, Prayer of Healing
     Warm glow with rising sparkles of restoration.
     ================================================================ */

  private async heal(
    pos: { x: number; y: number },
    colors: Colors,
    int: Intensity,
  ): Promise<void> {
    const dur = 500 + int.level * 50;

    // Warm expanding glow
    const glow = this.particle(pos.x, pos.y, 25 + int.level * 5, colors);
    glow.style.background = `radial-gradient(circle, ${colors.primary} 0%, transparent 70%)`;
    const glowP = this.animRemove(glow, [
      { transform: 'translate(-50%,-50%) scale(0)', opacity: '0' },
      { transform: 'translate(-50%,-50%) scale(0.4)', opacity: '0.4', offset: 0.1 },
      { transform: 'translate(-50%,-50%) scale(0.8)', opacity: '0.6', offset: 0.25 },
      { transform: 'translate(-50%,-50%) scale(1)', opacity: '0.75', offset: 0.4 },
      { transform: 'translate(-50%,-50%) scale(1.2)', opacity: '0.8', offset: 0.55 },
      { transform: 'translate(-50%,-50%) scale(1.1)', opacity: '0.6', offset: 0.7 },
      { transform: 'translate(-50%,-50%) scale(1.3)', opacity: '0.35', offset: 0.83 },
      { transform: 'translate(-50%,-50%) scale(1.5)', opacity: '0' },
    ], { duration: dur });

    // Rising sparkles
    const sparkles: Promise<void>[] = [];
    for (let i = 0; i < int.particles; i++) {
      sparkles.push((async () => {
        await wait(i * 35 + Math.random() * 80);
        const x = pos.x + (Math.random() - 0.5) * 30;
        const s = this.particle(x, pos.y, 2 + Math.random() * 3, colors);
        const rise = 30 + Math.random() * 40;
        const drift = (Math.random() - 0.5) * 20;

        await this.animRemove(s, [
          { transform: 'translate(-50%,-50%) translate(0,0) scale(0)', opacity: '0' },
          { transform: `translate(-50%,-50%) translate(${drift * 0.2}px,${-rise * 0.15}px) scale(1)`, opacity: '1', offset: 0.15 },
          { transform: `translate(-50%,-50%) translate(${drift * 0.5}px,${-rise * 0.4}px) scale(0.9)`, opacity: '0.8', offset: 0.4 },
          { transform: `translate(-50%,-50%) translate(${drift * 0.7}px,${-rise * 0.65}px) scale(0.7)`, opacity: '0.5', offset: 0.65 },
          { transform: `translate(-50%,-50%) translate(${drift}px,${-rise}px) scale(0.3)`, opacity: '0' },
        ], { duration: 400 + Math.random() * 300, easing: 'ease-out' });
      })());
    }

    await Promise.all([glowP, ...sparkles]);
  }

  /* ================================================================
     AURA — Shield, Mage Armor, Bless, Globe of Invulnerability
     Glowing ring with orbiting particles around the caster.
     ================================================================ */

  private async aura(
    pos: { x: number; y: number },
    colors: Colors,
    int: Intensity,
  ): Promise<void> {
    const dur = 400 + int.level * 40;
    const size = 30 + int.level * 5;

    const ring = document.createElement('div');
    ring.style.cssText = `position:absolute;left:${pos.x}px;top:${pos.y}px;`
      + `width:${size}px;height:${size}px;border-radius:50%;`
      + `border:2px solid ${colors.primary};`
      + `box-shadow:0 0 ${size * 0.4}px ${colors.glow},inset 0 0 ${size * 0.3}px ${colors.glow};`
      + `pointer-events:none;transform:translate(-50%,-50%) scale(0);will-change:transform,opacity;`;
    this.container.appendChild(ring);

    const ringP = this.animRemove(ring, [
      { transform: 'translate(-50%,-50%) scale(0) rotate(0deg)', opacity: '0' },
      { transform: 'translate(-50%,-50%) scale(0.5) rotate(25deg)', opacity: '1', offset: 0.12 },
      { transform: 'translate(-50%,-50%) scale(1) rotate(55deg)', opacity: '1', offset: 0.25 },
      { transform: 'translate(-50%,-50%) scale(1.1) rotate(80deg)', opacity: '0.85', offset: 0.38 },
      { transform: 'translate(-50%,-50%) scale(1) rotate(110deg)', opacity: '0.9', offset: 0.5 },
      { transform: 'translate(-50%,-50%) scale(1.15) rotate(140deg)', opacity: '0.75', offset: 0.62 },
      { transform: 'translate(-50%,-50%) scale(1.1) rotate(165deg)', opacity: '0.55', offset: 0.75 },
      { transform: 'translate(-50%,-50%) scale(1.05) rotate(185deg)', opacity: '0.35', offset: 0.87 },
      { transform: 'translate(-50%,-50%) scale(1.2) rotate(200deg)', opacity: '0' },
    ], { duration: dur });

    // Orbiting motes
    const orbs: Promise<void>[] = [];
    const orbCount = Math.ceil(int.particles * 0.5);
    for (let i = 0; i < orbCount; i++) {
      const startA = (i / orbCount) * Math.PI * 2;
      const r = size * 0.5;

      orbs.push((async () => {
        const orbEl = this.particle(
          pos.x + Math.cos(startA) * r,
          pos.y + Math.sin(startA) * r,
          3, colors,
        );
        const frames: Keyframe[] = [];
        const steps = 12;
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const ca = startA + t * Math.PI * 1.5;
          frames.push({
            transform: `translate(-50%,-50%) translate(${Math.cos(ca) * r - Math.cos(startA) * r}px,${Math.sin(ca) * r - Math.sin(startA) * r}px) scale(${1 - t * 0.6})`,
            opacity: String(1 - t),
            offset: t,
          });
        }
        await this.animRemove(orbEl, frames, { duration: dur * 0.8 });
      })());
    }

    await Promise.all([ringP, ...orbs]);
  }

  /* ================================================================
     DARK — Chill Touch, Blight, Bane, necrotic tendrils
     Tendrils converging on target from surrounding darkness.
     ================================================================ */

  private async dark(
    pos: { x: number; y: number },
    colors: Colors,
    int: Intensity,
  ): Promise<void> {
    const dur = 500 + int.level * 50;

    // Converging tendrils
    const tendrils: Promise<void>[] = [];
    const count = Math.max(4, int.particles);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const r = 50 + int.level * 10;
      const sx = Math.cos(a) * r;
      const sy = Math.sin(a) * r;

      tendrils.push((async () => {
        await wait(i * 25);
        const t = this.particle(pos.x + sx, pos.y + sy, 4 + Math.random() * 3, colors);
        await this.animRemove(t, [
          { transform: 'translate(-50%,-50%) translate(0,0) scale(0.4)', opacity: '0' },
          { transform: 'translate(-50%,-50%) translate(0,0) scale(1)', opacity: '0.6', offset: 0.08 },
          { transform: `translate(-50%,-50%) translate(${-sx * 0.2}px,${-sy * 0.2}px) scale(0.9)`, opacity: '0.7', offset: 0.2 },
          { transform: `translate(-50%,-50%) translate(${-sx * 0.4}px,${-sy * 0.4}px) scale(0.85)`, opacity: '0.8', offset: 0.35 },
          { transform: `translate(-50%,-50%) translate(${-sx * 0.6}px,${-sy * 0.6}px) scale(0.7)`, opacity: '0.9', offset: 0.5 },
          { transform: `translate(-50%,-50%) translate(${-sx * 0.8}px,${-sy * 0.8}px) scale(0.55)`, opacity: '1', offset: 0.65 },
          { transform: `translate(-50%,-50%) translate(${-sx * 0.93}px,${-sy * 0.93}px) scale(0.4)`, opacity: '0.9', offset: 0.8 },
          { transform: `translate(-50%,-50%) translate(${-sx}px,${-sy}px) scale(0.2)`, opacity: '0.6', offset: 0.92 },
          { transform: `translate(-50%,-50%) translate(${-sx}px,${-sy}px) scale(0)`, opacity: '0' },
        ], { duration: dur * 0.65, easing: 'ease-in' });
      })());
    }

    // Dark implosion at center (delayed until tendrils arrive)
    const core = this.particle(pos.x, pos.y, 15 + int.level * 3, colors);
    core.style.background = `radial-gradient(circle, ${colors.secondary} 0%, #1a0022 50%, transparent 70%)`;
    core.style.mixBlendMode = 'multiply';
    const coreP = this.animRemove(core, [
      { transform: 'translate(-50%,-50%) scale(2)', opacity: '0' },
      { transform: 'translate(-50%,-50%) scale(1.5)', opacity: '0.2', offset: 0.2 },
      { transform: 'translate(-50%,-50%) scale(0.8)', opacity: '0.5', offset: 0.4 },
      { transform: 'translate(-50%,-50%) scale(0.3)', opacity: '0.9', offset: 0.6 },
      { transform: 'translate(-50%,-50%) scale(0.1)', opacity: '1', offset: 0.75 },
      { transform: 'translate(-50%,-50%) scale(1.8)', opacity: '0.4', offset: 0.88 },
      { transform: 'translate(-50%,-50%) scale(2.5)', opacity: '0' },
    ], { duration: dur * 0.5, delay: dur * 0.3 });

    await Promise.all([...tendrils, coreP]);
  }

  /* ================================================================
     ENCHANT — Hold Person, Charm Person, Sleep, psychic/control
     Hypnotic sparkles spiraling around the target.
     ================================================================ */

  private async enchant(
    pos: { x: number; y: number },
    colors: Colors,
    int: Intensity,
  ): Promise<void> {
    const dur = 400 + int.level * 40;

    const sparkles: Promise<void>[] = [];
    const count = int.particles;
    for (let i = 0; i < count; i++) {
      const startA = (i / count) * Math.PI * 2;
      const r = 12 + int.level * 3;

      sparkles.push((async () => {
        await wait(i * 20);
        const s = this.particle(pos.x, pos.y - 10, 2 + Math.random() * 2, colors);
        const frames: Keyframe[] = [];
        const steps = 11;
        for (let st = 0; st <= steps; st++) {
          const t = st / steps;
          const ca = startA + t * Math.PI * 3;
          const cr = r * (1 - t * 0.3);
          const fadeIn = t < 0.15 ? t / 0.15 : 1;
          const fadeOut = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
          frames.push({
            transform: `translate(-50%,-50%) translate(${Math.cos(ca) * cr}px,${Math.sin(ca) * cr - t * 18}px) scale(${1 - t * 0.5})`,
            opacity: String(fadeIn * fadeOut),
            offset: t,
          });
        }
        await this.animRemove(s, frames, { duration: dur * 0.8 });
      })());
    }

    await Promise.all(sparkles);
  }

  /* ================================================================
     STORM — Chain Lightning, Meteor Swarm, Call Lightning
     Multiple strikes raining down from above with staggered impacts.
     ================================================================ */

  private async storm(
    _from: { x: number; y: number },
    to: { x: number; y: number },
    colors: Colors,
    int: Intensity,
  ): Promise<void> {
    const strikeCount = Math.min(6, 2 + Math.floor(int.level / 2));

    const strikes: Promise<void>[] = [];
    for (let i = 0; i < strikeCount; i++) {
      strikes.push((async () => {
        await wait(i * 100);
        const tx = to.x + (Math.random() - 0.5) * 50;
        const ty = to.y + (Math.random() - 0.5) * 50;
        const h = 60 + int.level * 15;

        // Descending strike
        const strike = document.createElement('div');
        strike.style.cssText = `position:absolute;left:${tx}px;top:${ty - h}px;`
          + `width:${3 + int.level}px;height:${h}px;`
          + `background:linear-gradient(180deg,transparent 0%,${colors.primary} 40%,${colors.secondary} 100%);`
          + `box-shadow:0 0 ${8 + int.level * 2}px ${colors.glow};`
          + `pointer-events:none;transform:translate(-50%,0) scaleY(0);`
          + `transform-origin:bottom center;will-change:transform,opacity;`;
        this.container.appendChild(strike);

        const strikeP = this.animRemove(strike, [
          { transform: 'translate(-50%,0) scaleY(0)', opacity: '0' },
          { transform: 'translate(-50%,0) scaleY(0.4)', opacity: '1', offset: 0.06 },
          { transform: 'translate(-50%,0) scaleY(1)', opacity: '1', offset: 0.12 },
          { transform: 'translate(-50%,0) scaleY(1) scaleX(2.5)', opacity: '1', offset: 0.18 },
          { transform: 'translate(-50%,0) scaleY(1) scaleX(1)', opacity: '0.85', offset: 0.28 },
          { transform: 'translate(-50%,0) scaleY(1) scaleX(1.8)', opacity: '0.7', offset: 0.38 },
          { transform: 'translate(-50%,0) scaleY(1) scaleX(0.6)', opacity: '0.5', offset: 0.52 },
          { transform: 'translate(-50%,0) scaleY(0.8) scaleX(0.4)', opacity: '0.3', offset: 0.7 },
          { transform: 'translate(-50%,0) scaleY(0.5) scaleX(0.2)', opacity: '0.1', offset: 0.87 },
          { transform: 'translate(-50%,0) scaleY(0.2) scaleX(0.1)', opacity: '0' },
        ], { duration: 350 + int.level * 20 });

        // Ground impact flash
        const flash = this.particle(tx, ty, 10 + int.level * 2, colors);
        flash.style.mixBlendMode = 'screen';
        const flashP = this.animRemove(flash, [
          { transform: 'translate(-50%,-50%) scale(0)', opacity: '1' },
          { transform: 'translate(-50%,-50%) scale(2.5)', opacity: '0.8', offset: 0.15 },
          { transform: 'translate(-50%,-50%) scale(3)', opacity: '0.4', offset: 0.4 },
          { transform: 'translate(-50%,-50%) scale(3.5)', opacity: '0' },
        ], { duration: 250 });

        // Ground scorch ring
        const scorch = document.createElement('div');
        const scorchSize = 16 + int.level * 3;
        scorch.style.cssText = `position:absolute;left:${tx}px;top:${ty}px;`
          + `width:${scorchSize}px;height:${scorchSize}px;border-radius:50%;`
          + `border:1px solid ${colors.secondary};`
          + `box-shadow:0 0 ${scorchSize * 0.5}px ${colors.glow};`
          + `pointer-events:none;transform:translate(-50%,-50%) scale(0);will-change:transform,opacity;`;
        this.container.appendChild(scorch);
        const scorchP = this.animRemove(scorch, [
          { transform: 'translate(-50%,-50%) scale(0)', opacity: '0' },
          { transform: 'translate(-50%,-50%) scale(1)', opacity: '0.7', offset: 0.2 },
          { transform: 'translate(-50%,-50%) scale(1.2)', opacity: '0.4', offset: 0.5 },
          { transform: 'translate(-50%,-50%) scale(1.4)', opacity: '0' },
        ], { duration: 400 });

        await Promise.all([strikeP, flashP, scorchP]);
      })());
    }

    await Promise.all(strikes);
  }

  /* ================================================================
     WORD — Power Word Kill, Power Word Stun
     Arcane rune circles expanding outward with pulsing core.
     ================================================================ */

  private async powerWord(
    pos: { x: number; y: number },
    colors: Colors,
    int: Intensity,
  ): Promise<void> {
    const dur = 600 + int.level * 50;

    // Expanding rune rings
    const rings: Promise<void>[] = [];
    const ringCount = Math.min(4, 1 + Math.floor(int.level / 3));
    for (let i = 0; i < ringCount; i++) {
      rings.push((async () => {
        await wait(i * 90);
        const ring = document.createElement('div');
        const size = 40 + int.level * 8;
        ring.style.cssText = `position:absolute;left:${pos.x}px;top:${pos.y}px;`
          + `width:${size}px;height:${size}px;border-radius:50%;`
          + `border:1px solid ${colors.primary};`
          + `box-shadow:0 0 ${size * 0.3}px ${colors.glow};`
          + `pointer-events:none;transform:translate(-50%,-50%) scale(0) rotate(0deg);`
          + `will-change:transform,opacity;`;
        this.container.appendChild(ring);

        await this.animRemove(ring, [
          { transform: 'translate(-50%,-50%) scale(0) rotate(0deg)', opacity: '0' },
          { transform: 'translate(-50%,-50%) scale(0.4) rotate(25deg)', opacity: '1', offset: 0.08 },
          { transform: 'translate(-50%,-50%) scale(0.8) rotate(50deg)', opacity: '1', offset: 0.18 },
          { transform: 'translate(-50%,-50%) scale(1) rotate(75deg)', opacity: '0.9', offset: 0.3 },
          { transform: 'translate(-50%,-50%) scale(1.2) rotate(100deg)', opacity: '0.75', offset: 0.42 },
          { transform: 'translate(-50%,-50%) scale(1.5) rotate(125deg)', opacity: '0.55', offset: 0.55 },
          { transform: 'translate(-50%,-50%) scale(1.8) rotate(150deg)', opacity: '0.35', offset: 0.7 },
          { transform: 'translate(-50%,-50%) scale(2.1) rotate(170deg)', opacity: '0.18', offset: 0.84 },
          { transform: 'translate(-50%,-50%) scale(2.4) rotate(190deg)', opacity: '0.05', offset: 0.94 },
          { transform: 'translate(-50%,-50%) scale(2.6) rotate(200deg)', opacity: '0' },
        ], { duration: dur * 0.7 });
      })());
    }

    // Central power pulse
    const core = this.particle(pos.x, pos.y, 8, colors);
    const coreP = this.animRemove(core, [
      { transform: 'translate(-50%,-50%) scale(0)', opacity: '0' },
      { transform: 'translate(-50%,-50%) scale(3)', opacity: '1', offset: 0.12 },
      { transform: 'translate(-50%,-50%) scale(2)', opacity: '0.8', offset: 0.25 },
      { transform: 'translate(-50%,-50%) scale(4)', opacity: '0.6', offset: 0.4 },
      { transform: 'translate(-50%,-50%) scale(3)', opacity: '0.7', offset: 0.55 },
      { transform: 'translate(-50%,-50%) scale(5)', opacity: '0.4', offset: 0.7 },
      { transform: 'translate(-50%,-50%) scale(4)', opacity: '0.2', offset: 0.85 },
      { transform: 'translate(-50%,-50%) scale(6)', opacity: '0' },
    ], { duration: dur * 0.8 });

    await Promise.all([...rings, coreP]);
  }
}
