import { useState } from "react";
import { describe, expect, it } from "vitest";
import { tokens } from "../lib/tokens/index.js";
import {
  overReviewDetail,
  pendingDetail,
  sharedCloseDetail,
} from "../testing/details.js";
import { alice, exampleSync } from "../testing/facts.js";
import { recordedActivity, recordedNow } from "../testing/recorded.js";
import { overReview } from "../testing/rows.js";
import { draw, drawSuspending } from "../testing/terminal.js";
import ActivityList, { type ActivityListProps } from "./ActivityList.js";

/** A list whose details are still being read, with no wait running. */
const reading: Omit<ActivityListProps, "list" | "selected" | "width"> = {
  readDetail: () => pendingDetail,
  measureWaits: () => [],
  now: recordedNow,
  timezone: "Europe/Paris",
  height: 20,
  onShownRows: () => {},
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
      `  docs#4 issue ● alice${" ".repeat(15)}16h`,
      "  Where do tokens live?",
      `${" ".repeat(26)}● alice, ● bob`,
      "    example-sync labelled kind=docs  16h",
    ]);
    expect(screen.lines.slice(5, 8)).toEqual([
      "PULL REQUESTS",
      ` ┆example#12 PR ○ dave${" ".repeat(15)}25m`,
      ` ┆Fix the parser${" ".repeat(17)}● alice`,
    ]);
    expect(screen.lines.slice(13, 17)).toEqual([
      ` ┆  ✗ checks failed (lint)${" ".repeat(11)}25m`,
      ` ┆  alice requested review${" ".repeat(12)}3h`,
      ` ┆  dave commented${" ".repeat(20)}3d`,
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
      ` ┆example#12 PR ○ dave${" ".repeat(35)}25m`,
      ` ┆Fix the parser${" ".repeat(37)}● alice`,
      ` ┆  ✗ checks failed (lint)${" ".repeat(31)}25m`,
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
      `${" ".repeat(26)}● alice, ● bob`,
      "  loading…",
      "",
      "",
      "",
      "",
      "    example-sync labelled kind=docs  16h",
    ]);
  });

  it("draws an editor in the accordion's place under the selected thread, above its events, which gives up its background", async () => {
    const editor = {
      node: (
        <>
          <text>{"  filter:"}</text>
          <text>{"  ☑ alice"}</text>
        </>
      ),
      lines: 2,
    };
    const screen = await draw(
      <ActivityList
        {...reading}
        list={recordedActivity("kind")}
        selected={0}
        width={40}
        editor={editor}
      />,
      40,
      20,
    );
    expect(screen.lines.slice(1, 7)).toEqual([
      `  docs#4 issue ● alice${" ".repeat(15)}16h`,
      "  Where do tokens live?",
      `${" ".repeat(26)}● alice, ● bob`,
      "  filter:",
      "  ☑ alice",
      "    example-sync labelled kind=docs  16h",
    ]);
    expect(screen.look("docs#4")?.bg).not.toBe(
      tokens["color.background.selected"],
    );
  });

  it("shows the running wait of the selected thread, its current state", async () => {
    const screen = await drawSuspending(
      <ActivityList
        {...reading}
        list={recordedActivity("kind")}
        selected={1}
        readDetail={async () => overReviewDetail}
        measureWaits={() => [overReview]}
        width={40}
      />,
      40,
      20,
    );
    expect(screen.lines.slice(7, 10)).toEqual([
      ` ┆Fix the parser${" ".repeat(17)}● alice`,
      " ┆asked by alice 3d ago",
      " ┆1 push since · 2 files · +65 −12",
    ]);
  });

  it("shows a closed thread no wait runs on with its age, owner and labels", async () => {
    // A closed thread's facts are not held, so its row names no owner.
    const list = recordedActivity("kind");
    const closed = {
      ...list,
      groups: list.groups.map((group) => ({
        ...group,
        rows: group.rows.map(({ owner: _, owners: __, ...row }) => row),
      })),
    };
    const screen = await drawSuspending(
      <ActivityList
        {...reading}
        list={closed}
        selected={0}
        readDetail={async () => ({
          ...sharedCloseDetail,
          labels: ["kind: docs"],
          assignees: [alice, exampleSync],
        })}
        width={40}
      />,
      40,
      20,
    );
    expect(screen.lines.slice(1, 6)).toEqual([
      `  docs#4 issue ● alice${" ".repeat(15)}16h`,
      "  Where do tokens live?",
      "  age 6d · owner alice",
      "  last activity 3h ago · bob",
      "  labels kind=docs",
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
      ` ┆example#12 PR ○ dave${" ".repeat(15)}25m`,
      ` ┆Fix the parser${" ".repeat(17)}● alice`,
    ]);
  });

  it("tells how many threads it shows, headings not counted", async () => {
    const shown: number[] = [];
    const drawShown = (height: number) =>
      drawSuspending(
        <ActivityList
          {...reading}
          readDetail={async () => overReviewDetail}
          list={recordedActivity("kind")}
          selected={1}
          width={40}
          height={height}
          onShownRows={(rows) => shown.push(rows)}
        />,
        40,
        height,
      );
    await drawShown(12);
    expect(shown.at(-1)).toBe(1);
    await drawShown(20);
    expect(shown.at(-1)).toBe(2);
  });

  it("scrolls back up to the threads above once the region grows tall enough", async () => {
    let grow = () => {};
    const Growing = () => {
      const [height, setHeight] = useState(12);
      grow = () => setHeight(20);
      return (
        <ActivityList
          {...reading}
          list={recordedActivity("kind")}
          selected={1}
          width={40}
          height={height}
        />
      );
    };
    const screen = await draw(<Growing />, 40, 20);
    expect(screen.lines.at(0)).toBe("PULL REQUESTS");
    const tall = await screen.redraw(() => grow());
    expect(tall.lines.slice(0, 2)).toEqual([
      "ISSUES",
      `  docs#4 issue ● alice${" ".repeat(15)}16h`,
    ]);
  });
});
