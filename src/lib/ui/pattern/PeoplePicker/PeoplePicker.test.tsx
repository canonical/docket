import { describe, expect, it, vi } from "vitest";
import { draw } from "../../../../testing/terminal.js";
import { tokens } from "../../../tokens/index.js";
import PeoplePicker from "./PeoplePicker.js";
import {
  Assigning,
  Loading,
  Refused,
  RequestingReview,
  Scrolled,
} from "./PeoplePicker.stories.js";

describe("PeoplePicker", () => {
  it("draws the filter, then each option with its box, two cells in, at 40 columns", async () => {
    const screen = await draw(<PeoplePicker {...Assigning.args} />, 40);
    expect(screen.lines.slice(0, 6)).toEqual([
      "  filter:",
      "  ☑ ◉ alice",
      "  ☐ ● bob",
      "  ☐ ○ dave",
      "  ☐ ◐ designer-example",
      "",
    ]);
  });

  it("gives the option under the cursor the selection background, and no other", async () => {
    const screen = await draw(<PeoplePicker {...Assigning.args} />, 40);
    expect(screen.look("designer-example")?.bg).toBe(
      tokens["color.background.selected"],
    );
    expect(screen.look("● bob")?.bg).not.toBe(
      tokens["color.background.selected"],
    );
    expect(screen.look("☑ ")?.fg).toBe(tokens["color.text"]);
    expect(screen.look("◉ alice")?.fg).toBe(tokens["color.text.team"]);
  });

  it("shows the text typed so far after the prompt", async () => {
    const screen = await draw(
      <PeoplePicker {...Assigning.args} filter="de" />,
      40,
    );
    expect(screen.lines.at(0)).toBe("  filter: de");
  });

  it("hears the typing", async () => {
    const onFilter = vi.fn();
    const screen = await draw(
      <PeoplePicker {...Assigning.args} onFilter={onFilter} />,
      40,
    );
    await screen.redraw(() => screen.setup.mockInput.pressKey("c"));
    expect(onFilter).toHaveBeenLastCalledWith("c");
  });

  it("shows what is typed in the filter line", async () => {
    const screen = await draw(<PeoplePicker {...Assigning.args} />, 40);
    const typed = await screen.redraw(() =>
      screen.setup.mockInput.pressKey("c"),
    );
    expect(typed.lines.at(0)).toBe("  filter: c");
  });

  it("offers teams beside people, a team the viewer belongs to as theirs and any other in the organisation", async () => {
    const screen = await draw(<PeoplePicker {...RequestingReview.args} />, 40);
    expect(screen.lines.slice(1, 6)).toEqual([
      "  ☑ ● bob",
      "  ☐ ◐ carol",
      "  ☐ ◉ example-org/ui",
      "  ☐ ○ dave",
      "  ☐ ◐ example-org/reviewers",
    ]);
  });

  it("trims a name longer than the line", async () => {
    const screen = await draw(
      <PeoplePicker
        {...Assigning.args}
        options={[
          {
            owner: {
              text: "a-very-long-login-for-a-narrow-pane",
              kind: "person",
              group: "outside",
            },
            ticked: false,
          },
        ]}
        width={30}
      />,
      30,
    );
    expect(screen.lines.at(1)).toBe("  ☐ ○ a-very-long-login-for-a…");
  });

  it("draws GitHub's refusal under the options, wrapped, in the error colour", async () => {
    const screen = await draw(<PeoplePicker {...Refused.args} />, 40);
    expect(screen.lines.slice(0, 8)).toEqual([
      "  filter:",
      "  ☐ ◉ alice",
      "  ☑ ◐ designer-example",
      "  ✗ GitHub refused: designer-example is",
      "  not a collaborator on example",
      "  Recovery: ask an example admin to add",
      "  designer-example, then apply again",
      "",
    ]);
    expect(screen.look("✗ GitHub refused")?.fg).toBe(
      tokens["color.text.error"],
    );
  });

  it("says loading… while the options are read", async () => {
    const screen = await draw(<PeoplePicker {...Loading.args} />, 40);
    expect(screen.lines.slice(0, 3)).toEqual([
      "  filter: ca",
      "  loading…",
      "",
    ]);
  });

  it("draws five options at most, scrolled to keep the cursor in the middle", async () => {
    const screen = await draw(<PeoplePicker {...Scrolled.args} />, 40);
    expect(screen.lines.slice(1, 7)).toEqual([
      "  ☐ ○ person-5",
      "  ☐ ○ person-6",
      "  ☐ ○ person-7",
      "  ☐ ○ person-8",
      "  ☐ ○ person-9",
      "",
    ]);
    expect(screen.look("person-7")?.bg).toBe(
      tokens["color.background.selected"],
    );
    const top = await draw(<PeoplePicker {...Scrolled.args} cursor={1} />, 40);
    expect(top.lines.slice(1, 6)).toEqual([
      "  ☑ ○ person-1",
      "  ☐ ○ person-2",
      "  ☐ ○ person-3",
      "  ☐ ○ person-4",
      "  ☐ ○ person-5",
    ]);
  });

  it("gives the refusal one line each at 80 columns", async () => {
    const screen = await draw(
      <PeoplePicker {...Refused.args} width={80} />,
      80,
    );
    expect(screen.lines.slice(3, 6)).toEqual([
      "  ✗ GitHub refused: designer-example is not a collaborator on example",
      "  Recovery: ask an example admin to add designer-example, then apply again",
      "",
    ]);
  });
});
