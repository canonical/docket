import type { Meta, StoryObj } from "@aztlan/lago-react";
import { longRepo } from "../../../../testing/long.js";
import { providerError } from "../../../../testing/provider.js";
import { drawAtWidth } from "../../../../testing/stories.js";
import RefreshStages from "./RefreshStages.js";

const meta = {
  title: "component/RefreshStages",
  component: RefreshStages,
  render: drawAtWidth(RefreshStages),
} satisfies Meta<typeof RefreshStages>;

export default meta;

const repo = "example-org/example-repo";
const docs = "example-org/example-docs";
const site = "example-org/example-site";
const names = { [repo]: "example", [docs]: "docs", [site]: "site" };

/** A first run on the second of three repositories. */
export const Running: StoryObj<typeof meta> = {
  args: {
    stages: [
      {
        repo,
        stage: { kind: "done", threads: 89, fetched: 4, total: 4 },
      },
      { repo: docs, stage: { kind: "reading", fetched: 1, total: 3 } },
      { repo: site, stage: { kind: "waiting" } },
    ],
    names,
    width: 38,
  },
};

/** The budget ran low on the second repository. */
export const BudgetPaused: StoryObj<typeof meta> = {
  args: {
    stages: [
      {
        repo,
        stage: { kind: "done", threads: 89, fetched: 4, total: 4 },
      },
      { repo: docs, stage: { kind: "paused", reason: "budget" } },
      { repo: site, stage: { kind: "paused", reason: "budget" } },
    ],
    names,
    width: 38,
  },
};

/** GitHub refused the second repository for its rate limit. */
export const RateLimited: StoryObj<typeof meta> = {
  args: {
    stages: [
      {
        repo,
        stage: { kind: "done", threads: 1, fetched: 1, total: 1 },
      },
      { repo: docs, stage: { kind: "paused", reason: "rateLimit" } },
      { repo: site, stage: { kind: "paused", reason: "rateLimit" } },
    ],
    names,
    width: 38,
  },
};

/** The refresh failed on the second repository, its reason wrapped. */
export const Failed: StoryObj<typeof meta> = {
  args: {
    stages: [
      {
        repo,
        stage: { kind: "done", threads: 12, fetched: 1, total: 1 },
      },
      {
        repo: docs,
        stage: { kind: "failed", error: providerError("GITHUB_TIMED_OUT") },
      },
      { repo: site, stage: { kind: "waiting" } },
    ],
    names,
    width: 38,
  },
};

/** A repository with a long short name beside two short ones, the last failed. */
export const Long: StoryObj<typeof meta> = {
  args: {
    stages: [
      {
        repo: longRepo.repo,
        stage: { kind: "done", threads: 1234, fetched: 12, total: 12 },
      },
      { repo: docs, stage: { kind: "reading", fetched: 2, total: 3 } },
      {
        repo: site,
        stage: { kind: "failed", error: providerError("GITHUB_TIMED_OUT") },
      },
    ],
    names: { ...names, [longRepo.repo]: longRepo.name },
    width: 38,
  },
};
