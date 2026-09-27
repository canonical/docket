import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Home, makeHome, openSession } from "../testing/docket.js";
import answerConfig from "./answerConfig.js";

let home: Home;

beforeEach(async () => {
  home = await makeHome();
});

afterEach(async () => {
  await home.remove();
});

describe("answerConfig", () => {
  it("shows the settings of each repository and that gh is signed in, exiting 0", () => {
    const { session, out } = openSession(home, ["config"]);
    const { context, invocation, personal, resolved } = session;
    expect(
      answerConfig(context, invocation, personal, resolved, undefined),
    ).toBe(0);
    expect(out()).toContain("gh: signed in to github.com.");
    expect(out()).toContain(
      "## example (example-org/example-repo)\n- people (personal file): alice team, bob team\n",
    );
    expect(out()).toContain("## docs (example-org/example-docs)\n");
  });

  it("shows why gh gives no token, and exits 2", () => {
    const { session, out } = openSession(home, ["config"]);
    const { context, invocation, personal, resolved } = session;
    const gh = {
      code: "GH_NOT_SIGNED_IN",
      message: "gh is not signed in to github.com.",
      recovery: "run gh auth login",
    } as const;
    expect(answerConfig(context, invocation, personal, resolved, gh)).toBe(2);
    expect(out()).toContain("## Error: GH_NOT_SIGNED_IN\n");
  });
});
