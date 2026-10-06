import type { AuthProviderSettings } from '../types';
import type { ServerAuth } from '@plitzi/sdk-shared';

/** The settings a server describes, each filling in only what the space left undeclared. */
const DESCRIBED = ['loginUrl', 'userUrl', 'refreshUrl', 'logoutUrl', 'mfaUrl', 'sessionHintCookie'] as const;

export type ResolvedAuthSettings = { provider: string; settings: AuthProviderSettings };

/**
 * One provider for the page, from the two places that can name it: what the space declares, and what the server that
 * rendered it serves (`server.auth`).
 *
 * The space wins, setting by setting — an empty value is one nobody filled in, as the builder's settings leave it.
 * A space that names a different provider than the server's ignores the server altogether: that description is of
 * another backend, and a hint cookie or an endpoint borrowed from it would be read against the wrong one.
 */
export const resolveAuthSettings = (
  declaredProvider: string | undefined,
  declared: AuthProviderSettings,
  server: ServerAuth | undefined
): ResolvedAuthSettings => {
  if (!server || (declaredProvider && declaredProvider !== server.userProvider)) {
    return { provider: declaredProvider ?? '', settings: declared };
  }

  const settings: AuthProviderSettings = { ...declared };
  for (const key of DESCRIBED) {
    if (!settings[key]) {
      settings[key] = server[key];
    }
  }

  return { provider: server.userProvider, settings };
};
