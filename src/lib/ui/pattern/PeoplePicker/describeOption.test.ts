import { describe, expect, it } from "vitest";
import { tokens } from "../../../tokens/index.js";
import describeOption from "./describeOption.js";

/** Each line's text, its runs joined. */
const read = (lines: ReturnType<typeof describeOption>) =>
  lines.map((line) => line.map(({ text }) => text).join(""));

describe("describeOption", () => {
  it("draws the box, then the person behind their mark, whole, on one line when it fits", () => {
    const lines = describeOption(
      { owner: { text: "alice", kind: "person", group: "you" }, ticked: true },
      38,
    );
    expect(read(lines)).toEqual(["☑ ◉ alice"]);
    expect(lines[0]?.at(1)?.fg).toBe(tokens["color.text.team"]);
  });

  it("wraps a name too long for its line under itself, a team's organisation kept", () => {
    const lines = describeOption(
      {
        owner: {
          text: "example-org/a-team-with-a-very-long-name",
          kind: "person",
          group: "internal",
        },
        ticked: false,
      },
      20,
    );
    expect(read(lines)).toEqual([
      "☐ ◐ example-org/a-te",
      "    am-with-a-very-l",
      "    ong-name",
    ]);
    expect(lines[1]?.at(1)?.fg).toBe(tokens["color.text.internal"]);
  });

  it("indents a name with no group under the box alone", () => {
    expect(
      read(
        describeOption(
          {
            owner: { text: "example-org/reviewers", kind: "person" },
            ticked: false,
          },
          12,
        ),
      ),
    ).toEqual(["☐ example-or", "  g/reviewer", "  s"]);
  });
});
