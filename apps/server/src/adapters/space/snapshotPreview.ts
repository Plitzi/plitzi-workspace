import { timingSafeEqual } from 'node:crypto';

import { refuse } from './types';

import type { SpaceResolver } from './types';
import type { SSRCredential, SSRDeploymentSecurity, SSRRequest } from '@plitzi/sdk-kernel/types';
import type { Environment } from '@plitzi/sdk-shared';

/**
 * A snapshot's own address: `<name>--r12-production-<space>-<key>.<suffix>` serves `production r12` of one space, so it
 * can be looked at — and shown to whoever should see it — before any domain serves it.
 *
 * The address is a capability: its `key` is the deployment's secret for that one snapshot (an HMAC of it, say), so
 * nobody reaches a snapshot whose address they were not given, and nothing guessable names one. `name` is for the
 * person reading it — the space's sub-domain, cut to fit — and decides nothing: the space is the id the label carries.
 * A preview is never for search (`noindex`) and is served, and counted, as any page of the space is.
 */

/** The environments a snapshot is taken of: the draft has no revisions, so it has no preview address. */
const SNAPSHOT_ENVIRONMENTS: readonly Environment[] = ['development', 'staging', 'production'];

/** RFC 1035: a label is at most 63 characters. */
const MAX_LABEL = 63;

/** How long a key is, in the label: the characters of [a-z0-9] the deployment's `keyOf` answers. */
export const PREVIEW_KEY_LENGTH = 12;

const LABEL = new RegExp(
  `^(?:[a-z0-9-]*?--)?r(\\d{1,9})-(${SNAPSHOT_ENVIRONMENTS.join('|')})-([0-9a-z]{1,11})-([a-z0-9]{${String(PREVIEW_KEY_LENGTH)}})$`
);

/** One snapshot of one space: what a preview address names. */
export interface PreviewAddress {
  spaceId: number;
  environment: Environment;
  revision: number;
}

export interface SnapshotPreviewOptions {
  /** The domain the previews hang off, with or without a leading dot — usually the spaces' own (`plitzi.app`). */
  suffix: string;
  /**
   * The snapshot's key: `PREVIEW_KEY_LENGTH` characters of [a-z0-9], the same every time for the same snapshot, and
   * impossible to work out without the deployment's secret.
   */
  keyOf: (address: PreviewAddress) => string;
  /**
   * The space, when it is one the deployment serves; nothing for one it does not, and the address is a 404. Its
   * `credentials` are who may see its versions: every Site password its addresses ask, any one opening the preview — a
   * preview is the site as it was, and the site is behind them. None, and the preview is open as its site is.
   */
  find: (
    spaceId: number
  ) => Promise<
    | { spaceId: number; security?: Pick<SSRDeploymentSecurity, 'scriptPolicy'>; credentials?: SSRCredential[] }
    | undefined
  >;
}

const sameKey = (presented: string, expected: string): boolean => {
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);

  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * The label of a snapshot's preview address, for a deployment that serves them with {@link snapshotPreview}: the
 * snapshot, the space's id and its key — and `name` before them, cut to what the label leaves room for (or left out).
 */
export const previewLabel = (name: string, address: PreviewAddress, key: string): string => {
  const tail = `r${String(address.revision)}-${address.environment}-${address.spaceId.toString(36)}-${key}`;
  const room = MAX_LABEL - tail.length - 2;
  const cut = name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, Math.max(room, 0))
    .replace(/-+$/, '');
  // `xn--` opens an internationalised label: a name cut to two characters there would make the address one.
  if (!cut || cut.length === 2) {
    return tail;
  }

  return `${cut}--${tail}`;
};

/** The snapshot a label names, when it is a preview label at all. */
export const parsePreviewLabel = (label: string): (PreviewAddress & { key: string }) | undefined => {
  const match = LABEL.exec(label);
  if (!match) {
    return undefined;
  }

  const [, revision, environment, space, key] = match;
  const spaceId = parseInt(space, 36);
  const found = SNAPSHOT_ENVIRONMENTS.find(known => known === environment);
  if (!found || !Number.isSafeInteger(spaceId) || spaceId <= 0) {
    return undefined;
  }

  return { spaceId, environment: found, revision: Number(revision), key };
};

/**
 * Serves a snapshot at its preview address. Put it before `wildcardSubdomain`, whose sub-domains it shares: a label that
 * is not a preview's goes on to it, and one that is a preview's with the wrong key ends the chain as a 404 — the same
 * answer as a space that does not exist, so an address says nothing about which spaces do.
 */
export const snapshotPreview = ({ suffix, keyOf, find }: SnapshotPreviewOptions): SpaceResolver => {
  const dotted = suffix.startsWith('.') ? suffix : `.${suffix}`;

  return async (req: SSRRequest) => {
    if (!req.hostname.endsWith(dotted)) {
      return undefined;
    }

    const label = req.hostname.slice(0, -dotted.length);
    const asked = label.includes('.') ? undefined : parsePreviewLabel(label);
    if (!asked) {
      return undefined;
    }

    const { key, ...address } = asked;
    if (!sameKey(key, keyOf(address))) {
      return refuse(404, 'Space not found');
    }

    const space = await find(address.spaceId);
    if (!space) {
      return refuse(404, 'Space not found');
    }

    return {
      spaceId: space.spaceId,
      environment: address.environment,
      revision: address.revision,
      noindex: true,
      ...(space.security ? { security: space.security } : {}),
      ...(space.credentials && space.credentials.length > 0 ? { credentials: space.credentials } : {})
    };
  };
};
