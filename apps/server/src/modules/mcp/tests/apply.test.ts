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

  it('builds an MCP server (registers tools + resources) without throwing', async () => {
    const s = buildSpace();
    const adapters = {
      getSchema: () => Promise.resolve(s.schema),
      getStyle: () => Promise.resolve(s.style)
    } as unknown as SSRAdapters;

    await expect(createMcpServer({ adapters, getSpaceId: () => Promise.resolve(1) })).resolves.toBeDefined();
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

// repeatElement: one template + its rows, instead of N near-identical subtrees. It is sugar — the batch is rewritten
// into the upsertElement it stands for BEFORE validation — so these tests pin the two things that makes it usable:
// the refs a row gets (predictable, so a later op can address them) and what happens to a row missing a field.
describe('mcp-ai repeatElement (list from a template + rows)', () => {
  const repeat: Operation = {
    type: 'repeatElement',
    pageRef: 'home',
    ref: 'steps',
    template: {
      ref: 'step',
      type: 'container',
      children: [{ ref: 'label', type: 'text', props: { content: '{{item.title}}' } }]
    },
    items: [{ title: 'First' }, { title: 'Second' }]
  };

  it('creates the wrapper and one filled subtree per row, numbering every ref', async () => {
    const cap = capturing(buildSpace());
    const res = await apply({ operations: [repeat] }, buildSpace(), cap.persisters);

    expect(res.applied).toBe(true);
    const refs = Object.values(cap.saved().schema.flat).map(el => el.idRef);
    expect(refs).toContain('steps');
    expect(refs).toEqual(expect.arrayContaining(['step-1', 'label-1', 'step-2', 'label-2']));
    const contents = Object.values(cap.saved().schema.flat).map(el => el.attributes.content);
    expect(contents).toEqual(expect.arrayContaining(['First', 'Second']));
  });

  it('keeps a placeholder that is the whole value typed, and leaves schema vars alone', async () => {
    const cap = capturing(buildSpace());
    const res = await apply(
      {
        operations: [
          {
            type: 'repeatElement',
            pageRef: 'home',
            ref: 'cards',
            template: {
              ref: 'card',
              type: 'container',
              props: { count: '{{item.count}}', url: '{{apiUrl}}/x', label: 'Nº {{item.count}}' }
            },
            items: [{ count: 3 }]
          }
        ]
      },
      buildSpace(),
      cap.persisters
    );

    expect(res.applied).toBe(true);
    const card = Object.values(cap.saved().schema.flat).find(el => el.idRef === 'card-1');
    expect(card?.attributes.count).toBe(3);
    expect(card?.attributes.url).toBe('{{apiUrl}}/x');
    expect(card?.attributes.label).toBe('Nº 3');
  });

  it('refuses a row that lacks a field the template reads, naming the row and what it carries', async () => {
    const cap = capturing(buildSpace());
    const res = await apply(
      { operations: [{ ...repeat, items: [{ title: 'First' }, { other: 'x' }] }] },
      buildSpace(),
      cap.persisters
    );

    expect(res.applied).toBe(false);
    expect(res.errors?.[0]?.path).toBe('operations[0].items[1]');
    expect(res.errors?.[0]?.message).toContain('"title"');
    expect(res.errors?.[0]?.hint).toContain('other');
  });

  it('nests a list inside each row, numbering both levels', async () => {
    const cap = capturing(buildSpace());
    const res = await apply(
      {
        operations: [
          {
            type: 'repeatElement',
            pageRef: 'home',
            ref: 'timeline',
            template: {
              ref: 'day',
              type: 'container',
              children: [
                { ref: 'title', type: 'text', props: { content: '{{item.park}}' } },
                {
                  ref: 'body',
                  type: 'container',
                  repeat: {
                    items: '{{item.blocks}}',
                    template: { ref: 'blk', type: 'text', props: { content: '{{item.text}}' } }
                  }
                }
              ]
            },
            items: [
              { park: 'Magic Kingdom', blocks: [{ text: 'Rope drop' }, { text: 'Space Mountain' }] },
              { park: 'EPCOT', blocks: [{ text: 'Cosmic Rewind' }] }
            ]
          }
        ]
      },
      buildSpace(),
      cap.persisters
    );

    expect(res.applied).toBe(true);
    const refs = Object.values(cap.saved().schema.flat).map(el => el.idRef);
    // Outer row first, sub-row second: blk-1-2 is the second block of the first day.
    expect(refs).toEqual(expect.arrayContaining(['day-1', 'blk-1-1', 'blk-1-2', 'day-2', 'blk-2-1']));
    expect(refs).not.toContain('blk-2-2');
    const contents = Object.values(cap.saved().schema.flat).map(el => el.attributes.content);
    expect(contents).toEqual(expect.arrayContaining(['Magic Kingdom', 'Space Mountain', 'Cosmic Rewind']));
  });

  it('refuses a nested repeat whose field is not a list', async () => {
    const cap = capturing(buildSpace());
    const res = await apply(
      {
        operations: [
          {
            type: 'repeatElement',
            pageRef: 'home',
            ref: 'timeline',
            template: {
              ref: 'day',
              type: 'container',
              repeat: { items: '{{item.blocks}}', template: { ref: 'blk', type: 'text' } }
            },
            items: [{ blocks: 'nope' }]
          }
        ]
      },
      buildSpace(),
      cap.persisters
    );

    expect(res.applied).toBe(false);
    expect(res.errors?.[0]?.path).toBe('operations[0].items[0]');
    expect(res.errors?.[0]?.message).toContain('no list at');
  });

  it('reports a bad element inside the template with the ordinary element errors', async () => {
    const cap = capturing(buildSpace());
    const res = await apply(
      {
        operations: [
          { ...repeat, template: { ref: 'bad.ref', type: 'container', props: { content: '{{item.title}}' } } }
        ]
      },
      buildSpace(),
      cap.persisters
    );

    expect(res.applied).toBe(false);
    expect(JSON.stringify(res.errors)).toContain('bad.ref');
  });
});

// The rest of what a real repeat runs into: where it hangs the wrapper, the shapes a placeholder can take, whether
// a generated row is addressable afterwards, and the two ways a batch of rows can be wrong.
describe('mcp-ai repeatElement edge cases', () => {
  const rows = (op: Partial<Operation> = {}): Operation =>
    ({
      type: 'repeatElement',
      pageRef: 'home',
      ref: 'list',
      template: { ref: 'row', type: 'text', props: { content: '{{item.text}}' } },
      items: [{ text: 'a' }, { text: 'b' }],
      ...op
    }) as Operation;

  it('hangs the wrapper where parentRef says, with the type, label and classes given', async () => {
    const cap = capturing(buildSpace());
    const res = await apply(
      {
        operations: [rows({ parentRef: 'c1', elementType: 'container', label: 'Steps', style: { base: ['box'] } })]
      },
      buildSpace(),
      cap.persisters
    );

    expect(res.applied).toBe(true);
    const wrapper = Object.values(cap.saved().schema.flat).find(el => el.idRef === 'list');
    expect(wrapper?.definition.parentId).toBe('c1');
    expect(wrapper?.definition.type).toBe('container');
    expect(wrapper?.definition.label).toBe('Steps');
    expect(wrapper?.definition.styleSelectors.base).toBe('box');
  });

  it('reads dotted paths and fills a placeholder used as a style class', async () => {
    const cap = capturing(buildSpace());
    const res = await apply(
      {
        operations: [
          {
            type: 'upsertDefinitions',
            definitions: { 'tone-warm': { desktop: { color: 'orange' } }, 'tone-cold': { desktop: { color: 'blue' } } }
          },
          rows({
            template: {
              ref: 'row',
              type: 'text',
              style: { base: ['{{item.tone}}'] },
              props: { content: '{{item.author.name}}' }
            },
            items: [
              { tone: 'tone-warm', author: { name: 'Ada' } },
              { tone: 'tone-cold', author: { name: 'Alan' } }
            ]
          })
        ]
      },
      buildSpace(),
      cap.persisters
    );

    expect(res.applied).toBe(true);
    const first = Object.values(cap.saved().schema.flat).find(el => el.idRef === 'row-1');
    const second = Object.values(cap.saved().schema.flat).find(el => el.idRef === 'row-2');
    expect(first?.attributes.content).toBe('Ada');
    expect(first?.definition.styleSelectors.base).toBe('tone-warm');
    expect(second?.definition.styleSelectors.base).toBe('tone-cold');
  });

  it('leaves a generated row addressable by a later op in the same batch', async () => {
    const cap = capturing(buildSpace());
    const res = await apply(
      {
        operations: [rows(), { type: 'patchElement', pageRef: 'home', ref: 'row-2', props: { content: 'patched' } }]
      },
      buildSpace(),
      cap.persisters
    );

    expect(res.applied).toBe(true);
    const row2 = Object.values(cap.saved().schema.flat).find(el => el.idRef === 'row-2');
    expect(row2?.attributes.content).toBe('patched');
  });

  it('turns a sub-list of plain strings into rows read as {{item.value}}', async () => {
    const cap = capturing(buildSpace());
    const res = await apply(
      {
        operations: [
          rows({
            template: {
              ref: 'day',
              type: 'container',
              repeat: {
                items: '{{item.tags}}',
                template: { ref: 'tag', type: 'text', props: { content: '{{item.value}}' } }
              }
            },
            items: [{ tags: ['one', 'two'] }]
          })
        ]
      },
      buildSpace(),
      cap.persisters
    );

    expect(res.applied).toBe(true);
    const contents = Object.values(cap.saved().schema.flat).map(el => el.attributes.content);
    expect(contents).toEqual(expect.arrayContaining(['one', 'two']));
  });

  it('refuses two repeats that would generate the same ref', async () => {
    const cap = capturing(buildSpace());
    const res = await apply({ operations: [rows(), rows({ ref: 'other' })] }, buildSpace(), cap.persisters);

    expect(res.applied).toBe(false);
    expect(JSON.stringify(res.errors)).toContain('row-1');
  });

  it('refuses an expansion bigger than the row cap, instead of building 600 elements', async () => {
    const cap = capturing(buildSpace());
    const res = await apply(
      {
        operations: [
          rows({
            template: {
              ref: 'day',
              type: 'container',
              repeat: { items: '{{item.blocks}}', template: { ref: 'blk', type: 'text' } }
            },
            items: Array.from({ length: 60 }, () => ({ blocks: Array.from({ length: 10 }, () => ({})) }))
          })
        ]
      },
      buildSpace(),
      cap.persisters
    );

    expect(res.applied).toBe(false);
    expect(res.errors?.[0]?.path).toBe('operations[0].items');
    expect(res.errors?.[0]?.message).toContain('max 500');
  });

  it('rejects a repeat with no rows at parse time', () => {
    expect(operation.safeParse({ ...rows(), items: [] }).success).toBe(false);
  });
});
