import { useEffect, useMemo, useState } from 'react';

import { isIncluded } from '@plitzi/sdk-shared/network';
import useBuilderNetwork from '@pmodules/Network/hooks/useBuilderNetwork';

import type { TCapability, TSpaceEntitlements } from '@plitzi/sdk-shared/network';

/**
 * Read once per space and kept: a plan changes when someone pays, and the server refuses whatever the builder believed
 * in the meantime — this only decides what is shown locked before anyone runs into the refusal (RFC 0029 §7.4).
 */
const asked = new Map<string, Promise<TSpaceEntitlements | undefined>>();

const fetchEntitlements = async (url: string, userKey: string): Promise<TSpaceEntitlements | undefined> => {
  try {
    const response = await fetch(url, { credentials: 'include', headers: { 'plitzi-access-token': userKey } });
    if (!response.ok) {
      return undefined;
    }

    const body = (await response.json()) as { entitlements?: TSpaceEntitlements };

    return body.entitlements;
  } catch {
    // A server that answers none — self-hosted, or unreachable for a moment — means everything is included.
    return undefined;
  }
};

/** What the space's plan includes, and the way to what it does not. Everything, until the server says otherwise. */
const useSpaceEntitlements = () => {
  const { server, userKey, webId } = useBuilderNetwork();
  const [entitlements, setEntitlements] = useState<TSpaceEntitlements | undefined>();

  useEffect(() => {
    if (!server.apiServer || !webId) {
      return;
    }

    const url = `${server.apiServer}/spaces/${webId}/entitlements`;
    const pending = asked.get(url) ?? fetchEntitlements(url, userKey);
    asked.set(url, pending);
    let current = true;
    void pending.then(answer => {
      if (current) {
        setEntitlements(answer);
      }
    });

    return () => {
      current = false;
    };
  }, [server.apiServer, userKey, webId]);

  return useMemo(
    () => ({
      entitlements,
      included: (capability: string): boolean => isIncluded(entitlements, capability),
      /** What the plan says of a capability it does not include: its words, the plan that does and the link. */
      locked: (capability: string): TCapability | undefined => {
        const said = entitlements?.capabilities[capability];

        return said && !said.included ? said : undefined;
      }
    }),
    [entitlements]
  );
};

export default useSpaceEntitlements;
