import { describe, expect, it } from 'vitest';

import { buildSpace, capturing } from './helpers';
import { readResource } from '../resources';
import { createMcpServer } from '../server';
import { apply, operation } from '../tools';

import type { Operation } from '../tools';
import type { AIPageSkeleton } from '../types';
import type { SSRAdapters } from '@plitzi/sdk-shared';

describe('mcp-ai apply (writes + dryRun + diff + full elements + OCC)', () => {
  const ops: Operation[] = [
    { type: 'upsertDefinition', ref: 'btn-hero', desktop: { 'background-color': '#3b82f6' } },
    {
      type: 'upsertElement',
      pageRef: 'home',
      element: { ref: 'hero-cta', type: 'button', props: { content: 'Go' }, style: { base: ['btn-hero'] } }
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
    expect(page.tree.map(n => n.ref)).not.toContain('hero-cta');
  });

  it('apply persists each changed schema and reports changed versions', async () => {
    const cap = capturing(buildSpace());
    const res = await apply({ operations: ops }, buildSpace(), cap.persisters);
    expect(res.applied).toBe(true);
    expect(res.persisted).toBe(true);
    expect(res.changed.some(c => c.uri.includes('definitions'))).toBe(true);
    const page = readResource(cap.saved(), 'main', 'plitzi://schema/main/pages/home')?.data as AIPageSkeleton;
    expect(page.tree.map(n => n.ref)).toContain('hero-cta');
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
    const cta = res.elements?.find(e => e.ref === 'hero-cta');
    expect(cta).toMatchObject({ ref: 'hero-cta', type: 'button', pageRef: 'home', props: { content: 'Go' } });
    expect(cta?.style.base).toEqual(['btn-hero']);
  });

  it('dryRun returns the same full element detail without persisting', async () => {
    const res = await apply({ operations: ops, dryRun: true }, buildSpace());
    expect(res.dryRun).toBe(true);
    expect(res.elements?.map(e => e.ref)).toContain('hero-cta');
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
              ref: 'cats-hero',
              type: 'container',
              style: { base: ['hero'] },
              children: [{ ref: 'cats-title', type: 'text', props: { content: 'Cats' } }]
            }
          }
        ]
      },
      buildSpace(),
      cap.persisters
    );
    expect(res.applied).toBe(true);
    const page = readResource(cap.saved(), 'main', 'plitzi://schema/main/pages/cats')?.data as AIPageSkeleton;
    expect(page.tree.map(n => n.ref)).toContain('cats-hero');
    expect(page.tree[0].children?.[0].ref).toBe('cats-title');
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
  it('resolves a page and element by their raw ids even when an idRef is present', async () => {
    const space = buildSpace();
    space.schema.flat.c1.idRef = 'my-box';

    const cap = capturing(space);
    await apply({ operations: [{ type: 'deleteElement', pageRef: 'page1', ref: 'c1' }] }, space, cap.persisters);

    const page = readResource(cap.saved(), 'main', 'plitzi://schema/main/pages/home')?.data as AIPageSkeleton;
    expect(page.tree).toHaveLength(0);
  });
});
