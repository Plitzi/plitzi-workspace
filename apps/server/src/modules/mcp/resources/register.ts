import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp';

import { resourceErrorMessage } from './canonical';
import { envelope, jsonContents } from './envelope';
import { readResource } from './router';
import { cssProperties } from '../catalogs';
import { guideText } from '../helpers/guide';

import type { Space } from '../helpers';
import type { Env } from '../types';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';

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
      'Read this FIRST. Cold-start bundle in one call: guide, types, css-properties and SUMMARIES of pages, ' +
        'definitions and variables — summaries only, never full page/element trees, so it stays small even on a ' +
        'large space. Open a page or element on demand afterwards.'
    ],
    ['Element types', 'plitzi://types', 'Observed element types with props, slots and subTypes'],
    ['Pages', `plitzi://schema/${env}/pages`, 'Page summaries (ref, label, elementCount) — no element trees'],
    ['Folders', `plitzi://folders/${env}`, 'Page folders (the sidebar tree): ref, name, slug, parentId'],
    ['Style definitions', `plitzi://definitions/${env}`, 'Style definition refs (names)'],
    ['Global styles', `plitzi://global-styles/${env}`, 'Element types that have a site-wide global style'],
    ['Id styles', `plitzi://id-styles/${env}`, 'DOM ids that have an id rule (#id) targeting a single element'],
    ['Style variables', `plitzi://style-variables/${env}`, 'Design tokens by category'],
    ['Schema variables', `plitzi://schema-variables/${env}`, 'Space-level values referenced via {{name}}'],
    ['Settings', `plitzi://settings/${env}`, 'Space-level settings: global customCss and state/auth configuration'],
    [
      'Interactions catalog',
      `plitzi://interactions/${env}`,
      'Interaction actions (observed, grouped by node type) plus built-in globalCallbacks with their source module ' +
        'and full param schema — the vocabulary for upsertInteractionFlow'
    ],
    [
      'Data sources catalog',
      `plitzi://data-sources/${env}`,
      'Data-source paths and binding targets observed in this space — the vocabulary for upsertBinding'
    ],
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
    [
      'Page styles',
      `plitzi://schema/${env}/pages/{ref}/styles`,
      'Every style a page uses in one read: class definitions its elements attach (with CSS) + global styles'
    ],
    ['Element', `plitzi://schema/${env}/elements/{ref}`, 'One element in full detail (props, style) by ref or id'],
    ['Folder', `plitzi://folders/${env}/{ref}`, 'One page folder (name, slug, parentId) by folder id'],
    ['Style definition', `plitzi://definitions/${env}/{ref}`, 'One style definition (CSS) by class ref'],
    [
      'Global style',
      `plitzi://global-styles/${env}/{componentType}`,
      'The site-wide CSS applied to every element of one type'
    ],
    ['Id style', `plitzi://id-styles/${env}/{targetId}`, 'The CSS of an id rule (#id) targeting a single element'],
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
