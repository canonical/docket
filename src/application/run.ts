import { createCache, locateCacheDirectory } from "../lib/cache/index.js";
import { readPersonalFile, resolveSettings } from "../lib/config/index.js";
import {
  chooseExitCode,
  chooseFormat,
  type Format,
  type Problem,
  renderHelp,
  renderProblems,
} from "../lib/text/index.js";
import answerActivity from "./answerActivity.js";
import answerConfig from "./answerConfig.js";
import answerFinished from "./answerFinished.js";
import answerOwed from "./answerOwed.js";
import answerShow from "./answerShow.js";
import answerTerminal from "./answerTerminal.js";
import answerWrite from "./answerWrite.js";
import chooseActivityAddress from "./chooseActivityAddress.js";
import chooseOwedGrouping from "./chooseOwedGrouping.js";
import chooseTerminalMode from "./chooseTerminalMode.js";
import describeFailure from "./describeFailure.js";
import isNamedError from "./isNamedError.js";
import parseArguments from "./parseArguments.js";
import readRepositoryFiles from "./readRepositoryFiles.js";
import type { Connection, Context, Session } from "./types.js";

const answers = {
  owed: answerOwed,
  activity: answerActivity,
  finished: answerFinished,
  show: answerShow,
  assign: answerWrite,
  review: answerWrite,
} as const;

/**
 * Answers one call of docket: parses it, reads the personal file, asks gh
 * for a token, and answers the command from the shared cache, which also
 * holds each watched repository's own file. In a terminal, `docket` alone
 * and `docket owed` without `--format` open the terminal interface
 * instead, on owed at `--by`'s grouping, and `docket activity` without
 * `--format` on activity; a missing prerequisite then shows there rather
 * than as text.
 * Text mode never refreshes in the background: it fetches only when the
 * cached data is older than `--max-age`.
 *
 * @returns The exit code: 0 when docket answered, 2 when a prerequisite
 * is missing or the call is not valid, 3 when no data could be obtained,
 * a change was refused, or a failure no code names stopped it. Every
 * stop prints a named code and a recovery step.
 *
 * @note Impure: reads the personal file, asks gh for a token, reads and
 * writes the cache, asks GitHub, and writes the answer or hands the
 * terminal to the interface until it is closed.
 */
export default async function run(context: Context): Promise<number> {
  let format: Format = chooseFormat(context.interactive);
  // The first problem decides the exit code.
  const stop = (problems: readonly [Problem, ...Problem[]]) => {
    context.writeError(renderProblems(problems, format));
    const [{ code }] = problems;
    return chooseExitCode(code);
  };
  try {
    const request = parseArguments(context.args, context.interactive);
    if (request.kind === "help") {
      context.write(renderHelp(request.command));
      return 0;
    }
    if (request.kind === "version") {
      context.write(`${context.version}\n`);
      return 0;
    }
    const { invocation } = request;
    format = invocation.format;
    const personal = await readPersonalFile(context.environment);
    if (personal.outcome?.ok === false) return stop(personal.outcome.errors);
    const resolved = resolveSettings(personal.outcome?.layer, undefined);
    const { settings } = resolved;
    // The provider gh's token opens, with the cache on it, or why gh gave
    // no token.
    let connection: Connection | Problem;
    try {
      const provider = await context.connect(
        settings.hosts.at(0) ?? "github.com",
      );
      const cache = createCache({
        provider,
        repos: settings.repos.map(({ repo }) => repo),
        directory: locateCacheDirectory(context.environment),
        now: context.now,
      });
      connection = { provider, cache };
    } catch (error) {
      if (!isNamedError(error)) throw error;
      const { code, message, recovery } = error;
      connection = { code, message, recovery };
    }
    if (invocation.command === "config") {
      return await answerConfig(
        context,
        invocation,
        personal,
        resolved,
        connection,
      );
    }
    const mode = chooseTerminalMode(context, invocation);
    if (mode) {
      // The interface opens where the call would print, and a window or
      // grouping activity lacks stops the call before it opens.
      const activity =
        mode === "activity"
          ? chooseActivityAddress(settings.activity, invocation)
          : undefined;
      return await answerTerminal(
        context,
        mode,
        chooseOwedGrouping(invocation),
        invocation.maxAge,
        personal.outcome?.layer,
        settings,
        connection,
        activity,
      );
    }
    if ("code" in connection) return stop([connection]);
    const { provider, cache } = connection;
    const files = await readRepositoryFiles(
      cache,
      invocation.maxAge,
      personal.outcome?.layer,
      settings.repos,
    );
    const session: Session = {
      context,
      invocation,
      personal,
      resolved,
      watched: files.watched,
      provider,
      cache,
      describeFreshness: (syncedAt, warnings = []) => ({
        now: context.now(),
        syncedAt,
        timezone: settings.time.timezone,
        warnings: [...files.warnings, ...warnings],
      }),
    };
    return await answers[invocation.command](session);
  } catch (error) {
    return stop([describeFailure(error)]);
  }
}
