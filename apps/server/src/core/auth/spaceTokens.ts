import { ANY_DOMAIN, normalizeDomain } from './domains';

import type { SpaceScope, Tokens } from './tokens';

/**
 * A stored space credential, as whatever stores them reports one. `origins` is already parsed: how a deployment keeps
 * the list (a joined column, a join table, a JSON blob) is its business and never leaks into the rules below.
 */
export interface SpaceTokenRecord {
  id: number;
  token: string;
  scope: SpaceScope;
  /** The space's public credential — the one published sites embed. Exactly one row per space carries this. */
  isDefault: boolean;
  origins: string[];
  /** Unix seconds, or null for a credential that never expires. */
  expiresAt: number | null;
  userId?: number | null;
  createdAt?: number;
  updatedAt?: number;
}

export interface SpaceTokenAdapters {
  loadDefault: (spaceId: number) => Promise<SpaceTokenRecord | undefined>;
  find: (spaceId: number, tokenId: number) => Promise<SpaceTokenRecord | undefined>;
  list: (spaceId: number) => Promise<SpaceTokenRecord[]>;
  save: (id: number, values: { token: string; origins?: string[]; expiresAt?: number | null }) => Promise<void>;
  /**
   * Store a NEW credential beside the space's public one. Only the secret scopes are ever created this way — the
   * public row is created with the space and rotated in place thereafter — so a deployment that issues none may
   * leave it out and `issueHost` refuses.
   */
  create?: (values: {
    spaceId: number;
    token: string;
    scope: SpaceScope;
    origins: string[];
    expiresAt: number | null;
  }) => Promise<SpaceTokenRecord>;
  remove: (id: number) => Promise<void>;
  /**
   * The domain list is two policies at once — where the credential may be presented, and who may frame the space — so
   * a deployment that caches either gets told the moment it changes, rather than serving the old one until its TTL.
   */
  onDomainsChanged?: (spaceId: number) => Promise<void>;
}

/**
 * The floor a space is always reachable on: the platform-owned domain it is published under. Merged into every list so
 * narrowing the domains to a custom one cannot lock a published site out of its own credential. Which domains those
 * are is the deployment's to say — the rule that they are never dropped is not.
 */
export interface SpaceTokenContext {
  spaceId: number;
  defaultDomains: string[];
}

/**
 * What a handler answers. The success body is typed per handler so a binding can reshape it — Plitzi's `GET /token`
 * serves the bare credential for compatibility with its own older API — without casting its way back to it.
 */
export type SpaceTokenOutcome<B extends object = object> =
  | { ok: true; status?: number; body: B }
  | { ok: false; status: number; body: { error: string } & Record<string, unknown> };

export type SpaceTokenSummary = Omit<SpaceTokenRecord, 'token' | 'origins'> & {
  domains?: string[];
  label?: string;
};

const ROTATION_WARNING = 'The previous token stopped working. Every site embedding it must be redeployed.';

/**
 * Said once, at the only moment it can be acted on. A host credential is the space's read access WITHOUT the origin
 * check that makes the public one safe to publish, so what keeps it from being a way to clone the space is that it
 * stays secret — and a caller who does not know it is never shown again will paste it into a page.
 */
const HOST_SECRET_WARNING =
  'Store this now — it is not shown again. Unlike the public token it is NOT safe to embed in a page or commit to ' +
  'a public repository: anyone holding it can serve this space from their own server. Revoke it if it leaks.';

const DAY_SECONDS = 86400;

const now = (): number => Math.floor(Date.now() / 1000);

const notFound = { ok: false, status: 404, body: { error: 'Token not found' } } as const;

/**
 * The lifecycle of a space's own credentials, over whatever stores them.
 *
 * Minting one is `tokens.generateSpaceToken`; everything around it is here, and it is all rule rather than storage:
 * a credential whose claims changed is a **different credential**, so every edit below re-mints and the previous one
 * stops working the instant it returns. Saying that once, in one place, is the point — a self-hoster who has to
 * rediscover it discovers it as a published site that went dark.
 */
export const createSpaceTokenApi = ({ tokens, adapters }: { tokens: Tokens; adapters: SpaceTokenAdapters }) => {
  /** Never empty: a credential with no origins is one that works nowhere. */
  const withFloor = (domains: string[], defaults: string[]): string[] => {
    if (domains.includes(ANY_DOMAIN)) {
      // Stored as the wildcard alone, so the row says plainly what it means rather than listing domains it ignores.
      return [ANY_DOMAIN];
    }

    const merged = [...new Set([...defaults, ...domains])];

    return merged.length > 0 ? merged : [ANY_DOMAIN];
  };

  const remint = async (
    record: SpaceTokenRecord,
    context: SpaceTokenContext,
    changes: { origins?: string[]; expiresAt?: number | null } = {}
  ): Promise<{ token: string; origins: string[]; expiresAt: number | null }> => {
    const origins = withFloor(changes.origins ?? record.origins, context.defaultDomains);
    const expiresAt = changes.expiresAt === undefined ? record.expiresAt : changes.expiresAt;
    const token = tokens.generateSpaceToken(context.spaceId, origins, record.scope, { expiresAt });

    await adapters.save(record.id, { token, origins, expiresAt });

    return { token, origins, expiresAt };
  };

  return {
    /**
     * The space's public credential, rotated in place when it no longer verifies. Rotating on *outdated* and not only
     * on expired is what this endpoint exists for: a site stranded on a credential from a previous token version would
     * otherwise have no way back — nothing else can hand it a working one.
     */
    async read(context: SpaceTokenContext): Promise<SpaceTokenOutcome<{ token: string; domains: string[] }>> {
      const record = await adapters.loadDefault(context.spaceId);
      if (!record) {
        return notFound;
      }

      if (!tokens.needsRotation(record.token)) {
        return { ok: true, body: { token: record.token, domains: record.origins } };
      }

      // Re-minted with the domains and lifetime already on the row, so a rotation never silently widens, narrows or
      // outlives what the owner chose.
      const { token, origins } = await remint(record, context);

      return { ok: true, body: { token, domains: origins } };
    },

    /**
     * Replace the public credential with a fresh one, keeping everything it declared. This is the control that expiry
     * is often mistaken for: a render credential is meant to outlive any deadline, so revoking a leaked one is an act,
     * not a wait.
     */
    async rotate(
      context: SpaceTokenContext
    ): Promise<SpaceTokenOutcome<{ token: string; domains: string[]; warning: string }>> {
      const record = await adapters.loadDefault(context.spaceId);
      if (!record) {
        return notFound;
      }

      const { token, origins } = await remint(record, context);

      return { ok: true, body: { token, domains: origins, warning: ROTATION_WARNING } };
    },

    /**
     * Issue a **host** credential: the space's read access for a SERVER that renders it as its own.
     *
     * A separate credential rather than letting the public one do it, because the two are protected by different
     * things and only one of them can be published. A `render` token is safe in a page precisely because it is held
     * to the origins it declares — a check that only means anything when a browser is the one making the claim. A
     * server has no origin to state, so admitting the public token without one would make a key lifted from anybody's
     * published page enough to serve a byte-identical clone of their site. This one is admitted without an origin
     * because possessing it is itself the proof, which is only true while it stays secret: it is returned once, never
     * embedded, and revocable on its own row.
     *
     * `label` is what the owner will read in the list when deciding which one to revoke — the deployment it was
     * issued to. It is stored where a render token keeps its domains, since a host credential is bound to none.
     */
    async issueHost(
      context: SpaceTokenContext,
      label: unknown,
      { expiresAt = null }: { expiresAt?: number | null } = {}
    ): Promise<
      SpaceTokenOutcome<{ id: number; token: string; label: string; expiresAt: number | null; warning: string }>
    > {
      if (!adapters.create) {
        return { ok: false, status: 501, body: { error: 'This deployment does not issue host tokens' } };
      }

      if (typeof label !== 'string' || label.trim() === '') {
        return {
          ok: false,
          status: 400,
          body: { error: 'label is required — name the deployment this credential is for, so it can be revoked' }
        };
      }

      const name = label.trim();
      const token = tokens.generateSpaceToken(context.spaceId, [name], 'host', { expiresAt });
      const record = await adapters.create({
        spaceId: context.spaceId,
        token,
        scope: 'host',
        origins: [name],
        expiresAt
      });

      return {
        ok: true,
        status: 201,
        body: { id: record.id, token, label: name, expiresAt, warning: HOST_SECRET_WARNING }
      };
    },

    async readDomains(context: SpaceTokenContext): Promise<SpaceTokenOutcome<{ domains: string[] }>> {
      const record = await adapters.loadDefault(context.spaceId);

      return record ? { ok: true, body: { domains: record.origins } } : notFound;
    },

    async setDomains(
      context: SpaceTokenContext,
      domains: unknown
    ): Promise<SpaceTokenOutcome<{ token: string; domains: string[]; warning?: string }>> {
      if (!Array.isArray(domains) || domains.some(domain => typeof domain !== 'string')) {
        return { ok: false, status: 400, body: { error: 'domains must be an array of strings' } };
      }

      const normalized: string[] = [];
      const rejected: string[] = [];
      for (const domain of domains as string[]) {
        const value = normalizeDomain(domain);
        if (value) {
          normalized.push(value);
        } else {
          rejected.push(domain);
        }
      }

      if (rejected.length > 0) {
        return { ok: false, status: 400, body: { error: 'Invalid domains', domains: rejected } };
      }

      const record = await adapters.loadDefault(context.spaceId);
      if (!record) {
        return notFound;
      }

      const { token, origins } = await remint(record, context, { origins: normalized });
      await adapters.onDomainsChanged?.(context.spaceId);

      return {
        ok: true,
        body: {
          token,
          domains: origins,
          // Stated rather than refused: embedding on domains that cannot be known up front is a real case. It does
          // turn off the one check that makes a copied public credential useless elsewhere, so it is never silent.
          ...(origins.includes(ANY_DOMAIN) && {
            warning: 'This token now works on any domain. Anyone who copies it from a page can use it elsewhere.'
          })
        }
      };
    },

    async readExpiry(
      context: SpaceTokenContext
    ): Promise<SpaceTokenOutcome<{ expiresAt: number | null; neverExpires: boolean }>> {
      const record = await adapters.loadDefault(context.spaceId);

      return record
        ? { ok: true, body: { expiresAt: record.expiresAt, neverExpires: record.expiresAt === null } }
        : notFound;
    },

    /**
     * When the public credential should stop working — or never, which is the default. Both are legitimate: a site
     * deployed once and left alone wants no deadline (an expiry there is a scheduled outage), while a campaign page
     * meant to go quiet, or a credential handed to an agency for a fixed engagement, wants one.
     */
    async setExpiry(
      context: SpaceTokenContext,
      expiresInDays: unknown
    ): Promise<SpaceTokenOutcome<{ token: string; expiresAt: number | null; neverExpires: boolean; warning: string }>> {
      const forever = expiresInDays === null || expiresInDays === undefined;
      if (!forever && (typeof expiresInDays !== 'number' || !Number.isFinite(expiresInDays) || expiresInDays <= 0)) {
        return {
          ok: false,
          status: 400,
          body: { error: 'expiresInDays must be a positive number, or null to never expire' }
        };
      }

      const record = await adapters.loadDefault(context.spaceId);
      if (!record) {
        return notFound;
      }

      const expiry = forever ? null : now() + Math.round(expiresInDays * DAY_SECONDS);
      const { token, expiresAt } = await remint(record, context, { expiresAt: expiry });

      return { ok: true, body: { token, expiresAt, neverExpires: expiresAt === null, warning: ROTATION_WARNING } };
    },

    /**
     * The space's credentials, so a leak can be seen and acted on. Never the secrets themselves: an `agent` grant
     * writes and a `host` grant serves the space from somebody else's server, so listing either would turn
     * permission to read into a way to obtain it. The public one is published by construction and has its own
     * endpoint.
     */
    async list(context: SpaceTokenContext): Promise<SpaceTokenOutcome<{ tokens: SpaceTokenSummary[] }>> {
      const records = await adapters.list(context.spaceId);

      return {
        ok: true,
        body: {
          tokens: records.map(({ token, origins, ...rest }) => {
            void token;

            // The same column means different things by scope: the domain list for the public credential, and a
            // human label — which connector, which deployment — on an agent or host one, which are bound to no
            // domain and need instead to be identifiable when one of them has to be revoked.
            return { ...rest, ...(rest.scope === 'render' ? { domains: origins } : { label: origins.join(',') }) };
          })
        }
      };
    },

    /**
     * Revoke one credential. Dropping the record IS the revocation: every grant is looked up as it is verified, so it
     * stops working at once whatever its claims still say.
     *
     * The public credential is deliberately not revocable this way — removing it leaves the published site with no
     * credential at all, and replacing it is what a leak of that one calls for.
     */
    async revoke(
      context: SpaceTokenContext,
      tokenId: number
    ): Promise<SpaceTokenOutcome<{ message: string; tokenId: number }>> {
      if (!Number.isFinite(tokenId)) {
        return { ok: false, status: 400, body: { error: 'tokenId must be a number' } };
      }

      const record = await adapters.find(context.spaceId, tokenId);
      if (!record) {
        return notFound;
      }

      if (record.isDefault) {
        return {
          ok: false,
          status: 400,
          body: {
            error: 'The space’s public token cannot be deleted — rotate it instead',
            rotate: `/spaces/${context.spaceId}/token/rotate`
          }
        };
      }

      await adapters.remove(record.id);

      return { ok: true, body: { message: 'Token revoked', tokenId } };
    }
  };
};

export type SpaceTokenApi = ReturnType<typeof createSpaceTokenApi>;
