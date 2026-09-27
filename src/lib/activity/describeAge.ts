/**
 * Writes how long ago something happened in its largest whole unit:
 * `25m`, `3h` or `1d`. The age counts every hour, workday or not, because
 * it says when a thing happened rather than how long it has waited. A date
 * after `now` reads `0m`.
 */
export default function describeAge(at: Date, now: Date): string {
  const minutes = Math.max(
    0,
    Math.floor((now.getTime() - at.getTime()) / 60_000),
  );
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}
