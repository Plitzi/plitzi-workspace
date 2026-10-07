import { z } from 'zod';

import { closest } from '@plitzi/sdk-authoring';

import { apply } from './apply';
import { findElementByRef } from '../helpers';
import { scalar } from './operations/schema/shared';
import { defineTool } from './shared/tool';

import type { Operation } from './operations';
import type { ToolContext } from './shared/tool';
import type { Element } from '@plitzi/sdk-shared';

/**
 * Tools that take an intention — set an element's attributes, add or remove its classes, bind an attribute, place a
 * component, add a page
 * — instead of a batch: a few parameters, the element named by its ref alone (the page it is on is found), and the
 * operations written for the agent. Each runs through `plitzi_apply`, so it is checked and saved exactly as a batch
 * is, and answers with what it did — the batch's `effects`, read off the space, never a restatement of what was asked —
 * whether it was saved, what was already so, and what to do next. For anything they do not say, `plitzi_apply`.
 */

/** What an intention answers: done, or why not — never the whole element back. */
type IntentAnswer =
  | { done: true; saved: boolean; effects: string[]; warnings?: string[]; next: string }
  | { done: false; errors: unknown[]; warnings?: string[] };

type Refusal = { done: false; errors: unknown[] };

/** The element a ref names, with the page or layout it is on — or the nearest ref there is. */
const locate = (ctx: ToolContext, ref: string): { element: Element; root: string; classes: string[] } | Refusal => {
  const element = findElementByRef(ctx.space.schema, ref);
  if (element) {
    return {
      element,
      root: element.definition.rootId,
      classes: element.definition.styleSelectors.base.split(/\s+/).filter(Boolean)
    };
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

/** The attributes of an element a binding computes, with the source each reads. */
const boundOf = (element: Element): Map<string, string> =>
  new Map(
    (element.definition.bindings?.attributes ?? []).map((binding): [string, string] => [binding.to, binding.source])
  );

/**
 * The batch applied, answered with what it did. `notes` are what the agent believed that was already so — a class it
 * wears, an attribute it did not have — said beside the effects, never dropped because nothing came of them.
 */
const run = async (
  ctx: ToolContext,
  operations: Operation[],
  page: string,
  notes: string[] = []
): Promise<IntentAnswer> => {
  const result = await apply({ operations, environment: ctx.env }, ctx.space, ctx.persisters);
  const warnings = [...notes, ...(result.warnings ?? [])];
  if (!result.applied) {
    return {
      done: false,
      errors: result.errors ?? (result.conflict ? [result.conflict] : []),
      ...(warnings.length > 0 ? { warnings } : {})
    };
  }

  return {
    done: true,
    saved: result.persisted !== false,
    effects: result.effects ?? [],
    ...(warnings.length > 0 ? { warnings } : {}),
    next: `plitzi_look { pageRef: "${page}" } to see it`
  };
};

export const setAttributesTool = defineTool({
  name: 'plitzi_set_attributes',
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

    const set = input.set ?? {};
    const unset = input.unset ?? [];
    // A bound attribute shows what its binding computes: a value written under it would change nothing on the page,
    // and the agent would believe it had.
    const bound = boundOf(at.element);
    const covered = [...Object.keys(set), ...unset].filter(key => bound.has(key));
    if (covered.length > 0) {
      return {
        done: false,
        errors: covered.map(key => ({
          path: key,
          message: `${key} of ${input.ref} is bound to ${String(bound.get(key))}: the page shows what the binding computes, not a value written here`,
          hint: 'plitzi_bind_attribute changes what it reads; to write a value instead, plitzi_apply deleteBinding first'
        }))
      };
    }

    const { attributes } = at.element;
    const notes = [
      ...Object.entries(set)
        .filter(([key, value]) => attributes[key] === value)
        .map(([key, value]) => `${key} was already ${JSON.stringify(value)}`),
      ...unset.filter(key => !(key in attributes)).map(key => `${key} was not set`)
    ];
    const props = { ...set, ...Object.fromEntries(unset.map(key => [key, null])) };

    return run(ctx, [{ type: 'patchElement', pageRef: at.root, ref: input.ref, props }], at.root, notes);
  }
});

export const setClassesTool = defineTool({
  name: 'plitzi_set_classes',
  title: 'Add or remove an element’s classes',
  description:
    'Add classes to one element, or take them off; the ones it wears and you do not name stay. A class is a ' +
    'definition of the space (plitzi://definitions/{env}).',
  inputShape: {
    ref: z.string().describe('The element, by its ref'),
    add: z.array(z.string()).optional().describe('Classes it should also wear, by name'),
    remove: z.array(z.string()).optional().describe('Classes it should no longer wear, by name')
  },
  access: 'write',
  run: async (input, ctx) => {
    const at = locate(ctx, input.ref);
    if ('done' in at) {
      return at;
    }

    // A class it does not wear cannot be taken off: the agent's picture of the element is wrong, and going on would
    // build on it.
    const absent = (input.remove ?? []).filter(name => !at.classes.includes(name));
    if (absent.length > 0) {
      return {
        done: false,
        errors: absent.map(name => {
          const nearest = closest(name, at.classes);

          return {
            path: 'remove',
            message: `${input.ref} does not wear "${name}"${nearest ? ` — did you mean "${nearest}"?` : ''}; it wears ${at.classes.join(', ') || 'no class'}`
          };
        })
      };
    }

    const notes = (input.add ?? [])
      .filter(name => at.classes.includes(name))
      .map(name => `${input.ref} already wore ${name}`);
    const removed = new Set(input.remove ?? []);
    const base = [
      ...at.classes.filter(name => !removed.has(name)),
      ...(input.add ?? []).filter(name => !at.classes.includes(name))
    ];

    return run(ctx, [{ type: 'patchElement', pageRef: at.root, ref: input.ref, style: { base } }], at.root, notes);
  }
});

export const bindAttributeTool = defineTool({
  name: 'plitzi_bind_attribute',
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

    const was = boundOf(at.element).get(input.to);

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
      at.root,
      was === undefined ? [] : [`${input.ref}.${input.to} was bound to ${was}: replaced`]
    );
  }
});

export const placeComponentTool = defineTool({
  name: 'plitzi_place_component',
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
      input.ref
    )
});
