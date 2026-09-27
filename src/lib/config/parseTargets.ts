import type { Duration } from "../clock/index.js";
import checkDuration from "./checkDuration.js";
import checkMap from "./checkMap.js";
import type { Checked, ConfigError, Layer } from "./types.js";

/** Reads a map of durations, renaming each key as `fields` says. */
function parseDurations<Field extends string>(
  value: unknown,
  path: string,
  fields: Readonly<Record<string, Field>>,
): Checked<Partial<Record<Field, Duration>>> {
  const entries = checkMap(value, path, Object.keys(fields));
  if (!entries.value) return { value: undefined, errors: entries.errors };
  const errors: ConfigError[] = [...entries.errors];
  const durations: Partial<Record<Field, Duration>> = {};
  for (const [key, entry] of entries.value) {
    const duration = checkDuration(entry, `${path}.${key}`);
    errors.push(...duration.errors);
    if (duration.value) durations[fields[key] as Field] = duration.value;
  }
  return { value: durations, errors };
}

/**
 * Reads the `targets` section, shaped as the model is: a metric, then the
 * source of a wait or the kind of thread, then a duration.
 */
export default function parseTargets(
  value: unknown,
): Checked<NonNullable<Layer["targets"]>> {
  const entries = checkMap(value, "targets", ["next-move", "close"]);
  if (!entries.value) return { value: undefined, errors: entries.errors };
  const nextMove = entries.value.has("next-move")
    ? parseDurations(entries.value.get("next-move"), "targets.next-move", {
        response: "response",
        review: "review",
      })
    : undefined;
  const close = entries.value.has("close")
    ? parseDurations(entries.value.get("close"), "targets.close", {
        issue: "issue",
        "pull-request": "pullRequest",
        discussion: "discussion",
      })
    : undefined;
  return {
    value: {
      ...(nextMove?.value && { nextMove: nextMove.value }),
      ...(close?.value && { close: close.value }),
    },
    errors: [
      ...entries.errors,
      ...(nextMove?.errors ?? []),
      ...(close?.errors ?? []),
    ],
  };
}
