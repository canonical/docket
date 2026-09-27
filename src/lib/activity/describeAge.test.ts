import { describe, expect, it } from "vitest";
import { at } from "../../testing/facts.js";
import describeAge from "./describeAge.js";

const now = at("2026-09-28T10:00+02:00");

describe("describeAge", () => {
  it("writes an age in its largest whole unit", () => {
    const ages = [
      "2026-09-28T09:35+02:00",
      "2026-09-28T06:59+02:00",
      "2026-09-27T10:01+02:00",
      "2026-09-27T10:00+02:00",
    ].map((iso) => describeAge(at(iso), now));
    expect(ages).toEqual(["25m", "3h", "23h", "1d"]);
  });

  it("counts the weekend, because an age says when a thing happened", () => {
    expect(describeAge(at("2026-09-25T10:00+02:00"), now)).toBe("3d");
  });

  it("reads an event dated after now as no time ago", () => {
    expect(describeAge(at("2026-09-28T10:05+02:00"), now)).toBe("0m");
  });
});
