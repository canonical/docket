/**
 * How many threads' details one read asks for at most. GitHub charges a
 * query by the lists it could return, a hundred to the point, rounded: a
 * pull request's details ask for nine, so sixteen pull requests still
 * cost one point and seventeen cost two, and issues and discussions ask
 * for fewer. Fourteen stay at one point whatever the threads, with room
 * for a list more.
 */
export const detailWindow = 14;

/**
 * How often, in milliseconds, the selected thread's repository is checked
 * for changes while the pane is active: every 60 seconds, by the free
 * check, so the thread watched stays current and costs points only when
 * something changed. An idle pane stops it, which bounds it by attention.
 */
export const selectedThreadInterval = 60_000;

/**
 * How long, in milliseconds, the selection rests after a move before the
 * details near it are read, so moving through the list reads once, where
 * it stops.
 */
export const detailRest = 200;

/** The indent of what stands in for the list, in display cells. */
export const standInIndent = 2;
