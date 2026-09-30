import { describe, expect, it, vi } from "vitest";
import { draw } from "../../../../testing/terminal.js";
import { tokens } from "../../../tokens/index.js";
import ScrolledList from "./ScrolledList.js";
import { Pinned, Top } from "./ScrolledList.stories.js";

describe("ScrolledList", () => {
  it("draws the whole blocks that fit from the top, the first heading in its place", async () => {
    const screen = await draw(<ScrolledList {...Top.args} />, 40, 6);
    expect(screen.lines).toEqual([
      `● bob ${"─".repeat(34)}`,
      "│ first of bob's",
      "╵ a thread",
      "│ second of bob's",
      "╵ a thread",
      "",
    ]);
  });

  it("pins the heading of the first row's group, with the row's place among the group's", async () => {
    const screen = await draw(<ScrolledList {...Pinned.args} />, 40, 6);
    expect(screen.lines).toEqual([
      `● bob · 2 of 3 ${"─".repeat(25)}`,
      "│ second of bob's",
      "╵ a thread",
      "│ third of bob's",
      "╵ a thread",
      `unassigned ${"─".repeat(29)}`,
    ]);
    expect(screen.look("● bob")?.fg).toBe(tokens["color.text.team"]);
  });

  it("tells how many rows it shows, headings not counted, and the first block it shows", async () => {
    const onShown = vi.fn();
    await draw(<ScrolledList {...Pinned.args} onShown={onShown} />, 40, 6);
    expect(onShown).toHaveBeenLastCalledWith(2, 2);
  });
});
