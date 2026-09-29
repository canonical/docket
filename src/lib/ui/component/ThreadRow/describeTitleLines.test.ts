import { describe, expect, it } from "vitest";
import {
  botReview,
  draftClose,
  sharedClose,
} from "../../../../testing/rows.js";
import describeTitleLines from "./describeTitleLines.js";

/** Each line's text, its runs joined. */
const read = (lines: ReturnType<typeof describeTitleLines>) =>
  lines.map((line) => line.map(({ text }) => text).join(""));

describe("describeTitleLines", () => {
  it("trims the title of a row that is not selected, so draft and the owner fit at the right edge", () => {
    expect(read(describeTitleLines(draftClose, 30, false))).toEqual([
      "Document the …  draft  ● alice",
    ]);
  });

  it("wraps the selected row's title in full, the owner on a line of its own when it does not fit beside the last", () => {
    expect(read(describeTitleLines(botReview, 38, true))).toEqual([
      "Update dependency example-lib to 3.24",
      `${" ".repeat(33)}● bob`,
    ]);
  });

  it("puts the owner beside the last line of the selected row's title when it fits there", () => {
    expect(read(describeTitleLines(botReview, 28, true))).toEqual([
      "Update dependency",
      "example-lib to 3.24    ● bob",
    ]);
  });

  it("leaves the right side empty when the owners take a line of their own", () => {
    expect(read(describeTitleLines(sharedClose, 38, true))).toEqual([
      "Where do tokens live?",
    ]);
  });
});
