/**
 * Says whether `name` is a time zone of the IANA time-zone database, written
 * as the database writes it, such as `Europe/Paris` or `UTC`. Offsets such
 * as `+01:00` are not zone names, and neither is `europe/paris`.
 */
export default function isTimeZone(name: string): boolean {
  try {
    const resolved = new Intl.DateTimeFormat("en-US", { timeZone: name });
    return resolved.resolvedOptions().timeZone === name && /^[A-Z]/.test(name);
  } catch {
    return false;
  }
}
