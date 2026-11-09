import type { SSRActionConfig } from '../types';

/** Where a page server's pages call their actions when it is not told: this path, on their own origin. */
export const DEFAULT_ACTION_PATH = '/_action';

/** What a page is told of its actions: their path on its own origin, or their address on `action.origin`. */
export const publishedActionEndpoint = (action: Pick<SSRActionConfig, 'origin' | 'path'> | undefined): string => {
  const path = action?.path ?? DEFAULT_ACTION_PATH;

  return action?.origin ? `${action.origin}${path}` : path;
};

/** An origin as a browser sends it: a scheme, a host and a port, nothing after. */
const originProblem = (origin: string, setting: string): string | undefined => {
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return `\`${setting}\` is "${origin}", which is not an address: write an origin, like https://actions.example.com`;
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) {
    return `\`${setting}\` is "${origin}": write the origin alone, as a browser sends it — ${parsed.origin}`;
  }

  return undefined;
};

/**
 * What is wrong with an engine's actions on another origin, or nothing: `action.origin` an origin and, for the worker
 * that serves them, the pages that call it named (`action.pageOrigins`) — a worker on another origin with none would
 * refuse every page, or, answering any, let every site call with a visitor's cookies. A page server is told only where
 * to call.
 */
export const actionOriginProblem = (
  action: SSRActionConfig | undefined,
  served: 'pages' | 'worker'
): string | undefined => {
  if (!action?.origin) {
    return action?.pageOrigins?.length
      ? '`action.pageOrigins` names the pages that call the actions on another origin, and `action.origin` is not set: ' +
          'set it to where they are served, or drop `pageOrigins` (a page calls its own origin)'
      : undefined;
  }

  const own = originProblem(action.origin, 'action.origin');
  if (own) {
    return own;
  }

  if (served === 'pages') {
    return undefined;
  }

  if (!action.pageOrigins?.length) {
    return (
      `The actions are served on another origin than the pages' (\`action.origin\` ${action.origin}), and ` +
      '`action.pageOrigins` names none of the pages that call them: name their origins, which its CORS answers with ' +
      'credentials and its cross-site check takes as its own'
    );
  }

  return action.pageOrigins.map(origin => originProblem(origin, 'action.pageOrigins')).find(Boolean);
};
