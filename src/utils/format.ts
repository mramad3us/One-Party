import type { Calendar } from '@/types';

/** Formats a modifier as "+3" or "-1". Zero shows as "+0". */
export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

/** Formats HP as "current/max". */
export function formatHP(current: number, max: number): string {
  return `${current}/${max}`;
}

/** Formats coins as "15g 3s 2c", omitting zero denominations. */
export function formatCoin(gold: number, silver: number, copper: number): string {
  const parts: string[] = [];
  if (gold > 0) parts.push(`${gold}g`);
  if (silver > 0) parts.push(`${silver}s`);
  if (copper > 0) parts.push(`${copper}c`);
  return parts.length > 0 ? parts.join(' ') : '0c';
}

/** SVG coin icon reference. Returns an <svg> use-href string for inline use. */
function coinSvg(type: 'gold' | 'silver' | 'copper'): string {
  return `<svg class="coin-icon coin-icon--${type}" aria-hidden="true"><use href="#icon-coin-${type}"/></svg>`;
}

/**
 * Formats coins as HTML with pixel-art SVG coin icons.
 * Returns HTML string — use innerHTML to render.
 */
export function formatCoinHtml(gold: number, silver: number, copper: number): string {
  const parts: string[] = [];
  if (gold > 0) parts.push(`<span class="coin-amount coin-amount--gold">${gold}${coinSvg('gold')}</span>`);
  if (silver > 0) parts.push(`<span class="coin-amount coin-amount--silver">${silver}${coinSvg('silver')}</span>`);
  if (copper > 0) parts.push(`<span class="coin-amount coin-amount--copper">${copper}${coinSvg('copper')}</span>`);
  return parts.length > 0 ? parts.join(' ') : `<span class="coin-amount coin-amount--copper">0${coinSvg('copper')}</span>`;
}

/**
 * Formats a currency amount as HTML with SVG icons (longer form: "5 gp, 3 sp").
 */
export function formatCurrencyHtml(gold: number, silver: number, copper: number): string {
  const parts: string[] = [];
  if (gold > 0) parts.push(`<span class="coin-amount coin-amount--gold">${gold}${coinSvg('gold')}</span>`);
  if (silver > 0) parts.push(`<span class="coin-amount coin-amount--silver">${silver}${coinSvg('silver')}</span>`);
  if (copper > 0) parts.push(`<span class="coin-amount coin-amount--copper">${copper}${coinSvg('copper')}</span>`);
  return parts.length > 0 ? parts.join(' ') : `<span class="coin-amount coin-amount--copper">0${coinSvg('copper')}</span>`;
}

/** Formats a dice expression like "2d6+3". Omits bonus if 0. */
export function formatDice(count: number, die: number, bonus?: number): string {
  let result = `${count}d${die}`;
  if (bonus !== undefined && bonus !== 0) {
    result += bonus > 0 ? `+${bonus}` : `${bonus}`;
  }
  return result;
}

/** Formats a number as an ordinal: 1st, 2nd, 3rd, 4th, etc. */
export function formatOrdinal(n: number): string {
  const abs = Math.abs(n);
  const mod100 = abs % 100;

  // 11th, 12th, 13th are special cases
  if (mod100 >= 11 && mod100 <= 13) {
    return `${n}th`;
  }

  const mod10 = abs % 10;
  switch (mod10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

/** Formats a Calendar into a readable time string. */
export function formatTime(calendar: Calendar): string {
  const hourStr = String(calendar.hour).padStart(2, '0');
  const minuteStr = String(calendar.minute).padStart(2, '0');
  return `Day ${calendar.day}, Month ${calendar.month}, Year ${calendar.year} — ${hourStr}:${minuteStr}`;
}

/** Capitalizes the first letter of a string. */
export function capitalize(s: string): string {
  if (s.length === 0) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Basic English pluralization. Handles common patterns. */
export function pluralize(word: string, count: number): string {
  if (count === 1) return word;

  // Words ending in s, sh, ch, x, z
  if (/(?:s|sh|ch|x|z)$/i.test(word)) {
    return word + 'es';
  }

  // Words ending in consonant + y
  if (/[^aeiou]y$/i.test(word)) {
    return word.slice(0, -1) + 'ies';
  }

  // Words ending in f or fe
  if (/fe?$/i.test(word)) {
    return word.replace(/fe?$/i, 'ves');
  }

  return word + 's';
}
