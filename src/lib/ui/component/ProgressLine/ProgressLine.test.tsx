import { describe, expect, it } from "vitest";
import { draw } from "../../../../testing/terminal.js";
import { tokens } from "../../../tokens/index.js";
import ProgressLine from "./ProgressLine.js";
import { Halfway, Starting } from "./ProgressLine.stories.js";

describe("ProgressLine", () => {
  it("fills the bar in proportion, then states the pages, at 40 columns", async () => {
    const screen = await draw(<ProgressLine {...Halfway.args} />, 40);
    expect(screen.lines.at(0)).toBe(`${"█".repeat(16)}${"░".repeat(13)} 50/89`);
    expect(screen.look("█")?.fg).toBe(tokens["color.text"]);
  });

  it("keeps the bar's length at 60 columns", async () => {
    const screen = await draw(
      <ProgressLine {...Halfway.args} width={58} />,
      60,
    );
    expect(screen.lines.at(0)).toBe(`${"█".repeat(16)}${"░".repeat(13)} 50/89`);
  });

  it("leaves the bar empty before the first page", async () => {
    const screen = await draw(<ProgressLine {...Starting.args} />, 40);
    expect(screen.lines.at(0)).toBe(`${"░".repeat(29)} 0/0`);
  });

  it("shortens the bar so the pages still fit a narrow line", async () => {
    const screen = await draw(
      <ProgressLine fetched={3} total={3} width={10} />,
      10,
    );
    expect(screen.lines.at(0)).toBe("██████ 3/3");
  });
});
