import { useMemo } from 'react';

import useStableValue from '../hooks/useStableValue';
import { useCommonStore, useRenderSettings } from '../store';
import { resolveFlags } from './resolveFlags';

import type { AuthContextValue } from '../types';
import type { FlagResolution, FlagUser } from './resolveFlags';

/** The visitor as a flag's rule sees them, from what auth knows. */
export const flagUserFrom = ({ authenticated, user }: Partial<Pick<AuthContextValue, 'authenticated' | 'user'>>) => {
  const details = user?.details;
  const flagUser: FlagUser = { authenticated: authenticated === true };
  if (!details) {
    return flagUser;
  }

  return { ...flagUser, email: details.email, username: details.username, roles: details.roles };
};

/**
 * Every declared flag, resolved for where this render is and who is looking.
 *
 * What the `flags` source every element reads is published from. The router cannot wait for that source — it decides
 * whether the page is gated off before any child renders — so it calls `resolveFlags` itself, with the same inputs.
 * Stable while nothing changed, so the source is not written again on every navigation.
 */
const useFlagResolution = (
  auth: Partial<Pick<AuthContextValue, 'authenticated' | 'user'>>
): Record<string, FlagResolution> => {
  const { environment } = useRenderSettings();
  const [[declared, routeParams, queryParams, hostname, overrides]] = useCommonStore([
    'schema.flags',
    'navigation.routeParams',
    'navigation.queryParams',
    'navigation.hostname',
    'flags.overrides'
  ]);
  const { authenticated, user } = auth;
  const flagUser = useMemo(() => flagUserFrom({ authenticated, user }), [authenticated, user]);

  return useStableValue(
    useMemo(
      () => resolveFlags(declared, { environment, hostname, routeParams, queryParams, user: flagUser }, overrides),
      [declared, environment, hostname, routeParams, queryParams, flagUser, overrides]
    )
  );
};

export default useFlagResolution;
