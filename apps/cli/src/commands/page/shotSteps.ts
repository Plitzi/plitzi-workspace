import {
  durationMs,
  E2E_STEP_USAGE,
  isE2eStepWord,
  leadingTarget,
  parseE2eStep,
  stepLines,
  unquoted
} from '@plitzi/sdk-authoring';
import { isRecord } from '@plitzi/sdk-shared/helpers';

import type { E2eStep } from '@plitzi/sdk-shared';

/**
 * `--steps`: what a person does to a page, one step after another, what must hold as it goes, and the pictures taken
 * along the way — a queue that fills, a restart, an opening watched frame by frame.
 *
 * Its steps are a journey's, as `@plitzi/sdk-authoring` writes them in words (`E2E_STEP_USAGE`: click, type, wait-for,
 * expect-text…) and plays them — a script that checks a page and a journey the space keeps say a step alike — and a
 * page command's own:
 *
 *   drag <element> <dx> [dy] hold  pressed, moved and kept down, so what follows reads the page mid-drag (a style only
 *                            a drag sets, the height a sheet follows): drag sheet-handle 0 -120 hold
 *   release                  the finger held by `drag … hold` let go where it is — a play that ends held lets go as
 *                            its page closes
 *   wait <ms|3s>             time passing
 *   store <key> <value>      a value put in the page's localStorage, as an earlier visit left it — then `reload`
 *   attribute <id>.<name> <json>  an element's attribute given a value, as a page binding it would — a plugin's new
 *                            one no page binds yet seen drawn: attribute map.storms '[{"id":"ARNAB"}]' (development pages)
 *   clock <instant>          the page's clock set to an ISO instant (needs `--clock`): 2026-10-25T20:00:00Z
 *   render <id> [json]       a render action run the way a page's render runs it — its real fetch, hosts and limits —
 *                            before any page uses it (a development server: npm run start:dev)
 *   action <id> [json]       one of the space's actions run as the page's visitor, through its /_action — the
 *                            server's data put in the state a step needs: action crate-hide '{"crate":"c1"}'
 *   at <width> <step>        the step played only at those widths — 390, <=767, >=768 — and passed over at the others:
 *                            --width 1440,390 --steps "at <=767 click sheet-tab-log; type log-search x", the tab a
 *                            phone opens first, where a wide screen shows the log already
 *   as <account> <step>      the step played by another account, signed in on a page of its own (the password in
 *                            PLITZI_CHECK_PASSWORD): as mika type dm-input hi; as mika press Enter — what another
 *                            person does, seen on this page
 *   shot [label]             a picture now
 *   frames <n> [ms]          n pictures, `--every` (or `ms`) apart
 *
 * Separated by `;` or a new line — one inside quotes is the text's: `type chat-input "late; still here"`; a line
 * starting with `#` is a note. An element is its name, a tag or a CSS selector, read whole up to a space outside quotes
 * and brackets — `[aria-label="Search the site"]` is one — or quoted; `ours => theirs` beside another site. Every picture
 * is labelled with its step and the time since the first step.
 */

/** A step one visitor plays on its own page: a journey's, or a page command's own — no picture, none another's. */
export type PageStep =
  | E2eStep
  | { kind: 'hold'; element: string; dx: number; dy: number }
  | { kind: 'release' }
  | { kind: 'wait'; ms: number }
  | { kind: 'store'; key: string; value: string }
  | { kind: 'attribute'; key: string; value: unknown }
  | { kind: 'clock'; time: number }
  | { kind: 'action'; action: string; input: Record<string, unknown>; render?: true };

/** The widths a step `at` plays at, both ends included. */
export interface WidthRange {
  min: number;
  max: number;
}

export type ShotStep =
  | PageStep
  | { kind: 'as'; account: string; step: PageStep }
  | { kind: 'at'; width: WidthRange; step: PageStep }
  | { kind: 'shot'; label?: string }
  | { kind: 'frames'; count: number; every: number };

/** A page command's own steps, as a script writes them: what a journey has not. */
const OWN_USAGE = [
  ['release', 'release'],
  ['wait', 'wait <ms|3s>'],
  ['store', 'store <key> <value>'],
  ['attribute', 'attribute <id>.<name> <json>'],
  ['clock', 'clock <instant>'],
  ['action', 'action <id> [json]'],
  ['render', 'render <id> [json]'],
  ['as', 'as <account> <step>'],
  ['at', 'at <widths> <step>'],
  ['shot', 'shot [label]'],
  ['frames', 'frames <n> [ms]']
] as const;

/**
 * Every step as a script writes it, in the order they are taught — a journey's, then a page command's own: the one list
 * the parser, its refusals and every command's `--steps` help are made from. A drag held is this command's.
 */
export const STEP_USAGE: readonly (readonly [string, string])[] = [
  ...E2E_STEP_USAGE.map(([name, usage]): readonly [string, string] =>
    name === 'drag' ? [name, 'drag <el> <dx> [dy] [hold]'] : [name, usage]
  ),
  ...OWN_USAGE
];

/** The steps as they are written, `; `-separated — but those a command does not play (`page play` takes no frames). */
export const stepsUsage = (without: readonly string[] = []): string =>
  STEP_USAGE.filter(([name]) => !without.includes(name))
    .map(([, usage]) => usage)
    .join('; ');

const STEP_NAMES = STEP_USAGE.map(([name]) => name);

/** The longest a script may wait in one step: a page that needs more is waiting for something else. */
const MAX_WAIT_MS = 30_000;

/** An instant as written: ISO 8601 with its zone (`2026-10-25T20:00:00Z`), in epoch milliseconds. */
export const instantMs = (text: string | undefined): number | undefined => {
  if (!text || !/^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:?\d{2})$/.test(text)) {
    return undefined;
  }

  const ms = Date.parse(text);

  return Number.isNaN(ms) ? undefined : ms;
};

/** Widths as `at` writes them — `390`, `<=767`, `<768`, `>=768`, `>767` — or nothing when they are none. */
export const widthRange = (text: string | undefined): WidthRange | undefined => {
  const match = /^(<=|>=|<|>)?(\d+)$/.exec(text ?? '');
  if (!match) {
    return undefined;
  }

  const px = Number(match[2]);
  switch (match[1]) {
    case '<=':
      return { min: 0, max: px };
    case '<':
      return { min: 0, max: px - 1 };
    case '>=':
      return { min: px, max: Number.POSITIVE_INFINITY };
    case '>':
      return { min: px + 1, max: Number.POSITIVE_INFINITY };
    default:
      return { min: px, max: px };
  }
};

/** Widths as a step says them: `390`, `<=767`, `>=768`. */
export const widthRangeText = ({ min, max }: WidthRange): string =>
  min === max ? String(min) : min === 0 ? `<=${String(max)}` : `>=${String(min)}`;

/** A whole number of pixels, either way. */
const pixels = (value: string | undefined): number | undefined => {
  const parsed = Number(value);

  return value !== undefined && Number.isInteger(parsed) ? parsed : undefined;
};

const count = (value: string | undefined, at: string, max: number): number | { problem: string } => {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 && parsed <= max
    ? parsed
    : { problem: `${at}: "${value ?? ''}" is not a whole number from 1 to ${String(max)}` };
};

/** Whether a step is one a visitor plays on its own page — no picture, and none played as another account. */
export const isPageStep = (step: ShotStep): step is PageStep =>
  step.kind !== 'as' && step.kind !== 'at' && step.kind !== 'shot' && step.kind !== 'frames';

/** A page command's own step, read — or why it is none; `undefined` for a word that is none of its own. */
const ownStep = (
  name: string,
  rest: string[],
  at: string,
  every: number
): ShotStep | { problem: string } | undefined => {
  const argument = unquoted(rest.join(' '));
  switch (name) {
    case 'drag': {
      const { target, rest: by } = leadingTarget(rest.join(' '), { pairs: true });
      const words = by.split(/\s+/).filter(Boolean);
      if (words.at(-1) !== 'hold') {
        return undefined;
      }

      const [dx, dy = '0'] = words.slice(0, -1);
      const [x, y] = [pixels(dx), pixels(dy)];

      return !target || x === undefined || y === undefined || (x === 0 && y === 0)
        ? {
            problem: `${at}: drag needs an element and how far, in whole pixels — drag <element> <dx> [dy] [hold]: drag volume-handle -120, drag sheet-handle 0 -120 hold`
          }
        : { kind: 'hold', element: unquoted(target), dx: x, dy: y };
    }
    case 'release':
      return { kind: 'release' };
    case 'wait': {
      const ms = durationMs(rest[0]);

      return ms === undefined || ms > MAX_WAIT_MS
        ? {
            problem: `${at}: "${rest[0] ?? ''}" is not a wait from 1 ms to 30 s — milliseconds, or with its unit: wait 300, wait 3s`
          }
        : { kind: 'wait', ms };
    }
    case 'store': {
      const [key, ...value] = rest;

      return !key || value.length === 0
        ? { problem: `${at}: store needs a key and its value — store listen-choice on` }
        : { kind: 'store', key, value: unquoted(value.join(' ')) };
    }
    case 'attribute': {
      const [key = '', ...value] = rest;
      // Wrapped in single quotes as a shell writes it — `attribute map.storms '[{"id":"x"}]'` — the JSON is inside.
      const written = value.join(' ').replace(/^'([\s\S]*)'$/, '$1');
      let parsed: unknown;
      try {
        parsed = JSON.parse(written);
      } catch {
        return {
          problem: `${at}: attribute needs <element>.<attribute> and its value as JSON — got ${written === '' ? 'none' : written}: attribute map.storms '[{"id":"ARNAB"}]'`
        };
      }

      return /^[^.]+\.[^.]+$/.test(key)
        ? { kind: 'attribute', key, value: parsed }
        : {
            problem: `${at}: attribute needs <element>.<attribute> and its value as JSON — attribute map.showStorms true`
          };
    }
    case 'action':
    case 'render': {
      const [action, ...value] = rest;
      const written = value.join(' ').replace(/^'([\s\S]*)'$/, '$1');
      let input: unknown = {};
      try {
        input = written === '' ? {} : JSON.parse(written);
      } catch {
        input = undefined;
      }

      return !action || !isRecord(input)
        ? {
            problem: `${at}: ${name} needs the action's id and, when it takes one, its input as a JSON object — ${name === 'render' ? `render tornadoes-feed '{}'` : `action dm-send '{"to":"juno","text":"hi"}'`}`
          }
        : { kind: 'action', action, input, ...(name === 'render' ? { render: true as const } : {}) };
    }
    case 'as': {
      const [account, ...played] = rest;
      const step = account ? parseSteps(played.join(' '), every) : [];
      const [one] = Array.isArray(step) ? step : [];

      return !account || !Array.isArray(step) || step.length !== 1 || !isPageStep(one)
        ? {
            problem: `${at}: as needs an account and one step it plays — as mika click dm-send (no picture, no other "as": the pictures are this page's)${!Array.isArray(step) ? ` — ${step.problem}` : ''}`
          }
        : { kind: 'as', account, step: one };
    }
    // A step that only one width needs — the tab a phone opens first — beside the others in one script: a run's lead
    // wrote its stage with a script, the same checks twice, as 390's steps differed from 1440's.
    case 'at': {
      const [range, ...played] = rest;
      const width = widthRange(range);
      const step = width ? parseSteps(played.join(' '), every) : [];
      const [one] = Array.isArray(step) ? step : [];

      return !width || width.min > width.max || !Array.isArray(step) || step.length !== 1 || !isPageStep(one)
        ? {
            problem: `${at}: at needs widths and one step played at them — at 390 click sheet-tab-log, at <=767 …, at >=768 … (no picture, no "as")${width && !Array.isArray(step) ? ` — ${step.problem}` : ''}`
          }
        : { kind: 'at', width, step: one };
    }
    case 'clock': {
      const time = instantMs(rest[0]);

      return time === undefined
        ? { problem: `${at}: clock needs an instant, ISO with its zone — clock 2026-10-25T20:00:00Z` }
        : { kind: 'clock', time };
    }
    case 'shot':
      return { kind: 'shot', ...(argument ? { label: argument } : {}) };
    case 'frames': {
      const frames = count(rest[0], at, 60);
      if (typeof frames !== 'number') {
        return frames;
      }

      const apart = rest.length < 2 ? every : count(rest[1], at, MAX_WAIT_MS);

      return typeof apart === 'number' ? { kind: 'frames', count: frames, every: apart } : apart;
    }
    default:
      return undefined;
  }
};

/** A script, read into its steps — or what is wrong with it, said by its step. */
export const parseSteps = (script: string, every: number): ShotStep[] | { problem: string } => {
  const lines = stepLines(script);
  if (lines.length === 0) {
    return { problem: `--steps has no step: ${STEP_NAMES.join(', ')}, separated by ";"` };
  }

  const steps: ShotStep[] = [];
  for (const [index, line] of lines.entries()) {
    const at = `step ${String(index + 1)} ("${line}")`;
    const [name = '', ...rest] = line.split(/\s+/);
    // A page command's own first — a drag held is one — then a journey's, as authoring reads it.
    const own = ownStep(name, rest, at, every);
    const step = own ?? (isE2eStepWord(name) ? parseE2eStep(line, { pairs: true }) : undefined);
    if (step === undefined) {
      return { problem: `${at}: "${name}" is not a step — the steps are ${STEP_NAMES.join(', ')}` };
    }

    if ('problem' in step) {
      return { problem: own ? step.problem : `${at}: ${step.problem}` };
    }

    steps.push(step);
  }

  return steps;
};
