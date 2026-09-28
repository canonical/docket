import { createTestRenderer } from "@opentui/core/testing";
import { afterEach, describe, expect, it } from "vitest";
import createKeymap from "./createKeymap.js";

const ends: (() => void)[] = [];
afterEach(() => {
  for (const end of ends.splice(0)) end();
});

async function start() {
  const setup = await createTestRenderer({ width: 40, height: 4 });
  ends.push(() => setup.renderer.destroy());
  return { setup, keymap: createKeymap(setup.renderer) };
}

describe("createKeymap", () => {
  it("runs the command bound to a key written with its modifier", async () => {
    const { setup, keymap } = await start();
    const ran: string[] = [];
    keymap.registerLayer({
      commands: [{ name: "refresh", run: () => void ran.push("refresh") }],
      bindings: [{ key: "shift+r", cmd: "refresh" }],
    });
    setup.mockInput.pressKey("R");
    expect(ran).toEqual(["refresh"]);
  });

  it("leaves a command turned off out of what the keys run", async () => {
    const { setup, keymap } = await start();
    const ran: string[] = [];
    keymap.registerLayer({
      commands: [
        { name: "time", enabled: false, run: () => void ran.push("time") },
      ],
      bindings: [{ key: "t", cmd: "time" }],
    });
    setup.mockInput.pressKey("t");
    expect(ran).toEqual([]);
    expect(keymap.getCommands({ visibility: "active" })).toEqual([]);
  });
});
