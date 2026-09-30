import { describe, expect, it } from "vitest";
import { draw } from "../../../../testing/terminal.js";
import { tokens } from "../../../tokens/index.js";
import ProgressLine from "./ProgressLine.js";
import { Halfway } from "./ProgressLine.stories.js";

describe("ProgressLine", () => {
  it("fills the bar in proportion, the rest dimmed, then states the pages, at 40 columns", async () => {
    const screen = await draw(<ProgressLine {...Halfway.args} />, 40);
    expect(screen.lines.at(0)).toBe(
      `${"█".repeat(14)}${"░".repeat(12)} 50/89 pages`,
    );
    expect(screen.look("█")?.fg).toBe(tokens["color.text"]);
    expect(screen.look("░")?.fg).toBe(tokens["color.text.muted"]);
    expect(screen.look("50/89")?.fg).toBe(tokens["color.text"]);
  });

  it("keeps the bar's length at 60 columns", async () => {
    const screen = await draw(
      <ProgressLine {...Halfway.args} width={58} />,
      60,
    );
    expect(screen.lines.at(0)).toBe(
      `${"█".repeat(16)}${"░".repeat(13)} 50/89 pages`,
    );
  });

  it("shortens the bar so the pages still fit a narrow line", async () => {
    const screen = await draw(
      <ProgressLine fetched={3} total={3} width={16} />,
      16,
    );
    expect(screen.lines.at(0)).toBe("██████ 3/3 pages");
  });
});
