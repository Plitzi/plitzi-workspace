/**
 * Values shared by the builder and the engine.
 *
 * They live here rather than beside the manifest types because they are values, not types: importing them from the
 * package barrel would pull the whole barrel — and plitzi-ui with it — into the server process.
 */

/** The read endpoint an element addresses when it names none. */
export const DEFAULT_READ_ENDPOINT = 'list';

/** The HTTP vocabulary a connector can use. A declarative REST client has no business narrowing it further. */
export const CONNECTOR_HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;

/**
 * Methods that carry no request body.
 *
 * `DELETE` is here because sending a body with one is legal but widely mishandled by servers and proxies; a
 * connector that needs to identify what to delete says so through the path or the query string instead.
 */
export const BODYLESS_METHODS: readonly string[] = ['GET', 'HEAD', 'OPTIONS', 'DELETE'];

/** Methods that return nothing worth mapping, so a write using one resolves to no record. */
export const EMPTY_RESPONSE_METHODS: readonly string[] = ['HEAD', 'OPTIONS', 'DELETE'];

/**
 * Names offered to a new endpoint, in order.
 *
 * A connector's second read is far more often a single-record fetch than anything else, and its third a search —
 * so the panel suggests the name the author was going to type. Past the list it falls back to a numbered name
 * rather than inventing vocabulary nobody asked for.
 */
export const READ_ENDPOINT_NAMES = ['list', 'detail', 'search'] as const;
export const WRITE_ENDPOINT_NAMES = ['create', 'update', 'delete'] as const;
