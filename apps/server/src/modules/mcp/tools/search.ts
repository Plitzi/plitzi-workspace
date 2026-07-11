import { computeVersion, elementRefOf, getPageElements, isPageElement, pageRefOf, pageRefOfElement } from '../helpers';
import { definitionRefs, definitionToAI, elementDetailToAI, pageSkeletonToAI } from '../resources';

import type { Space } from '../helpers';
import type { AIDefinition, Env, SearchHit, SearchInput, SearchPageHit, SearchResponse } from '../types';
import type { Element, Schema } from '@plitzi/sdk-shared';

const labelOf = (el: Element): string =>
  (typeof el.attributes.name === 'string' ? el.attributes.name : undefined) ?? el.definition.label;

// Ancestor labels from the page root down to (and including) the element, so a hit locates itself in the tree.
const breadcrumb = (schema: Schema, el: Element): string[] => {
  const chain: string[] = [];
  let current: Element | undefined = el;
  const guard = new Set<string>();
  while (current && !guard.has(current.id)) {
    guard.add(current.id);
    chain.push(labelOf(current));
    current = current.definition.parentId ? schema.flat[current.definition.parentId] : undefined;
  }

  return chain.reverse();
};

export const search = (input: SearchInput, space: Space, env: Env): SearchResponse => {
  const query = input.query.toLowerCase();
  const results: SearchHit[] = [];

  for (const el of Object.values(space.schema.flat)) {
    if (isPageElement(space.schema, el)) {
      continue;
    }

    if (input.filters?.type && el.definition.type !== input.filters.type) {
      continue;
    }

    const pageRef = pageRefOfElement(space.schema, el);
    if (input.filters?.pageRef && pageRef !== input.filters.pageRef) {
      continue;
    }

    const matches: string[] = [];
    if (el.definition.label.toLowerCase().includes(query)) {
      matches.push(`label: ${el.definition.label}`);
    }

    if (el.definition.type.toLowerCase().includes(query)) {
      matches.push(`type: ${el.definition.type}`);
    }

    for (const [key, value] of Object.entries(el.attributes)) {
      if (String(value).toLowerCase().includes(query)) {
        matches.push(`${key}: ${String(value).slice(0, 100)}`);
      }
    }

    if (matches.length === 0) {
      continue;
    }

    const ref = elementRefOf(el);
    // Resolve style even when detail is not returned, so stateVersion matches a direct element read (which inlines
    // resolvedStyle) and stays valid for optimistic concurrency.
    const detail = elementDetailToAI(space.schema, el, space.style);
    results.push({
      pageRef,
      ref,
      uri: `plitzi://schema/${env}/elements/${ref}`,
      pageUri: `plitzi://schema/${env}/pages/${pageRef}`,
      stateVersion: computeVersion(detail),
      parentRef: detail.parentRef,
      path: breadcrumb(space.schema, el),
      label: el.definition.label,
      type: el.definition.type,
      matches,
      detail: input.include === 'detail' ? detail : undefined
    });
  }

  const definitions: AIDefinition[] = [];
  for (const ref of definitionRefs(space.style)) {
    if (ref.toLowerCase().includes(query)) {
      const def = definitionToAI(space.style, ref);
      if (def) {
        definitions.push(def);
      }
    }

    if (definitions.length >= 50) {
      break;
    }
  }

  const pages: SearchPageHit[] = [];
  for (const page of getPageElements(space.schema)) {
    const label = labelOf(page);
    const slug = typeof page.attributes.slug === 'string' ? page.attributes.slug : '';
    const matches: string[] = [];
    if (label.toLowerCase().includes(query)) {
      matches.push(`label: ${label}`);
    }

    if (slug && slug.toLowerCase().includes(query)) {
      matches.push(`slug: ${slug}`);
    }

    if (matches.length === 0) {
      continue;
    }

    const ref = pageRefOf(page);
    pages.push({
      ref,
      uri: `plitzi://schema/${env}/pages/${ref}`,
      stateVersion: computeVersion(pageSkeletonToAI(space.schema, page)),
      label,
      slug,
      matches
    });
  }

  return {
    results: results.slice(0, 50),
    total: results.length,
    definitions: definitions.length > 0 ? definitions : undefined,
    pages: pages.length > 0 ? pages : undefined
  };
};
