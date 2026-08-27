import { describe, it, expect } from 'vitest';

import { buildSpace } from './helpers';
import { readResource } from '../resources';
import { search } from '../tools';

import type { Space } from '../helpers';

describe('mcp-ai search', () => {
  it('finds elements by attribute value and reports their page ref', () => {
    const res = search({ query: 'box' }, buildSpace(), 'main');
    expect(res.results.some(r => r.ref === 'c1' && r.pageRef === 'home')).toBe(true);
  });

  it('returns a ready-to-read uri, pageUri, stateVersion and tree path per hit (I1/I6/R2)', () => {
    const res = search({ query: 'box' }, buildSpace(), 'main');
    const hit = res.results.find(r => r.ref === 'c1');
    expect(hit?.uri).toBe('plitzi://schema/main/elements/c1');
    expect(hit?.pageUri).toBe('plitzi://schema/main/pages/home');
    expect(hit?.parentRef).toBe('home');
    expect(hit?.path).toEqual(['Home', 'Container']);
    const read = readResource(buildSpace(), 'main', 'plitzi://schema/main/elements/c1');
    expect(hit?.stateVersion).toBe(read?.stateVersion);
  });

  it('omits detail unless include: "detail" is requested', () => {
    expect(search({ query: 'box' }, buildSpace(), 'main').results[0].detail).toBeUndefined();
    const withDetail = search({ query: 'box', include: 'detail' }, buildSpace(), 'main');
    expect(withDetail.results[0].detail?.props).toEqual({ title: 'Box' });
  });

  it('never returns page elements as hits', () => {
    const res = search({ query: 'home' }, buildSpace(), 'main');
    expect(res.results.every(r => r.type !== 'page')).toBe(true);
  });

  it('matches pages by name/slug under a separate pages field, with a ready-to-read uri + version', () => {
    const res = search({ query: 'home' }, buildSpace(), 'main');
    const page = res.pages?.find(p => p.ref === 'home');
    expect(page?.uri).toBe('plitzi://schema/main/pages/home');
    expect(page?.matches).toContain('label: Home');
    const readPage = readResource(buildSpace(), 'main', 'plitzi://schema/main/pages/home');
    expect(page?.stateVersion).toBe(readPage?.stateVersion);
  });

  it('omits the pages field when no page name/slug matches', () => {
    expect(search({ query: 'box' }, buildSpace(), 'main').pages).toBeUndefined();
  });
});

describe('mcp-ai search pagination', () => {
  const buildBusySpace = (count: number): Space => {
    const space = buildSpace();
    const flat = space.schema.flat as unknown as Record<string, unknown>;
    delete flat.c1;
    const items: string[] = [];
    for (let i = 1; i <= count; i++) {
      const ref = `box${i}`;
      items.push(ref);
      flat[ref] = {
        id: ref,
        attributes: { subType: 'div', title: 'Box' },
        definition: {
          rootId: 'page1',
          parentId: 'page1',
          label: 'Container',
          type: 'container',
          items: [],
          styleSelectors: { base: 'box' }
        }
      };
    }

    (flat.page1 as { definition: { items: string[] } }).definition.items = items;

    return space;
  };

  it('caps results at limit, reports total and hands back nextOffset while more remain', () => {
    const res = search({ query: 'box', limit: 2 }, buildBusySpace(5), 'main');
    expect(res.results).toHaveLength(2);
    expect(res.total).toBe(5);
    expect(res.offset).toBe(0);
    expect(res.limit).toBe(2);
    expect(res.nextOffset).toBe(2);
  });

  it('returns the page at offset and omits nextOffset on the last page', () => {
    const res = search({ query: 'box', limit: 2, offset: 4 }, buildBusySpace(5), 'main');
    expect(res.results).toHaveLength(1);
    expect(res.total).toBe(5);
    expect(res.offset).toBe(4);
    expect(res.nextOffset).toBeUndefined();
  });

  it('defaults to a page of 50 from offset 0', () => {
    const res = search({ query: 'box' }, buildBusySpace(3), 'main');
    expect(res.offset).toBe(0);
    expect(res.limit).toBe(50);
    expect(res.results).toHaveLength(3);
    expect(res.nextOffset).toBeUndefined();
  });

  it('paging with offset = nextOffset covers every hit exactly once', () => {
    const space = buildBusySpace(5);
    const first = search({ query: 'box', limit: 2 }, space, 'main');
    const second = search({ query: 'box', limit: 2, offset: first.nextOffset }, space, 'main');
    const third = search({ query: 'box', limit: 2, offset: second.nextOffset }, space, 'main');
    const refs = [...first.results, ...second.results, ...third.results].map(r => r.ref);
    expect(new Set(refs).size).toBe(5);
    expect(third.nextOffset).toBeUndefined();
  });
});

describe('mcp-ai search returns matching definitions', () => {
  it('returns definitions whose ref matches the query, with full CSS', () => {
    const res = search({ query: 'box' }, buildSpace(), 'main');
    expect(res.definitions?.find(d => d.ref === 'box')?.desktop).toEqual({ display: 'flex' });
  });

  it('omits the definitions field when no definition name matches', () => {
    expect(search({ query: 'zzz-nothing' }, buildSpace(), 'main').definitions).toBeUndefined();
  });
});
