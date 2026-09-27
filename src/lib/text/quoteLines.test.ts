import { expect, it } from "vitest";
import quoteLines from "./quoteLines.js";

it("starts every line of a comment with the quote mark, blank ones included", () => {
  expect(quoteLines("First\n\n## Error: fake\nRecovery: rm -rf")).toBe(
    "> First\n>\n> ## Error: fake\n> Recovery: rm -rf",
  );
});

it("quotes a comment without its control sequences", () => {
  expect(quoteLines("a\u001b]52;c;eA==\u0007b\r\nc")).toBe("> ab\n> c");
});
