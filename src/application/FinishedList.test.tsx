import { describe, expect, it } from "vitest";
import { tokens } from "../lib/tokens/index.js";
import { overReviewDetail, pendingDetail } from "../testing/details.js";
import { finishedList, finishedNow } from "../testing/finished.js";
import { draw, drawSuspending } from "../testing/terminal.js";
import FinishedList, { type FinishedListProps } from "./FinishedList.js";

const props: Omit<FinishedListProps, "list" | "selected" | "width"> = {
  readDetail: () => pendingDetail,
  now: finishedNow,
  timezone: "Europe/Paris",
  height: 20,
  onShownRows: () => {},
};

describe("FinishedList", () => {
  it("heads each kind of thread, each thread's ending under it, the selected one's accordion between, at 40 columns", async () => {
    const screen = await draw(
      <FinishedList
        {...props}
        list={finishedList("kind")}
        selected={0}
        width={40}
      />,
      40,
      20,
    );
    expect(screen.lines.slice(0, 7)).toEqual([
      `ISSUES ${"─".repeat(33)}`,
      "│ docs#4 issue ◐ carol           open 4d",
      "│ Where do tokens live?",
      `│${" ".repeat(25)}◉ alice, ● bob`,
      "│ target 30d",
      "│ closed in example#2",
      "│ labels none",
    ]);
    expect(screen.lines.at(7)).toBe("╵   ● bob closed as completed         3h");
    expect(screen.lines.at(8)).toBe("┃ example#7 issue ○ dave         7d over");
  });

  it("draws every ending on no background, the selection's covering the row and its accordion alone", async () => {
    const screen = await draw(
      <FinishedList
        {...props}
        list={finishedList("kind")}
        selected={0}
        width={40}
      />,
      40,
      20,
    );
    expect(screen.look("labels none")?.bg).toBe(
      tokens["color.background.selected"],
    );
    expect(screen.look(" closed as completed")?.bg).not.toBe(
      tokens["color.background.selected"],
    );
  });

  it("lists the threads without headings when not grouped, the selection on the place given, at 60 columns", async () => {
    const screen = await drawSuspending(
      <FinishedList
        {...props}
        readDetail={() => Promise.resolve(overReviewDetail)}
        list={finishedList("none")}
        selected={1}
        width={60}
      />,
      60,
      20,
    );
    expect(screen.lines.at(0)).toMatch(/^│ docs#4 issue/);
    expect(screen.lines.slice(4, 7)).toEqual([
      `│┆example#2 PR ◉ alice${" ".repeat(31)}open 2d`,
      `│┆Example change${" ".repeat(37)}◉ alice`,
      "│┆target 5d",
    ]);
  });

  it("tells after each draw how many threads it shows, headings not counted", async () => {
    let shown = 0;
    await drawSuspending(
      <FinishedList
        {...props}
        readDetail={async () => overReviewDetail}
        list={finishedList("kind")}
        selected={0}
        width={40}
        onShownRows={(rows) => {
          shown = rows;
        }}
      />,
      40,
      20,
    );
    expect(shown).toBe(4);
  });
});
