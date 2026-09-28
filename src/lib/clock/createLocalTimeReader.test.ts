import { describe, expect, it } from "vitest";
import { hourMilliseconds } from "./constants.js";
import createLocalTimeReader from "./createLocalTimeReader.js";

const at = (text: string) => new Date(text).getTime();

describe("createLocalTimeReader", () => {
  it("reads the local date, the offset and the weekday a zone shows", () => {
    expect(
      createLocalTimeReader("Europe/Paris")(at("2026-09-22T23:30Z")),
    ).toEqual({
      date: Date.UTC(2026, 8, 23),
      offset: 2 * hourMilliseconds,
      weekday: "wed",
    });
  });

  it("reads an offset behind UTC as negative", () => {
    expect(
      createLocalTimeReader("America/New_York")(at("2026-09-22T02:00Z")),
    ).toEqual({
      date: Date.UTC(2026, 8, 21),
      offset: -4 * hourMilliseconds,
      weekday: "mon",
    });
  });

  it("follows the zone's clock change", () => {
    const read = createLocalTimeReader("Europe/Paris");
    expect(read(at("2026-10-25T00:30Z")).offset).toBe(2 * hourMilliseconds);
    expect(read(at("2026-10-25T01:30Z")).offset).toBe(hourMilliseconds);
  });

  it("reads an instant between whole seconds by the second it falls in", () => {
    const read = createLocalTimeReader("UTC");
    expect(read(at("2026-09-22T10:00:00.750Z")).offset).toBe(0);
  });

  it("gives every caller in a zone the same reader", () => {
    expect(createLocalTimeReader("Asia/Tokyo")).toBe(
      createLocalTimeReader("Asia/Tokyo"),
    );
    expect(createLocalTimeReader("Asia/Tokyo")).not.toBe(
      createLocalTimeReader("UTC"),
    );
  });
});
