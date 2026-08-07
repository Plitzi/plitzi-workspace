import { z } from 'zod';

import { connectorConnection, readEndpoint, writeEndpoint } from './manifest';
import { connectorUri, connectorsUri, empty, findConnectorEntry } from '../../../helpers';

import type { OpResult, Space } from '../../../helpers';
import type { Env } from '../../../types';
import type { ConnectorManifest } from '@plitzi/sdk-shared';

export const upsertConnectorOp = z
  .object({
    type: z.literal('upsertConnector'),
    ref: z
      .string()
      .describe(
        'Identifier of the connector, chosen by you and stable forever: it is what a provider element stores. ' +
          'Letters, numbers, hyphens and underscores, starting with a letter (e.g. "strapi-blog").'
      ),
    name: z.string().describe('Human name shown in the builder'),
    baseUrl: z.string().describe('Origin every endpoint path is appended to, e.g. "https://cms.example.com"'),
    connection: connectorConnection.optional(),
    endpoints: z
      .object({
        read: z
          .record(z.string(), readEndpoint)
          .describe('Read endpoints by name. `list` is the one an element addresses when it names none'),
        write: z.record(z.string(), writeEndpoint).optional().describe('Omit for a read-only connector')
      })
      .describe('Every request this connector knows how to make')
  })
  .describe(
    'Create a connector, or REPLACE the whole manifest of an existing one (send every endpoint you want to keep; ' +
      'use patchConnector to change part of it). A connector is a declarative REST client the SERVER executes: it ' +
      'holds the base URL, the auth template and the endpoints, so integrating a CMS is configuration, not code.'
  );

export type UpsertConnector = z.infer<typeof upsertConnectorOp>;

/** The stored manifest the engine reads. `id` is stamped from the ref, never taken from the input, and the media
 *  origin is nested the way the engine expects it. */
export const toManifest = (op: UpsertConnector): ConnectorManifest => {
  const connection = op.connection ?? {};

  return {
    id: op.ref,
    baseUrl: op.baseUrl,
    ...(connection.credential === undefined ? {} : { credential: connection.credential }),
    ...(connection.auth === undefined ? {} : { auth: connection.auth }),
    ...(connection.headers === undefined ? {} : { headers: connection.headers }),
    endpoints: { read: op.endpoints.read, ...(op.endpoints.write === undefined ? {} : { write: op.endpoints.write }) },
    ...(connection.pagination === undefined ? {} : { pagination: connection.pagination }),
    ...(connection.operators === undefined ? {} : { operators: connection.operators }),
    ...(connection.mediaBaseUrl === undefined ? {} : { media: { baseUrl: connection.mediaBaseUrl } }),
    ...(connection.fields === undefined ? {} : { fields: connection.fields }),
    ...(connection.projection === undefined ? {} : { projection: connection.projection })
  };
};

export const upsertConnector = (space: Space, env: Env, op: UpsertConnector): OpResult => {
  const manifest = toManifest(op);
  const existing = findConnectorEntry(space, op.ref);
  const stale = [connectorsUri(env), connectorUri(env, op.ref)];
  if (existing) {
    existing.name = op.name;
    existing.manifest = manifest;

    return { ...empty(), updated: 1, staleResources: stale };
  }

  space.connectors.push({ id: op.ref, name: op.name, manifest });

  return { ...empty(), created: 1, staleResources: stale };
};
