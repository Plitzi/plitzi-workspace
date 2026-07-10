import {
  descendantCount,
  elementRefOf,
  getPageElements,
  isPageElement,
  orderedChildren,
  pageRefOf,
  pageRefOfElement,
  slugRouteParams
} from '../../helpers';

import type { AIElementDetail, AIPageSkeleton, AIPageSummary, AISchemaVariable, AISkeletonNode } from '../../types';
import type { Element, Schema } from '@plitzi/sdk-shared';

// Read projections of the ELEMENT schema: page summaries, per-page skeleton trees, element detail, and vars.

const splitClasses = (value: string | undefined): string[] => (value ? value.split(/\s+/).filter(Boolean) : []);

const strOr = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

const nameOf = (page: Element): string => strOr(page.attributes.name) ?? page.definition.label;

const propsOf = (el: Element): Record<string, unknown> | undefined => {
  const { subType, ...rest } = el.attributes;
  void subType;

  return Object.keys(rest).length > 0 ? rest : undefined;
};

const slotClasses = (selectors: Record<string, string>): Record<string, string[]> => {
  const slots: Record<string, string[]> = {};
  for (const [slot, classes] of Object.entries(selectors)) {
    if (slot !== 'base') {
      slots[slot] = splitClasses(classes);
    }
  }

  return slots;
};

// --- Navigation (cheap): page summaries and per-page skeleton trees, no props/style. ---

export const pageSummariesToAI = (schema: Schema): AIPageSummary[] =>
  getPageElements(schema).map(page => ({
    ref: pageRefOf(page),
    label: nameOf(page),
    slug: strOr(page.attributes.slug) ?? '',
    default: page.attributes.default === true,
    folder: strOr(page.attributes.folder),
    elementCount: descendantCount(schema, page.id)
  }));

const skeletonNode = (schema: Schema, el: Element): AISkeletonNode => {
  const children = orderedChildren(schema, el);

  return {
    ref: elementRefOf(el),
    type: el.definition.type,
    label: el.definition.label,
    subType: strOr(el.attributes.subType),
    childCount: children.length,
    children: children.length > 0 ? children.map(child => skeletonNode(schema, child)) : undefined
  };
};

export const pageSkeletonToAI = (schema: Schema, pageEl: Element): AIPageSkeleton => {
  const slug = strOr(pageEl.attributes.slug) ?? '';

  return {
    ref: pageRefOf(pageEl),
    label: nameOf(pageEl),
    slug,
    default: pageEl.attributes.default === true,
    routeParams: slugRouteParams(slug),
    tree: orderedChildren(schema, pageEl).map(child => skeletonNode(schema, child))
  };
};

// --- Detail (on demand): one element with its props and style. ---

export const elementDetailToAI = (schema: Schema, el: Element): AIElementDetail => {
  const children = orderedChildren(schema, el);
  const parent = el.definition.parentId ? schema.flat[el.definition.parentId] : undefined;

  return {
    ref: elementRefOf(el),
    type: el.definition.type,
    subType: strOr(el.attributes.subType),
    label: el.definition.label,
    pageRef: pageRefOfElement(schema, el),
    parentRef: parent ? (isPageElement(schema, parent) ? pageRefOf(parent) : elementRefOf(parent)) : undefined,
    props: propsOf(el),
    style: {
      base: splitClasses(el.definition.styleSelectors.base),
      slots: slotClasses(el.definition.styleSelectors)
    },
    childRefs: children.length > 0 ? children.map(elementRefOf) : undefined
  };
};

export const schemaVariablesToAI = (schema: Schema): Record<string, AISchemaVariable> => {
  const data: Record<string, AISchemaVariable> = {};

  for (const variable of schema.variables) {
    data[variable.name] = {
      name: variable.name,
      reference: `{{${variable.name}}}`,
      category: variable.category,
      type: variable.type,
      value: variable.value,
      subValues: variable.subValues.map(sv => ({ when: sv.when, value: sv.value }))
    };
  }

  return data;
};
