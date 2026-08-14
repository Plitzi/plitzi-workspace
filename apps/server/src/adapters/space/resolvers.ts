import { refuse } from './types';

import type { SpaceResolution, SpaceResolver } from './types';
import type { GrantOptions, GrantResult } from '../../core/auth/identity';
import type { Environment, SSRCredential, SSRRequest } from '@plitzi/sdk-shared';

/**
 * Did this request even try to present a credential?
 *
 * Not "is the credential good" — that is `resolveGrant`'s answer, and asking it of every anonymous visitor who
 * lands on a first-party host would turn them all into 403s. This is the gate before it, and it is also what marks
 * a request as un-cacheable: the shared resolution cache is keyed by host, and a request carrying a credential can
 * resolve to a different space than the same host without one.
 */
export const presentsCredential = (req: SSRRequest): boolean =>
  Boolean(req.query['access-token']) || Boolean(req.headers.authorization);

/** What a deployment row has to be able to say. Anything else on your row stays yours. */
export interface DeploymentRow {
  spaceId: number;
  environment?: Environment;
  revision?: number | null;
  credential?: SSRCredential;
  /** `false` refuses the request outright. A domain that is not proven is not a domain this space answers on. */
  verified?: boolean;
}

/**
 * The ordinary case: a custom domain someone pointed at this server, resolved through a row that says it was
 * verified. Returns nothing when the domain is unknown, so a later resolver still gets a turn.
 */
export const verifiedDomain = (find: (domain: string) => Promise<DeploymentRow | undefined>): SpaceResolver => {
  return async (req: SSRRequest) => {
    const row = await find(req.hostname);
    if (!row) {
      return undefined;
    }

    if (row.verified === false) {
      return refuse(404, 'Domain not verified');
    }

    const { spaceId, environment, credential } = row;

    return {
      spaceId,
      ...(environment ? { environment } : {}),
      // A null revision means "the live one", which is what 0 says here. They arrive as different values from a
      // nullable column and mean the same thing.
      revision: row.revision ?? 0,
      ...(credential ? { credential } : {})
    };
  };
};

export interface WildcardSubdomainOptions {
  /** The domain the sub-domains hang off, with or without a leading dot — `plitzi.app` or `.plitzi.app`. */
  suffix: string;
  /** The slug IS the sub-domain. Return nothing for a slug that names no space. */
  find: (slug: string) => Promise<{ spaceId: number; environment?: Environment } | undefined>;
}

/**
 * Every space reachable at `<slug>.example.com` without anybody configuring a domain for it.
 *
 * The point is that it needs no per-space row: the sub-domain is the identifier, so a space is publishable the
 * moment it exists. It always resolves the live snapshot — a free preview domain that served a pinned revision
 * would be a second thing to deploy to.
 */
export const wildcardSubdomain = ({ suffix, find }: WildcardSubdomainOptions): SpaceResolver => {
  const dotted = suffix.startsWith('.') ? suffix : `.${suffix}`;

  return async (req: SSRRequest) => {
    if (!req.hostname.endsWith(dotted)) {
      return undefined;
    }

    const slug = req.hostname.slice(0, -dotted.length);
    // A dot left in the slug means this is a deeper sub-domain, not one of ours: `a.b.example.com` is not the
    // space `a.b`, and treating it as one would let anybody mint a hostname that resolves to somebody's space.
    if (!slug || slug.includes('.')) {
      return undefined;
    }

    const space = await find(slug);

    return space ? { ...space, revision: 0 } : undefined;
  };
};

export interface AuthoringPreviewOptions {
  /** The hosts this deployment owns. A credential presented anywhere else is not an authoring session. */
  hosts: string[];
  /** Usually `auth.identity.resolveGrant`. */
  resolveGrant: (req: SSRRequest, options: GrantOptions) => Promise<GrantResult>;
  /** Confirms the space exists and is readable. Return nothing and the request is a 404. */
  find: (spaceId: number) => Promise<{ spaceId: number; environment?: Environment } | undefined>;
  /** Overrides what counts as "tried to present a credential". Defaults to {@link presentsCredential}. */
  presented?: (req: SSRRequest) => boolean;
}

/**
 * An author looking at their own space through a builder, rather than a visitor being served.
 *
 * Put this FIRST. It engages only when a credential is presented on a host this deployment owns, and once it has,
 * a bad credential is a refusal rather than a fall-through — a request that tried to act for a space and failed
 * must not then be served as an anonymous visitor of whatever else that host resolves to.
 *
 * `skipOrigin` is deliberate: a preview is loaded as a document, and a top-level navigation carries no `Origin`.
 * It does not skip the domain binding, which is the part that matters.
 */
export const authoringPreview = ({
  hosts,
  resolveGrant,
  find,
  presented = presentsCredential
}: AuthoringPreviewOptions): SpaceResolver => {
  return async (req: SSRRequest) => {
    if (!hosts.includes(req.hostname) || !presented(req)) {
      return undefined;
    }

    const result = await resolveGrant(req, { skipOrigin: true });
    if (!result.ok) {
      return refuse(403, 'Access Not Authorized');
    }

    const space = await find(result.grant.spaceId);
    if (!space) {
      return refuse(404, 'Space not found');
    }

    // `authoring` is what keeps metering off an author editing their own work. It cannot be inferred downstream:
    // a space's free preview sub-domain serves the same live environment to the public, so "which environment"
    // cannot tell an author from a visitor. Only the resolver knows, which is why it says so.
    return { ...space, revision: 0, authoring: true } satisfies SpaceResolution;
  };
};

/** A space this server always serves, whatever the host — a single-space deployment, or the last word in a chain. */
export const fixedSpace = (resolution: SpaceResolution): SpaceResolver => {
  return () => Promise.resolve(resolution);
};
