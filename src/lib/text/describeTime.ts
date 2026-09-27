/**
 * Writes an instant as a date and a time of day in `timezone`, with the
 * zone named, such as `2026-09-28 11:58 Europe/Paris`: an agent cannot see
 * the reader's clock, so the zone is always stated.
 */
export default function describeTime(at: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")} ${timezone}`;
}
