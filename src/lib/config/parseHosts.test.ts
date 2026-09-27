import { describe, expect, it } from "vitest";
import parseHosts from "./parseHosts.js";

describe("parseHosts", () => {
  it("reads github.com", () => {
    expect(parseHosts(["github.com"])).toEqual({
      value: ["github.com"],
      errors: [],
    });
  });

  it("refuses a section that is not a list", () => {
    expect(parseHosts("github.com")).toEqual({
      value: undefined,
      errors: [expect.objectContaining({ code: "CONFIG_WRONG_TYPE" })],
    });
  });

  it("refuses an empty list", () => {
    expect(parseHosts([]).errors).toEqual([
      {
        code: "CONFIG_EMPTY_LIST",
        message: "`hosts` lists no host.",
        recovery: "Write `hosts: [github.com]`, or remove the section.",
      },
    ]);
  });

  it("refuses every host other than github.com", () => {
    expect(parseHosts(["github.com", "example.com"]).errors).toEqual([
      {
        code: "CONFIG_UNSUPPORTED_HOST",
        message:
          '`hosts` lists `"example.com"`, and docket supports only github.com.',
        recovery: 'Remove `"example.com"` from `hosts`.',
      },
    ]);
  });
});
