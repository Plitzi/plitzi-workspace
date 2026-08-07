import type { CollectionField } from './CollectionTypes';

/** How the provider walks result windows. Cursor providers echo their own token back through `nextCursor`. */
export type ConnectorPagination = 'offset' | 'page' | 'cursor';

export type ConnectorAuth = {
  in: 'header' | 'query';
  name: string;
  /** Template resolved against the credential, e.g. `Bearer {{credential.token}}`. */
  value: string;
};

/** Where a read endpoint's records and counts sit inside this provider's response. */
export type ConnectorResponseMapping = {
  /** Where the records array lives in the response. Omitted means the response is the array. */
  itemsPath?: string;
  /** Where the total count lives. Omitted means the count is unknown and paging relies on page size. */
  totalPath?: string;
  /** Where a record's id lives, relative to the record. Defaults to `id`. */
  idPath?: string;
  /** Where a record's values live, relative to the record. `.` (default) means the record itself. */
  valuesPath?: string;
};

/**
 * The HTTP verb an endpoint uses.
 *
 * The full REST vocabulary, on both reads and writes: what separates the two is what the endpoint is *for* — only
 * writes are reachable through `/_action` — not which verb it happens to use. Search reads through POST, upsert
 * writes through PUT, and an integration that cannot say so is a CMS client, not a REST one.
 */
export type ConnectorHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/** A request that returns records. */
export type ConnectorReadEndpoint = ConnectorResponseMapping & {
  /** Template appended to `baseUrl`, e.g. `/api/{{resource}}`. */
  path: string;
  /** Defaults to `GET`. Any verb is allowed: reading through POST is how most search endpoints work. */
  method?: ConnectorHttpMethod;
  /** Query parameters, values templated. Entries resolving to empty are dropped. */
  query?: Record<string, string>;
  /** Headers for this endpoint only, merged over the connection's own. */
  headers?: Record<string, string>;
  /** Body sent when `method` is POST. Values are templated; `{{values}}` carries the submitted record. */
  body?: Record<string, string>;
  /** Paging style for this endpoint, when it differs from the connection default. */
  pagination?: ConnectorPagination;
};

/**
 * A request that changes something.
 *
 * Writes are a separate map from reads rather than one map keyed by method: only these are reachable through
 * `/_action`, so a read can never be invoked as a mutation, and a write can never be mounted as a data source.
 */
export type ConnectorWriteEndpoint = {
  method: ConnectorHttpMethod;
  /** Template appended to `baseUrl`, e.g. `/api/{{resource}}/{{id}}`. */
  path: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  /** Wraps the submitted values, e.g. `data` produces `{ "data": { … } }`. Omitted sends them at the root. */
  bodyPath?: string;
  /** Where the written record sits in the response, when the caller wants it back. */
  response?: ConnectorResponseMapping;
};

/**
 * Every request the connector knows how to make, named by the author.
 *
 * Both sides are open maps, not a fixed `list` plus `create`/`update`/`delete`: a connector is a declarative REST
 * client, and an API has as many operations as it has. The CMS case is just the one where the read is called
 * `list` and the writes happen to be named after CRUD.
 *
 * They are nested under `endpoints` rather than sitting beside `auth`, `operators` and `media` because those
 * describe the connection and apply to every call, while these describe individual calls.
 */
export type ConnectorEndpoints = {
  read: Record<string, ConnectorReadEndpoint>;
  /** Absent or empty means read-only: an undeclared write is refused rather than guessed. */
  write?: Record<string, ConnectorWriteEndpoint>;
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

/**
 * A connector as a server-side reader hands it over: the identity a provider element stores, the human name, and
 * the manifest itself.
 *
 * Distinct from the builder's `SpaceConnector`, which also carries the storage row's numeric id and timestamps —
 * a reader that had to invent those could answer from nothing but the database, and the MCP writes connectors
 * through the same shape it reads them by.
 */
export type ConnectorEntry = {
  /** The identifier a provider element stores in its `connector` attribute. Unique within the space. */
  id: string;
  name: string;
  manifest: ConnectorManifest;
};

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
