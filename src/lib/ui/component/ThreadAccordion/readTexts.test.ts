import { describe, expect, it } from "vitest";
import { tokens } from "../../../tokens/index.js";
import readTexts from "./readTexts.js";

const fg = tokens["color.text"];

describe("readTexts", () => {
  it("reads each line as the accordion draws it whole, a no-break space as a space and a pending line with its …", () => {
    expect(
      readTexts([
        { pieces: [{ text: "unit tests", fg }], kind: "words", most: 1 },
        {
          pieces: [{ text: "1 push since", fg }],
          kind: "words",
          most: 1,
          pending: true,
        },
      ]),
    ).toEqual(["unit tests", "1 push since …"]);
  });
});
