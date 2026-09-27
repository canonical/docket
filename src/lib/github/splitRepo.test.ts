import { describe, expect, it } from "vitest";
import splitRepo from "./splitRepo.js";

describe("splitRepo", () => {
  it("splits owner/name into its two parts", () => {
    expect(splitRepo("example-org/example-repo")).toEqual({
      owner: "example-org",
      name: "example-repo",
    });
  });

  it("gives an empty part for one that is missing", () => {
    expect(splitRepo("example-org")).toEqual({
      owner: "example-org",
      name: "",
    });
    expect(splitRepo("")).toEqual({ owner: "", name: "" });
  });
});
