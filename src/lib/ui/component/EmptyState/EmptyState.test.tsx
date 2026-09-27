import { describe, expect, it } from "vitest";
import { draw } from "../../../../testing/terminal.js";
import { tokens } from "../../../tokens/index.js";
import EmptyState from "./EmptyState.js";
import { NothingOwed } from "./EmptyState.stories.js";

describe("EmptyState", () => {
  it("states the message two cells in, in the text colour, at 40 columns", async () => {
    const screen = await draw(<EmptyState {...NothingOwed.args} />, 40);
    expect(screen.lines.at(0)).toBe("  nothing owed");
    expect(screen.look("nothing owed")?.fg).toBe(tokens["color.text"]);
  });

  it("states the same line at 60 columns", async () => {
    const screen = await draw(
      <EmptyState {...NothingOwed.args} width={60} />,
      60,
    );
    expect(screen.lines.at(0)).toBe("  nothing owed");
  });

  it("cuts a message wider than the pane with an ellipsis", async () => {
    const screen = await draw(
      <EmptyState {...NothingOwed.args} width={10} />,
      10,
    );
    expect(screen.lines.at(0)).toBe("  nothing…");
  });
});
