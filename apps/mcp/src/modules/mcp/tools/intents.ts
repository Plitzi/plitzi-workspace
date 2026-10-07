import { z } from 'zod';

import { closest } from '@plitzi/sdk-authoring';

import { apply } from './apply';
import { findElementByRef } from '../helpers';
import { scalar } from './operations/schema/shared';
import { defineTool } from './shared/tool';

import type { Operation } from './operations';
import type { ToolContext } from './shared/tool';

/**
 * Tools that take an intention — set an element's words, dress it with classes, bind it, place a component, add a page
 * — instead of a batch: a few parameters, the element named by its ref alone (the page it is on is found), and the
 * operations written for the agent. Each runs through `plitzi_apply`, so it is checked and saved exactly as a batch
 * is, and answers in a line: what changed, and what to do next. For anything they do not say, `plitzi_apply`.
 */

/** What an intention answers: done, or why not — never the whole element back. */
type IntentAnswer = { done: string; warnings?: string[]; next: string } | { done: false; errors: unknown[] };

/** The element a ref names, with the page or layout it is on — or the nearest ref there is. */
const locate = (ctx: ToolContext, ref: string): { root: string } | { done: false; errors: unknown[] } => {
  const element = findElementByRef(ctx.space.schema, ref);
  if (element) {
    return { root: element.definition.rootId };
  }

  const nearest = closest(ref, Object.keys(ctx.space.schema.flat));

  return {
    done: false,
    errors: [
      {
        path: 'ref',
        message: `There is no element "${ref}"${nearest ? ` — did you mean "${nearest}"?` : ''}`,
        hint: 'plitzi_search finds an element by its words, type or class'
      }
    ]
  };
};

const run = async (ctx: ToolContext, operations: Operation[], done: string, page: string): Promise<IntentAnswer> => {
  const result = await apply({ operations, environment: ctx.env }, ctx.space, ctx.persisters);
  if (!result.applied) {
    return { done: false, errors: result.errors ?? (result.conflict ? [result.conflict] : []) };
  }

  return {
    done,
    ...(result.warnings ? { warnings: result.warnings } : {}),
    next: `plitzi_screenshot { pageRef: "${page}" } to see it — or plitzi_search / plitzi_read for what to change next`
  };
};

export const setTool = defineTool({
  name: 'plitzi_set',
  title: 'Set an element’s attributes',
  description:
    'Set or remove attributes of one element — its words (`content`), a link’s `href`, an image’s `src` and `alt`, a ' +
    'field’s `label`… — by its ref. plitzi://explain/{type} lists what a type takes.',
  inputShape: {
    ref: z.string().describe('The element, by its ref'),
    set: z.record(z.string(), scalar).optional().describe('Attributes to write: { "content": "Start free" }'),
    unset: z.array(z.string()).optional().describe('Attributes to remove')
  },
  access: 'write',
  run: async (input, ctx) => {
    const at = locate(ctx, input.ref);
    if ('done' in at) {
      return at;
    }

    const props = { ...input.set, ...Object.fromEntries((input.unset ?? []).map(key => [key, null])) };
    const keys = Object.keys(props);

    return run(
      ctx,
      [{ type: 'patchElement', pageRef: at.root, ref: input.ref, props }],
      `${keys.join(', ')} of ${input.ref} written`,
      at.root
    );
  }
});

export const classTool = defineTool({
  name: 'plitzi_class',
  title: 'Dress an element with classes',
  description:
    'The classes one element wears, in order — the whole list, replacing the one it had. A class is a definition ' +
    'of the space (plitzi_search finds them).',
  inputShape: {
    ref: z.string().describe('The element, by its ref'),
    classes: z.array(z.string()).describe('Every class it wears, by name')
  },
  access: 'write',
  run: async (input, ctx) => {
    const at = locate(ctx, input.ref);
    if ('done' in at) {
      return at;
    }

    return run(
      ctx,
      [{ type: 'patchElement', pageRef: at.root, ref: input.ref, style: { base: input.classes } }],
      `${input.ref} wears ${input.classes.join(', ') || 'no class'}`,
      at.root
    );
  }
});

export const bindTool = defineTool({
  name: 'plitzi_bind',
  title: 'Bind an element to data',
  description:
    'Feed one attribute of an element from a data source — a list’s `items` from `apiContainer_products.data`, a ' +
    'heading’s `content` from a field. Sources: plitzi://data-sources/{env}.',
  inputShape: {
    ref: z.string().describe('The element, by its ref'),
    to: z.string().describe('The attribute it feeds: "items", "content"…'),
    source: z.string().describe('The source path, spelled in full: "apiContainer_products.data"')
  },
  access: 'write',
  run: async (input, ctx) => {
    const at = locate(ctx, input.ref);
    if ('done' in at) {
      return at;
    }

    return run(
      ctx,
      [
        {
          type: 'upsertBinding',
          pageRef: at.root,
          ref: input.ref,
          category: 'attributes',
          binding: { to: input.to, source: input.source }
        }
      ],
      `${input.ref}.${input.to} reads ${input.source}`,
      at.root
    );
  }
});

export const placeTool = defineTool({
  name: 'plitzi_place',
  title: 'Place a component',
  description:
    'Place an instance of one of the space’s components inside an element, handing it its props. ' +
    'plitzi://schema/{env}/components lists them and what each takes.',
  inputShape: {
    component: z.string().describe('The component, by its ref'),
    ref: z.string().describe('A ref for the new instance'),
    into: z.string().describe('The element it goes inside, by its ref'),
    props: z.record(z.string(), scalar).optional().describe('What it hands the component: { "title": "Lamp" }')
  },
  access: 'write',
  run: async (input, ctx) => {
    const at = locate(ctx, input.into);
    if ('done' in at) {
      return at;
    }

    return run(
      ctx,
      [
        {
          type: 'upsertElement',
          pageRef: at.root,
          parentRef: input.into,
          element: {
            ref: input.ref,
            type: 'reference',
            props: { referenceType: 'component', referenceId: input.component, ...input.props }
          }
        }
      ],
      `${input.ref} (${input.component}) placed in ${input.into}`,
      at.root
    );
  }
});

export const addPageTool = defineTool({
  name: 'plitzi_add_page',
  title: 'Add a page',
  description: 'A new page at a slug, inside a layout when the space has one for it (plitzi://schema/{env}/pages).',
  inputShape: {
    ref: z.string().describe('Its ref: "pricing"'),
    slug: z.string().describe('Its path, relative and without a leading slash: "pricing", "posts/:postId"'),
    label: z.string().optional().describe('Its name in the builder'),
    layout: z.string().optional().describe('The layout it renders inside, by its ref')
  },
  access: 'write',
  run: async (input, ctx) =>
    run(
      ctx,
      [
        {
          type: 'upsertPage',
          ref: input.ref,
          slug: input.slug,
          ...(input.label ? { label: input.label } : {}),
          ...(input.layout ? { layout: input.layout } : {})
        }
      ],
      `page ${input.ref} added at /${input.slug}`,
      input.ref
    )
});
