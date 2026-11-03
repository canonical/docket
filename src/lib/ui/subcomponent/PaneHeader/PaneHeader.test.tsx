import { describe, expect, it } from "vitest";
import { draw, hex } from "../../../../testing/terminal.js";
import { tokens } from "../../../tokens/index.js";
import PaneHeader from "./PaneHeader.js";
import { Activity, Help, Owed, OwedByOwner } from "./PaneHeader.stories.js";

describe("PaneHeader", () => {
  it("names the mode, then one list and the sort against the right edge, the sort dimmed, nothing bold", async () => {
    const screen = await draw(<PaneHeader {...Owed.args} />, 40);
    expect(screen.lines.at(0)).toBe(
      `owed${" ".repeat(12)}one list · overdue first`,
    );
    expect(screen.look("owed")).toMatchObject({
      fg: hex(tokens["color.text"]),
      bold: false,
    });
    expect(screen.look("one list")?.fg).toBe(hex(tokens["color.text"]));
    expect(screen.look("overdue first")).toMatchObject({
      fg: hex(tokens["color.text.muted"]),
      bold: false,
    });
  });

  it("puts the grouping and the sort against the right edge at 40 columns", async () => {
    const screen = await draw(<PaneHeader {...OwedByOwner.args} />, 40);
    expect(screen.lines.at(0)).toBe(
      `owed${" ".repeat(12)}by owner · overdue first`,
    );
  });

  it("keeps the window, the grouping and the sort against the right edge at 60 columns", async () => {
    const screen = await draw(<PaneHeader {...Activity.args} width={60} />, 60);
    expect(screen.lines.at(0)).toBe(
      `activity${" ".repeat(24)}24h · by kind · newest first`,
    );
  });

  it("names help alone, not bold", async () => {
    const screen = await draw(<PaneHeader {...Help.args} />, 40);
    expect(screen.lines.at(0)).toBe("help");
    expect(screen.look("help")?.bold).toBe(false);
  });

  it("gives up the sort first when the line is too short, then leaves out the address's parts whole, the window first, and never the mode", async () => {
    const sorted = await draw(<PaneHeader {...Activity.args} width={30} />, 30);
    expect(sorted.lines.at(0)).toBe(`activity${" ".repeat(9)}24h · by kind`);
    const header = (width: number) =>
      draw(
        <PaneHeader
          title={{ text: "activity", kind: "words" }}
          address={{ text: "1w · by repo", kind: "words" }}
          width={width}
        />,
        width,
      );
    expect((await header(16)).lines.at(0)).toBe("activity by repo");
    expect((await header(12)).lines.at(0)).toBe("activity");
    expect((await header(6)).lines.at(0)).toBe("activ…");
  });
});
