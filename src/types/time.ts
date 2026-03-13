import type { Calendar, GameTime, TimeScale } from './core';

// Re-export core time types
export type { Calendar, GameTime, TimeScale } from './core';

/** Time conversion constants */
export const ROUNDS_PER_MINUTE = 10;
export const ROUNDS_PER_HOUR = 600;
export const ROUNDS_PER_DAY = 14400;

/** Context for the current time scale */
export type TimeContext = {
  scale: TimeScale;
  roundsPerTurn: number;
};

/**
 * Convert a GameTime to a Calendar.
 * Assumes a simple 30-day month, 12-month year, starting at year 1, day 1, hour 6 (dawn).
 */
export function gameTimeToCalendar(time: GameTime): Calendar {
  const totalMinutes = time.totalRounds / ROUNDS_PER_MINUTE;
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);

  const minute = Math.floor(totalMinutes % 60);
  const hour = (6 + totalHours) % 24; // Start at 6 AM
  const adjustedDays = totalDays + Math.floor((6 + totalHours) / 24);

  const day = (adjustedDays % 30) + 1;
  const totalMonths = Math.floor(adjustedDays / 30);
  const month = (totalMonths % 12) + 1;
  const year = Math.floor(totalMonths / 12) + 1;

  return { day, month, year, hour, minute };
}

/**
 * Format a Calendar as a human-readable string.
 * Example: "Year 1, Month 3, Day 15 — 14:30"
 */
export function calendarToString(cal: Calendar): string {
  const hh = String(cal.hour).padStart(2, '0');
  const mm = String(cal.minute).padStart(2, '0');
  return `Year ${cal.year}, Month ${cal.month}, Day ${cal.day} — ${hh}:${mm}`;
}
