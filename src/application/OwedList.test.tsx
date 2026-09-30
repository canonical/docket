import { createTestRenderer } from "@opentui/core/testing";
import { createRoot } from "@opentui/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { describeNoTeam, type OwedGrouping } from "../lib/owed/index.js";
import type { ThreadDetail } from "../lib/provider/index.js";
import { tokens } from "../lib/tokens/index.js";
import { failDetail } from "../testing/details.js";
import {
  parserFixDetail,
  recordedNow,
  recordedOwed,
} from "../testing/recorded.js";
import { drawSuspending } from "../testing/terminal.js";
import { waitUntil } from "../testing/wait.js";
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
const noTeam = describeNoTeam([new Map()]);

describe("OwedList", () => {
  it("heads each group, then its rows, the details open under the selected row, and only rows that fit whole, at 40 columns", async () => {
    const screen = await drawList("owner", 0, 40, 16);
    expect(screen.lines).toEqual([
      "● alice ────────────────────────────────",
      `┃┆example#12 PR reply ○ dave${" ".repeat(5)}4d over`,
      `┃┆Fix the parser${" ".repeat(7)}✗ checks  ● alice`,
      "┃┆○ dave · 3d ago",
      "┃┆Rebased on main. Could someone look",
      "┃┆again?",
      "┃┆waiting since Mon 10:00 · target 24h",
      "┃┆example stack 3 · 2 of 3 · → main",
      "╹┆below #11 merged, above #13 open",
      `┃┆example#12 PR close ○ dave${" ".repeat(5)}2h over`,
      `╹┆Fix the parser${" ".repeat(7)}✗ checks  ● alice`,
      `│ docs#4 issue close ● alice${" ".repeat(4)}10d left`,
      "│ Where do tokens live?",
      `╵${" ".repeat(25)}● alice, ● bob`,
      "● bob ──────────────────────────────────",
      "  ↓ 4 below",
    ]);
    expect(screen.look("● alice")).toMatchObject({
      fg: tokens["color.text.team"],
      bold: false,
    });
    expect(screen.look("example#12 PR reply")?.bg).toBe(
      tokens["color.background.selected"],
    );
    expect(screen.look("example#12 PR close")?.bg).not.toBe(
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
      "example stack 3 · 3 PRs → main ─────────────────────────────",
      `┃┆example#12 PR reply ○ dave${" ".repeat(25)}4d over`,
      `╹┆Fix the parser${" ".repeat(27)}✗ checks  ● alice`,
      `┃┆example#12 PR close ○ dave${" ".repeat(25)}2h over`,
      `╹┆Fix the parser${" ".repeat(27)}✗ checks  ● alice`,
    ]);
    expect(screen.lines.slice(5, 9)).toEqual([
      `│┆example#12 PR review ○ dave${" ".repeat(24)}1d left`,
      `│┆Fix the parser${" ".repeat(29)}✗ checks  ● bob`,
      "│┆asked by ● alice 3h ago",
      "│┆0 pushes since · 2 files · +65 −12",
    ]);
    expect(screen.lines.at(12)).toBe(
      "NOT IN A STACK ─────────────────────────────────────────────",
    );
  });

  it("scrolls so the selected row and its details are in view, cut above the sign of the rows below", async () => {
    const screen = await drawList("owner", 4, 40, 8);
    expect(screen.lines.slice(0, 3)).toEqual([
      `● bob · 2 of 2 ${"─".repeat(25)}`,
      `│┆example#12 PR review ○ dave${" ".repeat(4)}1d left`,
      `│┆Fix the parser${" ".repeat(9)}✗ checks  ● bob`,
    ]);
    expect(screen.lines.at(7)).toBe("  ↓ 2 below");
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
      `● bob · 2 of 2 ${"─".repeat(25)}`,
      `│┆example#12 PR review ○ dave${" ".repeat(4)}1d left`,
      `╵┆Fix the parser${" ".repeat(9)}✗ checks  ● bob`,
      "  filter:",
      "  ☑ alice",
      "  ↓ 2 below",
    ]);
    expect(screen.look("example#12 PR review")?.bg).not.toBe(
      tokens["color.background.selected"],
    );
  });

  it("keeps the notice above the rows, wrapped two cells in, and shows the rows that fit below it, at 40 columns", async () => {
    const shown = vi.fn();
    const screen = await drawList("none", 0, 40, 12, undefined, shown, noTeam);
    expect(screen.lines.slice(0, 7)).toEqual([
      "  ✗ no team in docket.yaml, so every",
      "  comment starts a reply wait",
      "  Recovery: list the team under people:",
      "  in the personal file or the",
      "  repository's .github/docket.yaml, then",
      "  run docket config",
      `┃┆example#12 PR reply ○ dave${" ".repeat(5)}4d over`,
    ]);
    expect(screen.look("✗ no team")?.fg).toBe(tokens["color.text.error"]);
    expect(shown).toHaveBeenLastCalledWith(1, 0);
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
    expect(screen.lines.slice(0, 5)).toEqual([
      "  ✗ no team in docket.yaml, so every comment starts a reply",
      "  wait",
      "  Recovery: list the team under people: in the personal file",
      "  or the repository's .github/docket.yaml, then run",
      "  docket config",
    ]);
    expect(screen.lines.at(5)).toMatch(/^┃┆example#12 PR reply/);
  });

  it("scrolls to keep the selected item whole once a failed read adds its line under the snapshot's", async () => {
    const failed = failDetail(new Error("GitHub timed out"));
    const shown: number[] = [];
    const screen = await drawSuspending(
      <OwedList
        list={recordedOwed("none")}
        selected={4}
        readDetail={() => failed}
        now={recordedNow}
        timezone="Europe/Paris"
        width={40}
        height={12}
        onShownRows={(rows) => shown.push(rows)}
      />,
      40,
      12,
    );
    expect(screen.lines).toContain("╵┆✗ failed: GitHub timed out");
    expect(screen.lines.at(0)).toBe("│ docs#4 issue close ● alice    10d left");
    expect(shown.at(-1)).toBe(2);
  });

  it("paints no frame with the selected item cut while a failed read makes room for its line", async () => {
    // React outside `act`, so the renderer paints on its own schedule, as in the terminal.
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: false });
    const setup = await createTestRenderer({ width: 40, height: 12 });
    const decoder = new TextDecoder();
    const painted: string[] = [];
    setup.renderer.addPostProcessFn((buffer) => {
      painted.push(decoder.decode(buffer.getRealCharBytes(true)));
    });
    const read = Promise.withResolvers<ThreadDetail>();
    read.promise.catch(() => {});
    const root = createRoot(setup.renderer);
    root.render(
      <OwedList
        list={recordedOwed("none")}
        selected={4}
        readDetail={() => read.promise}
        now={recordedNow}
        timezone="Europe/Paris"
        width={40}
        height={12}
        onShownRows={() => {}}
      />,
    );
    await waitUntil(() => expect(painted.at(-1)).toContain("example#12"));
    read.reject(new Error("GitHub timed out"));
    await waitUntil(() =>
      expect(painted.at(-1)).toContain("╵┆✗ failed: GitHub timed out"),
    );
    root.unmount();
    setup.renderer.destroy();
    for (const frame of painted) expect(frame).toMatch(/^╵┆/m);
  });
});
