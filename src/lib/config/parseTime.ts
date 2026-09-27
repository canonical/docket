import {
  isTimeZone,
  type Weekday,
  type WorkingClock,
  weekdays,
} from "../clock/index.js";
import checkList from "./checkList.js";
import checkMap from "./checkMap.js";
import type { ConfigError } from "./types.js";

const known: readonly unknown[] = weekdays;

function parseWorkdays(
  value: unknown,
  errors: ConfigError[],
): Weekday[] | undefined {
  const days = checkList(value, "time.workdays", errors);
  if (!days) return undefined;
  if (days.length === 0) {
    errors.push({
      code: "CONFIG_EMPTY_LIST",
      message: "`time.workdays` lists no day, so the clock would never run.",
      recovery: "List at least one day, such as `[mon, tue, wed, thu, fri]`.",
    });
  }
  // Each day counts once, because the length of a working week is the
  // number of workdays.
  const seen = new Set<unknown>();
  for (const day of days) {
    if (!known.includes(day) || seen.has(day)) {
      errors.push({
        code: "CONFIG_UNKNOWN_WORKDAY",
        message: `\`time.workdays\` lists \`${String(day)}\`, which is not a day or is listed twice.`,
        recovery: `List each day once, from ${weekdays.map((name) => `\`${name}\``).join(", ")}.`,
      });
    }
    seen.add(day);
  }
  return days as Weekday[];
}

function parseTimezone(
  value: unknown,
  errors: ConfigError[],
): string | undefined {
  if (typeof value === "string" && isTimeZone(value)) return value;
  errors.push({
    code: "CONFIG_UNKNOWN_TIMEZONE",
    message: `\`time.timezone\` is \`${String(value)}\`, which is not a time-zone name.`,
    recovery:
      "Write a name from the IANA time-zone database, such as `Europe/Paris` or `UTC`.",
  });
  return undefined;
}

/** Reads the `time` section: the workdays and the time zone. */
export default function parseTime(
  value: unknown,
  errors: ConfigError[],
): Partial<WorkingClock> | undefined {
  const entries = checkMap(value, "time", errors, ["workdays", "timezone"]);
  if (!entries) return undefined;
  const workdays = entries.has("workdays")
    ? parseWorkdays(entries.get("workdays"), errors)
    : undefined;
  const timezone = entries.has("timezone")
    ? parseTimezone(entries.get("timezone"), errors)
    : undefined;
  return { ...(workdays && { workdays }), ...(timezone && { timezone }) };
}
