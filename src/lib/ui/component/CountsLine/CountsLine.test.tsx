import { describe, expect, it } from "vitest";
import { draw } from "../../../../testing/terminal.js";
import { tokens } from "../../../tokens/index.js";
import CountsLine from "./CountsLine.js";
import { Activity, NothingOwed, Owed } from "./CountsLine.stories.js";

describe("CountsLine", () => {
  it("states owed's counts, and the position against the right edge, in the text colour at 40 columns", async () => {
    const screen = await draw(<CountsLine {...Owed.args} />, 40);
    expect(screen.lines.at(0)).toBe(
      `3 over · 2 soon · 6 on track${" ".repeat(6)}3/4/11`,
    );
    expect(screen.look("3 over")).toMatchObject({
      fg: tokens["color.text"],
      bold: false,
    });
    expect(screen.look("3/4/11")?.fg).toBe(tokens["color.text"]);
  });

  it("states activity's counts whole and the position at the edge at 60 columns", async () => {
    const screen = await draw(<CountsLine {...Activity.args} width={60} />, 60);
    expect(screen.lines.at(0)).toBe(
      `9 threads · 23 events${" ".repeat(36)}1/9`,
    );
  });

  it("states the counts alone when nothing is listed", async () => {
    const screen = await draw(<CountsLine {...NothingOwed.args} />, 40);
    expect(screen.lines.at(0)).toBe("0 over · 0 soon · 0 on track");
  });

  it("cuts the counts with an ellipsis first, keeping the position's cells", async () => {
    const screen = await draw(<CountsLine {...Owed.args} width={20} />, 20);
    expect(screen.lines.at(0)).toBe("3 over · 2 s… 3/4/11");
    const alone = await draw(
      <CountsLine {...NothingOwed.args} width={12} />,
      12,
    );
    expect(alone.lines.at(0)).toBe("0 over · 0 …");
  });
});
