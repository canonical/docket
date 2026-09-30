import { resolveRenderLib } from "@opentui/core";
import { testRender } from "@opentui/react/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import measureText from "./measureText.js";

const drawn: { destroy: () => void }[] = [];
afterEach(() => {
  for (const renderer of drawn.splice(0)) renderer.destroy();
});

/** The cells OpenTUI's renderer gives `text`, read from where a mark after it lands. */
async function drawCells(text: string): Promise<number> {
  const width = 30;
  const setup = await testRender(<text>{`${text}|`}</text>, {
    width,
    height: 1,
  });
  drawn.push(setup.renderer);
  await setup.renderOnce();
  const line = (setup.captureSpans().lines.at(0)?.spans ?? [])
    .map((span) => span.text)
    .join("");
  // Each cell after the mark holds one space.
  return width - 1 - (line.length - line.lastIndexOf("|") - 1);
}

/** Text of one code point a character, which OpenTUI draws as measured. */
const single = [
  "Fix the parser",
  "Réparer l'éditeur",
  "漢字",
  "ｱ",
  "🙂🚀",
  "❤",
  "✓ ✗ ◉ ● ◐ ○ ■",
  "↔ → ⏎ ⇞ ␣ … · ─ ┃ ╹ ┆ █",
  "™ © ① × °",
];

/** Characters of several code points, which OpenTUI draws in fewer cells than measured or as many. */
const clusters = ["👍🏽", "🇫🇷", "é", "❤️", "1️⃣", "क्षि"];

describe("measureText", () => {
  for (const text of single) {
    it(`counts ${text} in the cells OpenTUI draws it in`, async () => {
      expect(measureText(text)).toBe(await drawCells(text));
    });
  }

  for (const text of clusters) {
    it(`never counts ${text} narrower than OpenTUI draws it`, async () => {
      expect(measureText(text)).toBeGreaterThanOrEqual(await drawCells(text));
    });
  }

  it("counts where Bun's measure counts fewer cells than are drawn", () => {
    expect(Bun.stringWidth("❤")).toBe(1);
    expect(measureText("❤")).toBe(2);
    expect(measureText("👍🏽")).toBeGreaterThan(Bun.stringWidth("👍🏽"));
  });

  it("counts a character as Bun does when OpenTUI's library cannot encode it", () => {
    // The native library is the boundary: it fails only when it cannot
    // allocate, which a test cannot bring about.
    const encode = vi
      .spyOn(resolveRenderLib(), "encodeUnicode")
      .mockReturnValueOnce(null);
    expect(measureText("½")).toBe(1);
    encode.mockRestore();
  });

  it("counts nothing for no text, and a half of a broken pair as one cell", () => {
    expect(measureText("")).toBe(0);
    expect(measureText("\ud83d")).toBe(1);
  });
});
