import { z } from 'zod';

import { computeVersion, elementRefOf, getPageElements, isPageElement, pageRefOf, pageRefOfElement } from '../helpers';
import { definitionRefs, definitionToAI, elementDetailToAI, pageSkeletonToAI } from '../resources';
import { defineTool } from './shared/tool';

import type { Space } from '../helpers';
import type { AIDefinition, Env, SearchHit, SearchInput, SearchPageHit, SearchResponse } from '../types';
import type { Element, Schema } from '@plitzi/sdk-shared';

export const searchShape = {
  query: z.string().describe('Case-insensitive match on label, type and attribute values'),
  filters: z.object({ type: z.string().optional(), pageRef: z.string().optional() }).optional(),
  include: z
    .literal('detail')
    .optional()
    .describe('Set to "detail" to inline each hit\'s full props/style so an edit needs no follow-up read'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Max element hits to return (default 50). Response echoes total and, if more remain, nextOffset.'),
  offset: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Element hits to skip (default 0). Page by re-calling with offset = nextOffset until it is absent.')
};

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
      stateVersion: computeVersion(pageSkeletonToAI(space.schema, page, space.style)),
      label,
      slug,
      matches
    });
  }

  const offset = input.offset ?? 0;
  const limit = input.limit ?? 50;
  const total = results.length;
  const nextOffset = offset + limit < total ? offset + limit : undefined;

  return {
    results: results.slice(offset, offset + limit),
    total,
    offset,
    limit,
    nextOffset,
    definitions: definitions.length > 0 ? definitions : undefined,
    pages: pages.length > 0 ? pages : undefined
  };
};

export const searchTool = defineTool({
  name: 'plitzi_search',
  title: 'Search',
  description:
    'FIND elements when you know what you want but not its ref/uri (e.g. "the hero button"). Matches label, type ' +
    'or attribute value across all pages. Each hit returns the element uri, its ' +
    'stateVersion (edit with optimistic concurrency, no read needed) and its tree path. Pass include: "detail" ' +
    'to inline the full props/style of each hit plus resolvedStyle (the CSS of its classes). Also returns any ' +
    'style definitions matching the query (with full CSS) under `definitions`, and matching pages under `pages`. ' +
    'Element hits are paginated: it returns at most `limit` (default 50) starting at `offset`, plus `total` and — ' +
    'while more remain — `nextOffset` to fetch the next page.',
  inputShape: searchShape,
  access: 'read',
  run: (input, ctx) => search(input, ctx.space, ctx.env)
});
