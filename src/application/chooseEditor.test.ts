import { describe, expect, it } from "vitest";
import { thread } from "../testing/facts.js";
import { recordedOwed } from "../testing/recorded.js";
import { measureRow } from "../testing/rows.js";
import chooseEditor from "./chooseEditor.js";

const rows = recordedOwed().groups.flatMap((group) => group.rows);
const pullRequest = rows.find((row) => row.reference.text === "example#12");
const issue = rows.find((row) => row.reference.text === "example#15");

describe("chooseEditor", () => {
  it("opens assigning on an issue or a pull request", () => {
    expect(chooseEditor("assign", issue)).toMatchObject({
      reference: "example#15",
      thread: { number: 15 },
    });
    expect(chooseEditor("assign", pullRequest)).toMatchObject({
      reference: "example#12",
    });
  });

  it("opens requesting review on a pull request", () => {
    expect(chooseEditor("review", pullRequest)).toMatchObject({
      reference: "example#12",
      thread: { kind: "pullRequest" },
    });
  });

  it("refuses both when nothing is selected, as on a heading or a stack", () => {
    expect(chooseEditor("assign", undefined)).toEqual({
      refusal: {
        reason: "no issue or pull request is selected",
        recovery: "select one with ↑ ↓, then press a",
      },
    });
    expect(chooseEditor("review", undefined)).toEqual({
      refusal: {
        reason: "no pull request is selected",
        recovery: "select one with ↑ ↓, then press r",
      },
    });
  });

  it("refuses to assign on a discussion", () => {
    const discussion = measureRow({
      thread: thread({ kind: "discussion" }),
    });
    expect(chooseEditor("assign", discussion)).toEqual({
      refusal: {
        reason: `${discussion.reference.text} is a discussion, and discussions have no assignees`,
        recovery: "select an issue or pull request, then press a",
      },
    });
  });

  it("refuses a review on anything but a pull request", () => {
    expect(chooseEditor("review", issue)).toEqual({
      refusal: {
        reason:
          "example#15 is not a pull request, so no review can be requested on it",
        recovery: "select a pull request, then press r",
      },
    });
  });
});
