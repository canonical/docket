import { describe, expect, it } from "vitest";
import describeOwners from "./describeOwners.js";
import type { Person } from "./types.js";

const person = (text: string): Person => ({
  text,
  fit: "trimmed",
  group: "team",
  viewer: false,
});

describe("describeOwners", () => {
  it("names nobody assigned as unassigned", () => {
    expect(describeOwners([])).toEqual({
      owner: { text: "unassigned", fit: "trimmed" },
    });
  });

  it("names one owner on the row, as given", () => {
    expect(describeOwners([person("alice")])).toEqual({
      owner: person("alice"),
    });
    const team = { text: "example-org/reviewers", fit: "trimmed" } as const;
    expect(describeOwners([team])).toEqual({ owner: team });
  });

  it("lists two or more owners on a wrapped line of their own", () => {
    expect(describeOwners([person("alice"), person("bob")])).toEqual({
      owners: { fit: "wrapped", fields: [person("alice"), person("bob")] },
    });
  });
});
