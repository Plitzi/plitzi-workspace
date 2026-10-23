import { targetOn } from './shot/capture';

import type { Pair } from './measure';
import type { BrowserPage, PageElement } from '../browser';

/**
 * The state `page measure` reads both pages in — an element hovered or focused, or several clicked in turn — put on a
 * page and waited for, and said in words.
 */

/** The state both pages are measured in: an element of each hovered or focused first, or clicked, one after another. */
export interface StateAsked {
  kind: 'hover' | 'focus' | 'click';
  /** One hovered or focused; clicked, each in turn. */
  pairs: Pair[];
}

const DONE: Record<StateAsked['kind'], string> = { hover: 'hovered', focus: 'focused', click: 'clicked' };

/** The state in words: `filters-toggle clicked, then facet-row`. */
export const stateText = (state: StateAsked, side: keyof Pair): string =>
  `${state.pairs.map(pair => pair[side]).join(', then ')} ${DONE[state.kind]}`;

/** The longest a state's transitions are waited for: a fade is a fraction of a second, an endless spin never ends. */
const SETTLE_MS = 3000;

/** What a click is given before its state is read: a drawer a script slides in takes about half a second. */
const CLICK_SETTLE_MS = 700;

/** What the state started — its transitions, its animations — finished, or the longest a fade takes. */
const settle = async (page: BrowserPage): Promise<void> => {
  await page.evaluate(
    (most: number) =>
      Promise.race([
        Promise.all(
          document
            .getAnimations()
            .filter(animation => animation.effect?.getTiming().iterations !== Infinity)
            .map(animation => animation.finished.catch(() => undefined))
        ),
        new Promise(resolve => setTimeout(resolve, most))
      ]).then(() => undefined),
    SETTLE_MS
  );
};

/** What a step of the state does to its element. */
const act = (element: PageElement, kind: StateAsked['kind']): Promise<void> =>
  kind === 'hover'
    ? element.hover({ timeout: 5000 })
    : kind === 'focus'
      ? element.focus({ timeout: 5000 })
      : element.click({ timeout: 5000 });

/**
 * Puts the page in the state asked — the element hovered or focused, or each clicked in turn — and waits for what it
 * starts to finish: a drawer's slide, a panel's fade.
 */
export const putIn = async (
  page: BrowserPage,
  state: StateAsked,
  side: keyof Pair
): Promise<{ problem: string } | undefined> => {
  for (const pair of state.pairs) {
    const target = pair[side];
    const found = await targetOn(page, target);
    if ('problem' in found) {
      return found;
    }

    if (!found.found) {
      return { problem: `No element ${target} to ${state.kind} on ${page.url()}` };
    }

    try {
      await act(page.locator(found.selector).filter({ visible: true }).first(), state.kind);
    } catch (error) {
      return {
        problem: `${target} could not be ${DONE[state.kind]} on ${page.url()}: ${error instanceof Error ? (error.message.split('\n')[0] ?? '') : String(error)}`
      };
    }

    // A click's drawer may be slid in by a script, which no animation of the page's says: the original's filter drawer
    // still sat 485px off a 390px screen when its transitions read finished (lx-controls).
    if (state.kind === 'click') {
      await page.waitForTimeout(CLICK_SETTLE_MS);
    }

    await settle(page);
  }

  return undefined;
};
