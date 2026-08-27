import { expect } from '@playwright/test';

import type { Locator, Page } from '@playwright/test';
import type { OfflineDataRaw } from '@plitzi/sdk-shared';

/** What "this space rendered correctly" means, stated once and derived from the schema rather than from a
 *  hand-written list that drifts from it.
 *
 *  It reads the DOM through the class the SDK gives every element — `plitzi-component__<type>` — because that is
 *  what a browser sees in BOTH render paths. The `data-id` attributes are server-side only: they exist so
 *  hydration can find the nodes the server rendered, and a client-side render has no such need and emits none.
 *  Asserting on them means writing a check that can only ever pass against SSR. */

/** React Server Component nodes. Whether they render at all depends on the deployment: they need `getRscData`
 *  AND a component for their type, so their absence is correct in a space that supplies neither. */
export const RSC_NODE_IDS = ['rsc-server', 'rsc-client', 'rsc-shared'];

/** Element types the SDK renders itself. Anything else is a plugin the deployment provides, which renders through
 *  `RootElement` and carries no `plitzi-component__` class of its own. */
const isBuiltIn = (type: string): boolean => !['serverInfo', 'clientInfo', 'sharedInfo'].includes(type);

const componentClass = (type: string): string => `.plitzi-component__${type.toLowerCase()}`;

type TypeCount = { type: string; expected: number };

const builtInCounts = (data: OfflineDataRaw): TypeCount[] => {
  const tally = new Map<string, number>();

  for (const node of Object.values(data.schema.flat)) {
    const { type } = node.definition;

    if (isBuiltIn(type)) {
      tally.set(type, (tally.get(type) ?? 0) + 1);
    }
  }

  return [...tally].map(([type, expected]) => ({ type, expected }));
};

/** Locates an element by schema id. Server-rendered pages only — see the note at the top of this file. */
export const serverElement = (page: Page, id: string): Locator => page.locator(`[data-id="${id}"]`);

/** Locates an element by the id its server data is keyed under. Present in both render paths, because the client
 *  needs it to reattach a partial refresh to the right node. */
export const rscElement = (page: Page, id: string): Locator => page.locator(`[data-rsc-id="${id}"]`);

/** Completeness: every element the schema declares reached the DOM, counted per type. A missing element, a
 *  duplicated one and a whole branch that failed to render all show up here with the type that went wrong. */
export const expectSchemaRendered = async (page: Page, data: OfflineDataRaw): Promise<void> => {
  const expectedCounts = builtInCounts(data);

  const actual = await page.evaluate(
    selectors => selectors.map(({ type, selector }) => ({ type, found: document.querySelectorAll(selector).length })),
    expectedCounts.map(({ type }) => ({ type, selector: componentClass(type) }))
  );

  const mismatched = expectedCounts
    .map(({ type, expected }) => ({ type, expected, found: actual.find(entry => entry.type === type)?.found ?? 0 }))
    .filter(entry => entry.expected !== entry.found);

  expect(mismatched, 'element types that did not render the number of elements the schema declares').toEqual([]);
};

/** Substance: the elements that carry content occupy space. This is what separates "the DOM is there" from "a
 *  human can see it" — a collapsed flex parent, a stylesheet that never loaded and a `display:none` inherited from
 *  somewhere all satisfy a DOM query and fail here. */
export const expectSpaceVisible = async (page: Page): Promise<void> => {
  const collapsed = await page.evaluate(() =>
    [...document.querySelectorAll('.plitzi-component__heading, .plitzi-component__paragraph, .plitzi-component__image')]
      .filter(node => {
        const box = node.getBoundingClientRect();

        return box.width === 0 || box.height === 0;
      })
      .map(node => `${node.className.split(' ')[0]}: "${node.textContent?.trim().slice(0, 30) ?? ''}"`)
  );

  expect(collapsed, 'elements with content that render with no area').toEqual([]);
};

/** The sample space's own copy, asserted through the accessibility tree: this is the text a reader is promised on
 *  the page they were told to open. */
export const expectSampleSpaceContent = async (page: Page): Promise<void> => {
  await expect(page.getByRole('heading', { name: 'Welcome To Plitzi' })).toBeVisible();

  for (const card of ['Docs', 'Learn', 'Templates', 'Deploy']) {
    await expect(page.getByRole('heading', { name: card, exact: true })).toBeVisible();
  }

  await expect(page.getByText('Explore the Plitzi playground')).toBeVisible();
};

/** Completeness and substance together, for any space. What the space SAYS is its own spec's business — the sample
 *  space has {@link expectSampleSpaceContent} for that. */
export const expectSpaceRendered = async (page: Page, data: OfflineDataRaw): Promise<void> => {
  await expectSchemaRendered(page, data);
  await expectSpaceVisible(page);
};

/**
 * The dev tools were authorized by the page, and their panel actually mounted.
 *
 * Every example here turns them on, because a reader following the docs should be able to open the store and the
 * logs of the thing in front of them without editing it first. The panel renders into a SHADOW ROOT — which is
 * also what makes this worth asserting rather than eyeballing: a stylesheet path the host got wrong shows up as
 * an unstyled panel, and a `debugMode` the entry point dropped shows up as no shadow root at all.
 */
export const expectDevToolsAvailable = async (page: Page): Promise<void> => {
  await expect
    .poll(() => page.evaluate(() => [...document.querySelectorAll('*')].filter(node => node.shadowRoot).length))
    .toBeGreaterThan(0);
};
