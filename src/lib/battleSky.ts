/**
 * battleSky.ts — set the Weather & Sky dial to how it was on the day.
 *
 * When a battle is staged on the globe, the dial should open showing the
 * battle's real season: the date parsed from its record, and a plausible
 * temperature for that latitude at that time of year (a simple sinusoidal
 * climate — annual mean falls with latitude, seasonal swing grows with it,
 * peaking in late July north of the equator and late January south).
 *
 * Pure functions, no DOM — safe for the node test runner.
 */

const MONTHS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
];

/** The sun's path only depends on day-of-year; the dial uses this year. */
const REF_YEAR = 2026;

/**
 * Pull a month (and day if given) out of a battle's date label —
 * "14 October 1066", "Feb–Apr 2022", "Sept–Oct 1916", "1954 CE"…
 * Returns null when the label names no month.
 */
export function parseBattleDate(dateLabel: string): Date | null {
  const lower = dateLabel.toLowerCase();
  let month = -1;
  let at = Infinity;
  for (let m = 0; m < 12; m++) {
    const i = lower.indexOf(MONTHS[m]);
    if (i >= 0 && i < at) {
      at = i;
      month = m;
    }
  }
  if (month < 0) return null;
  const day = /(\b[0-3]?\d)\s+[a-z]/i.exec(dateLabel);
  const d = day ? Math.min(28, Math.max(1, parseInt(day[1], 10))) : 15;
  return new Date(Date.UTC(REF_YEAR, month, d));
}

/**
 * A plausible afternoon temperature (°C) for this latitude on this date.
 * Crude but honest: tropics stay warm year-round, high latitudes swing hard.
 */
export function seasonalTemperature(lat: number, date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const doy = Math.floor((date.getTime() - start) / 86_400_000);
  const annualMean = 28 - Math.abs(lat) * 0.35;
  const swing = Math.abs(lat) * 0.18;
  // Warm peak ~22 July in the north (day 202), ~22 January in the south.
  const peak = lat >= 0 ? 202 : 21;
  const t = annualMean + swing * Math.cos(((doy - peak) / 365) * 2 * Math.PI);
  return Math.round(Math.max(-20, Math.min(40, t)));
}
