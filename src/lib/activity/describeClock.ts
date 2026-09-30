/**
 * Writes the time of day of `at` in `timezone` on the 24-hour clock, such
 * as `14:20`, the way both faces state when something happened, resumes
 * or resets.
 */
export default function describeClock(at: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(at);
}
