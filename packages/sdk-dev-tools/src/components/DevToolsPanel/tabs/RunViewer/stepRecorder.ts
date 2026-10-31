import { useEffect } from 'react';

import { DEV_TOOLS_ATTRIBUTE } from '@plitzi/sdk-shared/devTools';
import { RUN_REPORT_STEPS_MOST } from '@plitzi/sdk-shared/runs';

import type { RunReportStep } from '@plitzi/sdk-shared/runs';

/**
 * What the person watching a run's preview does on its page — each press and what each field holds once typed in — kept
 * from the moment the page loads, so a report says how they got where they saw the bug: a run's lead reproduced a report
 * by guessing the layers clicked. The page's own elements only (`data-plitzi-el`), never the dev tools'; a password's
 * text never kept.
 */

/** A step, and the address it was taken on: the steps play again from where the first one kept was. */
interface Kept {
  step: RunReportStep;
  path: string;
}

let kept: Kept[] = [];
let earlier = 0;

const here = (): string => `${window.location.pathname}${window.location.search}`;

/** What a press goes to: a control, whose own text — an element of its own — a click lands on. */
const PRESSABLE =
  'button, a[href], input, select, textarea, summary, label, [role="button"], [role="tab"], [role="link"]';

/**
 * Runs in the page: an element as a step names it — its id, and which copy a list draws when it draws more than one
 * (`bin-bar:3`) — or none, when it is no element of the space. A press is named by the control it went to (`pressed`):
 * a click on a button's label read `layer-quakes-label`, where the person pressed `layer-quakes`.
 */
export const elementName = (node: EventTarget | null, pressed = false): string | undefined => {
  const from = node instanceof Element && pressed ? (node.closest(PRESSABLE) ?? node) : node;
  const element = from instanceof Element ? from.closest('[data-plitzi-el]') : null;
  const id = element?.getAttribute('data-plitzi-el');
  if (!element || !id) {
    return undefined;
  }

  const copies = Array.from(document.querySelectorAll(`[data-plitzi-el="${CSS.escape(id)}"]`));

  return copies.length > 1 ? `${id}:${String(copies.indexOf(element) + 1)}` : id;
};

const inDevTools = (node: EventTarget | null): boolean =>
  node instanceof Element && node.closest(`[${DEV_TOOLS_ATTRIBUTE}]`) !== null;

const keep = (step: RunReportStep): void => {
  kept = [...kept, { step, path: here() }];
  if (kept.length > RUN_REPORT_STEPS_MOST) {
    earlier += kept.length - RUN_REPORT_STEPS_MOST;
    kept = kept.slice(-RUN_REPORT_STEPS_MOST);
  }
};

export const recordClick = (event: Event): void => {
  const element = inDevTools(event.target) ? undefined : elementName(event.target, true);
  if (element) {
    keep({ kind: 'click', element });
  }
};

/** What a field holds once typed in, one step a field: typing on in it changes the step, never adds one a key. */
export const recordInput = (event: Event): void => {
  const field = event.target;
  const element = inDevTools(field) ? undefined : elementName(field);
  if (!element || !(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) {
    return;
  }

  const step: RunReportStep =
    field instanceof HTMLInputElement && field.type === 'password'
      ? { kind: 'type', element, secret: true }
      : { kind: 'type', element, text: field.value };
  const last = kept.at(-1);
  if (last?.step.kind === 'type' && last.step.element === element) {
    kept = [...kept.slice(0, -1), { ...last, step }];
  } else {
    keep(step);
  }
};

/**
 * What was kept so far, oldest first, how many earlier steps were left out, and the address they play again from —
 * where the first was taken (a link pressed moves the page on): the page as it is now when none was.
 */
export const recordedSteps = (): { steps: RunReportStep[]; earlier: number; from: string } => ({
  steps: kept.map(each => each.step),
  earlier,
  from: kept.at(0)?.path ?? here()
});

/**
 * Starts again from nothing: what a report sent was made of is not said twice — and the browser's back or forward
 * moved the page where no press took it, so the steps kept no longer play to it.
 */
export const clearRecordedSteps = (): void => {
  kept = [];
  earlier = 0;
};

/** Keeps what the person does on the page while `on` — a run's preview only. */
const useStepRecorder = (on: boolean): void => {
  useEffect(() => {
    if (!on || typeof document === 'undefined') {
      return undefined;
    }

    document.addEventListener('click', recordClick, true);
    document.addEventListener('input', recordInput, true);
    window.addEventListener('popstate', clearRecordedSteps);

    return () => {
      document.removeEventListener('click', recordClick, true);
      document.removeEventListener('input', recordInput, true);
      window.removeEventListener('popstate', clearRecordedSteps);
    };
  }, [on]);
};

export default useStepRecorder;
