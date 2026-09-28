import { useBindings } from "@opentui/keymap/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { draw, WithKeys } from "../../../testing/terminal.js";
import useCommands from "./useCommands.js";

/** Binds `?` to show time, and `t`, enabled only once `?` is pressed. */
function Bound({ visibility }: { visibility: "active" | "registered" }) {
  const [on, setOn] = useState(false);
  useBindings(
    () => ({
      commands: [
        { name: "show", desc: "show", group: "App", run: () => setOn(true) },
        {
          name: "time",
          desc: "time",
          group: "Mode",
          enabled: on,
          run: () => {},
        },
      ],
      bindings: [
        { key: "?", cmd: "show" },
        { key: "t", cmd: "time" },
      ],
    }),
    [on],
  );
  const commands = useCommands({ visibility });
  return <text>{commands.map(({ label }) => label).join(",") || "-"}</text>;
}

describe("useCommands", () => {
  it("lists the commands the keys run now, and follows a command turned on", async () => {
    const screen = await draw(
      <WithKeys>
        <Bound visibility="active" />
      </WithKeys>,
      40,
      2,
    );
    expect((await screen.redraw()).lines.at(0)).toBe("show");
    const pressed = await screen.redraw(() =>
      screen.setup.mockInput.pressKey("?"),
    );
    expect(pressed.lines.at(0)).toBe("show,time");
  });

  it("lists every command bound, turned off or not", async () => {
    const screen = await draw(
      <WithKeys>
        <Bound visibility="registered" />
      </WithKeys>,
      40,
      2,
    );
    expect((await screen.redraw()).lines.at(0)).toBe("show,time");
  });
});
