import { activityGroupings } from "../activity/index.js";
import { finishedGroupings } from "../finished/index.js";
import { owedGroupings } from "../owed/index.js";
import { defaultDetail, details, formats } from "./constants.js";
import type { Command, Flag } from "./types.js";

const format: Flag = {
  name: "format",
  value: "format",
  choices: formats,
  fallback: "plain in a terminal, llm when the output is piped or captured",
  description:
    "How the answer is written: plain text for a person, condensed Markdown for an agent (llm), or JSON for a program. In JSON, every key, and every value docket names, such as a kind or a state, is a fixed camelCase identifier rather than an on-screen word: the configuration's `next-move` is `nextMove`. A wait's `target` is written in working hours, and its `overdue` is a share of it, so `overdue` times `target` is the working time past due, or left while negative.",
};

const detail: Flag = {
  name: "detail",
  value: "level",
  choices: details,
  default: defaultDetail,
  description:
    "How much each item shows: summary gives the counts alone, and detailed adds when each wait started and every message, file and check. A wait's target shows at detailed in plain and llm, and at every level in JSON.",
};

const maxAge: Flag = {
  name: "max-age",
  value: "seconds",
  default: "300",
  description:
    "How old the cached data may be before docket fetches from GitHub; 0 always fetches. A call is a request of your own, so it fetches even when less than a fifth of GitHub's hourly budget is left, the share docket keeps for your requests; only docket's own refreshing in the terminal interface stops then.",
};

const confirm: Flag = {
  name: "confirm",
  description:
    "Applies the change. Without it, docket prints the change it would make and changes nothing.",
};

const window: Flag = {
  name: "window",
  value: "window",
  fallback: "the first window in the configuration's `activity` list",
  description:
    "How far back the list reaches: one of the windows in the configuration's `activity` list, 24h, 48h, 72h and 1w unless it says otherwise.",
};

const readExits = {
  0: "docket answered, even when threads are over target, and also when it served cached data during a rate limit or an outage, with a warning.",
  2: "A prerequisite is missing: gh is not installed or not signed in, the personal configuration is invalid, or the call itself is not valid.",
  3: "No data could be obtained from GitHub or the cache.",
} as const;

const writeExits = {
  0: "docket printed the plan, or applied it, or found nothing to change.",
  2: readExits[2],
  3: "GitHub refused the change or applied only part of it, or no data could be obtained.",
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
      "In a terminal, with no `--format`, `docket owed` and `docket` alone open the terminal interface on owed, grouped as `--by` names; piped or captured, or given `--format`, they print the list.",
    ],
    flags: [
      {
        name: "by",
        value: "grouping",
        choices: owedGroupings,
        default: "none",
        description:
          "Splits the list into sections: by owner, by kind of thread (ISSUES, PULL REQUESTS, DISCUSSIONS), by repo, or by stack; a wait with two owners appears under each owner.",
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
      "In a terminal, with no `--format`, `docket activity` opens the terminal interface on activity; piped or captured, or given `--format`, it prints the list.",
    ],
    flags: [
      window,
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
    name: "finished",
    arguments: "",
    answers:
      "Which issues and pull requests were merged or closed within a time window and are still so, how each ended, and whether each closed within its target.",
    notes: [
      "Threads run by their ending, newest first. A thread closed more than once counts once, with its latest ending, and one reopened and open now is left out.",
      "An ending is written as GitHub writes it: merged, closed, closed as completed, closed as not planned or closed as duplicate. The counts give merged, closed for every other ending, and over for the threads that closed past their target.",
      "Windows count working time, as activity's do, and so does how long a thread was open, measured against the close target for its kind unless a label in `exempt.close` exempts it.",
      "In JSON, each thread carries its measures: time to close, and time to first reply and time to first review, which read `unsupported` because docket does not read each thread's timeline.",
      "In a terminal, with no `--format`, `docket finished` opens the terminal interface on finished; piped or captured, or given `--format`, it prints the list.",
    ],
    flags: [
      window,
      {
        name: "by",
        value: "grouping",
        choices: finishedGroupings,
        default: "kind",
        description:
          "Splits the list into sections: by kind of thread (ISSUES, PULL REQUESTS), by ending, as GitHub words it, by repo, or none.",
      },
      format,
      {
        ...detail,
        description:
          "How much each thread shows: summary gives the counts alone, and detailed adds when each thread ended, as a date and time, which llm and JSON always give. The close target shows at every level but summary.",
      },
      maxAge,
    ],
    example: "docket finished --window 1w --by ending",
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
    name: "assign",
    arguments: "<reference> <login>…",
    answers:
      "Sets the assignees of an issue or pull request to exactly the logins given, removing anyone else.",
    notes: [
      "The first call prints the plan, such as `add bob, remove alice`, and changes nothing; the same call with --confirm applies it.",
    ],
    flags: [confirm, format, maxAge],
    example: "docket assign example#12 alice bob --confirm",
    exits: writeExits,
  },
  {
    name: "review",
    arguments: "<reference> <login or org/team>…",
    answers:
      "Sets the reviews requested on a pull request to exactly the people and teams given, withdrawing any other request.",
    notes: [
      "A team is written `org/team`. The first call prints the plan and changes nothing; the same call with --confirm applies it.",
    ],
    flags: [confirm, format, maxAge],
    example: "docket review example#12 bob example-org/reviewers",
    exits: writeExits,
  },
  {
    name: "config",
    arguments: "",
    answers:
      "Which settings are in effect for each watched repository, which file set each one, how each listed person is classified, and which account gh is signed in with.",
    notes: [
      "The personal file is `docket/docket.yaml` in `$XDG_CONFIG_HOME`, or `~/.config` when it is unset.",
      "`you: { teams: [example-org/ui] }` in the personal file names the GitHub teams you belong to, each as its organisation and its slug, the name in the team's address on GitHub. The terminal interface marks each one yours on rows, owners' headings, the review picker and the status line after a request.",
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
