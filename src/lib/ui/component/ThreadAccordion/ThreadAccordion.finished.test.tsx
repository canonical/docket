import { describe, expect, it } from "vitest";
import { failDetail, overReviewDetail } from "../../../../testing/details.js";
import { findFinishedRow } from "../../../../testing/finished.js";
import { recordedNow } from "../../../../testing/recorded.js";
import { overReview } from "../../../../testing/rows.js";
import {
  drawSuspending,
  hex,
  type Screen,
} from "../../../../testing/terminal.js";
import type { FinishedRow } from "../../../finished/index.js";
import { tokens } from "../../../tokens/index.js";
import ThreadAccordion from "./ThreadAccordion.js";
import {
  FinishedClosedIn,
  FinishedOver,
  FinishedStackLoading,
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
      expect(screen.look("┃")?.fg).toBe(hex(tokens["color.text.error"]));
    });

    it("gives the target alone within it, and the pull request that closed the issue after dimmed words", async () => {
      const screen = await open(FinishedClosedIn.args);
      expect(readText(screen).slice(0, 4)).toEqual([
        "target 30d",
        "closed in example#2",
        "labels none",
        "",
      ]);
      expect(screen.look("closed in")?.fg).toBe(
        hex(tokens["color.text.muted"]),
      );
      expect(screen.look("example#2")?.fg).toBe(hex(tokens["color.text"]));
      expect(screen.look("│")?.fg).toBe(hex(tokens["color.text.success"]));
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
      expect(paused.look("…")?.fg).toBe(hex(tokens["color.text.muted"]));
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
        clock: true,
      };
      expect(finished.clock).toBe(true);
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
        kind: "person",
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
});
