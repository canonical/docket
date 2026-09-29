import { describe, expect, it } from "vitest";
import { thread } from "../../../../testing/facts.js";
import { measureRow } from "../../../../testing/rows.js";
import { draw } from "../../../../testing/terminal.js";
import { tokens } from "../../../tokens/index.js";
import ThreadRow from "./ThreadRow.js";
import {
  ActivityDraft,
  ActivityInvalidFile,
  ActivityStacked,
  ActivityTwoOwners,
  AuthorLeaves,
  BotAuthor,
  BotAuthorSelected,
  DraftClose,
  OverReviewSelected,
  SharedClose,
  SoonReply,
} from "./ThreadRow.stories.js";

describe("ThreadRow", () => {
  describe("at 40 columns", () => {
    it("heads the row with the reference, both kinds, the author and the distance, the owner right-aligned below", async () => {
      const screen = await draw(<ThreadRow {...OverReviewSelected.args} />, 40);
      expect(screen.lines.slice(0, 3)).toEqual([
        "┃┆example#12 PR review ○ dave    1d over",
        "╹┆Fix the parser         ✗ checks  ● bob",
        "",
      ]);
    });

    it("draws the first line bold and the title italic, and nothing else in either", async () => {
      const screen = await draw(<ThreadRow {...OverReviewSelected.args} />, 40);
      expect(screen.look("example#12 PR review")).toMatchObject({
        bold: true,
        italic: false,
      });
      expect(screen.look("○ dave")?.bold).toBe(true);
      expect(screen.look("1d over")?.bold).toBe(true);
      expect(screen.look("Fix the parser")).toMatchObject({
        bold: false,
        italic: true,
      });
      expect(screen.look("● bob")).toMatchObject({
        bold: false,
        italic: false,
      });
    });

    it("gives the state's colour to the distance, a failing field the error colour, and each person their group's hue", async () => {
      const screen = await draw(<ThreadRow {...OverReviewSelected.args} />, 40);
      expect(screen.look("1d over")?.fg).toBe(tokens["color.text.error"]);
      expect(screen.look("✗ checks")?.fg).toBe(tokens["color.text.error"]);
      expect(screen.look("example#12")?.fg).toBe(tokens["color.text"]);
      expect(screen.look("○ dave")?.fg).toBe(tokens["color.text.outside"]);
      expect(screen.look("● bob")?.fg).toBe(tokens["color.text.team"]);
    });

    it("gives both lines of the selected row the selection background, and no other", async () => {
      const selected = await draw(
        <ThreadRow {...OverReviewSelected.args} />,
        40,
      );
      expect(selected.look("example#12")?.bg).toBe(
        tokens["color.background.selected"],
      );
      expect(selected.look("Fix the parser")?.bg).toBe(
        tokens["color.background.selected"],
      );
      const resting = await draw(
        <ThreadRow {...OverReviewSelected.args} selected={false} />,
        40,
      );
      expect(resting.look("Fix the parser")?.bg).not.toBe(
        tokens["color.background.selected"],
      );
    });

    it("runs the bar on past the row when more of the item follows", async () => {
      const screen = await draw(
        <ThreadRow {...OverReviewSelected.args} continued />,
        40,
      );
      expect(screen.lines.slice(0, 2).map((line) => line.slice(0, 2))).toEqual([
        "┃┆",
        "┃┆",
      ]);
    });

    it("draws a draft's close on track, the word draft dimmed before the owner", async () => {
      const screen = await draw(<ThreadRow {...DraftClose.args} />, 40);
      expect(screen.lines.slice(0, 2)).toEqual([
        "│┆example#13 PR close ○ dave     8d left",
        "╵┆Document the parser     draft  ● alice",
      ]);
      expect(screen.look("8d left")?.fg).toBe(tokens["color.text"]);
      expect(screen.look("draft")?.fg).toBe(tokens["color.text.muted"]);
    });

    it("names every owner on a third line, right-aligned, each login cut at 12 cells", async () => {
      const screen = await draw(<ThreadRow {...SharedClose.args} />, 40);
      expect(screen.lines.slice(0, 4)).toEqual([
        "┃ example#4 issue close ○ dave   5d over",
        "┃ Where do tokens live?",
        "╹         ● alice, ● bob, ◐ carol-at-ex…",
        "",
      ]);
    });

    it("leaves unassigned plain in the owner's place", async () => {
      const screen = await draw(<ThreadRow {...SoonReply.args} />, 40);
      expect(screen.lines.at(1)).toBe(
        "╹ Crash on start              unassigned",
      );
      expect(screen.look("unassigned")?.fg).toBe(tokens["color.text"]);
    });

    it("drops the author from the first line when fewer than four cells of login would fit", async () => {
      const screen = await draw(<ThreadRow {...AuthorLeaves.args} />, 40);
      expect(screen.lines.at(0)).toBe(
        "┃ example#1240 issue reply      22h over",
      );
    });

    it("cuts a bot's login to the cells left and keeps its mark, dimmed", async () => {
      const screen = await draw(<ThreadRow {...BotAuthor.args} />, 40);
      expect(screen.lines.at(0)).toBe(
        "│ example#1250 PR review ■ exam… 2d left",
      );
      expect(screen.look("■ exam…")?.fg).toBe(tokens["color.text.muted"]);
    });

    it("wraps the selected row's title in full, in italic, the owner on a line of its own when it does not fit beside the last", async () => {
      const screen = await draw(<ThreadRow {...BotAuthorSelected.args} />, 40);
      expect(screen.lines.slice(1, 4)).toEqual([
        "│ Update dependency example-lib to 3.24",
        `╵${" ".repeat(34)}● bob`,
        "",
      ]);
      expect(screen.look("Update dependency")?.italic).toBe(true);
    });

    it("puts the group beside the last line of the selected row's title when it fits there", async () => {
      const screen = await draw(
        <ThreadRow {...BotAuthorSelected.args} width={30} />,
        30,
      );
      expect(screen.lines.slice(1, 4)).toEqual([
        "│ Update dependency",
        "╵ example-lib to 3.24    ● bob",
        "",
      ]);
    });

    it("draws GitHub's title without its escape sequences", async () => {
      const row = measureRow({
        thread: thread({ title: "Fix\u001b[2J the\u0007 parser" }),
      });
      const screen = await draw(<ThreadRow row={row} width={40} />, 40);
      expect(screen.lines.at(1)).toBe(
        "╹ Fix the parser              unassigned",
      );
    });
  });

  describe("wider than 40 columns", () => {
    it("stretches both lines so the distance and the owner stay at the right edge", async () => {
      const screen = await draw(
        <ThreadRow {...SoonReply.args} width={60} />,
        60,
      );
      expect(screen.lines.slice(0, 2)).toEqual([
        `┃ example#15 issue reply ○ dave${" ".repeat(22)}3h left`,
        `╹ Crash on start${" ".repeat(34)}unassigned`,
      ]);
      expect(screen.look("3h left")?.fg).toBe(tokens["color.text.warning"]);
    });

    it("keeps an author whole that 40 columns leave out", async () => {
      const screen = await draw(
        <ThreadRow {...AuthorLeaves.args} width={60} />,
        60,
      );
      expect(screen.lines.at(0)).toBe(
        `┃ example#1240 issue reply ○ dave${" ".repeat(19)}22h over`,
      );
    });

    it("marks a row whose repository file is invalid, as a field in trouble", async () => {
      const row = measureRow({}, true);
      const screen = await draw(<ThreadRow row={row} width={60} />, 60);
      expect(screen.lines.at(1)).toBe(
        `╹ Example thread${" ".repeat(7)}✗ invalid repository file  unassigned`,
      );
      expect(screen.look("✗ invalid")?.fg).toBe(tokens["color.text.error"]);
    });
  });

  describe("narrower than its text", () => {
    it("cuts the title first, then the reference and kinds before the distance", async () => {
      const screen = await draw(
        <ThreadRow {...OverReviewSelected.args} width={24} />,
        24,
      );
      expect(screen.lines.slice(0, 2)).toEqual([
        "┃┆example#12 PR… 1d over",
        "┃┆Fix the parser",
      ]);
    });

    it("cuts the right group too when even it does not fit", async () => {
      const row = measureRow({ owners: ["alice"] }, true);
      const screen = await draw(<ThreadRow row={row} width={24} />, 24);
      expect(screen.lines.at(1)).toBe("╹   ✗ invalid repositor…");
    });
  });

  describe("in activity", () => {
    it("names the thread, its author and its newest event's age in the plain text colour, with no bar", async () => {
      const screen = await draw(<ThreadRow {...ActivityStacked.args} />, 40);
      expect(screen.lines.slice(0, 3)).toEqual([
        " ┆example#12 PR ○ dave               20m",
        " ┆Fix the parser                 ● alice",
        "",
      ]);
      expect(screen.look("20m")?.fg).toBe(tokens["color.text"]);
      expect(screen.look("┆")?.fg).toBe(tokens["color.text.muted"]);
    });

    it("keeps the age at the right edge of a wider pane, the word draft dimmed", async () => {
      const screen = await draw(
        <ThreadRow {...ActivityDraft.args} width={60} />,
        60,
      );
      expect(screen.lines.slice(0, 2)).toEqual([
        `  example#14 PR ○ dave${" ".repeat(36)}3h`,
        `  Update dependency example-lib to 2.0${" ".repeat(5)}draft  unassigned`,
      ]);
      expect(screen.look("draft")?.fg).toBe(tokens["color.text.muted"]);
    });

    it("cuts the title first, so the owner and the word draft stay whole", async () => {
      const screen = await draw(<ThreadRow {...ActivityDraft.args} />, 40);
      expect(screen.lines.at(1)).toBe(
        "  Update dependency …  draft  unassigned",
      );
    });

    it("lists two owners on a third line", async () => {
      const screen = await draw(<ThreadRow {...ActivityTwoOwners.args} />, 40);
      expect(screen.lines.slice(0, 4)).toEqual([
        "  example#15 issue ○ dave             1d",
        "  Crash on start",
        `${" ".repeat(26)}● alice, ● bob`,
        "",
      ]);
    });

    it("marks a repository's invalid file with ✗ in the error colour", async () => {
      const screen = await draw(
        <ThreadRow {...ActivityInvalidFile.args} />,
        40,
      );
      expect(screen.lines.at(1)).toBe(
        "  Whe…  ✗ invalid repository file  ● bob",
      );
      expect(screen.look("✗ invalid")?.fg).toBe(tokens["color.text.error"]);
    });

    it("caps a long login at 12 cells", async () => {
      const row = {
        ...ActivityStacked.args.row,
        owner: { text: "example-maintainer", fit: "trimmed" as const },
      };
      const screen = await draw(<ThreadRow row={row} width={40} />, 40);
      expect(screen.lines.at(1)).toBe(
        ` ┆Fix the parser${" ".repeat(12)}example-mai…`,
      );
    });
  });
});
