import type { Duration } from "../clock/index.js";
import type { Origin, Repo, Resolved } from "../config/index.js";
import { describeNoTeam } from "../owed/index.js";
import { quotedNote } from "./constants.js";
import quote from "./quote.js";
import renderJson from "./renderJson.js";
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
  /** Why a repository's own file could not be read, one per repository. */
  readonly warnings: readonly Problem[];
  readonly format: Format;
}

/** The settings of a resolution and where each section came from. */
type Sections = Pick<Resolved, "settings" | "origins">;

const originWords: Readonly<Record<Origin, string>> = {
  "built-in": "built-in default",
  personal: "personal file",
  repository: "repository file",
};

const formatDuration = ({ amount, unit }: Duration) => `${amount}${unit}`;
const formatList = (values: readonly string[]) =>
  values.length > 0
    ? values.map((value) => sanitize(value)).join(", ")
    : "none";

/** Each person listed in `people`, with the group the file gives. */
const listPeople = ({ settings }: Pick<Resolved, "settings">) =>
  [...settings.people].map(([login, group]) => ({
    login: sanitize(login),
    group,
  }));

/** A problem as data, made safe to print. */
const describeProblem = ({ code, message, recovery }: Problem) => ({
  code,
  message: sanitize(message),
  recovery: sanitize(recovery),
});

/**
 * The sections a repository's own file may declare, as lines of text,
 * then each error of that file when it is invalid. A repository's file is
 * written on GitHub, so `write` gives each value, and each error's
 * message and recovery, which repeat the file's text: quoted as data for
 * an agent, made safe to print for a person.
 */
function writeRepositoryLines(
  { settings, origins, repositoryErrors }: Resolved,
  write: (text: string) => string,
): string[] {
  const { time, targets, exempt } = settings;
  const { nextMove, close } = targets;
  const listed = [...settings.people].map(
    ([login, group]) => `${write(login)} ${group}`,
  );
  const labels = exempt.close.map((label) => write(label));
  return [
    `people (${originWords[origins.people]}): ${listed.join(", ") || "none"}`,
    `time (${originWords[origins.time]}): workdays ${time.workdays.join(", ")}, timezone ${write(time.timezone)}`,
    `targets (${originWords[origins.targets]}): next-move.response ${formatDuration(nextMove.response)}, next-move.review ${formatDuration(nextMove.review)}, close.issue ${formatDuration(close.issue)}, close.pull-request ${formatDuration(close.pullRequest)}, close.discussion ${formatDuration(close.discussion)}`,
    `exempt (${originWords[origins.exempt]}): close ${labels.join(", ") || "none"}`,
    ...repositoryErrors.map(
      ({ code, message, recovery }) =>
        `repository file invalid, so built-in defaults apply: ${code} ${write(message)} Recovery: ${write(recovery)}`,
    ),
  ];
}

/** The sections only the personal file may declare, as lines of text. */
function writeSharedLines({ settings, origins }: Sections): string[] {
  return [
    `repos (${originWords[origins.repos]}): ${formatList(settings.repos.map(({ name, repo }) => `${name} ${repo}`))}`,
    `activity (${originWords[origins.activity]}): ${settings.activity.map(formatDuration).join(", ")}`,
    `hosts (${originWords[origins.hosts]}): ${formatList(settings.hosts)}`,
  ];
}

const fallback =
  "Anyone not listed in people: a bot account is bot, then a member of the organisation is internal, then anyone else is external.";

function describeSettings({ settings, origins, repositoryErrors }: Resolved) {
  const { time, targets, exempt } = settings;
  return {
    people: listPeople({ settings }),
    time: { ...time, timezone: sanitize(time.timezone) },
    targets: {
      nextMove: {
        response: formatDuration(targets.nextMove.response),
        review: formatDuration(targets.nextMove.review),
      },
      close: {
        issue: formatDuration(targets.close.issue),
        pullRequest: formatDuration(targets.close.pullRequest),
        discussion: formatDuration(targets.close.discussion),
      },
    },
    exempt: { close: exempt.close.map((label) => sanitize(label)) },
    origins,
    repositoryFileErrors: repositoryErrors.map(describeProblem),
  };
}

/**
 * Writes `docket config`: where the personal file is, whether gh gives a
 * token, that every comment starts a reply wait while a watched
 * repository's settings list nobody as team, as owed's notice says, the
 * settings that hold across repositories, then the settings in effect
 * for each repository, each saying whether it lists a team to a program.
 * Every value names the file that set it, and each listed person their
 * group and why. A repository's file comes from GitHub, so its values
 * are made safe to print.
 */
export default function renderConfig(answer: ConfigAnswer): string {
  const { personal, repositories, shared, gh, warnings, format } = answer;
  const problem = "code" in gh ? gh : undefined;
  const login = "login" in gh ? sanitize(gh.login) : undefined;
  const found = personal.found
    ? "found"
    : "not found, so built-in defaults apply";
  const teamless = describeNoTeam(
    repositories.map(({ repo, resolved }) => ({
      name: repo.name,
      people: resolved.settings.people,
    })),
  );
  if (format === "json") {
    const { settings, origins } = shared;
    const data = {
      personalFile: { path: personal.path, found: personal.found },
      gh: problem
        ? {
            signedIn: false,
            error: describeProblem(problem),
          }
        : { signedIn: true, host: settings.hosts.at(0), login },
      warnings: warnings.map(describeProblem),
      repos: settings.repos,
      activity: settings.activity.map(formatDuration),
      hosts: settings.hosts,
      origins: {
        repos: origins.repos,
        activity: origins.activity,
        hosts: origins.hosts,
      },
      repositories: repositories.map(({ repo, resolved }) => ({
        name: repo.name,
        repo: repo.repo,
        teamListed: [...resolved.settings.people.values()].includes("team"),
        ...describeSettings(resolved),
      })),
    };
    return renderJson(data);
  }
  const llm = format === "llm";
  const formatItem = (line: string) => (llm ? `- ${line}` : `  ${line}`);
  const ghLines =
    "code" in gh
      ? ["", renderProblems([gh], format).trimEnd()]
      : [
          `gh: signed in to ${shared.settings.hosts.join(", ")} as ${llm ? quote(gh.login) : sanitize(gh.login)}.`,
        ];
  const warningLines =
    warnings.length > 0
      ? ["", renderProblems(warnings, format, "Warning").trimEnd()]
      : [];
  // An agent reads words where a person reads the symbol.
  const teamLines = teamless
    ? [
        "",
        `${llm ? "Warning:" : "✗"} ${teamless.reason}`,
        `Recovery: ${teamless.recovery}`,
      ]
    : [];
  const sections = [
    [
      llm ? "# config" : "config",
      `Personal file: ${personal.path}, ${found}.`,
      ...(llm ? [quotedNote] : []),
      ...ghLines,
      ...warningLines,
      ...teamLines,
    ],
    [
      llm ? "## every repository" : "every repository",
      ...writeSharedLines(shared).map(formatItem),
      formatItem(fallback),
    ],
    ...repositories.map(({ repo, resolved }) => [
      llm ? `## ${repo.name} (${repo.repo})` : `${repo.name} (${repo.repo})`,
      ...writeRepositoryLines(resolved, llm ? quote : sanitize).map(formatItem),
    ]),
  ];
  return `${sections.map((lines) => lines.join("\n")).join("\n\n")}\n`;
}
