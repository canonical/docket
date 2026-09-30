import type { Meta, Story } from "../../../../testing/stories.js";
import { GroupHeading } from "../../component/index.js";
import ScrolledList from "./ScrolledList.js";
import type { ListBlock, ScrolledListProps } from "./types.js";

const meta: Meta<ScrolledListProps> = {
  title: "layout/ScrolledList",
  component: ScrolledList,
};

export default meta;

const width = 40;

/** A group's heading as a block of the list. */
const heading = (text: string, group?: "team"): ListBlock => {
  const named = group
    ? { text, fit: "trimmed" as const, group }
    : { text, fit: "trimmed" as const };
  return {
    key: text,
    kind: "heading",
    lines: 1,
    node: <GroupHeading heading={named} width={width} />,
    heading: named,
  };
};

/** A row of two lines as a block of the list. */
const row = (name: string): ListBlock => ({
  key: name,
  kind: "row",
  lines: 2,
  node: (
    <>
      <text>{`│ ${name}`}</text>
      <text>{"╵ a thread"}</text>
    </>
  ),
});

const blocks = [
  heading("bob", "team"),
  row("first of bob's"),
  row("second of bob's"),
  row("third of bob's"),
  heading("unassigned"),
  row("first unassigned"),
];

/** The top of the list: its first heading in its place, nothing pinned. */
export const Top: Story<ScrolledListProps> = {
  args: { blocks, from: 1, to: 1, height: 6, onShown: () => {}, width },
};

/**
 * Scrolled to bob's third row: his heading pinned above his second, with
 * where the rows shown start among his three.
 */
export const Pinned: Story<ScrolledListProps> = {
  args: { ...Top.args, from: 3, to: 3, first: 2 },
};
