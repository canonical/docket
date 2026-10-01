import {
  OptimizedBuffer,
  TextBuffer,
  TextBufferView,
  type WidthMethod,
} from "@opentui/core";
import { describe, expect, it, vi } from "vitest";
import measureText from "./measureText.js";

/**
 * The cells OpenTUI draws `text` in with `method`, as its renderer draws a
 * text: into a cell buffer, from a text buffer, read back from the grid.
 */
function drawCells(text: string, method: WidthMethod): number {
  const grid = OptimizedBuffer.create(60, 1, method);
  const buffer = TextBuffer.create(method);
  buffer.setText(`${text}|`);
  const view = TextBufferView.create(buffer);
  view.setWrapMode("none");
  grid.drawTextBuffer(view, 0, 0);
  const cells = [...grid.buffers.char].indexOf("|".charCodeAt(0));
  view.destroy();
  buffer.destroy();
  grid.destroy();
  return cells;
}

/**
 * Text Bun measures differently from OpenTUI, or that a measure could
 * split: keycaps, emoji presentation, flags, skin tones, a Devanagari
 * cluster, a Thai title, Hangul written as jamo, a family joined by
 * zero-width joiners, and Persian with its non-joiner.
 */
const corpus = [
  "⚠️ ✔️",
  "Fix the parser",
  "Réparer l'éditeur",
  "漢字",
  "✓ ✗ ◉ ● ◐ ○ ■ ↔ → ⏎ … · ─ ┃ ╹ ┆ █",
  "1️⃣ #️⃣",
  "❤️ ❤",
  "🇫🇷 🇺🇸🇬",
  "👍🏽 🧑🏿",
  "क्षि",
  "แก้ไขตัวแยกวิเคราะห์ให้ถูกต้อง",
  "각",
  "👨‍👩‍👧 👩🏽‍💻",
  "می‌خواهم",
  "é",
];

describe("measureText", () => {
  for (const text of corpus) {
    it(`counts ${text} as the wider of the cells OpenTUI draws it in with either width method`, () => {
      const drawn = [drawCells(text, "wcwidth"), drawCells(text, "unicode")];
      expect(measureText(text)).toBe(Math.max(...drawn));
    });
  }

  it("counts a keycap and emoji with their variation selector as the unicode method draws them, wider than wcwidth", () => {
    for (const text of ["⚠️", "✔️", "1️⃣"]) {
      expect([drawCells(text, "wcwidth"), drawCells(text, "unicode")]).toEqual([
        1, 2,
      ]);
      expect(measureText(text)).toBe(2);
    }
    expect(drawCells("👍🏽", "wcwidth")).toBe(4);
    expect(measureText("👍🏽")).toBe(4);
  });

  it("counts where Bun's measure counts fewer cells than are drawn", () => {
    expect(Bun.stringWidth("❤")).toBe(1);
    expect(measureText("❤")).toBe(2);
    expect(measureText("👍🏽")).toBe(4);
    expect(Bun.stringWidth("👍🏽")).toBe(2);
  });

  describe("its kept texts", () => {
    const title = "Réparer ❤ une fois";
    /** A fresh measure, keeping no text yet, and the fitting that uses it. */
    const load = async () => {
      vi.resetModules();
      const measure = (await import("./measureText.js")).default;
      const block = (await import("./fitBlock.js")).default;
      /** Whether measuring the title splits it into characters. */
      const measuresTitle = () => {
        const segment = vi.spyOn(Intl.Segmenter.prototype, "segment");
        expect(measure(title)).toBe(19);
        const split = segment.mock.calls.some(([text]) => text === title);
        segment.mockRestore();
        return split;
      };
      const field = (await import("./fitField.js")).default;
      return { measure, block, field, measuresTitle };
    };

    it("measures a text once until 4096 texts are kept, then forgets them all", async () => {
      const { measure, measuresTitle } = await load();
      measure(title);
      for (let each = 1; each < 4096; each += 1) measure(`❤${each}`);
      expect(measuresTitle()).toBe(false);
      measure("❤ one more");
      expect(measuresTitle()).toBe(true);
    });

    it("keeps a title across draws of a wrapped message longer than it keeps, in runs or as one field", async () => {
      const { measure, block, field, measuresTitle } = await load();
      const message = Array.from({ length: 4500 }, (_, each) => `été${each}`);
      const runs = [{ text: message.join(" "), fg: "#ffffff" }];
      measure(title);
      block(runs, "quote", 37);
      expect(measuresTitle()).toBe(false);
      block(runs, "quote", 37);
      expect(measuresTitle()).toBe(false);
      const text = { text: message.join(" "), kind: "quote" as const };
      field(text, "block", 37);
      expect(measuresTitle()).toBe(false);
      field(text, "block", 37);
      expect(measuresTitle()).toBe(false);
    });

    it("splits no word of a wrapped message into characters when it is drawn a second time", async () => {
      const { block, field } = await load();
      const text = "Réparer ❤ une fois, puis été comme à l'été";
      block([{ text, fg: "#ffffff" }], "quote", 12);
      field({ text, kind: "quote" }, "block", 12);
      const segment = vi.spyOn(Intl.Segmenter.prototype, "segment");
      block([{ text, fg: "#ffffff" }], "quote", 12);
      field({ text, kind: "quote" }, "block", 12);
      expect(segment).not.toHaveBeenCalled();
      segment.mockRestore();
    });
  });

  it("counts nothing for no text, and a half of a broken pair as one cell", () => {
    expect(measureText("")).toBe(0);
    expect(measureText("\ud83d")).toBe(1);
  });
});
