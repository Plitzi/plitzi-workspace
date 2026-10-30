import { sameValue } from '@plitzi/sdk-shared/history';

import { answered, dragElement, giveValue, hiddenAtWidth, shownCopy } from './act';
import { awaitHydration, fieldsOf, pressFailure, pressOnce, settle, targetId, targetOf } from './page';
import { parseRelation, relationElements, relationHolds, sidePx } from './position';
import { answerAction } from '../answerAction';
import { openPage } from '../settle';

import type { E2ePage } from './page';
import type { Box } from './position';
import type { E2eAction, E2eExpectation, E2eStep, E2eTest } from '@plitzi/sdk-shared';

/**
 * An e2e test run in a browser: its page opened as a visitor's, each step played as the CLI learnt to play
 * one — after the space hydrates, pressed once, the page settled before the next — and each expectation held for its
 * time before it fails, saying what it read.
 */

export interface E2eStepResult {
  /** The step, as a person reads it: `click add-flat-white`, `cart-count shows "1"`. */
  said: string;
  ok: boolean;
  /** What a failed step read, or why it could not be played. */
  read?: string;
  /** Not played: a step before it failed. */
  notRun?: true;
  ms: number;
  /** What `onStep` kept of the page once it was played: a picture, as a data URL. */
  frame?: string;
}

export interface E2eResult {
  id: string;
  title: string;
  ok: boolean;
  ms: number;
  steps: E2eStepResult[];
  /** Why it could not start: the page did not open, or never hydrated. */
  problem?: string;
  /** Stopped by whoever ran it (`signal`) before its last step: the steps after are not run, and it did not pass. */
  stopped?: true;
}

export interface E2eRunOptions {
  /** Where the space is served: `http://127.0.0.1:8080` — what the test's page and a `goto` step are opened on. */
  origin: string;
  /**
   * Opens the test's page the caller's way, in place of opening its path on `origin`: a harness rendering the document
   * in a page already open, the builder's own canvas. The space is still waited for to hydrate.
   */
  open?: (page: E2ePage) => Promise<void>;
  /** How long an expectation is held before it fails, in ms. 5 s, as an assertion's own retry. */
  expectMs?: number;
  /**
   * Told after each step played, with what became of it — and asked for what to keep of the page then: a picture, for a
   * run replayed step by step (the builder's device frame). What it answers is kept on the step as `frame`.
   */
  onStep?: (page: E2ePage, step: E2eStepResult, index: number) => Promise<string | undefined>;
  /** The window's height, in px. 900. */
  height?: number;
  /**
   * Waited for before each step is played: a player shows the step about to be played, and holds it there while it is
   * paused or played a step at a time.
   */
  beforeStep?: (step: E2eStep, index: number) => Promise<void>;
  /** Stops the run before its next step: the rest said as not run, the run as stopped. */
  signal?: AbortSignal;
}

/** A step in words. */
export const stepText = (step: E2eStep): string => {
  switch (step.kind) {
    case 'click':
    case 'hover':
      return `${step.kind} ${step.element}`;
    case 'type':
      return `type "${step.text}" in ${step.element}`;
    case 'press':
      return `press ${step.key}`;
    case 'scroll':
      return `scroll ${step.element} by ${String(step.dx ?? 0)}, ${String(step.dy ?? 0)}`;
    case 'drag':
      return `drag ${step.element} by ${String(step.dx)}, ${String(step.dy)}`;
    case 'waitFor':
      return `wait for ${step.element}`;
    case 'goto':
      return `go to ${step.path}`;
    case 'back':
    case 'reload':
      return step.kind;
    case 'setState':
      return `state ${step.key} set to ${JSON.stringify(step.value)}`;
    case 'setSource':
      return `source ${step.path} set to ${JSON.stringify(step.value)}`;
    case 'tick':
      return `the clock moved ${String(step.ms)} ms`;
    case 'expectShown':
      return `${step.element} shown`;
    case 'expectHidden':
      return `${step.element} hidden`;
    case 'expectText':
      return `${step.element} ${step.exact ? 'reads' : 'shows'} "${step.text}"`;
    case 'expectState':
      return `state ${step.key} is ${JSON.stringify(step.value)}`;
    case 'expectAttribute':
      return `${step.element}[${step.name}] is "${step.value}"`;
    case 'expectStyle':
      return `${step.element} ${step.property} ${step.at ?? '='} ${step.value}`;
    case 'expectPosition':
      return step.relation;
  }
};

/** What the page says of one element, read in the page: found, shown, its words, an attribute, a property, its box. */
interface ElementRead {
  found: boolean;
  shown: boolean;
  text: string;
  attribute: string | null;
  style: string;
  box: Box | null;
}

/** Runs in the page, so it is self-contained: no import, nothing it closes over. */
function readInPage({
  id,
  copy,
  attribute,
  property
}: {
  id: string;
  copy: string | null;
  attribute: string | null;
  property: string | null;
}): ElementRead {
  const all = [...document.querySelectorAll(`[data-plitzi-el="${CSS.escape(id)}"]`)];
  const node = copy === null ? all[0] : copy === 'last' ? all.at(-1) : all[Number(copy) - 1];
  if (!node) {
    return { found: false, shown: false, text: '', attribute: null, style: '', box: null };
  }

  const rect = node.getBoundingClientRect();
  const shown =
    node.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && rect.width > 0 && rect.height > 0;

  return {
    found: true,
    shown,
    text: node.textContent.replace(/\s+/g, ' ').trim(),
    attribute: attribute === null ? null : node.getAttribute(attribute),
    style: property === null ? '' : getComputedStyle(node).getPropertyValue(property),
    box: { x: rect.x + scrollX, y: rect.y + scrollY, width: rect.width, height: rect.height }
  };
}

const readOf = async (
  page: E2ePage,
  target: string,
  { attribute = null, property = null }: { attribute?: string | null; property?: string | null } = {}
): Promise<ElementRead> => {
  const copy = /:(\d+|last)$/.exec(target)?.[1] ?? null;

  return page.evaluate(readInPage, { id: targetId(target), copy, attribute, property });
};

/** What the dev tools' page bridge answers (`window.__plitzi`, debug mode): the state, a source, set or read. */
const bridge = (page: E2ePage, call: { method: string; args: unknown[] }): Promise<{ answer: unknown } | 'none'> =>
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

const NO_BRIDGE =
  "the page has no window.__plitzi — the SDK's dev tools put it there in debug mode: the space's state is read and set through it";

/** One action played, or why it could not be. */
const act = async (page: E2ePage, step: E2eAction, origin: string, clockHeld: boolean): Promise<string | undefined> => {
  const missing = async (target: string): Promise<string | undefined> =>
    (await readOf(page, target)).found ? undefined : `${target} is not on the page`;
  switch (step.kind) {
    case 'click':
    case 'hover':
    case 'type': {
      const absent = await missing(step.element);
      if (absent !== undefined) {
        return absent;
      }

      const { selector, copy } = targetOf(step.element);
      if (step.kind === 'type' && (await giveValue(page, selector, step.text, copy))) {
        break;
      }

      const found = await shownCopy(page, step.kind === 'type' ? fieldsOf(selector) : selector, copy);
      if ('absent' in found) {
        return `${step.element} is no field and holds none — a type step writes in an input, a text area or a select`;
      }

      if ('hidden' in found) {
        return hiddenAtWidth(step.element, step.kind);
      }

      const { element } = found;
      // A click's answer from the server landed before what follows reads the page: a key lit by a vote's answer.
      await (step.kind === 'click'
        ? answered(page, () => pressOnce(page, () => element.click({ timeout: 3000 })))
        : pressOnce(page, () =>
            step.kind === 'hover' ? element.hover({ timeout: 3000 }) : element.fill(step.text, { timeout: 3000 })
          ));
      break;
    }
    case 'press':
      await page.keyboard.press(step.key);
      break;
    case 'scroll':
    case 'drag': {
      const { selector, copy } = targetOf(step.element);
      const found = await shownCopy(page, selector, copy);
      if ('absent' in found) {
        return `${step.element} is not on the page`;
      }

      if ('hidden' in found) {
        return hiddenAtWidth(step.element, step.kind);
      }

      if (step.kind === 'drag') {
        const why = await dragElement(page, found.element, selector, { dx: step.dx, dy: step.dy });
        if (why !== undefined) {
          return `${step.element}: ${why}`;
        }

        break;
      }

      const box = await found.element.boundingBox();
      if (!box) {
        return `${step.element} is not shown — nothing to scroll`;
      }

      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(step.dx ?? 0, step.dy ?? 0);
      break;
    }
    case 'waitFor': {
      const until = Date.now() + (step.ms ?? 5000);
      while (!(await readOf(page, step.element)).shown) {
        if (Date.now() > until) {
          return `${step.element} was not shown within ${String(step.ms ?? 5000)} ms`;
        }

        await page.waitForTimeout(100);
      }

      break;
    }
    case 'goto':
    case 'back':
    case 'reload': {
      await (step.kind === 'goto'
        ? openPage(page, new URL(step.path, origin).href)
        : step.kind === 'back'
          ? page.goBack({ waitUntil: 'load' })
          : page.reload({ waitUntil: 'load' }));

      return awaitHydration(page);
    }
    case 'setState':
    case 'setSource': {
      const set =
        step.kind === 'setState'
          ? await bridge(page, { method: 'setState', args: [step.key, step.value] })
          : await bridge(page, { method: 'setSource', args: [step.path, step.value] });
      if (set === 'none') {
        return NO_BRIDGE;
      }

      if (step.kind === 'setSource' && set.answer === false) {
        return `no source of the page is ${step.path} — a source is written by its element's id: apiContainer_feed.items`;
      }

      break;
    }
    case 'tick':
      if (!clockHeld) {
        return "it moves the page's clock, which the test holds only with its own clock";
      }

      await page.clock.runFor(step.ms);
      break;
  }

  await settle(page);

  return undefined;
};

/** What an expectation read, when it does not hold — or nothing when it does. */
const unheld = async (page: E2ePage, step: E2eExpectation): Promise<string | undefined> => {
  switch (step.kind) {
    case 'expectShown':
    case 'expectHidden': {
      const read = await readOf(page, step.element);
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
      const read = await readOf(page, step.element);
      if (!read.found) {
        return 'it is not on the page';
      }

      const holds = step.exact ? read.text === step.text : read.text.includes(step.text);

      return holds ? undefined : `it reads "${read.text.slice(0, 120)}"`;
    }
    case 'expectAttribute': {
      const read = await readOf(page, step.element, { attribute: step.name });

      return read.attribute === step.value
        ? undefined
        : read.found
          ? `it is ${JSON.stringify(read.attribute)}`
          : 'it is not on the page';
    }
    case 'expectStyle': {
      const read = await readOf(page, step.element, { property: step.property });
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
    case 'expectPosition': {
      const relation = parseRelation(step.relation);
      if ('problem' in relation) {
        return relation.problem;
      }

      const boxes = new Map<string, Box>();
      for (const element of relationElements(relation)) {
        const read = await readOf(page, element);
        if (read.shown && read.box) {
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
const expectHeld = async (page: E2ePage, step: E2eExpectation, ms: number): Promise<string | undefined> => {
  const until = Date.now() + ms;
  let read = await unheld(page, step);
  while (read !== undefined && read !== NO_BRIDGE && Date.now() < until) {
    await page.waitForTimeout(100);
    read = await unheld(page, step);
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
  'expectPosition'
]);

/** Whether a step is something that must hold, not something done. */
export const isExpectation = (step: E2eStep): step is E2eExpectation => EXPECTATIONS.has(step.kind);

/** One e2e test run on a page: opened, its steps played and held in turn, the first that fails the last played. */
export const runE2eTest = async (page: E2ePage, test: E2eTest, options: E2eRunOptions): Promise<E2eResult> => {
  const started = Date.now();
  const { origin, expectMs = 5000, height = 900 } = options;
  const failed = (problem: string): E2eResult => ({
    id: test.id,
    title: test.title,
    ok: false,
    ms: Date.now() - started,
    steps: [],
    problem
  });
  await page.setViewportSize({ width: test.width ?? 1440, height });
  await page.emulateMedia({ colorScheme: test.scheme ?? 'light' });
  for (const [action, answer] of Object.entries(test.answers ?? {})) {
    await answerAction(page, action, answer);
  }

  if (test.clock !== undefined) {
    await page.clock.install({ time: Date.parse(test.clock) });
  }

  if (options.open) {
    await options.open(page);
  } else if ((await openPage(page, new URL(test.page, origin).href)) === null) {
    return failed(`nothing answers at ${new URL(test.page, origin).href}`);
  }

  const late = await awaitHydration(page);
  if (late !== undefined) {
    return failed(late);
  }

  const steps: E2eStepResult[] = [];
  let stopped = false;
  let halted = false;
  for (const step of test.steps) {
    if (!stopped && options.beforeStep) {
      await options.beforeStep(step, steps.length);
    }

    if (!stopped && options.signal?.aborted) {
      stopped = true;
      halted = true;
    }

    if (stopped) {
      steps.push({ said: stepText(step), ok: false, notRun: true, ms: 0 });
      continue;
    }

    const at = Date.now();
    let read: string | undefined;
    try {
      read = isExpectation(step)
        ? await expectHeld(page, step, expectMs)
        : await act(page, step, origin, test.clock !== undefined);
    } catch (error) {
      read = `it could not be played: ${pressFailure(error)}`;
    }

    const played: E2eStepResult = {
      said: stepText(step),
      ok: read === undefined,
      ...(read === undefined ? {} : { read }),
      ms: Date.now() - at
    };
    const frame = options.onStep ? await options.onStep(page, played, steps.length).catch(() => undefined) : undefined;
    steps.push(frame === undefined ? played : { ...played, frame });
    stopped = read !== undefined;
  }

  return {
    id: test.id,
    title: test.title,
    ok: !stopped,
    ms: Date.now() - started,
    steps,
    ...(halted ? { stopped: true as const } : {})
  };
};

/** A run as a person reads it: the test, then each step — the failed one with what it read, those after it not run. */
export const e2eResultText = (result: E2eResult): string[] => [
  `${result.ok ? '✓' : '✗'} ${result.id} — ${result.title} (${(result.ms / 1000).toFixed(1)} s)`,
  ...(result.problem ? [`  ${result.problem}`] : []),
  ...(result.stopped ? ['  stopped before its last step'] : []),
  ...result.steps.map(step =>
    step.notRun
      ? `  · ${step.said} — not run`
      : `  ${step.ok ? '✓' : '✗'} ${step.said}${step.read ? ` — ${step.read}` : ''}`
  )
];
