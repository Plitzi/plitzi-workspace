import { BODYLESS_METHODS, CONNECTOR_HTTP_METHODS } from './constants';
import { connectorTokens } from './manifestTokens';

import type { ConnectorTokenScope } from './manifestTokens';

/**
 * The one connector-manifest validator.
 *
 * Three places decide whether a manifest is fit to store — the builder panel, the MCP write ops and the GraphQL
 * mutation that persists it — and a manifest is only ever wrong in one way, so the rules live here rather than
 * being restated (and drifting) at each entry point. The server runs it last, on whatever JSON actually arrived,
 * which is why the input is `unknown`: it validates a document, it does not assume one.
 *
 * Errors are what the engine cannot recover from at request time; warnings are what will work but probably does
 * not do what the author meant. Nothing here reaches the network — it is a pure inspection of the document.
 */

export type ConnectorManifestIssue = {
  /** Dotted path into the manifest, e.g. `endpoints.read.list.path`. */
  path: string;
  message: string;
  hint?: string;
};

export type ConnectorManifestReport = {
  valid: boolean;
  errors: ConnectorManifestIssue[];
  warnings: ConnectorManifestIssue[];
};

const PAGINATIONS = ['offset', 'page', 'cursor'];

const FIELD_TYPES = [
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
];

const TOKEN = /\{\{\s*([^}]+?)\s*\}\}/g;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isFilledString = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';

/** An arbitrary value quoted into a message. JSON so an object shows its shape rather than "[object Object]",
 *  which would tell the author nothing about what they actually wrote. */
const shown = (value: unknown): string => (typeof value === 'string' ? value : JSON.stringify(value));

/** Every token a template references, by name. A namespaced token (`credential.token`) keeps its full path so the
 *  caller can match it against the `credential.` namespace the engine binds. */
const tokensIn = (template: string): string[] => [...template.matchAll(TOKEN)].map(match => match[1]);

/** Whether the engine binds `token` in this scope: an exact name, or any key under a declared namespace. */
const isKnownToken = (token: string, scope: ConnectorTokenScope): boolean =>
  connectorTokens.some(known => {
    if (!known.scopes.includes(scope)) {
      return false;
    }

    return known.value.endsWith('.') ? token.startsWith(known.value) : token === known.value;
  });

type Collector = {
  errors: ConnectorManifestIssue[];
  warnings: ConnectorManifestIssue[];
  /** Every template string in the document, so the credential and token checks read it once. */
  templates: { path: string; value: string; scope: ConnectorTokenScope }[];
};

const error = (acum: Collector, path: string, message: string, hint?: string): void => {
  acum.errors.push({ path, message, ...(hint === undefined ? {} : { hint }) });
};

const warn = (acum: Collector, path: string, message: string, hint?: string): void => {
  acum.warnings.push({ path, message, ...(hint === undefined ? {} : { hint }) });
};

/** Validates a `Record<string, string>` field (headers, query, body, operators) and collects its templates. */
const checkTemplateMap = (
  acum: Collector,
  value: unknown,
  path: string,
  scope: ConnectorTokenScope
): Record<string, unknown> | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    error(acum, path, 'Must be an object of string values', 'Each entry is one name and its templated value');

    return undefined;
  }

  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== 'string') {
      error(acum, `${path}.${key}`, 'Must be a string', 'Values are Twig templates the server renders per request');
      continue;
    }

    acum.templates.push({ path: `${path}.${key}`, value: entry, scope });
  }

  return value;
};

const checkMethod = (acum: Collector, value: unknown, path: string, required: boolean): string | undefined => {
  if (value === undefined) {
    if (required) {
      error(acum, path, 'A write endpoint must declare its method', `One of ${CONNECTOR_HTTP_METHODS.join(', ')}`);
    }

    return undefined;
  }

  if (typeof value !== 'string' || !CONNECTOR_HTTP_METHODS.includes(value as (typeof CONNECTOR_HTTP_METHODS)[number])) {
    error(acum, path, `"${shown(value)}" is not an HTTP method`, `One of ${CONNECTOR_HTTP_METHODS.join(', ')}`);

    return undefined;
  }

  return value;
};

const checkPath = (acum: Collector, endpoint: Record<string, unknown>, path: string, scope: ConnectorTokenScope) => {
  if (!isFilledString(endpoint.path)) {
    error(acum, `${path}.path`, 'An endpoint needs a path', 'It is appended to baseUrl, e.g. "/api/{{resource}}"');

    return;
  }

  acum.templates.push({ path: `${path}.path`, value: endpoint.path, scope });
};

const checkPagination = (acum: Collector, value: unknown, path: string): string | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || !PAGINATIONS.includes(value)) {
    error(acum, path, `"${shown(value)}" is not a paging style`, `One of ${PAGINATIONS.join(', ')}`);

    return undefined;
  }

  return value;
};

/** One read endpoint: the request it makes, plus whether its paging style can actually address a window. */
const checkReadEndpoint = (acum: Collector, name: string, value: unknown, fallbackPaging: string | undefined): void => {
  const path = `endpoints.read.${name}`;
  if (!isRecord(value)) {
    error(acum, path, 'A read endpoint must be an object', 'It declares at least a path');

    return;
  }

  checkPath(acum, value, path, 'request');
  const method = checkMethod(acum, value.method, `${path}.method`, false) ?? 'GET';
  const query = checkTemplateMap(acum, value.query, `${path}.query`, 'request');
  checkTemplateMap(acum, value.headers, `${path}.headers`, 'request');
  const body = checkTemplateMap(acum, value.body, `${path}.body`, 'request');
  const paging = checkPagination(acum, value.pagination, `${path}.pagination`) ?? fallbackPaging;

  if (body && BODYLESS_METHODS.includes(method)) {
    warn(
      acum,
      `${path}.body`,
      `A ${method} request carries no body, so this one is never sent`,
      'Move these values into `query`, or read through POST if the provider expects a body'
    );
  }

  if (paging === undefined) {
    return;
  }

  // Paging that the request never expresses returns the same window forever — a "load more" that repeats page one.
  const rendered = JSON.stringify({ path: value.path, query: query ?? {}, body: body ?? {} });
  const needed = { offset: '{{offset}}', page: '{{page}}', cursor: '{{cursor}}' }[paging];
  if (needed !== undefined && !rendered.includes(needed)) {
    warn(
      acum,
      `${path}.query`,
      `"${name}" pages by ${paging} but never uses ${needed}, so every page resolves to the first one`,
      `Put ${needed} in the query (or the path) this endpoint sends`
    );
  }
};

const checkWriteEndpoint = (acum: Collector, name: string, value: unknown): void => {
  const path = `endpoints.write.${name}`;
  if (!isRecord(value)) {
    error(acum, path, 'A write endpoint must be an object', 'It declares at least a method and a path');

    return;
  }

  checkPath(acum, value, path, 'write');
  checkMethod(acum, value.method, `${path}.method`, true);
  checkTemplateMap(acum, value.query, `${path}.query`, 'write');
  checkTemplateMap(acum, value.headers, `${path}.headers`, 'write');
  if (value.bodyPath !== undefined && typeof value.bodyPath !== 'string') {
    error(acum, `${path}.bodyPath`, 'Must be a string', 'It names where to nest the values, e.g. "data"');
  }
};

const checkEndpoints = (acum: Collector, value: unknown, fallbackPaging: string | undefined): void => {
  if (!isRecord(value)) {
    error(acum, 'endpoints', 'A connector must declare its endpoints', 'At least one read endpoint, usually "list"');

    return;
  }

  if (!isRecord(value.read) || Object.keys(value.read).length === 0) {
    error(
      acum,
      'endpoints.read',
      'A connector needs at least one read endpoint',
      'Name it "list" — that is the one a provider element addresses when it names none'
    );
  } else {
    for (const [name, endpoint] of Object.entries(value.read)) {
      checkReadEndpoint(acum, name, endpoint, fallbackPaging);
    }
  }

  if (value.write === undefined) {
    return;
  }

  if (!isRecord(value.write)) {
    error(acum, 'endpoints.write', 'Must be an object of endpoints keyed by name', 'Omit it for a read-only connector');

    return;
  }

  for (const [name, endpoint] of Object.entries(value.write)) {
    checkWriteEndpoint(acum, name, endpoint);
  }
};

const checkAuth = (acum: Collector, value: unknown): void => {
  if (value === undefined) {
    return;
  }

  if (!isRecord(value)) {
    error(acum, 'auth', 'Must be an object', 'Shape: { in, name, value }');

    return;
  }

  if (value.in !== 'header' && value.in !== 'query') {
    error(acum, 'auth.in', 'Auth travels in a header or a query parameter', 'One of header, query');
  }

  if (!isFilledString(value.name)) {
    error(acum, 'auth.name', 'Auth needs the name it is sent under', 'e.g. "Authorization" for a bearer token');
  }

  if (typeof value.value !== 'string') {
    error(acum, 'auth.value', 'Must be a string', 'A template, e.g. "Bearer {{credential.token}}"');

    return;
  }

  acum.templates.push({ path: 'auth.value', value: value.value, scope: 'request' });
};

/** Operator templates render one `key=value` query entry. One without `=` is dropped by the engine, which turns a
 *  filtered query into an unfiltered one — the wrong records, silently — so it is an error, not a warning. */
const checkOperators = (acum: Collector, value: unknown): void => {
  const operators = checkTemplateMap(acum, value, 'operators', 'filter');
  if (!operators) {
    return;
  }

  for (const [name, template] of Object.entries(operators)) {
    if (typeof template === 'string' && !template.includes('=')) {
      error(
        acum,
        `operators.${name}`,
        `Operator "${name}" renders no "key=value" pair, so a filter using it is dropped`,
        'Write the full query entry, e.g. "filters[{{field}}][$eq]={{value}}"'
      );
    }
  }
};

const checkFields = (acum: Collector, value: unknown): void => {
  if (value === undefined) {
    return;
  }

  if (!isRecord(value)) {
    error(acum, 'fields', 'Must be an object of field name → type', `Types: ${FIELD_TYPES.join(', ')}`);

    return;
  }

  for (const [name, type] of Object.entries(value)) {
    if (typeof type !== 'string' || !FIELD_TYPES.includes(type)) {
      error(acum, `fields.${name}`, `"${shown(type)}" is not a field type`, `One of ${FIELD_TYPES.join(', ')}`);
    }
  }
};

/**
 * Credential and token checks, run once over every template the document holds.
 *
 * A manifest that reads `{{credential.…}}` without naming a credential is a WARNING, not an error: the author of a
 * manifest and the holder of the secret are routinely not the same person (an agent writes the integration, the
 * space owner attaches the token), so the document has to be storable before the credential exists. What it must
 * not do is fail silently later — an unresolved credential authenticates as nobody and the provider answers 401,
 * which reads from the page as "the CMS is down".
 */
const checkTemplates = (acum: Collector, credential: unknown): void => {
  let usesCredential = false;
  for (const template of acum.templates) {
    for (const token of tokensIn(template.value)) {
      if (token.startsWith('credential.')) {
        usesCredential = true;
      }

      if (!isKnownToken(token, template.scope)) {
        warn(
          acum,
          template.path,
          `{{${token}}} is not a value the engine binds here, so it renders empty`,
          `Tokens available in this position: ${connectorTokens
            .filter(known => known.scopes.includes(template.scope))
            .map(known => known.value)
            .join(', ')}`
        );
      }
    }
  }

  if (usesCredential && !isFilledString(credential)) {
    warn(
      acum,
      'credential',
      'This manifest reads {{credential.…}} but names no credential, so every request goes unauthenticated',
      'The connector still saves. Ask the space owner to create the credential and attach it — the secret is ' +
        'never part of the manifest.'
    );

    return;
  }

  if (!usesCredential && isFilledString(credential)) {
    warn(
      acum,
      'credential',
      'A credential is attached but no template reads {{credential.…}}, so it is never sent',
      'Reference it where the provider expects it, e.g. auth.value = "Bearer {{credential.token}}"'
    );
  }
};

/**
 * Validates a connector manifest document (a `ConnectorManifestDraft`; a stored `id` is ignored).
 *
 * Give it whatever you have — parsed JSON, an editor's working copy, a GraphQL argument. It never throws.
 */
export const validateConnectorManifest = (input: unknown): ConnectorManifestReport => {
  const acum: Collector = { errors: [], warnings: [], templates: [] };
  if (!isRecord(input)) {
    return {
      valid: false,
      errors: [{ path: '', message: 'A manifest must be an object', hint: 'It declares baseUrl and endpoints' }],
      warnings: []
    };
  }

  if (!isFilledString(input.baseUrl)) {
    error(acum, 'baseUrl', 'A connector needs a base URL', 'The origin every endpoint path is appended to');
  } else if (!/^https?:\/\//.test(input.baseUrl)) {
    error(acum, 'baseUrl', 'Base URL must start with http:// or https://', 'The engine resolves paths against it');
  }

  if (input.credential !== undefined && typeof input.credential !== 'string') {
    error(acum, 'credential', 'Must be the identifier of a stored credential', 'The secret itself never goes here');
  }

  const paging = checkPagination(acum, input.pagination, 'pagination');
  checkAuth(acum, input.auth);
  checkTemplateMap(acum, input.headers, 'headers', 'request');
  checkEndpoints(acum, input.endpoints, paging);
  checkOperators(acum, input.operators);
  checkFields(acum, input.fields);

  if (input.media !== undefined) {
    if (!isRecord(input.media)) {
      error(acum, 'media', 'Must be an object', 'Shape: { baseUrl }');
    } else if (input.media.baseUrl !== undefined && !isFilledString(input.media.baseUrl)) {
      error(acum, 'media.baseUrl', 'Must be a non-empty string', 'The origin relative media paths are rebased onto');
    }
  }

  if (input.projection !== undefined && input.projection !== 'full') {
    error(acum, 'projection', 'The only projection is "full"', 'Omit it to send only the paths the page binds');
  }

  checkTemplates(acum, input.credential);

  return { valid: acum.errors.length === 0, errors: acum.errors, warnings: acum.warnings };
};
