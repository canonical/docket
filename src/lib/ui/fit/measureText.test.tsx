import { describe, expect, it } from "vitest";
import { draw } from "../../../testing/terminal.js";
import measureText from "./measureText.js";

/** The cells OpenTUI draws `text` in, read from the renderer's cell grid. */
async function drawCells(text: string): Promise<number> {
  const screen = await draw(<text>{`${text}|`}</text>, 60, 1);
  const cells = [...screen.setup.renderer.currentRenderBuffer.buffers.char];
  return cells.indexOf("|".charCodeAt(0));
}

/**
 * Text Bun measures differently from OpenTUI, or that a measure could
 * split: keycaps, emoji presentation, flags, skin tones, a Devanagari
 * cluster, a Thai title, Hangul written as jamo, a family joined by
 * zero-width joiners, and Persian with its non-joiner.
 */
const corpus = [
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
    it(`counts ${text} in exactly the cells OpenTUI draws it in`, async () => {
      expect(measureText(text)).toBe(await drawCells(text));
    });
  }

  it("counts where Bun's measure counts fewer cells than are drawn", () => {
    expect(Bun.stringWidth("❤")).toBe(1);
    expect(measureText("❤")).toBe(2);
    expect(measureText("👍🏽")).toBe(4);
    expect(Bun.stringWidth("👍🏽")).toBe(2);
  });

  it("counts nothing for no text, and a half of a broken pair as one cell", () => {
    expect(measureText("")).toBe(0);
    expect(measureText("\ud83d")).toBe(1);
  });
});
