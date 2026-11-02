import type { E2eStep } from '@plitzi/sdk-shared';

/**
 * A journey's steps as words — `click add-flat-white; expect-text cart-count = 1` — the one way they are written as
 * text: read into the records a space keeps (`tests.e2e[].steps`) and written back the same way. The page commands'
 * `--steps` are these and their own (a picture, a width, another account), so a script that checks a page and a
 * journey the space keeps say a step alike, and what one prints the other takes.
 */

/** Each step as it is written, in the order it is taught: the parser's refusals and every help are made from it. */
export const E2E_STEP_USAGE = [
  ['click', 'click <el> [x%,y%]'],
  ['hover', 'hover <el> [x%,y%]'],
  ['scroll', 'scroll <el|page> [dx] [dy]'],
  ['type', 'type <el> <text>'],
  ['drag', 'drag <el> <dx> [dy]'],
  ['press', 'press <key>'],
  ['wait-for', 'wait-for <el> [time]'],
  ['reload', 'reload'],
  ['goto', 'goto <path>'],
  ['back', 'back'],
  ['state', 'state <key> <json>'],
  ['source', 'source <path> <json>'],
  ['tick', 'tick <duration>'],
  ['expect-shown', 'expect-shown <el>'],
  ['expect-hidden', 'expect-hidden <el>'],
  ['expect-text', 'expect-text <el> [=] <text>'],
  ['expect-state', 'expect-state <key> <json>'],
  ['expect-attribute', 'expect-attribute <el> <name> <value>'],
  ['expect-style', 'expect-style <el> <property> [>=|<=] <value>'],
  ['expect-position', 'expect-position <relation>'],
  ['expect-check', 'expect-check <check>']
] as const;

/** The words a step starts with — `fill` is `type` by the name a Playwright user reaches for. */
const WORDS: ReadonlySet<string> = new Set([...E2E_STEP_USAGE.map(([word]) => word), 'fill']);

/** Whether a line of a script starts with a step of a journey's — else it is another's (a page command's own). */
export const isE2eStepWord = (word: string): boolean => WORDS.has(word);

/** How long a `wait-for` may wait, said: a state a few tries bring. */
export const MAX_WAIT_FOR_MS = 60_000;

/** The longest a clock is moved on in one step: a week. */
const MAX_TICK_MS = 7 * 24 * 60 * 60 * 1000;

const UNITS: Readonly<Record<string, number>> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

/** A duration as a step writes it — `90s`, `5m`, `2h`, `1d`, or milliseconds — in milliseconds. */
export const durationMs = (text: string | undefined): number | undefined => {
  const match = /^(\d+(?:\.\d+)?)(ms|s|m|h|d)?$/.exec(text ?? '');
  if (!match) {
    return undefined;
  }

  // An optional group is undefined when absent, whatever its type says: a bare number is milliseconds.
  const unit = match.at(2) ?? 'ms';
  const ms = Math.round(Number(match[1]) * UNITS[unit]);

  return ms > 0 ? ms : undefined;
};

/** Words in quotes, as they are: `"late; still here"` is `late; still here`. */
export const unquoted = (text: string): string => text.replace(/^(["'])(.*)\1$/s, '$2');

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

/**
 * An element at the start of a step's words, and what follows it: up to a space outside quotes and brackets, or a
 * quoted one whole — `[aria-label="Search the site"] lamps` was cut at its first space into a selector that is none.
 * `pairs`: `ours => theirs`, an element on each of two pages, read as one (a page command played beside another site).
 */
export const leadingTarget = (
  text: string,
  { pairs = false }: { pairs?: boolean } = {}
): { target: string; rest: string } => {
  const first = oneTarget(text);
  const paired = pairs ? /^=>\s*(.*)$/s.exec(first.rest) : null;
  if (paired) {
    const second = oneTarget(paired[1]);

    return { target: `${first.target} => ${second.target}`, rest: second.rest };
  }

  return first;
};

/**
 * A script's steps, apart: at each `;` or new line outside quotes — a run's chat line "late — still here; ok" was cut at
 * its `;`, and the message never sent. Blank lines and notes (`# …`) left out.
 */
export const stepLines = (script: string): string[] => {
  const lines: string[] = [];
  let quote: string | undefined;
  let from = 0;
  for (let index = 0; index < script.length; index += 1) {
    const char = script.charAt(index);
    if (quote) {
      quote = char === quote ? undefined : quote;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === ';' || char === '\n') {
      lines.push(script.slice(from, index));
      from = index + 1;
    }
  }

  return [...lines, script.slice(from)].map(line => line.trim()).filter(line => line !== '' && !line.startsWith('#'));
};

/** A whole number of pixels, either way. */
const pixels = (value: string | undefined): number | undefined => {
  const parsed = Number(value);

  return value !== undefined && Number.isInteger(parsed) ? parsed : undefined;
};

/** A value written as JSON — wrapped in single quotes as a shell writes it, `'{"id":"x"}'` — or nothing it reads as. */
const jsonOf = (written: string): { value: unknown } | undefined => {
  try {
    return { value: JSON.parse(written.replace(/^'([\s\S]*)'$/, '$1')) };
  } catch {
    return undefined;
  }
};

/** A point of a box, as a step writes it: `30%,60%`, from its top left. */
const BOX_POINT = /^(\d+(?:\.\d+)?)%,\s*(\d+(?:\.\d+)?)%$/;

/** What reads as a point written some other way — in pixels, one number alone: refused with the way it is written. */
const POINT_LIKE = /^-?[\d.]+%?,\s*-?[\d.]+%?$|^-?[\d.]+%$/;

/**
 * One line of a script read into a journey's step, or why it is none — `undefined` when its first word is no step of a
 * journey's (another's, a page command's own). `pairs`: an element may be `ours => theirs`.
 */
export const parseE2eStep = (
  line: string,
  { pairs = false }: { pairs?: boolean } = {}
): E2eStep | { problem: string } | undefined => {
  const [name = '', ...words] = line.trim().split(/\s+/);
  const rest = words.join(' ');
  const argument = unquoted(rest);
  const { target, rest: after } = leadingTarget(rest, { pairs });
  const element = unquoted(target);
  switch (name) {
    case 'click':
    case 'hover': {
      if (!element) {
        return { problem: `${name} needs an element — its name or a CSS selector` };
      }

      // A point of its box: what a canvas draws has no element of its own to name — a run's tester wrote a probe of
      // its own to press a quake on a map.
      const point = BOX_POINT.exec(after);
      if (point || POINT_LIKE.test(after)) {
        const [x, y] = point ? [Number(point[1]), Number(point[2])] : [Number.NaN, Number.NaN];

        return x >= 0 && x <= 100 && y >= 0 && y <= 100
          ? { kind: name, element, point: { x, y } }
          : {
              problem: `${name} takes an element and, to ${name === 'click' ? 'press' : 'point at'} a point of it, where in its box, in percent from its top left — ${name} map 30%,60% (a selector with spaces goes in quotes)`
            };
      }

      // Numbers after the element are no part of a selector: a run's `scroll <row> 200` reached Playwright whole and
      // came back as its parse error.
      if (/^-?\d+(?:\s+-?\d+)*$/.test(after)) {
        return {
          problem: `${name} takes an element alone — ${after} is no part of one (a selector with spaces goes in quotes); a point of it is written in percent of its box: ${name} map 30%,60%`
        };
      }

      // A selector's words past a space unquoted (`click .panel button`) are the selector's.
      return { kind: name, element: argument };
    }
    case 'scroll': {
      if (!element) {
        return { problem: 'scroll needs an element — its name or a CSS selector — or the page: scroll page 0 600' };
      }

      // The page by so much, as a wheel does: `scroll 1500` is down, `scroll 200 600` across and down.
      if (/^-?\d+$/.test(element)) {
        const numbers = rest.split(/\s+/).filter(Boolean);
        if (numbers.length <= 2 && numbers.every(each => /^-?\d+$/.test(each))) {
          const [first, second] = numbers.map(Number);

          return numbers.length === 1
            ? { kind: 'scroll', element: 'page', dy: first }
            : { kind: 'scroll', element: 'page', dx: first, dy: second };
        }
      }

      // A direction said in words — `scroll genres right 400` — is that many pixels that way.
      const toward = /^(left|right|up|down)\s+(\d+)$/i.exec(after);
      if (toward) {
        const amount = Number(toward[2]);
        const way = toward[1].toLowerCase();

        return way === 'left' || way === 'right'
          ? { kind: 'scroll', element, dx: way === 'left' ? -amount : amount }
          : { kind: 'scroll', element, dx: 0, dy: way === 'up' ? -amount : amount };
      }

      const amounts = after === '' ? [] : after.split(/\s+/);
      if (amounts.length === 0 || !amounts.every(each => /^-?\d+$/.test(each))) {
        return { kind: 'scroll', element: amounts.length === 0 ? element : argument };
      }

      const [dx, dy] = [Number(amounts[0]), amounts.length > 1 ? Number(amounts[1]) : undefined];

      return amounts.length > 2 || (dx === 0 && !dy)
        ? {
            problem:
              'scroll takes an element and how far its content goes, in whole pixels — scroll <element> <dx> [dy]: scroll genres 200'
          }
        : { kind: 'scroll', element, dx, ...(dy === undefined ? {} : { dy }) };
    }
    case 'type':
    case 'fill': {
      // `fill email=ana@x.com` as `--fill` writes it, beside `fill email ana@x.com`: a run's agents wrote the flag's
      // spelling in a step and were refused. A class or an id too: `fill .chat__input=Great` was read as one selector.
      const flagged = /^([.#]?[A-Za-z_][\w-]*)=([\s\S]*)$/.exec(rest);
      const field = flagged ? { target: flagged[1], rest: flagged[2] } : { target: element, rest: after };
      if (!field.target || field.rest === '') {
        return {
          problem: `${name} needs an element and the text — ${name} <element> <text> or ${name} <element>=<text>, ${name} ".panel textarea" hi; the field that has the focus: ${name} :focus <text>`
        };
      }

      return { kind: 'type', element: field.target, text: unquoted(field.rest) };
    }
    case 'drag': {
      const [dx, dy = '0', ...more] = after.split(/\s+/).filter(Boolean);
      const [x, y] = [pixels(dx), pixels(dy)];

      return !element || x === undefined || y === undefined || (x === 0 && y === 0) || more.length > 0
        ? {
            problem:
              'drag needs an element and how far, in whole pixels — drag <element> <dx> [dy]: drag volume-handle -120'
          }
        : { kind: 'drag', element, dx: x, dy: y };
    }
    case 'press':
      return argument ? { kind: 'press', key: argument } : { problem: 'press needs a key — Enter, Escape, ArrowDown…' };
    case 'wait-for': {
      if (!element) {
        return { problem: 'wait-for needs an element — its name or a CSS selector' };
      }

      if (after === '') {
        return { kind: 'waitFor', element };
      }

      const ms = durationMs(after);

      return ms === undefined || ms > MAX_WAIT_FOR_MS
        ? {
            problem:
              'wait-for takes an element and how long it waits at most, up to 60 s — wait-for room-player 40s (a selector with spaces goes in quotes)'
          }
        : { kind: 'waitFor', element, ms };
    }
    case 'reload':
    case 'back':
      return { kind: name };
    case 'goto':
      return argument.startsWith('/')
        ? { kind: 'goto', path: argument }
        : { problem: 'goto needs a path of the site — goto /rooms, goto /r/night-drive' };
    case 'state':
    case 'source':
    case 'expect-state': {
      const [key = '', ...value] = words;
      const written = value.join(' ');
      const read = jsonOf(written);
      if (!key || !read) {
        return {
          problem:
            name === 'source'
              ? `source needs a source's path and its value as JSON — got ${written === '' ? 'none' : written}: source apiContainer_chart.clapped '[{"title":"Night Drive"}]'`
              : `${name} needs a key and its value as JSON — got ${written === '' ? 'none' : written}: a text in double quotes (${name} dismissed "show-1"), true, 3, or an object (${name} show '{"title":"Late set"}')`
        };
      }

      return name === 'state'
        ? { kind: 'setState', key, value: read.value }
        : name === 'source'
          ? { kind: 'setSource', path: key, value: read.value }
          : { kind: 'expectState', key, value: read.value };
    }
    case 'tick': {
      const ms = durationMs(words[0]);

      return ms === undefined || ms > MAX_TICK_MS
        ? { problem: 'tick needs how long, up to a week — tick 90s, tick 5m, tick 2h, tick 1500' }
        : { kind: 'tick', ms };
    }
    case 'expect-shown':
    case 'expect-hidden':
      return argument
        ? { kind: name === 'expect-shown' ? 'expectShown' : 'expectHidden', element: argument }
        : { problem: `${name} needs an element — ${name} cart-count` };
    case 'expect-text': {
      // `=` on its own: the words are the text, whole — else they are held in it.
      const exact = /^=\s+([\s\S]+)$/.exec(after);
      const text = unquoted(exact ? exact[1] : after);

      return element && text !== ''
        ? { kind: 'expectText', element, text, ...(exact ? { exact: true } : {}) }
        : {
            problem:
              'expect-text needs an element and the words it shows — expect-text cart-count 1 item, or exactly: expect-text cart-count = "1 item"'
          };
    }
    case 'expect-attribute': {
      const [attribute = '', ...value] = after.split(/\s+/);

      return element && attribute && value.length > 0
        ? { kind: 'expectAttribute', element, name: attribute, value: unquoted(value.join(' ')) }
        : {
            problem:
              'expect-attribute needs an element, the attribute and its value — expect-attribute play aria-pressed true'
          };
    }
    case 'expect-style': {
      const [property = '', ...value] = after.split(/\s+/);
      const at = value[0] === '>=' || value[0] === '<=' ? value[0] : undefined;
      const said = unquoted((at ? value.slice(1) : value).join(' '));

      return element && property && said !== ''
        ? { kind: 'expectStyle', element, property, value: said, ...(at ? { at } : {}) }
        : {
            problem:
              'expect-style needs an element, a property as CSS names it and its value — expect-style card background-color rgb(255, 255, 255), expect-style key min-height >= 44px'
          };
    }
    case 'expect-position':
      return argument
        ? { kind: 'expectPosition', relation: argument }
        : {
            problem:
              'expect-position needs where two elements stand — expect-position "activity.bottom + 8 <= legend.top"'
          };
    case 'expect-check':
      return argument
        ? { kind: 'expectCheck', check: argument }
        : { problem: 'expect-check needs the id of one of the space’s element checks (tests.unit)' };
    default:
      return undefined;
  }
};

/** A script read into a journey's steps — or what is wrong with it, said by its step. */
export const parseE2eSteps = (script: string): E2eStep[] | { problem: string } => {
  const steps: E2eStep[] = [];
  for (const [index, line] of stepLines(script).entries()) {
    const step = parseE2eStep(line);
    if (step === undefined || 'problem' in step) {
      return {
        problem: `step ${String(index + 1)} ("${line}"): ${step?.problem ?? `"${line.split(/\s+/)[0] ?? ''}" is not a step — the steps are ${E2E_STEP_USAGE.map(([word]) => word).join(', ')}`}`
      };
    }

    steps.push(step);
  }

  return steps;
};

/** Words as a step writes them: quoted when a space, a `;` or nothing would otherwise cut them. */
const word = (text: string): string =>
  text === '' || /[\s;"']/.test(text) ? (text.includes('"') ? `'${text}'` : `"${text}"`) : text;

/** A value as JSON in a step, quoted for a shell when it holds a space. */
const json = (value: unknown): string => {
  const written = JSON.stringify(value);

  return /\s/.test(written) ? `'${written}'` : written;
};

/** A step as words — what `parseE2eStep` reads back as the same step. */
export const e2eStepText = (step: E2eStep): string => {
  switch (step.kind) {
    case 'click':
    case 'hover':
      return `${step.kind} ${word(step.element)}${step.point ? ` ${String(step.point.x)}%,${String(step.point.y)}%` : ''}`;
    case 'type':
      return `type ${word(step.element)} ${word(step.text)}`;
    case 'press':
      return `press ${step.key}`;
    case 'scroll':
      return step.dx === undefined && step.dy === undefined
        ? `scroll ${word(step.element)}`
        : `scroll ${word(step.element)} ${String(step.dx ?? 0)}${step.dy === undefined ? '' : ` ${String(step.dy)}`}`;
    case 'drag':
      return `drag ${word(step.element)} ${String(step.dx)} ${String(step.dy)}`;
    case 'waitFor':
      return `wait-for ${word(step.element)}${step.ms === undefined ? '' : ` ${String(step.ms)}ms`}`;
    case 'goto':
      return `goto ${step.path}`;
    case 'back':
    case 'reload':
      return step.kind;
    case 'setState':
      return `state ${step.key} ${json(step.value)}`;
    case 'setSource':
      return `source ${step.path} ${json(step.value)}`;
    case 'tick':
      return `tick ${String(step.ms)}ms`;
    case 'expectShown':
      return `expect-shown ${word(step.element)}`;
    case 'expectHidden':
      return `expect-hidden ${word(step.element)}`;
    case 'expectText':
      return `expect-text ${word(step.element)}${step.exact ? ' =' : ''} ${word(step.text)}`;
    case 'expectState':
      return `expect-state ${step.key} ${json(step.value)}`;
    case 'expectAttribute':
      return `expect-attribute ${word(step.element)} ${step.name} ${word(step.value)}`;
    case 'expectStyle':
      return `expect-style ${word(step.element)} ${step.property}${step.at ? ` ${step.at}` : ''} ${word(step.value)}`;
    case 'expectPosition':
      return `expect-position ${word(step.relation)}`;
    case 'expectCheck':
      return `expect-check ${step.check}`;
  }
};
