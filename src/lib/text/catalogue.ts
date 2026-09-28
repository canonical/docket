import { activityGroupings } from "../activity/index.js";
import { owedGroupings } from "../owed/index.js";
import type { Command, Flag } from "./types.js";

const format: Flag = {
  name: "format",
  value: "format",
  choices: ["plain", "llm", "json"],
  fallback: "plain in a terminal, llm when the output is piped or captured",
  description:
    "How the answer is written: plain text for a person, condensed Markdown for an agent (llm), or JSON for a program. In JSON, every key, and every value docket names, such as a kind or a state, is a fixed camelCase identifier rather than an on-screen word: the configuration's `next-move` is `nextMove`.",
};

const detail: Flag = {
  name: "detail",
  value: "level",
  choices: ["summary", "standard", "detailed"],
  default: "standard",
  description:
    "How much each item shows: summary gives the counts alone, detailed adds when each wait started, its target, and every message, file and check.",
};

const maxAge: Flag = {
  name: "max-age",
  value: "seconds",
  default: "300",
  description:
    "How old the cached data may be before docket fetches from GitHub; 0 always fetches.",
};

const readExits = {
  0: "docket answered, even when threads are over target, and also when it served cached data during a rate limit or an outage, with a warning.",
  2: "A prerequisite is missing: gh is not installed or not signed in, the personal configuration is invalid, or the call itself is not valid.",
  3: "No data could be obtained from GitHub or the cache.",
} as const;

/**
 * Every command docket answers, with the help each gives. `docket --help`,
 * `docket <command> --help` and the reading of the arguments (each flag,
 * its choices and its default) are drawn from this list alone, so neither
 * the help nor the parser can drift from the commands.
 */
const catalogue: readonly Command[] = [
  {
    name: "owed",
    arguments: "",
    answers:
      "Which replies, reviews and closes are owed on the watched repositories, by whom, and how far each is from its target.",
    notes: [
      "Rows run most overdue first, measured as a share of each wait's own target, so a reply 12 hours over a 24-hour target ranks above a close 12 hours over a 5-day one.",
      "Targets count working time on the configured workdays and time zone.",
      "`docket` with no command prints the same list.",
    ],
    flags: [
      {
        name: "by",
        value: "grouping",
        choices: owedGroupings,
        default: "none",
        description:
          "Splits the list into sections: by owner, by repo, or by stack; a wait with two owners appears under each.",
      },
      format,
      detail,
      maxAge,
    ],
    example: "docket owed --by owner",
    exits: readExits,
  },
  {
    name: "activity",
    arguments: "",
    answers:
      "What happened on the watched threads within a time window: comments, reviews, pushes, assignments, labels, and checks that failed.",
    notes: [
      "Threads run by their newest event, newest first, with their events under them.",
      "Windows count working time, so a 24h window on a Monday morning reaches back to Friday morning.",
    ],
    flags: [
      {
        name: "window",
        value: "window",
        fallback: "the first window in the configuration's `activity` list",
        description:
          "How far back the list reaches: one of the windows in the configuration's `activity` list, 24h, 48h, 72h and 1w unless it says otherwise.",
      },
      {
        name: "by",
        value: "grouping",
        choices: activityGroupings,
        default: "kind",
        description:
          "Splits the list into sections: by kind of thread (ISSUES, PULL REQUESTS, DISCUSSIONS), by repo, or none.",
      },
      format,
      detail,
      maxAge,
    ],
    example: "docket activity --window 48h --by repo",
    exits: readExits,
  },
  {
    name: "show",
    arguments: "<reference>",
    answers:
      "Everything about one thread, untrimmed: its waits, its latest message, the reviews requested, its checks, its files and its stack.",
    notes: [
      "A reference names a thread as `<repo>#<number>`, such as `example#12`, where `<repo>` is the short name in the configuration's `repos`. `<repo> stack <number>` shows every open pull request of a stack.",
      "The thread must be open: docket keeps only open threads.",
      "The thread's details, such as its messages, checks and files, come from GitHub on every call; `--max-age` applies to the rest.",
    ],
    flags: [format, detail, maxAge],
    example: "docket show example#12",
    exits: {
      0: "docket answered, even when the thread is over target.",
      2: readExits[2],
      3: "No data could be obtained from GitHub or the cache. show never answers from cached data alone, so it exits 3 during a rate limit or an outage.",
    },
  },
  {
    name: "config",
    arguments: "",
    answers:
      "Which settings are in effect for each watched repository, which file set each one, how each listed person is classified, and which account gh is signed in with.",
    notes: [
      "The personal file is `docket/docket.yaml` in `$XDG_CONFIG_HOME`, or `~/.config` when it is unset.",
    ],
    flags: [format],
    example: "docket config --format llm",
    exits: {
      0: "The settings are valid and gh is signed in.",
      2: "gh is not installed or not signed in, or the personal configuration is invalid; the output says which.",
      3: "GitHub could not be reached to say which account gh is signed in with; the output says why.",
    },
  },
];

export default catalogue;
