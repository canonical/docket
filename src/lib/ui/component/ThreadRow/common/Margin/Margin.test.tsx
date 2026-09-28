import { describe, expect, it } from "vitest";
import { draw } from "../../../../../../testing/terminal.js";
import { tokens } from "../../../../../tokens/index.js";
import Margin from "./Margin.js";
import { OnTrackThreeLines, OverInStack, Soon } from "./Margin.stories.js";

describe("Margin", () => {
  it("marks a wait over its target in the error colour, the stack rule dimmed on both lines", async () => {
    const screen = await draw(<Margin {...OverInStack.args} />, 40);
    expect(screen.lines.slice(0, 3)).toEqual(["▌┃", " ┃", ""]);
    expect(screen.look("▌")?.fg).toBe(tokens["color.text.error"]);
    expect(screen.look("┃")?.fg).toBe(tokens["color.text.muted"]);
  });

  it("marks a wait due soon in the warning colour, with no rule outside a stack", async () => {
    const screen = await draw(<Margin {...Soon.args} />, 60);
    expect(screen.lines.slice(0, 2)).toEqual(["▌", ""]);
    expect(screen.look("▌")?.fg).toBe(tokens["color.text.warning"]);
  });

  it("marks a wait on track in the border colour, and spans every line of the row", async () => {
    const screen = await draw(<Margin {...OnTrackThreeLines.args} />, 40);
    expect(screen.lines.slice(0, 4)).toEqual(["▌┃", " ┃", " ┃", ""]);
    expect(screen.look("▌")?.fg).toBe(tokens["color.border"]);
  });
});
