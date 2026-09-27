import { describe, expect, it } from "vitest";
import { draw } from "../../../../testing/terminal.js";
import { tokens } from "../../../tokens/index.js";
import HelpOverlay from "./HelpOverlay.js";
import { Keys } from "./HelpOverlay.stories.js";

const lines = [
  "",
  "Mode",
  "  ← →  h l switch mode (owed ↔ activity)",
  "           docket opens owed",
  "  g        next grouping",
  "  t        next time window (activity)",
  "           owed: most overdue first",
  "           activity: newest first",
  "",
  "App",
  "  ?        show or hide help",
  "  R        full refresh",
  "  q        quit",
  "",
  "  windows are counted in working time",
];

describe("HelpOverlay", () => {
  it("lists every key under its group, labels in one column, at 40 columns", async () => {
    const screen = await draw(<HelpOverlay {...Keys.args} />, 40, 16);
    expect(screen.lines.slice(0, lines.length)).toEqual(lines);
  });

  it("draws the group headings and the keys in bold, the labels not", async () => {
    const screen = await draw(<HelpOverlay {...Keys.args} />, 40, 16);
    expect(screen.look("Mode")).toMatchObject({
      fg: tokens["color.text"],
      bold: true,
    });
    expect(screen.look("← →  h l")?.bold).toBe(true);
    expect(screen.look("switch mode")?.bold).toBe(false);
  });

  it("keeps the same lines at 60 columns", async () => {
    const screen = await draw(
      <HelpOverlay {...Keys.args} width={60} />,
      60,
      16,
    );
    expect(screen.lines.slice(0, lines.length)).toEqual(lines);
  });

  it("cuts a label that crosses a narrow pane with an ellipsis", async () => {
    const screen = await draw(
      <HelpOverlay {...Keys.args} width={24} />,
      24,
      16,
    );
    expect(screen.lines.at(2)).toBe("  ← →  h l switch mode …");
  });
});
