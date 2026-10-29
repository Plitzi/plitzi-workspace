import { useEffect, useState } from 'react';

import useBuilderNetwork from '@pmodules/Network/hooks/useBuilderNetwork';

/** What taking the next snapshot of an environment would remove, as the server answers it (RFC 0029 §6.1). */
export type NextPrune = {
  /** Unpublished snapshots the space's plan keeps. */
  keep: number;
  removes: { environment: string; revision: number; publishedAt: string }[];
};

/**
 * What the next snapshot of `environment` would remove — asked whenever the environment changes. Nothing when the
 * server does not answer it (a self-hosted server keeps every snapshot).
 */
const useNextPrune = (environment: string): NextPrune | undefined => {
  const { server, userKey, webId } = useBuilderNetwork();
  const [answer, setAnswer] = useState<NextPrune | undefined>();

  useEffect(() => {
    if (!server.apiServer || !webId) {
      return;
    }

    const controller = new AbortController();
    const url = `${server.apiServer}/spaces/${webId}/snapshots/next-prune?environment=${encodeURIComponent(environment)}`;
    fetch(url, { credentials: 'include', headers: { 'plitzi-access-token': userKey }, signal: controller.signal })
      .then(async response => (response.ok ? ((await response.json()) as NextPrune) : undefined))
      .then(setAnswer)
      .catch(() => setAnswer(undefined));

    return () => controller.abort();
  }, [environment, server.apiServer, userKey, webId]);

  return answer;
};

export default useNextPrune;
