import { describe, expect, it } from 'vitest';

import { moveSurprises, pointedAt, removalSurprises, subtreeOf } from './arrange';

import type { ElementReading, SpaceEffect } from './spaceReading';
import type { WrittenElement } from '@plitzi/sdk-authoring';

const removed = (elementId: string): SpaceEffect => ({
  elementId,
  kind: 'removed',
  line: `${elementId} (text) removed`
});

const reordered: SpaceEffect = { elementId: 'hero', kind: 'field', field: 'children', line: 'hero children: … → …' };

const parent = (children: string[]): ElementReading => ({
  elementId: 'hero',
  type: 'container',
  rootId: 'home',
  classes: [],
  attributes: {},
  templates: [],
  bound: [],
  children
});

describe('what a removal may change', () => {
  it('is the element, what it holds and its parent’s list — anything else is named', () => {
    expect(removalSurprises('trust', [removed('trust'), removed('trust-icon'), reordered])).toEqual([]);
    expect(
      removalSurprises('trust', [
        removed('trust'),
        { elementId: 'cta', kind: 'attribute', key: 'content', line: 'cta.content: "A" → "B"' }
      ])
    ).toEqual(['it changed cta.content: "A" → "B" too, which was not asked']);
    expect(removalSurprises('trust', [reordered])).toEqual(['trust is still in the space']);
  });
});

describe('what a move may change', () => {
  it('is its parent’s order, with the element beside the one it was moved by', () => {
    expect(moveSurprises('faq', 'contact', 'before', [reordered], [parent(['intro', 'faq', 'contact'])])).toEqual([]);
    expect(moveSurprises('faq', 'contact', 'after', [reordered], [parent(['intro', 'faq', 'contact'])])).toEqual([
      'faq is not after contact in the space'
    ]);
  });
});

// A button that opens the modal: taking the modal away leaves the button opening nothing, and is said first.
describe('what a removal would leave pointing at nothing', () => {
  const written = (elementId: string, extra: Partial<WrittenElement> = {}): WrittenElement => ({
    elementId,
    type: 'container',
    rootId: 'home',
    classes: [],
    templates: [],
    words: [],
    attributes: {},
    bound: [],
    children: [],
    targets: [],
    through: [],
    ...extra
  });
  const elements = [
    written('open', { at: 'src/space/site.ts:12', targets: [{ elementId: 'modal', step: 'openModal' }] }),
    written('modal', { children: ['close'] }),
    written('close', { targets: [{ elementId: 'modal', step: 'closeModal' }] })
  ];

  it('names the steps outside it that act on it or on what it holds', () => {
    expect(pointedAt(elements, subtreeOf(elements, 'modal'))).toEqual([
      'open openModal → modal (src/space/site.ts:12)'
    ]);
    expect(pointedAt(elements, subtreeOf(elements, 'open'))).toEqual([]);
  });
});
