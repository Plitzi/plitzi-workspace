import { describe, expect, it } from 'vitest';

import { buildTypeRegistry, readResource } from './resources';
import { createMcpServer } from './server';
import { apply, operation, preview, search, validate } from './tools';

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

describe('mcp-ai apply/preview (writes + lean diff + OCC)', () => {
  const ops: Operation[] = [
    { type: 'upsertDefinition', ref: 'btn-hero', desktop: { 'background-color': '#3b82f6' } },
    {
      type: 'upsertElement',
      pageRef: 'home',
      element: { ref: 'hero.cta', type: 'button', props: { content: 'Go' }, style: { base: ['btn-hero'] } }
    }
  ];

  it('preview reports the changed resources without persisting', () => {
    const res = preview({ operations: ops }, buildSpace());
    expect(res.applied).toBe(false);
    expect(res.summary.created + res.summary.updated).toBe(2);
    expect(res.changed.map(c => c.uri)).toContain('plitzi://schema/main/pages/home');
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
    expect(() => createMcpServer({ adapters, spaceId: 1 })).not.toThrow();
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
    const res = search({ query: 'box' }, buildSpace());
    expect(res.results.some(r => r.ref === 'c1' && r.pageRef === 'home')).toBe(true);
  });
});
