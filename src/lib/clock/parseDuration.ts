import type { Duration, DurationUnit } from "./types.js";

const written = /^([1-9][0-9]*)([hdw])$/;

/**
 * Reads a duration written as a whole number followed by `h`, `d` or `w`,
 * such as `24h`, `2d` or `1w`.
 *
 * @returns The duration, or `undefined` when the text is not one.
 */
export default function parseDuration(text: string): Duration | undefined {
  const match = written.exec(text);
  if (!match) return undefined;
  const [, amount, unit] = match;
  return { amount: Number(amount), unit: unit as DurationUnit };
}
