import { describe, expect, it } from "vitest";
import {
  alice,
  carol,
  dave,
  exampleSync,
  teamSettings,
} from "../../testing/facts.js";
import describePerson from "./describePerson.js";

const { people } = teamSettings;
const groupOf = (...args: Parameters<typeof describePerson>) =>
  describePerson(...args).group;

describe("describePerson", () => {
  it("names a login whole, with the group the settings give it, external read as outside", () => {
    expect(describePerson(alice, people, undefined)).toEqual({
      text: "alice",
      kind: "person",
      group: "team",
    });
    expect(
      [carol, dave, exampleSync].map((author) =>
        groupOf(author, people, undefined),
      ),
    ).toEqual(["internal", "outside", "bot"]);
  });

  it("names the viewer you, whatever the case of either login and whatever their group", () => {
    expect(groupOf(alice, people, "Alice")).toBe("you");
    expect(groupOf({ ...dave, login: "DAVE" }, people, "dave")).toBe("you");
    expect(groupOf(carol, people, "alice")).toBe("internal");
  });
});
