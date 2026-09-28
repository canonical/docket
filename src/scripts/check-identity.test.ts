import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  makeRepository,
  pointings,
  type Repository,
} from "../testing/repository.js";
import readEnvironmentWithoutGit from "./readEnvironmentWithoutGit.js";

describe("check-identity --self-test", () => {
  let repository: Repository;
  beforeEach(() => {
    repository = makeRepository();
  });
  afterEach(() => repository.remove());

  it.each(Object.entries(pointings))(
    "leaves a repository named by %s unchanged, and passes",
    (_, point) => {
      const before = repository.readState();
      const run = Bun.spawnSync(
        ["bun", "src/scripts/check-identity.ts", "--self-test"],
        { env: { ...readEnvironmentWithoutGit(), ...point(repository) } },
      );
      expect(repository.readState()).toBe(before);
      expect(run.stdout.toString()).toContain("breaks rejected");
      expect(run.exitCode).toBe(0);
    },
    30_000,
  );
});
