import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import type { OwedGrouping } from "../lib/owed/index.js";
import { tokens } from "../lib/tokens/index.js";
import {
  parserFixDetail,
  recordedNow,
  recordedOwed,
} from "../testing/recorded.js";
import { drawSuspending } from "../testing/terminal.js";
import OwedList from "./OwedList.js";

/** Draws owed's recorded list in `grouping`, with the row at `selected` selected. */
function drawList(
  grouping: OwedGrouping,
  selected: number,
  width: number,
  height: number,
  editor?: { readonly node: ReactNode; readonly lines: number },
) {
  return drawSuspending(
    <OwedList
      list={recordedOwed(grouping)}
      selected={selected}
      readDetail={async () => parserFixDetail}
      now={recordedNow}
      timezone="Europe/Paris"
      width={width}
      height={height}
      {...(editor && { editor })}
    />,
    width,
    height,
  );
}

describe("OwedList", () => {
  it("heads each group, then its rows, the details open under the selected row, and only rows that fit whole, at 40 columns", async () => {
    const screen = await drawList("owner", 0, 40, 16);
    expect(screen.lines).toEqual([
      "alice",
      `▌┃example#12 reply${" ".repeat(15)}4d over`,
      " ┃Fix the parser · alice ✗ checks",
      "  dave · 3d ago",
      "  Rebased on main. Could someone look",
      "  again?",
      "  example stack 3 · 2 of 3 · → main",
      "  below #11 merged, above #13 open",
      `▌┃example#12 close${" ".repeat(15)}2h over`,
      " ┃Fix the parser · alice ✗ checks",
      `▌ docs#4 close${" ".repeat(18)}10d left`,
      "  Where do tokens live?",
      "  alice, bob",
      "bob",
      "",
      "",
    ]);
    expect(screen.look("alice")).toMatchObject({ bold: true });
    expect(screen.look("example#12 reply")?.bg).toBe(
      tokens["color.background.selected"],
    );
    expect(screen.look("example#12 close")?.bg).not.toBe(
      tokens["color.background.selected"],
    );
  });

  it("heads each stack with its full size, its rows bottom first, at 60 columns", async () => {
    const screen = await drawList("stack", 2, 60, 14);
    expect(screen.lines.slice(0, 5)).toEqual([
      "example stack 3 · 3 PRs → main",
      `▌┃example#12 reply${" ".repeat(35)}4d over`,
      " ┃Fix the parser · alice ✗ checks",
      `▌┃example#12 close${" ".repeat(35)}2h over`,
      " ┃Fix the parser · alice ✗ checks",
    ]);
    expect(screen.lines.slice(5, 9)).toEqual([
      `▌┃example#12 review${" ".repeat(34)}1d left`,
      " ┃Fix the parser · bob ✗ checks",
      "  asked by alice 3h ago",
      "  0 pushes since · 2 files · +65 −12",
    ]);
    expect(screen.lines.at(12)).toBe("NOT IN A STACK");
  });

  it("scrolls so the selected row and its details are whole in view", async () => {
    const screen = await drawList("owner", 4, 40, 8);
    expect(screen.lines.slice(0, 2)).toEqual([
      `▌┃example#12 review${" ".repeat(14)}1d left`,
      " ┃Fix the parser · bob ✗ checks",
    ]);
    expect(screen.lines.at(7)).toBe("unassigned");
  });

  it("draws an editor in the details' place under the selected row, which gives up its background, and keeps it in view", async () => {
    const editor = {
      node: (
        <>
          <text>{"  filter:"}</text>
          <text>{"  ☑ alice"}</text>
          <text>{"  ☐ bob"}</text>
        </>
      ),
      lines: 3,
    };
    const screen = await drawList("owner", 4, 40, 6, editor);
    expect(screen.lines).toEqual([
      `▌┃example#12 review${" ".repeat(14)}1d left`,
      " ┃Fix the parser · bob ✗ checks",
      "  filter:",
      "  ☑ alice",
      "  ☐ bob",
      "unassigned",
    ]);
    expect(screen.look("example#12 review")?.bg).not.toBe(
      tokens["color.background.selected"],
    );
  });
});
