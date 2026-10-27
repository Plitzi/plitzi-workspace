import { describe, expect, it } from 'vitest';

import { elementStyles } from './styles';

// `task look --element fight-card-vs` found it on the page, ten copies, then said it was no element of
// the space — "a component's part is named by its instance's id". It was a class.
describe('an element whose styles are asked', () => {
  it('is said to be a class, and who wears it, when the name is a class', async () => {
    const wearing = (id: string) => ({ id, definition: { styleSelectors: { root: 'fight-card-vs is-main' } } });
    // A stand-in of an authored space: only the handles and the elements' classes are read before it answers.
    const authored = {
      handles: { elements: {} },
      schema: { flat: { 'home-vs': wearing('home-vs'), 'list-vs': wearing('list-vs') }, components: {} },
      schemes: []
    } as unknown as Parameters<typeof elementStyles>[1];
    // …and of a page, which is read only once the element is found.
    const page = {} as Parameters<typeof elementStyles>[0];

    expect(await elementStyles(page, authored, 'fight-card-vs')).toEqual({
      unread: 'fight-card-vs is a class, not an element — worn by home-vs, list-vs: name one of them'
    });
    expect(await elementStyles(page, authored, 'home-title')).toEqual({
      unread: expect.stringContaining('home-title is no element of the space as authored, nor a part of any') as unknown
    });
  });

  // `task look --element room-card-tags` answered "no element of the space as authored", while `page measure` read it.
  it('reads a component’s part on the first copy the page draws, and says whose part it is', async () => {
    const part = (id: string, classes: string) => ({ id, definition: { styleSelectors: { root: classes } } });
    const authored = {
      handles: { elements: {} },
      schema: {
        flat: { 'home-tags': part('home-tags', 'tags') },
        components: {
          'room-card': { id: 'room-card', flat: { 'room-card-tags': part('room-card-tags', 'tags row-foot') } }
        }
      },
      schemes: []
    } as unknown as Parameters<typeof elementStyles>[1];
    const asked: unknown[] = [];
    const drawn = (copies: number) =>
      ({
        evaluate: (_run: unknown, arg: unknown) => {
          asked.push(arg);

          return Promise.resolve(copies === 0 ? null : { contested: [], inert: [], copies });
        }
      }) as unknown as Parameters<typeof elementStyles>[0];

    expect(await elementStyles(drawn(4), authored, 'room-card-tags')).toEqual({
      contested: [],
      inert: [],
      copies: 4,
      wornBy: { tags: ['home-tags'], 'row-foot': [] },
      partOf: 'room-card'
    });
    expect(asked).toEqual([{ selector: '[data-plitzi-el="room-card-tags"]', classes: ['tags', 'row-foot'] }]);
    expect(await elementStyles(drawn(0), authored, 'room-card-tags')).toEqual({
      unread: 'room-card-tags is a part of the component room-card, and no instance of it is on the page at this width'
    });
  });
});
