/** Whether `value` is an object literal, rather than an error or a date. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  Object.getPrototypeOf(value) === Object.prototype;

/**
 * Whether two values of the status hold the same: the same value, dates
 * of the same instant, or object literals whose fields are each the same.
 * Anything else, such as an error, is the same only as itself.
 */
export default function isSame(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  if (!isRecord(a) || !isRecord(b)) return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => isSame(a[key], b[key]))
  );
}
