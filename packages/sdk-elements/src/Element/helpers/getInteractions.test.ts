import { describe, it, expect, vi } from 'vitest';

import getInteractions from './getInteractions';

import type { Element } from '@plitzi/sdk-shared';

const definition: Element['definition'] = {
  rootId: 'root',
  label: 'My Button',
  type: 'button',
  styleSelectors: { base: 'btn', header: 'hdr' }
};

const attributes = { text: 'hi', active: true };

type Option = { value: string; label: string };
// getInteractions always returns object-form params with function options/type; narrow the shared union.
type ParamView = {
  options: (params: Record<string, unknown>) => Option[];
  type: (params: Record<string, unknown>) => string;
};

const build = () => {
  const setState = getInteractions(attributes, definition, vi.fn(), vi.fn()).setState;
  const params = setState.params as Record<string, ParamView>;

  return { setState, params };
};

describe('getInteractions', () => {
  it('builds a setState callback action titled after the element label', () => {
    const { setState } = build();

    expect(setState.action).toBe('setState');
    expect(setState.type).toBe('callback');
    expect(setState.title).toBe('Update My Button');
  });

  it('lists attribute keys as key options for the attribute category', () => {
    const { params } = build();

    expect(params.key.options({ category: 'attribute' }).map(o => o.value)).toEqual(['text', 'active']);
  });

  it('lists visibility and style selectors as key options for the state category', () => {
    const { params } = build();

    expect(params.key.options({ category: 'state' }).map(o => o.value)).toEqual([
      'visibility',
      'styleSelectors.base',
      'styleSelectors.header'
    ]);
  });

  it('returns no key options for an unknown category', () => {
    const { params } = build();

    expect(params.key.options({ category: 'other' })).toEqual([]);
  });

  it('uses a select input for boolean attributes and text otherwise', () => {
    const { params } = build();

    expect(params.value.type({ key: 'active' })).toBe('select');
    expect(params.value.type({ key: 'text' })).toBe('text');
  });

  it('offers true/false options for a boolean attribute value', () => {
    const { params } = build();

    expect(params.value.options({ key: 'active' }).map(o => o.value)).toEqual(['true', 'false']);
  });
});
