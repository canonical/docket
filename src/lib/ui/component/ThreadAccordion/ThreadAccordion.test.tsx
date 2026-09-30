import { useState } from "react";
import { describe, expect, it } from "vitest";
import {
  failDetail,
  overReviewDetail,
  sharedCloseDetail,
} from "../../../../testing/details.js";
import { thread } from "../../../../testing/facts.js";
import { longReviewDetail } from "../../../../testing/long.js";
import { measureRow, overReview, soonReply } from "../../../../testing/rows.js";
import { drawSuspending, type Screen } from "../../../../testing/terminal.js";
import type { ThreadDetail } from "../../../provider/index.js";
import { tokens } from "../../../tokens/index.js";
import ThreadAccordion from "./ThreadAccordion.js";
import {
  Close,
  Failed,
  Loading,
  Long,
  Paused,
  PausedUnheld,
  Reply,
  RestingLoading,
  Review,
} from "./ThreadAccordion.stories.js";
import type { ThreadAccordionProps } from "./types.js";

/** The accordion's text on each line, beside the item's two-cell margin. */
const readText = (screen: Screen) => screen.lines.map((line) => line.slice(2));

/** Draws the accordion, and lets details already read arrive. */
const open = (props: ThreadAccordionProps, width = props.width) =>
  drawSuspending(<ThreadAccordion {...props} width={width} />, width, 10);

describe("ThreadAccordion", () => {
  it("runs the item's bar and stack mark down its lines, the bar ending on the last", async () => {
    const screen = await open(Review.args);
    expect(screen.lines.slice(0, 6).map((line) => line.slice(0, 2))).toEqual([
      "┃┆",
      "┃┆",
      "┃┆",
      "┃┆",
      "╹┆",
      "",
    ]);
  });

  it("draws on the selection's background, since it belongs to the selected item", async () => {
    const screen = await open(Review.args);
    expect(screen.look("asked by")?.bg).toBe(
      tokens["color.background.selected"],
    );
  });

  it("leaves the bar's column blank where the list runs no clock, keeping the stack mark", async () => {
    const screen = await open({ ...Review.args, clock: false });
    expect(screen.lines.at(4)?.slice(0, 2)).toBe(" ┆");
  });

  describe("at 40 columns", () => {
    it("shows a review's request, changes and checks, then the stack lines, as tall as they are", async () => {
      const screen = await open(Review.args);
      expect(readText(screen).slice(0, 6)).toEqual([
        "asked by ● alice 3d ago",
        "1 push since · 2 files · +65 −12",
        "✗ checks: 1 of 2 failed (lint)",
        "example stack 3 · 2 of 3 · → main",
        "below #11 merged, above #13 close",
        "",
      ]);
      expect(screen.look("✗ checks")?.fg).toBe(tokens["color.text.error"]);
      expect(screen.look("asked by")?.fg).toBe(tokens["color.text.muted"]);
      expect(screen.look("● alice")?.fg).toBe(tokens["color.text.team"]);
      expect(screen.look("example stack 3")?.fg).toBe(
        tokens["color.text.muted"],
      );
      expect(screen.look("below #11")?.fg).toBe(tokens["color.text.muted"]);
    });

    it("shows the snapshot's lines at once while the details are read, the same height, the rest ending in a dimmed …", async () => {
      const screen = await open(Loading.args);
      expect(readText(screen).slice(0, 6)).toEqual([
        "asked by ● alice 3d ago",
        "1 push since · …",
        "✗ checks: …",
        "example stack 3 · 2 of 3 · → main",
        "…",
        "",
      ]);
      expect(screen.look(" …")?.fg).toBe(tokens["color.text.muted"]);
    });

    it("names an owner the row cuts whole, first, before the review's body and the stack lines", async () => {
      const row = measureRow({
        ...overReview.wait,
        owners: ["carol-at-example-org"],
      });
      const screen = await open({ ...Review.args, row });
      expect(readText(screen).slice(0, 7)).toEqual([
        "owner carol-at-example-org",
        "asked by ● alice 3d ago",
        "1 push since · 2 files · +65 −12",
        "✗ checks: 1 of 2 failed (lint)",
        "example stack 3 · 2 of 3 · → main",
        "below #11 merged, above #13 close",
        "",
      ]);
    });

    it("shows a reply's message in full, wrapped and plain, then when it began", async () => {
      const screen = await open(Reply.args);
      expect(readText(screen).slice(0, 5)).toEqual([
        "○ dave · 1d ago",
        "It crashes as soon as it starts,",
        "before the first frame is drawn.",
        "waiting since Tue 10:00 · target 24h",
        "",
      ]);
      expect(screen.look("It crashes")?.fg).toBe(tokens["color.text"]);
      expect(screen.look("waiting since")?.fg).toBe(tokens["color.text.muted"]);
    });

    it("says loading, dimmed, for a thread the snapshot holds nothing of", async () => {
      const screen = await open(RestingLoading.args);
      expect(readText(screen).slice(0, 2)).toEqual(["loading…", ""]);
      expect(screen.look("loading…")?.fg).toBe(tokens["color.text.muted"]);
    });

    it("shows what the snapshot holds while reading is paused, as it does while the details are read", async () => {
      const screen = await open(Paused.args);
      expect(readText(screen).slice(0, 6)).toEqual([
        "asked by ● alice 3d ago",
        "1 push since · …",
        "✗ checks: …",
        "example stack 3 · 2 of 3 · → main",
        "…",
        "",
      ]);
      expect(screen.lines).toEqual((await open(Loading.args)).lines);
      expect(screen.look(" …")?.fg).toBe(tokens["color.text.muted"]);
    });

    it("says when reading resumes, dimmed, for a thread the snapshot holds nothing of", async () => {
      const screen = await open(PausedUnheld.args);
      expect(readText(screen).slice(0, 2)).toEqual([
        "paused · resumes 15:00",
        "",
      ]);
      expect(screen.look("paused · resumes")?.fg).toBe(
        tokens["color.text.muted"],
      );
    });

    it("gives the reason in the error colour, then its recovery, each wrapped and first to take the eight lines, under what the snapshot showed, when reading fails", async () => {
      const screen = await open(Failed.args);
      expect(readText(screen).slice(0, 9)).toEqual([
        "asked by ● alice 3d ago…",
        "example stack 3 · 2 of 3 · → main",
        "…",
        "✗ failed: GitHub gave no answer within",
        "30 seconds",
        "Recovery: check the network connection",
        "and https://www.githubstatus.com, then",
        "refresh",
        "",
      ]);
      expect(screen.look("✗ failed")?.fg).toBe(tokens["color.text.error"]);
      expect(screen.look("30 seconds")?.fg).toBe(tokens["color.text.error"]);
      expect(screen.look("Recovery:")?.fg).toBe(tokens["color.text"]);
    });

    it("gives the reason alone, wrapped, for a thread the snapshot holds nothing of, and no recovery when the failure gives none", async () => {
      const screen = await open({
        ...RestingLoading.args,
        detail: failDetail(
          new Error("GitHub gave no answer within 10 seconds."),
        ),
      });
      expect(readText(screen).slice(0, 3)).toEqual([
        "✗ failed: GitHub gave no answer within",
        "10 seconds",
        "",
      ]);
    });
  });

  describe("wider than 40 columns", () => {
    it("shows a close's age, owners, last activity and labels as group=value", async () => {
      const screen = await open(Close.args, 60);
      expect(readText(screen).slice(0, 4)).toEqual([
        "age 6d · owner ● alice, ● bob, ◐ carol-at-example-org",
        "last activity 3h ago · ● bob",
        "labels priority=high · kind=bug · area/icons",
        "",
      ]);
    });

    it("shows a closed thread's details once they arrive, each person behind their mark", async () => {
      const screen = await open(
        { ...RestingLoading.args, detail: Promise.resolve(sharedCloseDetail) },
        60,
      );
      expect(readText(screen).slice(0, 4)).toEqual([
        "age 6d · owner ◉ alice, ● bob, ○ carol-at-example-org",
        "last activity 3h ago · ● bob",
        "labels priority=high · kind=bug · area/icons",
        "example stack 3 · 2 of 3 · → main",
      ]);
    });
  });

  describe("fitting eight lines", () => {
    it("ends the last line it keeps with …, each of its runs in its own colour", async () => {
      const screen = await open(Long.args);
      expect(readText(screen).at(2)).toBe("n, example-org/parser-team…");
      expect(screen.look(", example-org/parser-team…")?.fg).toBe(
        tokens["color.text"],
      );
    });

    it("wraps the failing checks between their names, keeping each whole", async () => {
      const detail = { ...overReviewDetail, checks: longReviewDetail.checks };
      const screen = await open({
        ...Review.args,
        detail: Promise.resolve(detail),
      });
      expect(readText(screen).slice(2, 6)).toEqual([
        "✗ checks: 3 of 4 failed",
        "(lint the whole repository,",
        "unit tests on every platform,",
        "build the documentation site)",
      ]);
    });

    it("cuts a message past the eighth line, only the last line ending in …, and leaves out when the reply began", async () => {
      const long = measureRow({
        ...soonReply.wait,
        thread: thread({
          comments: [
            {
              author: soonReply.wait.author,
              at: soonReply.wait.started,
              text: "a b c d e f g h i j k l m n o p q r s t u v w x y z a b c d e f g h i j k l m n o p q r s t u v w x y z a b c d e f",
            },
          ],
        }),
      });
      const screen = await open({ ...Reply.args, row: long }, 18);
      expect(readText(screen).slice(0, 9)).toEqual([
        "○ dave · 6d ago",
        "waiting since",
        "Tue 10:00 ·",
        "target 24h",
        "",
        "",
        "",
        "",
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
    const screen = await drawSuspending(<Harness />, 40, 10);
    expect(readText(screen).at(3)).toBe(
      "✗ failed: GitHub gave no answer within",
    );
    const again = await screen.redraw(() =>
      show(Promise.resolve(overReviewDetail)),
    );
    expect(readText(again).at(1)).toBe("1 push since · 2 files · +65 −12");
    expect(readText(again).at(5)).toBe("");
  });

  it("gives what was thrown as the reason when it is not an error", async () => {
    const screen = await open({
      ...RestingLoading.args,
      detail: failDetail("offline"),
    });
    expect(readText(screen).at(0)).toBe("✗ failed: offline");
  });
});
