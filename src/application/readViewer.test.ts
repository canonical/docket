import { describe, expect, it } from "vitest";
import { fakeProvider, providerError } from "../testing/provider.js";
import readViewer from "./readViewer.js";

describe("readViewer", () => {
  it("gives the login gh is signed in with", async () => {
    const provider = fakeProvider({ viewer: async () => "alice" });
    expect(await readViewer(provider)).toEqual({
      viewer: "alice",
      warnings: [],
    });
  });

  it("gives no login, and GitHub's failure as a warning, when GitHub cannot say", async () => {
    const offline = providerError("GITHUB_UNREACHABLE");
    const provider = fakeProvider({ viewer: () => Promise.reject(offline) });
    const { code, message, recovery } = offline;
    expect(await readViewer(provider)).toEqual({
      warnings: [{ code, message, recovery }],
    });
  });

  it("lets a defect through", async () => {
    const provider = fakeProvider({
      viewer: () => Promise.reject(new TypeError("broken")),
    });
    await expect(readViewer(provider)).rejects.toThrow("broken");
  });
});
