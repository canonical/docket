import { describe, expect, it } from "vitest";
import { tokens } from "../lib/tokens/index.js";
import {
  overReviewDetail,
  pendingDetail,
  sharedCloseDetail,
} from "../testing/details.js";
import { recordedActivity, recordedNow } from "../testing/recorded.js";
import { overReview } from "../testing/rows.js";
import { draw, drawSuspending } from "../testing/terminal.js";
import ActivityList, { type ActivityListProps } from "./ActivityList.js";

/** A list whose details are still being read, with no wait running. */
const reading: Omit<ActivityListProps, "list" | "selected" | "width"> = {
  readDetail: () => pendingDetail,
  waits: [],
  threads: [],
  now: recordedNow,
  timezone: "Europe/Paris",
  height: 20,
};

describe("ActivityList", () => {
  it("heads each kind of thread, with every thread's events nested under it, at 40 columns", async () => {
    const screen = await draw(
      <ActivityList
        {...reading}
        list={recordedActivity("kind")}
        selected={1}
        width={40}
      />,
      40,
      20,
    );
    expect(screen.lines.slice(0, 5)).toEqual([
      "ISSUES",
      "  docs#4 issue                       16h",
      "  Where do tokens live?",
      "  alice, bob",
      "    example-sync labelled kind=docs  16h",
    ]);
    expect(screen.lines.slice(5, 8)).toEqual([
      "PULL REQUESTS",
      " ┃example#12 PR                      25m",
      " ┃Fix the parser · alice",
    ]);
    expect(screen.lines.slice(13, 17)).toEqual([
      "    ✗ checks failed (lint)           25m",
      "    alice requested review            3h",
      "    dave commented                    3d",
      "",
    ]);
    expect(screen.look("PULL REQUESTS")?.bold).toBe(true);
  });

  it("lists the threads without headings when not grouped, at 60 columns", async () => {
    const screen = await draw(
      <ActivityList
        {...reading}
        list={recordedActivity("none")}
        selected={1}
        width={60}
      />,
      60,
    );
    expect(screen.lines.slice(0, 3)).toEqual([
      ` ┃example#12 PR${" ".repeat(42)}25m`,
      " ┃Fix the parser · alice",
      `    ✗ checks failed (lint)${" ".repeat(31)}25m`,
    ]);
    expect(screen.look("✗ checks failed")?.fg).toBe(tokens["color.text.error"]);
  });

  it("gives the selected thread the selection background, and never a heading", async () => {
    const screen = await draw(
      <ActivityList
        {...reading}
        list={recordedActivity("kind")}
        selected={1}
        width={40}
      />,
      40,
      20,
    );
    const selected = tokens["color.background.selected"];
    expect(screen.look("Fix the parser")?.bg).toBe(selected);
    expect(screen.look("docs#4")?.bg).not.toBe(selected);
    expect(screen.look("PULL REQUESTS")?.bg).not.toBe(selected);
  });

  it("opens the five-line accordion under the selected thread, above its events", async () => {
    const screen = await draw(
      <ActivityList
        {...reading}
        list={recordedActivity("kind")}
        selected={0}
        width={40}
      />,
      40,
      20,
    );
    expect(screen.lines.slice(3, 10)).toEqual([
      "  alice, bob",
      "  loading…",
      "",
      "",
      "",
      "",
      "    example-sync labelled kind=docs  16h",
    ]);
  });

  it("shows the running wait of the selected thread, its current state", async () => {
    const screen = await drawSuspending(
      <ActivityList
        {...reading}
        list={recordedActivity("kind")}
        selected={1}
        readDetail={async () => overReviewDetail}
        waits={[overReview]}
        width={40}
      />,
      40,
      20,
    );
    expect(screen.lines.slice(7, 10)).toEqual([
      " ┃Fix the parser · alice",
      "  asked by alice 3d ago",
      "  1 push since · 2 files · +65 −12",
    ]);
  });

  it("shows a thread no wait runs on with its last activity", async () => {
    const screen = await drawSuspending(
      <ActivityList
        {...reading}
        list={recordedActivity("kind")}
        selected={0}
        readDetail={async () => sharedCloseDetail}
        width={40}
      />,
      40,
      20,
    );
    expect(screen.lines.slice(3, 6)).toEqual([
      "  alice, bob",
      "  last activity 3h ago · bob",
      "",
    ]);
  });

  it("scrolls to keep the selected thread whole, with its heading when it leads its group", async () => {
    const screen = await draw(
      <ActivityList
        {...reading}
        list={recordedActivity("kind")}
        selected={1}
        width={40}
        height={12}
      />,
      40,
    );
    expect(screen.lines.slice(0, 3)).toEqual([
      "PULL REQUESTS",
      " ┃example#12 PR                      25m",
      " ┃Fix the parser · alice",
    ]);
  });
});
