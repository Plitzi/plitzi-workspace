import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp';

import { computeVersion, findElementByRef, findPageByRef } from '../helpers';
import { guideText } from './guide';
import { buildTypeRegistry } from './schema/registry';
import { elementDetailToAI, pageSkeletonToAI, pageSummariesToAI, schemaVariablesToAI } from './schema/translator';
import { cssProperties } from './style/cssCatalog';
import {
  definitionRefs,
  definitionToAI,
  globalStyleToAI,
  globalStyleTypes,
  styleVariablesToAI
} from './style/translator';

import type { Space } from '../helpers';
import type { Env, ResourceEnvelope } from '../types';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';

const envelope = <T>(data: T): ResourceEnvelope<T> => ({ stateVersion: computeVersion(data), data });

// Style resources live at their own top-level roots (plitzi://definitions, plitzi://style-variables,
// plitzi://schema-variables) but agents reach for them by analogy under plitzi://schema/{env}/… . Accept that
// alias shape and fold it back to the canonical root, so both forms resolve (RFC 0005 I3).
const ALIASED_ROOTS = ['definitions', 'global-styles', 'style-variables', 'schema-variables'];

const canonicalUri = (env: Env, uri: string): string => {
  const aliasPrefix = `plitzi://schema/${env}/`;
  if (!uri.startsWith(aliasPrefix)) {
    return uri;
  }

  const rest = uri.slice(aliasPrefix.length);
  for (const root of ALIASED_ROOTS) {
    if (rest === root) {
      return `plitzi://${root}/${env}`;
    }

    if (rest.startsWith(`${root}/`)) {
      return `plitzi://${root}/${env}/${rest.slice(root.length + 1)}`;
    }
  }

  return uri;
};

/** Resolve a resource URI to its versioned envelope, or null if unknown / not found. */
export const readResource = (space: Space, env: Env, rawUri: string): ResourceEnvelope<unknown> | null => {
  const uri = canonicalUri(env, rawUri);
  if (uri === 'plitzi://guide') {
    return envelope(guideText);
  }

  if (uri === 'plitzi://types') {
    return envelope(buildTypeRegistry(space.schema));
  }

  if (uri === 'plitzi://css-properties') {
    return envelope(cssProperties);
  }

  // The cold-start bundle: everything the guide says to read before the first write, in one round-trip.
  // Summaries only — never full page/element trees (open those on demand).
  if (uri === `plitzi://primer/${env}`) {
    return envelope({
      guide: guideText,
      types: buildTypeRegistry(space.schema),
      cssProperties,
      pages: pageSummariesToAI(space.schema),
      definitions: definitionRefs(space.style),
      styleVariables: styleVariablesToAI(space.style),
      schemaVariables: schemaVariablesToAI(space.schema)
    });
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

    return el ? envelope(elementDetailToAI(space.schema, el, space.style)) : null;
  }

  if (uri === `plitzi://definitions/${env}`) {
    return envelope(definitionRefs(space.style));
  }

  if (uri.startsWith(`plitzi://definitions/${env}/`)) {
    const ref = uri.slice(`plitzi://definitions/${env}/`.length);
    const def = definitionToAI(space.style, ref);

    return def ? envelope(def) : null;
  }

  if (uri === `plitzi://global-styles/${env}`) {
    return envelope(globalStyleTypes(space.style));
  }

  if (uri.startsWith(`plitzi://global-styles/${env}/`)) {
    const componentType = uri.slice(`plitzi://global-styles/${env}/`.length);
    const global = globalStyleToAI(space.style, componentType);

    return global ? envelope(global) : null;
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

const itemTemplates = (env: Env): string[] => [
  `plitzi://schema/${env}/pages/{ref}`,
  `plitzi://schema/${env}/elements/{ref}`,
  `plitzi://definitions/${env}/{ref}`,
  `plitzi://global-styles/${env}/{componentType}`,
  `plitzi://style-variables/${env}/{category}`
];

/** Teachable message for a URI that read as null. Distinguishes a well-formed URI whose ref does not resolve (the
 *  resource may be stale/deleted) from a URI whose shape matches no template at all (malformed — echo the valid
 *  templates so the agent stops hand-building URIs). See RFC 0004 I2. */
export const resourceErrorMessage = (env: Env, uri: string): string => {
  const canonical = canonicalUri(env, uri);
  const knownShape = itemTemplates(env).some(tpl => canonical.startsWith(tpl.slice(0, tpl.lastIndexOf('/') + 1)));
  if (knownShape) {
    return JSON.stringify({
      error: 'NOT_FOUND',
      message: `No resource at '${uri}'. Its shape is valid but the ref does not resolve.`,
      hint: 'It may have been deleted or your URI is stale. Re-list the parent resource (pages/definitions) to refresh.'
    });
  }

  return JSON.stringify({
    error: 'MALFORMED_URI',
    message: `'${uri}' matches no resource template.`,
    hint: 'Do not hand-build element URIs — take the ready-made uri from plitzi_search or a write response.',
    validTemplates: [`plitzi://primer/${env}`, ...itemTemplates(env)]
  });
};

const jsonContents = (uri: string, data: unknown) => ({
  contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(data) }]
});

/** Register every resource on the MCP server: fixed listings plus templated per-item reads. The space is
 *  loaded lazily via getSpace, so listing resources never touches the store — only reading one does. */
export const registerResources = (server: McpServer, getSpace: () => Promise<Space>, env: Env): void => {
  const emit = async (uri: string) => {
    const result = readResource(await getSpace(), env, uri);
    if (!result) {
      throw new Error(resourceErrorMessage(env, uri));
    }

    return jsonContents(uri, result);
  };

  // Public, space-independent resources: served straight from static data so they resolve no spaceId and load
  // no space — reachable even on an unauthenticated connection.
  server.registerResource(
    'Guide',
    'plitzi://guide',
    { description: 'How to read and write this space with mcp-ai', mimeType: 'text/markdown' },
    () => ({ contents: [{ uri: 'plitzi://guide', mimeType: 'text/markdown', text: guideText }] })
  );

  server.registerResource(
    'CSS properties',
    'plitzi://css-properties',
    { description: 'Valid kebab-case CSS property keys', mimeType: 'application/json' },
    () => jsonContents('plitzi://css-properties', envelope(cssProperties))
  );

  // Space-dependent listings: reading any of these resolves the spaceId and loads the space via getSpace.
  const fixed: Array<[string, string, string]> = [
    [
      'Primer',
      `plitzi://primer/${env}`,
      'Cold-start bundle: guide, types, css-properties, page/definition/variable summaries in one read'
    ],
    ['Element types', 'plitzi://types', 'Observed element types with props, slots and subTypes'],
    ['Pages', `plitzi://schema/${env}/pages`, 'Page summaries (ref, label, elementCount) — no element trees'],
    ['Style definitions', `plitzi://definitions/${env}`, 'Style definition refs (names)'],
    ['Global styles', `plitzi://global-styles/${env}`, 'Element types that have a site-wide global style'],
    ['Style variables', `plitzi://style-variables/${env}`, 'Design tokens by category'],
    ['Schema variables', `plitzi://schema-variables/${env}`, 'Space-level values referenced via {{name}}'],
    // Aliases under the plitzi://schema/{env} root, so the analogous shape agents reach for also resolves (I3).
    ['Style definitions (schema alias)', `plitzi://schema/${env}/definitions`, 'Alias of plitzi://definitions/{env}'],
    [
      'Style variables (schema alias)',
      `plitzi://schema/${env}/style-variables`,
      'Alias of plitzi://style-variables/{env}'
    ],
    [
      'Schema variables (schema alias)',
      `plitzi://schema/${env}/schema-variables`,
      'Alias of plitzi://schema-variables/{env}'
    ]
  ];
  for (const [name, uri, description] of fixed) {
    server.registerResource(name, uri, { description, mimeType: 'application/json' }, () => emit(uri));
  }

  const templates: Array<[string, string, string]> = [
    ['Page', `plitzi://schema/${env}/pages/{ref}`, 'One page as a skeleton tree (ref/type/label/children), no props'],
    ['Element', `plitzi://schema/${env}/elements/{ref}`, 'One element in full detail (props, style) by ref or id'],
    ['Style definition', `plitzi://definitions/${env}/{ref}`, 'One style definition (CSS) by class ref'],
    [
      'Global style',
      `plitzi://global-styles/${env}/{componentType}`,
      'The site-wide CSS applied to every element of one type'
    ],
    ['Style variables by category', `plitzi://style-variables/${env}/{category}`, 'Design tokens for one category'],
    // Aliases under plitzi://schema/{env} (I3).
    [
      'Style definition (schema alias)',
      `plitzi://schema/${env}/definitions/{ref}`,
      'Alias of plitzi://definitions/{env}/{ref}'
    ],
    [
      'Style variables by category (schema alias)',
      `plitzi://schema/${env}/style-variables/{category}`,
      'Alias of plitzi://style-variables/{env}/{category}'
    ]
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
export { cssProperties, expandShorthand, isCssProperty, suggestCssProperty } from './style/cssCatalog';
export * from './style/translator';
