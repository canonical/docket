import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Home, makeHome, openSession } from "../testing/docket.js";
import { providerError } from "../testing/provider.js";
import { recordedProvider } from "../testing/recorded.js";
import answerConfig from "./answerConfig.js";

let home: Home;

beforeEach(async () => {
  home = await makeHome();
});

afterEach(async () => {
  await home.remove();
});

describe("answerConfig", () => {
  it("shows the settings of each repository and the account gh is signed in with, exiting 0", async () => {
    const { session, out } = openSession(home, ["config"]);
    const { context, invocation, personal, resolved, provider } = session;
    expect(
      await answerConfig(context, invocation, personal, resolved, provider),
    ).toBe(0);
    expect(out()).toContain("gh: signed in to github.com as alice.");
    expect(out()).toContain(
      "## example (example-org/example-repo)\n- people (personal file): alice team, bob team\n",
    );
    expect(out()).toContain("## docs (example-org/example-docs)\n");
  });

  it("shows why gh gives no token, and exits 2", async () => {
    const { session, out } = openSession(home, ["config"]);
    const { context, invocation, personal, resolved } = session;
    const gh = {
      code: "GH_NOT_SIGNED_IN",
      message: "gh is not signed in to github.com.",
      recovery: "run gh auth login",
    } as const;
    expect(
      await answerConfig(context, invocation, personal, resolved, gh),
    ).toBe(2);
    expect(out()).toContain("## Error: GH_NOT_SIGNED_IN\n");
  });

  it("shows why GitHub did not name the account, exiting with that problem's code", async () => {
    const { session, out } = openSession(home, ["config"]);
    const { context, invocation, personal, resolved } = session;
    const unreachable = recordedProvider({
      viewer: () => Promise.reject(providerError("GITHUB_TIMED_OUT")),
    });
    expect(
      await answerConfig(context, invocation, personal, resolved, unreachable),
    ).toBe(3);
    expect(out()).toContain("## Error: GITHUB_TIMED_OUT\n");
    const refused = recordedProvider({
      viewer: () => Promise.reject(providerError("GH_NOT_SIGNED_IN")),
    });
    expect(
      await answerConfig(context, invocation, personal, resolved, refused),
    ).toBe(2);
  });

  it("rethrows a failure that has no named code", async () => {
    const { session } = openSession(home, ["config"]);
    const { context, invocation, personal, resolved } = session;
    const broken = recordedProvider({
      viewer: () => Promise.reject(new TypeError("broken")),
    });
    await expect(
      answerConfig(context, invocation, personal, resolved, broken),
    ).rejects.toThrow("broken");
  });
});
