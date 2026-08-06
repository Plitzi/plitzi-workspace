import type { CollectionField } from './CollectionTypes';

/** How the provider walks result windows. Cursor providers echo their own token back through `nextCursor`. */
export type ConnectorPagination = 'offset' | 'page' | 'cursor';

export type ConnectorAuth = {
  in: 'header' | 'query';
  name: string;
  /** Template resolved against the credential, e.g. `Bearer {{credential.token}}`. */
  value: string;
};

export type ConnectorListEndpoint = {
  /** Template appended to `baseUrl`, e.g. `/api/{{resource}}`. */
  path: string;
  /** Query parameters, values templated. Entries resolving to empty are dropped. */
  query?: Record<string, string>;
  /** Where the records array lives in the response. Omitted means the response is the array. */
  itemsPath?: string;
  /** Where the total count lives. Omitted means the count is unknown and paging relies on page size. */
  totalPath?: string;
  /** Where a record's id lives, relative to the record. Defaults to `id`. */
  idPath?: string;
  /** Where a record's values live, relative to the record. `.` (default) means the record itself. */
  valuesPath?: string;
};

export type ConnectorWriteAction = 'create' | 'update' | 'delete';

export type ConnectorWriteOperation = {
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Template appended to `baseUrl`, e.g. `/api/{{resource}}/{{id}}`. */
  path: string;
  /** Wraps the submitted values, e.g. `data` produces `{ "data": { … } }`. Omitted sends them at the root. */
  bodyPath?: string;
};

/**
 * Write operations a connector exposes. Absent means read-only: an undeclared action is refused rather than
 * guessed, so a provider never gets written to by accident.
 */
export type ConnectorWrite = Partial<Record<ConnectorWriteAction, ConnectorWriteOperation>>;

/**
 * Every request the connector knows how to make, grouped under one key.
 *
 * They are nested rather than sitting beside `auth`, `operators` and `media` because those describe the connection
 * and apply to every call, while these describe individual calls. Flat, the two kinds read as peers and there is no
 * obvious place to add the next operation.
 */
export type ConnectorEndpoints = {
  list: ConnectorListEndpoint;
  write?: ConnectorWrite;
};

/**
 * A connector is data, not code: everything a provider needs is declared here and interpreted by the engine, so
 * adding a CMS never means shipping a new adapter. This document is server-side state — it names endpoints and an
 * auth scheme and must never reach the browser.
 *
 * It lives in shared types because the builder authors the same document the server executes; keeping two copies in
 * step by hand is how a manifest ends up describing an endpoint that the engine does not read.
 */
export type ConnectorManifest = {
  id: string;
  /** Identifier of the credential to resolve. The secret itself is never part of the manifest. */
  credential?: string;
  baseUrl: string;
  auth?: ConnectorAuth;
  /** Static headers, values templated. */
  headers?: Record<string, string>;
  endpoints: ConnectorEndpoints;
  pagination?: ConnectorPagination;
  /** Operator templates keyed by operator name, e.g. `{ eq: 'filters[{{field}}][$eq]={{value}}' }`. */
  operators?: Record<string, string>;
  /** Base for relative media URLs returned by the provider. See `rebaseMedia` for exactly which values it rewrites. */
  media?: { baseUrl?: string };
  /** Field types, the only part of a connector the browser is allowed to see (it drives typed bindings). */
  fields?: Record<string, CollectionField['type']>;
  /** Escape hatch for data feeding templates whose bound paths cannot be determined statically. */
  projection?: 'full';
};

/**
 * What the builder authors.
 *
 * `id` is missing on purpose: a connector's identity belongs to the row that stores it, and a document that carries
 * its own id can disagree with the one it was fetched by. The store stamps it on read.
 */
export type ConnectorManifestDraft = Omit<ConnectorManifest, 'id'>;

export type ConnectorFilter = {
  field: string;
  operator: string;
  value: string | number | boolean;
};

export type ConnectorQuery = {
  /** Content type / collection name substituted into the path template. */
  resource?: string;
  limit?: number;
  offset?: number;
  page?: number;
  cursor?: string;
  filters?: ConnectorFilter[];
  routeParams?: Record<string, string | undefined>;
  queryParams?: Record<string, string>;
};

export type ConnectorRecord = {
  id: string;
  values: Record<string, unknown>;
};

/** Resolved credential material. Values are interpolated into templates as `{{credential.<key>}}`. */
export type ConnectorCredential = Record<string, string>;
