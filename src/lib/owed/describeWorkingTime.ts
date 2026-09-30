import { hourMilliseconds } from "../clock/index.js";

/**
 * Writes an amount of working time in whole days from one working day of
 * 24 hours on, and in whole hours below it, both rounded down: `2d`,
 * `14h`, and `0h` within the hour.
 *
 * @param milliseconds The working time, as `measureWorkingTime` counts it.
 */
export default function describeWorkingTime(milliseconds: number): string {
  const hours = Math.floor(milliseconds / hourMilliseconds);
  return hours >= 24 ? `${Math.floor(hours / 24)}d` : `${hours}h`;
}
