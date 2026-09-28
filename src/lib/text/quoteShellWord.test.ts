import { describe, expect, it } from "vitest";
import quoteShellWord from "./quoteShellWord.js";

describe("quoteShellWord", () => {
  it("leaves a login, a team and a reference as they are", () => {
    expect(
      ["bob", "example-org/reviewers", "example#12"].map(quoteShellWord),
    ).toEqual(["bob", "example-org/reviewers", "example#12"]);
  });

  it("keeps a word with a space or a shell character as one word that runs nothing", () => {
    expect(quoteShellWord("bob carol")).toBe("'bob carol'");
    expect(quoteShellWord("bob;touch x")).toBe("'bob;touch x'");
    expect(quoteShellWord("#12")).toBe("'#12'");
    expect(quoteShellWord("")).toBe("''");
  });

  it("writes a single quote inside the word so it cannot end the quotes", () => {
    expect(quoteShellWord("it's")).toBe("'it'\\''s'");
  });
});
