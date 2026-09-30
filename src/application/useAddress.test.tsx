import { describe, expect, it } from "vitest";
import { draw } from "../testing/terminal.js";
import useAddress, {
  type UseAddressProps,
  type UseAddressResult,
} from "./useAddress.js";

let address: UseAddressResult | undefined;

const day = { amount: 24, unit: "h" } as const;
const week = { amount: 1, unit: "w" } as const;

/** Prints where the screen is, as the header names it. */
function Placed(props: UseAddressProps) {
  address = useAddress(props);
  const { title, address: grouping } = address.header;
  return (
    <text>{[title.text, grouping?.text ?? "no address"].join(" | ")}</text>
  );
}

const opening: UseAddressProps = {
  mode: "owed",
  owedGrouping: "none",
  windows: [day, week],
  stacks: true,
};

describe("useAddress", () => {
  it("opens on the mode and grouping the call names", async () => {
    const screen = await draw(
      <Placed {...opening} owedGrouping="owner" />,
      40,
      1,
    );
    expect(screen.lines).toEqual(["owed | by owner"]);
  });

  it("steps owed through its groupings, after the last the first", async () => {
    const screen = await draw(<Placed {...opening} />, 40, 1);
    const seen: string[] = [];
    for (const _ of [1, 2, 3, 4]) {
      seen.push((await screen.redraw(() => address?.nextGrouping())).lines[0]);
    }
    expect(seen).toEqual([
      "owed | by owner",
      "owed | by repo",
      "owed | by stack",
      "owed | no address",
    ]);
  });

  it("leaves by stack out without stacks, and opens a call naming it on the first grouping", async () => {
    const screen = await draw(
      <Placed {...opening} owedGrouping="stack" stacks={false} />,
      40,
      1,
    );
    expect(screen.lines).toEqual(["owed | no address"]);
    await screen.redraw(() => address?.nextGrouping());
    const after = await screen.redraw(() => address?.nextGrouping());
    expect(after.lines).toEqual(["owed | by repo"]);
    expect((await screen.redraw(() => address?.nextGrouping())).lines).toEqual([
      "owed | no address",
    ]);
  });

  it("keeps each mode's grouping, and steps activity's own groupings and windows", async () => {
    const screen = await draw(<Placed {...opening} />, 40, 1);
    const press = async (key: () => void) => (await screen.redraw(key)).lines;
    await press(() => address?.nextGrouping());
    expect(await press(() => address?.setMode("activity"))).toEqual([
      "activity | 24h · by kind",
    ]);
    await press(() => address?.nextGrouping());
    expect(await press(() => address?.nextWindow())).toEqual([
      "activity | 1w · by repo",
    ]);
    await press(() => address?.nextWindow());
    expect(await press(() => address?.setMode("owed"))).toEqual([
      "owed | by owner",
    ]);
    expect(await press(() => address?.setMode("activity"))).toEqual([
      "activity | 24h · by repo",
    ]);
  });

  it("opens activity on the window and grouping the call names", async () => {
    const screen = await draw(
      <Placed
        {...opening}
        mode="activity"
        activity={{ window: week, grouping: "none" }}
      />,
      40,
      1,
    );
    expect(screen.lines).toEqual(["activity | 1w"]);
  });
});
