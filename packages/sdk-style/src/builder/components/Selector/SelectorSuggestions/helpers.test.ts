import { describe, expect, it } from 'vitest';

import { suggestionsFor } from './helpers';

const available = [
  { name: 'card', type: 'class' as const },
  { name: 'card-wide', type: 'class' as const },
  { name: 'primary', type: 'class' as const }
];

describe('suggestionsFor', () => {
  it('offers every class before anything is typed, and nothing to create', () => {
    expect(suggestionsFor('', available)).toEqual({ creates: undefined, list: available });
  });

  it('narrows to the classes whose names hold what is typed, and offers to create a new one', () => {
    expect(suggestionsFor('CARD', available)).toEqual({ creates: 'CARD', list: available.slice(0, 2) });
  });

  it('offers no new class with the name of one already offered', () => {
    expect(suggestionsFor('card', available).creates).toBeUndefined();
  });
});
