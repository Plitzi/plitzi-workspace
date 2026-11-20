import { indexOfVariant } from './experiments';
import { parseExperimentList, serializeExperimentList } from './experimentsCookie';
import { cookieFromHeader } from '../helpers/cookies';

import type { DeclaredExperiment, ExperimentAssignments, ExperimentVariant } from './experiments';

/**
 * The cookie a tester forces variants with — what the dev tools' Experiments tab and an address's `?ab=` write.
 *
 * Apart from the visitor's own (`plitzi_ab`): forcing shows a variant without touching the one the visitor keeps, so
 * a tester's visit is never measured as a side it was not drawn. A session cookie, as the flags a tester forces are,
 * and only honoured where debugging is authorized — the server reads it only then, as the dev tools appear only then.
 */
export const forcedExperimentsCookieName = (host: string | undefined): string => {
  const port = host?.split(':')[1];

  return port ? `plitzi_ab_qa_${port}` : 'plitzi_ab_qa';
};

/** The address parameter a tester forces variants with: `?ab=heroTest:b,pricing:c`. */
export const FORCED_EXPERIMENTS_PARAM = 'ab';

/** The variants a tester forced, from a `Cookie` header or `document.cookie`. */
export const forcedExperimentsFromCookies = (
  cookies: string | undefined,
  host: string | undefined
): ExperimentAssignments => parseExperimentList(cookieFromHeader(cookies, forcedExperimentsCookieName(host)));

/** The variants an address forces (`?ab=`), over the ones the cookie forced before it. */
export const forcedExperimentsOf = (
  cookies: string | undefined,
  host: string | undefined,
  param: unknown
): ExperimentAssignments => ({
  ...forcedExperimentsFromCookies(cookies, host),
  ...(typeof param === 'string' ? parseExperimentList(param) : {})
});

/** What is forced once one experiment is forced to `variant` — or, with `undefined`, once it is no longer forced. */
export const withForcedExperiment = (
  forced: ExperimentAssignments,
  name: string,
  variant: ExperimentVariant | undefined
): ExperimentAssignments => {
  const { [name]: _previous, ...rest } = forced;

  return variant === undefined ? rest : { ...rest, [name]: variant };
};

export type ForcedExperiments = {
  /** The forced variants this space can show: an experiment it runs, a variant its test has. */
  applied: ExperimentAssignments;
  /** What was forced and cannot be shown, each with why — said to the tester, never applied. */
  ignored: { name: string; variant: ExperimentVariant; reason: 'undeclared' | 'no-such-variant' }[];
};

/** What a tester forced, held to the experiments the space runs and the variants each has. */
export const forcedExperimentsFor = (
  declared: Record<string, DeclaredExperiment>,
  forced: ExperimentAssignments
): ForcedExperiments => {
  const applied: ExperimentAssignments = {};
  const ignored: ForcedExperiments['ignored'] = [];
  for (const [name, variant] of Object.entries(forced)) {
    const experiment = Object.hasOwn(declared, name) ? declared[name] : undefined;
    if (!experiment) {
      ignored.push({ name, variant, reason: 'undeclared' });
    } else if (indexOfVariant(variant) >= experiment.weights.length) {
      ignored.push({ name, variant, reason: 'no-such-variant' });
    } else {
      applied[name] = variant;
    }
  }

  return { applied, ignored };
};

/** Keeps what a tester forced for the next page this browser asks for; nothing forced removes the cookie. */
export const writeForcedExperiments = (forced: ExperimentAssignments): void => {
  const name = forcedExperimentsCookieName(window.location.host);
  const value = serializeExperimentList(forced);
  try {
    // `SameSite=Lax` and no `max-age`, as a tester's session tool should be: gone with the browser session.
    document.cookie = value
      ? `${name}=${encodeURIComponent(value)};path=/;SameSite=Lax`
      : `${name}=;path=/;max-age=0;SameSite=Lax`;
  } catch {
    // Where cookies may not be written, forcing still holds for the page that is open.
  }
};
