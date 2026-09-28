import { createTestRenderer } from "@opentui/core/testing";
import { afterEach, describe, expect, it } from "vitest";
import createKeymap from "../createKeymap.js";
import describeCommands from "./describeCommands.js";

const ends: (() => void)[] = [];
afterEach(() => {
  for (const end of ends.splice(0)) end();
});

/** A keymap on a test renderer, with one layer of `commands` bound. */
async function bind(
  commands: readonly {
    name: string;
    key: string[];
    [field: string]: unknown;
  }[],
) {
  const { renderer } = await createTestRenderer({ width: 40, height: 4 });
  ends.push(() => renderer.destroy());
  const keymap = createKeymap(renderer);
  keymap.registerLayer({
    commands: commands.map(({ key, ...command }) => ({
      ...command,
      run: () => {},
    })),
    bindings: commands.flatMap(({ name, key }) =>
      key.map((each) => ({ key: each, cmd: name })),
    ),
  });
  return keymap.getCommandEntries({ visibility: "registered" });
}

describe("describeCommands", () => {
  it("gives each command its label, group, hint and notes, with its keys as typed", async () => {
    const entries = await bind([
      {
        name: "refresh",
        key: ["shift+r"],
        desc: "full refresh",
        group: "App",
        hint: "",
        notes: ["fetches everything"],
      },
    ]);
    expect(describeCommands(entries)).toEqual([
      {
        keys: ["R"],
        alternates: [],
        label: "full refresh",
        hint: "",
        group: "App",
        notes: ["fetches everything"],
      },
    ]);
  });

  it("joins neighbouring commands with one label, first keys then the others", async () => {
    const entries = await bind([
      { name: "back", key: ["left", "h"], desc: "switch mode", group: "Mode" },
      { name: "on", key: ["right", "l"], desc: "switch mode", group: "Mode" },
      { name: "group", key: ["g"], desc: "next grouping", group: "Mode" },
    ]);
    expect(describeCommands(entries)).toEqual([
      {
        keys: ["←", "→"],
        alternates: ["h", "l"],
        label: "switch mode",
        group: "Mode",
        notes: [],
      },
      {
        keys: ["g"],
        alternates: [],
        label: "next grouping",
        group: "Mode",
        notes: [],
      },
    ]);
  });

  it("lists a command no key is bound to, with no keys", async () => {
    const entries = await bind([{ name: "quit", key: [], desc: "quit" }]);
    expect(describeCommands(entries).at(0)?.keys).toEqual([]);
  });

  it("shows what runs a command no key runs, such as typing", async () => {
    const entries = await bind([
      { name: "filter", key: [], desc: "filter", shown: "type" },
    ]);
    expect(describeCommands(entries).at(0)?.keys).toEqual(["type"]);
  });

  it("shows the space and escape keys as ␣ and esc", async () => {
    const entries = await bind([
      { name: "tick", key: ["space"], desc: "toggle" },
      { name: "cancel", key: ["escape"], desc: "cancel" },
    ]);
    expect(describeCommands(entries).map(({ keys }) => keys)).toEqual([
      ["␣"],
      ["esc"],
    ]);
  });

  it("names a command with no label or group by its name, and leaves it out of the bar", async () => {
    const entries = await bind([{ name: "quit", key: ["q"] }]);
    expect(describeCommands(entries)).toEqual([
      { keys: ["q"], alternates: [], label: "quit", group: "", notes: [] },
    ]);
  });
});
