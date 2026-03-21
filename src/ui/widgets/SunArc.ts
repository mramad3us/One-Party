import { Component } from '@/ui/Component';
import type { GameEngine } from '@/engine/GameEngine';
import type { GameTime } from '@/types/core';
import { gameTimeToCalendar } from '@/types/time';

export type SunArcSize = 'compact' | 'large';

// SVG namespace
const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * An astrolabe-inspired SVG widget tracking the sun/moon across a semicircular arc.
 * The arc color shifts with time of day: warm amber at dawn/dusk, pale at noon, indigo at night.
 *
 * Compact: 48×24 px (status bar).  Large: 140×70 px (activity overlays).
 */
export class SunArc extends Component {
  private sunCircle!: SVGCircleElement;
  private moonCircle!: SVGCircleElement;
  private skyGradient!: SVGLinearGradientElement;
  private sunGlow!: SVGCircleElement;

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
  private moonR = 2;

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

    // Moon glow filter
    const moonFilter = document.createElementNS(SVG_NS, 'filter');
    moonFilter.id = `moon-glow-${this.size}`;
    moonFilter.setAttribute('x', '-100%');
    moonFilter.setAttribute('y', '-100%');
    moonFilter.setAttribute('width', '300%');
    moonFilter.setAttribute('height', '300%');
    const moonBlur = document.createElementNS(SVG_NS, 'feGaussianBlur');
    moonBlur.setAttribute('stdDeviation', this.size === 'large' ? '2' : '1');
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

    // ── Sun glow (larger, behind sun) ──
    this.sunGlow = document.createElementNS(SVG_NS, 'circle');
    this.sunGlow.setAttribute('r', String(this.sunR * 2.5));
    this.sunGlow.classList.add('sun-arc-sun-glow');
    this.sunGlow.setAttribute('filter', `url(#sun-glow-${this.size})`);
    svg.appendChild(this.sunGlow);

    // ── Sun circle ──
    this.sunCircle = document.createElementNS(SVG_NS, 'circle');
    this.sunCircle.setAttribute('r', String(this.sunR));
    this.sunCircle.classList.add('sun-arc-sun');
    svg.appendChild(this.sunCircle);

    // ── Moon circle ──
    this.moonCircle = document.createElementNS(SVG_NS, 'circle');
    this.moonCircle.setAttribute('r', String(this.moonR));
    this.moonCircle.classList.add('sun-arc-moon');
    this.moonCircle.setAttribute('filter', `url(#moon-glow-${this.size})`);
    svg.appendChild(this.moonCircle);

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

      this.sunCircle.setAttribute('cx', String(sx));
      this.sunCircle.setAttribute('cy', String(sy));
      this.sunGlow.setAttribute('cx', String(sx));
      this.sunGlow.setAttribute('cy', String(sy));
      this.sunCircle.style.opacity = '1';
      this.sunGlow.style.opacity = '1';

      // Moon hidden below horizon
      this.moonCircle.style.opacity = '0';
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
      const mx = this.cx + (this.r * 0.6) * Math.cos(moonAngle);
      const my = this.cy - (this.r * 0.6) * Math.sin(moonAngle);

      this.moonCircle.setAttribute('cx', String(mx));
      this.moonCircle.setAttribute('cy', String(my));
      this.moonCircle.style.opacity = '1';

      // Sun below horizon
      this.sunCircle.style.opacity = '0';
      this.sunGlow.style.opacity = '0';
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
