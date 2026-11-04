import { describe, expect, it, vi } from "vitest";
import { draw, hex } from "../../../../testing/terminal.js";
import { tokens } from "../../../tokens/index.js";
import ScrolledList from "./ScrolledList.js";
import { Pinned, Top } from "./ScrolledList.stories.js";

describe("ScrolledList", () => {
  it("draws the whole blocks that fit from the top, the first heading in its place, and counts the rows below, dimmed", async () => {
    const screen = await draw(<ScrolledList {...Top.args} />, 40, 6);
    expect(screen.lines).toEqual([
      `● bob ${"─".repeat(34)}`,
      "│ first of bob's",
      "╵ a thread",
      "│ second of bob's",
      "╵ a thread",
      "  ↓ 2 below",
    ]);
    expect(screen.look("↓ 2 below")?.fg).toBe(hex(tokens["color.text.muted"]));
  });

  it("pins the heading of the first row's group, with the row's place among the group's", async () => {
    const screen = await draw(<ScrolledList {...Pinned.args} />, 40, 6);
    expect(screen.lines).toEqual([
      `● bob · 2 of 3 ${"─".repeat(25)}`,
      "│ second of bob's",
      "╵ a thread",
      "│ third of bob's",
      "╵ a thread",
      "  ↓ 1 below",
    ]);
    expect(screen.look("● bob")?.fg).toBe(hex(tokens["color.text.team"]));
  });

  it("tells how many rows it shows, headings not counted, and the first block it shows", async () => {
    const onShown = vi.fn();
    await draw(<ScrolledList {...Pinned.args} onShown={onShown} />, 40, 6);
    expect(onShown).toHaveBeenLastCalledWith(2, 2);
  });

  it("signs nothing once every row fits", async () => {
    const screen = await draw(
      <ScrolledList {...Top.args} height={10} />,
      40,
      10,
    );
    expect(screen.lines.at(-1)).toBe("╵ a thread");
    expect(screen.lines.join("\n")).not.toContain("below");
  });

  it("creates nodes only for blocks visible in the viewport", async () => {
    const make = Array.from({ length: 10 }, (_, index) =>
      vi.fn(() => <text>{`row ${index}`}</text>),
    );
    const blocks = make.map((node, index) => ({
      kind: "row" as const,
      key: `${index}`,
      lines: 1,
      node,
    }));
    const screen = await draw(
      <ScrolledList
        blocks={blocks}
        from={0}
        to={0}
        height={3}
        width={40}
        onShown={() => {}}
      />,
      40,
      3,
    );
    expect(screen.lines).toEqual(["row 0", "row 1", "  ↓ 8 below"]);
    expect(make[0]).toHaveBeenCalled();
    expect(make[1]).toHaveBeenCalled();
    expect(make[2]).not.toHaveBeenCalled();
  });
});
