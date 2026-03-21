import { gameTimeToCalendar } from '@/types/time';
import type { GameTime } from '@/types/core';

/**
 * Converts exact game time into immersive, roleplay-style descriptions.
 * The player never sees "14:30" — they see "the afternoon sun hangs heavy"
 * or "pale moonlight bathes the land in silver."
 */
export class TimeNarrator {

  /** Short status-bar style time string: "Dawn, Day 3" */
  static shortTime(time: GameTime): string {
    const cal = gameTimeToCalendar(time);
    const period = this.getPeriodName(cal.hour);
    return `${period}, Day ${this.getDayOfJourney(time)}`;
  }

  /** Roleplay description of the current time for the narrative log. */
  static describeTime(time: GameTime): string {
    const cal = gameTimeToCalendar(time);
    const dayNum = this.getDayOfJourney(time);
    const timeDesc = this.getTimeDescription(cal.hour, cal.minute);
    const dayLabel = dayNum === 1 ? 'your first day' : `day ${dayNum} of your journey`;

    return `It is ${timeDesc}. This is ${dayLabel}.`;
  }

  /** Rich atmospheric description for major time transitions. */
  static describeTimeTransition(before: GameTime, after: GameTime): string | null {
    const calBefore = gameTimeToCalendar(before);
    const calAfter = gameTimeToCalendar(after);

    const periodBefore = this.getTimePeriod(calBefore.hour);
    const periodAfter = this.getTimePeriod(calAfter.hour);

    if (periodBefore === periodAfter) return null;

    return this.getTransitionNarrative(periodAfter);
  }

  /** Ambient light description for the status bar. */
  static getLightDescription(time: GameTime): string {
    const cal = gameTimeToCalendar(time);
    const h = cal.hour;

    if (h >= 6 && h < 8) return 'Pale dawn light';
    if (h >= 8 && h < 11) return 'Morning light';
    if (h >= 11 && h < 14) return 'Bright daylight';
    if (h >= 14 && h < 17) return 'Afternoon light';
    if (h >= 17 && h < 19) return 'Golden hour';
    if (h >= 19 && h < 21) return 'Fading twilight';
    if (h >= 21 || h < 4) return 'Deep darkness';
    return 'Pre-dawn gloom';
  }

  /** Compact survival-style status line: "Midday | Warm | Calm" */
  static statusLine(time: GameTime): string {
    const cal = gameTimeToCalendar(time);
    const period = this.getPeriodName(cal.hour);
    const light = this.getLightLevel(cal.hour);
    return `${period} | ${light}`;
  }

  // ── Internal ──

  private static getDayOfJourney(time: GameTime): number {
    const totalHours = Math.floor(time.totalRounds / 10 / 60);
    return Math.floor((totalHours + 6) / 24) + 1; // +6 because we start at 6 AM
  }

  private static getPeriodName(hour: number): string {
    if (hour >= 5 && hour < 7) return 'Dawn';
    if (hour >= 7 && hour < 10) return 'Morning';
    if (hour >= 10 && hour < 12) return 'Late Morning';
    if (hour >= 12 && hour < 14) return 'Midday';
    if (hour >= 14 && hour < 17) return 'Afternoon';
    if (hour >= 17 && hour < 19) return 'Dusk';
    if (hour >= 19 && hour < 21) return 'Evening';
    if (hour >= 21 || hour < 1) return 'Night';
    if (hour >= 1 && hour < 3) return 'Deep Night';
    return 'Predawn';
  }

  private static getTimePeriod(hour: number): string {
    if (hour >= 5 && hour < 8) return 'dawn';
    if (hour >= 8 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 20) return 'evening';
    return 'night';
  }

  private static getLightLevel(hour: number): string {
    if (hour >= 8 && hour < 17) return 'Bright';
    if (hour >= 6 && hour < 8) return 'Dim';
    if (hour >= 17 && hour < 20) return 'Dim';
    return 'Dark';
  }

  private static getTimeDescription(hour: number, _minute: number): string {
    if (hour >= 5 && hour < 6) return 'the hour before dawn, when the sky bleeds from black to deep indigo';
    if (hour >= 6 && hour < 7) return 'early dawn — pale light creeps across the horizon, and the world stirs reluctantly from sleep';
    if (hour >= 7 && hour < 8) return 'morning — the sun climbs above the treeline, casting long shadows that stretch like grasping fingers';
    if (hour >= 8 && hour < 10) return 'mid-morning, the sun well risen and warmth beginning to seep into the stones';
    if (hour >= 10 && hour < 12) return 'late morning — the sun hangs bright and the day stretches ahead, full of uncertain promise';
    if (hour >= 12 && hour < 13) return 'high noon — the sun stands at its zenith, shadows pooling directly underfoot like dark water';
    if (hour >= 13 && hour < 15) return 'early afternoon — the heat of the day presses down, and even the birds have gone quiet';
    if (hour >= 15 && hour < 17) return 'late afternoon — the sun descends westward, painting everything in amber and honey';
    if (hour >= 17 && hour < 18) return 'the golden hour — warm light floods the world sideways, and every surface glows as if lit from within';
    if (hour >= 18 && hour < 19) return 'dusk — the sun sinks below the horizon in a smear of crimson and violet, and the air grows cool';
    if (hour >= 19 && hour < 21) return 'evening — the last bruised light fades from the sky, and stars begin to prick through the darkness';
    if (hour >= 21 && hour < 23) return 'night — darkness has claimed the land, and only starlight and the distant glow of distant fires mark the world';
    if (hour >= 23 || hour < 1) return 'the dead of night — the world sleeps under a vault of cold stars, and silence presses in from all sides';
    if (hour >= 1 && hour < 3) return 'the small hours — that deep, hollow stretch of night when time itself seems to slow';
    return 'the hours before dawn — the darkness is at its deepest, but a faint promise of light haunts the eastern sky';
  }

  private static getTransitionNarrative(newPeriod: string): string {
    switch (newPeriod) {
      case 'dawn':
        return 'The eastern horizon begins to glow — first a thin line of gold, then a spreading warmth that bleeds through the darkness. Dawn breaks, and with it comes the tentative chorus of waking birds. A new chapter of this day begins.';
      case 'morning':
        return 'The sun has fully risen now, burning away the last wisps of morning mist. Light falls clean and clear across the land, illuminating what the night had hidden. The day ahead stretches out before you like an unwritten page.';
      case 'afternoon':
        return 'The sun has crossed its peak and begun its slow descent toward the western horizon. Shadows lengthen almost imperceptibly, and the quality of the light shifts — warmer, more golden, carrying the faint melancholy of passing time.';
      case 'evening':
        return 'The sun meets the horizon in a spectacular display of color — burnished gold giving way to deep crimson, then purple, then the bruised indigo of oncoming night. The temperature drops noticeably, and the world grows quiet with the hush of evening.';
      case 'night':
        return 'Darkness settles over the land like a heavy cloak. The stars emerge one by one, ancient and indifferent, their cold light casting faint silver shadows. The sounds of night creatures begin — distant howls, the rustle of unseen things moving through undergrowth. The world belongs to other things now.';
      default:
        return 'Time passes, and the world shifts around you.';
    }
  }
}
