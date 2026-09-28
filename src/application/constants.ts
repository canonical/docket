/**
 * How many threads' details one read asks for at most. GitHub charges a
 * query by the lists it could return, a hundred to the point; a pull
 * request's details need about ten, so fourteen threads cost one point
 * and fifteen two.
 */
export const detailWindow = 14;

/**
 * How many points an hour reading details may spend: 300, 6% of GitHub's
 * hourly 5,000. Once they are spent, only the selected thread's details
 * are read until the hour is over, and the status line says so.
 */
export const detailBudgetPerHour = 300;
