/**
 * `page shot --steps`: what a person does to a page, one step after another, and the pictures taken along the way — a
 * queue that fills, a restart, an opening watched frame by frame. What `--click` cannot say: a wait between two
 * presses, a picture only where it is asked for, text typed into a field.
 *
 *   click <element>          a press — its name (`data-plitzi-el`) or a CSS selector, inside a plugin too
 *   type <element> <text>    text typed into a field
 *   press <key>              a key, as Playwright names it: Enter, Escape, ArrowDown…
 *   wait <ms>                time passing
 *   wait-for <element>       until it is on the page and shown (10 s at most)
 *   shot [label]             a picture now
 *   frames <n> [ms]          n pictures, `--every` (or `ms`) apart
 *
 * Separated by `;` or a new line; a line starting with `#` is a note. Every picture is labelled with its step and the
 * time since the first step.
 */

export type ShotStep =
  | { kind: 'click'; target: string }
  | { kind: 'type'; target: string; text: string }
  | { kind: 'press'; key: string }
  | { kind: 'wait'; ms: number }
  | { kind: 'wait-for'; target: string }
  | { kind: 'shot'; label?: string }
  | { kind: 'frames'; count: number; every: number };

const STEP_NAMES = ['click', 'type', 'press', 'wait', 'wait-for', 'shot', 'frames'] as const;

/** The longest a script may wait in one step: a page that needs more is waiting for something else. */
const MAX_WAIT_MS = 30_000;

const unquoted = (text: string): string => text.replace(/^(["'])(.*)\1$/s, '$2');

const count = (value: string | undefined, at: string, max: number): number | { problem: string } => {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 && parsed <= max
    ? parsed
    : { problem: `${at}: "${value ?? ''}" is not a whole number from 1 to ${String(max)}` };
};

/** A script, read into its steps — or what is wrong with it, said by its step. */
export const parseSteps = (script: string, every: number): ShotStep[] | { problem: string } => {
  const lines = script
    .split(/[;\n]/)
    .map(line => line.trim())
    .filter(line => line !== '' && !line.startsWith('#'));
  if (lines.length === 0) {
    return { problem: '--steps has no step: click, type, press, wait, wait-for, shot or frames, separated by ";"' };
  }

  const steps: ShotStep[] = [];
  for (const [index, line] of lines.entries()) {
    const at = `step ${String(index + 1)} ("${line}")`;
    const [name, ...rest] = line.split(/\s+/);
    const argument = unquoted(rest.join(' '));
    switch (name) {
      case 'click':
      case 'wait-for':
        if (!argument) {
          return { problem: `${at}: ${name} needs an element — its name or a CSS selector` };
        }

        steps.push({ kind: name, target: argument });
        break;
      case 'type': {
        const [target, ...words] = rest;
        if (!target || words.length === 0) {
          return { problem: `${at}: type needs an element and the text — type <element> <text>` };
        }

        steps.push({ kind: 'type', target, text: unquoted(words.join(' ')) });
        break;
      }
      case 'press':
        if (!argument) {
          return { problem: `${at}: press needs a key — Enter, Escape, ArrowDown…` };
        }

        steps.push({ kind: 'press', key: argument });
        break;
      case 'wait': {
        const ms = count(rest[0], at, MAX_WAIT_MS);
        if (typeof ms !== 'number') {
          return ms;
        }

        steps.push({ kind: 'wait', ms });
        break;
      }
      case 'shot':
        steps.push({ kind: 'shot', ...(argument ? { label: argument } : {}) });
        break;
      case 'frames': {
        const frames = count(rest[0], at, 60);
        if (typeof frames !== 'number') {
          return frames;
        }

        const apart = rest.length < 2 ? every : count(rest[1], at, MAX_WAIT_MS);
        if (typeof apart !== 'number') {
          return apart;
        }

        steps.push({ kind: 'frames', count: frames, every: apart });
        break;
      }
      default:
        return { problem: `${at}: "${name}" is not a step — the steps are ${STEP_NAMES.join(', ')}` };
    }
  }

  return steps;
};
