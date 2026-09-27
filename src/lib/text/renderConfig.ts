import type { Duration } from "../clock/index.js";
import type { Origin, Repo, Resolved } from "../config/index.js";
import renderProblems from "./renderProblems.js";
import sanitize from "./sanitize.js";
import type { Format, Problem } from "./types.js";

/** What `docket config` prints, and how. */
export interface ConfigAnswer {
  /** The personal file, and whether one exists there. */
  readonly personal: { readonly path: string; readonly found: boolean };
  /** The settings in effect for each watched repository, in order. */
  readonly repositories: readonly {
    readonly repo: Repo;
    readonly resolved: Resolved;
  }[];
  /** The settings that hold across repositories, and their origins. */
  readonly shared: Resolved;
  /**
   * The login gh is signed in with, or why gh gave no token or GitHub
   * did not name its account.
   */
  readonly gh: { readonly login: string } | Problem;
  readonly format: Format;
}

/** The settings of a resolution and where each section came from. */
type Sections = Pick<Resolved, "settings" | "origins">;

const originWords: Readonly<Record<Origin, string>> = {
  "built-in": "built-in default",
  personal: "personal file",
  repository: "repository file",
};

const duration = ({ amount, unit }: Duration) => `${amount}${unit}`;
const list = (values: readonly string[]) =>
  values.length > 0
    ? values.map((value) => sanitize(value)).join(", ")
    : "none";

/** Each person listed in `people`, with the group and the file that says so. */
const people = ({ settings, origins }: Sections) =>
  [...settings.people].map(([login, group]) => ({
    login: sanitize(login),
    group,
    reason: `listed in the ${originWords[origins.people]}`,
  }));

/** The sections a repository's own file may declare, as lines of text. */
function repositoryLines({ settings, origins }: Sections): string[] {
  const { time, targets, exempt } = settings;
  const { nextMove, close } = targets;
  const listed = people({ settings, origins }).map(
    ({ login, group }) => `${login} ${group}`,
  );
  return [
    `people (${originWords[origins.people]}): ${list(listed)}`,
    `time (${originWords[origins.time]}): workdays ${time.workdays.join(", ")}, timezone ${sanitize(time.timezone)}`,
    `targets (${originWords[origins.targets]}): next-move.response ${duration(nextMove.response)}, next-move.review ${duration(nextMove.review)}, close.issue ${duration(close.issue)}, close.pull-request ${duration(close.pullRequest)}, close.discussion ${duration(close.discussion)}`,
    `exempt (${originWords[origins.exempt]}): close ${list(exempt.close)}`,
  ];
}

/** The sections only the personal file may declare, as lines of text. */
function sharedLines({ settings, origins }: Sections): string[] {
  return [
    `repos (${originWords[origins.repos]}): ${list(settings.repos.map(({ name, repo }) => `${name} ${repo}`))}`,
    `activity (${originWords[origins.activity]}): ${settings.activity.map(duration).join(", ")}`,
    `hosts (${originWords[origins.hosts]}): ${list(settings.hosts)}`,
  ];
}

const fallback =
  "Anyone not listed in people: a bot account is bot, then a member of the organisation is internal, then anyone else is external.";

function settingsData({ settings, origins }: Sections) {
  const { time, targets, exempt } = settings;
  return {
    people: people({ settings, origins }),
    time: { ...time, timezone: sanitize(time.timezone) },
    targets: {
      nextMove: {
        response: duration(targets.nextMove.response),
        review: duration(targets.nextMove.review),
      },
      close: {
        issue: duration(targets.close.issue),
        pullRequest: duration(targets.close.pullRequest),
        discussion: duration(targets.close.discussion),
      },
    },
    exempt: { close: exempt.close.map((label) => sanitize(label)) },
    origins,
  };
}

/**
 * Writes `docket config`: where the personal file is, whether gh gives a
 * token, the settings that hold across repositories, then the settings in
 * effect for each repository. Every value names the file that set it, and
 * each listed person their group and why. A repository's file comes from
 * GitHub, so its values are made safe to print.
 */
export default function renderConfig(answer: ConfigAnswer): string {
  const { personal, repositories, shared, gh, format } = answer;
  const problem = "code" in gh ? gh : undefined;
  const login = "login" in gh ? sanitize(gh.login) : undefined;
  const found = personal.found
    ? "found"
    : "not found, so built-in defaults apply";
  if (format === "json") {
    const { settings, origins } = shared;
    const data = {
      personalFile: { path: personal.path, found: personal.found },
      gh: problem
        ? {
            signedIn: false,
            error: {
              code: problem.code,
              message: sanitize(problem.message),
              recovery: sanitize(problem.recovery),
            },
          }
        : { signedIn: true, host: settings.hosts[0], login },
      repos: settings.repos,
      activity: settings.activity.map(duration),
      hosts: settings.hosts,
      origins: {
        repos: origins.repos,
        activity: origins.activity,
        hosts: origins.hosts,
      },
      repositories: repositories.map(({ repo, resolved }) => ({
        name: repo.name,
        repo: repo.repo,
        ...settingsData(resolved),
      })),
    };
    return `${JSON.stringify(data, null, 2)}\n`;
  }
  const llm = format === "llm";
  const item = (line: string) => (llm ? `- ${line}` : `  ${line}`);
  const ghLines = problem
    ? ["", renderProblems([problem], format).trimEnd()]
    : [`gh: signed in to ${shared.settings.hosts.join(", ")} as ${login}.`];
  const sections = [
    [
      llm ? "# config" : "config",
      `Personal file: ${personal.path}, ${found}.`,
      ...ghLines,
    ],
    [
      llm ? "## every repository" : "every repository",
      ...sharedLines(shared).map(item),
      item(fallback),
    ],
    ...repositories.map(({ repo, resolved }) => [
      llm ? `## ${repo.name} (${repo.repo})` : `${repo.name} (${repo.repo})`,
      ...repositoryLines(resolved).map(item),
    ]),
  ];
  return `${sections.map((lines) => lines.join("\n")).join("\n\n")}\n`;
}
