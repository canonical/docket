import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Provider } from "../lib/provider/index.js";
import { type Home, makeHome, openSession } from "../testing/docket.js";
import { providerError } from "../testing/provider.js";
import { recordedProvider } from "../testing/recorded.js";
import readViewer from "./readViewer.js";

let home: Home;

beforeEach(async () => {
  home = await makeHome();
});

afterEach(async () => {
  await home.remove();
});

/** Reads the viewer through a session on `provider`, under `args`. */
const readWith = (provider: Provider, args = ["owed"]) =>
  readViewer(openSession(home, args, provider).session);

describe("readViewer", () => {
  it("gives the login gh is signed in with", async () => {
    const provider = recordedProvider({ viewer: async () => "alice" });
    expect(await readWith(provider)).toEqual({
      viewer: "alice",
      warnings: [],
    });
  });

  it("asks GitHub once while the login held is younger than the maximum age, and again after", async () => {
    const viewer = vi.fn(async () => "alice");
    const provider = recordedProvider({ viewer });
    await readWith(provider);
    await readWith(provider);
    expect(viewer).toHaveBeenCalledOnce();
    await readWith(provider, ["owed", "--max-age", "0"]);
    expect(viewer).toHaveBeenCalledTimes(2);
  });

  it("gives the login held, with no warning, while GitHub cannot be reached", async () => {
    await readWith(recordedProvider({ viewer: async () => "alice" }));
    const offline = recordedProvider({
      viewer: () => Promise.reject(providerError("GITHUB_UNREACHABLE")),
    });
    expect(await readWith(offline)).toEqual({
      viewer: "alice",
      warnings: [],
    });
  });

  it("gives no login, and GitHub's failure as a warning, when GitHub cannot say and nothing is held", async () => {
    const unreachable = providerError("GITHUB_UNREACHABLE");
    const provider = recordedProvider({
      viewer: () => Promise.reject(unreachable),
    });
    const { code, message, recovery } = unreachable;
    expect(await readWith(provider)).toEqual({
      warnings: [{ code, message, recovery }],
    });
  });

  it("lets a defect through", async () => {
    const provider = recordedProvider({
      viewer: () => Promise.reject(new TypeError("broken")),
    });
    await expect(readWith(provider)).rejects.toThrow("broken");
  });
});
