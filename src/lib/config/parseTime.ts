import {
  isTimeZone,
  type Weekday,
  type WorkingClock,
  weekdays,
} from "../clock/index.js";
import checkList from "./checkList.js";
import checkMap from "./checkMap.js";
import type { Checked, ConfigError } from "./types.js";

const known: readonly unknown[] = weekdays;

function parseWorkdays(value: unknown): Checked<Weekday[]> {
  const days = checkList(value, "time.workdays");
  if (!days.value) return { value: undefined, errors: days.errors };
  const errors: ConfigError[] = [];
  if (days.value.length === 0) {
    errors.push({
      code: "CONFIG_EMPTY_LIST",
      message: "`time.workdays` lists no day, so the clock would never run.",
      recovery: "List at least one day, such as `[mon, tue, wed, thu, fri]`.",
    });
  }
  // Each day counts once, because the length of a working week is the
  // number of workdays.
  const seen = new Set<unknown>();
  for (const day of days.value) {
    if (!known.includes(day) || seen.has(day)) {
      errors.push({
        code: "CONFIG_UNKNOWN_WORKDAY",
        message: `\`time.workdays\` lists \`${String(day)}\`, which is not a day or is listed twice.`,
        recovery: `List each day once, from ${weekdays.map((name) => `\`${name}\``).join(", ")}.`,
      });
    }
    seen.add(day);
  }
  return { value: days.value as Weekday[], errors };
}

function parseTimezone(value: unknown): Checked<string> {
  if (typeof value === "string" && isTimeZone(value)) {
    return { value, errors: [] };
  }
  return {
    value: undefined,
    errors: [
      {
        code: "CONFIG_UNKNOWN_TIMEZONE",
        message: `\`time.timezone\` is \`${String(value)}\`, which is not a time-zone name.`,
        recovery:
          "Write a name from the IANA time-zone database, such as `Europe/Paris` or `UTC`.",
      },
    ],
  };
}

/** Reads the `time` section: the workdays and the time zone. */
export default function parseTime(
  value: unknown,
): Checked<Partial<WorkingClock>> {
  const entries = checkMap(value, "time", ["workdays", "timezone"]);
  if (!entries.value) return { value: undefined, errors: entries.errors };
  const workdays = entries.value.has("workdays")
    ? parseWorkdays(entries.value.get("workdays"))
    : undefined;
  const timezone = entries.value.has("timezone")
    ? parseTimezone(entries.value.get("timezone"))
    : undefined;
  return {
    value: {
      ...(workdays?.value && { workdays: workdays.value }),
      ...(timezone?.value && { timezone: timezone.value }),
    },
    errors: [
      ...entries.errors,
      ...(workdays?.errors ?? []),
      ...(timezone?.errors ?? []),
    ],
  };
}
