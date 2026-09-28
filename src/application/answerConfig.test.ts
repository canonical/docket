import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Provider } from "../lib/provider/index.js";
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

/** Answers `docket config` with `provider` and the cache on it. */
async function answerWith(provider: Provider) {
  const { session, out } = openSession(home, ["config"], provider);
  const { context, invocation, personal, resolved, cache } = session;
  const code = await answerConfig(context, invocation, personal, resolved, {
    provider,
    cache,
  });
  return { code, out: out() };
}

describe("answerConfig", () => {
  it("shows the settings of each repository and the account gh is signed in with, exiting 0", async () => {
    const { code, out } = await answerWith(recordedProvider());
    expect(code).toBe(0);
    expect(out).toContain('gh: signed in to github.com as "alice".');
    expect(out).toContain(
      "## example (example-org/example-repo)\n- people (personal file): alice team, bob team\n",
    );
    expect(out).toContain("## docs (example-org/example-docs)\n");
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
    const unreachable = await answerWith(
      recordedProvider({
        viewer: () => Promise.reject(providerError("GITHUB_TIMED_OUT")),
      }),
    );
    expect(unreachable.code).toBe(3);
    expect(unreachable.out).toContain("## Error: GITHUB_TIMED_OUT\n");
    const refused = await answerWith(
      recordedProvider({
        viewer: () => Promise.reject(providerError("GH_NOT_SIGNED_IN")),
      }),
    );
    expect(refused.code).toBe(2);
  });

  it("shows each repository with its own file, and the file's errors when it is invalid", async () => {
    const { code, out } = await answerWith(
      recordedProvider({
        readFile: async (repo) =>
          repo === "example-org/example-repo"
            ? "version: 1\nexempt:\n  close: [wontfix]\n"
            : "version: 1\ntargetz: {}\n",
      }),
    );
    expect(code).toBe(0);
    expect(out).toContain("- exempt (repository file): close wontfix\n");
    expect(out).toContain(
      "- repository file invalid, so built-in defaults apply: CONFIG_UNKNOWN_KEY",
    );
  });

  it("shows gh's failure when GitHub refuses the token while reading a repository's file, exiting 2", async () => {
    const { code, out } = await answerWith(
      recordedProvider({
        readFile: () => Promise.reject(providerError("GH_NOT_SIGNED_IN")),
      }),
    );
    expect(code).toBe(2);
    expect(out).toContain("## Error: GH_NOT_SIGNED_IN\n");
    expect(out).toContain("- people (personal file): alice team, bob team");
  });

  it("rethrows a failure that has no named code", async () => {
    await expect(
      answerWith(
        recordedProvider({
          viewer: () => Promise.reject(new TypeError("broken")),
        }),
      ),
    ).rejects.toThrow("broken");
  });
});
