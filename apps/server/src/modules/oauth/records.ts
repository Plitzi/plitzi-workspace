import type { OAuthGrantTarget, OAuthStore, OAuthUser } from '@plitzi/sdk-shared';

/** A client that registered itself through RFC 7591. Public clients only — a desktop host cannot keep a secret,
 *  so the token endpoint authenticates the exchange with PKCE instead. */
export type ClientRecord = {
  clientId: string;
  clientName: string;
  redirectUris: string[];
};

/** The authorization request, parked while the user logs in. `challenge` binds the eventual code to the client
 *  that started the flow. */
export type PendingRecord = {
  clientId: string;
  redirectUri: string;
  challenge: string;
  state?: string;
  scope?: string;
  user: OAuthUser;
};

/** A code, redeemable once, for the token it already resolves to. Minting the bearer at consent time (rather than
 *  at redemption) means a failure the user could act on — no space, revoked access — surfaces on the consent
 *  screen instead of as an opaque `invalid_grant` inside the host. */
export type CodeRecord = {
  clientId: string;
  redirectUri: string;
  challenge: string;
  token: string;
  expiresInSeconds?: number;
  scope?: string;
  user: OAuthUser;
  target: OAuthGrantTarget;
};

/** A refresh grant: everything needed to mint a fresh bearer without asking the user again. */
export type RefreshRecord = {
  clientId: string;
  scope?: string;
  user: OAuthUser;
  target: OAuthGrantTarget;
};

const CLIENT_TTL_SECONDS = 60 * 60 * 24 * 90;
const PENDING_TTL_SECONDS = 60 * 10;

const keyOf = (kind: string, id: string): string => `oauth:${kind}:${id}`;

// Every record the layer keeps is written and read through here, so a consumer's store only ever sees opaque
// strings and the shapes above stay an internal concern.
const readJson = async <T>(store: OAuthStore, kind: string, id: string): Promise<T | undefined> => {
  const raw = await store.get(keyOf(kind, id));
  if (!raw) {
    return undefined;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
};

const writeJson = async (
  store: OAuthStore,
  kind: string,
  id: string,
  value: unknown,
  ttlSeconds: number
): Promise<void> => {
  await store.put(keyOf(kind, id), JSON.stringify(value), ttlSeconds);
};

export const putClient = (store: OAuthStore, client: ClientRecord): Promise<void> =>
  writeJson(store, 'client', client.clientId, client, CLIENT_TTL_SECONDS);

export const getClient = (store: OAuthStore, clientId: string): Promise<ClientRecord | undefined> =>
  readJson<ClientRecord>(store, 'client', clientId);

export const putPending = (store: OAuthStore, id: string, pending: PendingRecord): Promise<void> =>
  writeJson(store, 'pending', id, pending, PENDING_TTL_SECONDS);

export const getPending = (store: OAuthStore, id: string): Promise<PendingRecord | undefined> =>
  readJson<PendingRecord>(store, 'pending', id);

export const dropPending = async (store: OAuthStore, id: string): Promise<void> => {
  await store.drop(keyOf('pending', id));
};

export const putCode = (store: OAuthStore, code: string, record: CodeRecord, ttlSeconds: number): Promise<void> =>
  writeJson(store, 'code', code, record, ttlSeconds);

export const getCode = (store: OAuthStore, code: string): Promise<CodeRecord | undefined> =>
  readJson<CodeRecord>(store, 'code', code);

// Codes are single-use: redeeming one drops it, so a leaked redirect URL cannot be replayed.
export const dropCode = async (store: OAuthStore, code: string): Promise<void> => {
  await store.drop(keyOf('code', code));
};

export const putRefresh = (
  store: OAuthStore,
  token: string,
  record: RefreshRecord,
  ttlSeconds: number
): Promise<void> => writeJson(store, 'refresh', token, record, ttlSeconds);

export const getRefresh = (store: OAuthStore, token: string): Promise<RefreshRecord | undefined> =>
  readJson<RefreshRecord>(store, 'refresh', token);

export const dropRefresh = async (store: OAuthStore, token: string): Promise<void> => {
  await store.drop(keyOf('refresh', token));
};
