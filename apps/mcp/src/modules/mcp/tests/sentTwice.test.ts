import { describe, expect, it } from 'vitest';

import { strapiConnector } from './connectorFixture';
import { buildSpace, capturing } from './helpers';
import { apply, NOTHING_CHANGED } from '../tools/apply';
import {
  addPageTool,
  bindAttributeTool,
  placeComponentTool,
  setAttributesTool,
  setClassesTool
} from '../tools/intents';

import type { Space } from '../helpers';
import type { Operation } from '../tools/operations';
import type { ToolContext } from '../tools/shared/tool';

/**
 * A write sent again — a client that timed out and retried, an agent that lost the answer — arrives after the first was
 * saved, and reads the space as the first left it. It must leave the space as one call did and write nothing more:
 * every write a persister takes is a change in the space's history, and a second, identical entry there is an edit
 * nobody made.
 */

/** The space a call reads, and how many times it was written: a write is what the history records. */
const store = (space: Space = buildSpace()) => {
  const cap = capturing(space);
  const writes = { count: 0 };
  const persisters = {
    ...cap.persisters,
    schema: async (schema: Space['schema']) => {
      writes.count++;
      await cap.persisters.schema?.(schema);
    },
    style: async (style: Space['style']) => {
      writes.count++;
      await cap.persisters.style?.(style);
    }
  };
  // Each call reads the space as the store holds it then, as a request on the server does.
  const ctx = (): ToolContext => ({ space: structuredClone(cap.saved()), env: 'main', persisters, spaceId: 1 });

  return { ctx, saved: cap.saved, writes };
};

/** A tool's answer, read for what a retry is told. */
type Answer = { done?: boolean; warnings?: string[]; effects?: string[] };

const twice = async (call: (ctx: ToolContext) => unknown, space?: Space) => {
  const at = store(space);
  const first = (await call(at.ctx())) as Answer;
  const afterFirst = structuredClone(at.saved());
  const writesFirst = at.writes.count;
  const second = (await call(at.ctx())) as Answer;

  return { first, second, afterFirst, after: at.saved(), writesFirst, writesSecond: at.writes.count - writesFirst };
};

/** The test space with the operations applied first: what a write sent twice is sent to. */
const prepared = async (operations: Operation[]): Promise<Space> => {
  const at = store();
  const ctx = at.ctx();
  const res = await apply({ operations }, ctx.space, ctx.persisters);
  expect(res.applied, JSON.stringify(res.errors)).toBe(true);

  return at.saved();
};

describe('a write sent twice', () => {
  it.each([
    [
      'plitzi_set_attributes',
      (ctx: ToolContext) => setAttributesTool.execute({ ref: 'c1', set: { subType: 'article' } }, ctx)
    ],
    [
      'plitzi_bind_attribute',
      (ctx: ToolContext) => bindAttributeTool.execute({ ref: 'c1', to: 'subType', source: 'state.tag' }, ctx)
    ],
    ['plitzi_add_page', (ctx: ToolContext) => addPageTool.execute({ ref: 'pricing', slug: 'pricing' }, ctx)]
  ])('%s: the second leaves the space as the first did, writes nothing, and says so', async (_name, call) => {
    const { first, second, afterFirst, after, writesFirst, writesSecond } = await twice(call);

    expect(first.done).toBe(true);
    expect(writesFirst).toBeGreaterThan(0);
    expect(after).toEqual(afterFirst);
    expect(writesSecond).toBe(0);
    expect(second).toMatchObject({ done: true, effects: [] });
    expect(second.warnings).toContain(NOTHING_CHANGED);
  });

  it('plitzi_set_classes: the class worn once, the second told it already is', async () => {
    const wear = (ctx: ToolContext) => setClassesTool.execute({ ref: 'c1', add: ['card'] }, ctx);
    const { first, second, afterFirst, after, writesSecond } = await twice(
      wear,
      await prepared([{ type: 'upsertDefinition', ref: 'card', desktop: { padding: '8px' } }])
    );

    expect(first.done).toBe(true);
    expect(after).toEqual(afterFirst);
    expect(after.schema.flat.c1.definition.styleSelectors.base).toBe('box card');
    expect(writesSecond).toBe(0);
    expect(second.warnings).toEqual(['c1 already wore card', NOTHING_CHANGED]);
  });

  it('plitzi_place_component: one instance, however many times it is placed', async () => {
    const place = (ctx: ToolContext) =>
      placeComponentTool.execute({ component: 'card', ref: 'lamp', into: 'c1', props: {} }, ctx);
    const { first, second, afterFirst, after, writesSecond } = await twice(
      place,
      await prepared([{ type: 'upsertComponent', ref: 'card', label: 'Card', props: {} }])
    );

    expect(first.done).toBe(true);
    expect(after).toEqual(afterFirst);
    expect(writesSecond).toBe(0);
    expect(second.warnings).toContain(NOTHING_CHANGED);
  });

  const batches: [string, Operation[]][] = [
    [
      'a class and an element',
      [
        { type: 'upsertDefinition', ref: 'btn-hero', desktop: { 'background-color': '#3b82f6' } },
        {
          type: 'upsertElement',
          pageRef: 'home',
          element: { ref: 'hero-cta', type: 'button', props: { content: 'Go' }, style: { base: ['btn-hero'] } }
        }
      ]
    ],
    [
      'rows repeated from a template',
      [
        {
          type: 'repeatElement',
          pageRef: 'home',
          ref: 'features',
          template: { ref: 'feature', type: 'text', props: { content: '{{item.title}}' } },
          items: [{ title: 'Fast' }, { title: 'Kind' }]
        }
      ]
    ],
    [
      'an element moved',
      [{ type: 'moveElement', pageRef: 'home', ref: 'c1', toParentRef: 'home', position: 'inside' }]
    ],
    // A row of its own store: only the rows a batch left different are written.
    ['a connector', [strapiConnector]]
  ];

  it.each(batches)(
    'plitzi_apply, %s: the second leaves the space as the first did and writes nothing',
    async (_name, operations) => {
      const { first, second, afterFirst, after, writesSecond } = await twice(ctx =>
        apply({ operations }, ctx.space, ctx.persisters)
      );

      expect((first as { applied?: boolean }).applied, JSON.stringify(first)).toBe(true);
      expect(after).toEqual(afterFirst);
      expect(writesSecond).toBe(0);
      expect(second.warnings).toContain(NOTHING_CHANGED);
    }
  );

  // Nothing left to delete: the second is refused for naming what is not there, and writes nothing. A refusal and not a
  // silent no-op, so a mistyped ref is never taken for done.
  it('plitzi_apply, an element deleted: the second is refused, the first change the only one', async () => {
    const remove = (ctx: ToolContext) =>
      apply({ operations: [{ type: 'deleteElement', pageRef: 'home', ref: 'c1' }] }, ctx.space, ctx.persisters);
    const { first, second, afterFirst, after, writesSecond } = await twice(remove);

    expect((first as { applied?: boolean }).applied).toBe(true);
    expect(after).toEqual(afterFirst);
    expect(writesSecond).toBe(0);
    expect(second).toMatchObject({ applied: false });
  });
});
