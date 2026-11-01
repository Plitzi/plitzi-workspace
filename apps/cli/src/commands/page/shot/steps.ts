import {
  bridge,
  comparePictures,
  dragElement,
  e2eStepText,
  hiddenAtWidth,
  playE2eStep,
  pressFailure,
  pressOnce,
  settle,
  shownCopy
} from '@plitzi/sdk-authoring';
import { isRecord } from '@plitzi/sdk-shared/helpers';

import { capture, targetOn } from './capture';
import { notOnPageText } from './notOnPage';
import { outsideClip, screenNow, shotNow, shotsCompared } from './scriptShots';
import { dataUrl } from '../../../browser';
import { clockHeld } from '../../../browser/conditions';
import { projectRun } from '../../../scaffold/packageManager';
import { hiddenWhyInPage } from '../measureOn';
import { parseSteps, widthRangeText } from '../shotSteps';

import type { BrowserPage } from '../../../browser';
import type { ShotStep } from '../shotSteps';
import type { ScriptShot } from './scriptShots';
import type { Framing, Moment, Taken } from './types';
import type { Visitors } from './visitors';
import type { Located } from '@plitzi/sdk-authoring';
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
      return { problem: `${target} is not on the page — ${await notOnPageText(taken.page, target, '--click')}` };
    }

    // Found and drawn nowhere — a sheet closed at this width: said as it is, never a press timed out.
    const all = taken.page.locator(read.selector);
    if ((await all.filter({ visible: true }).count()) === 0) {
      const why = await all
        .first()
        .evaluate(hiddenWhyInPage, undefined)
        .catch(() => 'not drawn');

      return {
        problem: `${target} is on the page and not shown here (${why}): nothing to click — open what holds it first (--click <its toggle> ${target}) or picture a width it shows at`
      };
    }

    const element = all.filter({ visible: true }).first();

    const before = moments[moments.length - 1].png;
    const pageBefore = await screenNow(taken.page, how);
    try {
      await pressOnce(taken.page, () => element.click({ timeout: 3000 }));
    } catch (error) {
      return { problem: `${target} could not be clicked: ${pressFailure(error)}` };
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

/** What a step is, as its label and `page play` say it: a journey's in its words, a page command's own its way. */
export const stepText = (step: ShotStep): string => {
  switch (step.kind) {
    case 'hold':
      return `drag ${step.element} ${String(step.dx)} ${String(step.dy)} hold`;
    case 'release':
      return 'release';
    case 'wait':
      return `wait ${String(step.ms)} ms`;
    case 'store':
      return `store ${step.key}`;
    case 'attribute':
      return `attribute ${step.key}`;
    case 'clock':
      return `clock ${new Date(step.time).toISOString()}`;
    case 'shot':
      return step.label ?? 'shot';
    case 'frames':
      return `frames ${String(step.count)}`;
    case 'action':
      return `${step.render ? 'render' : 'action'} ${step.action}`;
    case 'as':
      return `as ${step.account}: ${stepText(step.step)}`;
    case 'at':
      return `at ${widthRangeText(step.width)} ${stepText(step.step)}`;
    default:
      return e2eStepText(step);
  }
};

/** A step that acts on the page — every one but a picture: a press, a hover, a key, a wait, what must hold. */
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
 * Where a step's element is, as a journey's player reads it — a CSS selector and the copy — from what a page command
 * names: an element's name, a tag, a selector, a row (`room-card:2`), a section (`section#plans`).
 */
const locateOn = async (page: BrowserPage, target: string): Promise<Located | { problem: string }> => {
  const read = await targetOn(page, target);
  if ('problem' in read) {
    return read;
  }

  const nth = /^(.*) >> nth=(-?\d+)$/.exec(read.selector);

  return nth
    ? { selector: nth[1], copy: Number(nth[2]) < 0 ? 'last' : Number(nth[2]) + 1 }
    : { selector: read.selector, copy: undefined };
};

/**
 * One step played on a page — what `--steps` does between its pictures, and `page play` on each page it plays on — or
 * what kept it from happening, said by its step. A journey's step is played as `@plitzi/sdk-authoring` plays a journey;
 * a page command's own here. `visitors` holds the other accounts' pages a step `as` one plays on.
 */
export const actStep = async (
  page: BrowserPage,
  step: ActingStep,
  index: number,
  visitors?: Visitors
): Promise<{ problem: string } | { answer: string; output?: unknown } | undefined> => {
  const failed = (why: string): { problem: string } => ({ problem: `Step ${String(index + 1)}: ${why}` });
  switch (step.kind) {
    case 'as': {
      const theirs = visitors
        ? await visitors.pageOf(step.account, `${new URL(page.url()).pathname}${new URL(page.url()).search}`)
        : { problem: 'another account plays only against the project’s own server' };
      if ('problem' in theirs) {
        return failed(theirs.problem);
      }

      const done = await actStep(theirs, step.step, index);
      if (done !== undefined && 'problem' in done) {
        return { problem: `${done.problem} (as ${step.account})` };
      }

      // What it did reaches this page through the server — a message, a count: given the moment it takes.
      await settle(page);

      return done;
    }
    // Played at the widths it names, passed over at the others — said, for whoever reads the steps one by one.
    case 'at': {
      const width = await page.evaluate(() => window.innerWidth, undefined);

      return width >= step.width.min && width <= step.width.max
        ? actStep(page, step.step, index, visitors)
        : { answer: `not played at ${String(width)} px — at ${widthRangeText(step.width)} only` };
    }
    case 'action': {
      const ran = await runAction(page, step.action, step.input, step.render === true);

      return 'refused' in ran ? failed(ran.refused) : ran;
    }
    // The finger a `drag … hold` kept down, let go where it is.
    case 'release':
      await page.mouse.up();

      return undefined;
    // Kept down, for what follows to read the page mid-drag, until a `release` or the page closes.
    case 'hold': {
      const where = await locateOn(page, step.element);
      const found = 'problem' in where ? where : await shownCopy(page, where.selector, where.copy);
      if ('problem' in found || 'absent' in found) {
        return failed('problem' in found ? found.problem : `${step.element} is not on the page`);
      }

      if ('hidden' in found) {
        return failed(hiddenAtWidth(step.element, 'drag'));
      }

      const why =
        'problem' in where
          ? undefined
          : await dragElement(page, found.element, where.selector, { dx: step.dx, dy: step.dy, held: true });

      return why === undefined ? undefined : failed(`${step.element}: ${why}`);
    }
    case 'wait':
      await page.waitForTimeout(step.ms);

      return undefined;
    case 'store': {
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

      return stored ? undefined : failed("the page's localStorage refused the value — its storage is blocked");
    }
    case 'attribute': {
      const written = await bridge(page, { method: 'setAttribute', args: [step.key, step.value] });
      if (written === 'none') {
        return failed(
          `the page has no window.__plitzi.setAttribute to write it with — the SDK's dev tools put it there on a development page (${projectRun('start:dev')}, debug mode)`
        );
      }

      if (isRecord(written.answer) && typeof written.answer.refused === 'string') {
        return failed(written.answer.refused);
      }

      return written.answer === false
        ? failed(
            `no element of the page is ${step.key.split('.')[0] ?? step.key} — an attribute is written by its element's id: map.storms`
          )
        : undefined;
    }
    case 'clock':
      if (!clockHeld(page)) {
        return failed(
          "it sets the page's clock, and nothing holds it — give the command --clock <instant> (2026-10-25T20:00:00Z), the clock the page starts with"
        );
      }

      await page.clock.setSystemTime(step.time);

      return undefined;
    default: {
      // A journey's step, played as a journey plays it: its element named the way this command names one.
      const done = await playE2eStep(page, step, {
        origin: new URL(page.url()).origin,
        clockHeld: clockHeld(page),
        locate: target => locateOn(page, target),
        notOnPage: async target =>
          `${await notOnPageText(page, target, 'a step before it')}; a selector with spaces is written in quotes: type ".panel textarea" hola`
      });

      return done === undefined
        ? undefined
        : 'problem' in done
          ? { problem: `Step ${String(index + 1)} (${stepText(step)}): ${done.problem}` }
          : { answer: done.note };
    }
  }
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
  // The screen the first picture's surroundings are read against, taken before the steps' clock starts.
  const start = how.kind === 'element' || how.kind === 'element-later' ? await shotNow(page, how, 'before') : undefined;
  const started = Date.now();
  // Taken as the steps reach them, set beside each other once they are played: a picture is the moment, nothing more.
  const shots: ScriptShot[] = [];
  const picture = async (label: string): Promise<void> => {
    shots.push(await shotNow(page, how, `${label} · +${String(Date.now() - started)} ms`));
  };

  for (const [index, step] of steps.entries()) {
    try {
      if (step.kind !== 'shot' && step.kind !== 'frames') {
        const done = await actStep(page, step, index, visitors);
        if (done && 'problem' in done) {
          return done;
        }

        // Settled before the next action, as every other command plays them: a run's `click filters-toggle; click
        // window-month` found the month's button "hidden at this width" mid-opening, where `page measure` pressed it.
        // Before a picture it is not: `frames` is for what moves.
        const next = steps.at(index + 1);
        if (next !== undefined && next.kind !== 'shot' && next.kind !== 'frames') {
          await settle(page);
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
      return { problem: `Step ${String(index + 1)} (${stepText(step)}) did not happen: ${pressFailure(error)}` };
    }
  }

  // What the steps leave is pictured, once still, when they end on an action: a run's `--steps "click <pill>"`
  // showed the menu shut — the picture before the click was the only one.
  if (endsActing(steps)) {
    await settle(page);
    await picture('after');
  }

  return shotsCompared(page, { png: taken.png, ...(start ? { screen: start } : {}) }, shots);
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
  { others = true, widths }: { others?: boolean; widths?: readonly number[] } = {}
): ActingStep[] | { problem: string } => {
  const read = playingSteps(script, command, { others, pictures: false, ...(widths ? { widths } : {}) });

  return 'problem' in read ? read : read.filter((step): step is ActingStep => step.kind !== 'shot');
};

/** A picture taken where it stands among the steps — `shot [label]` — by a command that pictures as it plays. */
export type PictureStep = Extract<ShotStep, { kind: 'shot' }>;

/** A step `page play` plays: one acted, or a picture of the page where it stands. */
export type PlayStep = ActingStep | PictureStep;

/**
 * The first step `at` widths none of `widths` falls in, said: played at no width the command reads, it would never be
 * played, and nothing would say so.
 */
export const atNoWidthRead = (steps: readonly ShotStep[], widths: readonly number[]): string | undefined => {
  const index = steps.findIndex(
    step => step.kind === 'at' && !widths.some(width => width >= step.width.min && width <= step.width.max)
  );

  return index < 0
    ? undefined
    : `step ${String(index + 1)} (${stepText(steps[index])}) is played at none of the widths read — ${widths.join(', ')} px: read at a width it names (--width), or name one read`;
};

/**
 * The steps a command plays, `pictures` saying whether it takes a `shot` where one stands (`page play`, which agents
 * asked five runs running for `--shot`) — `frames`, what moves, stays `page shot`'s. `widths`: those the command reads
 * at, which every step `at` must name one of — left out where the command the steps are handed to checks them.
 */
export const playingSteps = (
  script: string | undefined,
  command: string,
  { others = true, pictures = true, widths }: { others?: boolean; pictures?: boolean; widths?: readonly number[] } = {}
): PlayStep[] | { problem: string } => {
  const parsed = script === undefined ? [] : parseSteps(script, 500);
  if ('problem' in parsed) {
    return { problem: `--steps: ${parsed.problem}` };
  }

  const nowhere = widths ? atNoWidthRead(parsed, widths) : undefined;
  if (nowhere) {
    return { problem: `--steps: ${nowhere}` };
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
      problem: `Step ${String(index + 1)} (${stepText(step)}) did not happen: ${pressFailure(error)}`
    }));
    if (done && 'problem' in done) {
      return done;
    }

    await settle(page);
  }

  return undefined;
};
