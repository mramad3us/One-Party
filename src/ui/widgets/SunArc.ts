import { Component } from '@/ui/Component';
import type { GameEngine } from '@/engine/GameEngine';
import type { GameTime } from '@/types/core';
import { gameTimeToCalendar } from '@/types/time';

export type SunArcSize = 'compact' | 'large';

// SVG namespace
const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * An astrolabe-inspired SVG widget tracking the sun/moon across a semicircular arc.
 * Sun: medieval manuscript style — golden disc with radiating triangular rays.
 * Moon: crescent moon silhouette with inner detail, silver with ethereal glow.
 *
 * Compact: 48×24 px (status bar).  Large: 140×70 px (activity overlays).
 */
export class SunArc extends Component {
  private sunGroup!: SVGGElement;
  private moonGroup!: SVGGElement;
  private sunGlowGroup!: SVGGElement;
  private skyGradient!: SVGLinearGradientElement;

  private readonly size: SunArcSize;
  private currentHour = 6;
  private currentMinute = 0;

  // Dimensions derived from size
  private w = 48;
  private h = 24;
  private cx = 24;
  private cy = 22;
  private r = 18;
  private sunR = 2.5;
  private moonR = 3;

  constructor(parent: HTMLElement, engine: GameEngine, size: SunArcSize = 'compact') {
    super(parent, engine);
    this.size = size;
    if (size === 'large') {
      this.w = 140;
      this.h = 70;
      this.cx = 70;
      this.cy = 64;
      this.r = 54;
      this.sunR = 6;
      this.moonR = 5;
    }
  }

  /** Build a medieval manuscript-style sun with radiating triangular rays. */
  private buildSunSVG(defs: SVGDefsElement): { group: SVGGElement; glowGroup: SVGGElement } {
    const isLarge = this.size === 'large';
    const coreR = this.sunR;
    const rayLen = isLarge ? coreR * 1.8 : coreR * 1.6;
    const rayCount = isLarge ? 12 : 8;
    const rayBaseW = isLarge ? 1.8 : 1.0;

    // ── Radial gradient for the sun disc: hot center → warm edge ──
    const sunFillGrad = document.createElementNS(SVG_NS, 'radialGradient');
    sunFillGrad.id = `sun-fill-${this.size}`;
    const sg1 = document.createElementNS(SVG_NS, 'stop');
    sg1.setAttribute('offset', '0%');
    sg1.setAttribute('stop-color', '#fff4c0');
    const sg2 = document.createElementNS(SVG_NS, 'stop');
    sg2.setAttribute('offset', '45%');
    sg2.setAttribute('stop-color', '#e8c840');
    const sg3 = document.createElementNS(SVG_NS, 'stop');
    sg3.setAttribute('offset', '100%');
    sg3.setAttribute('stop-color', '#c4a24a');
    sunFillGrad.appendChild(sg1);
    sunFillGrad.appendChild(sg2);
    sunFillGrad.appendChild(sg3);
    defs.appendChild(sunFillGrad);

    // ── Glow group (soft halo behind the sun) ──
    const glowGroup = document.createElementNS(SVG_NS, 'g');
    glowGroup.classList.add('sun-arc-sun-glow');
    glowGroup.setAttribute('filter', `url(#sun-glow-${this.size})`);

    const glowCircle = document.createElementNS(SVG_NS, 'circle');
    glowCircle.setAttribute('cx', '0');
    glowCircle.setAttribute('cy', '0');
    glowCircle.setAttribute('r', String(coreR * 3));
    glowCircle.setAttribute('fill', 'rgba(232, 200, 64, 0.15)');
    glowGroup.appendChild(glowCircle);

    // ── Main sun group ──
    const group = document.createElementNS(SVG_NS, 'g');
    group.classList.add('sun-arc-sun');

    // Alternating long and short rays — manuscript style
    for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2;
      const isLongRay = i % 2 === 0;
      const thisRayLen = isLongRay ? rayLen : rayLen * 0.6;
      const thisRayW = isLongRay ? rayBaseW : rayBaseW * 0.7;

      // Triangular spike: tip at (0, -coreR - rayLen), base at ±halfW on the core radius
      const tipX = Math.cos(angle - Math.PI / 2) * (coreR + thisRayLen);
      const tipY = Math.sin(angle - Math.PI / 2) * (coreR + thisRayLen);
      const baseL_angle = angle - Math.PI / 2 - thisRayW / coreR;
      const baseR_angle = angle - Math.PI / 2 + thisRayW / coreR;
      const blx = Math.cos(baseL_angle) * (coreR * 0.85);
      const bly = Math.sin(baseL_angle) * (coreR * 0.85);
      const brx = Math.cos(baseR_angle) * (coreR * 0.85);
      const bry = Math.sin(baseR_angle) * (coreR * 0.85);

      const ray = document.createElementNS(SVG_NS, 'polygon');
      ray.setAttribute('points', `${blx},${bly} ${tipX},${tipY} ${brx},${bry}`);
      ray.setAttribute('fill', isLongRay ? '#c4a24a' : '#d4b45a');
      ray.setAttribute('opacity', isLongRay ? '0.9' : '0.65');
      group.appendChild(ray);
    }

    // Core circle with gradient fill
    const core = document.createElementNS(SVG_NS, 'circle');
    core.setAttribute('cx', '0');
    core.setAttribute('cy', '0');
    core.setAttribute('r', String(coreR));
    core.setAttribute('fill', `url(#sun-fill-${this.size})`);
    core.setAttribute('stroke', '#c4a24a');
    core.setAttribute('stroke-width', isLarge ? '0.5' : '0.3');
    group.appendChild(core);

    // Inner detail circle — hot white center
    const innerRing = document.createElementNS(SVG_NS, 'circle');
    innerRing.setAttribute('cx', '0');
    innerRing.setAttribute('cy', '0');
    innerRing.setAttribute('r', String(coreR * 0.45));
    innerRing.setAttribute('fill', 'none');
    innerRing.setAttribute('stroke', 'rgba(255, 244, 192, 0.5)');
    innerRing.setAttribute('stroke-width', isLarge ? '0.4' : '0.2');
    group.appendChild(innerRing);

    return { group, glowGroup };
  }

  /** Build a cartoon crescent moon — bold yellow fill, dark outline, with 5-pointed stars. */
  private buildMoonSVG(defs: SVGDefsElement): SVGGElement {
    const isLarge = this.size === 'large';
    const mr = this.moonR;

    // ── Moon gradient: warm pale yellow like the reference ──
    const moonFillGrad = document.createElementNS(SVG_NS, 'linearGradient');
    moonFillGrad.id = `moon-fill-${this.size}`;
    moonFillGrad.setAttribute('x1', '0.2');
    moonFillGrad.setAttribute('y1', '0');
    moonFillGrad.setAttribute('x2', '0.8');
    moonFillGrad.setAttribute('y2', '1');
    const mg1 = document.createElementNS(SVG_NS, 'stop');
    mg1.setAttribute('offset', '0%');
    mg1.setAttribute('stop-color', '#f5efa0');
    const mg2 = document.createElementNS(SVG_NS, 'stop');
    mg2.setAttribute('offset', '50%');
    mg2.setAttribute('stop-color', '#f0e68c');
    const mg3 = document.createElementNS(SVG_NS, 'stop');
    mg3.setAttribute('offset', '100%');
    mg3.setAttribute('stop-color', '#e8d870');
    moonFillGrad.appendChild(mg1);
    moonFillGrad.appendChild(mg2);
    moonFillGrad.appendChild(mg3);
    defs.appendChild(moonFillGrad);

    const group = document.createElementNS(SVG_NS, 'g');
    group.classList.add('sun-arc-moon');

    // ── Ambient glow ──
    const glow = document.createElementNS(SVG_NS, 'circle');
    glow.setAttribute('cx', '0');
    glow.setAttribute('cy', '0');
    glow.setAttribute('r', String(mr * 2.5));
    glow.setAttribute('fill', 'rgba(240, 230, 140, 0.1)');
    group.appendChild(glow);

    // ── Crescent shape: outer circle arc + inner cutout arc ──
    // The crescent opens to the right (like the reference C shape)
    const outerR = mr;
    const cutR = mr * 0.68;           // cutout radius — smaller = fatter crescent
    const cutOffset = mr * 0.38;      // how far right the cutout center is shifted
    const strokeW = isLarge ? mr * 0.12 : mr * 0.15;

    // Build crescent via two circular arcs
    // Top intersection point, outer arc sweeping left (large arc), bottom, inner arc sweeping back
    // We compute where the two circles intersect
    // Outer circle: x² + y² = outerR²
    // Inner circle: (x - cutOffset)² + y² = cutR²
    // Solving: x = (outerR² - cutR² + cutOffset²) / (2 * cutOffset)
    const ix = (outerR * outerR - cutR * cutR + cutOffset * cutOffset) / (2 * cutOffset);
    const iy = Math.sqrt(Math.max(0, outerR * outerR - ix * ix));

    const d = [
      `M ${ix} ${-iy}`,
      `A ${outerR} ${outerR} 0 1 0 ${ix} ${iy}`,             // large arc (left side of moon)
      `A ${cutR} ${cutR} 0 1 1 ${ix} ${-iy}`,                 // inner cutout arc (right side bite)
    ].join(' ');

    // Dark outline (drawn first, slightly larger)
    const outlinePath = document.createElementNS(SVG_NS, 'path');
    outlinePath.setAttribute('d', d);
    outlinePath.setAttribute('fill', 'none');
    outlinePath.setAttribute('stroke', '#2a2d3a');
    outlinePath.setAttribute('stroke-width', String(strokeW * 2.5));
    outlinePath.setAttribute('stroke-linejoin', 'round');
    group.appendChild(outlinePath);

    // Yellow crescent fill
    const crescentPath = document.createElementNS(SVG_NS, 'path');
    crescentPath.setAttribute('d', d);
    crescentPath.setAttribute('fill', `url(#moon-fill-${this.size})`);
    crescentPath.setAttribute('stroke', '#2a2d3a');
    crescentPath.setAttribute('stroke-width', String(strokeW));
    crescentPath.setAttribute('stroke-linejoin', 'round');
    group.appendChild(crescentPath);

    // Highlight stroke — thin light line along the inner edge for shine
    if (isLarge) {
      const hlOffset = cutOffset + cutR * 0.08;
      const hlR = cutR * 0.88;
      const hlIx = (outerR * outerR - hlR * hlR + hlOffset * hlOffset) / (2 * hlOffset);
      const hlIy = Math.sqrt(Math.max(0, outerR * outerR - hlIx * hlIx)) * 0.85;
      const hlD = `M ${hlIx + mr * 0.05} ${-hlIy * 0.7} A ${hlR * 0.9} ${hlR * 0.9} 0 0 0 ${hlIx - mr * 0.1} ${-hlIy * 0.15}`;
      const highlight = document.createElementNS(SVG_NS, 'path');
      highlight.setAttribute('d', hlD);
      highlight.setAttribute('fill', 'none');
      highlight.setAttribute('stroke', 'rgba(255, 255, 240, 0.5)');
      highlight.setAttribute('stroke-width', String(strokeW * 0.5));
      highlight.setAttribute('stroke-linecap', 'round');
      group.appendChild(highlight);
    }

    // ── 5-pointed outline stars (like the reference) ──
    const starPositions = isLarge
      ? [
          { x: -mr * 0.9, y: -mr * 1.2, s: mr * 0.22 },
          { x: mr * 1.1, y: -mr * 0.1, s: mr * 0.18 },
          { x: mr * 0.1, y: mr * 1.0, s: mr * 0.20 },
        ]
      : [
          { x: -mr * 0.8, y: -mr * 1.1, s: mr * 0.25 },
          { x: mr * 1.1, y: mr * 0.3, s: mr * 0.20 },
        ];

    for (const star of starPositions) {
      const starEl = this.buildFivePointStar(star.x, star.y, star.s);
      group.appendChild(starEl);
    }

    return group;
  }

  /** Build a 5-pointed star with outline (like the reference image). */
  private buildFivePointStar(cx: number, cy: number, outerR: number): SVGPathElement {
    const innerR = outerR * 0.4;
    const points: string[] = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (Math.PI / 2) + (i * Math.PI / 5); // start from top
      const px = cx + r * Math.cos(angle);
      const py = cy - r * Math.sin(angle);
      points.push(`${px},${py}`);
    }
    const star = document.createElementNS(SVG_NS, 'polygon');
    star.setAttribute('points', points.join(' '));
    star.setAttribute('fill', '#f0e68c');
    star.setAttribute('stroke', '#2a2d3a');
    star.setAttribute('stroke-width', String(outerR * 0.2));
    star.setAttribute('stroke-linejoin', 'round');

    // Return as path (polygon works fine in SVG)
    // Actually polygon is SVGPolygonElement not SVGPathElement, let me use a path
    const path = document.createElementNS(SVG_NS, 'path');
    const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p}`).join(' ') + ' Z';
    path.setAttribute('d', d);
    path.setAttribute('fill', '#f0e68c');
    path.setAttribute('stroke', '#2a2d3a');
    path.setAttribute('stroke-width', String(outerR * 0.2));
    path.setAttribute('stroke-linejoin', 'round');
    return path;
  }

  protected createElement(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = `sun-arc sun-arc--${this.size}`;

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${this.w} ${this.h}`);
    svg.setAttribute('width', String(this.w));
    svg.setAttribute('height', String(this.h));
    svg.classList.add('sun-arc-svg');

    // ── Defs: gradients & filters ──
    const defs = document.createElementNS(SVG_NS, 'defs');

    // Sun glow filter
    const sunFilter = document.createElementNS(SVG_NS, 'filter');
    sunFilter.id = `sun-glow-${this.size}`;
    sunFilter.setAttribute('x', '-100%');
    sunFilter.setAttribute('y', '-100%');
    sunFilter.setAttribute('width', '300%');
    sunFilter.setAttribute('height', '300%');
    const blur = document.createElementNS(SVG_NS, 'feGaussianBlur');
    blur.setAttribute('stdDeviation', this.size === 'large' ? '3' : '1.5');
    blur.setAttribute('result', 'glow');
    sunFilter.appendChild(blur);
    const merge = document.createElementNS(SVG_NS, 'feMerge');
    const mn1 = document.createElementNS(SVG_NS, 'feMergeNode');
    mn1.setAttribute('in', 'glow');
    merge.appendChild(mn1);
    const mn2 = document.createElementNS(SVG_NS, 'feMergeNode');
    mn2.setAttribute('in', 'SourceGraphic');
    merge.appendChild(mn2);
    sunFilter.appendChild(merge);
    defs.appendChild(sunFilter);

    // Moon glow filter — softer, cooler
    const moonFilter = document.createElementNS(SVG_NS, 'filter');
    moonFilter.id = `moon-glow-${this.size}`;
    moonFilter.setAttribute('x', '-100%');
    moonFilter.setAttribute('y', '-100%');
    moonFilter.setAttribute('width', '300%');
    moonFilter.setAttribute('height', '300%');
    const moonBlur = document.createElementNS(SVG_NS, 'feGaussianBlur');
    moonBlur.setAttribute('stdDeviation', this.size === 'large' ? '3' : '1.5');
    moonBlur.setAttribute('result', 'glow');
    moonFilter.appendChild(moonBlur);
    const moonMerge = document.createElementNS(SVG_NS, 'feMerge');
    const mmn1 = document.createElementNS(SVG_NS, 'feMergeNode');
    mmn1.setAttribute('in', 'glow');
    moonMerge.appendChild(mmn1);
    const mmn2 = document.createElementNS(SVG_NS, 'feMergeNode');
    mmn2.setAttribute('in', 'SourceGraphic');
    moonMerge.appendChild(mmn2);
    moonFilter.appendChild(moonMerge);
    defs.appendChild(moonFilter);

    // Sky arc gradient (shifts with time of day)
    const grad = document.createElementNS(SVG_NS, 'linearGradient');
    grad.id = `sky-grad-${this.size}`;
    grad.setAttribute('x1', '0');
    grad.setAttribute('y1', '0');
    grad.setAttribute('x2', '1');
    grad.setAttribute('y2', '0');
    const stop1 = document.createElementNS(SVG_NS, 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', '#c4874a');
    stop1.setAttribute('stop-opacity', '0.4');
    const stop2 = document.createElementNS(SVG_NS, 'stop');
    stop2.setAttribute('offset', '50%');
    stop2.setAttribute('stop-color', '#8ba4c4');
    stop2.setAttribute('stop-opacity', '0.3');
    const stop3 = document.createElementNS(SVG_NS, 'stop');
    stop3.setAttribute('offset', '100%');
    stop3.setAttribute('stop-color', '#c4604a');
    stop3.setAttribute('stop-opacity', '0.4');
    grad.appendChild(stop1);
    grad.appendChild(stop2);
    grad.appendChild(stop3);
    this.skyGradient = grad;
    defs.appendChild(grad);

    svg.appendChild(defs);

    // ── Horizon line ──
    const horizonLine = document.createElementNS(SVG_NS, 'line');
    horizonLine.setAttribute('x1', String(this.cx - this.r - 2));
    horizonLine.setAttribute('y1', String(this.cy));
    horizonLine.setAttribute('x2', String(this.cx + this.r + 2));
    horizonLine.setAttribute('y2', String(this.cy));
    horizonLine.classList.add('sun-arc-horizon');
    svg.appendChild(horizonLine);

    // ── Dashed arc (sky path) ──
    const arcPath = document.createElementNS(SVG_NS, 'path');
    const arcD = `M ${this.cx - this.r} ${this.cy} A ${this.r} ${this.r} 0 0 1 ${this.cx + this.r} ${this.cy}`;
    arcPath.setAttribute('d', arcD);
    arcPath.classList.add('sun-arc-path');
    arcPath.setAttribute('stroke', `url(#sky-grad-${this.size})`);
    svg.appendChild(arcPath);

    // ── Tick marks at key hours (6, 9, 12, 15, 18) ──
    const tickMarksGroup = document.createElementNS(SVG_NS, 'g');
    tickMarksGroup.classList.add('sun-arc-ticks');
    const tickHours = [6, 9, 12, 15, 18];
    const tickLen = this.size === 'large' ? 4 : 2;
    for (const th of tickHours) {
      const angle = Math.PI * (1 - (th - 6) / 12);
      const outerX = this.cx + (this.r + 1) * Math.cos(angle);
      const outerY = this.cy - (this.r + 1) * Math.sin(angle);
      const innerX = this.cx + (this.r - tickLen) * Math.cos(angle);
      const innerY = this.cy - (this.r - tickLen) * Math.sin(angle);
      const tick = document.createElementNS(SVG_NS, 'line');
      tick.setAttribute('x1', String(outerX));
      tick.setAttribute('y1', String(outerY));
      tick.setAttribute('x2', String(innerX));
      tick.setAttribute('y2', String(innerY));
      tick.classList.add('sun-arc-tick');
      tickMarksGroup.appendChild(tick);
    }
    svg.appendChild(tickMarksGroup);

    // ── Sun (manuscript-style with rays) ──
    const { group: sunGroup, glowGroup: sunGlowGroup } = this.buildSunSVG(defs);
    this.sunGlowGroup = sunGlowGroup;
    this.sunGroup = sunGroup;
    svg.appendChild(sunGlowGroup);
    svg.appendChild(sunGroup);

    // ── Moon (crescent) ──
    this.moonGroup = this.buildMoonSVG(defs);
    svg.appendChild(this.moonGroup);

    wrapper.appendChild(svg);
    this.positionBodies(6, 0);

    return wrapper;
  }

  // ── Positioning ──

  private positionBodies(hour: number, minute: number): void {
    const fractionalHour = hour + minute / 60;
    const isDaytime = fractionalHour >= 5.5 && fractionalHour <= 18.5;

    if (isDaytime) {
      // Sun on the arc: 5.5 → left, 12 → top, 18.5 → right
      const t = (fractionalHour - 5.5) / 13; // 0 to 1
      const angle = Math.PI * (1 - t);
      const sx = this.cx + this.r * Math.cos(angle);
      const sy = this.cy - this.r * Math.sin(angle);

      this.sunGroup.setAttribute('transform', `translate(${sx}, ${sy})`);
      this.sunGlowGroup.setAttribute('transform', `translate(${sx}, ${sy})`);
      this.sunGroup.style.opacity = '1';
      this.sunGlowGroup.style.opacity = '1';

      // Moon hidden below horizon
      this.moonGroup.style.opacity = '0';
    } else {
      // Moon on a mirrored arc below horizon (subtle)
      // Night spans 18.5 → 5.5 (11 hours)
      let nightT: number;
      if (fractionalHour >= 18.5) {
        nightT = (fractionalHour - 18.5) / 11;
      } else {
        nightT = (fractionalHour + 24 - 18.5) / 11;
      }
      const moonAngle = Math.PI * nightT; // left to right
      const mx = this.cx + this.r * Math.cos(moonAngle);
      const my = this.cy - this.r * Math.sin(moonAngle);

      this.moonGroup.setAttribute('transform', `translate(${mx}, ${my})`);
      this.moonGroup.style.opacity = '1';

      // Sun below horizon
      this.sunGroup.style.opacity = '0';
      this.sunGlowGroup.style.opacity = '0';
    }

    // Update sky gradient colors based on time
    this.updateSkyColors(fractionalHour);
  }

  private updateSkyColors(hour: number): void {
    const stops = this.skyGradient.querySelectorAll('stop');
    if (stops.length < 3) return;

    if (hour >= 5 && hour < 7) {
      // Dawn: warm amber/rose
      stops[0].setAttribute('stop-color', '#d4874a');
      stops[1].setAttribute('stop-color', '#d4a06a');
      stops[2].setAttribute('stop-color', '#c46050');
      stops[0].setAttribute('stop-opacity', '0.6');
      stops[1].setAttribute('stop-opacity', '0.5');
      stops[2].setAttribute('stop-opacity', '0.5');
    } else if (hour >= 7 && hour < 10) {
      // Morning: golden warming
      stops[0].setAttribute('stop-color', '#c4a24a');
      stops[1].setAttribute('stop-color', '#9ab4d4');
      stops[2].setAttribute('stop-color', '#c4a24a');
      stops[0].setAttribute('stop-opacity', '0.4');
      stops[1].setAttribute('stop-opacity', '0.3');
      stops[2].setAttribute('stop-opacity', '0.3');
    } else if (hour >= 10 && hour < 15) {
      // Midday: pale blue sky
      stops[0].setAttribute('stop-color', '#8ba4c4');
      stops[1].setAttribute('stop-color', '#a0b8d8');
      stops[2].setAttribute('stop-color', '#8ba4c4');
      stops[0].setAttribute('stop-opacity', '0.25');
      stops[1].setAttribute('stop-opacity', '0.35');
      stops[2].setAttribute('stop-opacity', '0.25');
    } else if (hour >= 15 && hour < 18) {
      // Afternoon → dusk: warming amber/rose
      stops[0].setAttribute('stop-color', '#c4a24a');
      stops[1].setAttribute('stop-color', '#c49060');
      stops[2].setAttribute('stop-color', '#c45040');
      stops[0].setAttribute('stop-opacity', '0.3');
      stops[1].setAttribute('stop-opacity', '0.4');
      stops[2].setAttribute('stop-opacity', '0.5');
    } else if (hour >= 18 && hour < 20) {
      // Dusk: deep rose/violet
      stops[0].setAttribute('stop-color', '#6a3058');
      stops[1].setAttribute('stop-color', '#c45040');
      stops[2].setAttribute('stop-color', '#2a1838');
      stops[0].setAttribute('stop-opacity', '0.4');
      stops[1].setAttribute('stop-opacity', '0.3');
      stops[2].setAttribute('stop-opacity', '0.4');
    } else {
      // Night: deep indigo
      stops[0].setAttribute('stop-color', '#1a1838');
      stops[1].setAttribute('stop-color', '#2a2858');
      stops[2].setAttribute('stop-color', '#1a1838');
      stops[0].setAttribute('stop-opacity', '0.3');
      stops[1].setAttribute('stop-opacity', '0.2');
      stops[2].setAttribute('stop-opacity', '0.3');
    }
  }

  // ── Public API ──

  /** Instantly update to a given game time. */
  updateTime(time: GameTime): void {
    const cal = gameTimeToCalendar(time);
    this.currentHour = cal.hour;
    this.currentMinute = cal.minute;
    this.positionBodies(cal.hour, cal.minute);
  }

  /** Smoothly animate sun/moon from current position to target time. */
  async animateToTime(targetTime: GameTime, durationMs: number): Promise<void> {
    const targetCal = gameTimeToCalendar(targetTime);
    const startHour = this.currentHour + this.currentMinute / 60;
    let endHour = targetCal.hour + targetCal.minute / 60;

    // Handle wrapping past midnight
    if (endHour < startHour) {
      endHour += 24;
    }

    const startTs = performance.now();

    return new Promise<void>((resolve) => {
      const tick = (now: number) => {
        const elapsed = now - startTs;
        const progress = Math.min(elapsed / durationMs, 1);
        // Ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const currentFractional = startHour + (endHour - startHour) * eased;
        const normalizedHour = ((currentFractional % 24) + 24) % 24;
        this.positionBodies(normalizedHour, 0);

        if (progress < 1) {
          requestAnimationFrame(tick);
        } else {
          this.currentHour = targetCal.hour;
          this.currentMinute = targetCal.minute;
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });
  }

  /** Get the current fractional hour for external consumers. */
  getCurrentHour(): number {
    return this.currentHour + this.currentMinute / 60;
  }
}
