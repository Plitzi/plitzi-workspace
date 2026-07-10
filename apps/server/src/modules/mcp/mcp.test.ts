import { describe, expect, it } from 'vitest';

import { buildTypeRegistry, readResource, resourceErrorMessage } from './resources';
import { createMcpServer } from './server';
import { apply, operation, search, validate } from './tools';

import type { Space } from './helpers';
import type { Operation, Persisters } from './tools';
import type { AIDefinition, AIElementDetail, AIPageSkeleton, AIPageSummary, AIStyleVariable } from './types';
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

  it('lists pages as cheap summaries without element trees', () => {
    const res = readResource(buildSpace(), 'main', 'plitzi://schema/main/pages');
    const pages = res?.data as AIPageSummary[];
    expect(res?.stateVersion).toMatch(/^[a-f0-9]{12}$/);
    expect(pages[0]).toMatchObject({ ref: 'home', label: 'Home', default: true, elementCount: 1 });
    expect(pages[0]).not.toHaveProperty('tree');
  });

  it('reads one page as a skeleton tree (no props/style)', () => {
    const res = readResource(buildSpace(), 'main', 'plitzi://schema/main/pages/home');
    const page = res?.data as AIPageSkeleton;
    expect(page.tree[0]).toEqual({ ref: 'c1', type: 'container', label: 'Container', subType: 'div', childCount: 0 });
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
