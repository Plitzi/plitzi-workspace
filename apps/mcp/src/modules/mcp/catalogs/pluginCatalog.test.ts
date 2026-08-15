import { afterEach, describe, expect, it, vi } from 'vitest';

import { pluginCatalog, stringDeclarations } from './pluginCatalog';

/**
 * The manifest cache is module-level and deliberately so — a plugin resource is an immutable URL. Each test therefore
 * uses a resource of its own, rather than reaching in to clear it: sharing one would make the tests depend on their
 * own order, which is the bug the cache exists to cause.
 */

const manifest = (overrides: Record<string, unknown> = {}) => ({
  definition: { name: 'Acme Widgets', category: 'marketing' },
  pluginSchema: {
    acmeHero: {
      attributes: { headline: '', subline: '' },
      definition: { label: 'Acme Hero', description: 'A hero band', styleSelectors: { root: {}, title: {} } },
      defaultStyle: {
        style: { base: { default: { display: 'flex', padding: '2rem', nested: { ignored: true } } } },
        bindingsAllowed: { attributes: [{ path: 'headline', label: 'Headline' }] }
      }
    }
  },
  ...overrides
});

const respondWith = (body: unknown) =>
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) }));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('pluginCatalog', () => {
  it('has nothing to say about a space with no plugins', async () => {
    expect(await pluginCatalog(undefined)).toEqual({});
    expect(await pluginCatalog({})).toEqual({});
  });

  it('walks a manifest into an entry: label, description, category, attributes, selectors and binding targets', async () => {
    respondWith(manifest());

    const catalog = await pluginCatalog({ acmeHero: { resource: 'https://cdn.test/acme/1' } });

    expect(catalog.acmeHero).toEqual({
      label: 'Acme Hero',
      description: 'A hero band',
      category: 'marketing',
      custom: true,
      attributes: ['headline', 'subline'],
      styleSelectors: ['root', 'title'],
      // Only the string declarations survive — a nested block is a state or a variant, not a starting style.
      defaultStyle: { display: 'flex', padding: '2rem' },
      bindingsAllowed: { attributes: ['headline'], initialState: undefined }
    });
  });

  it('falls back to the plugin name when the element declares no label of its own', async () => {
    respondWith(manifest({ pluginSchema: { acmeBare: { attributes: {}, defaultStyle: {} } } }));

    const catalog = await pluginCatalog({ acmeBare: { resource: 'https://cdn.test/acme/2' } });

    expect(catalog.acmeBare).toMatchObject({ label: 'Acme Widgets', custom: true });
  });

  /**
   * The important one: an unreachable plugin host must not cost the agent the whole catalog. The type still exists in
   * the schema, so it is reported as a custom type nothing more is known about.
   */
  it('degrades one unreachable plugin to a bare custom entry instead of failing the catalog', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    const catalog = await pluginCatalog({ acmeGone: { resource: 'https://cdn.test/acme/3' } });

    expect(catalog.acmeGone).toEqual({ custom: true });
  });

  it('does not re-fetch a manifest it already holds', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(manifest()) });
    vi.stubGlobal('fetch', fetchMock);

    await pluginCatalog({ acmeHero: { resource: 'https://cdn.test/acme/4' } });
    await pluginCatalog({ acmeHero: { resource: 'https://cdn.test/acme/4' } });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('stringDeclarations', () => {
  it('keeps scalar css and drops everything a starting style cannot be', () => {
    expect(stringDeclarations({ color: 'red', width: 10, hover: { color: 'blue' } })).toEqual({ color: 'red' });
  });

  it('answers undefined rather than an empty object, so the key is omitted entirely', () => {
    expect(stringDeclarations(undefined)).toBeUndefined();
    expect(stringDeclarations({ hover: { color: 'blue' } })).toBeUndefined();
  });
});
