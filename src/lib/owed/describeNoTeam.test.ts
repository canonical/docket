import { describe, expect, it } from "vitest";
import { teamSettings } from "../../testing/facts.js";
import describeNoTeam from "./describeNoTeam.js";

const team = teamSettings.people;
const none = new Map();
const recovery =
  "list the team under people: in the personal file or in the repository's .github/docket.yaml";

describe("describeNoTeam", () => {
  it("says nothing while every repository lists a team, or none is watched", () => {
    expect(describeNoTeam([{ name: "example", people: team }])).toBeUndefined();
    expect(describeNoTeam([])).toBeUndefined();
  });

  it("names no repository when none lists a team", () => {
    const repos = [
      { name: "example", people: none },
      { name: "docs", people: new Map([["carol", "internal" as const]]) },
    ];
    expect(describeNoTeam(repos)).toEqual({
      reason: "no team in docket.yaml, so every comment starts a reply wait",
      recovery,
    });
  });

  it("names the repositories without a team when others list one", () => {
    const repos = [
      { name: "example", people: none },
      { name: "docs", people: team },
      { name: "site", people: none },
      { name: "api", people: none },
    ];
    expect(describeNoTeam(repos)?.reason).toBe(
      "no team in docket.yaml for example, site and api, so every comment starts a reply wait",
    );
    expect(describeNoTeam(repos.slice(0, 2))?.reason).toBe(
      "no team in docket.yaml for example, so every comment starts a reply wait",
    );
  });
});
