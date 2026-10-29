import { failedFlowText, readDevTools } from '@plitzi/sdk-authoring';

import {
  ANCESTORS_READ,
  listenForRefusedFieldsInPage,
  LOOK_PROPERTIES,
  lookChanges,
  looksInPage,
  momentChanges,
  pageMomentInPage,
  refusedFieldsInPage
} from './moments';
import { patiently, stepFailure } from '../measureState';
import { byNameOrId } from '../shot/capture';

import type { Authored } from './space';
import type { ClickAsk, ClickReport } from './types';
import type { BrowserPage } from '../../../browser';
import type { FieldFill } from '../../../options';
import type { DevToolsFlow } from '@plitzi/sdk-authoring';

/**
 * `--click`, `--hover` and `--fill`: an element clicked or pointed at, a field filled as a visitor would, and what it
 * changed.
 */

/**
 * A flow that ran, in a line: its trigger and each step as it ended — a refused one with the server's words, which a
 * run's scout read as "runServerAction success" while the server said "Pick 1 to 3 genres."
 */
export const ranText = (flow: DevToolsFlow): string =>
  `ran ${flow.trigger}${flow.on ? ` of ${flow.on}` : ''}: ${
    flow.steps
      .map(step => `${step.action} ${step.status}${step.status === 'refused' && step.error ? ` — ${step.error}` : ''}`)
      .join(', ') || 'no steps'
  }`;

export const selectorOf = (authored: Authored | undefined, id: string): string =>
  authored && Object.hasOwn(authored.handles.elements, id) ? authored.handles.elements[id].selector : byNameOrId(id);

const FIELDS = 'input, textarea, select';

/** The elements of the space the fields inside a node belong to: the nearest element around each. */
const fieldOwnersInPage = (node: Element, selector: string): string[] =>
  Array.from(node.querySelectorAll(selector), field =>
    field.closest('[data-plitzi-el]')?.getAttribute('data-plitzi-el')
  ).map(owner => owner ?? '?');

/**
 * One field filled as a visitor fills it — typed in, an option chosen, a box ticked with `true` or `false` — in the
 * element named, or the one field inside it (a `formControl` wraps its input). Which element's field was filled, when
 * it is another's; or what could not be filled, and why.
 */
/** What `firstShown` asks of a locator: the browser's, or a test's. */
interface Copies<E extends { count(): Promise<number> }> {
  first(): E;
  filter(options: { visible: boolean }): { first(): E };
}

/**
 * The first copy of an element a visitor sees — else the first, for the answer to say it is not shown: a list's first
 * row hid its Remind key (on air), the next four showed it, and a click on the first copy "could not be brought into
 * view".
 */
export const firstShown = async <E extends { count(): Promise<number> }>(all: Copies<E>): Promise<E> => {
  const shown = all.filter({ visible: true }).first();

  return (await shown.count()) > 0 ? shown : all.first();
};

const fillField = async (
  page: BrowserPage,
  authored: Authored | undefined,
  { element, value }: FieldFill
): Promise<{ filled: string } | { problem: string }> => {
  const node = await firstShown(page.locator(selectorOf(authored, element)));
  if ((await node.count()) === 0) {
    return { problem: `no element ${element} is on this page to fill` };
  }

  const own = await node.evaluate((each, selector) => each.matches(selector), FIELDS);
  const owners = own ? [element] : await node.evaluate(fieldOwnersInPage, FIELDS);
  if (owners.length === 0) {
    return { problem: `${element} holds no field to fill — an input, a textarea or a select` };
  }

  // A container of several is not one field: filling the first would put the value where it was not asked.
  if (owners.length > 1) {
    return {
      problem: `${element} holds ${String(owners.length)} fields — fill each by its own id: ${owners.join(', ')}`
    };
  }

  const field = own ? node : node.locator(FIELDS).first();

  const kind = await field.evaluate(
    each =>
      each instanceof HTMLSelectElement
        ? 'select'
        : each instanceof HTMLInputElement && (each.type === 'checkbox' || each.type === 'radio')
          ? 'check'
          : 'text',
    undefined
  );
  if (kind === 'check' && value !== 'true' && value !== 'false') {
    return { problem: `${element} is a box to tick: --fill ${element}=true or ${element}=false` };
  }

  try {
    if (kind === 'check') {
      await field.setChecked(value === 'true', { timeout: 3000 });
    } else if (kind === 'select') {
      await field.selectOption(value, { timeout: 3000 });
    } else {
      await field.fill(value, { timeout: 3000 });
    }
  } catch (error) {
    return {
      problem: `${element} could not be filled: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`
    };
  }

  const shown = `${element} = ${JSON.stringify(value)}`;

  return { filled: owners[0] === element ? shown : `${shown} (the field of ${owners[0]}, inside it)` };
};

/**
 * The element clicked as a visitor clicks it — brought into view first, which is not the click's doing — and what
 * changed: the flows it ran, where the page went, what scrolled, appeared or went, the state. A click that changed
 * nothing is said as such: a button whose flow does nothing looks the same as one that works until somebody clicks.
 */
export const clickEffects = async (
  page: BrowserPage,
  authored: Authored | undefined,
  { element: id, fill, hover }: ClickAsk
): Promise<ClickReport> => {
  const label = id ?? 'the fields filled';
  const verb = hover ? 'hovered' : 'clicked';
  const target = id === undefined ? undefined : await firstShown(page.locator(selectorOf(authored, id)));
  if (target && (await target.count()) === 0) {
    return { element: label, problem: `no element ${label} is on this page`, changes: [], failed: [] };
  }

  const looksOf = () =>
    id === undefined
      ? Promise.resolve({})
      : page.evaluate(looksInPage, {
          selector: selectorOf(authored, id),
          properties: LOOK_PROPERTIES,
          ancestors: hover ? ANCESTORS_READ : 0
        });
  const fillAll = async (): Promise<string[] | { problem: string }> => {
    const filled: string[] = [];
    for (const field of fill) {
      const result = await fillField(page, authored, field);
      if ('problem' in result) {
        return { problem: result.problem };
      }

      filled.push(result.filled);
    }

    return filled;
  };

  // With a click, the fields are what it sends: filled first, then the page is looked at. Without, the filling is the
  // interaction itself, and the page is looked at before it.
  let filled: string[] = [];
  let fillChanges: string[] = [];
  if (target) {
    // What typing in the fields did by itself — a search box filters as it is typed in — is said apart from the click.
    const toolsBeforeFill = await readDevTools(page, { state: true });
    const beforeFill = await page.evaluate(pageMomentInPage, undefined);
    const ranBeforeFill = new Set(toolsBeforeFill.flows.map(flow => `${flow.at}|${flow.trigger}|${String(flow.on)}`));
    const done = await fillAll();
    if (!Array.isArray(done)) {
      return { element: label, problem: done.problem, changes: [], failed: [] };
    }

    filled = done;
    if (fill.length > 0) {
      await page.waitForTimeout(600);
      const toolsAfterFill = await readDevTools(page, { state: true });
      const afterFill = await page.evaluate(pageMomentInPage, undefined);
      fillChanges = [
        ...toolsAfterFill.flows
          .filter(flow => !ranBeforeFill.has(`${flow.at}|${flow.trigger}|${String(flow.on)}`))
          .map(ranText),
        ...momentChanges(beforeFill, afterFill, { before: toolsBeforeFill.state, after: toolsAfterFill.state })
      ];
    }

    try {
      await patiently(page, () => target.scrollIntoViewIfNeeded({ timeout: 3000 }));
    } catch (error) {
      return {
        element: label,
        problem: `${label} could not be brought into view: ${stepFailure(error)}`,
        changes: [],
        failed: []
      };
    }
  }

  const tools = await readDevTools(page, { state: true });
  const before = await page.evaluate(pageMomentInPage, undefined);
  await page.evaluate(listenForRefusedFieldsInPage, undefined);
  const ran = new Set(tools.flows.map(flow => `${flow.at}|${flow.trigger}|${String(flow.on)}`));
  const looked = await looksOf();
  if (target) {
    const from = page.url();
    try {
      await patiently(page, () => (hover ? target.hover({ timeout: 3000 }) : target.click({ timeout: 3000 })));
    } catch (error) {
      // A click that took the page elsewhere did its work: what changed is read on the page it went to.
      if (page.url() === from) {
        return {
          element: label,
          problem: `${label} could not be ${verb}: ${stepFailure(error)}`,
          changes: [],
          failed: []
        };
      }
    }
  } else {
    const done = await fillAll();
    if (!Array.isArray(done)) {
      return { element: label, problem: done.problem, changes: [], failed: [] };
    }

    filled = done;
  }

  // Time for what it set off to land: a flow's steps, a smooth scroll, a page it went to, a hover's transition.
  await page.waitForTimeout(1200);
  const looks = hover ? lookChanges(looked, await looksOf()) : [];
  const toolsAfter = await readDevTools(page, { state: true });
  const after = await page.evaluate(pageMomentInPage, undefined);
  const refused = await page.evaluate(refusedFieldsInPage, undefined);
  const flows = toolsAfter.flows.filter(flow => !ran.has(`${flow.at}|${flow.trigger}|${String(flow.on)}`));

  return {
    element: label,
    ...(hover ? { hovered: true } : {}),
    ...(filled.length > 0 ? { filled } : {}),
    ...(fillChanges.length > 0 ? { fillChanges } : {}),
    changes: [
      ...flows.map(ranText),
      ...looks,
      ...momentChanges(before, after, { before: tools.state, after: toolsAfter.state })
    ],
    failed: flows.filter(flow => flow.status === 'failed').map(failedFlowText),
    // The browser's own refusal — a required field left empty — draws a bubble no element of the page holds, and stops
    // the submit before any flow runs: a finding of the page (`form-held-back`), not a change.
    ...(refused.length > 0 ? { heldBack: refused } : {})
  };
};
