import { describe, expect, it } from 'vitest';

import { collectBoundPaths, projectSlice } from './projection';

import type { Element, ElementBinding } from '@plitzi/sdk-shared';

const element = (
  id: string,
  items: string[] = [],
  bindings?: Element['definition']['bindings'],
  attributes: Record<string, unknown> = {}
): Element => ({
  id,
  attributes,
  definition: { type: 'container', label: id, rootId: 'root', items, styleSelectors: { base: '' }, bindings }
});

const binding = (source: string, extra: Partial<ElementBinding> = {}): ElementBinding => ({
  id: `b-${source}`,
  source,
  to: 'content',
  ...extra
});

const slice = {
  records: [
    { id: '1', values: { title: 'First', body: 'Body', authorEmail: 'a@b.c', internalNotes: 'secret' } },
    { id: '2', values: { title: 'Second', body: 'Body', authorEmail: 'd@e.f', internalNotes: 'private' } }
  ],
  pageInfo: { total: 2, hasNextPage: false }
};

describe('collectBoundPaths', () => {
  it('collects the paths bound directly against the source', () => {
    const flat = {
      root: element('root', ['text']),
      text: element('text', [], { attributes: [binding('apiContainer_posts.records.0.values.title')] })
    };

    expect(collectBoundPaths(flat, 'root', 'apiContainer_posts')).toEqual(['records.0.values.title']);
  });

  it('ignores bindings that target a different source', () => {
    const flat = {
      root: element('root', ['text']),
      text: element('text', [], { attributes: [binding('apiContainer_other.records.0.values.title')] })
    };

    expect(collectBoundPaths(flat, 'root', 'apiContainer_posts')).toEqual([]);
  });

  it('reaches bindings nested deep in the subtree', () => {
    const flat = {
      root: element('root', ['box']),
      box: element('box', ['text']),
      text: element('text', [], { attributes: [binding('apiContainer_posts.records.0.values.body')] })
    };

    expect(collectBoundPaths(flat, 'root', 'apiContainer_posts')).toEqual(['records.0.values.body']);
  });

  it('finds references hidden inside transformer params', () => {
    const flat = {
      root: element('root', ['text']),
      text: element('text', [], {
        attributes: [
          binding('apiContainer_posts.records', {
            transformers: [
              { action: 'twigTemplate', params: { template: 'Hi {{apiContainer_posts.records.0.values.author}}' } }
            ]
          })
        ]
      })
    };

    expect(collectBoundPaths(flat, 'root', 'apiContainer_posts').sort()).toEqual([
      'records',
      'records.0.values.author'
    ]);
  });

  it('finds references inside element attribute templates', () => {
    const flat = {
      root: element('root', ['text']),
      text: element('text', [], undefined, { content: '{{apiContainer_posts.records.0.values.slug}}' })
    };

    expect(collectBoundPaths(flat, 'root', 'apiContainer_posts')).toEqual(['records.0.values.slug']);
  });

  it('returns nothing for an element that publishes no source', () => {
    const flat = { root: element('root') };

    expect(collectBoundPaths(flat, 'root', '')).toEqual([]);
  });
});

describe('projectSlice', () => {
  it('drops fields nobody bound', () => {
    const result = projectSlice(slice, ['records.0.values.title']) as typeof slice;

    expect(result.records[0].values).toEqual({ title: 'First' });
    expect(result.records[0].values).not.toHaveProperty('authorEmail');
    expect(result.records[0].values).not.toHaveProperty('internalNotes');
  });

  it('applies a bound index to every record in the window', () => {
    const result = projectSlice(slice, ['records.0.values.title']) as typeof slice;

    expect(result.records).toHaveLength(2);
    expect(result.records[1].values).toEqual({ title: 'Second' });
  });

  it('keeps every bound field', () => {
    const result = projectSlice(slice, ['records.0.values.title', 'records.0.values.body']) as typeof slice;

    expect(result.records[0].values).toEqual({ title: 'First', body: 'Body' });
  });

  it('keeps page info even when nothing binds it', () => {
    const result = projectSlice(slice, ['records.0.values.title']) as typeof slice;

    expect(result.pageInfo).toEqual({ total: 2, hasNextPage: false });
  });

  it('keeps a whole subtree when the bound path stops at a branch', () => {
    const result = projectSlice(slice, ['records']) as typeof slice;

    expect(result.records[0].values).toHaveProperty('internalNotes');
  });

  it('passes the slice through untouched when nothing references the source', () => {
    expect(projectSlice(slice, [])).toEqual(slice);
  });

  it('leaves a non-object slice alone', () => {
    expect(projectSlice('plain', ['anything'])).toBe('plain');
  });

  it('omits a bound path the provider did not return', () => {
    const result = projectSlice(slice, ['records.0.values.missing']) as typeof slice;

    expect(result.records[0].values).toEqual({});
  });
});
