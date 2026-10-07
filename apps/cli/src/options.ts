import { InvalidArgumentError } from 'commander';

/**
 * What a flag's value has to be, read once where the command line is declared. A value that is not one is refused
 * there, saying what it takes — never turned into a default the person did not ask for, which is how a typo used to
 * check a page at no width at all and say nothing.
 */

const MIN_WIDTH = 320;
const MAX_WIDTH = 3840;

/** A viewport width: a whole number of pixels, from a small phone to a 4K screen. */
export const width = (value: string): number => {
  const parsed = Number(value.trim());
  if (!Number.isInteger(parsed) || parsed < MIN_WIDTH || parsed > MAX_WIDTH) {
    throw new InvalidArgumentError(
      `A width is a whole number of pixels from ${String(MIN_WIDTH)} to ${String(MAX_WIDTH)}: 1440 or 390.`
    );
  }

  return parsed;
};

/** Widths separated by commas, each once, in the order given. */
export const widths = (value: string): number[] => [...new Set(value.split(',').map(width))];

/** A whole number from 1: a height in pixels, a count, milliseconds. */
export const positiveInteger = (value: string): number => {
  const parsed = Number(value.trim());
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new InvalidArgumentError('It takes a whole number from 1.');
  }

  return parsed;
};

/** A whole number from 0: how many of something are allowed. */
export const count = (value: string): number => {
  const parsed = Number(value.trim());
  if (value.trim() === '' || !Number.isInteger(parsed) || parsed < 0) {
    throw new InvalidArgumentError('It takes a whole number from 0.');
  }

  return parsed;
};

/** A field filled before a click: its element's id, and what goes in it. */
export interface FieldFill {
  element: string;
  value: string;
}

/** `--fill <id>=<value>`, once per field, in the order given: the value is everything after the first `=`. */
export const fill = (value: string, previous: readonly FieldFill[] | undefined): FieldFill[] => {
  const at = value.indexOf('=');
  const element = at === -1 ? '' : value.slice(0, at).trim();
  if (element === '') {
    throw new InvalidArgumentError('A field is filled as <id>=<value>: --fill newsletter-email=ana@example.com.');
  }

  return [...(previous ?? []), { element, value: value.slice(at + 1) }];
};
