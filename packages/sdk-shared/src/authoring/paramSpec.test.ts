import { describe, expect, it } from 'vitest';

import { toBuilderParams } from './builder';
import { invalidParams, reconcileParams } from './paramSpec';

import type { ParamSpec } from './paramSpec';

const spec: ParamSpec = {
  elements: {
    type: 'elementIds',
    elementType: 'apiContainer',
    description: 'The containers to refresh.',
    default: []
  }
};

describe('elementIds params', () => {
  it('accepts a list of ids, and refuses text or anything else in the list', () => {
    expect(invalidParams({ elements: ['orders', 'members'] }, {}, spec)).toEqual([]);
    expect(invalidParams({ elements: 'orders, members' }, {}, spec)).toEqual([
      { key: 'elements', expected: 'elementIds', got: 'string' }
    ]);
    expect(invalidParams({ elements: ['orders', 3] }, {}, spec)).toHaveLength(1);
  });

  it('accepts a binding in place of the list', () => {
    expect(invalidParams({ elements: '{{ state.containers }}' }, {}, spec)).toEqual([]);
  });

  it('fills an empty list, and is drawn as an element picker of its type', () => {
    expect(reconcileParams({}, spec, true)).toEqual({ elements: [] });
    expect(toBuilderParams(spec).elements).toMatchObject({ type: 'elements', elementType: 'apiContainer' });
  });
});
