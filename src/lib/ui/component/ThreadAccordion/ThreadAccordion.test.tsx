import { useState } from "react";
import { describe, expect, it } from "vitest";
import {
  failDetail,
  overReviewDetail,
  soonReplyDetail,
} from "../../../../testing/details.js";
import { measureRow, overReview } from "../../../../testing/rows.js";
import { drawSuspending } from "../../../../testing/terminal.js";
import type { ThreadDetail } from "../../../provider/index.js";
import { tokens } from "../../../tokens/index.js";
import ThreadAccordion from "./ThreadAccordion.js";
import {
  Close,
  Failed,
  Loading,
  Paused,
  PausedUnheld,
  Reply,
  Review,
} from "./ThreadAccordion.stories.js";
import type { ThreadAccordionProps } from "./types.js";

/** Draws the accordion, and lets details already read arrive. */
const open = (props: ThreadAccordionProps, width = props.width) =>
  drawSuspending(<ThreadAccordion {...props} width={width} />, width, 7);

describe("ThreadAccordion", () => {
  describe("at 40 columns", () => {
    it("shows a review's request, changes and checks, then the stack lines, dimmed", async () => {
      const screen = await open(Review.args);
      expect(screen.lines.slice(0, 6)).toEqual([
        "  asked by alice 3d ago",
        "  1 push since · 2 files · +65 −12",
        "  ✗ checks: 1 of 2 failed (lint)",
        "  example stack 3 · 2 of 3 · → main",
        "  below #11 merged, above #13 close",
        "",
      ]);
      expect(screen.look("✗ checks")?.fg).toBe(tokens["color.text.error"]);
      expect(screen.look("asked by")?.fg).toBe(tokens["color.text"]);
      expect(screen.look("example stack 3")?.fg).toBe(
        tokens["color.text.muted"],
      );
      expect(screen.look("below #11")?.fg).toBe(tokens["color.text.muted"]);
    });

    it("names an owner the row cuts whole, first, before the review's body and the stack lines", async () => {
      const row = measureRow({
        ...overReview.wait,
        owners: ["carol-at-example-org"],
      });
      const screen = await open({ ...Review.args, row });
      expect(screen.lines.slice(0, 6)).toEqual([
        "  owner carol-at-example-org",
        "  asked by alice 3d ago",
        "  1 push since · 2 files · +65 −12…",
        "  example stack 3 · 2 of 3 · → main",
        "  below #11 merged, above #13 close",
        "",
      ]);
    });

    it("keeps a stacked review's checks in its five lines when the row cuts only a team", async () => {
      const row = measureRow({
        ...overReview.wait,
        owners: ["example-org/reviewers"],
      });
      const screen = await open({ ...Review.args, row });
      expect(screen.lines.slice(0, 6)).toEqual([
        "  asked by alice 3d ago",
        "  1 push since · 2 files · +65 −12",
        "  ✗ checks: 1 of 2 failed (lint)",
        "  example stack 3 · 2 of 3 · → main",
        "  below #11 merged, above #13 close",
        "",
      ]);
    });

    it("shows a reply's message in full, wrapped, then when it began, in five lines", async () => {
      const screen = await open(Reply.args);
      expect(screen.lines.slice(0, 6)).toEqual([
        "  dave · 1d ago",
        "  It crashes as soon as it starts,",
        "  before the first frame is drawn.",
        "  waiting since Tue 10:00 · target 24h",
        "",
        "",
      ]);
    });

    it("says loading until the details arrive", async () => {
      const screen = await open(Loading.args);
      expect(screen.lines.slice(0, 6)).toEqual([
        "  loading…",
        "",
        "",
        "",
        "",
        "",
      ]);
    });

    it("shows what the snapshot holds while reading is paused, each line that needs the read ending in a dimmed …", async () => {
      const screen = await open(Paused.args);
      expect(screen.lines.slice(0, 6)).toEqual([
        "  asked 6d ago …",
        "  1 push since …",
        "  ✗ checks failed …",
        "  example stack 3 · 2 of 3 · → main",
        "  …",
        "",
      ]);
      expect(screen.look("asked 6d ago")?.fg).toBe(tokens["color.text"]);
      expect(screen.look("✗ checks failed")?.fg).toBe(
        tokens["color.text.error"],
      );
      expect(screen.look(" …")?.fg).toBe(tokens["color.text.muted"]);
    });

    it("says when reading resumes, dimmed, for a thread the snapshot holds nothing of", async () => {
      const screen = await open(PausedUnheld.args);
      expect(screen.lines.slice(0, 2)).toEqual([
        "  details paused · resumes 15:00",
        "",
      ]);
      expect(screen.look("details paused")?.fg).toBe(
        tokens["color.text.muted"],
      );
    });

    it("gives the reason, wrapped in the error colour, when reading fails", async () => {
      const screen = await open(Failed.args);
      expect(screen.lines.slice(0, 3)).toEqual([
        "  ✗ failed: GitHub gave no answer within",
        "  10 seconds",
        "",
      ]);
      expect(screen.look("✗ failed")?.fg).toBe(tokens["color.text.error"]);
    });
  });

  describe("wider than 40 columns", () => {
    it("shows a close's age, owners, last activity and labels as group=value", async () => {
      const screen = await open(Close.args, 60);
      expect(screen.lines.slice(0, 5)).toEqual([
        "  age 6d · owner alice, bob, carol-at-example-org",
        "  last activity 3h ago · bob",
        "  labels priority=high · kind=bug · area/icons",
        "",
        "",
      ]);
    });
  });

  describe("fitting five lines", () => {
    it("leaves out when a reply began when the message leaves no line for it", async () => {
      const screen = await open(Reply.args, 20);
      expect(screen.lines.slice(0, 6)).toEqual([
        "  dave · 1d ago",
        "  It crashes as soon",
        "  as it starts,",
        "  before the first",
        "  frame is drawn.",
        "",
      ]);
    });

    it("cuts a message past the fifth line, only the last line ending in …", async () => {
      const detail: ThreadDetail = {
        ...soonReplyDetail,
        messages: soonReplyDetail.messages.map((each) => ({
          ...each,
          body: "a b c d e f g h i j k l m n o p q r s t u v w x y z a b c d e f g h i",
        })),
      };
      const screen = await open(
        { ...Reply.args, detail: Promise.resolve(detail) },
        16,
      );
      expect(screen.lines.slice(0, 6)).toEqual([
        "  dave · 1d ago",
        "  a b c d e f g",
        "  h i j k l m n",
        "  o p q r s t u",
        "  v w x y z a b…",
        "",
      ]);
    });
  });

  it("forgets a failure once it is given other details", async () => {
    let show: (detail: Promise<ThreadDetail>) => void = () => {};
    const Harness = () => {
      const [detail, setDetail] = useState(Failed.args.detail);
      show = setDetail;
      return <ThreadAccordion {...Failed.args} detail={detail} />;
    };
    const screen = await drawSuspending(<Harness />, 40, 7);
    expect(screen.lines.at(0)).toBe("  ✗ failed: GitHub gave no answer within");
    const again = await screen.redraw(() =>
      show(Promise.resolve(overReviewDetail)),
    );
    expect(again.lines.at(0)).toBe("  asked by alice 3d ago");
  });

  it("gives what was thrown as the reason when it is not an error", async () => {
    const screen = await open({
      ...Failed.args,
      detail: failDetail("offline"),
    });
    expect(screen.lines.at(0)).toBe("  ✗ failed: offline");
  });
});
