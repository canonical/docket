import { useState } from "react";
import { describe, expect, it } from "vitest";
import {
  failDetail,
  overReviewDetail,
  sharedCloseDetail,
} from "../../../../testing/details.js";
import { thread } from "../../../../testing/facts.js";
import { findFinishedRow } from "../../../../testing/finished.js";
import { recordedNow } from "../../../../testing/recorded.js";
import { measureRow, overReview, soonReply } from "../../../../testing/rows.js";
import { drawSuspending, type Screen } from "../../../../testing/terminal.js";
import type { FinishedRow } from "../../../finished/index.js";
import type { ThreadDetail } from "../../../provider/index.js";
import { tokens } from "../../../tokens/index.js";
import ThreadAccordion from "./ThreadAccordion.js";
import {
  Close,
  Failed,
  FinishedClosedIn,
  FinishedOver,
  FinishedStackLoading,
  Loading,
  Paused,
  PausedUnheld,
  Reply,
  RestingLoading,
  Review,
} from "./ThreadAccordion.stories.js";
import type { ShownDetail, ThreadAccordionProps } from "./types.js";

/** The accordion's text on each line, beside the item's two-cell margin. */
const readText = (screen: Screen) => screen.lines.map((line) => line.slice(2));

/** The accordion under finished's `row`, as finished's list gives it. */
const underFinished = (
  row: FinishedRow,
  detail?: Promise<ShownDetail>,
): ThreadAccordionProps => ({
  row,
  waiting: {},
  now: recordedNow,
  timezone: "Europe/Paris",
  width: 40,
  ...(detail && { detail }),
});

/** Draws the accordion, and lets details already read arrive. */
const open = (props: ThreadAccordionProps, width = props.width) =>
  drawSuspending(<ThreadAccordion {...props} width={width} />, width, 10);

describe("ThreadAccordion", () => {
  describe("under a finished thread", () => {
    it("says what line 1 does not of a time to close past its target, then the labels, its heavy bar running on to the ending", async () => {
      const screen = await open(FinishedOver.args);
      expect(screen.lines.slice(0, 3)).toEqual([
        "┃ open 37d · target 30d",
        "┃ labels kind=feat",
        "",
      ]);
      expect(screen.look("┃")?.fg).toBe(tokens["color.text.error"]);
    });

    it("gives the target alone within it, and the pull request that closed the issue after dimmed words", async () => {
      const screen = await open(FinishedClosedIn.args);
      expect(readText(screen).slice(0, 4)).toEqual([
        "target 30d",
        "closed in example#2",
        "labels none",
        "",
      ]);
      expect(screen.look("closed in")?.fg).toBe(tokens["color.text.muted"]);
      expect(screen.look("example#2")?.fg).toBe(tokens["color.text"]);
      expect(screen.look("│")?.fg).toBe(tokens["color.text.success"]);
    });

    it("draws its lines from the list at once, never loading, the stack's neighbours waiting on the details", async () => {
      const screen = await open(FinishedStackLoading.args);
      expect(screen.lines.slice(0, 5)).toEqual([
        "│┆target 5d",
        "│┆labels none",
        "│┆example stack 3 · 1 of 2 · → main",
        "│┆…",
        "",
      ]);
    });

    it("keeps the list's lines while reading is paused, the stack's neighbours waiting as while they are read", async () => {
      const paused = await open({
        ...FinishedStackLoading.args,
        detail: Promise.resolve({ resumes: new Date("2026-09-28T13:00:00Z") }),
      });
      const loading = await open(FinishedStackLoading.args);
      expect(paused.lines).toEqual(loading.lines);
      expect(readText(paused).at(3)).toBe("…");
      expect(paused.look("…")?.fg).toBe(tokens["color.text.muted"]);
    });

    it("names the stack's neighbour once the details give it", async () => {
      const detail = {
        ...overReviewDetail,
        stack: [
          { position: 1, number: 2, state: "merged" as const },
          { position: 2, number: 3, state: "merged" as const },
        ],
      };
      const screen = await open(
        underFinished(findFinishedRow("example#2"), Promise.resolve(detail)),
      );
      expect(readText(screen).at(3)).toBe("above #3 merged");
    });

    it("asks owed's wait and a thread at rest for their details, and lets a finished thread go without", () => {
      const base = {
        waiting: {},
        now: recordedNow,
        timezone: "UTC",
        width: 40,
      };
      // @ts-expect-error owed's wait waits on its details.
      const owed: ThreadAccordionProps = {
        ...base,
        row: overReview,
        clock: true,
      };
      expect(owed.row).toBe(overReview);
      // @ts-expect-error a finished thread's bar is its verdict, so it takes no clock.
      const finished: ThreadAccordionProps = {
        ...base,
        row: findFinishedRow("example#7"),
        clock: false,
      };
      expect(finished.clock).toBe(false);
    });

    it("draws what the list gives at once when given no details to wait on", async () => {
      const screen = await open(FinishedClosedIn.args);
      expect(readText(screen).slice(0, 3)).toEqual([
        "target 30d",
        "closed in example#2",
        "labels none",
      ]);
    });

    it("has no time line where a label exempts the thread, and leaves the bar's column blank", async () => {
      const exempt = findFinishedRow("example#9");
      const screen = await open(underFinished(exempt));
      expect(screen.lines.slice(0, 2)).toEqual(["  labels dependencies", ""]);
    });

    it("names every owner whole when the row cuts a login", async () => {
      const row = findFinishedRow("example#7");
      const long = {
        text: "alice-with-a-long-login",
        fit: "trimmed",
        group: "team",
      } as const;
      const screen = await open(underFinished({ ...row, owner: long }));
      expect(readText(screen).at(2)).toBe("owner ● alice-with-a-long-login");
    });

    it("keeps its lines above the reason when reading the details fails", async () => {
      const screen = await open(
        underFinished(
          findFinishedRow("example#7"),
          failDetail(new Error("GitHub timed out.")),
        ),
      );
      expect(readText(screen).slice(0, 3)).toEqual([
        "open 37d · target 30d",
        "labels kind=feat",
        "✗ failed: GitHub timed out",
      ]);
    });
  });

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

    it("gives the reason in the error colour on one line under what the snapshot showed, when reading fails", async () => {
      const screen = await open(Failed.args);
      expect(readText(screen).slice(0, 7)).toEqual([
        "asked by ● alice 3d ago",
        "1 push since · …",
        "✗ checks: …",
        "example stack 3 · 2 of 3 · → main",
        "…",
        "✗ failed: GitHub timed out",
        "",
      ]);
      expect(screen.look("✗ failed")?.fg).toBe(tokens["color.text.error"]);
    });

    it("gives the reason alone for a thread the snapshot holds nothing of, cut to one line", async () => {
      const screen = await open({
        ...RestingLoading.args,
        detail: failDetail(
          new Error("GitHub gave no answer within 10 seconds."),
        ),
      });
      expect(readText(screen).slice(0, 2)).toEqual([
        "✗ failed: GitHub gave no answer withi…",
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
    expect(readText(screen).at(5)).toBe("✗ failed: GitHub timed out");
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
