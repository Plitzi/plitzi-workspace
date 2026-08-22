import { fetchConnectorRecords, writeConnectorRecord } from '../../connectors/engine';

import type { ConnectorFilter } from '../../connectors/types';
import type { ActionTask } from '../types';

const parseFilters = (value: unknown): ConnectorFilter[] => {
  if (Array.isArray(value)) {
    return value as ConnectorFilter[];
  }

  if (typeof value !== 'string' || value === '') {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);

    return Array.isArray(parsed) ? (parsed as ConnectorFilter[]) : [];
  } catch {
    throw new Error('Filters are not valid JSON');
  }
};

const parseValues = (value: unknown): Record<string, unknown> => {
  if (value !== null && typeof value === 'object') {
    return value as Record<string, unknown>;
  }

  if (typeof value !== 'string' || value === '') {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(value);

    return parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    throw new Error('Values are not valid JSON');
  }
};

const toNumber = (value: string | number | undefined): number | undefined => {
  if (value === undefined || value === '') {
    return undefined;
  }

  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);

  return Number.isFinite(parsed) ? parsed : undefined;
};

type ReadParams = {
  connector: string;
  endpoint: string;
  resource: string;
  limit: string | number;
  offset: string | number;
  filters: string;
};

/**
 * Reads records through a connector the action declared.
 *
 * The same engine that answers a `runtime: 'server'` element's data, reached from a flow instead of from an
 * element — so a page that needs its records joined, filtered or checked before anyone sees them does not need a
 * second integration to do it.
 */
const read: ActionTask<ReadParams> = {
  namespace: 'connector',
  action: 'read',
  title: 'Connector Read',
  params: {
    connector: { type: 'text', canBind: true, defaultValue: '', label: 'Connector' },
    endpoint: { type: 'text', canBind: true, defaultValue: 'list', label: 'Endpoint' },
    resource: { type: 'text', canBind: true, defaultValue: '', label: 'Resource' },
    limit: { type: 'text', canBind: true, defaultValue: '10', label: 'Limit' },
    offset: { type: 'text', canBind: true, defaultValue: '0', label: 'Offset' },
    filters: { type: 'codemirror-json', canBind: true, defaultValue: '[]', label: 'Filters' }
  },
  run: async (params, ctx) => {
    const resolved = await ctx.connector(params.connector);
    if (!resolved) {
      throw new Error(`Connector "${params.connector}" is not available for this space`);
    }

    const result = await fetchConnectorRecords({
      manifest: resolved.manifest,
      endpoint: params.endpoint || undefined,
      credential: resolved.credential,
      query: {
        resource: params.resource || undefined,
        limit: toNumber(params.limit),
        offset: toNumber(params.offset),
        filters: parseFilters(params.filters)
      },
      fetchImpl: ctx.fetch
    });

    return { records: result.records, pageInfo: result.pageInfo };
  }
};

type WriteParams = {
  connector: string;
  endpoint: string;
  resource: string;
  recordId: string;
  values: string;
};

/**
 * Runs one of a connector's declared write endpoints.
 *
 * `endpoint` names it rather than a verb, because a connector's writes are named by whoever wrote the manifest:
 * `escalate` and `sendInvoice` are as legitimate as `create`, and an undeclared one is refused by the engine.
 */
const write: ActionTask<WriteParams> = {
  namespace: 'connector',
  action: 'write',
  title: 'Connector Write',
  params: {
    connector: { type: 'text', canBind: true, defaultValue: '', label: 'Connector' },
    endpoint: { type: 'text', canBind: true, defaultValue: 'create', label: 'Endpoint' },
    resource: { type: 'text', canBind: true, defaultValue: '', label: 'Resource' },
    recordId: { type: 'text', canBind: true, defaultValue: '', label: 'Record Id' },
    values: { type: 'codemirror-json', canBind: true, defaultValue: '{}', label: 'Values' }
  },
  run: async (params, ctx) => {
    const resolved = await ctx.connector(params.connector);
    if (!resolved) {
      throw new Error(`Connector "${params.connector}" is not available for this space`);
    }

    const record = await writeConnectorRecord({
      manifest: resolved.manifest,
      credential: resolved.credential,
      action: params.endpoint,
      resource: params.resource || undefined,
      recordId: params.recordId || undefined,
      values: parseValues(params.values),
      fetchImpl: ctx.fetch
    });

    return { record: record ?? null };
  }
};

export const connectorTasks = [read, write] as ActionTask<Record<string, unknown>>[];
