# docket

A friend for SLA-driven OSS maintainers.

docket tells you who is waiting on your team, and for how long. It reads the open issues, pull requests and discussions of the GitHub repositories you watch, and works out whether the team owes a reply, a review or a close. Each wait is measured against the target you set, in working time only, so a weekend doesn't eat into a two-day review target.

You can keep it open in a terminal, where it refreshes itself as you work, or call it from a script or an LLM agent and read its answer as text. It talks to GitHub through the `gh` CLI you're already signed in to, and it changes nothing there unless you ask it to.

## Install

You need:

- [Bun](https://bun.sh) 1.4.2 or later
- the [GitHub CLI](https://cli.github.com), signed in with `gh auth login`
- Linux or macOS

<!-- verify at release -->
```sh
bun add -g @canonical/docket
docket --version
```

Bun puts the `docket` command in its global folder (`~/.bun/bin` by default), so make sure that folder is on your `PATH`. docket is TypeScript that Bun runs directly: there is no binary to download.

docket works with github.com. It asks `gh auth token` for a token each time it runs, and never stores it.

## Getting started

Create your personal file at `~/.config/docket/docket.yaml` (or `$XDG_CONFIG_HOME/docket/docket.yaml`), listing the repositories you watch and who is on the team:

```yaml
version: 1

repos:
  example:
    repo: example-org/example-repo

people:
  alice: team
  bob: team

time:
  timezone: Europe/Paris
```

`example` is the short name you'll use for the repository, as in `example#12`. The `people` list matters: docket knows a reply is owed because someone outside the team spoke last, so without it every comment starts a wait, your own included.

Check what docket made of the file:

```sh
docket config
```

It prints the settings in effect for each repository, the file each one came from, and the account `gh` is signed in with. If something in the file is wrong, it names the problem and how to fix it.

Then open docket:

```sh
docket
```

The first run reads each repository from GitHub and shows its progress. Then you land on owed, most overdue first:

```text
owed                                one list · overdue first
┃┆example#12 PR reply ○ dave                         4d over
┃┆Fix the parser                           ✗ checks  ◉ alice
┃┆○ dave · 3d ago
┃┆Rebased on main. Could someone look again?
┃┆waiting since Mon 10:00 · target 24h
┃┆example stack 3 · 2 of 3 · → main
╹┆below #11 merged, above #13 open
┃┆example#12 PR close ○ dave                         2h over
╹┆Fix the parser                           ✗ checks  ◉ alice
┃ example#15 issue reply ◐ carol                     4h left
╹ Crash on start                                  unassigned
│ docs#4 issue close ◉ alice                        10d left
│ Where do tokens live?
╵                                             ◉ alice, ● bob
│┆example#12 PR review ○ dave                        1d left
╵┆Fix the parser                             ✗ checks  ● bob
│ example#15 issue close ◐ carol                    29d left
╵ Crash on start                                  unassigned

2 over · 1 soon · 3 on track                             1/6
synced 2m ago
←→ mode ↑↓ sel ⏎ open g grp a r ?
```

Move through the list with `↑` and `↓`. The selected thread opens under its row, with its latest message and when the wait started. `⏎` opens it in your browser, `→` moves to the next mode, and `?` lists every key.

If `gh` is missing or signed out, docket opens on a setup screen that names the problem and how to fix it.

<!-- verify at release -->
If GitHub refuses the token while docket is open, the screen turns to setup too. Run `gh auth login` in another pane, and it comes back as you left it.

## Three modes

### owed: who is waiting on us?

Every wait the team owes on an open thread:

- A **reply** is owed while someone outside the team has the last word. Any team member's message ends the wait, and bots neither start nor end one.
- A **review** is owed by each reviewer a pull request still asks for. Once they've reviewed, the author's next push starts the wait again.
- A **close** is owed from the day a thread opens until it closes.

Rows run most overdue first, as a share of each target, so a reply 12 hours over a 24-hour target ranks above a close 12 hours over a five-day one. Each row says where it stands: `4d over`, `10d left`, or `4h left, due soon` once less than a fifth of the target remains.

### activity: what happened while I was away?

Every comment, review, push, assignment, label and failed check on the watched threads within a time window, such as the last 24 working hours. Threads run newest first, with their events under them. Use it to catch up after time away, or to prepare a team sync.

### finished: what did we close, and on time?

The issues and pull requests merged or closed within a time window. Each shows its ending as GitHub words it, such as merged or closed as not planned, and whether it closed within its close target.

## Keys

| Key | What it does |
|---|---|
| `←` `→` or `h` `l` | Switch mode: owed, activity, finished |
| `↑` `↓` or `k` `j` | Move the selection, which opens the thread's details under its row |
| `PgUp` `PgDn` | Move a page up or down |
| `Home` `End` | Go to the first or last thread |
| `⏎` | Open the thread in the browser |
| `g` | Next grouping |
| `t` | Next time window, in activity and finished |
| `a` | Assign people, in owed and activity |
| `r` | Request reviews, in owed and activity |
| `R` | Full refresh |
| `?` | Show or hide the help |
| `esc` | Close the help |
| `q` | Quit |

`a` and `r` open a picker under the row. Type to filter, move with `↑` `↓`, tick with `space`, apply with `⏎`, or cancel with `esc`.

People carry a mark wherever they appear: `◉` you, `●` your team, `◐` your organisation, `○` outside, `■` a bot.

The terminal needs at least 40 columns and 8 lines.

## Text mode, for scripts and agents

When its output is piped or captured, or you pass `--format`, docket prints its answer and exits instead of opening the screen.

| Format | For | Notes |
|---|---|---|
| `plain` | people | The default in a terminal |
| `llm` | LLM agents | Condensed Markdown with whole titles and absolute times. The default when piped |
| `json` | programs | Fixed camelCase keys. A wait's `target` is in working hours |

In `llm` output, every title, login and comment from GitHub is marked as quoted data, so an agent can tell it from instructions.

```sh
docket owed --format plain
docket owed --by owner --format plain
docket activity --window 48h --format llm
docket finished --window 1w --by ending --format json
docket show example#12
```

`docket owed --format plain` prints a list like this one:

```text
owed
synced 0m ago
2 over · 1 soon · 3 on track

example#12 · reply · 4d over
  Fix the parser
  alice · checks failing · example stack 3, 2 of 3
example#12 · close · 2h over
  Fix the parser
  alice · checks failing · example stack 3, 2 of 3
example#15 · reply · 4h left, due soon
  Crash on start
  unassigned
docs#4 · close · 10d left
  Where do tokens live?
  alice, bob
example#12 · review · 1d left
  Fix the parser
  bob · checks failing · example stack 3, 2 of 3
example#15 · close · 29d left
  Crash on start
  unassigned
```

The flags you'll reach for most:

- `--by` splits the list into sections. owed takes `none`, `owner`, `kind`, `repo` or `stack`. activity takes `kind`, `repo` or `none`, and finished takes those and `ending`.
- `--window` picks one of your activity windows, for activity and finished.
- `--detail` is `summary` for the counts alone, `standard` for the usual rows, or `detailed` for every message, file and check.
- `--max-age <seconds>` is how old cached data may be before docket asks GitHub again. It defaults to 300, and `0` always fetches.

`show <reference>` prints everything about one open thread, untrimmed. `assign` and `review` set the assignees or the requested reviewers to exactly the people you name. They print the plan and change nothing until you repeat the call with `--confirm`:

```sh
docket assign example#12 alice bob
docket assign example#12 alice bob --confirm
docket review example#12 bob example-org/reviewers --confirm
```

`docket <command> --help` gives every flag, its default, an example and the exit codes:

| Code | Meaning |
|---|---|
| `0` | docket answered, even with threads over target, or from the cache during an outage |
| `2` | A prerequisite is missing, or the call itself is not valid |
| `3` | No data could be had, or GitHub refused a change |

Every error carries a stable code, such as `GH_NOT_SIGNED_IN`, and a `Recovery:` line.

## Configuration

docket reads two YAML files, and both start with `version: 1`.

Your **personal file**, `~/.config/docket/docket.yaml`, says which repositories you watch and how you like to work. A repository's own **`.github/docket.yaml`**, read from its default branch, records the team's practice, so everyone who watches that repository measures it the same way.

| Section | Personal file | `.github/docket.yaml` |
|---|---|---|
| `repos` | yes | |
| `people` | yes | yes |
| `time` | yes | yes |
| `targets` | yes | yes |
| `exempt` | yes | yes |
| `activity` | yes | |
| `you` | yes | |

For each repository, a section in its `.github/docket.yaml` wins over the same section in your personal file. Sections replace each other whole and never merge: whatever the winning section leaves out comes from the built-in defaults, not from the other file. So your personal file can't add someone to a repository's team.

If a repository's file has a mistake, that repository falls back to the built-in defaults for the four shared sections, and its rows are marked `✗ file`. If your personal file has one, docket stops and says what to fix.
`docket config` shows which file set each section, for each repository.

### repos

The repositories to watch, each under a short name made of letters, digits, `.`, `_` and `-`. The short name is what you type in references such as `example#12`.

```yaml
repos:
  example:
    repo: example-org/example-repo
  docs:
    repo: example-org/example-docs
```

### people

Each GitHub login and its group: `team`, `internal` for your organisation outside the team, `external` or `bot`. Logins ignore case.

```yaml
people:
  alice: team
  bob: team
  carol: internal
  example-sync: bot
```

Anyone you don't list is a `bot` if GitHub says it's a bot account, `internal` once your organisation marks them a member, and `external` otherwise. A bot never owns a wait.

### you

The GitHub teams you belong to, written `org/team-slug`. docket marks a review requested from one of them as yours. It needs the list because `gh`'s token can't always read team membership.

```yaml
you:
  teams: [example-org/maintainers]
```

### time

The days that count, and the time zone that decides where each day starts. Waits run through whole workdays and stand still on other days. On a Monday-to-Friday week, 24 hours from Friday at 16:00 runs out on Monday at 16:00.

```yaml
time:
  workdays: [mon, tue, wed, thu, fri]
  timezone: Europe/Paris
```

Days are `mon` to `sun`, and the time zone is an IANA name such as `Europe/Paris` or `UTC`. The defaults are Monday to Friday, in `UTC`.

### targets and exempt

How long each kind of wait may run before it's over target. A duration is a whole number followed by `h` for hours, `d` for working days or `w` for working weeks.

```yaml
targets:
  next-move:
    response: 24h
    review: 2d
  close:
    issue: 30d
    pull-request: 5d
    discussion: 14d

exempt:
  close: [on-hold, roadmap]
```

The targets above are the defaults. A thread with a label listed under `exempt.close` has no close target. No label is listed by default.

### activity

The time windows that activity and finished offer, which `t` and `--window` step through. The first is the default.

```yaml
activity: [24h, 48h, 72h, 1w]
```

Windows count working time too, so `24h` on a Monday morning reaches back to Friday morning.

### A repository's file

Here is `.github/docket.yaml` in `example-org/example-repo`:

```yaml
version: 1

people:
  alice: team
  bob: team

time:
  workdays: [mon, tue, wed, thu]
  timezone: America/New_York

targets:
  next-move:
    review: 1d
```

Everyone watching the repository gets these settings. Its reply target is the built-in `24h`, even if your personal file sets another.

## GitHub's request budget

docket keeps a fifth of GitHub's hourly request budget for you. Below that line, the terminal pauses its background refresh until the budget resets, and says so on the status line. Anything you ask for yourself still runs, such as opening a thread or a text-mode command. Once less than 40% is left, the status line and text mode show what remains, as `budget 35% · resets 14:20`.

## Licence

[MIT](LICENSE)
