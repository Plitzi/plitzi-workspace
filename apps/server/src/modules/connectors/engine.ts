import { processTwig } from '@plitzi/sdk-shared/helpers/twigWrapper';

import { getByPath } from './getByPath';

import type {
  ConnectorCredential,
  ConnectorFilter,
  ConnectorManifest,
  ConnectorQuery,
  ConnectorRecord,
  ConnectorResult,
  ConnectorWriteAction
} from './types';
import type { PageInfo } from '@plitzi/sdk-shared';

const DEFAULT_LIMIT = 10;

export type FetchConnectorOptions = {
  manifest: ConnectorManifest;
  credential?: ConnectorCredential;
  query?: ConnectorQuery;
  /** Injected so tests — and a future edge runtime — can supply their own transport. */
  fetchImpl?: typeof fetch;
};

export type WriteConnectorOptions = {
  manifest: ConnectorManifest;
  credential?: ConnectorCredential;
  action: ConnectorWriteAction;
  resource?: string;
  recordId?: string;
  values?: Record<string, unknown>;
  fetchImpl?: typeof fetch;
};

/** Only scalars can become a URL fragment, a header or a record key. Anything else is treated as absent. */
const toScalar = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return undefined;
};

const render = (template: string, variables: Record<string, unknown>): string =>
  toScalar(processTwig(template, variables)) ?? '';

const renderEntries = (entries: Record<string, string>, variables: Record<string, unknown>) =>
  Object.entries(entries).reduce<Record<string, string>>((acum, [key, template]) => {
    const value = render(template, variables);
    // An unresolved token means the caller did not supply that input; sending the raw parameter would filter on a
    // literal "{{...}}" and silently return the wrong window of data.
    if (value !== '' && !value.includes('{{')) {
      acum[key] = value;
    }

    return acum;
  }, {});

/** Turns a filter into `key=value` query entries through the manifest's operator templates. */
const renderFilters = (
  filters: ConnectorFilter[],
  operators: Record<string, string> | undefined,
  variables: Record<string, unknown>
) =>
  filters.reduce<Record<string, string>>((acum, filter) => {
    const template = operators?.[filter.operator];
    if (!template) {
      return acum;
    }

    const rendered = render(template, { ...variables, field: filter.field, value: filter.value });
    const separator = rendered.indexOf('=');
    if (separator === -1) {
      return acum;
    }

    acum[rendered.slice(0, separator)] = rendered.slice(separator + 1);

    return acum;
  }, {});

/** Builds the outbound headers and, for query-carried schemes, mutates `url` with the auth parameter. */
const applyAuth = (
  manifest: ConnectorManifest,
  variables: Record<string, unknown>,
  url: URL
): Record<string, string> => {
  const headers = renderEntries(manifest.headers ?? {}, variables);
  if (!manifest.auth) {
    return headers;
  }

  const value = render(manifest.auth.value, variables);
  if (manifest.auth.in === 'header') {
    headers[manifest.auth.name] = value;
  } else {
    url.searchParams.set(manifest.auth.name, value);
  }

  return headers;
};

const buildPageInfo = (
  records: ConnectorRecord[],
  total: number | undefined,
  offset: number,
  limit: number,
  nextCursor: string
): PageInfo => {
  const to = offset + records.length;
  const hasNextPage = total === undefined ? records.length === limit : to < total;

  return {
    hasPrevPage: offset > 0,
    hasNextPage,
    prevCursor: '',
    nextCursor: hasNextPage ? nextCursor : '',
    from: offset,
    to,
    total: total ?? to
  };
};

const toRecords = (items: unknown[], manifest: ConnectorManifest): ConnectorRecord[] =>
  items.reduce<ConnectorRecord[]>((acum, item, index) => {
    if (item === null || typeof item !== 'object') {
      return acum;
    }

    const id = toScalar(getByPath(item, manifest.list.idPath ?? 'id'));
    const values = getByPath(item, manifest.list.valuesPath ?? '.');

    acum.push({
      // A provider that returns no usable id still yields addressable records: position within the window is the
      // fallback, so a page can render even when the manifest points at the wrong id field.
      id: id ?? String(index),
      values: values !== null && typeof values === 'object' ? (values as Record<string, unknown>) : {}
    });

    return acum;
  }, []);

/**
 * Executes one connector read and normalizes the response into records + page info.
 *
 * Everything provider-specific — the endpoint, the auth header, where the array lives, how paging is expressed —
 * comes from the manifest, so a new CMS is configuration rather than code.
 */
export const fetchConnectorRecords = async ({
  manifest,
  credential = {},
  query = {},
  fetchImpl = fetch
}: FetchConnectorOptions): Promise<ConnectorResult> => {
  const limit = query.limit ?? DEFAULT_LIMIT;
  const offset = query.offset ?? 0;
  const variables: Record<string, unknown> = {
    credential,
    resource: query.resource ?? '',
    limit,
    offset,
    page: query.page ?? Math.floor(offset / limit) + 1,
    cursor: query.cursor ?? '',
    routeParams: query.routeParams ?? {},
    queryParams: query.queryParams ?? {},
    params: { ...query.queryParams, ...query.routeParams }
  };

  const url = new URL(render(manifest.list.path, variables), manifest.baseUrl);
  Object.entries({
    ...renderEntries(manifest.list.query ?? {}, variables),
    ...renderFilters(query.filters ?? [], manifest.operators, variables)
  }).forEach(([key, value]) => url.searchParams.set(key, value));

  const headers = applyAuth(manifest, variables, url);
  const response = await fetchImpl(url.toString(), { method: 'GET', headers });
  if (!response.ok) {
    throw new Error(`Connector ${manifest.id} responded ${response.status} for ${url.pathname}`);
  }

  const payload: unknown = await response.json();
  const rawItems = getByPath(payload, manifest.list.itemsPath);
  const items = Array.isArray(rawItems) ? rawItems : [];
  const rawTotal = manifest.list.totalPath ? getByPath(payload, manifest.list.totalPath) : undefined;
  const total = typeof rawTotal === 'number' ? rawTotal : undefined;
  const records = toRecords(items, manifest);

  return {
    records,
    pageInfo: buildPageInfo(records, total, offset, limit, String(offset + records.length))
  };
};

/** Nests the payload the way the provider expects it: `data` produces `{ data: values }`. */
const wrapBody = (values: Record<string, unknown>, bodyPath?: string): unknown => {
  if (!bodyPath || bodyPath === '.') {
    return values;
  }

  return bodyPath.split('.').reduceRight<unknown>((acum, key) => ({ [key]: acum }), values);
};

/**
 * Executes one connector write.
 *
 * An action the manifest does not declare is refused rather than inferred: a connector is read-only until its
 * owner says otherwise, so a form can never reach a provider that was never meant to be written to.
 */
export const writeConnectorRecord = async ({
  manifest,
  credential = {},
  action,
  resource,
  recordId,
  values = {},
  fetchImpl = fetch
}: WriteConnectorOptions): Promise<ConnectorRecord | undefined> => {
  const operation = manifest.write?.[action];
  if (!operation) {
    throw new Error(`Connector ${manifest.id} does not allow "${action}"`);
  }

  const variables: Record<string, unknown> = {
    credential,
    resource: resource ?? '',
    id: recordId ?? '',
    values
  };
  const url = new URL(render(operation.path, variables), manifest.baseUrl);
  const headers = applyAuth(manifest, variables, url);
  headers['Content-Type'] = 'application/json';

  const response = await fetchImpl(url.toString(), {
    method: operation.method,
    headers,
    body: operation.method === 'DELETE' ? undefined : JSON.stringify(wrapBody(values, operation.bodyPath))
  });
  if (!response.ok) {
    throw new Error(`Connector ${manifest.id} responded ${response.status} for ${action} on ${url.pathname}`);
  }

  if (action === 'delete' || response.status === 204) {
    return undefined;
  }

  const payload: unknown = await response.json();
  const item = getByPath(payload, manifest.list.itemsPath === undefined ? '.' : manifest.list.itemsPath);

  return toRecords(Array.isArray(item) ? item : [item], manifest)[0];
};
