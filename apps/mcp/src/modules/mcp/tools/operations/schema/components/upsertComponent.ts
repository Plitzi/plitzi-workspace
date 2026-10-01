import { z } from 'zod';

import {
  addComponent,
  componentNamed,
  propNameProblem,
  treeOf,
  updateComponent
} from '@plitzi/sdk-schema/helpers/components';
import { isValidElementId } from '@plitzi/sdk-schema/helpers/elementId';
import { descendants } from '@plitzi/sdk-schema/helpers/elementTree';

import { componentsUri, empty, fail, invalidateIndex, pageUri } from '../../../../helpers';
import { ID_REF_HINT, guardNewRef } from '../write';

import type { OpResult, Space } from '../../../../helpers';
import type { Env } from '../../../../types';
import type { SpaceComponent, SpaceComponentDeclaration } from '@plitzi/sdk-shared';

/**
 * A prop as a component declares it. Checked when the op runs rather than spelled out in the op's schema: the op union
 * rides on every request of every conversation, and the guide — read once — says what a prop is.
 */
const componentProp = z.object({
  type: z.enum(['text', 'textarea', 'number', 'boolean', 'select', 'scalar', 'json']),
  description: z.string(),
  required: z.boolean().optional(),
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
  options: z.array(z.string()).optional(),
  label: z.string().optional()
});

export const upsertComponentOp = z
  .object({
    type: z.literal('upsertComponent'),
    ref: z.string(),
    label: z.string().optional(),
    props: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('{ name: { type, description, required?, default?, options? } }'),
    slots: z.array(z.string()).optional(),
    fromRef: z.string().optional().describe('New only: the element it is made of'),
    instanceRef: z.string().optional().describe('With fromRef: the instance left in its place')
  })
  .describe('Declare or update a component; edit inside it with pageRef: "<ref>". See "Components" in plitzi://guide.');

export type UpsertComponent = z.infer<typeof upsertComponentOp>;

/** The declaration an op writes, with nothing it leaves out — an update keeps what it does not name. */
const declarationOf = (op: UpsertComponent, props: SpaceComponentDeclaration['props']): SpaceComponentDeclaration => ({
  ...(op.label === undefined ? {} : { label: op.label }),
  ...(props === undefined ? {} : { props }),
  ...(op.slots === undefined ? {} : { slots: op.slots })
});

/** The props an op declares, each held to what a prop is — or why one is not, by name. */
const parseProps = (
  props: Record<string, unknown> | undefined
): { props?: SpaceComponentDeclaration['props'] } | { error: string } => {
  if (props === undefined) {
    return {};
  }

  const parsed: NonNullable<SpaceComponentDeclaration['props']> = {};
  for (const [name, value] of Object.entries(props)) {
    const result = componentProp.safeParse(value);
    if (!result.success) {
      return {
        error: `prop "${name}" is not a prop: ${result.error.issues.map(issue => `${issue.path.join('.') || 'it'} ${issue.message}`).join('; ')}`
      };
    }

    parsed[name] = result.data;
  }

  return { props: parsed };
};

/** Why a declaration cannot stand, in words, or undefined: the same two rules `sdk-schema` holds every writer to. */
const declarationProblem = (
  declaration: SpaceComponentDeclaration,
  flat: SpaceComponent['flat']
): string | undefined => {
  for (const name of Object.keys(declaration.props ?? {})) {
    const problem = propNameProblem(name);
    if (problem) {
      return problem;
    }
  }

  const missing = (declaration.slots ?? []).find(slot => !Object.hasOwn(flat, slot));

  return missing ? `slot "${missing}" is not an element of the component` : undefined;
};

export const upsertComponent = (space: Space, env: Env, op: UpsertComponent): OpResult => {
  const { schema } = space;
  const stale = [componentsUri(env), pageUri(env, op.ref)];
  const props = parseProps(op.props);
  if ('error' in props) {
    return fail(
      'props',
      props.error,
      'A prop is { type: "text" | "textarea" | "number" | "boolean" | "select" | "scalar" | "json", description, required?, default?, options? }'
    );
  }

  const declaration = declarationOf(op, props.props);
  const existing = componentNamed(schema, op.ref);
  if (existing) {
    if (op.fromRef) {
      return fail('fromRef', `Component "${op.ref}" already exists`, 'fromRef makes a NEW component; pick another ref');
    }

    const problem = declarationProblem({ ...existing, ...declaration }, existing.flat);
    if (problem || !updateComponent(schema, op.ref, { ...existing, ...declaration })) {
      return fail(
        'props',
        problem ?? `Component "${op.ref}" refused the declaration`,
        'Name props as {{ props.<name> }} reads them, and slots as elements of the tree'
      );
    }

    return { ...empty(), updated: 1, staleResources: stale };
  }

  if (!isValidElementId(op.ref)) {
    return fail('ref', `"${op.ref}" is not a name a component can have`, ID_REF_HINT);
  }

  if (op.fromRef) {
    const tree = treeOf(schema, op.fromRef);
    const element = tree?.flat[op.fromRef];
    if (!tree || !element?.definition.parentId) {
      return fail(
        'fromRef',
        `"${op.fromRef}" is not an element inside a page, a layout or a component`,
        'A page or a layout is a root, not a subtree — name an element inside one'
      );
    }

    if (!op.instanceRef) {
      return fail(
        'instanceRef',
        'fromRef needs the name of the instance that takes the element’s place',
        'e.g. instanceRef: "hero-card"'
      );
    }

    const guard = guardNewRef(space, op.instanceRef, 'instanceRef');
    if (guard) {
      return guard;
    }

    const component: SpaceComponent = { ...declaration, id: op.ref, rootId: '', flat: {} };
    // What the component's tree will be: the element and everything under it, which is what its slots must name.
    const subtree = Object.fromEntries(
      [op.fromRef, ...descendants(tree.flat, op.fromRef)].map(id => [id, tree.flat[id]] as const)
    );
    const problem = declarationProblem(declaration, subtree);
    if (problem || !addComponent(schema, component, { elementId: op.fromRef, instanceId: op.instanceRef })) {
      return fail(
        'props',
        problem ?? `"${op.fromRef}" could not be made a component`,
        'Slots name elements inside fromRef'
      );
    }

    invalidateIndex(schema);

    return { ...empty(), created: 1, staleResources: stale, elementRefs: [op.instanceRef] };
  }

  const rootRef = `${op.ref}-root`;
  const guard = guardNewRef(space, rootRef, 'ref');
  if (guard) {
    return guard;
  }

  const component: SpaceComponent = {
    ...declaration,
    id: op.ref,
    rootId: rootRef,
    flat: {
      [rootRef]: {
        id: rootRef,
        attributes: { subType: 'div' },
        definition: {
          label: op.label ?? op.ref,
          type: 'container',
          rootId: rootRef,
          items: [],
          styleSelectors: { base: '' }
        }
      }
    }
  };
  const problem = declarationProblem(declaration, component.flat);
  if (problem || !addComponent(schema, component)) {
    return fail(
      'props',
      problem ?? `Component "${op.ref}" could not be declared`,
      'A new component has one element yet — its root; add the rest with upsertElement { pageRef: "<ref>" } first, then name slots'
    );
  }

  return { ...empty(), created: 1, staleResources: stale };
};
