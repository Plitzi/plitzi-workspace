import { describe, expect, it } from 'vitest';

import utilities from '@plitzi/sdk-shared/dataSource/utility';

import { BUILTIN_TRANSFORMERS, getTransformer, suggestTransformer, transformerCatalog } from './builtinTransformers';

// The catalog is a hand-maintained mirror of sdk-shared's runtime transformers. This test fails the build if the two
// drift — a new/renamed transformer action or param in sdk-shared that the MCP catalog does not reflect (which would
// make the MCP validate against a stale vocabulary and mis-teach the agent).

describe('builtinTransformers catalog stays in sync with the runtime', () => {
  it('covers exactly the runtime transformer actions', () => {
    expect(Object.keys(BUILTIN_TRANSFORMERS).sort()).toEqual(Object.keys(utilities).sort());
  });

  it('declares exactly the params each runtime transformer accepts', () => {
    for (const [action, utility] of Object.entries(utilities)) {
      const runtimeParams = Object.keys(utility.params).sort();
      const catalogParams = Object.keys(BUILTIN_TRANSFORMERS[action].params).sort();
      expect(catalogParams, `params for "${action}"`).toEqual(runtimeParams);
    }
  });
});

describe('transformer lookups', () => {
  it('suggests the real action for a common mistype', () => {
    expect(suggestTransformer('template')).toBe('twigTemplate');
    expect(getTransformer('template')).toBeUndefined();
    expect(getTransformer('twigTemplate')).toBeDefined();
  });

  it('projects a catalog with actions and params for the resource', () => {
    const catalog = transformerCatalog();
    const twig = catalog.find(t => t.action === 'twigTemplate');
    expect(twig?.params.map(p => p.name)).toContain('template');
  });
});
