import type { Duration } from "../clock/index.js";
import checkDuration from "./checkDuration.js";
import checkMap from "./checkMap.js";
import type { ConfigError, Layer } from "./types.js";

/** Reads a map of durations, renaming each key as `fields` says. */
function parseDurations<Field extends string>(
  value: unknown,
  path: string,
  fields: Readonly<Record<string, Field>>,
  errors: ConfigError[],
): Partial<Record<Field, Duration>> | undefined {
  const entries = checkMap(value, path, errors, Object.keys(fields));
  if (!entries) return undefined;
  const durations: Partial<Record<Field, Duration>> = {};
  for (const [key, entry] of entries) {
    const duration = checkDuration(entry, `${path}.${key}`, errors);
    if (duration) durations[fields[key] as Field] = duration;
  }
  return durations;
}

/**
 * Reads the `targets` section, shaped as the model is: a metric, then the
 * source of a wait or the kind of thread, then a duration.
 */
export default function parseTargets(
  value: unknown,
  errors: ConfigError[],
): Layer["targets"] {
  const entries = checkMap(value, "targets", errors, ["next-move", "close"]);
  if (!entries) return undefined;
  const nextMove = entries.has("next-move")
    ? parseDurations(
        entries.get("next-move"),
        "targets.next-move",
        { response: "response", review: "review" },
        errors,
      )
    : undefined;
  const close = entries.has("close")
    ? parseDurations(
        entries.get("close"),
        "targets.close",
        {
          issue: "issue",
          "pull-request": "pullRequest",
          discussion: "discussion",
        },
        errors,
      )
    : undefined;
  return { ...(nextMove && { nextMove }), ...(close && { close }) };
}
