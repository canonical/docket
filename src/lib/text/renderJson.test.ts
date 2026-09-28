import { describe, expect, it } from "vitest";
import renderJson from "./renderJson.js";

/** Every C0 control but the tab and the line feed, and every C1 control. */
const controls = [
  ...Array.from({ length: 32 }, (_, point) => point).filter(
    (point) => point !== 9 && point !== 10,
  ),
  ...Array.from({ length: 33 }, (_, index) => 0x7f + index),
].map((point) => String.fromCodePoint(point));

describe("renderJson", () => {
  it("writes the data as indented JSON, ending with a line feed", () => {
    expect(renderJson({ a: 1, b: [true, null] })).toBe(
      '{\n  "a": 1,\n  "b": [\n    true,\n    null\n  ]\n}\n',
    );
  });

  it("removes every C0 and C1 control from every string, however deep", () => {
    const written = renderJson({
      base: "ma\u009b2Jin\u0085",
      stack: { members: controls.map((control) => `a${control}`) },
    });
    expect(JSON.parse(written).base).toBe("main");
    const raw = [...written].filter((character) => {
      const point = character.codePointAt(0) ?? 0;
      return (point < 32 && point !== 10) || (point >= 127 && point <= 159);
    });
    expect(raw).toEqual([]);
  });

  it("keeps the lines and tabs of a comment", () => {
    expect(JSON.parse(renderJson({ body: "one\n\ttwo" }))).toEqual({
      body: "one\n\ttwo",
    });
  });
});
