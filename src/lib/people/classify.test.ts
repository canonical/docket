import { describe, expect, it } from "vitest";
import { alice, carol, dave, exampleSync } from "../../testing/facts.js";
import type { Group } from "../config/index.js";
import classify from "./classify.js";

const people = new Map<string, Group>([["alice", "team"]]);

describe("classify", () => {
  it("puts a login the configuration lists into its configured group", () => {
    expect(classify(alice, people)).toBe("team");
  });

  it("finds a configured login whatever its case on GitHub", () => {
    expect(classify({ ...alice, login: "Alice" }, people)).toBe("team");
  });

  it("puts an unlisted bot account among the bots, even when it is a member", () => {
    expect(classify(exampleSync, people)).toBe("bot");
    expect(classify({ ...exampleSync, member: true }, people)).toBe("bot");
  });

  it("puts an unlisted member of the organisation among the internal people", () => {
    expect(classify(carol, people)).toBe("internal");
  });

  it("puts everyone else among the external people", () => {
    expect(classify(dave, people)).toBe("external");
  });

  it("puts an unlisted person recorded without membership among the external people", () => {
    expect(classify({ login: "carol", type: "user" }, people)).toBe("external");
  });

  it("lets the configuration correct an account the fallback gets wrong", () => {
    const corrected = new Map<string, Group>([
      ["example-sync", "external"],
      ["dave", "bot"],
    ]);
    expect(classify(exampleSync, corrected)).toBe("external");
    expect(classify(dave, corrected)).toBe("bot");
  });

  it("never puts an unlisted account in the team, even a member of the organisation", () => {
    expect(classify(alice, new Map())).toBe("internal");
  });
});
