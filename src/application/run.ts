import { createCache, locateCacheDirectory } from "../lib/cache/index.js";
import { readPersonalFile, resolveSettings } from "../lib/config/index.js";
import type { Provider } from "../lib/provider/index.js";
import {
  chooseExitCode,
  type Format,
  type Problem,
  renderHelp,
  renderProblems,
} from "../lib/text/index.js";
import answerActivity from "./answerActivity.js";
import answerConfig from "./answerConfig.js";
import answerOwed from "./answerOwed.js";
import answerShow from "./answerShow.js";
import isNamedError from "./isNamedError.js";
import parseArguments from "./parseArguments.js";
import type { Context, Session } from "./types.js";

const answers = {
  owed: answerOwed,
  activity: answerActivity,
  show: answerShow,
} as const;

/**
 * Answers one call of docket in text: parses it, reads the personal file,
 * asks gh for a token, and answers the command from the shared cache.
 * Text mode never refreshes in the background: it fetches only when the
 * cached data is older than `--max-age`.
 *
 * @returns The exit code: 0 when docket answered, 2 when a prerequisite
 * is missing or the call is not valid, 3 when no data could be obtained
 * or a change was refused.
 */
export default async function run(context: Context): Promise<number> {
  let format: Format = context.interactive ? "plain" : "llm";
  const stop = (problems: readonly Problem[]) => {
    context.writeError(renderProblems(problems, format));
    return chooseExitCode(problems.at(0)?.code ?? "USAGE_INVALID_VALUE");
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
    // The provider gh's token opens, or why gh gave no token.
    let connection: Provider | Problem;
    try {
      connection = await context.connect(settings.hosts.at(0) ?? "github.com");
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
    if ("code" in connection) return stop([connection]);
    const provider = connection;
    const cache = createCache({
      provider,
      repos: settings.repos.map(({ repo }) => repo),
      directory: locateCacheDirectory(context.environment),
      now: context.now,
    });
    const session: Session = {
      context,
      invocation,
      personal,
      resolved,
      provider,
      cache,
      describeFreshness: (syncedAt, warnings = []) => ({
        now: context.now(),
        syncedAt,
        timezone: settings.time.timezone,
        warnings,
      }),
    };
    return await answers[invocation.command](session);
  } catch (error) {
    if (!isNamedError(error)) throw error;
    const { code, message, recovery } = error;
    return stop([{ code, message, recovery }]);
  }
}
