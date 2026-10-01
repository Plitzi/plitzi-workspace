import { element, heading, image, singlePageSpace } from '@plitzi/sdk-authoring';

import type { SpaceSpec } from '@plitzi/sdk-authoring';

/**
 * Tally, a space as it is on Plitzi before `plitzi create --from` takes it out: one page with a picture its CDN serves
 * and an element of its own plugin's. What the project the CLI writes has to render, from nothing but itself.
 */

export const TALLY_IDS = {
  title: 'tally-title',
  dot: 'tally-dot',
  counter: 'tally-counter'
};

/** `cdn`: where the space's files are served on Plitzi — what the project must serve from its own root instead. */
export const tallySpec = (cdn: string): SpaceSpec =>
  singlePageSpace(
    [
      heading('Tally board', { id: TALLY_IDS.title }),
      image({
        id: TALLY_IDS.dot,
        src: `${cdn}/tally/assets/dot.svg`,
        alt: 'Dot',
        css: { width: '32px', height: '32px' }
      }),
      element('tally', { id: TALLY_IDS.counter, label: 'Visits' })
    ],
    { name: 'Tally', permanentUrl: 'tally' }
  );
