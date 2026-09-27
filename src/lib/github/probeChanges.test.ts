import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeGitHub, settle, token } from "../../testing/github.js";
import createClient from "./createClient.js";
import probeChanges from "./probeChanges.js";

let github: ReturnType<typeof fakeGitHub>;
const issues = "GET /repos/example-org/example-repo/issues";

beforeEach(() => {
  vi.useFakeTimers();
  github = fakeGitHub();
  vi.stubGlobal("fetch", github.fetch);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const probe = (tag: string | undefined) =>
  settle(
    probeChanges(createClient(token, "1.2.3"), "example-org/example-repo", tag),
  );

describe("probeChanges", () => {
  it("asks for the most recently updated thread, and keeps its tag", async () => {
    github.rest(issues, { body: [{}], headers: { etag: 'W/"one"' } });
    expect(await probe(undefined)).toEqual({ changed: true, tag: 'W/"one"' });
    const [sent] = github.sent;
    expect(sent?.url.search).toBe("?state=all&sort=updated&per_page=1");
    expect(sent?.headers.get("if-none-match")).toBeNull();
  });

  it("reports nothing changed when GitHub answers not modified", async () => {
    github.rest(issues, { status: 304 });
    expect(await probe('W/"one"')).toEqual({ changed: false, tag: 'W/"one"' });
    expect(github.sent.at(0)?.headers.get("if-none-match")).toBe('W/"one"');
  });

  it("reports a change, with no tag when GitHub gives none", async () => {
    github.rest(issues, { body: [{}] });
    expect(await probe('W/"one"')).toEqual({ changed: true, tag: undefined });
  });
});
