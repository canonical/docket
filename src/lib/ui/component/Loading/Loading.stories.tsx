import type { Meta, Story } from "../../../../testing/stories.js";
import Loading from "./Loading.js";
import type { LoadingProps } from "./types.js";

const meta: Meta<LoadingProps> = {
  title: "component/Loading",
  component: Loading,
};

export default meta;

/** A windowed mode while the cache reads its window. */
export const Reading: Story<LoadingProps> = {
  args: {
    label: { text: "refresh in progress…", kind: "words" },
    width: 38,
  },
};

/** The longest line the list area gives a read that is under way. */
export const Long: Story<LoadingProps> = {
  args: {
    label: { text: "refresh in progress…", kind: "words" },
    width: 38,
  },
};
