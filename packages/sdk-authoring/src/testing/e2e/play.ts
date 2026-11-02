import { isRecord } from '@plitzi/sdk-shared/helpers';
import { sameValue } from '@plitzi/sdk-shared/history';

import { answered, dragElement, giveValue, hiddenAtWidth, shownCopy } from './act';
import { awaitHydration, fieldsOf, hoverElement, pressOnce, settle, targetOf } from './page';
import { parseRelation, relationElements, relationHolds, sidePx } from './position';
import { openPage } from '../settle';
import { runUnitTest } from '../unit/run';

import type { Copy } from './act';
import type { E2ePage } from './page';
import type { Box } from './position';
import type { E2eAction, E2eExpectation, E2eStep, Schema, SignedInTestAccount } from '@plitzi/sdk-shared';

/**
 * One step of a journey played on a page — the one way it is played, whoever plays it: a journey of the space (its
 * elements by id) and a page command's `--steps` (by any selector too). What a run of either learns — a page not
 * hydrated yet, a press made once, a point of a canvas, a copy hidden at this width — the other has.
 */

/** Where a step's element is: a CSS selector, and which of what it finds (`Copy`: the first shown when none). */
export interface Located {
  selector: string;
  copy: Copy;
}

export interface StepPlay {
  /** Where `goto` opens a path: the space's origin. */
  origin: string;
  /** Whether the page's clock is held: `tick` moves it only then. */
  clockHeld: boolean;
  /** The test account it plays as, said again after every load: a load forgets it. */
  account?: SignedInTestAccount;
  /** The document an `expect-check` is read from. */
  space?: Schema;
  /** How long an expectation is held before it fails, in ms. 5 s. */
  expectMs?: number;
  /** Where a step's element is — a journey's by its id (`targetOf`); a page command's by its name or a selector. */
  locate?: (target: string) => Promise<Located | { problem: string }>;
  /** What is said of an element not on the page — how else to name it, what makes it: a page command's hint. */
  notOnPage?: (target: string) => Promise<string>;
}

/** What became of a step: why it did not happen or does not hold, a note worth saying of one that did, or nothing. */
export type StepPlayed = { problem: string } | { note: string } | undefined;

/** How long a `wait-for` waits when it says nothing. */
const WAIT_FOR_MS = 10_000;

const NO_BRIDGE =
  "the page has no window.__plitzi — the SDK's dev tools put it there in debug mode: the space's state is read and set through it";

/** What the page says of one element, read in the page: found, shown, its words, an attribute, a property, its box. */
interface ElementRead {
  found: boolean;
  shown: boolean;
  text: string;
  attribute: string | null;
  style: string;
  box: Box | null;
}

/**
 * Runs in the page, on the element its driver found — any selector it reads, `:has-text()` too — so it is self-contained:
 * whether a visitor sees it, its words, an attribute, a property, its box.
 */
function readNodeInPage(
  node: Element,
  { attribute, property }: { attribute: string | null; property: string | null }
): Omit<ElementRead, 'found'> {
  const rect = node.getBoundingClientRect();

  return {
    shown:
      node.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && rect.width > 0 && rect.height > 0,
    text: node.textContent.replace(/\s+/g, ' ').trim(),
    attribute: attribute === null ? null : node.getAttribute(attribute),
    style: property === null ? '' : getComputedStyle(node).getPropertyValue(property),
    box: { x: rect.x + scrollX, y: rect.y + scrollY, width: rect.width, height: rect.height }
  };
}

/** What a scroll step names to move the page itself, not an element of it. */
export const PAGE_SCROLLER: ReadonlySet<string> = new Set(['page', 'window']);

/** Runs in the page, on the element: brought into view, or its own content scrolled by so much — and whether it moved. */
function scrollNodeInPage(
  node: Element,
  by: { dx: number; dy: number } | null
): { moved: boolean; across: number; down: number } {
  if (by === null) {
    node.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });

    return { moved: true, across: 0, down: 0 };
  }

  // In view first: a picture after it shows the box it scrolled, never the page's top a run's step left it at.
  node.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
  const [left, top] = [node.scrollLeft, node.scrollTop];
  node.scrollBy({ left: by.dx, top: by.dy, behavior: 'instant' });

  return {
    moved: node.scrollLeft !== left || node.scrollTop !== top,
    across: node.scrollWidth - node.clientWidth,
    down: node.scrollHeight - node.clientHeight
  };
}

/**
 * Runs in the page, on the element a point of which is pressed: what is drawn at the point, when it is an element of its
 * own — neither a canvas nor what holds one, nor the element itself — said as a selector names it, with its first words.
 */
function pointHitInPage(
  node: Element,
  { x, y }: { x: number; y: number }
): { said: string; words: string } | undefined {
  const hit = node.ownerDocument.elementFromPoint(x, y);
  if (!hit || hit === node || hit.localName === 'canvas' || hit.querySelector('canvas')) {
    return undefined;
  }

  const name = hit.getAttribute('data-plitzi-el');
  const said = name
    ? `[data-plitzi-el="${name}"]`
    : hit.id
      ? `#${hit.id}`
      : `${hit.localName}${Array.from(hit.classList, each => `.${each}`)
          .slice(0, 2)
          .join('')}`;

  return { said, words: hit.textContent.replace(/\s+/g, ' ').trim().slice(0, 40) };
}

/** What the dev tools' page bridge answers (`window.__plitzi`, debug mode): the state, a source, set or read. */
export const bridge = (
  page: E2ePage,
  call: { method: string; args: unknown[] }
): Promise<{ answer: unknown } | 'none'> =>
  page.evaluate(({ method, args }: { method: string; args: unknown[] }) => {
    const inspector: unknown = Reflect.get(window, '__plitzi');
    const fn: unknown =
      typeof inspector === 'object' && inspector !== null ? Reflect.get(inspector, method) : undefined;
    if (typeof fn !== 'function') {
      return 'none' as const;
    }

    const answer: unknown = Reflect.apply(fn, inspector, args);

    return { answer };
  }, call);

/** Where the page is: its path and query, as a link to it is written. */
export const whereNow = (page: E2ePage): Promise<string> =>
  page.evaluate(() => `${window.location.pathname}${window.location.search}`, undefined);

/**
 * The page's visitor signed in as the journey's test account, and the page moved to `path` as a link moves it — where a
 * page for signed-in visitors sent a guest to sign in — or why not. Said again after every load: a load forgets it.
 */
export const asAccount = async (
  page: E2ePage,
  account: SignedInTestAccount,
  path: string
): Promise<string | undefined> => {
  // Signed in and moved in one step, drawn as one: the page it was on is never drawn signed in — a page for signed-out
  // visitors, where a page for signed-in ones sent a guest, sends whoever is signed in on, out of the space.
  const signed = await bridge(page, { method: 'signInAs', args: [account, path] });
  if (signed === 'none') {
    return `it plays as ${account.id}, signed in through window.__plitzi — which the SDK's dev tools put on a page in debug mode, and this page has none`;
  }

  if (isRecord(signed.answer) && typeof signed.answer.refused === 'string') {
    return `it plays as ${account.id}: ${signed.answer.refused}`;
  }

  await settle(page);

  return undefined;
};

/** Where a step's element is, the way the player names elements: by id when it says no other. */
const located = (ctx: StepPlay, target: string): Promise<Located | { problem: string }> =>
  ctx.locate ? ctx.locate(target) : Promise.resolve(targetOf(target));

const readOf = async (
  page: E2ePage,
  ctx: StepPlay,
  target: string,
  { attribute = null, property = null }: { attribute?: string | null; property?: string | null } = {}
): Promise<ElementRead | { problem: string }> => {
  const where = await located(ctx, target);
  if ('problem' in where) {
    return where;
  }

  // The copy a press would act on — the one named, else the first shown — or, shown nowhere, the one named or the first.
  const found = await shownCopy(page, where.selector, where.copy);
  if ('absent' in found) {
    return { found: false, shown: false, text: '', attribute: null, style: '', box: null };
  }

  const all = page.locator(where.selector);
  const element =
    'element' in found
      ? found.element
      : where.copy === undefined
        ? all.first()
        : where.copy === 'last'
          ? all.last()
          : all.nth(where.copy - 1);

  return { found: true, ...(await element.evaluate(readNodeInPage, { attribute, property })) };
};

/** An element not on the page, said with the player's hint when it has one. */
const absent = async (ctx: StepPlay, target: string): Promise<string> =>
  `${target} is not on the page${ctx.notOnPage ? ` — ${await ctx.notOnPage(target)}` : ''}`;

/** A point of a box, in px from its top left as a driver takes it: inside the box, its far edge included. */
const positionOf = (
  box: { width: number; height: number } | null,
  point: { x: number; y: number } | undefined
): { position?: { x: number; y: number } } =>
  box && point
    ? {
        position: {
          x: Math.min(Math.max(0, box.width - 1), (box.width * point.x) / 100),
          y: Math.min(Math.max(0, box.height - 1), (box.height * point.y) / 100)
        }
      }
    : {};

/** One action played, or why it could not be — and, of a press on one of several copies, which one. */
const act = async (page: E2ePage, step: E2eAction, ctx: StepPlay): Promise<StepPlayed> => {
  // The page itself scrolled, as a visitor's wheel does: a scroll-driven piece read at each place of it (a run's agents
  // wrote `scroll 1500` and `scroll window 0 1500`, and guessed `scroll html` at last).
  if (step.kind === 'scroll' && PAGE_SCROLLER.has(step.element)) {
    const moved = await page.evaluate(
      ({ dx, dy }) => {
        const [left, top] = [window.scrollX, window.scrollY];
        window.scrollBy({ left: dx, top: dy, behavior: 'instant' });

        return window.scrollX !== left || window.scrollY !== top;
      },
      { dx: step.dx ?? 0, dy: step.dy ?? 0 }
    );

    return moved
      ? undefined
      : { problem: 'the page did not scroll — it fits the screen that way, or was at that end already' };
  }

  switch (step.kind) {
    case 'click':
    case 'hover':
    case 'type':
    case 'scroll':
    case 'drag': {
      const late = await awaitHydration(page);
      if (late !== undefined) {
        return { problem: `not played: ${late}` };
      }

      const where = await located(ctx, step.element);
      if ('problem' in where) {
        return where;
      }

      // A select is chosen, a date set and a file picked, not typed into: the element named, or the one inside it a
      // control wraps.
      const given = step.kind === 'type' ? await giveValue(page, where.selector, step.text, where.copy) : undefined;
      if (given && 'problem' in given) {
        return given;
      }

      if (given) {
        break;
      }

      const found = await shownCopy(page, step.kind === 'type' ? fieldsOf(where.selector) : where.selector, where.copy);
      if ('absent' in found) {
        return {
          problem:
            step.kind === 'type' && 'element' in (await shownCopy(page, where.selector, where.copy))
              ? `${step.element} is no field and holds none — a type step writes in an input, a text area or a select`
              : await absent(ctx, step.element)
        };
      }

      if ('hidden' in found) {
        return { problem: hiddenAtWidth(step.element, step.kind) };
      }

      const { element, copies } = found;
      if (step.kind === 'scroll') {
        // Nothing to move it by — left out, or 0 both ways as an editor's number fields write it — is into view.
        const by = !step.dx && !step.dy ? null : { dx: step.dx ?? 0, dy: step.dy ?? 0 };
        const moved = await element.evaluate(scrollNodeInPage, by);
        if (!moved.moved) {
          return {
            problem: `${step.element} did not scroll — ${moved.across <= 0 && moved.down <= 0 ? 'its content fits its box, so nothing in it scrolls (the row that scrolls may be one inside it)' : `it scrolls ${String(Math.max(0, moved.across))} px across and ${String(Math.max(0, moved.down))} px down at most, and was at that end already`}`
          };
        }

        break;
      }

      if (step.kind === 'drag') {
        const why = await dragElement(page, element, where.selector, { dx: step.dx, dy: step.dy });
        if (why !== undefined) {
          return { problem: `${step.element}: ${why}` };
        }

        break;
      }

      const point = step.kind === 'type' ? undefined : step.point;
      const box = point ? await element.boundingBox() : null;
      const position = positionOf(box, point);
      // A point is for what a canvas draws: what is drawn there as HTML — a map's marker — has a name of its own.
      const named =
        box && position.position
          ? await element.evaluate(pointHitInPage, { x: box.x + position.position.x, y: box.y + position.position.y })
          : undefined;
      const from = await whereNow(page);
      try {
        // A click's answer from the server landed before what follows reads the page: a key lit by a vote's answer.
        await (step.kind === 'click'
          ? answered(page, () => pressOnce(page, () => element.click({ timeout: 3000, ...position })))
          : pressOnce(page, () =>
              step.kind === 'hover'
                ? hoverElement(element, { timeout: 3000, ...position })
                : element.fill(step.text, { timeout: 3000 })
            ));
      } catch (error) {
        // A click that took the page elsewhere did what it was for: what follows reads the page it went to.
        if (step.kind !== 'click' || (await whereNow(page).catch(() => from)) === from) {
          throw error;
        }
      }

      await settle(page);

      const notes = [
        ...(copies > 1 && where.copy === undefined
          ? [
              `${step.element} is on the page ${String(copies)} times: this ${step.kind === 'type' ? 'typed in' : step.kind === 'hover' ? 'pointed at' : 'pressed'} the first a visitor sees — ${step.element}:2 … ${step.element}:last names another`
            ]
          : []),
        ...(named === undefined
          ? []
          : [
              `the point landed on ${named.said}${named.words ? ` ("${named.words}")` : ''}, drawn as HTML: name it — ${step.kind} '${named.said}' — and the ${step.kind === 'click' ? 'press' : 'pointer'} finds it wherever it is; a point is for what a canvas draws`
            ])
      ];

      return notes.length > 0 ? { note: notes.join('; ') } : undefined;
    }
    case 'press':
      await page.keyboard.press(step.key);
      break;
    case 'waitFor': {
      const until = Date.now() + (step.ms ?? WAIT_FOR_MS);
      for (;;) {
        const read = await readOf(page, ctx, step.element);
        if ('problem' in read) {
          return read;
        }

        if (read.shown) {
          break;
        }

        if (Date.now() > until) {
          return {
            problem: `${step.element} was not ${read.found ? 'shown' : 'on the page'} within ${String((step.ms ?? WAIT_FOR_MS) / 1000)} s`
          };
        }

        await page.waitForTimeout(100);
      }

      break;
    }
    case 'goto':
    case 'back':
    case 'reload': {
      const reloaded = step.kind === 'reload' ? await whereNow(page) : undefined;
      await (step.kind === 'goto'
        ? openPage(page, new URL(step.path, ctx.origin).href)
        : step.kind === 'back'
          ? page.goBack({ waitUntil: 'load' })
          : page.reload({ waitUntil: 'load' }));
      const late = await awaitHydration(page);
      if (late !== undefined) {
        return { problem: late };
      }

      if (!ctx.account) {
        return undefined;
      }

      const signed = await asAccount(
        page,
        ctx.account,
        step.kind === 'goto' ? step.path : (reloaded ?? (await whereNow(page)))
      );

      return signed === undefined ? undefined : { problem: signed };
    }
    case 'setState':
    case 'setSource': {
      const set =
        step.kind === 'setState'
          ? await bridge(page, { method: 'setState', args: [step.key, step.value] })
          : await bridge(page, { method: 'setSource', args: [step.path, step.value] });
      if (set === 'none') {
        return { problem: NO_BRIDGE };
      }

      if (step.kind === 'setSource' && set.answer === false) {
        return {
          problem: `no source of the page is ${step.path} — a source is written by its element's id: apiContainer_feed.items`
        };
      }

      // Written where the page would not draw it — a list row's item: the bridge says why, and the step fails with it.
      if (isRecord(set.answer) && typeof set.answer.refused === 'string') {
        return { problem: set.answer.refused };
      }

      break;
    }
    case 'tick':
      if (!ctx.clockHeld) {
        return {
          problem:
            "it moves the page's clock, and nothing holds it — a journey's own clock, or a page command's --clock <instant> (2026-10-25T20:00:00Z)"
        };
      }

      await page.clock.runFor(step.ms);
      break;
  }

  await settle(page);

  return undefined;
};

/**
 * Why an element check of the space does not hold for the page as it is now — its element resolved for the page's state
 * and sources, the sources the check names itself laid over them — or nothing when it does.
 */
const checkHeld = async (page: E2ePage, id: string, space: Schema | undefined): Promise<string | undefined> => {
  const check = space?.tests?.unit?.find(each => each.id === id);
  if (!space || !check) {
    return space
      ? `no element check of the space is "${id}"`
      : 'this player was given no document to read the space’s element checks from';
  }

  const [state, sources] = await Promise.all([
    bridge(page, { method: 'state', args: [] }),
    bridge(page, { method: 'sources', args: [] })
  ]);
  if (state === 'none' || sources === 'none') {
    return NO_BRIDGE;
  }

  const live = isRecord(sources.answer) ? sources.answer : {};
  const result = runUnitTest(space, {
    ...check,
    given: {
      state: isRecord(state.answer) ? state.answer : {},
      sources: {
        ...Object.fromEntries(Object.entries(live).filter(([name]) => name !== 'state')),
        ...check.given?.sources
      }
    }
  });

  return result.ok ? undefined : (result.problem ?? result.misses.join('; '));
};

/** What an expectation read, when it does not hold — or nothing when it does. */
const unheld = async (page: E2ePage, step: E2eExpectation, ctx: StepPlay): Promise<string | undefined> => {
  switch (step.kind) {
    case 'expectShown':
    case 'expectHidden': {
      const read = await readOf(page, ctx, step.element);
      if ('problem' in read) {
        return read.problem;
      }

      const wanted = step.kind === 'expectShown';

      return read.shown === wanted
        ? undefined
        : read.found
          ? read.shown
            ? 'it is shown'
            : 'it is hidden'
          : 'it is not on the page';
    }
    case 'expectText': {
      const read = await readOf(page, ctx, step.element);
      if ('problem' in read) {
        return read.problem;
      }

      if (!read.found) {
        return 'it is not on the page';
      }

      const holds = step.exact ? read.text === step.text : read.text.includes(step.text);

      return holds ? undefined : `it reads "${read.text.slice(0, 120)}"`;
    }
    case 'expectAttribute': {
      const read = await readOf(page, ctx, step.element, { attribute: step.name });
      if ('problem' in read) {
        return read.problem;
      }

      return read.attribute === step.value
        ? undefined
        : read.found
          ? `it is ${JSON.stringify(read.attribute)}`
          : 'it is not on the page';
    }
    case 'expectStyle': {
      const read = await readOf(page, ctx, step.element, { property: step.property });
      if ('problem' in read) {
        return read.problem;
      }

      if (!read.found) {
        return 'it is not on the page';
      }

      const holds =
        step.at === undefined
          ? read.style.trim() === step.value.trim()
          : step.at === '>='
            ? Number.parseFloat(read.style) >= Number.parseFloat(step.value)
            : Number.parseFloat(read.style) <= Number.parseFloat(step.value);

      return holds ? undefined : `it is ${read.style || 'nothing'}`;
    }
    case 'expectState': {
      const read = await bridge(page, { method: 'state', args: [step.key] });
      if (read === 'none') {
        return NO_BRIDGE;
      }

      return sameValue(read.answer, step.value)
        ? undefined
        : `it is ${read.answer === undefined ? 'nothing' : JSON.stringify(read.answer)}`;
    }
    case 'expectCheck':
      return checkHeld(page, step.check, ctx.space);
    case 'expectPosition': {
      const relation = parseRelation(step.relation);
      if ('problem' in relation) {
        return relation.problem;
      }

      const boxes = new Map<string, Box>();
      for (const element of relationElements(relation)) {
        const read = await readOf(page, ctx, element);
        if (!('problem' in read) && read.shown && read.box) {
          boxes.set(element, read.box);
        }
      }

      const [left, right] = [sidePx(relation.left, id => boxes.get(id)), sidePx(relation.right, id => boxes.get(id))];
      if (typeof left !== 'number' || typeof right !== 'number') {
        const missing = typeof left === 'number' ? (typeof right === 'number' ? '' : right.missing) : left.missing;

        return `${missing} has no box — not on the page, or hidden`;
      }

      return relationHolds(left, relation.at, right)
        ? undefined
        : `${String(Math.round(left * 10) / 10)} ${relation.at} ${String(Math.round(right * 10) / 10)} does not hold`;
    }
  }
};

/** An expectation held for its time: read again until it holds, or the time is up and what it read is said. */
const expectHeld = async (page: E2ePage, step: E2eExpectation, ctx: StepPlay): Promise<string | undefined> => {
  const until = Date.now() + (ctx.expectMs ?? 5000);
  let read = await unheld(page, step, ctx);
  while (read !== undefined && read !== NO_BRIDGE && Date.now() < until) {
    await page.waitForTimeout(100);
    read = await unheld(page, step, ctx);
  }

  return read;
};

const EXPECTATIONS: ReadonlySet<E2eStep['kind']> = new Set([
  'expectShown',
  'expectHidden',
  'expectText',
  'expectState',
  'expectAttribute',
  'expectStyle',
  'expectPosition',
  'expectCheck'
]);

/** Whether a step is something that must hold, not something done. */
export const isExpectation = (step: E2eStep): step is E2eExpectation => EXPECTATIONS.has(step.kind);

/**
 * One step of a journey played on the page: an action done, or an expectation held for its time — what it read said when
 * it does not hold (`expect-text cart-count = 1`: `it reads "0"`).
 */
export const playE2eStep = async (page: E2ePage, step: E2eStep, ctx: StepPlay): Promise<StepPlayed> => {
  if (!isExpectation(step)) {
    return act(page, step, ctx);
  }

  const read = await expectHeld(page, step, ctx);

  return read === undefined ? undefined : { problem: read };
};
