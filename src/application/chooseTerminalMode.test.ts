import { describe, expect, it } from "vitest";
import chooseTerminalMode from "./chooseTerminalMode.js";
import parseArguments from "./parseArguments.js";

/** The mode a call opens on, with its input and output each a terminal or not. */
function modeOf(
  args: string[],
  interactive: boolean,
  interactiveInput: boolean,
) {
  const request = parseArguments(args, interactive);
  if (request.kind !== "command") throw new Error("the call is a command");
  return chooseTerminalMode(
    { interactive, interactiveInput },
    request.invocation,
  );
}

const terminals = [
  { interactive: true, interactiveInput: true, both: true },
  { interactive: true, interactiveInput: false, both: false },
  { interactive: false, interactiveInput: true, both: false },
  { interactive: false, interactiveInput: false, both: false },
] as const;

describe("chooseTerminalMode", () => {
  describe.each(terminals)(
    "with output a terminal: $interactive, input a terminal: $interactiveInput",
    ({ interactive, interactiveInput, both }) => {
      it("opens owed for docket alone only when both are terminals", () => {
        expect(modeOf([], interactive, interactiveInput)).toBe(
          both ? "owed" : undefined,
        );
      });

      it("opens owed for docket owed without --format, whatever its grouping, only when both are terminals", () => {
        for (const args of [["owed"], ["owed", "--by", "owner"]]) {
          expect(modeOf(args, interactive, interactiveInput)).toBe(
            both ? "owed" : undefined,
          );
        }
      });

      it("opens activity without --format only when both are terminals", () => {
        expect(modeOf(["activity"], interactive, interactiveInput)).toBe(
          both ? "activity" : undefined,
        );
        expect(
          modeOf(
            ["activity", "--window", "48h"],
            interactive,
            interactiveInput,
          ),
        ).toBe(both ? "activity" : undefined);
      });

      it("prints owed and activity as text whenever --format is given", () => {
        for (const command of ["owed", "activity"]) {
          for (const format of ["plain", "llm", "json"]) {
            expect(
              modeOf(
                [command, "--format", format],
                interactive,
                interactiveInput,
              ),
            ).toBeUndefined();
          }
        }
      });

      it("prints every other command as text", () => {
        for (const args of [["config"], ["show", "example#1"]]) {
          expect(modeOf(args, interactive, interactiveInput)).toBeUndefined();
        }
      });
    },
  );
});
