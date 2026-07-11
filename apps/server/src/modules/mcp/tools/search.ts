import { computeVersion, elementRefOf, isPageElement, pageRefOfElement } from '../helpers';
import { definitionRefs, definitionToAI, elementDetailToAI } from '../resources';

import type { Space } from '../helpers';
import type { AIDefinition, AIElementDetail, Env } from '../types';
import type { Element, Schema } from '@plitzi/sdk-shared';

export interface SearchInput {
  query: string;
  filters?: { type?: string; pageRef?: string };
  /** 'detail' inlines each hit's full props/style so an edit needs no follow-up read. */
  include?: 'detail';
}

export interface SearchHit {
  pageRef: string;
  ref: string;
  uri: string;
  pageUri: string;
  stateVersion: string;
  parentRef?: string;
  /** Ancestor labels from the page down to and including this element. */
  path: string[];
  label: string;
  type: string;
  matches: string[];
  detail?: AIElementDetail;
}

export interface SearchResponse {
  results: SearchHit[];
  total: number;
  /** Style definitions whose ref matches the query, with their full CSS — so finding a class by name closes the
   *  loop to its style without a separate read. Present only when at least one definition matches. */
  definitions?: AIDefinition[];
}

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

  return {
    results: results.slice(0, 50),
    total: results.length,
    definitions: definitions.length > 0 ? definitions : undefined
  };
};
