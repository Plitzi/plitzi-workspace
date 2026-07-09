import { elementRefOf, pageRefOfElement } from '../helpers';

import type { Space } from '../helpers';

export interface SearchInput {
  query: string;
  filters?: { type?: string; pageRef?: string };
}

export interface SearchResponse {
  results: Array<{ pageRef: string; ref: string; label: string; type: string; matches: string[] }>;
  total: number;
}

export const search = (input: SearchInput, space: Space): SearchResponse => {
  const query = input.query.toLowerCase();
  const results: SearchResponse['results'] = [];

  for (const el of Object.values(space.schema.flat)) {
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

    if (matches.length > 0) {
      results.push({ pageRef, ref: elementRefOf(el), label: el.definition.label, type: el.definition.type, matches });
    }
  }

  return { results: results.slice(0, 50), total: results.length };
};
