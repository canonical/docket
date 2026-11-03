import { describe, expect, it } from "vitest";
import { draw, hex } from "../../../../testing/terminal.js";
import { tokens } from "../../../tokens/index.js";
import CountsLine from "./CountsLine.js";
import { Activity, NothingOwed, Owed } from "./CountsLine.stories.js";

describe("CountsLine", () => {
  it("states owed's counts, and the position against the right edge, in the text colour at 40 columns", async () => {
    const screen = await draw(<CountsLine {...Owed.args} />, 40);
    expect(screen.lines.at(0)).toBe(
      `3 over · 2 soon · 6 on track${" ".repeat(6)}3/4/11`,
    );
    expect(screen.look("3 over")).toMatchObject({
      fg: hex(tokens["color.text"]),
      bold: false,
    });
    expect(screen.look("3/4/11")?.fg).toBe(hex(tokens["color.text"]));
  });

  it("states activity's counts whole and the position at the edge at 60 columns", async () => {
    const screen = await draw(<CountsLine {...Activity.args} width={60} />, 60);
    expect(screen.lines.at(0)).toBe(
      `9 threads · 23 events${" ".repeat(36)}1/9`,
    );
  });

  it("states the counts alone when nothing is listed", async () => {
    const screen = await draw(<CountsLine {...NothingOwed.args} />, 40);
    expect(screen.lines.at(0)).toBe("0 over · 0 soon · 0 on track");
  });

  it("leaves the counts out whole from the least urgent, never cutting a word, keeping the position's cells", async () => {
    const counts = (width: number) =>
      draw(
        <CountsLine
          summary={{
            fields: [
              { text: "120 over", kind: "words" },
              { text: "45 soon", kind: "words" },
              { text: "300 on track", kind: "words" },
            ],
          }}
          position={{ text: "1/120/465", kind: "figure" }}
          width={width}
        />,
        width,
      );
    expect((await counts(40)).lines.at(0)).toBe(
      `120 over · 45 soon${" ".repeat(13)}1/120/465`,
    );
    // Exactly the room the two parts and the position need keeps both.
    expect((await counts(28)).lines.at(0)).toBe("120 over · 45 soon 1/120/465");
    expect((await counts(27)).lines.at(0)).toBe(
      `120 over${" ".repeat(10)}1/120/465`,
    );
    expect((await counts(17)).lines.at(0)).toBe(`${" ".repeat(8)}1/120/465`);
    const alone = await draw(
      <CountsLine {...NothingOwed.args} width={12} />,
      12,
    );
    expect(alone.lines.at(0)).toBe("0 over");
  });
});
