import { expect } from '@playwright/test';
import { readOfflineData } from '@plitzi/example-space';

import type { Locator, Page } from '@playwright/test';

/** Every example renders the same space, so what "rendered correctly" means can be stated once — and stated
 *  against the schema itself rather than a hand-written list that drifts from it.
 *
 *  The SDK stamps `data-id` on every element it renders, which is what makes this possible: the schema says which
 *  nodes exist, the DOM says which ones arrived, and the difference is the bug. */

const { schema } = readOfflineData();

/** React Server Component nodes. They render only where the server supplies `getRscData`, which is one example
 *  out of the set — everywhere else their absence is correct, not a regression. */
export const RSC_NODE_IDS = ['rsc-server', 'rsc-client', 'rsc-shared'];

const nodes = Object.entries(schema.flat);

/** The nodes that must appear wherever the space renders at all. */
export const baselineNodeIds = nodes.map(([id]) => id).filter(id => !RSC_NODE_IDS.includes(id));

/** Nodes carrying their own text or image — the ones whose box collapsing to nothing is always a bug. */
const substantialNodeIds = nodes
  .filter(([id, node]) => !RSC_NODE_IDS.includes(id) && Boolean(node.attributes.content ?? node.attributes.src))
  .map(([id]) => id);

export const element = (page: Page, id: string): Locator => page.locator(`[data-id="${id}"]`);

/** Presence: every node the schema declares reached the DOM. */
export const expectSchemaRendered = async (page: Page): Promise<void> => {
  const rendered = await page.evaluate(() =>
    [...document.querySelectorAll('[data-id]')].map(node => node.getAttribute('data-id'))
  );

  const missing = baselineNodeIds.filter(id => !rendered.includes(id));

  expect(missing, 'schema nodes that never reached the DOM').toEqual([]);
};

/** Substance: the nodes that carry content occupy space. This is the check that separates "the DOM is there" from
 *  "a human can see it" — a collapsed flex parent, a style that never loaded and a element rendered behind
 *  `display:none` all pass a DOM query and fail here. */
export const expectSpaceVisible = async (page: Page): Promise<void> => {
  const collapsed = await page.evaluate(ids => {
    return ids.filter(id => {
      const node = document.querySelector(`[data-id="${id}"]`);
      if (!node) {
        return true;
      }

      const box = node.getBoundingClientRect();

      return box.width === 0 || box.height === 0;
    });
  }, substantialNodeIds);

  expect(collapsed, 'nodes with content that render with no area').toEqual([]);
};

/** The space's own copy, asserted through the accessibility tree rather than a class name — this is the text a
 *  reader is promised on the page they were told to open. */
export const expectSpaceContent = async (page: Page): Promise<void> => {
  await expect(page.getByRole('heading', { name: 'Welcome To Plitzi' })).toBeVisible();

  for (const card of ['Docs', 'Learn', 'Templates', 'Deploy']) {
    await expect(page.getByRole('heading', { name: card, exact: true })).toBeVisible();
  }

  await expect(page.getByText('Explore the Plitzi playground')).toBeVisible();
};

/** The whole promise, in the order a failure is most useful: is it on screen, is it complete, does it occupy
 *  space. Every example spec ends here. */
export const expectSharedSpace = async (page: Page): Promise<void> => {
  await expectSpaceContent(page);
  await expectSchemaRendered(page);
  await expectSpaceVisible(page);
};
