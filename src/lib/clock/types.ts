/** A day of the week, as the configuration writes it. */
export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

/**
 * The team's working clock: the days on which it runs, and the IANA time
 * zone whose calendar decides where each day starts and ends.
 */
export interface WorkingClock {
  readonly workdays: readonly Weekday[];
  readonly timezone: string;
}

/** `h` counts hours, `d` working days and `w` working weeks. */
export type DurationUnit = "h" | "d" | "w";

/** A duration as written, such as `24h` or `2d`. */
export interface Duration {
  readonly amount: number;
  readonly unit: DurationUnit;
}
