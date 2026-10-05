import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';

import { resourceErrorMessage } from './canonical';
import { envelope, jsonContents } from './envelope';
import { EXPLAIN_URI_TEMPLATE, explainResource } from './explain';
import { registerRenderResources } from './renderGuide';
import { readResource } from './router';
import { cssProperties, cssShorthands } from '../catalogs';
import { guideText } from '../helpers/guide';
import { changesUri } from '../helpers/uris';

import type { McpLog } from '../helpers';
import type { Space } from '../helpers';
import type { Env } from '../types';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SSRChangePage, SSRChangeQuery } from '@plitzi/sdk-shared';

/** A page an agent can read in one go: each change carries whole elements before and after. */
const CHANGES_PAGE = 20;

/** Register every resource on the MCP server: fixed listings plus templated per-item reads. The space is
 *  loaded lazily via getSpace, so listing resources never touches the store — only reading one does.
 *
 *  `hasSpace` is false when the connection reaches no space (a guest / widgets-only grant): the space-dependent
 *  families are then not registered at all, so the catalog the agent browses holds only what it can actually
 *  open — no listing that answers every read with the same refusal. */
export const registerResources = (
  server: McpServer,
  getSpace: () => Promise<Space>,
  env: Env,
  log: McpLog,
  hasSpace: boolean,
  readChanges?: (query: SSRChangeQuery) => Promise<SSRChangePage>
): void => {
  const emit = async (uri: string) => {
    const start = performance.now();
    try {
      const result = readResource(await getSpace(), env, uri);
      if (!result) {
        throw new Error(resourceErrorMessage(env, uri));
      }

      log.resourceRead(uri, performance.now() - start);

      return jsonContents(uri, result);
    } catch (error) {
      log.resourceRead(uri, performance.now() - start, error);
      throw error;
    }
  };

  // Public, space-independent resources: served straight from static data so they resolve no spaceId and load
  // no space — reachable even on an unauthenticated connection. They cannot go through `emit` (it loads the
  // space), so they log their own read: the log names the URI a client asked for, whether or not it needed a space.
  const emitStatic = <T>(uri: string, read: () => T): T => {
    const start = performance.now();
    const result = read();
    log.resourceRead(uri, performance.now() - start);

    return result;
  };

  server.registerResource(
    'Guide',
    'plitzi://guide',
    { description: 'How to read and write this space with mcp-ai', mimeType: 'text/markdown' },
    () =>
      emitStatic('plitzi://guide', () => ({
        contents: [{ uri: 'plitzi://guide', mimeType: 'text/markdown', text: guideText }]
      }))
  );

  server.registerResource(
    'CSS properties',
    'plitzi://css-properties',
    {
      description: 'Valid kebab-case CSS property keys, plus the shorthands that are accepted and auto-expanded',
      mimeType: 'application/json'
    },
    () =>
      emitStatic('plitzi://css-properties', () =>
        jsonContents('plitzi://css-properties', envelope({ properties: cssProperties, shorthands: cssShorthands }))
      )
  );

  // What a name means when authoring — an element, a step, a trigger, a problem's code, a transformer — from the
  // catalogues the checks read; a kind's plural (`steps`) lists every one of it. The CLI's `plitzi explain`, as a read.
  server.registerResource(
    'Explain',
    new ResourceTemplate(EXPLAIN_URI_TEMPLATE, { list: undefined }),
    {
      description:
        'What a name means when authoring: an element (container), a step (navigate), a trigger (onScroll), a problem code ' +
        '(class-and-css) or a transformer — or every one of a kind: elements, steps, triggers, codes, transformers',
      mimeType: 'application/json'
    },
    (uri: URL) => emitStatic(uri.href, () => jsonContents(uri.href, envelope(explainResource(uri.href))))
  );

  // How to author a plitzi_render widget (guide + usable element-type catalog) — public, so a conversational agent
  // holding only that tool can read them.
  registerRenderResources(server, log);

  if (!hasSpace) {
    return;
  }

  // Space-dependent listings: reading any of these resolves the spaceId and loads the space via getSpace.
  const fixed: Array<[string, string, string]> = [
    [
      'Primer',
      `plitzi://primer/${env}`,
      'Read this FIRST. Cold-start bundle in one call: the guide’s quickstart, types, css-properties and SUMMARIES of pages, ' +
        'definitions and variables — summaries only, never full page/element trees, so it stays small even on a ' +
        'large space. Open a page or element on demand afterwards.'
    ],
    ['Element types', 'plitzi://types', 'Observed element types with props, slots and subTypes'],
    ['Pages', `plitzi://schema/${env}/pages`, 'Page summaries (ref, label, elementCount) — no element trees'],
    [
      'Layouts',
      `plitzi://schema/${env}/layouts`,
      'Shared layout shells (header/sidebar/footer) and the pages rendered inside each — read one as a page'
    ],
    ['Folders', `plitzi://folders/${env}`, 'Page folders (the sidebar tree): ref, name, slug, parentId'],
    ['Style definitions', `plitzi://definitions/${env}`, 'Style definition refs (names)'],
    ['Global styles', `plitzi://global-styles/${env}`, 'Element types that have a site-wide global style'],
    ['Id styles', `plitzi://id-styles/${env}`, 'DOM ids that have an id rule (#id) targeting a single element'],
    ['Style variables', `plitzi://style-variables/${env}`, 'Design tokens by category'],
    ['Fonts', `plitzi://fonts/${env}`, 'The font families the space loads, with their source and fallback'],
    ['Schema variables', `plitzi://schema-variables/${env}`, 'Space-level values referenced via {{name}}'],
    [
      'Feature flags',
      `plitzi://flags/${env}`,
      'The feature flags the space declares, each a default and its rules: read as {{ flags.<name> }}, named by the ' +
        '`flag` of an element or a page'
    ],
    ['Settings', `plitzi://settings/${env}`, 'Space-level settings: global customCss and state/auth configuration'],
    [
      'Interactions catalog',
      `plitzi://interactions/${env}`,
      'Interaction actions (observed, grouped by node type) plus the built-in vocabularies — globalCallbacks (with ' +
        'their source module), element callbacks and utilities — each with its full param schema, the vocabulary ' +
        'for upsertInteractionFlow'
    ],
    [
      'Data sources catalog',
      `plitzi://data-sources/${env}`,
      'Data-source paths and binding targets observed in this space — the vocabulary for upsertBinding'
    ],
    [
      'Connector presets',
      'plitzi://connector-presets',
      'Working starting manifests for Strapi, WordPress, Directus, Contentful and a plain REST API, plus every ' +
        'template token the connector engine binds — read this before writing a connector by hand'
    ],
    [
      'Connectors',
      `plitzi://connectors/${env}`,
      'Server-side CMS/API connectors configured for this space: each with the read/write endpoints it can ' +
        'address, the filter operators it accepts and the fields it publishes — what a server-rendered ' +
        'apiContainer points at'
    ],
    [
      'Server tasks',
      `plitzi://actions/${env}/tasks`,
      'The steps a server action can be built from on THIS deployment: each with its parameters — read before ' +
        'authoring a flow, since a task this server does not have cannot run'
    ],
    [
      'Server actions',
      `plitzi://actions/${env}`,
      'Server actions this space runs: what starts each one, who may run it, and the input/output contract a ' +
        'caller is held to — what a runServerAction step points at'
    ],
    [
      'Functions',
      `plitzi://functions/${env}`,
      'The space’s own server code: which files it is, and the tasks, routes and hosts it declares — its tasks are ' +
        'steps like any server task'
    ],
    [
      'Data',
      `plitzi://data/${env}`,
      'The space’s own data: JSON files its server providers read as `/data/<file>`, never served — which files there are'
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
  // The history is not part of the space document, so it is read through its own adapter rather than `emit`.
  if (readChanges) {
    const emitChanges = async (uri: string, query: SSRChangeQuery) => {
      const start = performance.now();
      try {
        const page = await readChanges(query);
        log.resourceRead(uri, performance.now() - start);

        return jsonContents(uri, { data: page });
      } catch (error) {
        log.resourceRead(uri, performance.now() - start, error);
        throw error;
      }
    };

    server.registerResource(
      'Change history',
      changesUri(env),
      {
        description:
          'Read-only: the latest changes to this space, newest first — who made each (a person, an agent, the autofix), ' +
          'from where, and every element, class or token it touched, whole, before and after',
        mimeType: 'application/json'
      },
      () => emitChanges(changesUri(env), { limit: CHANGES_PAGE })
    );
    server.registerResource(
      'Change history of one entity',
      new ResourceTemplate(`${changesUri(env)}/{id}`, { list: undefined }),
      {
        description: 'Read-only: the changes that touched one element, class, token or font, newest first',
        mimeType: 'application/json'
      },
      (uri: URL, { id }) => emitChanges(uri.href, { entityId: decodeURIComponent(String(id)), limit: CHANGES_PAGE })
    );
  }

  for (const [name, uri, description] of fixed) {
    server.registerResource(name, uri, { description, mimeType: 'application/json' }, () => emit(uri));
  }

  const templates: Array<[string, string, string]> = [
    [
      'Page',
      `plitzi://schema/${env}/pages/{ref}`,
      'One page (or LAYOUT shell) as a skeleton tree (ref/type/label/children), no props'
    ],
    [
      'Page styles',
      `plitzi://schema/${env}/pages/{ref}/styles`,
      'Every style a page uses in one read: class definitions its elements attach (with CSS) + global styles'
    ],
    ['Element', `plitzi://schema/${env}/elements/{ref}`, 'One element in full detail (props, style), by name'],
    ['Folder', `plitzi://folders/${env}/{ref}`, 'One page folder (name, slug, parentId) by folder id'],
    [
      'Connector',
      `plitzi://connectors/${env}/{ref}`,
      'One connector manifest in full: baseUrl, auth template, every read/write endpoint and its response mapping'
    ],
    [
      'Server action',
      `plitzi://actions/${env}/{ref}`,
      'One action document in full: its access rule, triggers, declared credentials and connectors, and every step'
    ],
    ['Function file', `plitzi://functions/${env}/{+path}`, 'One file of the space’s functions, whole'],
    ['Data file', `plitzi://data/${env}/{+path}`, 'One file of the space’s data, parsed'],
    ['Style definition', `plitzi://definitions/${env}/{ref}`, 'One style definition (CSS) by class ref'],
    [
      'Global style',
      `plitzi://global-styles/${env}/{componentType}`,
      'The site-wide CSS applied to every element of one type'
    ],
    ['Id style', `plitzi://id-styles/${env}/{targetId}`, 'The CSS of an id rule (#id) targeting a single element'],
    ['Style variables by category', `plitzi://style-variables/${env}/{category}`, 'Design tokens for one category'],
    ['Font', `plitzi://fonts/${env}/{family}`, 'One font family the space loads: its source, fallback and files'],
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
