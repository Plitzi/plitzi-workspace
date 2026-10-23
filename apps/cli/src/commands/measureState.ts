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

/** The state in words: `menu-toggle clicked, then submenu-row`. */
export const stateText = (state: StateAsked, side: keyof Pair): string =>
  `${state.pairs.map(pair => pair[side]).join(', then ')} ${DONE[state.kind]}`;

/** The longest a state's transitions are waited for: a fade is a fraction of a second, an endless spin never ends. */
const SETTLE_MS = 3000;

/** How often the page's layout is read while it settles, and how many reads alike in a row count as still. */
const LAYOUT_EVERY_MS = 100;
const LAYOUT_STILL = 3;

/**
 * What the state started finished, or the longest a fade takes: the page's animations ended, then its layout still —
 * the boxes of what is in view read alike three times running. A script that moves a panel frame by frame (a drawer
 * slid in by its own code) shows in no animation of the page, only in the boxes moving (lx-controls).
 */
export const settle = async (page: BrowserPage): Promise<void> => {
  await page.evaluate(
    ({ most, every, still }: { most: number; every: number; still: number }) => {
      const until = Date.now() + most;
      const animations = Promise.all(
        document
          .getAnimations()
          .filter(animation => animation.effect?.getTiming().iterations !== Infinity)
          .map(animation => animation.finished.catch(() => undefined))
      );
      // Where the elements in view are drawn: one line of numbers, read again until it stops changing.
      const layout = (): string =>
        [...document.body.querySelectorAll('*')]
          .slice(0, 600)
          .map(node => node.getBoundingClientRect())
          .filter(box => box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth)
          .map(box => `${String(Math.round(box.left))},${String(Math.round(box.top))},${String(Math.round(box.width))}`)
          .join(' ');
      const stillLayout = async (): Promise<void> => {
        let last = layout();
        let alike = 0;
        while (alike < still && Date.now() < until) {
          await new Promise(resolve => setTimeout(resolve, every));
          const now = layout();
          alike = now === last ? alike + 1 : 0;
          last = now;
        }
      };

      return Promise.race([
        animations.then(stillLayout),
        new Promise(resolve => setTimeout(resolve, Math.max(0, until - Date.now())))
      ]).then(() => undefined);
    },
    { most: SETTLE_MS, every: LAYOUT_EVERY_MS, still: LAYOUT_STILL }
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

    await settle(page);
  }

  return undefined;
};
