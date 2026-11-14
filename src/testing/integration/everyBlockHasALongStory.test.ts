/**
 * Each block of the terminal draws text longer than its slots hold in a
 * story named `Long`, so how each gives way is drawn and kept as a golden
 * by Lago's plugin, beside the block's other stories.
 */
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../..");
const blocks = [
  ...new Bun.Glob("src/lib/ui/**/*.stories.tsx").scanSync(root),
].sort();

describe("the blocks' stories", () => {
  it("finds the blocks' stories files", () => {
    expect(blocks.length).toBeGreaterThan(0);
  });

  for (const path of blocks) {
    it(`draws the block of ${path} with text longer than it holds, in a story named Long`, async () => {
      const stories: Record<string, unknown> = await import(`${root}/${path}`);
      expect(Object.keys(stories)).toContain("Long");
    });
  }
});
