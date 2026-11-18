/** How many of `values` each one is: the work a process holds, counted by the environment each piece is for. */
export const tally = (values: Iterable<string>): Record<string, number> => {
  const counted: Record<string, number> = {};
  for (const value of values) {
    counted[value] = (counted[value] ?? 0) + 1;
  }

  return counted;
};
