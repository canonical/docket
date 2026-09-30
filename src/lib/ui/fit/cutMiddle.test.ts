import { describe, expect, it } from "vitest";
import cutMiddle from "./cutMiddle.js";

describe("cutMiddle", () => {
  it("keeps a text that fits whole", () => {
    expect(cutMiddle("example#12", 10)).toBe("example#12");
  });

  it("cuts a longer text in its middle, keeping more of its end than its start", () => {
    expect(cutMiddle("example-repository-with-a-long-name#12345", 20)).toBe(
      "example-r…name#12345",
    );
  });

  it("counts display cells, so a wide character is never split", () => {
    expect(cutMiddle("🙂🙂🙂🙂🙂🙂", 6)).toBe("🙂…🙂");
  });

  it("keeps only the cut mark in one cell, and nothing in none", () => {
    expect(cutMiddle("example#12", 1)).toBe("…");
    expect(cutMiddle("example#12", 0)).toBe("");
  });

  it("removes control sequences before measuring", () => {
    expect(cutMiddle("example\u001b[2J#12", 10)).toBe("example#12");
  });
});
