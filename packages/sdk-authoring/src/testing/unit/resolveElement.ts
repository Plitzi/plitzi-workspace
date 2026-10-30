import { evaluateComputed, getBindingsDetails } from '@plitzi/sdk-shared/dataSource';
import { isRecord } from '@plitzi/sdk-shared/helpers';
import { hasValidToken, processTwig } from '@plitzi/sdk-shared/helpers/twigWrapper';

import type { RuleValue } from '@plitzi/plitzi-ui/QueryBuilder';
import type { Element, Schema, UnitGiven } from '@plitzi/sdk-shared';

/**
 * A space's logic checked without a browser (RFC 0031, unit tests): what one element of the document resolves to for a
 * state and the data it reads — its attributes after bindings and templates, its style, its visibility, its variants —
 * evaluated with the functions the SDK draws it with. In milliseconds: a pricing chooser's forty combinations of answers
 * were once a test of their own, written by hand over `processTwig`.
 */

export interface ResolvedElement {
  id: string;
  /** Its attributes, bindings and templates applied. */
  attributes: Record<string, unknown>;
  /** What its style bindings write, by property (camelCase, as the SDK writes it inline). */
  style: Record<string, string>;
  /** Its state as it starts, bindings applied: `visibility`, `styleVariant`, `styleSelectors`… */
  initialState: Record<string, unknown>;
  /** Whether it shows: neither it nor any element around it hidden. */
  visible: boolean;
  /** Its variant by class, from `initialState.styleVariant`: `{ 'pr-rung': 'current' }`. */
  styleVariant: Record<string, string>;
}

const visibleOwn = (initialState: Record<string, unknown>): boolean =>
  initialState.visibility !== false && initialState.visibility !== 'false';

/** Each class's variant, as a `styleVariant` binding leaves it: a class's `base` variant, or a variant by name. */
const variantsOf = (initialState: Record<string, unknown>): Record<string, string> => {
  const { styleVariant } = initialState;
  if (!isRecord(styleVariant)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(styleVariant).flatMap(([name, value]) => {
      if (typeof value === 'string') {
        return [[name, value]];
      }

      return isRecord(value) && typeof value.base === 'string' ? [[name, value.base]] : [];
    })
  );
};

/** The data an element's bindings and templates read: the sources, the state, and what the space computes from them. */
const dataOf = (document: Schema, { state = {}, sources = {} }: UnitGiven) => {
  const definitions = document.settings.computed ?? {};
  const computed = Object.keys(definitions).length > 0 ? evaluateComputed(definitions, { ...sources, state }) : {};

  return { ...sources, state, computed };
};

const resolveOne = (element: Element, data: Record<string, unknown>) => {
  const { attributes, style, definition } = getBindingsDetails(data as Record<string, RuleValue>, element);
  // What was written with a template, interpolated as the SDK interpolates it: over the sources and the state.
  const interpolated = Object.fromEntries(
    Object.entries(attributes).map(([key, value]) => [
      key,
      typeof value === 'string' && value === element.attributes[key] && hasValidToken(value)
        ? processTwig(value, data)
        : value
    ])
  );

  return { attributes: interpolated, style, initialState: { ...definition.initialState } };
};

/**
 * One element of the document's pages, resolved for a state and its data. Refused, naming the fix, for an id no page
 * has: an element of a component's own tree is resolved on the component's instance.
 */
export const resolveElement = (document: Schema, id: string, given: UnitGiven = {}): ResolvedElement => {
  const { flat } = document;
  const element = flat[id] as Element | undefined;
  if (!element) {
    throw new Error(
      `No element "${id}" on the space's pages: resolveElement takes an element of a page by its id — one of a component's own tree is read through its instance`
    );
  }

  const data = dataOf(document, given);
  const own = resolveOne(element, data);
  // Shown only while every element around it is: a hidden panel hides what it holds.
  let shown = visibleOwn(own.initialState);
  for (let at = element.definition.parentId; shown && at !== undefined;) {
    const parent = flat[at] as Element | undefined;
    if (!parent) {
      break;
    }

    shown = visibleOwn(resolveOne(parent, data).initialState);
    at = parent.definition.parentId;
  }

  return {
    id,
    attributes: own.attributes,
    style: own.style,
    initialState: own.initialState,
    visible: shown,
    styleVariant: variantsOf(own.initialState)
  };
};
