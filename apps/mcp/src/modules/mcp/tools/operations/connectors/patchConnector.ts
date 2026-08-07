import { z } from 'zod';

import { connectorConnection, readEndpoint, writeEndpoint } from './manifest';
import { connectorUri, connectorsUri, empty, fail, findConnectorEntry } from '../../../helpers';

import type { OpResult, Space } from '../../../helpers';
import type { Env } from '../../../types';
import type { ConnectorReadEndpoint, ConnectorWriteEndpoint } from '@plitzi/sdk-shared';

export const patchConnectorOp = z
  .object({
    type: z.literal('patchConnector'),
    ref: z.string().describe('Identifier of the connector to change'),
    name: z.string().optional(),
    baseUrl: z.string().optional(),
    connection: connectorConnection.optional().describe('Connection settings to change; the rest are preserved'),
    endpoints: z
      .object({
        read: z.record(z.string(), readEndpoint.nullable()).optional(),
        write: z.record(z.string(), writeEndpoint.nullable()).optional()
      })
      .optional()
      .describe('Endpoints merged BY NAME: the ones you do not list are preserved, one set to null is removed')
  })
  .describe(
    'Change part of a connector, preserving everything you do not send — the way to add one endpoint to a large ' +
      'manifest without resending it. Never creates; use upsertConnector for that.'
  );

export type PatchConnector = z.infer<typeof patchConnectorOp>;

/** Overlay endpoints by name onto the stored map: a listed name replaces, a null removes, an unlisted one is
 *  preserved. One helper for both maps — the merge rule is the same and only the value type differs. */
const mergeEndpoints = <T extends ConnectorReadEndpoint | ConnectorWriteEndpoint>(
  current: Record<string, T> | undefined,
  patch: Record<string, T | null> | undefined
): Record<string, T> | undefined => {
  if (!patch) {
    return current;
  }

  const removed = new Set(
    Object.entries(patch)
      .filter(([, endpoint]) => endpoint === null)
      .map(([name]) => name)
  );
  const kept = Object.entries({ ...current, ...patch }).filter(([name]) => !removed.has(name));

  return Object.fromEntries(kept) as Record<string, T>;
};

export const patchConnector = (space: Space, env: Env, op: PatchConnector): OpResult => {
  const entry = findConnectorEntry(space, op.ref);
  if (!entry) {
    return fail(
      'ref',
      `Connector "${op.ref}" does not exist`,
      `Create it with upsertConnector, or read ${connectorsUri(env)} for the connectors this space has`,
      space.connectors.map(item => item.id)
    );
  }

  const { manifest } = entry;
  if (op.name !== undefined) {
    entry.name = op.name;
  }

  if (op.baseUrl !== undefined) {
    manifest.baseUrl = op.baseUrl;
  }

  const connection = op.connection ?? {};
  if (connection.credential !== undefined) {
    manifest.credential = connection.credential;
  }

  if (connection.auth !== undefined) {
    manifest.auth = connection.auth;
  }

  if (connection.headers !== undefined) {
    manifest.headers = connection.headers;
  }

  if (connection.pagination !== undefined) {
    manifest.pagination = connection.pagination;
  }

  if (connection.operators !== undefined) {
    manifest.operators = connection.operators;
  }

  if (connection.mediaBaseUrl !== undefined) {
    manifest.media = { baseUrl: connection.mediaBaseUrl };
  }

  if (connection.fields !== undefined) {
    manifest.fields = connection.fields;
  }

  if (connection.projection !== undefined) {
    manifest.projection = connection.projection;
  }

  const nextRead = mergeEndpoints(manifest.endpoints.read, op.endpoints?.read);
  const nextWrite = mergeEndpoints(manifest.endpoints.write, op.endpoints?.write);
  // A connector with no read endpoint left can feed nothing, so the last one cannot be patched away — the intent
  // behind that is removing the connector, which deleteConnector does explicitly.
  if (nextRead && Object.keys(nextRead).length === 0) {
    return fail(
      'endpoints.read',
      `This would leave connector "${op.ref}" with no read endpoint`,
      'A connector needs at least one read endpoint to feed an element. Delete the connector if that is the intent'
    );
  }

  manifest.endpoints = { read: nextRead ?? {}, ...(nextWrite === undefined ? {} : { write: nextWrite }) };

  return { ...empty(), updated: 1, staleResources: [connectorsUri(env), connectorUri(env, op.ref)] };
};
