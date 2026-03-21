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

const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  village: 'Village',
  town: 'Town',
  city: 'City',
  dungeon: 'Dungeon',
  wilderness: 'Wilderness',
  ruins: 'Ruins',
  castle: 'Castle',
  cave: 'Cave',
  temple: 'Temple',
  camp: 'Camp',
};

/**
 * World map panel with node-based region visualization.
 * Clicking a location opens a detail tile showing what the party knows,
 * with a "Travel" button to move there.
 */
export class MapPanel extends Component {
  private svgEl!: SVGSVGElement;
  private detailEl!: HTMLElement;
  private currentRegion: Region | null = null;
  private currentLocationId: EntityId | null = null;
  private selectedLocationId: EntityId | null = null;

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

    // Location detail tile (hidden by default)
    this.detailEl = el('div', { class: 'map-detail map-detail--hidden' });
    wrapper.appendChild(this.detailEl);

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

    this.selectedLocationId = null;
    this.hideDetail();
    this.renderMap();
  }

  setCurrentLocation(locationId: EntityId): void {
    this.currentLocationId = locationId;
    this.renderMap();
    // If the selected location is now current, refresh detail
    if (this.selectedLocationId) {
      this.showDetail(this.selectedLocationId);
    }
  }

  highlightPath(locationIds: EntityId[]): void {
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

  // ── Detail Tile ──

  private showDetail(locationId: EntityId): void {
    if (!this.currentRegion) return;
    const loc = this.currentRegion.locations.get(locationId);
    if (!loc) return;

    this.selectedLocationId = locationId;
    this.detailEl.innerHTML = '';
    this.detailEl.classList.remove('map-detail--hidden');

    const isCurrent = locationId === this.currentLocationId;
    const isConnected = this.isConnectedToCurrent(locationId);

    // Header with symbol and name
    const header = el('div', { class: 'map-detail-header' });
    const symbol = el('span', { class: 'map-detail-symbol' }, [
      LOCATION_SYMBOLS[loc.locationType] ?? '\u25CF',
    ]);
    header.appendChild(symbol);

    if (loc.discovered) {
      header.appendChild(el('span', { class: 'map-detail-name font-heading' }, [loc.name]));
    } else {
      header.appendChild(el('span', { class: 'map-detail-name map-detail-name--unknown font-heading' }, ['Unknown Place']));
    }

    // Close button
    const closeBtn = el('button', { class: 'map-detail-close btn btn-ghost' }, ['\u2715']);
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hideDetail();
    });
    header.appendChild(closeBtn);
    this.detailEl.appendChild(header);

    // Type badge
    const typeBadge = el('div', { class: 'map-detail-type font-mono' }, [
      LOCATION_TYPE_LABELS[loc.locationType] ?? loc.locationType,
    ]);
    if (isCurrent) {
      typeBadge.appendChild(el('span', { class: 'map-detail-current-badge' }, [' \u2022 You are here']));
    }
    this.detailEl.appendChild(typeBadge);

    // Description (only if discovered)
    if (loc.discovered) {
      this.detailEl.appendChild(
        el('div', { class: 'map-detail-desc' }, [loc.description]),
      );

      // Known sub-locations
      const knownSubs = Array.from(loc.subLocations.values()).filter(s => s.discovered);
      if (knownSubs.length > 0) {
        const subsSection = el('div', { class: 'map-detail-section' });
        subsSection.appendChild(el('div', { class: 'map-detail-section-title font-mono' }, ['Known Places']));
        for (const sub of knownSubs) {
          subsSection.appendChild(el('div', { class: 'map-detail-sub font-mono' }, [
            `\u2022 ${sub.name} (${sub.subType})`,
          ]));
        }
        this.detailEl.appendChild(subsSection);
      }

      // Connected locations
      const connectedLocs = loc.connections
        .map(id => this.currentRegion!.locations.get(id))
        .filter((l): l is Location => l != null);

      if (connectedLocs.length > 0) {
        const connSection = el('div', { class: 'map-detail-section' });
        connSection.appendChild(el('div', { class: 'map-detail-section-title font-mono' }, ['Connected To']));
        for (const conn of connectedLocs) {
          const connName = conn.discovered ? conn.name : '???';
          connSection.appendChild(el('div', { class: 'map-detail-sub font-mono' }, [
            `\u2022 ${connName}`,
          ]));
        }
        this.detailEl.appendChild(connSection);
      }

      // Last visited
      if (loc.lastVisited) {
        this.detailEl.appendChild(
          el('div', { class: 'map-detail-visited font-mono' }, ['Previously visited']),
        );
      }

      // Tags
      if (loc.tags.length > 0) {
        const tagsEl = el('div', { class: 'map-detail-tags' });
        for (const tag of loc.tags) {
          tagsEl.appendChild(el('span', { class: 'map-detail-tag badge' }, [tag]));
        }
        this.detailEl.appendChild(tagsEl);
      }
    } else {
      // Undiscovered — mysterious description
      this.detailEl.appendChild(
        el('div', { class: 'map-detail-desc map-detail-desc--unknown' }, [
          'This place remains shrouded in mystery. Perhaps the road will reveal its secrets in time.',
        ]),
      );
    }

    // Travel button (only if not current and reachable)
    if (!isCurrent && isConnected) {
      const travelBtn = el('button', { class: 'btn btn-primary map-detail-travel' }, [
        `Travel to ${loc.discovered ? loc.name : 'this place'}`,
      ]);
      travelBtn.addEventListener('click', () => {
        this.engine.events.emit({
          type: 'map:travel',
          category: 'ui',
          data: { locationId },
        });
        this.hideDetail();
      });
      this.detailEl.appendChild(travelBtn);
    } else if (!isCurrent && !isConnected) {
      this.detailEl.appendChild(
        el('div', { class: 'map-detail-unreachable font-mono' }, [
          'No direct path from your current location.',
        ]),
      );
    }
  }

  private hideDetail(): void {
    this.selectedLocationId = null;
    this.detailEl.classList.add('map-detail--hidden');
    this.detailEl.innerHTML = '';
    this.renderMap(); // Deselect visual highlight
  }

  private isConnectedToCurrent(locationId: EntityId): boolean {
    if (!this.currentRegion || !this.currentLocationId) return false;
    const currentLoc = this.currentRegion.locations.get(this.currentLocationId);
    if (!currentLoc) return false;
    return currentLoc.connections.includes(locationId);
  }

  // ── Rendering ──

  private renderMap(): void {
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
      const isSelected = loc.id === this.selectedLocationId;
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');

      let cls = 'map-node';
      if (isCurrent) cls += ' map-node--current';
      if (isSelected) cls += ' map-node--selected';
      if (!loc.discovered) cls += ' map-node--hidden';
      group.setAttribute('class', cls);
      group.style.cursor = 'pointer';

      // Click handler
      group.addEventListener('click', () => {
        if (this.selectedLocationId === loc.id) {
          this.hideDetail();
        } else {
          this.showDetail(loc.id);
          this.renderMap(); // Re-render to update selected highlight
          this.showDetail(loc.id); // Re-show since renderMap clears it visually
        }
      });

      // Node circle
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', String(pos.x));
      circle.setAttribute('cy', String(pos.y));
      circle.setAttribute('r', isCurrent ? '10' : isSelected ? '10' : '8');
      let circleClass = 'map-node-circle';
      if (isCurrent) circleClass += ' map-node-circle--current';
      if (isSelected) circleClass += ' map-node-circle--selected';
      circle.setAttribute('class', circleClass);
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

      // Location name label (for discovered)
      if (loc.discovered) {
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', String(pos.x));
        label.setAttribute('y', String(pos.y + (isCurrent ? 18 : 16)));
        label.setAttribute('class', 'map-node-label');
        label.textContent = loc.name;
        group.appendChild(label);
      }

      this.svgEl.appendChild(group);
    }
  }

  private computePositions(locations: Location[]): Map<EntityId, { x: number; y: number }> {
    const posMap = new Map<EntityId, { x: number; y: number }>();
    const padding = 25;
    const size = 200 - padding * 2;

    if (locations.length === 0) return posMap;

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
