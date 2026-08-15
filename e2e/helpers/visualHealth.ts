import { expect } from '@playwright/test';

import type { Page } from '@playwright/test';

/** Breakage that only a browser can see. None of these need a baseline image: they are properties a laid-out page
 *  either has or does not, so they mean the same thing on any machine and fail with a sentence instead of a diff. */

/** An `<img>` in the DOM says nothing about whether the picture arrived. `naturalWidth` is zero for a 404, a
 *  blocked host and a broken data URI alike — the three ways a space renders as a page full of holes. */
export const expectImagesLoaded = async (page: Page): Promise<void> => {
  const broken = await page.evaluate(() =>
    [...document.querySelectorAll('img')]
      .filter(image => !image.complete || image.naturalWidth === 0)
      .map(image => image.currentSrc || image.src)
  );

  expect(broken, 'images that never loaded').toEqual([]);
};

/** A page wider than its own viewport is the signature of a layout that escaped its container — the bug that
 *  looks fine at the top of a screenshot and drags a horizontal scrollbar across the whole site. */
export const expectNoHorizontalOverflow = async (page: Page): Promise<void> => {
  const overflow = await page.evaluate(() => {
    const { scrollWidth } = document.documentElement;
    const viewport = window.innerWidth;

    if (scrollWidth <= viewport + 1) {
      return null;
    }

    const culprits = [...document.querySelectorAll('*')]
      .filter(node => node.getBoundingClientRect().right > viewport + 1)
      .slice(0, 5)
      .map(node => `${node.tagName.toLowerCase()}.${node.className.split(' ')[0]}`);

    return { scrollWidth, viewport, culprits };
  });

  expect(overflow, 'the page scrolls horizontally').toBeNull();
};

/** Text the browser renders in a colour it also uses for the background is invisible to a reader and perfectly
 *  present to every DOM assertion ever written. Only checks nodes that actually carry text. */
export const expectTextIsLegible = async (page: Page): Promise<void> => {
  const invisible = await page.evaluate(() => {
    const parseColor = (value: string): [number, number, number, number] | null => {
      const parts = value.match(/[\d.]+/g);

      return parts && parts.length >= 3
        ? [Number(parts[0]), Number(parts[1]), Number(parts[2]), parts.length > 3 ? Number(parts[3]) : 1]
        : null;
    };

    const backgroundBehind = (node: Element): [number, number, number, number] => {
      let current: Element | null = node;

      while (current) {
        const parsed = parseColor(getComputedStyle(current).backgroundColor);
        if (parsed && parsed[3] > 0) {
          return parsed;
        }

        current = current.parentElement;
      }

      return [255, 255, 255, 1];
    };

    return [...document.querySelectorAll('[class*="plitzi-component__"]')]
      .filter(node => {
        const text = node.textContent?.trim();
        if (!text || node.children.length) {
          return false;
        }

        const style = getComputedStyle(node);
        const foreground = parseColor(style.color);
        if (!foreground) {
          return false;
        }

        if (foreground[3] === 0) {
          return true;
        }

        const background = backgroundBehind(node);
        const distance =
          Math.abs(foreground[0] - background[0]) +
          Math.abs(foreground[1] - background[1]) +
          Math.abs(foreground[2] - background[2]);

        return distance < 24;
      })
      .map(node => `${node.className.split(' ')[0]}: "${node.textContent?.trim().slice(0, 40)}"`);
  });

  expect(invisible, 'text rendered in the colour of what is behind it').toEqual([]);
};

export const expectVisuallyHealthy = async (page: Page): Promise<void> => {
  await expectImagesLoaded(page);
  await expectNoHorizontalOverflow(page);
  await expectTextIsLegible(page);
};
