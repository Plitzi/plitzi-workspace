import { describe, expect, it } from 'vitest';

import getBindingWarnings, { worstLevel } from './getBindingWarnings';

import type { SourceMeta } from '@plitzi/sdk-shared';

// The sources visible to the element under test — one in-scope provider source.
const sources: Record<string, SourceMeta> = {
  apiContainer_products: { id: 'products', source: 'apiContainer_products', name: 'Products' }
};

describe('getBindingWarnings', () => {
  it('accepts an in-scope source with a known transformer', () => {
    const warnings = getBindingWarnings({
      source: 'apiContainer_products.data',
      transformers: [{ action: 'twigTemplate', params: { template: '{{source}}' } }],
      sources
    });
    expect(warnings).toEqual([]);
    expect(worstLevel(warnings)).toBeUndefined();
  });

  it('flags an out-of-scope source as danger', () => {
    const warnings = getBindingWarnings({ source: 'apiContainer_other.data', sources });
    expect(warnings.some(w => w.level === 'danger' && w.message.includes('not available to this element'))).toBe(true);
    expect(worstLevel(warnings)).toBe('danger');
  });

  it('flags an empty source as danger', () => {
    const warnings = getBindingWarnings({ source: '', sources });
    expect(warnings.some(w => w.level === 'danger' && w.message.includes('no source'))).toBe(true);
  });

  it('flags an unknown transformer as a warning (still runs)', () => {
    const warnings = getBindingWarnings({
      source: 'apiContainer_products.data',
      transformers: [{ action: 'template', params: { template: '{{value}}' } }],
      sources
    });
    expect(warnings.some(w => w.level === 'warning' && w.message.includes('Unknown transformer "template"'))).toBe(
      true
    );
    expect(worstLevel(warnings)).toBe('warning');
  });

  it('does not flag a known transformer', () => {
    const warnings = getBindingWarnings({
      source: 'apiContainer_products.data',
      transformers: [{ action: 'dateConverter', params: {} }],
      sources
    });
    expect(warnings).toEqual([]);
  });

  it('reports danger as the worst level when both a broken source and an unknown transformer exist', () => {
    const warnings = getBindingWarnings({
      source: 'apiContainer_other.data',
      transformers: [{ action: 'template', params: {} }],
      sources
    });
    expect(worstLevel(warnings)).toBe('danger');
  });
});
