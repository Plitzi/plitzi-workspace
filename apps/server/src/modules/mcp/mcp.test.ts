import { describe, expect, it } from 'vitest';

import { buildTypeRegistry, readResource, resourceErrorMessage } from './resources';
import { createMcpServer } from './server';
import { apply, operation, read, search, tools, validate } from './tools';
import { createMemoryDraftStore, createPreview } from '../ssr/preview';

import type { Space } from './helpers';
import type { Operation, Persisters, SearchResponse } from './tools';
import type {
  AIDefinition,
  AIElementDetail,
  AIFolder,
  AIPageSkeleton,
  AIPageStyles,
  AIPageSummary,
  AISchemaVariable,
  AIStyleVariable
} from './types';
import type { Schema, SSRAdapters, Style } from '@plitzi/sdk-shared';

const buildSpace = (): Space => {
  const schema = {
    flat: {
      page1: {
        id: 'page1',
        attributes: { slug: '', name: 'Home', default: true },
        definition: { rootId: 'page1', label: 'Page', type: 'page', items: ['c1'], styleSelectors: { base: 'page-x' } }
      },
      c1: {
        id: 'c1',
        attributes: { subType: 'div', title: 'Box' },
        definition: {
          rootId: 'page1',
          parentId: 'page1',
          label: 'Container',
          type: 'container',
          items: [],
          styleSelectors: { base: 'box' }
        }
      }
    },
    definition: { name: 'Test', permanentUrl: '' },
    variables: [{ name: 'apiUrl', category: 'general', type: 'text', value: 'https://api', subValues: [] }],
    settings: { customCss: '' },
    pages: ['page1'],
    pageFolders: []
  } as unknown as Schema;

  const style = {
    platform: {
      desktop: {
        box: {
          name: 'box',
          type: 'class',
          attributes: {
            base: { default: { display: 'flex' }, variants: { lg: { default: { 'font-size': '50px' } } } }
          },
          cache: ''
        }
      },
      tablet: {},
      mobile: {}
    },
    theme: { default: 'system', schemes: ['light', 'dark'] },
    variables: { color: { foreground: { light: '#000', dark: '#fff', default: '#000' } } },
    cache: ''
  } as unknown as Style;

  return { schema, style };
};

// Captures what apply persists into each schema store, exposing the merged result as a Space to re-read.
const capturing = (space: Space): { persisters: Persisters; saved: () => Space } => {
  const state: Space = { schema: space.schema, style: space.style };

  return {
    persisters: {
      schema: schema => {
        state.schema = schema;

        return Promise.resolve();
      },
      style: style => {
        state.style = style;

        return Promise.resolve();
      }
    },
    saved: () => state
  };
};

describe('mcp-ai reads (filesystem model)', () => {
  it('derives element types from the observed space, never invented', () => {
    const reg = buildTypeRegistry(buildSpace().schema);
    expect(Object.keys(reg.types).sort()).toEqual(['container', 'page']);
    expect(reg.types.container.slots).toEqual(['base']);
    expect(reg.types.container.subTypes).toEqual(['div']);
    expect(reg.styleVariableCategories).toEqual(['color', 'spacing', 'shadow', 'custom']);
  });

  it('enriches built-in types with curated label/description/category and source', () => {
    const reg = buildTypeRegistry(buildSpace().schema);
    expect(reg.types.container.source).toBe('builtin');
    expect(reg.types.container.label).toBe('Container');
    expect(reg.types.container.category).toBe('structure');
    expect(reg.types.container.description).toContain('layout box');
    expect(reg.types.page.source).toBe('builtin');
  });

  it('enriches plugin types from the component catalog and falls back to observed label otherwise', () => {
    const schema = {
      flat: {
        p: {
          id: 'p',
          attributes: {},
          definition: { rootId: 'p', label: 'Page', type: 'page', items: ['w', 'u'], styleSelectors: { base: '' } }
        },
        w: {
          id: 'w',
          attributes: {},
          definition: {
            rootId: 'p',
            parentId: 'p',
            label: 'Fancy Chart',
            type: 'chartWidget',
            items: [],
            styleSelectors: { base: '' }
          }
        },
        u: {
          id: 'u',
          attributes: {},
          definition: {
            rootId: 'p',
            parentId: 'p',
            label: 'Mystery',
            type: 'legacyThing',
            items: [],
            styleSelectors: { base: '' }
          }
        }
      },
      definition: { name: 'T', permanentUrl: '' },
      variables: [],
      settings: { customCss: '' },
      pages: ['p'],
      pageFolders: []
    } as unknown as Schema;
    const catalog = {
      chartWidget: { label: 'Chart Widget', description: 'Renders a chart from a data source', category: 'plugin' }
    };

    const reg = buildTypeRegistry(schema, catalog);
    expect(reg.types.chartWidget.source).toBe('plugin');
    expect(reg.types.chartWidget.label).toBe('Chart Widget');
    expect(reg.types.chartWidget.description).toBe('Renders a chart from a data source');
    // Observed but undescribed: source unknown, label falls back to the instance label.
    expect(reg.types.legacyThing.source).toBe('unknown');
    expect(reg.types.legacyThing.label).toBe('Mystery');
    expect(reg.types.legacyThing.description).toBeUndefined();
  });

  it('lists pages as cheap summaries without element trees', () => {
    const res = readResource(buildSpace(), 'main', 'plitzi://schema/main/pages');
    const pages = res?.data as AIPageSummary[];
    expect(res?.stateVersion).toMatch(/^[a-f0-9]{12}$/);
    expect(pages[0]).toMatchObject({ ref: 'home', label: 'Home', default: true, elementCount: 1 });
    expect(pages[0]).not.toHaveProperty('tree');
  });

  it('reads one page as a skeleton tree (class refs, no props/CSS)', () => {
    const res = readResource(buildSpace(), 'main', 'plitzi://schema/main/pages/home');
    const page = res?.data as AIPageSkeleton;
    expect(page.tree[0]).toMatchObject({
      ref: 'c1',
      type: 'container',
      label: 'Container',
      subType: 'div',
      childCount: 0,
      base: ['box']
    });
    expect(page.tree[0]).not.toHaveProperty('props');
  });

  it('reads one element in full detail on demand', () => {
    const res = readResource(buildSpace(), 'main', 'plitzi://schema/main/elements/c1');
    const el = res?.data as AIElementDetail;
    expect(el).toMatchObject({ ref: 'c1', type: 'container', pageRef: 'home', parentRef: 'home' });
    expect(el.props).toEqual({ title: 'Box' });
    expect(el.style.base).toEqual(['box']);
  });

  it('lists definition refs, and reads one definition on demand', () => {
    const list = readResource(buildSpace(), 'main', 'plitzi://definitions/main')?.data as string[];
    expect(list).toEqual(['box']);

    const box = readResource(buildSpace(), 'main', 'plitzi://definitions/main/box')?.data as AIDefinition;
    expect(box.desktop).toEqual({ display: 'flex' });
    expect(box.variants?.lg.desktop).toEqual({ 'font-size': '50px' });
  });

  it('reads style variables with theme values and var(--name) reference', () => {
    const res = readResource(buildSpace(), 'main', 'plitzi://style-variables/main');
    const colors = (res?.data as Record<string, AIStyleVariable[]>).color;
    expect(colors[0]).toEqual({
      name: 'foreground',
      reference: 'var(--foreground)',
      value: { light: '#000', dark: '#fff', default: '#000' }
    });
  });
});

describe('mcp-ai validator (teaching errors)', () => {
  it('rejects camelCase CSS and suggests the kebab key', () => {
    const result = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'btn', desktop: { backgroundColor: '#000' } }] },
      buildSpace()
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0].hint).toContain('background-color');
  });

  it('rejects an unknown style-variable category with validValues', () => {
    const result = validate(
      {
        operations: [
          { type: 'upsertStyleVariable', category: 'typography', name: '--x', value: '1px' } as unknown as Operation
        ]
      },
      buildSpace()
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0].validValues).toEqual(['color', 'spacing', 'shadow', 'custom']);
  });

  it('rejects a non-existent pageRef with the list of valid refs', () => {
    const result = validate({ operations: [{ type: 'deleteElement', pageRef: 'ghost', ref: 'c1' }] }, buildSpace());
    expect(result.valid).toBe(false);
    expect(result.errors[0].validValues).toEqual(['home']);
  });
});

const spaceWithRoute = (): Space => {
  const space = buildSpace();
  (space.schema.flat.page1.attributes as Record<string, unknown>).slug = ':spaceId';

  return space;
};

const varOp = (pageRef: string, type: string, value: string): Operation => ({
  type: 'upsertElement',
  pageRef,
  element: { ref: 'x', type, props: { q: value } }
});

describe('mcp-ai variable-reference validation', () => {
  it('accepts a known space schema variable, no warning', () => {
    const r = validate({ operations: [varOp('home', 'container', '{{apiUrl}}/x')] }, buildSpace());
    expect(r.valid).toBe(true);
    expect(r.warnings.some(w => w.includes('Unknown variable'))).toBe(false);
  });

  it('warns (does not error) on an unknown/hallucinated variable', () => {
    const r = validate({ operations: [varOp('home', 'container', '{{bogusVar}}')] }, buildSpace());
    expect(r.valid).toBe(true);
    expect(r.warnings.some(w => w.includes('Unknown variable {{bogusVar}}'))).toBe(true);
  });

  it('accepts a page route param (from the slug) as a valid {{name}}', () => {
    const r = validate(
      { operations: [varOp('spaceid', 'container', '{{apiUrl}}/spaces/{{spaceId}}')] },
      spaceWithRoute()
    );
    expect(r.warnings.some(w => w.includes('Unknown variable'))).toBe(false);
  });

  it('accepts a variable the same batch declares', () => {
    const r = validate(
      {
        operations: [
          { type: 'upsertVariable', name: 'newVar', variableType: 'text', value: 'v' },
          varOp('home', 'container', '{{newVar}}')
        ]
      },
      buildSpace()
    );
    expect(r.warnings.some(w => w.includes('Unknown variable'))).toBe(false);
  });

  it('skips {{...}} inside raw-code element types (no false positives on JSX)', () => {
    const r = validate(
      { operations: [varOp('home', 'blockJsx', 'style={{ position: "relative" }} {{bogusVar}}')] },
      buildSpace()
    );
    expect(r.warnings.some(w => w.includes('Unknown variable'))).toBe(false);
  });

  it('validates var(--token) in CSS values against the design tokens', () => {
    const known = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'btn', desktop: { color: 'var(--foreground)' } }] },
      buildSpace()
    );
    expect(known.warnings.some(w => w.includes('Unknown style variable'))).toBe(false);

    const unknown = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'btn', desktop: { color: 'var(--nope)' } }] },
      buildSpace()
    );
    expect(unknown.warnings.some(w => w.includes('Unknown style variable var(--nope)'))).toBe(true);
  });
});

describe('mcp-ai page skeleton route params', () => {
  it('exposes route params derived from the slug', () => {
    const sk = readResource(spaceWithRoute(), 'main', 'plitzi://schema/main/pages/spaceid')?.data as AIPageSkeleton;
    expect(sk.routeParams).toEqual(['spaceId']);
  });

  it('is an empty list for a static page', () => {
    const sk = readResource(buildSpace(), 'main', 'plitzi://schema/main/pages/home')?.data as AIPageSkeleton;
    expect(sk.routeParams).toEqual([]);
  });
});

describe('mcp-ai apply (writes + dryRun + diff + full elements + OCC)', () => {
  const ops: Operation[] = [
    { type: 'upsertDefinition', ref: 'btn-hero', desktop: { 'background-color': '#3b82f6' } },
    {
      type: 'upsertElement',
      pageRef: 'home',
      element: { ref: 'hero.cta', type: 'button', props: { content: 'Go' }, style: { base: ['btn-hero'] } }
    }
  ];

  it('dryRun reports the changed resources without persisting', async () => {
    const cap = capturing(buildSpace());
    const res = await apply({ operations: ops, dryRun: true }, buildSpace(), cap.persisters);
    expect(res.applied).toBe(false);
    expect(res.dryRun).toBe(true);
    expect(res.summary.created + res.summary.updated).toBe(2);
    expect(res.changed.map(c => c.uri)).toContain('plitzi://schema/main/pages/home');
    // dryRun must not call the persisters — the store is untouched.
    const page = readResource(cap.saved(), 'main', 'plitzi://schema/main/pages/home')?.data as AIPageSkeleton;
    expect(page.tree.map(n => n.ref)).not.toContain('hero.cta');
  });

  it('apply persists each changed schema and reports changed versions', async () => {
    const cap = capturing(buildSpace());
    const res = await apply({ operations: ops }, buildSpace(), cap.persisters);
    expect(res.applied).toBe(true);
    expect(res.persisted).toBe(true);
    expect(res.changed.some(c => c.uri.includes('definitions'))).toBe(true);
    // element op → element schema (page gains the new element); style op → style schema (new definition).
    const page = readResource(cap.saved(), 'main', 'plitzi://schema/main/pages/home')?.data as AIPageSkeleton;
    expect(page.tree.map(n => n.ref)).toContain('hero.cta');
    const defs = readResource(cap.saved(), 'main', 'plitzi://definitions/main')?.data as string[];
    expect(defs).toContain('btn-hero');
  });

  it('does not persist when no adapter is provided', async () => {
    const res = await apply({ operations: ops }, buildSpace());
    expect(res.applied).toBe(true);
    expect(res.persisted).toBe(false);
  });

  it('rejects the whole batch on a stale version (optimistic concurrency)', async () => {
    const res = await apply(
      { operations: ops, expectedResourceVersions: { 'plitzi://schema/main/pages/home': 'stale' } },
      buildSpace()
    );
    expect(res.applied).toBe(false);
    expect(res.conflict?.conflicts[0].resourceUri).toBe('plitzi://schema/main/pages/home');
  });

  it('deletes an element and its ref stops resolving', async () => {
    const cap = capturing(buildSpace());
    await apply({ operations: [{ type: 'deleteElement', pageRef: 'home', ref: 'c1' }] }, buildSpace(), cap.persisters);
    const page = readResource(cap.saved(), 'main', 'plitzi://schema/main/pages/home')?.data as AIPageSkeleton;
    expect(page.tree).toHaveLength(0);
  });

  it('returns the full detail of each created element (not just the diff)', async () => {
    const res = await apply({ operations: ops }, buildSpace());
    const cta = res.elements?.find(e => e.ref === 'hero.cta');
    expect(cta).toMatchObject({ ref: 'hero.cta', type: 'button', pageRef: 'home', props: { content: 'Go' } });
    expect(cta?.style.base).toEqual(['btn-hero']);
  });

  it('dryRun returns the same full element detail without persisting', async () => {
    const res = await apply({ operations: ops, dryRun: true }, buildSpace());
    expect(res.dryRun).toBe(true);
    expect(res.elements?.map(e => e.ref)).toContain('hero.cta');
  });

  it('returns an updated element with its new props', async () => {
    const res = await apply(
      {
        operations: [
          {
            type: 'upsertElement',
            pageRef: 'home',
            element: { ref: 'c1', type: 'container', props: { title: 'Renamed' } }
          }
        ]
      },
      buildSpace()
    );
    expect(res.elements?.find(e => e.ref === 'c1')?.props).toEqual({ title: 'Renamed' });
  });

  it('omits the elements field for a delete-only batch', async () => {
    const res = await apply({ operations: [{ type: 'deleteElement', pageRef: 'home', ref: 'c1' }] }, buildSpace());
    expect(res.elements).toBeUndefined();
  });

  it('creates a page and fills it in the same atomic batch (new page + elements)', async () => {
    const cap = capturing(buildSpace());
    const res = await apply(
      {
        operations: [
          { type: 'upsertPage', ref: 'cats', label: 'Cats', slug: 'cats' },
          { type: 'upsertDefinition', ref: 'hero', desktop: { 'background-color': '#111' } },
          {
            type: 'upsertElement',
            pageRef: 'cats',
            element: {
              ref: 'cats.hero',
              type: 'container',
              style: { base: ['hero'] },
              children: [{ ref: 'cats.title', type: 'text', props: { content: 'Cats' } }]
            }
          }
        ]
      },
      buildSpace(),
      cap.persisters
    );
    expect(res.applied).toBe(true);
    const page = readResource(cap.saved(), 'main', 'plitzi://schema/main/pages/cats')?.data as AIPageSkeleton;
    expect(page.tree.map(n => n.ref)).toContain('cats.hero');
    expect(page.tree[0].children?.[0].ref).toBe('cats.title');
  });
});

describe('mcp-ai schema integrity gate (validateSchema)', () => {
  it('rejects a batch that would create a cycle, and rolls back', async () => {
    const cap = capturing(buildSpace());
    const res = await apply(
      { operations: [{ type: 'moveElement', pageRef: 'home', ref: 'c1', toParentRef: 'c1', position: 'inside' }] },
      buildSpace(),
      cap.persisters
    );
    expect(res.applied).toBe(false);
    expect((res.errors ?? []).length).toBeGreaterThan(0);
    // Rollback: nothing persisted, c1 still sits under the page untouched.
    const page = readResource(cap.saved(), 'main', 'plitzi://schema/main/pages/home')?.data as AIPageSkeleton;
    expect(page.tree.map(n => n.ref)).toEqual(['c1']);
  });
});

describe('mcp-ai AI-facing contract', () => {
  it('parses valid operations and rejects unknown types via zod', () => {
    expect(
      operation.safeParse({ type: 'upsertElement', pageRef: 'home', element: { ref: 'x', type: 'container' } }).success
    ).toBe(true);
    expect(operation.safeParse({ type: 'frobnicate' }).success).toBe(false);
  });

  it('builds an MCP server (registers tools + resources) without throwing', () => {
    const s = buildSpace();
    const adapters = {
      getSchema: () => Promise.resolve(s.schema),
      getStyle: () => Promise.resolve(s.style)
    } as unknown as SSRAdapters;
    expect(() => createMcpServer({ adapters, getSpaceId: () => Promise.resolve(1) })).not.toThrow();
  });

  it('serves a human guide resource', () => {
    const res = readResource(buildSpace(), 'main', 'plitzi://guide');
    expect(typeof res?.data).toBe('string');
    expect(res?.data as string).toContain('plitzi://types');
  });
});

describe('mcp-ai legacy id addressing', () => {
  it('resolves a page and element by their raw ids even when an aiRef is present', async () => {
    const space = buildSpace();
    space.schema.flat.c1.definition.aiRef = 'my-box';

    const cap = capturing(space);
    await apply({ operations: [{ type: 'deleteElement', pageRef: 'page1', ref: 'c1' }] }, space, cap.persisters);

    const page = readResource(cap.saved(), 'main', 'plitzi://schema/main/pages/home')?.data as AIPageSkeleton;
    expect(page.tree).toHaveLength(0);
  });
});

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
    // The version must match what a direct element read yields, so it is valid for optimistic concurrency.
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
  // A space with exactly `count` elements that all match the query 'box', so paging is observable and total is
  // deterministic (the fixture's own c1 is removed so it does not add an extra hit).
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

describe('mcp-ai page styles resource (all styles a page uses in one read)', () => {
  it('collects the class definitions the page elements attach, deduplicated and with CSS', () => {
    const res = readResource(buildSpace(), 'main', 'plitzi://schema/main/pages/home/styles');
    const styles = res?.data as AIPageStyles;
    expect(styles.ref).toBe('home');
    expect(styles.definitions.find(d => d.ref === 'box')?.desktop).toEqual({ display: 'flex' });
    // page-x is attached by the page but has no definition in the style schema, so it does not surface.
    expect(styles.definitions.every(d => d.ref !== 'page-x')).toBe(true);
  });

  it('includes the global styles affecting any element type on the page', () => {
    const space = buildSpace();
    space.style.platform.desktop.containerGlobal = {
      name: 'containerGlobal',
      type: 'element',
      componentType: 'container',
      attributes: { base: { default: { 'box-sizing': 'border-box' } } },
      cache: ''
    } as unknown as (typeof space.style.platform)['desktop'][string];
    const styles = readResource(space, 'main', 'plitzi://schema/main/pages/home/styles')?.data as AIPageStyles;
    expect(styles.globalStyles.find(g => g.ref === 'containerGlobal')?.appliesToType).toBe('container');
  });
});

describe('mcp-ai batch read (many uris in one call)', () => {
  it('reads several uris at once, returning data or a teachable error per uri', () => {
    const res = read(
      { uris: ['plitzi://schema/main/elements/c1', 'plitzi://schema/main/elements/does-not-exist'] },
      buildSpace(),
      'main'
    );
    expect(res.results[0].stateVersion).toMatch(/^[a-f0-9]{12}$/);
    expect((res.results[0].data as AIElementDetail).ref).toBe('c1');
    expect(res.results[1].data).toBeUndefined();
    expect(res.results[1].error).toBe('NOT_FOUND');
  });

  it('flags a malformed uri without failing the whole batch', () => {
    const res = read({ uris: ['not-a-real-uri', 'plitzi://schema/main/elements/c1'] }, buildSpace(), 'main');
    expect(res.results[0].error).toBe('MALFORMED_URI');
    expect((res.results[1].data as AIElementDetail).ref).toBe('c1');
  });
});

describe('mcp-ai slim primer (cold-start payload)', () => {
  it('drops schema-variable subValues (kept only on the dedicated resource)', () => {
    const primer = readResource(buildSpace(), 'main', 'plitzi://primer/main')?.data as {
      schemaVariables: Record<string, AISchemaVariable>;
    };
    expect(primer.schemaVariables.apiUrl.value).toBe('https://api');
    expect(primer.schemaVariables.apiUrl.subValues).toBeUndefined();
    const dedicated = readResource(buildSpace(), 'main', 'plitzi://schema-variables/main')?.data as Record<
      string,
      AISchemaVariable
    >;
    expect(dedicated.apiUrl.subValues).toEqual([]);
  });

  it('excludes oversized prop values (e.g. base64 blobs) from type-registry examples', () => {
    const space = buildSpace();
    space.schema.flat.c1.attributes.contentCache = 'x'.repeat(500);
    const reg = buildTypeRegistry(space.schema);
    expect(reg.types.container.props.contentCache.valueTypes).toEqual(['string']);
    expect(reg.types.container.props.contentCache.examples).toEqual([]);
  });
});

describe('mcp-ai resolved style inlined in element detail (RFC 0005 #1)', () => {
  it('inlines the CSS of each attached definition under resolvedStyle', () => {
    const res = readResource(buildSpace(), 'main', 'plitzi://schema/main/elements/c1');
    const el = res?.data as AIElementDetail;
    expect(el.resolvedStyle?.box.desktop).toEqual({ display: 'flex' });
    expect(el.resolvedStyle?.box.variants?.lg.desktop).toEqual({ 'font-size': '50px' });
  });

  it('omits resolvedStyle when the attached class resolves to no definition', () => {
    const space = buildSpace();
    space.schema.flat.c1.definition.styleSelectors.base = 'not-a-definition';
    const el = readResource(space, 'main', 'plitzi://schema/main/elements/c1')?.data as AIElementDetail;
    expect(el.resolvedStyle).toBeUndefined();
  });

  it('lists the global element selectors that affect the element by its type (like `button { … }`)', () => {
    const space = buildSpace();
    space.style.platform.desktop.containerGlobal = {
      name: 'containerGlobal',
      type: 'element',
      componentType: 'container',
      attributes: { base: { default: { 'box-sizing': 'border-box' } } },
      cache: ''
    } as unknown as (typeof space.style.platform)['desktop'][string];
    const el = readResource(space, 'main', 'plitzi://schema/main/elements/c1')?.data as AIElementDetail;
    expect(el.globalStyles?.[0]).toMatchObject({
      ref: 'containerGlobal',
      appliesToType: 'container',
      desktop: { 'box-sizing': 'border-box' }
    });
  });

  it('omits globalStyles when no global selector targets the element type (globals may not exist yet)', () => {
    const el = readResource(buildSpace(), 'main', 'plitzi://schema/main/elements/c1')?.data as AIElementDetail;
    expect(el.globalStyles).toBeUndefined();
  });

  it('search include:"detail" carries resolvedStyle and its version matches a direct element read', () => {
    const withDetail = search({ query: 'box', include: 'detail' }, buildSpace(), 'main');
    const hit = withDetail.results.find(r => r.ref === 'c1');
    expect(hit?.detail?.resolvedStyle?.box.desktop).toEqual({ display: 'flex' });
    const read = readResource(buildSpace(), 'main', 'plitzi://schema/main/elements/c1');
    expect(hit?.stateVersion).toBe(read?.stateVersion);
  });
});

describe('mcp-ai search returns matching definitions (RFC 0005 #5)', () => {
  it('returns definitions whose ref matches the query, with full CSS', () => {
    const res = search({ query: 'box' }, buildSpace(), 'main');
    expect(res.definitions?.find(d => d.ref === 'box')?.desktop).toEqual({ display: 'flex' });
  });

  it('omits the definitions field when no definition name matches', () => {
    expect(search({ query: 'zzz-nothing' }, buildSpace(), 'main').definitions).toBeUndefined();
  });
});

describe('mcp-ai patchDefinition (RFC 0005 #2 — partial CSS merge)', () => {
  it('merges one declaration, preserving the rest of the definition', async () => {
    const cap = capturing(buildSpace());
    const res = await apply(
      { operations: [{ type: 'patchDefinition', ref: 'box', desktop: { color: 'red' } }] },
      buildSpace(),
      cap.persisters
    );
    expect(res.applied).toBe(true);
    const def = readResource(cap.saved(), 'main', 'plitzi://definitions/main/box')?.data as AIDefinition;
    expect(def.desktop).toEqual({ display: 'flex', color: 'red' });
    expect(def.variants?.lg.desktop).toEqual({ 'font-size': '50px' });
  });

  it('removes a property when its value is null, leaving the others', async () => {
    const cap = capturing(buildSpace());
    await apply(
      { operations: [{ type: 'patchDefinition', ref: 'box', desktop: { display: null, 'align-items': 'center' } }] },
      buildSpace(),
      cap.persisters
    );
    const def = readResource(cap.saved(), 'main', 'plitzi://definitions/main/box')?.data as AIDefinition;
    expect(def.desktop).toEqual({ 'align-items': 'center' });
  });

  it('fails (does not create) when the definition does not exist', async () => {
    const res = await apply(
      { operations: [{ type: 'patchDefinition', ref: 'ghost', desktop: { color: 'red' } }] },
      buildSpace()
    );
    expect(res.applied).toBe(false);
    expect(res.errors?.[0].message).toContain('not found');
  });

  it('expands shorthands in a patch just like upsertDefinition', async () => {
    const cap = capturing(buildSpace());
    await apply(
      { operations: [{ type: 'patchDefinition', ref: 'box', desktop: { padding: '4px 8px' } }] },
      buildSpace(),
      cap.persisters
    );
    const def = readResource(cap.saved(), 'main', 'plitzi://definitions/main/box')?.data as AIDefinition;
    expect(def.desktop?.['padding-top']).toBe('4px');
    expect(def.desktop?.['padding-right']).toBe('8px');
    expect(def.desktop?.display).toBe('flex');
  });
});

describe('mcp-ai class ops never touch a global element style (false-positive guard)', () => {
  const spaceWithGlobal = (): Space => {
    const space = buildSpace();
    space.style.platform.desktop.button = {
      name: 'button',
      type: 'element',
      componentType: 'button',
      attributes: { base: { default: { 'background-color': 'blue' } } },
      cache: ''
    } as unknown as (typeof space.style.platform)['desktop'][string];

    return space;
  };

  it('excludes element-type items from the definitions listing and does not resolve one', () => {
    expect(readResource(spaceWithGlobal(), 'main', 'plitzi://definitions/main')?.data).toEqual(['box']);
    expect(readResource(spaceWithGlobal(), 'main', 'plitzi://definitions/main/button')).toBeNull();
  });

  it('omits element-type items from search definitions', () => {
    expect(search({ query: 'button' }, spaceWithGlobal(), 'main').definitions).toBeUndefined();
  });

  it('refuses upsertDefinition on a global element name and never converts it', async () => {
    const cap = capturing(spaceWithGlobal());
    const res = await apply(
      { operations: [{ type: 'upsertDefinition', ref: 'button', desktop: { color: 'red' } }] },
      cap.saved(),
      cap.persisters
    );
    expect(res.applied).toBe(false);
    expect(res.errors?.[0].message).toContain('global style');
    // Nothing persisted; the global item keeps its type and CSS.
    const item = cap.saved().style.platform.desktop.button as unknown as { type: string };
    expect(item.type).toBe('element');
  });

  it('refuses patchDefinition and deleteDefinition on a global element name', async () => {
    const patched = await apply(
      { operations: [{ type: 'patchDefinition', ref: 'button', desktop: { color: 'red' } }] },
      spaceWithGlobal()
    );
    expect(patched.applied).toBe(false);
    expect(patched.errors?.[0].message).toContain('global style');

    const deleted = await apply({ operations: [{ type: 'deleteDefinition', ref: 'button' }] }, spaceWithGlobal());
    expect(deleted.applied).toBe(false);
    expect(deleted.errors?.[0].message).toContain('global style');
  });
});

describe('mcp-ai global element styles (editable site-wide selectors like `button { … }`)', () => {
  const globalOp = {
    type: 'upsertGlobalStyle',
    componentType: 'button',
    desktop: { 'border-radius': '9999px' }
  } as const;

  it('creates a type "element" selector keyed by componentType — "all buttons rounded"', async () => {
    const cap = capturing(buildSpace());
    const res = await apply({ operations: [globalOp] }, buildSpace(), cap.persisters);
    expect(res.applied).toBe(true);
    const item = cap.saved().style.platform.desktop.button as unknown as { type: string; componentType: string };
    expect(item.type).toBe('element');
    expect(item.componentType).toBe('button');
    const read = readResource(cap.saved(), 'main', 'plitzi://global-styles/main/button')?.data as AIDefinition & {
      appliesToType: string;
    };
    expect(read.appliesToType).toBe('button');
    expect(read.desktop?.['border-top-left-radius']).toBe('9999px');
  });

  it('lists the element types that have a global style', async () => {
    const cap = capturing(buildSpace());
    await apply({ operations: [globalOp] }, buildSpace(), cap.persisters);
    expect(readResource(cap.saved(), 'main', 'plitzi://global-styles/main')?.data).toEqual(['button']);
  });

  it('reflects the created global in the detail of every element of that type', async () => {
    const cap = capturing(buildSpace());
    // c1 is a container; add a button element so it inherits the button global.
    await apply(
      {
        operations: [
          { type: 'upsertElement', pageRef: 'home', element: { ref: 'cta', type: 'button', props: { content: 'Go' } } },
          globalOp
        ]
      },
      buildSpace(),
      cap.persisters
    );
    const el = readResource(cap.saved(), 'main', 'plitzi://schema/main/elements/cta')?.data as AIElementDetail;
    expect(el.globalStyles?.[0].appliesToType).toBe('button');
    expect(el.globalStyles?.[0].desktop?.['border-top-left-radius']).toBe('9999px');
  });

  it('patchGlobalStyle merges into an existing global without resending it', async () => {
    const cap = capturing(buildSpace());
    await apply({ operations: [globalOp] }, buildSpace(), cap.persisters);
    const res = await apply(
      { operations: [{ type: 'patchGlobalStyle', componentType: 'button', desktop: { color: 'white' } }] },
      cap.saved(),
      cap.persisters
    );
    expect(res.applied).toBe(true);
    const read = readResource(cap.saved(), 'main', 'plitzi://global-styles/main/button')?.data as AIDefinition;
    expect(read.desktop?.color).toBe('white');
    expect(read.desktop?.['border-top-left-radius']).toBe('9999px');
  });

  it('deleteGlobalStyle removes the global selector', async () => {
    const cap = capturing(buildSpace());
    await apply({ operations: [globalOp] }, buildSpace(), cap.persisters);
    await apply({ operations: [{ type: 'deleteGlobalStyle', componentType: 'button' }] }, cap.saved(), cap.persisters);
    expect(readResource(cap.saved(), 'main', 'plitzi://global-styles/main/button')).toBeNull();
  });

  it('refuses a global op on a name held by a class definition (symmetric guard)', async () => {
    const res = await apply(
      { operations: [{ type: 'upsertGlobalStyle', componentType: 'box', desktop: { color: 'red' } }] },
      buildSpace()
    );
    expect(res.applied).toBe(false);
    expect(res.errors?.[0].message).toContain('class definition');
  });

  it('patchGlobalStyle fails when no global exists yet for that type', async () => {
    const res = await apply(
      { operations: [{ type: 'patchGlobalStyle', componentType: 'button', desktop: { color: 'red' } }] },
      buildSpace()
    );
    expect(res.applied).toBe(false);
    expect(res.errors?.[0].message).toContain('No global style');
  });
});

describe('mcp-ai id styles (editable single-element selectors like `#hero { … }`)', () => {
  const idOp = { type: 'upsertIdStyle', targetId: 'hero', desktop: { 'min-height': '100vh' } } as const;

  it('creates a type "id" selector keyed by the DOM id', async () => {
    const cap = capturing(buildSpace());
    const res = await apply({ operations: [idOp] }, buildSpace(), cap.persisters);
    expect(res.applied).toBe(true);
    const item = cap.saved().style.platform.desktop.hero as unknown as { type: string; cache: string };
    expect(item.type).toBe('id');
    expect(item.cache).toContain('#hero');
    const read = readResource(cap.saved(), 'main', 'plitzi://id-styles/main/hero')?.data as AIDefinition & {
      targetId: string;
    };
    expect(read.targetId).toBe('hero');
    expect(read.desktop?.['min-height']).toBe('100vh');
  });

  it('lists the DOM ids that have an id rule', async () => {
    const cap = capturing(buildSpace());
    await apply({ operations: [idOp] }, buildSpace(), cap.persisters);
    expect(readResource(cap.saved(), 'main', 'plitzi://id-styles/main')?.data).toEqual(['hero']);
  });

  it('patchIdStyle merges into an existing id rule; deleteIdStyle removes it', async () => {
    const cap = capturing(buildSpace());
    await apply({ operations: [idOp] }, buildSpace(), cap.persisters);
    const patched = await apply(
      { operations: [{ type: 'patchIdStyle', targetId: 'hero', desktop: { color: 'white' } }] },
      cap.saved(),
      cap.persisters
    );
    expect(patched.applied).toBe(true);
    const read = readResource(cap.saved(), 'main', 'plitzi://id-styles/main/hero')?.data as AIDefinition;
    expect(read.desktop?.color).toBe('white');
    expect(read.desktop?.['min-height']).toBe('100vh');

    await apply({ operations: [{ type: 'deleteIdStyle', targetId: 'hero' }] }, cap.saved(), cap.persisters);
    expect(readResource(cap.saved(), 'main', 'plitzi://id-styles/main/hero')).toBeNull();
  });

  it('patchIdStyle fails when no id rule exists yet', async () => {
    const res = await apply(
      { operations: [{ type: 'patchIdStyle', targetId: 'hero', desktop: { color: 'red' } }] },
      buildSpace()
    );
    expect(res.applied).toBe(false);
    expect(res.errors?.[0].message).toContain('No id rule');
  });

  it('refuses an id op on a name held by a class definition (cross-kind guard)', async () => {
    const res = await apply(
      { operations: [{ type: 'upsertIdStyle', targetId: 'box', desktop: { color: 'red' } }] },
      buildSpace()
    );
    expect(res.applied).toBe(false);
    expect(res.errors?.[0].message).toContain('class definition');
  });

  it('inlines the id rule in the detail of an element carrying that DOM id', async () => {
    const cap = capturing(buildSpace());
    await apply(
      { operations: [{ type: 'patchElement', pageRef: 'home', ref: 'c1', props: { id: 'hero' } }, idOp] },
      buildSpace(),
      cap.persisters
    );
    const el = readResource(cap.saved(), 'main', 'plitzi://schema/main/elements/c1')?.data as AIElementDetail;
    expect(el.idStyle?.targetId).toBe('hero');
    expect(el.idStyle?.desktop?.['min-height']).toBe('100vh');
  });

  it('omits idStyle when the element has no matching DOM id', async () => {
    const cap = capturing(buildSpace());
    await apply({ operations: [idOp] }, buildSpace(), cap.persisters);
    const el = readResource(cap.saved(), 'main', 'plitzi://schema/main/elements/c1')?.data as AIElementDetail;
    expect(el.idStyle).toBeUndefined();
  });
});

describe('mcp-ai settings (space-level customCss + auth config)', () => {
  it('patchSettings merges customCss without dropping other settings', async () => {
    const cap = capturing(buildSpace());
    const css = '@keyframes spin { to { transform: rotate(360deg); } }';
    const res = await apply({ operations: [{ type: 'patchSettings', customCss: css }] }, buildSpace(), cap.persisters);
    expect(res.applied).toBe(true);
    const settings = readResource(cap.saved(), 'main', 'plitzi://settings/main')?.data as { customCss?: string };
    expect(settings.customCss).toBe(css);
  });

  it('a later patch preserves earlier keys (merge, not replace)', async () => {
    const cap = capturing(buildSpace());
    await apply({ operations: [{ type: 'patchSettings', customCss: '.a{}' }] }, buildSpace(), cap.persisters);
    await apply({ operations: [{ type: 'patchSettings', keepState: true }] }, cap.saved(), cap.persisters);
    const settings = readResource(cap.saved(), 'main', 'plitzi://settings/main')?.data as {
      customCss?: string;
      keepState?: boolean;
    };
    expect(settings.customCss).toBe('.a{}');
    expect(settings.keepState).toBe(true);
  });

  it('exposes settings in the cold-start primer', async () => {
    const cap = capturing(buildSpace());
    await apply({ operations: [{ type: 'patchSettings', customCss: '.z{}' }] }, buildSpace(), cap.persisters);
    const primer = readResource(cap.saved(), 'main', 'plitzi://primer/main')?.data as {
      settings: { customCss?: string };
    };
    expect(primer.settings.customCss).toBe('.z{}');
  });
});

describe('mcp-ai page enable/disable (attributes.enabled)', () => {
  it('a new page defaults to enabled', async () => {
    const cap = capturing(buildSpace());
    await apply({ operations: [{ type: 'upsertPage', ref: 'about', label: 'About' }] }, buildSpace(), cap.persisters);
    const page = readResource(cap.saved(), 'main', 'plitzi://schema/main/pages/about')?.data as AIPageSkeleton;
    expect(page.enabled).toBe(true);
  });

  it('disables a page with enabled:false and re-enables it', async () => {
    const cap = capturing(buildSpace());
    await apply({ operations: [{ type: 'upsertPage', ref: 'home', enabled: false }] }, buildSpace(), cap.persisters);
    let home = readResource(cap.saved(), 'main', 'plitzi://schema/main/pages/home')?.data as AIPageSkeleton;
    expect(home.enabled).toBe(false);
    const summary = (readResource(cap.saved(), 'main', 'plitzi://schema/main/pages')?.data as AIPageSummary[]).find(
      p => p.ref === 'home'
    );
    expect(summary?.enabled).toBe(false);

    await apply({ operations: [{ type: 'upsertPage', ref: 'home', enabled: true }] }, cap.saved(), cap.persisters);
    home = readResource(cap.saved(), 'main', 'plitzi://schema/main/pages/home')?.data as AIPageSkeleton;
    expect(home.enabled).toBe(true);
  });

  it('leaves enabled untouched when the field is omitted', async () => {
    const cap = capturing(buildSpace());
    await apply({ operations: [{ type: 'upsertPage', ref: 'home', enabled: false }] }, buildSpace(), cap.persisters);
    await apply({ operations: [{ type: 'upsertPage', ref: 'home', label: 'Renamed' }] }, cap.saved(), cap.persisters);
    const home = readResource(cap.saved(), 'main', 'plitzi://schema/main/pages/home')?.data as AIPageSkeleton;
    expect(home.label).toBe('Renamed');
    expect(home.enabled).toBe(false);
  });
});

describe('mcp-ai URI aliases under schema root (RFC 0005 #3/#4)', () => {
  it('resolves a definition through the plitzi://schema/{env}/definitions/{ref} alias', () => {
    const canonical = readResource(buildSpace(), 'main', 'plitzi://definitions/main/box');
    const alias = readResource(buildSpace(), 'main', 'plitzi://schema/main/definitions/box');
    expect(alias?.data).toEqual(canonical?.data);
  });

  it('resolves the definitions listing through the alias root', () => {
    const alias = readResource(buildSpace(), 'main', 'plitzi://schema/main/definitions')?.data as string[];
    expect(alias).toEqual(['box']);
  });

  it('reports a not-found (not malformed) alias whose ref does not resolve', () => {
    const parsed = JSON.parse(resourceErrorMessage('main', 'plitzi://schema/main/definitions/ghost')) as {
      error: string;
    };
    expect(parsed.error).toBe('NOT_FOUND');
  });
});

describe('mcp-ai primer bootstrap (R4)', () => {
  it('bundles guide, types, css and summaries in one read', () => {
    const res = readResource(buildSpace(), 'main', 'plitzi://primer/main');
    const primer = res?.data as {
      guide: string;
      types: { types: Record<string, unknown> };
      cssProperties: string[];
      pages: AIPageSummary[];
      definitions: string[];
    };
    expect(primer.guide).toContain('plitzi://types');
    expect(Object.keys(primer.types.types).sort()).toEqual(['container', 'page']);
    expect(primer.cssProperties.length).toBeGreaterThan(0);
    expect(primer.pages[0].ref).toBe('home');
    expect(primer.definitions).toContain('box');
    // Summaries only — no element trees inline.
    expect(primer.pages[0]).not.toHaveProperty('tree');
  });
});

describe('mcp-ai patchElement (I3/R3 — partial merge)', () => {
  it('changes only the listed prop, preserving the rest', async () => {
    const space = buildSpace();
    (space.schema.flat.c1.attributes as Record<string, unknown>).extra = 'keep';
    const res = await apply(
      { operations: [{ type: 'patchElement', pageRef: 'home', ref: 'c1', props: { title: 'Renamed' } }] },
      space
    );
    const el = res.elements?.find(e => e.ref === 'c1');
    expect(el?.props).toEqual({ title: 'Renamed', extra: 'keep' });
  });

  it('unsets a prop when its value is null', async () => {
    const res = await apply(
      { operations: [{ type: 'patchElement', pageRef: 'home', ref: 'c1', props: { title: null } }] },
      buildSpace()
    );
    expect(res.elements?.find(e => e.ref === 'c1')?.props).toBeUndefined();
  });

  it('merges style.base without touching other selectors', async () => {
    const res = await apply(
      { operations: [{ type: 'patchElement', pageRef: 'home', ref: 'c1', style: { base: ['box', 'extra'] } }] },
      buildSpace()
    );
    expect(res.elements?.find(e => e.ref === 'c1')?.style.base).toEqual(['box', 'extra']);
  });

  it('fails (does not create) when the element does not exist', async () => {
    const res = await apply(
      { operations: [{ type: 'patchElement', pageRef: 'home', ref: 'ghost', props: { x: 1 } }] },
      buildSpace()
    );
    expect(res.applied).toBe(false);
    expect(res.errors?.[0].message).toContain('not found');
  });
});

describe('mcp-ai write response element versions (R1)', () => {
  it('returns each element with its own uri and stateVersion, ready for the next edit', async () => {
    const res = await apply(
      {
        operations: [
          { type: 'upsertElement', pageRef: 'home', element: { ref: 'c1', type: 'container', props: { title: 'X' } } }
        ]
      },
      buildSpace()
    );
    const el = res.elements?.find(e => e.ref === 'c1');
    expect(el?.uri).toBe('plitzi://schema/main/elements/c1');
    expect(el?.stateVersion).toMatch(/^[a-f0-9]{12}$/);
  });
});

describe('mcp-ai resource error messages (I2)', () => {
  it('teaches valid templates for a malformed URI shape', () => {
    const msg = resourceErrorMessage('main', 'plitzi://schema/main/element/home/c1');
    const parsed = JSON.parse(msg) as { error: string; validTemplates: string[] };
    expect(parsed.error).toBe('MALFORMED_URI');
    expect(parsed.validTemplates).toContain('plitzi://schema/main/elements/{ref}');
  });

  it('flags a well-formed URI whose ref does not resolve as not-found', () => {
    const parsed = JSON.parse(resourceErrorMessage('main', 'plitzi://schema/main/elements/ghost')) as {
      error: string;
    };
    expect(parsed.error).toBe('NOT_FOUND');
  });
});

describe('mcp-ai CSS shorthand expansion (I4)', () => {
  it('accepts border-radius / padding shorthands and persists them as longhands', async () => {
    const cap = capturing(buildSpace());
    const res = await apply(
      {
        operations: [
          { type: 'upsertDefinition', ref: 'pill', desktop: { 'border-radius': '9999px', padding: '4px 8px' } }
        ]
      },
      buildSpace(),
      cap.persisters
    );
    expect(res.applied).toBe(true);
    const def = readResource(cap.saved(), 'main', 'plitzi://definitions/main/pill')?.data as AIDefinition;
    expect(def.desktop?.['border-top-left-radius']).toBe('9999px');
    expect(def.desktop?.['padding-top']).toBe('4px');
    expect(def.desktop?.['padding-right']).toBe('8px');
    expect(def.desktop).not.toHaveProperty('border-radius');
  });

  it('expands the border shorthand into per-side width/style/color', async () => {
    const cap = capturing(buildSpace());
    await apply(
      { operations: [{ type: 'upsertDefinition', ref: 'bd', desktop: { border: '1px solid red' } }] },
      buildSpace(),
      cap.persisters
    );
    const def = readResource(cap.saved(), 'main', 'plitzi://definitions/main/bd')?.data as AIDefinition;
    expect(def.desktop?.['border-top-width']).toBe('1px');
    expect(def.desktop?.['border-top-style']).toBe('solid');
    expect(def.desktop?.['border-top-color']).toBe('red');
  });
});

describe('mcp-ai type-aware prop warnings (I5)', () => {
  it('warns (not errors) when a prop is not among the type’s observed props', () => {
    const r = validate(
      {
        operations: [
          { type: 'upsertElement', pageRef: 'home', element: { ref: 'c2', type: 'container', props: { bogusProp: 1 } } }
        ]
      },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.warnings.some(w => w.includes('bogusProp'))).toBe(true);
  });

  it('does not warn for an observed prop', () => {
    const r = validate(
      {
        operations: [
          { type: 'upsertElement', pageRef: 'home', element: { ref: 'c2', type: 'container', props: { title: 'ok' } } }
        ]
      },
      buildSpace()
    );
    expect(r.warnings.some(w => w.includes('has no observed prop'))).toBe(false);
  });
});

describe('mcp-ai page folders (create/nest/associate/delete)', () => {
  it('creates a folder (ref becomes its id) and lists it', async () => {
    const cap = capturing(buildSpace());
    const res = await apply(
      { operations: [{ type: 'upsertFolder', ref: 'blog', name: 'Blog' }] },
      buildSpace(),
      cap.persisters
    );
    expect(res.applied).toBe(true);
    const folders = readResource(cap.saved(), 'main', 'plitzi://folders/main')?.data as AIFolder[];
    expect(folders).toEqual([{ ref: 'blog', name: 'Blog', slug: 'blog', parentId: undefined }]);
    const one = readResource(cap.saved(), 'main', 'plitzi://folders/main/blog')?.data as AIFolder;
    expect(one.name).toBe('Blog');
  });

  it('places a page in a folder (by its id) and reflects it in the page summary', async () => {
    const cap = capturing(buildSpace());
    await apply(
      {
        operations: [
          { type: 'upsertFolder', ref: 'blog', name: 'Blog' },
          { type: 'upsertPage', ref: 'post', label: 'Post', folder: 'blog' }
        ]
      },
      buildSpace(),
      cap.persisters
    );
    const pages = readResource(cap.saved(), 'main', 'plitzi://schema/main/pages')?.data as AIPageSummary[];
    expect(pages.find(p => p.ref === 'post')?.folder).toBe('blog');
  });

  it('nests folders parent-before-child (valid ordering) and applies', async () => {
    const cap = capturing(buildSpace());
    const res = await apply(
      {
        operations: [
          { type: 'upsertFolder', ref: 'docs', name: 'Docs' },
          { type: 'upsertFolder', ref: 'guides', name: 'Guides', parentId: 'docs' }
        ]
      },
      buildSpace(),
      cap.persisters
    );
    expect(res.applied).toBe(true);
    const folders = readResource(cap.saved(), 'main', 'plitzi://folders/main')?.data as AIFolder[];
    expect(folders.map(f => f.ref)).toEqual(['docs', 'guides']);
    expect(folders[1].parentId).toBe('docs');
  });

  it('rejects a page joining a folder that does not exist', () => {
    const r = validate({ operations: [{ type: 'upsertPage', ref: 'x', folder: 'ghost' }] }, buildSpace());
    expect(r.valid).toBe(false);
    expect(r.errors[0].message).toContain('Folder "ghost" does not exist');
  });

  it('rejects nesting a folder under itself', () => {
    const r = validate({ operations: [{ type: 'upsertFolder', ref: 'blog', parentId: 'blog' }] }, buildSpace());
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.message.includes('cannot be nested under itself'))).toBe(true);
  });

  it('deleteFolder promotes child folders and pages up to the parent', async () => {
    const cap = capturing(buildSpace());
    await apply(
      {
        operations: [
          { type: 'upsertFolder', ref: 'docs', name: 'Docs' },
          { type: 'upsertFolder', ref: 'guides', name: 'Guides', parentId: 'docs' },
          { type: 'upsertPage', ref: 'intro', label: 'Intro', folder: 'guides' }
        ]
      },
      buildSpace(),
      cap.persisters
    );
    const afterCreate = cap.saved();
    const res = await apply({ operations: [{ type: 'deleteFolder', ref: 'guides' }] }, afterCreate, cap.persisters);
    expect(res.applied).toBe(true);
    const folders = readResource(cap.saved(), 'main', 'plitzi://folders/main')?.data as AIFolder[];
    expect(folders.map(f => f.ref)).toEqual(['docs']);
    // The page in the deleted folder moved up to its parent (docs).
    const pages = readResource(cap.saved(), 'main', 'plitzi://schema/main/pages')?.data as AIPageSummary[];
    expect(pages.find(p => p.ref === 'intro')?.folder).toBe('docs');
  });

  it('resolves an existing folder ref by name and moves a page to the root with null', async () => {
    const cap = capturing(buildSpace());
    await apply({ operations: [{ type: 'upsertFolder', ref: 'blog', name: 'Blog' }] }, buildSpace(), cap.persisters);
    // The folder now exists, so a later batch may reference it by its name.
    await apply({ operations: [{ type: 'upsertPage', ref: 'post', folder: 'Blog' }] }, cap.saved(), cap.persisters);
    expect(
      (readResource(cap.saved(), 'main', 'plitzi://schema/main/pages')?.data as AIPageSummary[]).find(
        p => p.ref === 'post'
      )?.folder
    ).toBe('blog');

    await apply({ operations: [{ type: 'upsertPage', ref: 'post', folder: null }] }, cap.saved(), cap.persisters);
    expect(
      (readResource(cap.saved(), 'main', 'plitzi://schema/main/pages')?.data as AIPageSummary[]).find(
        p => p.ref === 'post'
      )?.folder
    ).toBeUndefined();
  });
});

describe('mcp-ai page.folder is always "" (root) or a valid id', () => {
  const folderOf = (space: Space, ref: string): unknown =>
    Object.values(space.schema.flat).find(el => el.definition.aiRef === ref)?.attributes.folder;

  it('stores "" (not a missing key) for a new page with no folder', async () => {
    const cap = capturing(buildSpace());
    await apply({ operations: [{ type: 'upsertPage', ref: 'plain', label: 'Plain' }] }, buildSpace(), cap.persisters);
    expect(folderOf(cap.saved(), 'plain')).toBe('');
  });

  it('accepts an explicit empty-string folder as root (not a missing-folder error)', async () => {
    const res = await apply({ operations: [{ type: 'upsertPage', ref: 'p', label: 'P', folder: '' }] }, buildSpace());
    expect(res.applied).toBe(true);
    expect(validate({ operations: [{ type: 'upsertPage', ref: 'p', folder: '' }] }, buildSpace()).valid).toBe(true);
  });

  it('detects (rejects) a folder that is not a real folder ref, via apply', async () => {
    const res = await apply(
      { operations: [{ type: 'upsertPage', ref: 'p', label: 'P', folder: 'not-a-real-folder' }] },
      buildSpace()
    );
    expect(res.applied).toBe(false);
    expect(res.errors?.some(e => e.message.includes('not-a-real-folder') && /does not exist/.test(e.message))).toBe(
      true
    );
  });

  it('detects a non-existent folder id when updating an existing page', async () => {
    const res = await apply({ operations: [{ type: 'upsertPage', ref: 'home', folder: 'ghost-id' }] }, buildSpace());
    expect(res.applied).toBe(false);
    expect(res.errors?.[0].path).toContain('folder');
  });

  it('guards at mutate time when the folder op is ordered after the page (validation cannot see order)', async () => {
    const res = await apply(
      {
        operations: [
          { type: 'upsertPage', ref: 'post', folder: 'blog' },
          { type: 'upsertFolder', ref: 'blog', name: 'Blog' }
        ]
      },
      buildSpace()
    );
    expect(res.applied).toBe(false);
    expect(res.errors?.some(e => e.message.includes('not found'))).toBe(true);
  });

  it('moving a page to the root stores "" (round-trips through the summary as no folder)', async () => {
    const cap = capturing(buildSpace());
    await apply(
      {
        operations: [
          { type: 'upsertFolder', ref: 'blog', name: 'Blog' },
          { type: 'upsertPage', ref: 'post', folder: 'blog' }
        ]
      },
      buildSpace(),
      cap.persisters
    );
    await apply({ operations: [{ type: 'upsertPage', ref: 'post', folder: '' }] }, cap.saved(), cap.persisters);
    expect(folderOf(cap.saved(), 'post')).toBe('');
    const summary = (readResource(cap.saved(), 'main', 'plitzi://schema/main/pages')?.data as AIPageSummary[]).find(
      p => p.ref === 'post'
    );
    expect(summary?.folder).toBeUndefined();
  });
});

describe('mcp-ai tool registry (defineTool descriptors)', () => {
  const ctx = () => ({ space: buildSpace(), env: 'main' as const, persisters: {} as Persisters });

  it('registers every tool with name, modes metadata and an execute', () => {
    expect(tools.map(t => t.name).sort()).toEqual([
      'plitzi_apply',
      'plitzi_preview',
      'plitzi_read',
      'plitzi_screenshot',
      'plitzi_search',
      'plitzi_validate'
    ]);
    expect(tools.every(t => typeof t.execute === 'function')).toBe(true);
    expect(tools.find(t => t.name === 'plitzi_apply')?.access).toBe('write');
    expect(tools.find(t => t.name === 'plitzi_search')?.access).toBe('read');
  });

  it('execute validates raw args against the shape, then runs the typed tool', () => {
    const searchTool = tools.find(t => t.name === 'plitzi_search');
    const result = searchTool?.execute({ query: 'box' }, ctx()) as SearchResponse;
    expect(result.results.some(r => r.ref === 'c1')).toBe(true);
  });

  it('execute rejects args that do not match the shape', () => {
    const readTool = tools.find(t => t.name === 'plitzi_read');
    expect(() => readTool?.execute({}, ctx())).toThrow();
  });
});

describe('mcp-ai draft store (one-shot preview tokens)', () => {
  it('returns the stashed draft exactly once, then nothing', () => {
    const store = createMemoryDraftStore();
    const data = { schema: buildSpace().schema, style: buildSpace().style };
    void store.put('tok', data, 60000);
    expect(store.take('tok')).toBe(data);
    expect(store.take('tok')).toBeUndefined();
  });

  it('drops an expired token', () => {
    const store = createMemoryDraftStore();
    void store.put('tok', { schema: buildSpace().schema, style: buildSpace().style }, -1);
    expect(store.take('tok')).toBeUndefined();
  });
});

describe('mcp-ai createPreview (draft build, pre-render error paths)', () => {
  const configWith = (offline: unknown) =>
    ({ adapters: { getOfflineData: () => Promise.resolve(offline) } }) as unknown as Parameters<
      typeof createPreview
    >[1];
  const unusedRender = (() => '') as unknown as Parameters<typeof createPreview>[2];
  const unusedPlugins = {} as Parameters<typeof createPreview>[3];
  const unusedCaches = {} as Parameters<typeof createPreview>[4];

  it('reports NO_DATA when the space has no offline data', async () => {
    const res = await createPreview({ spaceId: 1 }, configWith(undefined), unusedRender, unusedPlugins, unusedCaches);
    expect(res.ok).toBe(false);
    expect(res).toMatchObject({ error: 'NO_DATA' });
  });

  it('rejects unapplicable operations with teachable errors, before any render', async () => {
    const offline = { schema: buildSpace().schema, style: buildSpace().style };
    const res = await createPreview(
      {
        spaceId: 1,
        operations: [{ type: 'upsertElement', pageRef: 'no-such-page', element: { ref: 'x', type: 'button' } }]
      },
      configWith(offline),
      unusedRender,
      unusedPlugins,
      unusedCaches
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(['INVALID_OPERATIONS', 'APPLY_FAILED']).toContain(res.error);
      expect(res.errors?.length).toBeGreaterThan(0);
    }
  });
});

describe('mcp-ai plitzi_preview tool', () => {
  const previewToolDef = () => tools.find(t => t.name === 'plitzi_preview');

  it('is registered as a read tool', () => {
    expect(previewToolDef()?.access).toBe('read');
  });

  it('reports PREVIEW_UNAVAILABLE when no preview client is wired', async () => {
    const res = (await previewToolDef()?.execute({}, { space: buildSpace(), env: 'main', persisters: {} })) as {
      error?: string;
    };
    expect(res.error).toBe('PREVIEW_UNAVAILABLE');
  });

  it('forwards to the preview client and returns its html + meta', async () => {
    const preview = {
      render: () =>
        Promise.resolve({ ok: true as const, pagePath: '/', html: '<!doctype html><html></html>', stateVersion: 'v1' })
    };
    const res = (await previewToolDef()?.execute(
      { pageRef: 'home' },
      { space: buildSpace(), env: 'main', persisters: {}, spaceId: 1, preview }
    )) as { html?: string; pagePath?: string; stateVersion?: string };
    expect(res.html).toContain('<!doctype html>');
    expect(res.pagePath).toBe('/');
    expect(res.stateVersion).toBe('v1');
  });
});

describe('mcp-ai plitzi_screenshot tool', () => {
  const screenshotToolDef = () => tools.find(t => t.name === 'plitzi_screenshot');
  const okPreview = {
    render: () =>
      Promise.resolve({
        ok: true as const,
        token: 't',
        pagePath: '/',
        html: '<!doctype html><html></html>',
        stateVersion: 'v1'
      })
  };

  it('declares a screenshot capability requirement', () => {
    expect(screenshotToolDef()?.requires).toBe('screenshot');
  });

  it('returns image content when the browser service succeeds', async () => {
    const screenshot = {
      capture: () =>
        Promise.resolve({ ok: true as const, images: [{ label: 'desktop', mimeType: 'image/png', data: 'AAAA' }] })
    };
    const res = (await screenshotToolDef()?.execute(
      { viewport: 'desktop' },
      { space: buildSpace(), env: 'main', persisters: {}, spaceId: 1, preview: okPreview, screenshot }
    )) as { content?: Array<{ type: string; data?: string; mimeType?: string }> };
    const image = res.content?.find(c => c.type === 'image');
    expect(image).toMatchObject({ type: 'image', data: 'AAAA', mimeType: 'image/png' });
  });

  it('falls back to the HTML preview with a warning when the browser service fails', async () => {
    const screenshot = {
      capture: () => Promise.resolve({ ok: false as const, error: 'SCREENSHOT_UNREACHABLE', message: 'pod down' })
    };
    const res = (await screenshotToolDef()?.execute(
      {},
      { space: buildSpace(), env: 'main', persisters: {}, spaceId: 1, preview: okPreview, screenshot }
    )) as { warning?: string; html?: string };
    expect(res.warning).toBe('SCREENSHOT_UNAVAILABLE');
    expect(res.html).toContain('<!doctype html>');
  });

  it('falls back to HTML when no browser service is wired', async () => {
    const res = (await screenshotToolDef()?.execute(
      {},
      { space: buildSpace(), env: 'main', persisters: {}, spaceId: 1, preview: okPreview }
    )) as { warning?: string; html?: string };
    expect(res.warning).toBe('SCREENSHOT_DISABLED');
    expect(res.html).toContain('<!doctype html>');
  });
});

describe('mcp-ai style variants + element state', () => {
  it('an element read exposes availableVariants of its attached classes', () => {
    const el = readResource(buildSpace(), 'main', 'plitzi://schema/main/elements/c1')?.data as AIElementDetail;
    expect(el.availableVariants).toEqual({ box: ['lg'] });
  });

  it('patchElement applies a style variant + visibility and the read reflects it', async () => {
    const cap = capturing(buildSpace());
    await apply(
      {
        operations: [
          {
            type: 'patchElement',
            pageRef: 'home',
            ref: 'c1',
            initialState: { styleVariant: { box: { base: 'lg' } }, visibility: false }
          }
        ]
      },
      cap.saved(),
      cap.persisters
    );
    const el = readResource(cap.saved(), 'main', 'plitzi://schema/main/elements/c1')?.data as AIElementDetail;
    expect(el.initialState).toEqual({ styleVariant: { box: { base: 'lg' } }, visibility: false });
  });

  it('warns when an element applies a variant its class does not declare', () => {
    const res = validate(
      {
        operations: [
          {
            type: 'patchElement',
            pageRef: 'home',
            ref: 'c1',
            initialState: { styleVariant: { box: { base: 'ghost' } } }
          }
        ]
      },
      buildSpace()
    );
    expect(res.valid).toBe(true);
    expect(res.warnings.some(w => w.includes('ghost'))).toBe(true);
  });

  it('does not warn for a declared variant, nor for one created in the same batch', () => {
    const res = validate(
      {
        operations: [
          { type: 'patchElement', pageRef: 'home', ref: 'c1', initialState: { styleVariant: { box: { base: 'lg' } } } },
          { type: 'upsertDefinition', ref: 'box', variants: { fresh: { desktop: { color: 'red' } } } },
          {
            type: 'patchElement',
            pageRef: 'home',
            ref: 'c1',
            initialState: { styleVariant: { box: { base: 'fresh' } } }
          }
        ]
      },
      buildSpace()
    );
    expect(res.warnings.some(w => w.includes('lg') || w.includes('fresh'))).toBe(false);
  });
});

describe('mcp-ai data bindings', () => {
  it('upserts, patches and deletes a binding; reads reflect each step', async () => {
    const cap = capturing(buildSpace());
    let res = await apply(
      {
        operations: [
          {
            type: 'upsertBinding',
            pageRef: 'home',
            ref: 'c1',
            category: 'attributes',
            binding: { to: 'items', source: 'apiContainer_x.data' }
          }
        ]
      },
      cap.saved(),
      cap.persisters
    );
    expect(res.summary.created).toBe(1);
    let el = readResource(cap.saved(), 'main', 'plitzi://schema/main/elements/c1')?.data as AIElementDetail;
    expect(el.bindings?.attributes?.[0]).toMatchObject({ to: 'items', source: 'apiContainer_x.data' });

    res = await apply(
      {
        operations: [
          {
            type: 'patchBinding',
            pageRef: 'home',
            ref: 'c1',
            category: 'attributes',
            to: 'items',
            source: 'other.data'
          }
        ]
      },
      cap.saved(),
      cap.persisters
    );
    expect(res.summary.updated).toBe(1);
    el = readResource(cap.saved(), 'main', 'plitzi://schema/main/elements/c1')?.data as AIElementDetail;
    expect(el.bindings?.attributes?.[0].source).toBe('other.data');

    await apply(
      { operations: [{ type: 'deleteBinding', pageRef: 'home', ref: 'c1', category: 'attributes', to: 'items' }] },
      cap.saved(),
      cap.persisters
    );
    el = readResource(cap.saved(), 'main', 'plitzi://schema/main/elements/c1')?.data as AIElementDetail;
    expect(el.bindings).toBeUndefined();
  });

  it('exposes an observed data-sources catalog', async () => {
    const cap = capturing(buildSpace());
    await apply(
      {
        operations: [
          {
            type: 'upsertBinding',
            pageRef: 'home',
            ref: 'c1',
            category: 'attributes',
            binding: { to: 'items', source: 'apiContainer_x.data' }
          }
        ]
      },
      cap.saved(),
      cap.persisters
    );
    const catalog = readResource(cap.saved(), 'main', 'plitzi://data-sources/main')?.data as {
      sources: string[];
      targets: Record<string, string[]>;
    };
    expect(catalog.sources).toContain('apiContainer_x.data');
    expect(catalog.targets.attributes).toContain('items');
  });
});

describe('mcp-ai interactions', () => {
  const flowOp: Operation = {
    type: 'upsertInteractionFlow',
    pageRef: 'home',
    ref: 'c1',
    nodes: [
      { nodeType: 'trigger', action: 'onClick', title: 'Click' },
      { nodeType: 'globalCallback', action: 'login', title: 'Log in', params: { mode: 'token' } }
    ]
  };

  it('creates a flow from ordered steps and reads it back in order', async () => {
    const cap = capturing(buildSpace());
    const res = await apply({ operations: [flowOp] }, cap.saved(), cap.persisters);
    expect(res.summary.created).toBe(1);
    const el = readResource(cap.saved(), 'main', 'plitzi://schema/main/elements/c1')?.data as AIElementDetail;
    const flow = el.interactions?.[0];
    expect(flow?.nodes.map(n => n.action)).toEqual(['onClick', 'login']);
    expect(flow?.flowId).toBe(flow?.nodes[0].id);
  });

  it('patches one node and deletes a single step, re-linking the flow', async () => {
    const cap = capturing(buildSpace());
    const created = await apply({ operations: [flowOp] }, cap.saved(), cap.persisters);
    const el0 = created.elements?.[0] as AIElementDetail;
    const callbackId = el0.interactions?.[0].nodes[1].id ?? '';

    await apply(
      {
        operations: [{ type: 'patchInteractionNode', pageRef: 'home', ref: 'c1', nodeId: callbackId, title: 'Renamed' }]
      },
      cap.saved(),
      cap.persisters
    );
    let el = readResource(cap.saved(), 'main', 'plitzi://schema/main/elements/c1')?.data as AIElementDetail;
    expect(el.interactions?.[0].nodes[1].title).toBe('Renamed');

    await apply(
      { operations: [{ type: 'deleteInteraction', pageRef: 'home', ref: 'c1', nodeId: callbackId }] },
      cap.saved(),
      cap.persisters
    );
    el = readResource(cap.saved(), 'main', 'plitzi://schema/main/elements/c1')?.data as AIElementDetail;
    expect(el.interactions?.[0].nodes.map(n => n.action)).toEqual(['onClick']);
  });

  it('rejects a flow whose first node is not a trigger', () => {
    const res = validate(
      {
        operations: [
          {
            type: 'upsertInteractionFlow',
            pageRef: 'home',
            ref: 'c1',
            nodes: [{ nodeType: 'callback', action: 'login', title: 'Log in' }]
          }
        ]
      },
      buildSpace()
    );
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.message.includes('trigger'))).toBe(true);
  });

  it('rejects deleteInteraction without exactly one of flowId/nodeId', () => {
    const res = validate({ operations: [{ type: 'deleteInteraction', pageRef: 'home', ref: 'c1' }] }, buildSpace());
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.message.includes('exactly one'))).toBe(true);
  });
});

describe('mcp-ai deep validation of when (RuleGroup) and transformers', () => {
  const withWhen = (when: unknown): unknown => ({
    type: 'upsertBinding',
    pageRef: 'home',
    ref: 'c1',
    category: 'attributes',
    binding: { to: 'items', source: 'api.data', when }
  });

  it('accepts a well-formed RuleGroup guard', () => {
    const when = { combinator: 'and', rules: [{ field: 'user.role', operator: '=', value: 'admin' }] };
    expect(operation.safeParse(withWhen(when)).success).toBe(true);
  });

  it('accepts nested groups', () => {
    const when = {
      combinator: 'or',
      rules: [
        { field: 'a', operator: 'notEmpty', value: '' },
        { combinator: 'and', rules: [{ field: 'b', operator: '=', value: 1 }] }
      ]
    };
    expect(operation.safeParse(withWhen(when)).success).toBe(true);
  });

  it('rejects an invalid combinator', () => {
    expect(operation.safeParse(withWhen({ combinator: 'xor', rules: [] })).success).toBe(false);
  });

  it('rejects an invalid operator', () => {
    const when = { combinator: 'and', rules: [{ field: 'a', operator: 'LIKE', value: 'x' }] };
    expect(operation.safeParse(withWhen(when)).success).toBe(false);
  });

  it('rejects a rule missing its field', () => {
    const when = { combinator: 'and', rules: [{ operator: '=', value: 'x' }] };
    expect(operation.safeParse(withWhen(when)).success).toBe(false);
  });

  it('rejects rules that are not an array', () => {
    expect(operation.safeParse(withWhen({ combinator: 'and', rules: {} })).success).toBe(false);
  });

  it('validates the same RuleGroup on an interaction step', () => {
    const flow = (when: unknown): unknown => ({
      type: 'upsertInteractionFlow',
      pageRef: 'home',
      ref: 'c1',
      nodes: [{ nodeType: 'trigger', action: 'onClick', title: 'Click', when }]
    });
    expect(operation.safeParse(flow({ combinator: 'and', rules: [] })).success).toBe(true);
    expect(operation.safeParse(flow({ combinator: 'nope', rules: [] })).success).toBe(false);
  });

  it('rejects a malformed transformer (params must be a string map)', () => {
    const op = {
      type: 'upsertBinding',
      pageRef: 'home',
      ref: 'c1',
      category: 'attributes',
      binding: { to: 'items', source: 'api.data', transformers: [{ action: 'toUpper', params: { x: 5 } }] }
    };
    expect(operation.safeParse(op).success).toBe(false);
  });

  it('rejects a transformer missing its action', () => {
    const op = {
      type: 'upsertBinding',
      pageRef: 'home',
      ref: 'c1',
      category: 'attributes',
      binding: { to: 'items', source: 'api.data', transformers: [{ params: {} }] }
    };
    expect(operation.safeParse(op).success).toBe(false);
  });
});
