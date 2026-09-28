import { describe, expect, it } from "vitest";
import { draw } from "../../../../testing/terminal.js";
import { tokens } from "../../../tokens/index.js";
import Notice from "./Notice.js";
import {
  GhNotInstalled,
  GhNotSignedIn,
  UnexpectedFailure,
} from "./Notice.stories.js";

describe("Notice", () => {
  it("wraps the reason and the recovery two cells in at 40 columns, keeping the command whole", async () => {
    const screen = await draw(<Notice {...GhNotInstalled.args} />, 40);
    expect(screen.lines.slice(0, 4)).toEqual([
      "  ✗ docket needs the GitHub CLI (gh)",
      "  Recovery: install it from",
      "  https://cli.github.com, then run",
      "  gh auth login",
    ]);
  });

  it("draws the reason in the error colour and the recovery in the text colour", async () => {
    const screen = await draw(<Notice {...GhNotSignedIn.args} />, 40);
    expect(screen.lines.slice(0, 2)).toEqual([
      "  ✗ gh is not signed in to github.com",
      "  Recovery: run gh auth login",
    ]);
    expect(screen.look("✗ gh")?.fg).toBe(tokens["color.text.error"]);
    expect(screen.look("Recovery")?.fg).toBe(tokens["color.text"]);
  });

  it("ends the command a recovery names at a semicolon, and wraps the rest", async () => {
    const screen = await draw(<Notice {...UnexpectedFailure.args} />, 40);
    expect(screen.lines.slice(0, 4)).toEqual([
      "  ✗ docket stopped on a failure it has",
      "  no name for: disk on fire",
      "  Recovery: run the command again; if it",
      "  keeps failing, report it",
    ]);
  });

  it("takes fewer lines at 60 columns", async () => {
    const screen = await draw(
      <Notice {...GhNotInstalled.args} width={60} />,
      60,
    );
    expect(screen.lines.slice(0, 3)).toEqual([
      "  ✗ docket needs the GitHub CLI (gh)",
      "  Recovery: install it from https://cli.github.com, then run",
      "  gh auth login",
    ]);
  });
});
