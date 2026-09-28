import { describe, expect, it } from "vitest";
import chooseFormat from "./chooseFormat.js";

describe("chooseFormat", () => {
  it("writes plain text to a terminal and condensed Markdown elsewhere", () => {
    expect(chooseFormat(true)).toBe("plain");
    expect(chooseFormat(false)).toBe("llm");
  });
});
