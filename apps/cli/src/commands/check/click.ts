import { failedFlowText, readDevTools } from '@plitzi/sdk-authoring';

import { listenForRefusedFieldsInPage, momentChanges, pageMomentInPage, refusedFieldsInPage } from './moments';

import type { Authored } from './space';
import type { ClickAsk, ClickReport } from './types';
import type { BrowserPage } from '../../browser';
import type { FieldFill } from '../../options';

/**
 * `--click` and `--fill`: an element clicked, a field filled as a visitor would, and what it changed.
 */

export const selectorOf = (authored: Authored | undefined, id: string): string =>
  authored && Object.hasOwn(authored.handles.elements, id)
    ? authored.handles.elements[id].selector
    : `[data-plitzi-el="${id}"]`;

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
const fillField = async (
  page: BrowserPage,
  authored: Authored | undefined,
  { element, value }: FieldFill
): Promise<{ filled: string } | { problem: string }> => {
  const node = page.locator(selectorOf(authored, element)).first();
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
  { element: id, fill }: ClickAsk
): Promise<ClickReport> => {
  const label = id ?? 'the fields filled';
  const target = id === undefined ? undefined : page.locator(selectorOf(authored, id)).first();
  if (target && (await target.count()) === 0) {
    return { element: label, problem: `no element ${label} is on this page`, changes: [], failed: [] };
  }

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
          .map(
            flow =>
              `ran ${flow.trigger}${flow.on ? ` of ${flow.on}` : ''}: ${flow.steps.map(step => `${step.action} ${step.status}`).join(', ') || 'no steps'}`
          ),
        ...momentChanges(beforeFill, afterFill, { before: toolsBeforeFill.state, after: toolsAfterFill.state })
      ];
    }

    try {
      await target.scrollIntoViewIfNeeded({ timeout: 3000 });
    } catch {
      return { element: label, problem: `${label} could not be brought into view`, changes: [], failed: [] };
    }
  }

  const tools = await readDevTools(page, { state: true });
  const before = await page.evaluate(pageMomentInPage, undefined);
  await page.evaluate(listenForRefusedFieldsInPage, undefined);
  const ran = new Set(tools.flows.map(flow => `${flow.at}|${flow.trigger}|${String(flow.on)}`));
  if (target) {
    try {
      await target.click({ timeout: 3000 });
    } catch (error) {
      const reason = error instanceof Error ? error.message.split('\n')[0] : String(error);

      return { element: label, problem: `${label} could not be clicked: ${reason}`, changes: [], failed: [] };
    }
  } else {
    const done = await fillAll();
    if (!Array.isArray(done)) {
      return { element: label, problem: done.problem, changes: [], failed: [] };
    }

    filled = done;
  }

  // Time for what it set off to land: a flow's steps, a smooth scroll, a page it went to.
  await page.waitForTimeout(1200);
  const toolsAfter = await readDevTools(page, { state: true });
  const after = await page.evaluate(pageMomentInPage, undefined);
  const refused = await page.evaluate(refusedFieldsInPage, undefined);
  const flows = toolsAfter.flows.filter(flow => !ran.has(`${flow.at}|${flow.trigger}|${String(flow.on)}`));

  return {
    element: label,
    ...(filled.length > 0 ? { filled } : {}),
    ...(fillChanges.length > 0 ? { fillChanges } : {}),
    changes: [
      ...flows.map(
        flow =>
          `ran ${flow.trigger}${flow.on ? ` of ${flow.on}` : ''}: ${flow.steps.map(step => `${step.action} ${step.status}`).join(', ') || 'no steps'}`
      ),
      // The browser's own refusal — a required field left empty — draws a bubble no element of the page holds, and
      // stops the submit before any flow runs: without this line it reads as a button that does nothing.
      ...refused.map(field => `the browser held the form back: ${field}`),
      ...momentChanges(before, after, { before: tools.state, after: toolsAfter.state })
    ],
    failed: flows.filter(flow => flow.status === 'failed').map(failedFlowText)
  };
};
