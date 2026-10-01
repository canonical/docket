import { describe, expect, it } from "vitest";
import countPickerLines from "./countPickerLines.js";
import {
  Assigning,
  Loading,
  Long,
  Refused,
  Scrolled,
} from "./PeoplePicker.stories.js";

describe("countPickerLines", () => {
  it("counts the filter and each option", () => {
    expect(countPickerLines(Assigning.args)).toBe(5);
  });

  it("counts five options at most", () => {
    expect(countPickerLines(Scrolled.args)).toBe(6);
  });

  it("counts every line of an option whose name wraps", () => {
    expect(countPickerLines(Long.args)).toBe(5);
    expect(countPickerLines({ ...Long.args, width: 80 })).toBe(3);
  });

  it("counts a name at the width it is drawn at, inside the picker's indent", () => {
    const owner = {
      text: "a".repeat(35),
      kind: "person" as const,
      group: "outside" as const,
    };
    expect(
      countPickerLines({
        ...Assigning.args,
        options: [{ owner, ticked: false }],
        cursor: 0,
      }),
    ).toBe(3);
  });

  it("counts the loading line while the options are read", () => {
    expect(countPickerLines(Loading.args)).toBe(2);
  });

  it("counts only the filter when nothing matches", () => {
    expect(countPickerLines({ ...Assigning.args, options: [] })).toBe(1);
  });

  it("counts the notice's lines as they wrap at the width", () => {
    expect(countPickerLines(Refused.args)).toBe(7);
    expect(countPickerLines({ ...Refused.args, width: 80 })).toBe(5);
  });
});
