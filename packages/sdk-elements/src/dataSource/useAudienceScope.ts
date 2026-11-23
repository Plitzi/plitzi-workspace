import { use, useEffect, useMemo } from 'react';

import { AuthContext } from '@plitzi/sdk-auth';
import { browserVisitorFacts, keepFirstSeen } from '@plitzi/sdk-shared/audiences';
import { flagUserFrom } from '@plitzi/sdk-shared/flags';
import { useCommonStore, useRenderSettings } from '@plitzi/sdk-shared/store';

import type { AuthContextValue } from '@plitzi/sdk-shared';
import type { AudienceScope, VisitorFacts } from '@plitzi/sdk-shared/audiences';

/** What a render with no visitor to read assumes of them: a server rendering a space it was not handed facts for. */
const NO_VISITOR: VisitorFacts = { returning: false, language: '', device: 'desktop', country: '' };

/**
 * What an audience's rules are matched against here: what a flag's are — the environment, the host, the address, who is
 * signed in — and the visitor's facts. The server's, when it drew the page (the page hydrates with them); read in the
 * browser otherwise, once per page. Outside the builder, the visitor is told for their next visits when they came first.
 */
const useAudienceScope = (): AudienceScope => {
  const { environment, builder } = useRenderSettings();
  const [[hostname, routeParams, queryParams, served]] = useCommonStore([
    'navigation.hostname',
    'navigation.routeParams',
    'navigation.queryParams',
    'visitor'
  ]);
  // Read as partial: with no provider mounted the context is its default `{}`, whatever its type promises.
  const { authenticated, user }: Partial<AuthContextValue> = use(AuthContext);
  const visitor = useMemo(
    () => served ?? (typeof window === 'undefined' ? NO_VISITOR : browserVisitorFacts()),
    [served]
  );

  useEffect(() => {
    if (!builder) {
      keepFirstSeen();
    }
  }, [builder]);

  return useMemo(
    () => ({
      environment,
      hostname,
      routeParams,
      queryParams,
      user: flagUserFrom({ authenticated, user }),
      visitor
    }),
    [environment, hostname, routeParams, queryParams, authenticated, user, visitor]
  );
};

export default useAudienceScope;
