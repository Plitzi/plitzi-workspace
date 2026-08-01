import { describe, expect, it } from 'vitest';

import { streamProgress } from './streamProgress';

/** Everything this reads is HEALED json — the host closes the braces the model has not written yet — so the input
 *  it must survive is not "an operations batch" but "the first N characters of one". */

describe('streamProgress (what the placeholder can tell from a half-written call)', () => {
  it('counts the whole tree, not just its root', () => {
    const progress = streamProgress({
      operations: [
        {
          type: 'upsertElement',
          element: {
            ref: 'panel',
            type: 'container',
            children: [
              { ref: 'title', type: 'heading' },
              { ref: 'row', type: 'container', children: [{ ref: 'a', type: 'text' }] }
            ]
          }
        }
      ]
    });

    expect(progress.elements).toBe(4);
  });

  it('counts a repeat by its rows, which is what the user will see', () => {
    const progress = streamProgress({
      operations: [
        {
          type: 'repeatElement',
          template: { ref: 'tile', type: 'container', children: [{ ref: 'name', type: 'heading' }] },
          items: [{ name: 'A' }, { name: 'B' }, { name: 'C' }]
        }
      ]
    });

    expect(progress.elements).toBe(6);
  });

  it('names the widget from its first heading', () => {
    const progress = streamProgress({
      operations: [
        {
          type: 'upsertElement',
          element: { ref: 'p', type: 'container', children: [{ type: 'heading', props: { content: '  Plans  ' } }] }
        }
      ]
    });

    expect(progress.title).toBe('Plans');
  });

  // A repeat template's heading is a placeholder, and "{{item.name}}" on screen reads as a bug, not as progress.
  it('never shows a repeat placeholder as the title', () => {
    const progress = streamProgress({
      operations: [{ type: 'repeatElement', template: { type: 'heading', props: { content: '{{item.name}}' } } }]
    });

    expect(progress.title).toBeUndefined();
  });

  it('reports a patch as such, since that widget is already on screen', () => {
    expect(streamProgress({ patch: true, operations: [] }).patch).toBe(true);
    expect(streamProgress({ operations: [] }).patch).toBe(false);
  });

  // The last operation of a healed batch is routinely a stub, and the first frames arrive before `operations`
  // exists at all: none of that may throw, because the view has nothing else to paint.
  it.each([
    ['nothing yet', undefined],
    ['a bare object', {}],
    ['operations still a string', { operations: '[{"type":"upser' }],
    ['a truncated op', { operations: [{ type: 'upsertElement' }, null, 'half'] }],
    ['an element that is not one', { operations: [{ type: 'upsertElement', element: 'oops' }] }]
  ])('survives %s', (_case, args) => {
    const progress = streamProgress(args);

    expect(progress.elements).toBe(0);
    expect(progress.title).toBeUndefined();
  });
});
