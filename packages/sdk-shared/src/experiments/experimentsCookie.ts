import { isExperimentName, isExperimentVariant } from './experiments';
import { cookieFromHeader } from '../helpers/cookies';

import type { ExperimentAssignments } from './experiments';

/**
 * The cookie a visitor's variants are kept in, so a reload — or the next visit — shows them the same variant of every
 * experiment.
 *
 * A cookie and not web storage for the reason the theme is one: the server draws the variant, so it has to know it
 * before the page exists. Named with the port, like the flags a tester forces, because a cookie's scope has none.
 */
export const experimentsCookieName = (host: string | undefined): string => {
  const port = host?.split(':')[1];

  return port ? `plitzi_ab_${port}` : 'plitzi_ab';
};

/** How long a visitor keeps their variants: long enough to outlast an experiment, as a measurement needs. */
export const EXPERIMENTS_COOKIE_MAX_AGE_S = 180 * 24 * 60 * 60;

/** `heroTest:b,pricing:a` — an experiment's name and its variant; nothing else survives the parse. */
export const parseExperimentList = (value: string | undefined): ExperimentAssignments => {
  const assignments: ExperimentAssignments = {};
  for (const pair of value?.split(',') ?? []) {
    const [name = '', variant] = pair.split(':');
    if (isExperimentName(name) && isExperimentVariant(variant)) {
      assignments[name] = variant;
    }
  }

  return assignments;
};

export const serializeExperimentList = (assignments: ExperimentAssignments): string =>
  Object.entries(assignments)
    .filter(([name, variant]) => isExperimentName(name) && isExperimentVariant(variant))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, variant]) => `${name}:${variant}`)
    .join(',');

/** The variants a visitor kept, from a `Cookie` header or `document.cookie`. */
export const keptExperiments = (cookies: string | undefined, host: string | undefined): ExperimentAssignments =>
  parseExperimentList(cookieFromHeader(cookies, experimentsCookieName(host)));

/**
 * The cookie's whole text, as a `Set-Cookie` header and `document.cookie` take it: one writer for the server and the
 * browser, so the two never keep it under different terms. Readable by the page (no `HttpOnly`) — the browser assigns
 * what a page reached without the server never drew.
 */
export const experimentsCookie = (
  host: string | undefined,
  assignments: ExperimentAssignments,
  { secure }: { secure: boolean }
): string =>
  [
    `${experimentsCookieName(host)}=${encodeURIComponent(serializeExperimentList(assignments))}`,
    'Path=/',
    `Max-Age=${EXPERIMENTS_COOKIE_MAX_AGE_S}`,
    'SameSite=Lax',
    ...(secure ? ['Secure'] : [])
  ].join('; ');

/** Keeps a visitor's variants in the browser — what a page assigned that the server did not draw. */
export const writeExperiments = (assignments: ExperimentAssignments): void => {
  try {
    document.cookie = experimentsCookie(window.location.host, assignments, {
      secure: window.location.protocol === 'https:'
    });
  } catch {
    // Where cookies may not be written, the page keeps its variants while it is open; the next visit draws them again.
  }
};
