import { describe, expect, it } from "vitest";
import { draw } from "../../../../testing/terminal.js";
import { tokens } from "../../../tokens/index.js";
import ActivityRow from "./ActivityRow.js";
import {
  Draft,
  InvalidFile,
  Stacked,
  TwoOwners,
} from "./ActivityRow.stories.js";

describe("ActivityRow", () => {
  it("names the thread and its newest event's age, the title and the owner, at 40 columns", async () => {
    const screen = await draw(<ActivityRow {...Stacked.args} />, 40);
    expect(screen.lines.slice(0, 3)).toEqual([
      " ┃example#12 PR                      20m",
      " ┃Fix the parser · alice",
      "",
    ]);
    expect(screen.look("example#12")?.fg).toBe(tokens["color.text"]);
    expect(screen.look("20m")?.fg).toBe(tokens["color.text"]);
    expect(screen.look("┃")?.fg).toBe(tokens["color.text.muted"]);
  });

  it("keeps the age at the right edge of a wider pane and draws no stack rule outside a stack", async () => {
    const screen = await draw(<ActivityRow {...Draft.args} width={60} />, 60);
    expect(screen.lines.slice(0, 2)).toEqual([
      `  example#14 PR${" ".repeat(43)}3h`,
      "  Update dependency example-lib to 2.0 · unassigned draft",
    ]);
    expect(screen.look("draft")?.fg).toBe(tokens["color.text.muted"]);
  });

  it("cuts the title first, so the owner and the word draft stay whole", async () => {
    const screen = await draw(<ActivityRow {...Draft.args} />, 40);
    expect(screen.lines.at(1)).toBe("  Update dependency … · unassigned draft");
  });

  it("lists two owners on a third line", async () => {
    const screen = await draw(<ActivityRow {...TwoOwners.args} />, 40);
    expect(screen.lines.slice(0, 4)).toEqual([
      "  example#15 issue                    1d",
      "  Crash on start",
      "  alice, bob",
      "",
    ]);
  });

  it("marks a repository's invalid file with ✗ in the error colour", async () => {
    const screen = await draw(<ActivityRow {...InvalidFile.args} />, 40);
    expect(screen.lines.at(1)).toBe("  Where… · bob ✗ invalid repository file");
    expect(screen.look("✗ invalid")?.fg).toBe(tokens["color.text.error"]);
  });

  it("caps a long login at 12 cells", async () => {
    const row = {
      ...Stacked.args.row,
      owner: { text: "example-maintainer", fit: "trimmed" as const },
    };
    const screen = await draw(<ActivityRow row={row} width={40} />, 40);
    expect(screen.lines.at(1)).toBe(" ┃Fix the parser · example-mai…");
  });
});
