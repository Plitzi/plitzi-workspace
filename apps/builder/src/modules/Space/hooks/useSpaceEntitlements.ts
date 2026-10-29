import { useEffect, useMemo, useState } from 'react';

import { isIncluded, mayDo } from '@plitzi/sdk-shared/network';
import useBuilderNetwork from '@pmodules/Network/hooks/useBuilderNetwork';

import type { TCapability, TSpaceAccess, TSpaceEntitlements } from '@plitzi/sdk-shared/network';

/** What the server answered of a space: its plan, and what the person's role there allows. */
type SpaceAnswer = { entitlements?: TSpaceEntitlements; access?: TSpaceAccess };

/**
 * Read once per space and kept: a plan changes when someone pays, and the server refuses whatever the builder believed
 * in the meantime — this only decides what is shown locked before anyone runs into the refusal.
 */
const asked = new Map<string, Promise<SpaceAnswer>>();

const fetchAnswer = async (url: string, userKey: string): Promise<SpaceAnswer> => {
  try {
    const response = await fetch(url, { credentials: 'include', headers: { 'plitzi-access-token': userKey } });
    if (!response.ok) {
      return {};
    }

    // The server's JSON, read as the contract it answers; each field is checked where it is used (`isIncluded`, `mayDo`).
    return (await response.json()) as SpaceAnswer;
  } catch {
    // A server that answers none — self-hosted, or unreachable for a moment — means everything is included and allowed.
    return {};
  }
};

/** The space's answer, asked once per space and shared by every hook below. */
const useSpaceAnswer = (): SpaceAnswer => {
  const { server, userKey, webId } = useBuilderNetwork();
  const [answer, setAnswer] = useState<SpaceAnswer>({});

  useEffect(() => {
    if (!server.apiServer || !webId) {
      return;
    }

    const url = `${server.apiServer}/spaces/${webId}/entitlements`;
    const pending = asked.get(url) ?? fetchAnswer(url, userKey);
    asked.set(url, pending);
    let current = true;
    void pending.then(next => {
      if (current) {
        setAnswer(next);
      }
    });

    return () => {
      current = false;
    };
  }, [server.apiServer, userKey, webId]);

  return answer;
};

/**
 * What the person's role on the space allows: the builder offers that and nothing the server would refuse —
 * everything, until the server says otherwise.
 */
export const useSpaceAccess = () => {
  const { access } = useSpaceAnswer();

  return useMemo(
    () => ({
      access,
      may: (permission: string): boolean => mayDo(access, permission)
    }),
    [access]
  );
};

/** What the space's plan includes, and the way to what it does not. Everything, until the server says otherwise. */
const useSpaceEntitlements = () => {
  const { entitlements } = useSpaceAnswer();

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
