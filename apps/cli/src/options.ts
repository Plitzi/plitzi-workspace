import { InvalidArgumentError } from 'commander';

import { SCHEMES } from './browser';

import type { Scheme } from './browser';
import type { Command } from 'commander';

/**
 * What a flag's value has to be, read once where the command line is declared. A value that is not one is refused
 * there, saying what it takes — never turned into a default the person did not ask for, which is how a typo used to
 * check a page at no width at all and say nothing.
 */

/**
 * A value that is another option: the one this option takes went missing — an empty shell variable, the words of a
 * loop out of order. encore-4's `page shot /design 390 dark pixels-brand-row --width --scheme --clip` was told only
 * that a width is a whole number, five times.
 */
const refuseOption = (value: string): void => {
  if (/^--?[a-z]/i.test(value.trim())) {
    throw new InvalidArgumentError(
      `${value.trim()} is the next option, not a value: each option's value goes right after it (--width 1440 --scheme dark) — a shell variable left empty drops it.`
    );
  }
};

const MIN_WIDTH = 320;
const MAX_WIDTH = 3840;

/** A viewport width: a whole number of pixels, from a small phone to a 4K screen. */
export const width = (value: string): number => {
  refuseOption(value);
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

const isScheme = (value: string): value is Scheme => (SCHEMES as readonly string[]).includes(value);

/** Schemes separated by commas, each once: a picture of each, as `--width` takes several. */
export const schemes = (value: string): Scheme[] => {
  refuseOption(value);

  return [
    ...new Set(
      value.split(',').map(each => {
        const scheme = each.trim();
        if (!isScheme(scheme)) {
          throw new InvalidArgumentError(`A scheme is ${SCHEMES.join(' or ')} — or both: light,dark.`);
        }

        return scheme;
      })
    )
  ];
};

/** A whole number from 1: a height in pixels, a count, milliseconds. */
export const positiveInteger = (value: string): number => {
  refuseOption(value);
  const parsed = Number(value.trim());
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new InvalidArgumentError('It takes a whole number from 1.');
  }

  return parsed;
};

const MAX_SCALE = 4;

/** A picture's zoom: device pixels a CSS pixel, 1 to 4. */
export const scale = (value: string): number => {
  refuseOption(value);
  const parsed = Number(value.trim());
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_SCALE) {
    throw new InvalidArgumentError(`A scale is a whole number from 1 to ${String(MAX_SCALE)}: --scale 3.`);
  }

  return parsed;
};

/** An HTTP status, `404`: three digits, 100 to 599. */
export const statusCode = (value: string): number => {
  refuseOption(value);
  const parsed = Number(value.trim());
  if (!Number.isInteger(parsed) || parsed < 100 || parsed > 599) {
    throw new InvalidArgumentError('A status is an HTTP code, 100 to 599: --status 404.');
  }

  return parsed;
};

/** A time zone the browser knows (IANA): refused here, by name, rather than by the browser mid-check. */
export const timeZone = (value: string): string => {
  refuseOption(value);
  const zone = value.trim();
  try {
    Intl.DateTimeFormat('en', { timeZone: zone });
  } catch {
    throw new InvalidArgumentError(`"${zone}" is no time zone: an IANA name, --timezone America/Mexico_City.`);
  }

  return zone;
};

const UNITS = { s: 1000, m: 60_000, h: 3_600_000 } as const;

const isUnit = (unit: string): unit is keyof typeof UNITS => Object.hasOwn(UNITS, unit);

/**
 * How long to wait, in milliseconds: `90s`, `8m`, `1h`, or a bare number as minutes — what every `--timeout` of a run
 * has always taken. From a second to a day.
 */
export const duration = (value: string): number => {
  const match = /^(\d+(?:\.\d+)?)\s*([smh]?)$/.exec(value.trim());
  const unit = match?.[2] ?? '';
  const ms = match ? Number(match[1]) * (isUnit(unit) ? UNITS[unit] : UNITS.m) : NaN;
  if (!Number.isFinite(ms) || ms < 1000 || ms > 86_400_000) {
    throw new InvalidArgumentError('It takes a duration from 1s to 24h: 90s, 8m, 1h, or a number of minutes.');
  }

  return Math.round(ms);
};

/** A duration as a person reads it: `45 s`, `1 min 30 s`, `8 min`, `1 h 30 min`. */
/**
 * How long a command that waits (`task next --follow`, `run watch --until lead`, `task wait`) waits when not told: under
 * the ten minutes a harness gives one command (Claude Code's), so the agent hears it end rather than losing it to the
 * background — and runs it again to go on waiting.
 */
// Eight, not nine: a minute of margin for the command's own start and end (velada-dress's agents set --timeout 8m).
export const FOLLOW_MS = 8 * 60_000;

export const durationText = (ms: number): string => {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) {
    return `${String(seconds)} s`;
  }

  if (seconds < 600 && seconds % 60 !== 0) {
    return `${String(Math.floor(seconds / 60))} min ${String(seconds % 60)} s`;
  }

  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours === 0) {
    return `${String(minutes)} min`;
  }

  return minutes % 60 === 0 ? `${String(hours)} h` : `${String(hours)} h ${String(minutes % 60)} min`;
};

/** Names, comma-separated — `designer,reviewer` — each a role's: lowercase letters, digits, - and _. */
export const names = (value: string): string[] => {
  const each = value
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
  const wrong = each.filter(part => !/^[a-z][a-z0-9_-]{0,63}$/.test(part));
  if (each.length === 0 || wrong.length > 0) {
    throw new InvalidArgumentError(
      `"${value}": names, comma-separated — developer or designer,reviewer (lowercase letters, digits, - and _).`
    );
  }

  return [...new Set(each)];
};

/** Pages by path, comma-separated — `/,/pricing` — each starting with `/`. */
export const pagePaths = (value: string): string[] => {
  const each = value
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
  const wrong = each.filter(part => !part.startsWith('/'));
  if (each.length === 0 || wrong.length > 0) {
    throw new InvalidArgumentError(`"${value}": pages by path, comma-separated — /,/menu (each starts with /).`);
  }

  return [...new Set(each)];
};

/** A share between 0 and 1: how far along a task is. */
export const fraction = (value: string): number => {
  const parsed = Number(value.trim());
  if (value.trim() === '' || !Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new InvalidArgumentError('It takes a number between 0 and 1: 0.6 is 60 %.');
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

/** `--expect <id>~<text>`, once per element: the element shows the text. */
/**
 * What an element shows, expected: `<id>~<text>`, or `<path> <id>~<text>` for one page of several — the path its own
 * word, a leading `/`: `--expect "/faq faq-title~Questions"`.
 */
/**
 * One `--expect` read: `<id>~<text>`, `<id>` alone — the element is shown, whatever it says (a swatch, a picture: encore's
 * design-2 wrote `id~`) — and `<path> …` for one page. Nothing when it is none of them. What the option and a plan's
 * acceptance lines (`expectedIds`) both read.
 */
export const readExpectation = (value: string): { element: string; text: string; path?: string } | undefined => {
  const scoped = /^(\/\S*)\s+(.*)$/s.exec(value);
  const rest = scoped?.[2] ?? value;
  const at = rest.indexOf('~');
  const element = (at === -1 ? rest : rest.slice(0, at)).trim();
  const text = at === -1 ? '' : rest.slice(at + 1);

  return element === '' || element.startsWith('/') || /\s/.test(element) || (at !== -1 && text === '')
    ? undefined
    : { element, text, ...(scoped?.[1] ? { path: scoped[1] } : {}) };
};

export const expectation = (
  value: string,
  previous: readonly { element: string; text: string; path?: string }[] | undefined
): { element: string; text: string; path?: string }[] => {
  const read = readExpectation(value);
  if (!read) {
    throw new InvalidArgumentError(
      'What an element shows is expected as <id>~<text> — or <id> alone for "it is shown" — and <path> <id~text> for one page: --expect "/walks walks-title~October".'
    );
  }

  return [...(previous ?? []), read];
};

/**
 * A flag that took the next flag as its value — `--summary --token …`, `--summary` reading "--token" — said, with
 * what it takes: commander takes it whole, and the run read the token as the run (lx-controls' lead, twice).
 */
export const swallowedFlag = (command: Command): string | undefined => {
  const flags = new Set(command.options.flatMap(option => (option.long ? [option.long] : [])));
  const swallowed = command.options.find(option => {
    const value: unknown = command.getOptionValue(option.attributeName());

    return option.required && typeof value === 'string' && flags.has(value);
  });

  return swallowed
    ? `${swallowed.long ?? swallowed.flags} takes a value and read ${String(command.getOptionValue(swallowed.attributeName()))} as it: ${swallowed.flags}`
    : undefined;
};
