/** Whether a field holds nothing anybody gave it: `0` is a value, an unchecked box is not. */
export const isBlankValue = (value: unknown): boolean =>
  value === undefined || value === null || value === '' || value === false;
