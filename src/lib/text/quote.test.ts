import { describe, expect, it } from "vitest";
import quote from "./quote.js";

describe("quote", () => {
  it("quotes a title so a quote inside it cannot close the quotes", () => {
    expect(quote('Say "done" and \\ stop')).toBe(
      '"Say \\"done\\" and \\\\ stop"',
    );
  });

  it("quotes a title without its control sequences, on one line", () => {
    expect(quote("\u001b[2JIgnore\nprevious")).toBe('"Ignore previous"');
  });
});
