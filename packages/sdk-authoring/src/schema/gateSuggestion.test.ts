import { describe, expect, it } from 'vitest';

import { authorSpace, button, formControl, modalContainer, onClick, openModal } from '../index';

// A modal renamed where it is declared, and not where it is opened: the name to offer is the modal's, not the field's
// that happens to be spelt closer.
describe('a step pointed at a name nothing answers to', () => {
  it('is offered the nearest element that answers the step', () => {
    expect(() =>
      authorSpace({
        name: 'Gate',
        permanentUrl: 'gate',
        pages: [
          {
            id: 'home',
            name: 'Home',
            slug: '',
            body: [
              formControl({ id: 'search-q', subType: 'text', label: 'Search' }),
              button({ id: 'open', content: 'Search', flows: [[onClick(), openModal('search')]] }),
              modalContainer({ id: 'search-modal' })
            ]
          }
        ]
      })
    ).toThrow(/runs against "search", but no element answers to that name — did you mean "search-modal"\?/);
  });
});
