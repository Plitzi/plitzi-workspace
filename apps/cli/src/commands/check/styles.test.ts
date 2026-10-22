import { describe, expect, it } from 'vitest';

import { elementStyles } from './styles';

// velada-backlog: `task look --element fight-card-vs` found it on the page, ten copies, then said it was no element of
// the space — "a component's part is named by its instance's id". It was a class.
describe('an element whose styles are asked', () => {
  it('is said to be a class, and who wears it, when the name is a class', async () => {
    const wearing = (id: string) => ({ id, definition: { styleSelectors: { root: 'fight-card-vs is-main' } } });
    // A stand-in of an authored space: only the handles and the elements' classes are read before it answers.
    const authored = {
      handles: { elements: {} },
      schema: { flat: { 'home-vs': wearing('home-vs'), 'list-vs': wearing('list-vs') } },
      schemes: []
    } as unknown as Parameters<typeof elementStyles>[1];
    // …and of a page, which is read only once the element is found.
    const page = {} as Parameters<typeof elementStyles>[0];

    expect(await elementStyles(page, authored, 'fight-card-vs')).toEqual({
      unread: 'fight-card-vs is a class, not an element — worn by home-vs, list-vs: name one of them'
    });
    expect(await elementStyles(page, authored, 'home-title')).toEqual({
      unread: expect.stringContaining('home-title is no element of the space as authored') as unknown
    });
  });
});
