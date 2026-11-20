import { isFlagName } from './schemaFlag';
import { cookieFromHeader } from '../helpers/cookies';

import type { Schema } from '../types';

/**
 * Where each visitor stands in the space's gradual rollouts: a number from 0 to 99 per flag, drawn once. A rollout at
 * `percent` takes in the visitors below it, so raising the percent keeps everyone who was in — and lowering it lets go
 * of the last taken in first.
 */
export type RolloutBuckets = Record<string, number>;

/** How many places a rollout has: a bucket is one of them, from 0. */
const BUCKETS = 100;

const isBucket = (value: number): boolean => Number.isInteger(value) && value >= 0 && value < BUCKETS;

/**
 * The cookie a visitor's places are kept in, so a reload — or the next visit — keeps them in the same rollouts.
 *
 * A cookie for the reason the variants of an A/B test are kept in one: the server answers the flags before the page
 * exists. Named with the port, as theirs is, because a cookie's scope has none.
 */
export const rolloutCookieName = (host: string | undefined): string => {
  const port = host?.split(':')[1];

  return port ? `plitzi_rollout_${port}` : 'plitzi_rollout';
};

/** How long a visitor keeps their places: as long as their A/B variants. */
const ROLLOUT_COOKIE_MAX_AGE_S = 180 * 24 * 60 * 60;

/** `newCheckout:37,beta:5` — a flag's name and the visitor's place; nothing else survives the parse. */
export const parseRolloutList = (value: string | undefined): RolloutBuckets => {
  const buckets: RolloutBuckets = {};
  for (const pair of value?.split(',') ?? []) {
    const [name = '', place = ''] = pair.split(':');
    const bucket = Number(place);
    if (isFlagName(name) && place !== '' && isBucket(bucket)) {
      buckets[name] = bucket;
    }
  }

  return buckets;
};

export const serializeRolloutList = (buckets: RolloutBuckets): string =>
  Object.entries(buckets)
    .filter(([name, bucket]) => isFlagName(name) && isBucket(bucket))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, bucket]) => `${name}:${String(bucket)}`)
    .join(',');

/** The places a visitor kept, from a `Cookie` header or `document.cookie`. */
export const keptRollout = (cookies: string | undefined, host: string | undefined): RolloutBuckets =>
  parseRolloutList(cookieFromHeader(cookies, rolloutCookieName(host)));

/** The cookie's whole text, as a `Set-Cookie` header and `document.cookie` take it: one writer for both. */
export const rolloutCookie = (
  host: string | undefined,
  buckets: RolloutBuckets,
  { secure }: { secure: boolean }
): string =>
  [
    `${rolloutCookieName(host)}=${encodeURIComponent(serializeRolloutList(buckets))}`,
    'Path=/',
    `Max-Age=${String(ROLLOUT_COOKIE_MAX_AGE_S)}`,
    'SameSite=Lax',
    ...(secure ? ['Secure'] : [])
  ].join('; ');

/** The flags a space rolls out to part of its visitors: a rollout neither at 0 nor at 100, which need no place. */
export const rolledOutFlags = (declared: Schema['flags']): string[] =>
  Object.entries(declared ?? {})
    .filter(([, flag]) => flag.rollout !== undefined && flag.rollout.percent > 0 && flag.rollout.percent < 100)
    .map(([name]) => name);

export type RolloutAssignment = {
  /** The visitor's place in every flag rolled out to part of the visitors. */
  buckets: RolloutBuckets;
  /** The flags a place was drawn in just now — a page answered with any is the visitor's alone, and they keep it. */
  drawn: string[];
};

/** A visitor's place in each flag rolled out: the one they kept, or one drawn now. */
export const assignRollout = (
  declared: Schema['flags'],
  kept: RolloutBuckets,
  random: () => number = Math.random
): RolloutAssignment => {
  const buckets: RolloutBuckets = {};
  const drawn: string[] = [];
  for (const name of rolledOutFlags(declared)) {
    const place = Object.hasOwn(kept, name) ? kept[name] : undefined;
    if (place === undefined) {
      buckets[name] = Math.min(BUCKETS - 1, Math.floor(random() * BUCKETS));
      drawn.push(name);
    } else {
      buckets[name] = place;
    }
  }

  return { buckets, drawn };
};

/**
 * The places this page drew, by flag, for as long as it is open: the router and the `flags` source both resolve the
 * flags, and a place drawn twice would answer them differently.
 */
const drawnHere: RolloutBuckets = {};

/**
 * A visitor's places in the browser: the server's (it answered the page with them), then what the cookie kept, then a
 * place drawn here — once per page, whoever asks — for a flag none of those has: a space rendered with no server in
 * front. `drawn` names what has to be kept in the cookie.
 */
export const browserRollout = (declared: Schema['flags'], server: RolloutBuckets | undefined): RolloutAssignment => {
  const host = typeof window === 'undefined' ? undefined : window.location.host;
  let cookies: string | undefined;
  try {
    cookies = typeof document === 'undefined' ? undefined : document.cookie;
  } catch {
    cookies = undefined;
  }

  const assignment = assignRollout(declared, { ...keptRollout(cookies, host), ...drawnHere, ...server });
  for (const name of assignment.drawn) {
    drawnHere[name] = assignment.buckets[name];
  }

  return assignment;
};

/** Keeps a visitor's places in the browser, over what the cookie holds already. */
export const writeRollout = (buckets: RolloutBuckets): void => {
  try {
    const host = window.location.host;
    document.cookie = rolloutCookie(
      host,
      { ...keptRollout(document.cookie, host), ...buckets },
      { secure: window.location.protocol === 'https:' }
    );
  } catch {
    // Where cookies may not be written, the page keeps its places while it is open; the next visit draws them again.
  }
};
