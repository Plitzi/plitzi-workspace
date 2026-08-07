import { z } from 'zod';

import { CONNECTOR_HTTP_METHODS } from '@plitzi/sdk-shared/connectors';

// The manifest vocabulary as an agent authors it, mirroring ConnectorManifest in sdk-shared minus its `id` — a
// connector's identity is the ref the op addresses it by, never a field inside the document it carries.
//
// It is split the way the manifest itself is: `connection` describes the link and applies to every call, while
// `endpoints` describes individual calls. That split is also what keeps the op union small — both connector ops
// reference these same three schemas, so the tool listing carries each shape once instead of four times (see
// schemaIds.ts; they are registered there).
//
// Every string is a Twig template the SERVER renders per request: `{{resource}}` (the collection the element
// names), `{{limit}}` / `{{offset}}` / `{{page}}` / `{{cursor}}` (the window), `{{routeParams.x}}` and
// `{{queryParams.x}}` (the visitor's URL), `{{credential.x}}` (the resolved secret), plus `{{id}}` and
// `{{values}}` on writes. The full vocabulary is in plitzi://guide.

const templated = z.record(z.string(), z.string());

const pagination = z.enum(['offset', 'page', 'cursor']);

const httpMethod = z.enum(CONNECTOR_HTTP_METHODS);

const responseMapping = {
  itemsPath: z.string().optional().describe('Where the records array lives, e.g. "data". Omit if the response IS it'),
  totalPath: z.string().optional().describe('Where the total count lives, e.g. "meta.pagination.total"'),
  idPath: z.string().optional().describe('Where a record id lives, relative to the record. Default "id"'),
  valuesPath: z.string().optional().describe('Where a record fields live, e.g. "attributes". Default "." (itself)')
};

export const readEndpoint = z
  .object({
    path: z.string().describe('Appended to baseUrl, templated, e.g. "/api/{{resource}}"'),
    method: httpMethod.optional().describe('Default GET. Reading through POST is how most search endpoints work'),
    query: templated.optional().describe('Query parameters. An entry resolving to empty is dropped'),
    headers: templated.optional(),
    body: templated.optional().describe('Sent only by methods that carry one (POST/PUT/PATCH)'),
    pagination: pagination.optional().describe('Paging for this endpoint when it differs from the connection default'),
    ...responseMapping
  })
  .describe('A request returning records. Only reads can feed an element');

export const writeEndpoint = z
  .object({
    method: httpMethod,
    path: z.string().describe('Appended to baseUrl, templated, e.g. "/api/{{resource}}/{{id}}"'),
    query: templated.optional(),
    headers: templated.optional(),
    bodyPath: z.string().optional().describe('Nests the values, e.g. "data" sends { "data": { … } }. Omit for root'),
    response: z.object(responseMapping).optional().describe('Where the written record sits in the response')
  })
  .describe('A request that CHANGES something. Reachable only through the writeRecord callback, never as a source');

/**
 * Everything that describes the link rather than one call.
 *
 * All optional, and the same schema serves both ops: on an upsert these are the connection to store, on a patch
 * the parts of it to change.
 */
export const connectorConnection = z
  .object({
    credential: z
      .string()
      .optional()
      .describe(
        'Identifier of the stored secret to resolve into {{credential.*}}. YOU DO NOT CREATE OR SEE CREDENTIALS: ' +
          'the space owner does, in the builder. Leave it unset unless the user gave you the identifier — the ' +
          'connector still saves, and its requests go unauthenticated until they attach one.'
      ),
    auth: z
      .object({
        in: z.enum(['header', 'query']),
        name: z.string().describe('Header or query-parameter name, e.g. "Authorization"'),
        value: z.string().describe('Template, e.g. "Bearer {{credential.token}}"')
      })
      .optional()
      .describe('How every request authenticates. The secret is never here — {{credential.x}} resolves it'),
    headers: templated.optional().describe('Static headers sent on every request'),
    pagination: pagination.optional().describe('Default paging style: offset+limit, page numbers, or an opaque cursor'),
    operators: templated
      .optional()
      .describe(
        'Filter operators, each rendering ONE "key=value" query entry from {{field}} and {{value}}, e.g. ' +
          '{ "eq": "filters[{{field}}][$eq]={{value}}" }. A filter naming an operator not declared here is DROPPED.'
      ),
    mediaBaseUrl: z.string().optional().describe('Origin prepended to relative media paths (keys ending url/src/href)'),
    fields: z
      .record(
        z.string(),
        z.enum([
          'text',
          'richText',
          'image',
          'multiImage',
          'video',
          'link',
          'email',
          'phone',
          'number',
          'date',
          'switch',
          'color',
          'option',
          'file'
        ])
      )
      .optional()
      .describe('Field types published to the builder for typed bindings. The only part a browser ever sees'),
    projection: z
      .literal('full')
      .optional()
      .describe('Send every field instead of only the bound paths. Costs payload size; only for dynamic templates')
  })
  .describe('Settings that apply to every call this connector makes');

export type ConnectorConnectionInput = z.infer<typeof connectorConnection>;
