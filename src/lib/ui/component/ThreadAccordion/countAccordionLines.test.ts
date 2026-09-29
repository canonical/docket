import { describe, expect, it } from "vitest";
import { recordedNow } from "../../../../testing/recorded.js";
import { overReview, soonReply } from "../../../../testing/rows.js";
import countAccordionLines from "./countAccordionLines.js";

const reading = {
  now: recordedNow,
  timezone: "Europe/Paris",
  waiting: {},
};

describe("countAccordionLines", () => {
  it("counts the lines the snapshot fills, before any read", () => {
    expect(countAccordionLines(overReview, reading, 40)).toBe(5);
    expect(countAccordionLines(soonReply, reading, 40)).toBe(4);
  });

  it("counts more lines where a narrower pane wraps the message", () => {
    expect(countAccordionLines(soonReply, reading, 24)).toBe(6);
  });

  it("counts one line for a thread the snapshot holds nothing of", () => {
    const resting = {
      repo: "example",
      thread: overReview.wait.thread,
      people: new Map(),
    };
    expect(countAccordionLines(resting, reading, 40)).toBe(1);
  });
});
