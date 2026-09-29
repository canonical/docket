/**
 * The most lines the accordion takes, content past it cut with `…`: a
 * long comment never takes the pane, and at 40 columns a row and its
 * accordion take at most 11 of the list's 32 lines.
 */
export const accordionMaxLines = 8;

/**
 * The most cells an owner takes on a row, so the title keeps its room. A
 * longer owner is cut with `…`; the accordion shows a person's login
 * whole, and a team's name stays cut.
 */
export const loginCells = 12;

/**
 * The narrowest terminal docket draws its screen in, in display cells.
 * Every line of the screen is designed to fit it; below it, the pane
 * shows only a line saying so, and no key but `q` acts.
 */
export const minColumns = 40;
