import { forgetConnection, readConnection, writeConnection } from './connection';
import { requestJson } from './http';
import { renewGrant, revokeGrant, signInThroughBrowser } from './oauth';

import type { ConnectedSpace, Connection } from './connection';
import type { Reply } from './http';
import type { Grant } from './oauth';

/**
 * The connection in use: made in the browser, renewed on its own, and ended when the platform says it has ended.
 *
 * A command asks for the connection and gets one that works, or a sentence saying why not. Renewing before it expires
 * — and once more when the server answers 401 — is here so no command has to decide what a 401 means: in this API it
 * is never about permissions (that is 403), so it means exactly one thing, that the credential no longer works.
 */

export type Outcome<T> = { ok: true; value: T } | { ok: false; error: string };

/** Renewed this long before it expires, so a session is not handed to a request it will not outlive. */
const RENEW_MARGIN_SECONDS = 60;

const SPACE_TARGET_PREFIX = 'space:';

const bearer = (grant: Grant): Record<string, string> => ({
  Authorization: `Bearer ${grant.accessToken}`,
  Accept: 'application/json'
});

/** The space a grant was given for, by the id its target carries, named as the platform names it. */
const spaceOfGrant = async (api: string, grant: Grant): Promise<Outcome<ConnectedSpace | undefined>> => {
  if (!grant.target?.startsWith(SPACE_TARGET_PREFIX)) {
    return { ok: true, value: undefined };
  }

  const id = grant.target.slice(SPACE_TARGET_PREFIX.length);
  // `logsLimit=1`: the route answers a space with its recent log, and only its name is wanted.
  const reply = await requestJson<{ space?: { id?: number; name?: string; permanentUrl?: string } }>(
    `${api}/spaces/${encodeURIComponent(id)}?logsLimit=1`,
    { headers: bearer(grant) }
  );
  if (!reply.ok) {
    return reply;
  }

  const space = reply.data.space;
  if (reply.status !== 200 || typeof space?.id !== 'number' || typeof space.permanentUrl !== 'string') {
    return { ok: false, error: `The space you chose could not be read (${reply.status}).` };
  }

  return {
    ok: true,
    value: { id: space.id, name: space.name || space.permanentUrl, permanentUrl: space.permanentUrl }
  };
};

export interface ConnectOptions {
  /** `space`: the person chooses a space on the grant screen. Left out: the account alone. */
  scope?: string;
  open: (url: string) => void;
}

/**
 * A new connection, made in the browser, REPLACING whatever connection there was — another space, another account,
 * another platform. The old grant is revoked rather than left alive in nobody's hands.
 */
export const connect = async (api: string, { scope, open }: ConnectOptions): Promise<Outcome<Connection>> => {
  const signedIn = await signInThroughBrowser(api, { scope, open });
  if (!signedIn.ok) {
    const error =
      signedIn.reason === 'timeout'
        ? 'Nothing came back from the browser in five minutes. Run the command again when you are ready.'
        : (signedIn.error ?? 'The platform refused the sign-in.');

    return { ok: false, error };
  }

  const { grant } = signedIn;
  const space = await spaceOfGrant(api, grant);
  if (!space.ok) {
    await revokeGrant(api, grant);

    return space;
  }

  const previous = await readConnection();
  const connection: Connection = { api, grant, ...(space.value ? { space: space.value } : {}) };
  await writeConnection(connection);
  if (previous) {
    await revokeGrant(previous.api, previous.grant);
  }

  return { ok: true, value: connection };
};

/** Signing out: the grant revoked at the platform, and the connection forgotten here. */
export const disconnect = async (): Promise<Connection | undefined> => {
  const connection = await readConnection();
  if (connection) {
    await revokeGrant(connection.api, connection.grant);
    await forgetConnection();
  }

  return connection;
};

/** Why a connection is gone, said with the command that makes it again. */
const ended = (connection: Connection): string =>
  connection.space
    ? `Your connection to ${connection.space.name} has ended — signed out elsewhere, or you no longer have access ` +
      'to that space. Connect again with plitzi space.'
    : 'Your session has ended. Sign in again with plitzi login.';

/** A fresh session for the connection, kept. A refusal ends the connection; an unreachable server does not. */
const renew = async (connection: Connection): Promise<Outcome<Connection>> => {
  const renewed = await renewGrant(connection.api, connection.grant);
  if (renewed.ok) {
    const next = { ...connection, grant: renewed.grant };
    await writeConnection(next);

    return { ok: true, value: next };
  }

  if (renewed.reason === 'refused') {
    await forgetConnection();

    return { ok: false, error: ended(connection) };
  }

  return { ok: false, error: renewed.error ?? `Could not reach ${connection.api}.` };
};

const nearlyExpired = (grant: Grant): boolean =>
  grant.expiresAt !== undefined && grant.expiresAt - RENEW_MARGIN_SECONDS <= Math.floor(Date.now() / 1000);

/**
 * The connection to `api`, renewed if it is about to expire. Undefined when there is none there — including when the
 * CLI is connected, but to another platform: that one is not used for this.
 */
export const currentConnection = async (api: string): Promise<Outcome<Connection | undefined>> => {
  const connection = await readConnection();
  if (connection?.api !== api) {
    return { ok: true, value: undefined };
  }

  return nearlyExpired(connection.grant) ? renew(connection) : { ok: true, value: connection };
};

/**
 * A request as the connected person. A 401 renews the session and tries once more; a second 401 ends the connection,
 * since the server has now said twice that the credential does not work.
 */
export const authorizedRequest = async <T>(
  connection: Connection,
  pathname: string,
  init: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> } = {}
): Promise<Outcome<{ connection: Connection; reply: Extract<Reply<T>, { ok: true }> }>> => {
  const send = (current: Connection) =>
    requestJson<T>(`${current.api}${pathname}`, {
      ...init,
      headers: { ...bearer(current.grant), ...init.headers }
    });

  const first = await send(connection);
  if (!first.ok) {
    return first;
  }

  if (first.status !== 401) {
    return { ok: true, value: { connection, reply: first } };
  }

  const renewed = await renew(connection);
  if (!renewed.ok) {
    return renewed;
  }

  const second = await send(renewed.value);
  if (!second.ok) {
    return second;
  }

  if (second.status === 401) {
    await forgetConnection();

    return { ok: false, error: ended(connection) };
  }

  return { ok: true, value: { connection: renewed.value, reply: second } };
};
