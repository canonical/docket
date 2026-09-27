import { describe, expect, it } from "vitest";
import isTimeZone from "./isTimeZone.js";

describe("isTimeZone", () => {
  it.each(["UTC", "Europe/Paris", "America/Santiago", "Etc/GMT+1"])(
    "accepts %s",
    (name) => {
      expect(isTimeZone(name)).toBe(true);
    },
  );

  it.each(["", "Europe/Nowhere", "europe/paris", "utc", "+01:00", "-05:00"])(
    "refuses %j",
    (name) => {
      expect(isTimeZone(name)).toBe(false);
    },
  );
});
