/* eslint-disable @typescript-eslint/no-unnecessary-condition */

import { isInstance, propNameProblem } from '../components';
import { isValidElementId } from '../elementId';

import type { ValidationContext } from './context';
import type { SchemaValidationOptions, SchemaValidationResult } from './types';
import type { Element, Schema } from '@plitzi/sdk-shared';

/** Its components: their trees, props and slots, and instances that place none of them in itself. */

/**
 * The components: each tree held to the same rules as the pages' — as a fragment hung off its root, which is what
 * keeps a component closed (a binding or a step inside one resolves against its own tree, never the page it is
 * placed on) — and what only the whole document can answer: that an id is in one tree only, that a declaration
 * names elements its tree has, that every instance names a component, and that no component places itself.
 */
export const validateComponents = (
  { errors, warnings, flat, components, schema, options }: ValidationContext,
  /** The validation a component's tree is held to, as a fragment of its own: the whole one, handed in. */
  validateTree: (tree: Schema, treeOptions: SchemaValidationOptions) => SchemaValidationResult
) => {
  const owners = new Map<string, string>(Object.keys(flat).map(id => [id, '']));
  const ownerName = (owner: string) => (owner ? `component "${owner}"` : 'the pages');
  const places = new Map<string, Set<string>>();

  Object.entries(components).forEach(([key, component]) => {
    const where = `Component "${key}"`;
    if (component.id !== key) {
      errors.push({
        code: 'COMPONENT_ID_MISMATCH',
        message: `${where} has id "${component.id}"`,
        componentId: key
      });
    }

    if (!isValidElementId(key)) {
      errors.push({
        code: 'INVALID_COMPONENT_ID',
        message: `${where} has a name that must start with a letter, then letters, numbers, hyphens and underscores`,
        componentId: key
      });
    }

    const root = component.flat[component.rootId] as Element | undefined;
    if (!root) {
      errors.push({
        code: 'COMPONENT_ROOT_MISSING',
        message: `${where} is rooted at "${component.rootId}", which is not an element of its tree`,
        componentId: key
      });

      return;
    }

    if (root.definition.parentId) {
      errors.push({
        code: 'COMPONENT_ROOT_HAS_PARENT',
        message: `${where} is rooted at "${component.rootId}", which names a parent — a component's root has none`,
        elementId: component.rootId,
        componentId: key
      });
    }

    Object.keys(component.flat).forEach(id => {
      const owner = owners.get(id);
      if (owner !== undefined) {
        errors.push({
          code: 'DUPLICATE_ELEMENT_ID',
          message: `"${id}" names an element of ${ownerName(owner)} and one of ${ownerName(key)} — an id is one element in the whole space`,
          elementId: id,
          componentId: key
        });
      } else {
        owners.set(id, key);
      }
    });

    Object.keys(component.props ?? {}).forEach(name => {
      const problem = propNameProblem(name);
      if (problem) {
        errors.push({ code: 'INVALID_COMPONENT_PROP', message: `${where}: ${problem}`, componentId: key });
      }
    });

    (component.slots ?? []).forEach(slot => {
      if (!Object.hasOwn(component.flat, slot)) {
        errors.push({
          code: 'MISSING_COMPONENT_SLOT',
          message: `${where} declares slot "${slot}", which is not an element of its tree`,
          componentId: key
        });
      }
    });

    const fragment = validateTree(
      { ...schema, flat: component.flat, pages: [], pageFolders: [], components: {} },
      { baseElementId: component.rootId, sourceTypes: options?.sourceTypes }
    );
    fragment.errors.forEach(error =>
      errors.push({ ...error, message: `${where}: ${error.message}`, componentId: key })
    );
    fragment.warnings.forEach(warning =>
      warnings.push({ ...warning, message: `${where}: ${warning.message}`, componentId: key })
    );
  });

  const trees: [string, Schema['flat']][] = [
    ['', flat],
    ...Object.entries(components).map(([key, component]) => [key, component.flat] as [string, Schema['flat']])
  ];
  trees.forEach(([owner, tree]) => {
    Object.values(tree).forEach(element => {
      if (!(element as Element | undefined) || !isInstance(element)) {
        return;
      }

      const componentId = element.attributes.referenceId;
      const component = typeof componentId === 'string' ? components[componentId] : undefined;
      if (!component || typeof componentId !== 'string') {
        errors.push({
          code: 'UNRESOLVED_COMPONENT',
          message: `Instance "${element.id}" places component "${String(componentId)}", which this space does not declare`,
          elementId: element.id,
          ...(owner ? { componentId: owner } : {})
        });

        return;
      }

      if (owner) {
        places.set(owner, (places.get(owner) ?? new Set()).add(componentId));
      }

      (element.definition.items ?? []).forEach(childId => {
        const slot = tree[childId]?.attributes.slot ?? component.slots?.[0];
        if (typeof slot !== 'string' || !component.slots?.includes(slot)) {
          errors.push({
            code: 'UNKNOWN_COMPONENT_SLOT',
            message: `"${childId}" fills ${typeof slot === 'string' ? `slot "${slot}"` : 'a slot'} of instance "${element.id}", but component "${componentId}" declares ${component.slots?.length ? `only ${component.slots.map(name => `"${name}"`).join(', ')}` : 'no slots'}`,
            elementId: childId,
            ...(owner ? { componentId: owner } : {})
          });
        }
      });
    });
  });

  const reported = new Set<string>();
  const walk = (componentId: string, path: string[]): void => {
    if (path.includes(componentId)) {
      const cycle = [...path.slice(path.indexOf(componentId)), componentId];
      if (!cycle.some(id => reported.has(id))) {
        cycle.forEach(id => reported.add(id));
        errors.push({
          code: 'COMPONENT_CYCLE',
          message: `Components place each other in a circle: ${cycle.join(' → ')}`,
          componentId,
          details: { cycle }
        });
      }

      return;
    }

    places.get(componentId)?.forEach(next => walk(next, [...path, componentId]));
  };
  Object.keys(components).forEach(componentId => walk(componentId, []));
};
