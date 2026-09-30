import type { Meta, Story } from "../../../../testing/stories.js";
import { GroupHeading } from "../../component/index.js";
import type { ListBlock } from "../../types.js";
import ScrolledList from "./ScrolledList.js";
import type { ScrolledListProps } from "./types.js";

const meta: Meta<ScrolledListProps> = {
  title: "layout/ScrolledList",
  component: ScrolledList,
};

export default meta;

const width = 40;

/** A group's heading as a block of the list. */
const makeHeading = (text: string, group?: "team"): ListBlock => {
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
const makeRow = (name: string): ListBlock => ({
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
  makeHeading("bob", "team"),
  makeRow("first of bob's"),
  makeRow("second of bob's"),
  makeRow("third of bob's"),
  makeHeading("unassigned"),
  makeRow("first unassigned"),
];

/**
 * The top of the list: its first heading in its place, nothing pinned,
 * and the rows under the pane counted on its last line.
 */
export const Top: Story<ScrolledListProps> = {
  args: { blocks, from: 1, to: 1, height: 6, onShown: () => {}, width },
};

/**
 * Scrolled to bob's third row: his heading pinned above his second, with
 * where the rows shown start among his three, and the unassigned row
 * under the pane counted.
 */
export const Pinned: Story<ScrolledListProps> = {
  args: { ...Top.args, from: 3, to: 3, first: 2 },
};
