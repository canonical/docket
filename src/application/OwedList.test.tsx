import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { describeNoTeam, type OwedGrouping } from "../lib/owed/index.js";
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
  onShownRows: (rows: number) => void = () => {},
  notice?: ReturnType<typeof describeNoTeam>,
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
      onShownRows={onShownRows}
      {...(editor && { editor })}
      {...(notice && { notice })}
    />,
    width,
    height,
  );
}

/** The notice while the one watched repository lists no team. */
const noTeam = describeNoTeam([{ name: "example", people: new Map() }]);

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

  it("tells how many rows it shows, headings not counted", async () => {
    const shown: number[] = [];
    await drawList("owner", 0, 40, 16, undefined, (rows) => shown.push(rows));
    expect(shown.at(-1)).toBe(3);
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

  it("keeps the notice above the rows, wrapped two cells in, and shows the rows that fit below it, at 40 columns", async () => {
    const shown = vi.fn();
    const screen = await drawList("none", 0, 40, 12, undefined, shown, noTeam);
    expect(screen.lines.slice(0, 6)).toEqual([
      "  ✗ no team in docket.yaml, so every",
      "  comment starts a reply wait",
      "  Recovery: list the team under people:",
      "  in the personal file or in the",
      "  repository's .github/docket.yaml",
      `▌┃example#12 reply${" ".repeat(15)}4d over`,
    ]);
    expect(screen.look("✗ no team")?.fg).toBe(tokens["color.text.error"]);
    expect(shown).toHaveBeenLastCalledWith(1);
  });

  it("cuts the notice, never squeezing it, in a region shorter than it", async () => {
    const screen = await drawList(
      "none",
      0,
      40,
      3,
      undefined,
      () => {},
      noTeam,
    );
    expect(screen.lines).toEqual([
      "  ✗ no team in docket.yaml, so every",
      "  comment starts a reply wait",
      "  Recovery: list the team under people:",
    ]);
  });

  it("takes fewer lines for the notice at 60 columns", async () => {
    const screen = await drawList(
      "none",
      0,
      60,
      12,
      undefined,
      () => {},
      noTeam,
    );
    expect(screen.lines.slice(0, 4)).toEqual([
      "  ✗ no team in docket.yaml, so every comment starts a reply",
      "  wait",
      "  Recovery: list the team under people: in the personal file",
      "  or in the repository's .github/docket.yaml",
    ]);
    expect(screen.lines.at(4)).toMatch(/^▌┃example#12 reply/);
  });
});
