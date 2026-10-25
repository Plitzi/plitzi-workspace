/**
 * `page shot --steps`: what a person does to a page, one step after another, and the pictures taken along the way — a
 * queue that fills, a restart, an opening watched frame by frame. What `--click` cannot say: a wait between two
 * presses, a picture only where it is asked for, text typed into a field.
 *
 *   click <element>          a press — its name (`data-plitzi-el`), a tag or a CSS selector, inside a plugin too
 *   hover <element>          the pointer put over it, and left there — what a hover shows, pictured by the next shot
 *   scroll <element>         brought into view, as a reader scrolling to it — the footer, a section below the fold
 *   type <element> <text>    text typed into a field, in place of what it held: type ".panel textarea" hi
 *   drag <element> <dx> [dy] pressed, moved by that many pixels (negative: left, up) and let go — a slider's handle
 *   press <key>              a key, as Playwright names it: Enter, Escape, ArrowDown…
 *   wait <ms>                time passing
 *   wait-for <element>       until it is on the page and shown (10 s at most)
 *   reload                   the page loaded again, as a visitor's reload: what it kept read back
 *   store <key> <value>      a value put in the page's localStorage, as an earlier visit left it — then `reload`
 *   state <key> <json>       one key of the space's state written, as a setState step would (development pages)
 *   clock <instant>          the page's clock set to an ISO instant (needs `--clock`): 2026-10-25T20:00:00Z
 *   tick <duration>          the page's clock moved on, its timers run (needs `--clock`): 90s, 5m, 2h, 1500
 *   shot [label]             a picture now
 *   frames <n> [ms]          n pictures, `--every` (or `ms`) apart
 *
 * Separated by `;` or a new line; a line starting with `#` is a note. An element is read whole up to a space outside
 * quotes and brackets — `[aria-label="Search the site"]` is one — or quoted. Every picture is labelled with its step and
 * the time since the first step.
 */

export type ShotStep =
  | { kind: 'click'; target: string }
  | { kind: 'hover'; target: string }
  | { kind: 'scroll'; target: string }
  | { kind: 'type'; target: string; text: string }
  | { kind: 'drag'; target: string; dx: number; dy: number }
  | { kind: 'press'; key: string }
  | { kind: 'wait'; ms: number }
  | { kind: 'wait-for'; target: string }
  | { kind: 'reload' }
  | { kind: 'store'; key: string; value: string }
  | { kind: 'state'; key: string; value: unknown }
  | { kind: 'clock'; time: number }
  | { kind: 'tick'; ms: number }
  | { kind: 'shot'; label?: string }
  | { kind: 'frames'; count: number; every: number };

// `fill` is `type` by the name a Playwright user reaches for (encore's dev-1): typing replaces what a field held either way.
const STEP_NAMES = [
  'click',
  'hover',
  'scroll',
  'type',
  'fill',
  'drag',
  'press',
  'wait',
  'wait-for',
  'reload',
  'store',
  'state',
  'clock',
  'tick',
  'shot',
  'frames'
] as const;

/** The longest a script may wait in one step: a page that needs more is waiting for something else. */
const MAX_WAIT_MS = 30_000;

/** The longest a clock is moved on in one step: a week. */
const MAX_TICK_MS = 7 * 24 * 60 * 60 * 1000;

const UNITS: Readonly<Record<string, number>> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

/** A duration as a step writes it — `90s`, `5m`, `2h`, `1d`, or milliseconds — in milliseconds. */
export const durationMs = (text: string | undefined): number | undefined => {
  const match = /^(\d+(?:\.\d+)?)(ms|s|m|h|d)?$/.exec(text ?? '');
  if (!match) {
    return undefined;
  }

  // An optional group is undefined when absent, whatever its type says.
  const unit: string | undefined = match[2];
  const ms = Math.round(Number(match[1]) * UNITS[unit ?? 'ms']);

  return ms > 0 ? ms : undefined;
};

/** An instant as written: ISO 8601 with its zone (`2026-10-25T20:00:00Z`), in epoch milliseconds. */
export const instantMs = (text: string | undefined): number | undefined => {
  if (!text || !/^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:?\d{2})$/.test(text)) {
    return undefined;
  }

  const ms = Date.parse(text);

  return Number.isNaN(ms) ? undefined : ms;
};

const unquoted = (text: string): string => text.replace(/^(["'])(.*)\1$/s, '$2');

/**
 * An element at the start of a step's words, and what follows it: up to a space outside quotes and brackets, or a
 * quoted one whole — `[aria-label="Search the site"] lamps` was cut at its first space into a selector that is none.
 */
export const leadingTarget = (text: string): { target: string; rest: string } => {
  // `ours => theirs`, as page play and --compare name one element on each page: the pair is the target, whole
  // (lx-product: `drag product-slides => .js-media-list -200 0` was refused until the pair was quoted).
  const first = oneTarget(text);
  const paired = /^=>\s*(.*)$/s.exec(first.rest);
  if (paired) {
    const second = oneTarget(paired[1]);

    return { target: `${first.target} => ${second.target}`, rest: second.rest };
  }

  return first;
};

/** One element at the head of a step's text: quoted, or up to the first space outside brackets and quotes. */
const oneTarget = (text: string): { target: string; rest: string } => {
  const quoted = /^(["'])(.+?)\1(?:\s+|$)(.*)$/s.exec(text);
  if (quoted) {
    return { target: quoted[2], rest: quoted[3] };
  }

  let depth = 0;
  let quote: string | undefined;
  for (let index = 0; index < text.length; index += 1) {
    const char = text.charAt(index);
    if (quote) {
      quote = char === quote ? undefined : quote;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '[' || char === '(') {
      depth += 1;
    } else if (char === ']' || char === ')') {
      depth = Math.max(0, depth - 1);
    } else if (/\s/.test(char) && depth === 0) {
      return { target: text.slice(0, index), rest: text.slice(index).trim() };
    }
  }

  return { target: text, rest: '' };
};

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

/** A script, read into its steps — or what is wrong with it, said by its step. */
export const parseSteps = (script: string, every: number): ShotStep[] | { problem: string } => {
  const lines = script
    .split(/[;\n]/)
    .map(line => line.trim())
    .filter(line => line !== '' && !line.startsWith('#'));
  if (lines.length === 0) {
    return {
      problem: `--steps has no step: ${STEP_NAMES.join(', ')}, separated by ";"`
    };
  }

  const steps: ShotStep[] = [];
  for (const [index, line] of lines.entries()) {
    const at = `step ${String(index + 1)} ("${line}")`;
    const [name, ...rest] = line.split(/\s+/);
    const argument = unquoted(rest.join(' '));
    switch (name) {
      case 'click':
      case 'hover':
      case 'scroll':
      case 'wait-for':
        if (!argument) {
          return { problem: `${at}: ${name} needs an element — its name or a CSS selector` };
        }

        steps.push({ kind: name, target: argument });
        break;
      case 'type':
      case 'fill': {
        // `fill email=ana@x.com` as `--fill` writes it, beside `fill email ana@x.com`: encore-3's agents wrote the flag's
        // spelling in a step and were refused.
        const said = rest.join(' ');
        const flagged = /^([A-Za-z][\w-]*)=([\s\S]*)$/.exec(said);
        const { target, rest: text } = flagged ? { target: flagged[1], rest: flagged[2] } : leadingTarget(said);
        if (!target || text === '') {
          return {
            problem: `${at}: ${name} needs an element and the text — ${name} <element> <text> or ${name} <element>=<text>, ${name} ".panel textarea" hi`
          };
        }

        steps.push({ kind: 'type', target, text: unquoted(text) });
        break;
      }
      case 'drag': {
        const { target, rest: by } = leadingTarget(rest.join(' '));
        const [dx, dy = '0'] = by.split(/\s+/);
        const x = pixels(dx);
        const y = pixels(dy);
        if (!target || x === undefined || y === undefined || (x === 0 && y === 0)) {
          return {
            problem: `${at}: drag needs an element and how far, in whole pixels — drag <element> <dx> [dy]: drag volume-handle -120`
          };
        }

        steps.push({ kind: 'drag', target, dx: x, dy: y });
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
      case 'reload':
        steps.push({ kind: 'reload' });
        break;
      case 'store': {
        const [key, ...value] = rest;
        if (!key || value.length === 0) {
          return { problem: `${at}: store needs a key and its value — store listen-choice on` };
        }

        steps.push({ kind: 'store', key, value: unquoted(value.join(' ')) });
        break;
      }
      case 'state': {
        const [key, ...value] = rest;
        const written = value.join(' ');
        let parsed: unknown;
        try {
          parsed = JSON.parse(written);
        } catch {
          return {
            problem: `${at}: state needs a key and its value as JSON — state roomOpen true, state show '{"title":"Late set"}'`
          };
        }

        if (!key) {
          return { problem: `${at}: state needs a key and its value as JSON — state roomOpen true` };
        }

        steps.push({ kind: 'state', key, value: parsed });
        break;
      }
      case 'clock': {
        const time = instantMs(rest[0]);
        if (time === undefined) {
          return { problem: `${at}: clock needs an instant, ISO with its zone — clock 2026-10-25T20:00:00Z` };
        }

        steps.push({ kind: 'clock', time });
        break;
      }
      case 'tick': {
        const ms = durationMs(rest[0]);
        if (ms === undefined || ms > MAX_TICK_MS) {
          return { problem: `${at}: tick needs how long, up to a week — tick 90s, tick 5m, tick 2h, tick 1500` };
        }

        steps.push({ kind: 'tick', ms });
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
