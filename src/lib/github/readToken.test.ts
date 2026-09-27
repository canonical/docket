import { afterEach, describe, expect, it, vi } from "vitest";
import { token } from "../../testing/github.js";
import readToken from "./readToken.js";

type Callback = (error: unknown, stdout: string, stderr: string) => void;

const gh = vi.hoisted(() => ({
  run: (
    _file: string,
    _args: string[],
    _options: object,
    _done: Callback,
  ) => {},
}));
vi.mock("node:child_process", () => ({
  execFile: (file: string, args: string[], options: object, done: Callback) =>
    gh.run(file, args, options, done),
}));

const answer = (error: unknown, stdout: string) => {
  const run = vi.fn(
    (_file: string, _args: string[], _options: object, done: Callback) =>
      done(error, stdout, ""),
  );
  gh.run = run;
  return run;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("readToken", () => {
  it("gives the token gh prints for github.com, waiting ten seconds at most", async () => {
    const run = answer(null, `${token}\n`);
    await expect(readToken("github.com")).resolves.toBe(token);
    expect(run).toHaveBeenCalledWith(
      "gh",
      ["auth", "token", "--hostname", "github.com"],
      { timeout: 10_000 },
      expect.any(Function),
    );
  });

  it("names GH_NOT_INSTALLED when gh cannot be found", async () => {
    answer(Object.assign(new Error("spawn gh ENOENT"), { code: "ENOENT" }), "");
    await expect(readToken("github.com")).rejects.toMatchObject({
      code: "GH_NOT_INSTALLED",
      message: "docket needs the GitHub CLI (gh).",
      recovery:
        "install it from https://cli.github.com, then run gh auth login",
    });
  });

  it("names GH_NOT_SIGNED_IN when gh has no token for the host", async () => {
    answer(Object.assign(new Error("exit 1"), { code: 1 }), "");
    await expect(readToken("github.com")).rejects.toMatchObject({
      code: "GH_NOT_SIGNED_IN",
      message: "gh is not signed in to github.com.",
      recovery: "run gh auth login",
    });
  });

  it("names GH_NOT_SIGNED_IN when gh prints nothing", async () => {
    answer(null, "\n");
    await expect(readToken("github.com")).rejects.toMatchObject({
      code: "GH_NOT_SIGNED_IN",
    });
  });

  it("names GH_NOT_SIGNED_IN, with a way to see why, when gh gives no token in time", async () => {
    answer(
      Object.assign(new Error("Command failed"), {
        killed: true,
        signal: "SIGTERM",
        code: null,
      }),
      "",
    );
    await expect(readToken("github.com")).rejects.toMatchObject({
      code: "GH_NOT_SIGNED_IN",
      message: "gh gave no token for github.com within 10 seconds.",
      recovery: "run gh auth status, and unlock the keyring if it asks",
    });
  });
});
