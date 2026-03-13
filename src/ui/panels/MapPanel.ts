import type { GameEngine } from '@/engine/GameEngine';
import type { EntityId, Region, Location, LocationType } from '@/types';
import { Component } from '@/ui/Component';
import { IconSystem } from '@/ui/IconSystem';
import { TooltipSystem } from '@/ui/TooltipSystem';
import { el } from '@/utils/dom';

const LOCATION_SYMBOLS: Record<LocationType, string> = {
  village: '\u2302',    // house
  town: '\u2302',
  city: '\u265C',       // rook (castle)
  dungeon: '\u2620',    // skull
  wilderness: '\u2663', // tree/club
  ruins: '\u2609',      // sun/circle
  castle: '\u265C',
  cave: '\u25CF',       // filled circle
  temple: '\u2719',     // cross
  camp: '\u2605',       // star
};

/**
 * Simple node-based region/location map in the sidebar.
 * Shows discovered locations as connected circles with icons.
 */
export class MapPanel extends Component {
  private svgEl!: SVGSVGElement;
  private currentRegion: Region | null = null;
  private currentLocationId: EntityId | null = null;

  constructor(parent: HTMLElement, engine: GameEngine) {
    super(parent, engine);
  }

  protected createElement(): HTMLElement {
    const wrapper = el('div', { class: 'map-panel panel' });

    // Header
    const header = el('div', { class: 'map-header' });
    const icon = IconSystem.icon('compass');
    header.appendChild(icon);
    header.appendChild(el('span', { class: 'map-header-title font-heading' }, ['Map']));
    wrapper.appendChild(header);

    // Region name
    const regionName = el('div', { class: 'map-region-name' });
    wrapper.appendChild(regionName);

    // SVG map area
    this.svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svgEl.setAttribute('class', 'map-svg');
    this.svgEl.setAttribute('viewBox', '0 0 200 200');
    wrapper.appendChild(this.svgEl);

    return wrapper;
  }

  protected setupEvents(): void {
    TooltipSystem.getInstance().registerContainer(this.el);
  }

  setRegion(region: Region): void {
    this.currentRegion = region;

    const nameEl = this.$('.map-region-name');
    if (nameEl) {
      nameEl.textContent = region.name;
    }

    this.renderMap();
  }

  setCurrentLocation(locationId: EntityId): void {
    this.currentLocationId = locationId;
    this.renderMap();
  }

  highlightPath(locationIds: EntityId[]): void {
    // Remove existing path highlights
    const existing = this.svgEl.querySelectorAll('.map-path-highlight');
    existing.forEach((el) => el.remove());

    if (!this.currentRegion || locationIds.length < 2) return;

    const locations = Array.from(this.currentRegion.locations.values());
    const posMap = this.computePositions(locations);

    for (let i = 0; i < locationIds.length - 1; i++) {
      const from = posMap.get(locationIds[i]);
      const to = posMap.get(locationIds[i + 1]);
      if (!from || !to) continue;

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(from.x));
      line.setAttribute('y1', String(from.y));
      line.setAttribute('x2', String(to.x));
      line.setAttribute('y2', String(to.y));
      line.setAttribute('class', 'map-path-highlight');
      this.svgEl.insertBefore(line, this.svgEl.firstChild);
    }
  }

  private renderMap(): void {
    // Clear SVG
    while (this.svgEl.firstChild) {
      this.svgEl.removeChild(this.svgEl.firstChild);
    }

    if (!this.currentRegion) return;

    const locations = Array.from(this.currentRegion.locations.values());
    const posMap = this.computePositions(locations);

    // Draw connections first (behind nodes)
    for (const loc of locations) {
      if (!loc.discovered) continue;
      const from = posMap.get(loc.id);
      if (!from) continue;

      for (const connId of loc.connections) {
        const to = posMap.get(connId);
        if (!to) continue;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', String(from.x));
        line.setAttribute('y1', String(from.y));
        line.setAttribute('x2', String(to.x));
        line.setAttribute('y2', String(to.y));
        line.setAttribute('class', 'map-connection');
        this.svgEl.appendChild(line);
      }
    }

    // Draw location nodes
    for (const loc of locations) {
      const pos = posMap.get(loc.id);
      if (!pos) continue;

      const isCurrent = loc.id === this.currentLocationId;
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('class', `map-node ${isCurrent ? 'map-node--current' : ''} ${loc.discovered ? '' : 'map-node--hidden'}`);
      group.setAttribute('data-tooltip', loc.discovered ? loc.name : '???');

      // Node circle
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', String(pos.x));
      circle.setAttribute('cy', String(pos.y));
      circle.setAttribute('r', isCurrent ? '10' : '8');
      circle.setAttribute('class', `map-node-circle ${isCurrent ? 'map-node-circle--current' : ''}`);
      group.appendChild(circle);

      // Location symbol
      if (loc.discovered) {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', String(pos.x));
        text.setAttribute('y', String(pos.y + 1));
        text.setAttribute('class', 'map-node-symbol');
        text.textContent = LOCATION_SYMBOLS[loc.locationType] ?? '\u25CF';
        group.appendChild(text);
      } else {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', String(pos.x));
        text.setAttribute('y', String(pos.y + 1));
        text.setAttribute('class', 'map-node-symbol map-node-symbol--hidden');
        text.textContent = '?';
        group.appendChild(text);
      }

      this.svgEl.appendChild(group);
    }
  }

  private computePositions(locations: Location[]): Map<EntityId, { x: number; y: number }> {
    const posMap = new Map<EntityId, { x: number; y: number }>();
    const padding = 25;
    const size = 200 - padding * 2;

    if (locations.length === 0) return posMap;

    // Use location coordinates to determine relative positions
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const loc of locations) {
      minX = Math.min(minX, loc.coordinates.x);
      minY = Math.min(minY, loc.coordinates.y);
      maxX = Math.max(maxX, loc.coordinates.x);
      maxY = Math.max(maxY, loc.coordinates.y);
    }

    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;

    for (const loc of locations) {
      const x = padding + ((loc.coordinates.x - minX) / rangeX) * size;
      const y = padding + ((loc.coordinates.y - minY) / rangeY) * size;
      posMap.set(loc.id, { x, y });
    }

    return posMap;
  }
}
