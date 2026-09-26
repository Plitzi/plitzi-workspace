import { expect } from '@playwright/test';

import { sampleId } from '../spaces';

import type { Locator, Page } from '@playwright/test';

/** What the suite knows about the sample space beyond its handles: the RSC nodes, its copy, the dev tools.
 *
 *  "It rendered whole" is not here: that is `expectPageWhole` in `./harness`, against the authored sample
 *  (`sampleAuthored()`), which checks every element by the id the declaration gave it rather than a per-type count. */

/** React Server Component nodes, by the name the space gives them.
 *
 *  Whether they render at all depends on the deployment: they need `getRscData` AND a component for their type, so
 *  their absence is correct in a space that supplies neither. */
export const RSC_REFS = { server: 'rsc-server', client: 'rsc-client', shared: 'rsc-shared' } as const;

/** …and their document ids, which is what everything RSC is actually keyed by: the payload in the store, the
 *  `data-rsc-id` marker on the node, the `ids` a partial refresh sends. They are derived from the declaration that
 *  authors the space, so they are looked up here rather than written down anywhere. */
export const RSC_IDS = {
  server: sampleId(RSC_REFS.server),
  client: sampleId(RSC_REFS.client),
  shared: sampleId(RSC_REFS.shared)
};

export const RSC_NODE_IDS = Object.values(RSC_IDS);

/** What a page owes minus what only a deployment with the three RSC components can draw: the nodes and the section
 *  holding them, which renders empty without them. For `expectPageWhole` wherever those components are absent. */
export const WITHOUT_RSC = { ignore: [...RSC_NODE_IDS, 'rsc-section'] };

/** Locates an element by schema id. Server-rendered pages only — see the note at the top of this file. */
export const serverElement = (page: Page, id: string): Locator => page.locator(`[data-id="${id}"]`);

/** Locates an element by the id its server data is keyed under. Present in both render paths, because the client
 *  needs it to reattach a partial refresh to the right node. */
export const rscElement = (page: Page, id: string): Locator => page.locator(`[data-rsc-id="${id}"]`);

/** The sample space's own copy, asserted through the accessibility tree: this is the text a reader is promised on
 *  the page they were told to open. */
export const expectSampleSpaceContent = async (page: Page): Promise<void> => {
  await expect(page.getByRole('heading', { name: 'Welcome To Plitzi' })).toBeVisible();

  for (const card of ['Docs', 'Learn', 'Templates', 'Deploy']) {
    await expect(page.getByRole('heading', { name: card, exact: true })).toBeVisible();
  }

  await expect(page.getByText('Explore the Plitzi playground')).toBeVisible();
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
