/* eslint-disable @typescript-eslint/no-unnecessary-condition */

import { isValidElementId } from '../elementId';

import type { ValidationContext } from './context';
import type { Element } from '@plitzi/sdk-shared';

/** What its elements read and do: variables, binding sources, bindings and interactions. */

// 9. Validate variables
export const validateVariables = ({ errors, warnings, variables }: ValidationContext) => {
  const variableNames = new Set<string>();

  variables.forEach((variable, index) => {
    if (!variable.name) {
      errors.push({ code: 'INVALID_VARIABLE', message: `Variable at index ${index} has no name` });
      return;
    }

    if (variableNames.has(variable.name)) {
      errors.push({
        code: 'DUPLICATE_VARIABLE',
        message: `Duplicate variable name "${variable.name}"`,
        details: { variableName: variable.name }
      });
    }
    variableNames.add(variable.name);

    if (!(variable.type as undefined | typeof variable.type)) {
      warnings.push({
        code: 'MISSING_VARIABLE_TYPE',
        message: `Variable "${variable.name}" has no type`,
        details: { variableName: variable.name }
      });
    }
  });
};

/**
 * Every data-source name a binding reads must name an element that exists.
 *
 * A source is `<type>_<id>` optionally followed by `.<field…>` — the convention `repointIds` is built on. A typo
 * in the id half is the most expensive silent failure a space can carry: the binding resolves to nothing, the
 * element renders its placeholder, and no layer anywhere reports a missing name. Only heads whose type half is
 * an element type actually present in this document are checked, so a flow node id or a bare `form` is left
 * alone.
 */
export const validateBindingSources = ({ errors, flat }: ValidationContext, sourceTypes?: Record<string, string>) => {
  const refs = new Set<string>();
  const types = new Set<string>();
  /** element id → the source name that element actually publishes, when the caller supplied the catalog. */
  const published = new Map<string, string>();
  Object.values(flat).forEach(element => {
    if (!(element as Element | undefined)) {
      return;
    }

    refs.add(element.id);
    const prefix = sourceTypes?.[element.definition.type];
    if (prefix) {
      published.set(element.id, prefix);
    }

    types.add(element.definition.type);
  });

  Object.values(flat).forEach(element => {
    if (!(element as Element | undefined) || !element.definition.bindings) {
      return;
    }

    Object.entries(element.definition.bindings).forEach(([category, bindings]) => {
      (bindings ?? []).forEach(binding => {
        const head = binding.source.split('.')[0];
        const separator = head.indexOf('_');
        if (separator === -1) {
          return;
        }

        const type = head.slice(0, separator);
        const ref = head.slice(separator + 1);
        const where = `Element "${element.id}" binds ${category}.${binding.to} to "${binding.source}"`;

        if (!refs.has(ref)) {
          // Without the catalog the type half is only a hint — a flow node id or a bare `form` is not a source
          // at all — so an unknown name is reported only when its type half is one this document actually holds.
          if (sourceTypes || types.has(type)) {
            errors.push({
              code: 'UNRESOLVED_BINDING_SOURCE',
              message: `${where}, but no element answers to the name "${ref}"`,
              elementId: element.id,
              missing: ref,
              details: { source: binding.source, elementId: ref }
            });
          }

          return;
        }

        // The half an author cannot see. A `form` publishes under `apiContainer`, so a name assembled from the
        // element's own type is a source nothing ever registers — and the binding resolves to nothing.
        const expected = published.get(ref);
        if (expected && expected !== type) {
          errors.push({
            code: 'MISMATCHED_BINDING_SOURCE',
            message: `${where}, but "${ref}" publishes its source as "${expected}_${ref}"`,
            elementId: element.id,
            details: { source: binding.source, elementId: ref, expected: `${expected}_${ref}` }
          });
        }
      });
    });
  });
};

/**
 * The three fields that make a flow a flow.
 *
 * A flow is a linked list: each node names the one before and the one after, and every node carries the id of
 * the first as its `flowId`. Any of the three pointing at a node that is not there produces a flow that half
 * runs — the first steps fire, the rest never do — which reads exactly like an action that failed.
 *
 * An element-`callback` node also names the element it runs against, and that name is an element id: a global
 * callback names its source module instead (`space`, `state`, `auth`) and a utility names nothing at all, so
 * neither is resolved here.
 */
export const validateInteractions = ({ errors, warnings, flat, getElement }: ValidationContext) => {
  const refs = new Set<string>(Object.keys(flat));

  Object.values(flat).forEach(element => {
    const interactions = (element as Element | undefined)?.definition.interactions;
    if (!interactions) {
      return;
    }

    const nodes = Object.keys(interactions);
    Object.entries(interactions).forEach(([key, node]) => {
      // A step id is a name too: the key of the flow map, what `beforeNode`/`afterNode`/`flowId` point at, and
      // the scope key a later step reads as `{{ <id>.field }}` — so a '.' in it splits that path, and a key that
      // disagrees with the node under it makes every link resolve to whichever half the reader happened to use.
      if (!isValidElementId(key)) {
        errors.push({
          code: 'INVALID_INTERACTION_ID',
          message: `Interaction "${key}" on element "${element.id}" has a name that must start with a letter, then letters, numbers, hyphens and underscores — a later step reads it as {{ ${key}.field }}`,
          elementId: element.id
        });
      }

      if (node.id !== key) {
        errors.push({
          code: 'INTERACTION_ID_MISMATCH',
          message: `Interaction id "${node.id}" on element "${element.id}" doesn't match its key "${key}"`,
          elementId: element.id
        });
      }

      (['beforeNode', 'afterNode'] as const).forEach(link => {
        const target = node[link];
        if (target && !nodes.includes(target)) {
          errors.push({
            code: 'BROKEN_FLOW_LINK',
            message: `Interaction "${node.id}" on element "${element.id}" names ${link} "${target}", which is not a node of this flow`,
            elementId: element.id
          });
        }
      });

      if (node.flowId && !nodes.includes(node.flowId)) {
        errors.push({
          code: 'BROKEN_FLOW_ID',
          message: `Interaction "${node.id}" on element "${element.id}" belongs to flow "${node.flowId}", which is not a node of this flow`,
          elementId: element.id
        });
      }

      if (node.type === 'callback' && node.elementId && !refs.has(node.elementId)) {
        errors.push({
          code: 'UNRESOLVED_INTERACTION_TARGET',
          message: `Interaction "${node.id}" on element "${element.id}" runs against "${node.elementId}", but no element answers to that name`,
          elementId: element.id,
          missing: node.elementId,
          wantedBy: node.action
        });
      }

      /**
       * A form hands its submit to a flow only when it is told to: left unmanaged, the browser submits it natively
       * and `onSubmit` never fires. The flow is saved, sits on the right element and never runs — a warning rather
       * than an error because a builder document can carry one, and refusing it would block every other edit.
       */
      const submitted = node.type === 'trigger' && node.action === 'onSubmit' && node.enabled;
      const form = submitted ? getElement(node.elementId ?? element.id) : undefined;
      if (form?.definition.type === 'form' && form.attributes.managedByInteractions !== true) {
        warnings.push({
          code: 'FORM_SUBMIT_UNMANAGED',
          message: `Form "${form.id}" has an onSubmit flow but is not managedByInteractions, so the browser submits it natively and the flow never runs — set managedByInteractions: true`,
          elementId: form.id
        });
      }
    });
  });
};

/**
 * A binding's id, which is element-local but still has to be one thing.
 *
 * Two bindings of one element sharing an id is what makes `patchBinding`/`deleteBinding` hit whichever the
 * search found first — an edit that appears to work and lands on the wrong rule.
 */
export const validateBindings = ({ errors, flat }: ValidationContext) => {
  Object.values(flat).forEach(element => {
    if (!(element as Element | undefined) || !element.definition.bindings) {
      return;
    }

    const seen = new Set<string>();
    Object.entries(element.definition.bindings).forEach(([category, bindings]) => {
      (bindings ?? []).forEach(binding => {
        if (!binding.id) {
          errors.push({
            code: 'MISSING_BINDING_ID',
            message: `Element "${element.id}" has a ${category} binding to "${binding.to}" with no id`,
            elementId: element.id
          });

          return;
        }

        if (seen.has(binding.id)) {
          errors.push({
            code: 'DUPLICATE_BINDING_ID',
            message: `Element "${element.id}" has two bindings called "${binding.id}"`,
            elementId: element.id,
            details: { bindingId: binding.id }
          });
        }

        seen.add(binding.id);
      });
    });
  });
};
