import { describe, expect, it, vi } from 'vitest';

import { authorSpace, e2e, text } from '@plitzi/sdk-authoring';

import type { ExistingProject } from '../project/existingProject';

const { schema } = authorSpace({
  name: 'Bakery',
  permanentUrl: 'bakery',
  pages: [{ name: 'Basket', slug: 'basket', body: [text('0', { id: 'basket-count' })] }]
});
const space = {
  ...schema,
  tests: {
    e2e: [
      e2e.test({ id: 'full', title: 'Full', page: '/basket', steps: [e2e.expectShown('basket-count')] }),
      e2e.test({ id: 'broken', title: 'Broken', page: '/basket', steps: [e2e.expectShown('gone')] })
    ]
  }
};

vi.mock('../project/spaceTests', () => ({ authoredSpace: () => Promise.resolve({ schema: space }) }));

const { playStart } = await import('./playJourney');

// The project as far as where a play starts reads it: the space is authored by the mock above.
const project = {} as ExistingProject;

// A run's agents wrote a journey's steps again on the command line to read the page where it left off.
describe('where a page play starts', () => {
  it('is the page given — or the page a journey of the space opens on, with the journey', async () => {
    expect(await playStart(project, '/menu', {})).toEqual({ route: '/menu' });
    expect(await playStart(project, undefined, { journey: 'full' })).toMatchObject({
      route: '/basket',
      journey: { journey: { id: 'full' } }
    });
  });

  it('says why it cannot: no page, a journey the space lacks, one written wrong, another site beside it', async () => {
    expect(await playStart(project, undefined, {})).toEqual({
      problem: 'page play needs the page to play — /pricing — or --journey <id>, which opens on its own.'
    });
    expect(await playStart(project, undefined, { journey: 'nope' })).toEqual({
      problem: '--journey nope: no journey of the space is "nope" — its journeys: full, broken.'
    });
    expect(await playStart(project, undefined, { journey: 'broken' })).toMatchObject({
      problem: expect.stringContaining('--journey broken: the journey is written so it cannot be played') as string
    });
    expect(await playStart(project, undefined, { journey: 'full', compare: 'https://example.com' })).toMatchObject({
      problem: expect.stringContaining('which the other site has not') as string
    });
  });
});
