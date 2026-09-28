import { describe, expect, it } from "vitest";
import { draw } from "../../../../testing/terminal.js";
import { tokens } from "../../../tokens/index.js";
import CountsLine from "./CountsLine.js";
import { Activity, Owed } from "./CountsLine.stories.js";

describe("CountsLine", () => {
  it("states owed's counts in the text colour at 40 columns", async () => {
    const screen = await draw(<CountsLine {...Owed.args} />, 40);
    expect(screen.lines.at(0)).toBe("3 over · 2 soon · 6 on track");
    expect(screen.look("3 over")).toMatchObject({
      fg: tokens["color.text"],
      bold: false,
    });
  });

  it("states activity's counts whole at 60 columns", async () => {
    const screen = await draw(<CountsLine {...Activity.args} width={60} />, 60);
    expect(screen.lines.at(0)).toBe("9 threads · 23 events");
  });

  it("cuts a summary wider than the pane with an ellipsis", async () => {
    const screen = await draw(<CountsLine {...Owed.args} width={12} />, 12);
    expect(screen.lines.at(0)).toBe("3 over · 2 …");
  });
});
