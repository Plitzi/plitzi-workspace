import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp';

import { computeVersion, findElementByRef, findPageByRef } from '../helpers';
import { guideText } from './guide';
import { buildTypeRegistry } from './schema/registry';
import { elementDetailToAI, pageSkeletonToAI, pageSummariesToAI, schemaVariablesToAI } from './schema/translator';
import { cssProperties } from './style/cssCatalog';
import { definitionRefs, definitionToAI, styleVariablesToAI } from './style/translator';

import type { Space } from '../helpers';
import type { Env, ResourceEnvelope } from '../types';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';

const envelope = <T>(data: T): ResourceEnvelope<T> => ({ stateVersion: computeVersion(data), data });

/** Resolve a resource URI to its versioned envelope, or null if unknown / not found. */
export const readResource = (space: Space, env: Env, uri: string): ResourceEnvelope<unknown> | null => {
  if (uri === 'plitzi://guide') {
    return envelope(guideText);
  }

  if (uri === 'plitzi://types') {
    return envelope(buildTypeRegistry(space.schema));
  }

  if (uri === 'plitzi://css-properties') {
    return envelope(cssProperties);
  }

  if (uri === `plitzi://schema/${env}/pages`) {
    return envelope(pageSummariesToAI(space.schema));
  }

  if (uri.startsWith(`plitzi://schema/${env}/pages/`)) {
    const ref = uri.slice(`plitzi://schema/${env}/pages/`.length);
    const page = findPageByRef(space.schema, ref);

    return page ? envelope(pageSkeletonToAI(space.schema, page)) : null;
  }

  if (uri.startsWith(`plitzi://schema/${env}/elements/`)) {
    const ref = uri.slice(`plitzi://schema/${env}/elements/`.length);
    const el = findElementByRef(space.schema, ref);

    return el ? envelope(elementDetailToAI(space.schema, el)) : null;
  }

  if (uri === `plitzi://definitions/${env}`) {
    return envelope(definitionRefs(space.style));
  }

  if (uri.startsWith(`plitzi://definitions/${env}/`)) {
    const ref = uri.slice(`plitzi://definitions/${env}/`.length);
    const def = definitionToAI(space.style, ref);

    return def ? envelope(def) : null;
  }

  if (uri === `plitzi://style-variables/${env}`) {
    return envelope(styleVariablesToAI(space.style));
  }

  if (uri.startsWith(`plitzi://style-variables/${env}/`)) {
    const category = uri.slice(`plitzi://style-variables/${env}/`.length);
    const byCategory = styleVariablesToAI(space.style);

    return envelope(Object.hasOwn(byCategory, category) ? byCategory[category] : []);
  }

  if (uri === `plitzi://schema-variables/${env}`) {
    return envelope(schemaVariablesToAI(space.schema));
  }

  return null;
};

/** Current version of a resource, for optimistic-concurrency checks. Null when the URI is unknown. */
export const resourceVersion = (space: Space, env: Env, uri: string): string | null =>
  readResource(space, env, uri)?.stateVersion ?? null;

const jsonContents = (uri: string, data: unknown) => ({
  contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(data) }]
});

/** Register every resource on the MCP server: fixed listings plus templated per-item reads. */
export const registerResources = (server: McpServer, space: Space, env: Env): void => {
  const emit = (uri: string) => {
    const result = readResource(space, env, uri);
    if (!result) {
      throw new Error(`Unknown or missing resource: ${uri}`);
    }

    return jsonContents(uri, result);
  };

  server.registerResource(
    'Guide',
    'plitzi://guide',
    { description: 'How to read and write this space with mcp-ai', mimeType: 'text/markdown' },
    () => ({ contents: [{ uri: 'plitzi://guide', mimeType: 'text/markdown', text: guideText }] })
  );

  const fixed: Array<[string, string, string]> = [
    ['Element types', 'plitzi://types', 'Observed element types with props, slots and subTypes'],
    ['CSS properties', 'plitzi://css-properties', 'Valid kebab-case CSS property keys'],
    ['Pages', `plitzi://schema/${env}/pages`, 'Page summaries (ref, label, elementCount) — no element trees'],
    ['Style definitions', `plitzi://definitions/${env}`, 'Style definition refs (names)'],
    ['Style variables', `plitzi://style-variables/${env}`, 'Design tokens by category'],
    ['Schema variables', `plitzi://schema-variables/${env}`, 'Space-level values referenced via {{name}}']
  ];
  for (const [name, uri, description] of fixed) {
    server.registerResource(name, uri, { description, mimeType: 'application/json' }, () => emit(uri));
  }

  const templates: Array<[string, string, string]> = [
    ['Page', `plitzi://schema/${env}/pages/{ref}`, 'One page as a skeleton tree (ref/type/label/children), no props'],
    ['Element', `plitzi://schema/${env}/elements/{ref}`, 'One element in full detail (props, style) by ref or id'],
    ['Style definition', `plitzi://definitions/${env}/{ref}`, 'One style definition (CSS) by class ref'],
    ['Style variables by category', `plitzi://style-variables/${env}/{category}`, 'Design tokens for one category']
  ];
  for (const [name, tpl, description] of templates) {
    server.registerResource(
      name,
      new ResourceTemplate(tpl, { list: undefined }),
      { description, mimeType: 'application/json' },
      (uri: URL) => emit(uri.href)
    );
  }
};

export { buildTypeRegistry } from './schema/registry';
export type { TypeInfo, TypePropInfo, TypeRegistry } from './schema/registry';
export * from './schema/translator';
export { cssProperties, isCssProperty, suggestCssProperty } from './style/cssCatalog';
export * from './style/translator';
