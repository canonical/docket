import { describe, expect, it } from "vitest";
import describeReason from "./describeReason.js";

describe("describeReason", () => {
  it("writes each reason GitHub gives in docket's words", () => {
    expect(describeReason("review_requested")).toBe("review requested");
    expect(describeReason("team_mention")).toBe("team mention");
    expect(describeReason("ci_activity")).toBe("CI activity");
    expect(describeReason("manual")).toBe("manual");
  });

  it("writes a reason docket does not know as other", () => {
    expect(describeReason("something_new")).toBe("other");
  });
});
