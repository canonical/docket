import type { Format } from "./types.js";

/**
 * The format of an answer when `--format` does not name one: plain text
 * for a person at a terminal, condensed Markdown for an agent when the
 * output is piped or captured.
 */
export default function chooseFormat(interactive: boolean): Format {
  return interactive ? "plain" : "llm";
}
