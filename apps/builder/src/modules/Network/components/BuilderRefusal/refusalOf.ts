/** Why the builder could not open its space, as the person reads it: what happened, what to do, and the way out. */
export type BuilderRefusalKind = 'signedOut' | 'notFound' | 'unreachable' | 'outdated' | 'other';

export type BuilderRefusal = { kind: BuilderRefusalKind; title: string; description: string };

/**
 * The refusal a failed load reads as. A credential the server no longer takes and a session that ended are the same thing
 * to the person — sign in again — and a space they cannot reach is said as not found, as the API says it.
 */
export const refusalOf = (error: unknown): BuilderRefusal => {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const status =
    typeof error === 'object' && error !== null && 'statusCode' in error && typeof error.statusCode === 'number'
      ? error.statusCode
      : undefined;

  if (message === 'Failed to fetch') {
    return {
      kind: 'unreachable',
      title: 'The builder cannot reach Plitzi',
      description: 'Nothing answered: the network, or the platform, is down for now. Your work is kept on the server.'
    };
  }

  // Plitzi was released since this page was opened, past what it still takes from an older builder.
  if (status === 426) {
    return {
      kind: 'outdated',
      title: 'Plitzi was updated',
      description:
        'This builder is older than Plitzi takes now. Reload the page to load the current one: nothing you saved is lost.'
    };
  }

  if (status === 401 || /authenticat|not authorized|session|credential|token/i.test(message)) {
    return {
      kind: 'signedOut',
      title: 'Your session has ended',
      description: 'Sign in again and the builder opens where you were. Nothing you saved is lost.'
    };
  }

  if (status === 404 || status === 403 || /not found/i.test(message)) {
    return {
      kind: 'notFound',
      title: 'This space is not one you can open',
      description: 'It was deleted, moved to a workspace you are not in, or your access to it was taken back.'
    };
  }

  return {
    kind: 'other',
    title: 'The builder could not open this space',
    description: message ? `The server said: ${message}` : 'The server gave no reason.'
  };
};
