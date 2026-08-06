import { describe, expect, it } from 'vitest';

import { mergeProgress, streamProgress } from './streamProgress';

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

  it('always answers with a finite count, whatever it was handed', () => {
    for (const args of [undefined, 0, 'nonsense', [], { operations: [{ element: { children: {} } }] }]) {
      expect(Number.isFinite(streamProgress(args).elements)).toBe(true);
    }
  });

  // A tree deep enough to blow the stack would take the view down with it — including the widget still in flight.
  it('walks a pathologically deep tree without dying on it', () => {
    let node: Record<string, unknown> = { ref: 'leaf', type: 'text' };
    for (let level = 0; level < 5_000; level += 1) {
      node = { ref: `n${level}`, type: 'container', children: [node] };
    }

    const progress = streamProgress({ operations: [{ type: 'upsertElement', element: node }] });

    expect(progress.elements).toBeGreaterThan(0);
    expect(Number.isFinite(progress.elements)).toBe(true);
  });

  // A heading is streamed one fragment at a time and may be prose: unbounded, it would push the bars off a panel.
  it('keeps a title to the size of a label', () => {
    const long = 'x'.repeat(400);
    const progress = streamProgress({
      operations: [{ type: 'upsertElement', element: { type: 'heading', props: { content: `Plans\n\n  ${long}` } } }]
    });

    expect(progress.title?.length).toBeLessThanOrEqual(81);
    expect(progress.title?.startsWith('Plans x')).toBe(true);
    expect(progress.title).not.toContain('\n');
  });
});

/** Healing is best-effort and the spec says fields may CHANGE between notifications, so consecutive frames are
 *  not guaranteed to be increasing. What the eye reads as flicker is a placeholder that shrinks, so the fold is
 *  what guarantees it never does. */
describe('mergeProgress (frame N+1 may recover less than frame N)', () => {
  it('never lets the count go backwards', () => {
    const merged = mergeProgress({ elements: 12, patch: false }, { elements: 4, patch: false });

    expect(merged.elements).toBe(12);
  });

  it('keeps a title a later frame lost, and takes the newer one when there is one', () => {
    expect(mergeProgress({ elements: 3, title: 'Plans', patch: false }, { elements: 3, patch: false }).title).toBe(
      'Plans'
    );
    expect(
      mergeProgress({ elements: 3, title: 'Pri', patch: false }, { elements: 3, title: 'Pricing', patch: false }).title
    ).toBe('Pricing');
  });

  it('remembers that this call is a patch once any frame says so', () => {
    expect(mergeProgress({ elements: 1, patch: true }, { elements: 1, patch: false }).patch).toBe(true);
  });

  // Same object back means React bails out: a host streaming a frame per token would otherwise re-render the
  // placeholder hundreds of times to paint the very same bars.
  it('returns the previous state untouched when a frame moved nothing', () => {
    const previous = { elements: 5, title: 'Plans', patch: false };

    expect(mergeProgress(previous, { elements: 5, title: 'Plans', patch: false })).toBe(previous);
    expect(mergeProgress(previous, { elements: 2, patch: false })).toBe(previous);
  });

  it('takes the first frame as it is', () => {
    const first = { elements: 2, patch: false };

    expect(mergeProgress(undefined, first)).toBe(first);
  });
});
