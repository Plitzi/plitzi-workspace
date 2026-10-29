import { comparePictures } from '@plitzi/sdk-authoring';
import { isRecord } from '@plitzi/sdk-shared/helpers';

import { awaited, capture, ROW, targetOn } from './capture';
import { notOnPageText } from './notOnPage';
import { dataUrl } from '../../../browser';
import { clockHeld } from '../../../browser/conditions';
import { projectRun } from '../../../scaffold/packageManager';
import { momentChanges, pageMomentInPage } from '../check/moments';
import { answered, patiently, settle, stepFailure } from '../measureState';
import { parseSteps } from '../shotSteps';

import type { BrowserPage } from '../../../browser';
import type { PageMoment } from '../check/types';
import type { ShotStep } from '../shotSteps';
import type { Framing, Moment, Taken } from './types';
import type { Visitors } from './visitors';
import type { ActionRunStatus } from '@plitzi/sdk-shared';

/**
 * An interaction pictured step by step: clicks, waits, frames and shots, as `--steps` writes them.
 */

/** A PNG's width and height, read off its header: two pictures of different framing are not compared share by share. */
const sizeOf = (png: Uint8Array): string =>
  png.length < 24
    ? ''
    : `${String(new DataView(png.buffer, png.byteOffset).getUint32(16))}x${String(new DataView(png.buffer, png.byteOffset).getUint32(20))}`;

/**
 * One click pictured: the share of the picture it changed — or that it opened the part pictured (`opened`), or made the
 * picture another size (`resized`, before → after) — and what changed outside a part when nothing in it did.
 */
export interface Clicked {
  target: string;
  changed: number;
  opened?: true;
  resized?: string;
  outside?: string[];
}

/**
 * What a click made of the picture, by its size alone — none when it kept its size, and is compared share by share. A
 * part the click opened is pictured alone after it, the page before it (`opened`); the whole page grown or shrunk by
 * the click is no part opened, its sizes said (a run's toggle "opened undefined").
 */
export const sizeChange = (
  before: Uint8Array,
  after: Uint8Array,
  opening: boolean
): Pick<Clicked, 'opened' | 'resized'> | undefined => {
  if (sizeOf(before) === sizeOf(after)) {
    return undefined;
  }

  return opening ? { opened: true } : { resized: `${sizeOf(before)} → ${sizeOf(after)}` };
};

/** The page as it is — its screen and what it shows — when a picture is clipped to a part of it. */
interface PageNow {
  moment: PageMoment;
  png: Uint8Array;
}

const pageNow = async (page: BrowserPage, how: Framing): Promise<PageNow | undefined> =>
  how.kind === 'element' || how.kind === 'element-later'
    ? { moment: await page.evaluate(pageMomentInPage, undefined), png: await page.screenshot({ fullPage: false }) }
    : undefined;

/**
 * What changed on the page since `before` while a clipped picture stayed the same — the screen, and what it shows: a
 * click opened a plugin's picker beside the part pictured, and its shot said "nothing changed — the click did nothing to
 * see" (a run's tester and designer). Whatever draws it — a marked element or a plugin's own — the screen says it.
 */
const outsideClip = async (page: BrowserPage, before: PageNow | undefined): Promise<string[]> => {
  if (before === undefined) {
    return [];
  }

  const moment = await page.evaluate(pageMomentInPage, undefined);
  const screen = await page.screenshot({ fullPage: false });
  const { changed } = await comparePictures(page, dataUrl(before.png), dataUrl(screen));

  return [
    ...(changed > 0 ? [`${String(changed)}% of the screen`] : []),
    ...momentChanges(before.moment, moment, { before: undefined, after: undefined })
  ];
};

/**
 * Each element clicked in turn, and the page pictured after it — `frames` pictures `every` ms apart, or one. What a
 * click changed is measured against the picture before it: nothing at all is said, as a click that did nothing.
 */
export const clickThrough = async (
  taken: Taken,
  how: Framing,
  clicks: readonly string[],
  { frames, every }: { frames: number; every: number }
): Promise<{ moments: Moment[]; clicked: Clicked[] } | { problem: string }> => {
  const moments: Moment[] = [{ label: 'before', png: taken.png }];
  const clicked: Clicked[] = [];
  for (const target of clicks) {
    const read = await targetOn(taken.page, target);
    if ('problem' in read) {
      return read;
    }

    if (!read.found) {
      return { problem: `${target} is not on the page: --click takes an element's name, a tag or a selector.` };
    }

    const element = taken.page.locator(read.selector).filter({ visible: true }).first();

    const before = moments[moments.length - 1].png;
    const pageBefore = await pageNow(taken.page, how);
    try {
      await patiently(taken.page, () => element.click({ timeout: 3000 }));
    } catch (error) {
      return { problem: `${target} could not be clicked: ${stepFailure(error)}` };
    }

    for (let frame = 1; frame <= Math.max(1, frames); frame += 1) {
      await taken.page.waitForTimeout(every);
      moments.push({ label: `${target} +${String(frame * every)} ms`, png: await capture(taken.page, how) });
    }

    const after = moments[moments.length - 1].png;
    const resized = sizeChange(before, after, how.kind === 'element-later');
    if (resized) {
      clicked.push({ target, changed: 100, ...resized });
    } else {
      const { changed } = await comparePictures(taken.page, dataUrl(before), dataUrl(after));
      const outside = changed === 0 ? await outsideClip(taken.page, pageBefore) : [];
      clicked.push({ target, changed, ...(outside.length > 0 ? { outside } : {}) });
    }
  }

  return { moments, clicked };
};

/**
 * `--fill`, `--click` and `--hover` said as the steps they are played as: the page before, each field typed into, each
 * click — pictured after each, unless a hover ends them — and the hover, pictured so. None of `--fill` and `--hover`:
 * none, the clicks played as clicks alone.
 */
export const interactionSteps = (
  filled: readonly string[] | undefined,
  clicks: readonly string[],
  hover: string | undefined
): string | undefined =>
  filled || hover !== undefined
    ? [
        ...(filled ? ['shot before', ...filled] : []),
        ...clicks.flatMap(click => [
          `click ${JSON.stringify(click)}`,
          'wait 600',
          ...(hover === undefined ? [`shot after ${click}`] : [])
        ]),
        ...(hover !== undefined
          ? [`hover ${JSON.stringify(hover)}`, 'wait 400', `shot ${hover} hovered`]
          : clicks.length > 0
            ? []
            : ['wait 600', 'shot filled'])
      ].join('; ')
    : undefined;

/**
 * How a field named by `selector` takes a value — run in the page, so it reads nothing of this module: a select is
 * chosen from, and a date, a time, a colour or a range set whole — keys land in one segment of a date and set nothing (a
 * run's scout typed `2026-10-29` and `10292026` into one and its onChange never ran). The element itself, or the one such
 * field inside it (a `formControl` wraps it); nothing, it is typed into.
 */
/**
 * The keys a `type` step presses: what the field held selected first, as a person does — typed after it, a price field
 * kept its old amount too — then the text, or, with none (`fill rate ''`), the selection deleted: a run's tester read
 * a number field emptied that still held its 5, the step said as typed.
 */
export const typedKeys = (text: string): ({ press: string } | { type: string })[] => [
  { press: 'ControlOrMeta+A' },
  text === '' ? { press: 'Backspace' } : { type: text }
];

export const givenValueIn = (selector: string): { selector: string; how: 'select' | 'value' } | undefined => {
  const node = document.querySelector(selector);
  if (node === null) {
    return undefined;
  }

  const kinds = [
    { how: 'select', matches: 'select' },
    {
      how: 'value',
      matches: ['date', 'time', 'datetime-local', 'month', 'week', 'color', 'range']
        .map(type => `input[type="${type}"]`)
        .join(', ')
    }
  ] as const;
  for (const kind of kinds) {
    if (node.matches(kind.matches)) {
      return { selector, how: kind.how };
    }

    const inside = node.querySelectorAll(kind.matches);
    const only = inside.length === 1 ? inside[0] : undefined;
    if (only) {
      const type = only.getAttribute('type');

      return {
        selector: `${selector} ${type === null ? only.localName : `${only.localName}[type="${type}"]`}`,
        how: kind.how
      };
    }
  }

  return undefined;
};

/** What a step is, as its label and `page play` say it. */
export const stepText = (step: ShotStep): string => {
  switch (step.kind) {
    case 'click':
    case 'hover':
      return `${step.kind} ${step.target}`;
    case 'wait-for':
      return `wait-for ${step.target}${step.ms === undefined ? '' : ` ${String(step.ms)} ms`}`;
    case 'scroll':
      return step.by ? `scroll ${step.target} ${String(step.by.dx)} ${String(step.by.dy)}` : `scroll ${step.target}`;
    case 'type':
      return `type ${step.target}`;
    case 'drag':
      return `drag ${step.target} ${String(step.dx)} ${String(step.dy)}`;
    case 'press':
      return `press ${step.key}`;
    case 'wait':
      return `wait ${String(step.ms)} ms`;
    case 'reload':
      return 'reload';
    case 'back':
      return 'back';
    case 'goto':
      return `goto ${step.path}`;
    case 'store':
      return `store ${step.key}`;
    case 'state':
      return `state ${step.key}`;
    case 'source':
      return `source ${step.key}`;
    case 'attribute':
      return `attribute ${step.key}`;
    case 'clock':
      return `clock ${new Date(step.time).toISOString()}`;
    case 'tick':
      return `tick ${String(step.ms)} ms`;
    case 'shot':
      return step.label ?? 'shot';
    case 'frames':
      return `frames ${String(step.count)}`;
    case 'action':
      return `${step.render ? 'render' : 'action'} ${step.action}`;
    case 'as':
      return `as ${step.account}: ${stepText(step.step)}`;
  }
};

/** A step that acts on the page — every one but a picture: a press, a hover, a key, a wait. */
export type ActingStep = Exclude<ShotStep, { kind: 'shot' } | { kind: 'frames' }>;

/** A run that did what it was asked: a skipped or aborted one put nothing in the state a play needs. */
const COMPLETED: ActionRunStatus = 'completed';

/** Where a project's server runs its actions, as the page's own flows reach them (`createServer`'s `action.path`). */
const ACTION_PATH = '/_action';

/** How much of an action's answer a step says: enough to read a count or an id, never a payload whole. */
const ANSWER_CHARS = 200;

/**
 * The space's action run from the page, as its visitor — its cookies, its origin: what it answered, or why it refused.
 * A run's dev-1 read an action's answer with page check --state, the play's step having said nothing of it.
 */
const runAction = async (
  page: BrowserPage,
  action: string,
  input: Record<string, unknown>,
  render = false
): Promise<{ answer: string; output?: unknown } | { refused: string }> => {
  const answer = await page.evaluate(
    async ({ path, body }: { path: string; body: string }) => {
      const response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body });

      return { status: response.status, text: await response.text() };
    },
    { path: ACTION_PATH, body: JSON.stringify({ actionId: action, input, ...(render ? { trigger: 'render' } : {}) }) }
  );
  let said: unknown;
  try {
    said = JSON.parse(answer.text);
  } catch {
    said = undefined;
  }

  const status = isRecord(said) && typeof said.status === 'string' ? said.status : undefined;
  if (answer.status < 400 && status === COMPLETED) {
    const output = isRecord(said) && said.output !== undefined ? JSON.stringify(said.output) : undefined;

    // Whole in --json, where a check line reads it (`| jq`): a run's line grepped the clipped words for its third storm,
    // and its whole answer sat in a temporary file no line could name.
    return output === undefined || !isRecord(said)
      ? { answer: 'completed, with no output' }
      : {
          answer:
            output.length > ANSWER_CHARS ? `${output.slice(0, ANSWER_CHARS)}… (whole with --json: its output)` : output,
          output: said.output
        };
  }

  const why = isRecord(said) && typeof said.error === 'string' ? said.error : answer.text.slice(0, 300);
  // A public page plays signed out: a run's designer was answered 401 and not told how to play it signed in.
  const signIn = answer.status === 401 ? ' — the page played signed out: --as <account> plays it signed in' : '';
  // An action the page runs as it renders (a provider's) is played as the page plays it: a run's agent gave two feeds
  // a public call trigger to pass a check — the space's public surface widened for a test.
  const asRender =
    !render && /"call" trigger/.test(why)
      ? ` — the page runs it as it renders: play it so, ${JSON.stringify(`render ${action} ${JSON.stringify(input)}`)}, never with a trigger added for the check`
      : '';

  return {
    refused: `${render ? 'render' : 'action'} ${action} answered ${String(answer.status)}${status ? `, ${status}` : ''}: ${why}${signIn}${asRender}`
  };
};

/**
 * One step played on a page — what `--steps` does between its pictures, and `page play` on each page it plays on — or
 * what kept it from happening, said by its step. `visitors` holds the other accounts' pages a step `as` one plays on.
 */
/** Runs in the page: how many elements a CSS selector finds — one for a selector only Playwright reads. Serialised. */
export const copiesOn = (selector: string): number => {
  try {
    return document.querySelectorAll(selector).length;
  } catch {
    return 1;
  }
};

export const actStep = async (
  page: BrowserPage,
  step: ActingStep,
  index: number,
  visitors?: Visitors
): Promise<{ problem: string } | { answer: string; output?: unknown } | undefined> => {
  if (step.kind === 'as') {
    const theirs = visitors
      ? await visitors.pageOf(step.account, `${new URL(page.url()).pathname}${new URL(page.url()).search}`)
      : { problem: 'another account plays only against the project’s own server' };
    if ('problem' in theirs) {
      return { problem: `Step ${String(index + 1)}: ${theirs.problem}` };
    }

    const done = await actStep(theirs, step.step, index);
    if (done !== undefined && 'problem' in done) {
      return { problem: `${done.problem} (as ${step.account})` };
    }

    // What it did reaches this page through the server — a message, a count: given the moment it takes.
    await settle(page);

    return done;
  }

  if (step.kind === 'action') {
    const ran = await runAction(page, step.action, step.input, step.render === true);

    return 'refused' in ran ? { problem: `Step ${String(index + 1)}: ${ran.refused}` } : ran;
  }

  // The one shown: a page drawing a control per width hides the other — a field of a phone's drawer, the first in the
  // document, timed out at 1440 where the column's own was there to type into.
  const shown = (selector: string) => page.locator(selector).filter({ visible: true }).first();
  if (
    step.kind === 'click' ||
    step.kind === 'hover' ||
    step.kind === 'scroll' ||
    step.kind === 'type' ||
    step.kind === 'drag'
  ) {
    const read = await targetOn(page, step.target);
    if ('problem' in read || !read.found) {
      return {
        problem: `Step ${String(index + 1)}: ${'problem' in read ? read.problem : `${step.target} is not on the page — ${await notOnPageText(page, step.target, 'a step before it')}; a selector with spaces is written in quotes: type ".panel textarea" hola`}.`
      };
    }

    // On the page and drawn nowhere at this width — a burger at 1440, the nav behind it at 390: said at its own step,
    // where a run's dev-1 saw the step pass and the next one fail on what it should have opened.
    if ((await shown(read.selector).count()) === 0) {
      return {
        problem: `Step ${String(index + 1)}: ${step.target} is on the page but hidden at this width — a breakpoint, or a menu that is closed: ${step.kind} what a visitor sees here, or play it at the width that shows it`
      };
    }

    // A select is chosen and a date set, not typed into: the element named, or the one inside it a `formControl` wraps.
    if (step.kind === 'type') {
      const given = await page.evaluate(givenValueIn, read.selector);
      if (given?.how === 'select') {
        await page.locator(given.selector).first().selectOption(step.text, { timeout: 3000 });
        return undefined;
      }

      if (given?.how === 'value') {
        await page.locator(given.selector).first().fill(step.text, { timeout: 3000 });
        return undefined;
      }
    }

    if (step.kind === 'hover') {
      await patiently(page, () => shown(read.selector).hover({ timeout: 3000 }));
      return undefined;
    }

    // Brought into view as a reader scrolling to it would: a hover was how design-1 reached the footer.
    if (step.kind === 'scroll' && !step.by) {
      await shown(read.selector).scrollIntoViewIfNeeded({ timeout: 3000 });
      return undefined;
    }

    // Its own content scrolled by so much — a row across, a list within its box — and said when it did not move: a
    // box whose content fits, or one that scrolls the other way.
    if (step.kind === 'scroll' && step.by) {
      await shown(read.selector).scrollIntoViewIfNeeded({ timeout: 3000 });
      const moved = await shown(read.selector).evaluate((node, by: { dx: number; dy: number }) => {
        const [left, top] = [node.scrollLeft, node.scrollTop];
        node.scrollBy({ left: by.dx, top: by.dy, behavior: 'instant' });

        return {
          moved: node.scrollLeft !== left || node.scrollTop !== top,
          across: node.scrollWidth - node.clientWidth,
          down: node.scrollHeight - node.clientHeight
        };
      }, step.by);
      if (!moved.moved) {
        return {
          problem: `Step ${String(index + 1)}: ${step.target} did not scroll — ${moved.across <= 0 && moved.down <= 0 ? 'its content fits its box, so nothing in it scrolls (the row that scrolls may be one inside it)' : `it scrolls ${String(Math.max(0, moved.across))} px across and ${String(Math.max(0, moved.down))} px down at most, and was at that end already`}`
        };
      }

      return undefined;
    }

    // Pressed at its middle, moved in steps a hand would make, let go: a range's handle, a slider, a card dragged.
    if (step.kind === 'drag') {
      const box = await shown(read.selector).boundingBox({ timeout: 3000 });
      if (box === null) {
        return { problem: `Step ${String(index + 1)}: ${step.target} is not shown — nothing to drag` };
      }

      // A range is pressed at its thumb, where its value puts it — at its middle, the handle on top of it moved
      // instead (a run's two-handle price range).
      const along = await shown(read.selector).evaluate(node => {
        if (!(node instanceof HTMLInputElement) || node.type !== 'range') {
          return 0.5;
        }

        const [min, max] = [Number(node.min || 0), Number(node.max || 100)];

        return max > min ? (Number(node.value) - min) / (max - min) : 0.5;
      }, undefined);
      // The thumb travels the track less its own width, about the input's height: at its end it sits inside it.
      const thumb = Math.min(box.height, box.width);
      const [x, y] = [box.x + thumb / 2 + (box.width - thumb) * along, box.y + box.height / 2];
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + step.dx, y + step.dy, { steps: 12 });
      await page.mouse.up();
      return undefined;
    }

    // A click's answer from the server landed before what follows reads the page: a key lit by a vote's answer.
    const from = page.url();
    // A name several copies carry — a component's part, a list's row: the one pressed is said, and how to name another
    // (a run's tester toggled the wrong panel, the first of several section headers, and was told nothing).
    const copies = ROW.test(step.target) ? 1 : await page.evaluate(copiesOn, read.selector);
    try {
      await (step.kind === 'click'
        ? answered(page, () => patiently(page, () => shown(read.selector).click({ timeout: 3000 })))
        : patiently(page, () => shown(read.selector).click({ timeout: 3000 })));
    } catch (error) {
      // A click that took the page elsewhere did what it was for — what follows reads the page it went to (a run's
      // dev-1 read a plain locator timeout, with nothing of the navigation in it).
      if (page.url() !== from) {
        return undefined;
      }

      throw error;
    }
    // Typed into what has the focus: a click that left it on no field sent the text to the page's own shortcuts.
    if (step.kind === 'type') {
      const editable = await page.evaluate(() => {
        const focused = document.activeElement;

        return (
          focused instanceof HTMLElement && (focused.isContentEditable || focused.matches('input, textarea, select'))
        );
      }, undefined);
      if (!editable) {
        return {
          problem: `Step ${String(index + 1)}: clicking ${step.target} leaves no field focused, so the text would go to the page itself — name the field: type ".panel textarea" hola`
        };
      }

      for (const key of typedKeys(step.text)) {
        await ('press' in key ? page.keyboard.press(key.press) : page.keyboard.type(key.type));
      }
    }

    if (copies > 1) {
      return {
        answer: `${step.target} is on the page ${String(copies)} times: this pressed the first a visitor sees — ${step.target}:2 … ${step.target}:last names another`
      };
    }
  } else if (step.kind === 'press') {
    await page.keyboard.press(step.key);
  } else if (step.kind === 'wait') {
    await page.waitForTimeout(step.ms);
  } else if (step.kind === 'reload') {
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('[data-hydrated]', { timeout: 10_000 }).catch(() => undefined);
  } else if (step.kind === 'back') {
    await page.goBack({ waitUntil: 'load' });
    await page.waitForSelector('[data-hydrated]', { timeout: 10_000 }).catch(() => undefined);
  } else if (step.kind === 'goto') {
    // Its path on the page's own site: a play beside another site goes to that site's page of it.
    await page.goto(new URL(step.path, page.url()).href, { waitUntil: 'load' });
    await page.waitForSelector('[data-hydrated]', { timeout: 10_000 }).catch(() => undefined);
  } else if (step.kind === 'store') {
    const stored = await page.evaluate(
      ({ key, value }: { key: string; value: string }) => {
        try {
          localStorage.setItem(key, value);

          return true;
        } catch {
          return false;
        }
      },
      { key: step.key, value: step.value }
    );
    if (!stored) {
      return {
        problem: `Step ${String(index + 1)}: the page's localStorage refused the value — its storage is blocked`
      };
    }
  } else if (step.kind === 'state' || step.kind === 'source' || step.kind === 'attribute') {
    const written = await page.evaluate(
      ({
        method,
        key,
        value
      }: {
        method: string;
        key: string;
        value: unknown;
      }): 'no-inspector' | 'unheld' | { written: string } => {
        const inspector: unknown = Reflect.get(window, '__plitzi');
        const write: unknown =
          typeof inspector === 'object' && inspector !== null ? Reflect.get(inspector, method) : undefined;
        if (typeof write !== 'function') {
          return 'no-inspector';
        }

        // setSource says the source it wrote, or false when no store holds it; setState writes whatever key it is given.
        const done: unknown = Reflect.apply(write, inspector, [key, value]);

        return done === false ? 'unheld' : { written: typeof done === 'string' ? done : (key.split('.')[0] ?? key) };
      },
      {
        method: step.kind === 'state' ? 'setState' : step.kind === 'source' ? 'setSource' : 'setAttribute',
        key: step.key,
        value: step.value
      }
    );
    if (written === 'no-inspector') {
      return {
        problem: `Step ${String(index + 1)}: the page has no window.__plitzi${step.kind === 'source' ? '.setSource' : step.kind === 'attribute' ? '.setAttribute' : ''} to write its ${step.kind} with — the SDK's dev tools put it there on a development page (${projectRun('start:dev')}, debug mode)`
      };
    }

    const [name = step.key] = step.key.split('.');
    if (written === 'unheld' && step.kind === 'attribute') {
      return {
        problem: `Step ${String(index + 1)}: no element of the page is ${name} — its attribute is written on an element of the space by its id`
      };
    }

    if (written === 'unheld') {
      return {
        problem: `Step ${String(index + 1)}: no provider on the page holds a source named ${name}, nor one of an element by that id — page check --state lists those it has`
      };
    }

    // Written by its element's id: the source's own name said, as a binding reads it.
    if (step.kind === 'source' && written.written !== name) {
      return { answer: `${name} is the element: its source is ${written.written} — written there` };
    }
  } else if (step.kind === 'clock' || step.kind === 'tick') {
    if (!clockHeld(page)) {
      return {
        problem: `Step ${String(index + 1)}: ${step.kind} moves the page's clock, and nothing holds it — give the command --clock <instant> (2026-10-25T20:00:00Z), the clock the page starts with`
      };
    }

    await (step.kind === 'clock' ? page.clock.setSystemTime(step.time) : page.clock.runFor(step.ms));
  } else {
    await page.waitForSelector(awaited(step.target), { timeout: step.ms ?? 10_000 });
  }

  return undefined;
};

/**
 * A `--steps` script played on the page: what each step does, and every picture the script asks for — each labelled with
 * its step and the time since the first, and measured against the one before it, so "nothing changed" is said.
 */
export const playSteps = async (
  taken: Taken,
  how: Framing,
  steps: readonly ShotStep[],
  visitors?: Visitors
): Promise<
  { moments: Moment[]; changes: { label: string; changed: number; outside?: string[] }[] } | { problem: string }
> => {
  const { page } = taken;
  const started = Date.now();
  const moments: Moment[] = [{ label: 'before', png: taken.png }];
  const changes: { label: string; changed: number; outside?: string[] }[] = [];
  let pageBefore = await pageNow(page, how);
  const picture = async (label: string): Promise<void> => {
    const before = moments[moments.length - 1].png;
    const png = await capture(page, how);
    const at = `${label} · +${String(Date.now() - started)} ms`;
    moments.push({ label: at, png });
    const { changed } = await comparePictures(page, dataUrl(before), dataUrl(png));
    const outside = changed === 0 ? await outsideClip(page, pageBefore) : [];
    changes.push({ label: at, changed, ...(outside.length > 0 ? { outside } : {}) });
    pageBefore = await pageNow(page, how);
  };

  for (const [index, step] of steps.entries()) {
    try {
      if (step.kind !== 'shot' && step.kind !== 'frames') {
        const done = await actStep(page, step, index, visitors);
        if (done && 'problem' in done) {
          return done;
        }
      } else if (step.kind === 'shot') {
        await picture(step.label ?? `step ${String(index + 1)}`);
      } else {
        for (let frame = 1; frame <= step.count; frame += 1) {
          if (frame > 1) {
            await page.waitForTimeout(step.every);
          }

          await picture(`frame ${String(frame)}/${String(step.count)}`);
        }
      }
    } catch (error) {
      return { problem: `Step ${String(index + 1)} (${stepText(step)}) did not happen: ${stepFailure(error)}` };
    }
  }

  // What the steps leave is pictured, once still, when they end on an action: a run's `--steps "click <pill>"`
  // showed the menu shut — the picture before the click was the only one.
  if (endsActing(steps)) {
    await settle(page);
    await picture('after');
  }

  return { moments, changes };
};

/** Whether steps end on an action rather than a picture: what it leaves is then pictured once more. */
export const endsActing = (steps: readonly ShotStep[]): boolean => {
  const last = steps.at(-1);

  return last !== undefined && last.kind !== 'shot' && last.kind !== 'frames';
};

/**
 * The steps a command that reads a page plays before it reads it (`--steps` of `page check`, `measure`, `outline`): a
 * visitor's own, played as `page play` plays them — never a picture, which is `page shot`'s; never another account's
 * where the command has no other visitors' pages (`others: false`).
 */
export const actingSteps = (
  script: string | undefined,
  command: string,
  { others = true }: { others?: boolean } = {}
): ActingStep[] | { problem: string } => {
  const read = playingSteps(script, command, { others, pictures: false });

  return 'problem' in read ? read : read.filter((step): step is ActingStep => step.kind !== 'shot');
};

/** A picture taken where it stands among the steps — `shot [label]` — by a command that pictures as it plays. */
export type PictureStep = Extract<ShotStep, { kind: 'shot' }>;

/** A step `page play` plays: one acted, or a picture of the page where it stands. */
export type PlayStep = ActingStep | PictureStep;

/**
 * The steps a command plays, `pictures` saying whether it takes a `shot` where one stands (`page play`, which agents
 * asked five runs running for `--shot`) — `frames`, what moves, stays `page shot`'s.
 */
export const playingSteps = (
  script: string | undefined,
  command: string,
  { others = true, pictures = true }: { others?: boolean; pictures?: boolean } = {}
): PlayStep[] | { problem: string } => {
  const parsed = script === undefined ? [] : parseSteps(script, 500);
  if ('problem' in parsed) {
    return { problem: `--steps: ${parsed.problem}` };
  }

  const pictured = parsed.find(step => step.kind === 'frames' || (!pictures && step.kind === 'shot'));
  if (pictured) {
    return {
      problem: `${command} reads what the steps leave, with no ${pictured.kind === 'frames' ? 'frames' : 'picture'}: "${pictured.kind}" is page shot --steps${pictures ? '' : ' (page play takes a shot where it stands)'}`
    };
  }

  const acting = parsed.filter((step): step is PlayStep => step.kind !== 'frames');
  const another = others ? undefined : acting.find(step => step.kind === 'as');
  if (another?.kind === 'as') {
    return {
      problem: `${command} plays its visitor's own steps: "as ${another.account} …" is another account's — page play or page measure plays it`
    };
  }

  return acting;
};

/** The steps played on the page, each settled — or the one that could not be, said. */
export const playedOn = async (
  page: BrowserPage,
  steps: readonly ActingStep[],
  visitors?: Visitors
): Promise<{ problem: string } | undefined> => {
  for (const [index, step] of steps.entries()) {
    // A step whose element never answers — a click that waits past its time — is a step that did not happen, said in
    // a line: thrown, a run's look printed a TimeoutError's stack and went on to compare nothing.
    const done = await actStep(page, step, index, visitors).catch((error: unknown) => ({
      problem: `Step ${String(index + 1)} (${stepText(step)}) did not happen: ${stepFailure(error)}`
    }));
    if (done && 'problem' in done) {
      return done;
    }

    await settle(page);
  }

  return undefined;
};
