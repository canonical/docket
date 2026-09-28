import { describe, expect, it } from "vitest";
import { teamSettings } from "../../testing/facts.js";
import describeNoTeam from "./describeNoTeam.js";

const team = teamSettings.people;
const none = new Map();
const notice = {
  reason: "no team in docket.yaml, so every comment starts a reply wait",
  recovery:
    "list the team under people: in the personal file or the repository's .github/docket.yaml, then run docket config",
};

describe("describeNoTeam", () => {
  it("says nothing while every repository lists a team, or none is watched", () => {
    expect(describeNoTeam([team])).toBeUndefined();
    expect(describeNoTeam([])).toBeUndefined();
  });

  it("says every comment starts a reply wait when no repository lists a team", () => {
    const internal = new Map([["carol", "internal" as const]]);
    expect(describeNoTeam([none, internal])).toEqual(notice);
  });

  it("says the same, naming no repository, when only some list no team", () => {
    expect(describeNoTeam([none, team, none])).toEqual(notice);
  });
});
