import { describe, expect, it } from "vitest";
import { draw, hex } from "../../../../testing/terminal.js";
import { tokens } from "../../../tokens/index.js";
import Margin from "./Margin.js";
import {
  NoClock,
  OnTrackThreeLines,
  OverInStack,
  SoonOpen,
  WithinInStack,
} from "./Margin.stories.js";

describe("Margin", () => {
  it("draws a heavy bar in the error colour over the target, ending on the last line, the stack mark dimmed on both", async () => {
    const screen = await draw(<Margin {...OverInStack.args} />, 40);
    expect(screen.lines.slice(0, 3)).toEqual(["┃┆", "╹┆", ""]);
    expect(screen.look("┃")?.fg).toBe(hex(tokens["color.text.error"]));
    expect(screen.look("╹")?.fg).toBe(hex(tokens["color.text.error"]));
    expect(screen.look("┆")?.fg).toBe(hex(tokens["color.text.muted"]));
  });

  it("draws a heavy bar in the warning colour when due soon, unbroken while the item goes on", async () => {
    const screen = await draw(<Margin {...SoonOpen.args} />, 60);
    expect(screen.lines.slice(0, 3)).toEqual(["┃", "┃", ""]);
    expect(screen.look("┃")?.fg).toBe(hex(tokens["color.text.warning"]));
  });

  it("draws a light bar in the border colour on track, down every line", async () => {
    const screen = await draw(<Margin {...OnTrackThreeLines.args} />, 40);
    expect(screen.lines.slice(0, 4)).toEqual(["│┆", "│┆", "╵┆", ""]);
    expect(screen.look("│")?.fg).toBe(hex(tokens["color.border"]));
  });

  it("draws a light bar in the success colour for a finished thread that ended within its target", async () => {
    const screen = await draw(<Margin {...WithinInStack.args} />, 40);
    expect(screen.lines.slice(0, 4)).toEqual(["│┆", "│┆", "╵┆", ""]);
    expect(screen.look("│")?.fg).toBe(hex(tokens["color.text.success"]));
    expect(screen.look("╵")?.fg).toBe(hex(tokens["color.text.success"]));
  });

  it("leaves the bar's column blank when no clock runs, keeping the stack mark", async () => {
    const screen = await draw(<Margin {...NoClock.args} />, 40);
    expect(screen.lines.slice(0, 3)).toEqual([" ┆", " ┆", ""]);
  });
});
