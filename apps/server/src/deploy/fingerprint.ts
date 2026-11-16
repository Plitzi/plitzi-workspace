import { createHash } from 'node:crypto';

import type { FingerprintParts } from './types';

/**
 * Does this publish need a deploy? (RFC 0034 §5.1) A build is described part by part — the SDK it loads, the fonts it
 * links, the environment it names — each a digest, computed without building anything, so a target's last deploy and
 * the revision about to be published can be compared before the person confirms, and the parts that differ said.
 */

/** A digest of anything JSON can say, the same for the same value whatever the order of its keys. */
export const digestOf = (value: unknown): string =>
  createHash('sha256').update(stableJson(value)).digest('hex').slice(0, 16);

const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }

  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, inner]) => inner !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

    return `{${entries.map(([key, inner]) => `${JSON.stringify(key)}:${stableJson(inner)}`).join(',')}}`;
  }

  // Nothing (and a function, which a part never is) is said as `null`, as JSON says a missing value in a list.
  return value === undefined || typeof value === 'function' ? 'null' : JSON.stringify(value);
};

/** The fingerprint of a build, whole: one digest of every part. */
export const fingerprintOf = (parts: FingerprintParts): { digest: string; parts: FingerprintParts } => ({
  digest: digestOf(parts),
  parts
});

/**
 * The parts of `next` that differ from `deployed` — what a deploy would change, by name, in the order `next` lists
 * them. A part only one side has is a difference too: a build that bakes something new in has changed.
 */
export const fingerprintChanges = (deployed: FingerprintParts, next: FingerprintParts): string[] => [
  ...Object.keys(next).filter(part => deployed[part] !== next[part]),
  ...Object.keys(deployed).filter(part => !(part in next))
];
