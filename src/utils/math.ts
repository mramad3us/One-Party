import type { Coordinate } from '@/types';

/** Clamps a value between min and max (inclusive). */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Linearly interpolates between a and b by factor t (0..1). */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Euclidean distance between two coordinates. */
export function distance(a: Coordinate, b: Coordinate): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Manhattan (taxicab) distance between two coordinates. */
export function manhattanDistance(a: Coordinate, b: Coordinate): number {
  return Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
}

/** Converts a coordinate to a string key in "x,y" format. */
export function coordToKey(c: Coordinate): string {
  return `${c.x},${c.y}`;
}

/** Parses a "x,y" string key back into a Coordinate. */
export function keyToCoord(key: string): Coordinate {
  const parts = key.split(',');
  return { x: parseInt(parts[0], 10), y: parseInt(parts[1], 10) };
}

/** Returns all adjacent coordinates (4 cardinal, optionally 4 diagonal). */
export function adjacentCoords(c: Coordinate, includeDiagonal = false): Coordinate[] {
  const result: Coordinate[] = [
    { x: c.x, y: c.y - 1 },  // north
    { x: c.x + 1, y: c.y },  // east
    { x: c.x, y: c.y + 1 },  // south
    { x: c.x - 1, y: c.y },  // west
  ];

  if (includeDiagonal) {
    result.push(
      { x: c.x + 1, y: c.y - 1 },  // northeast
      { x: c.x + 1, y: c.y + 1 },  // southeast
      { x: c.x - 1, y: c.y + 1 },  // southwest
      { x: c.x - 1, y: c.y - 1 },  // northwest
    );
  }

  return result;
}

/** D&D ability modifier: floor((score - 10) / 2). */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/**
 * D&D proficiency bonus by level.
 * Levels 1-4: +2, 5-8: +3, 9-12: +4, 13-16: +5, 17-20: +6.
 * Epic levels 21+: continues scaling at +1 per 4 levels.
 */
export function proficiencyBonus(level: number): number {
  return Math.floor((level - 1) / 4) + 2;
}
