import { CLIENT_HEADER, clientHeaderValue, CURRENT_HEADER } from '@plitzi/sdk-shared/clients';
import { isRecord } from '@plitzi/sdk-shared/helpers';

import packageSettings from '../../../../package.json';

/**
 * What the platform says of this builder's version (`@plitzi/sdk-shared/clients`): a builder older than the platform —
 * a tab left open across a release — is answered and told what is current, once; one older than the platform takes is
 * refused (426) and has to be reloaded. Heard on whichever request comes back with it, said by the network provider.
 */
export type PlatformHeard = { kind: 'behind'; current: string } | { kind: 'outdated'; message: string };

type Listener = (heard: PlatformHeard) => void;

const listeners = new Set<Listener>();
let toldCurrent: string | undefined;

export const onPlatformVersion = (listener: Listener): (() => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

/** A version heard: said to every listener, a `behind` once for each version of the platform. */
export const hearPlatform = (heard: PlatformHeard): void => {
  if (heard.kind === 'behind') {
    if (toldCurrent === heard.current) {
      return;
    }

    toldCurrent = heard.current;
  }

  listeners.forEach(listener => {
    listener(heard);
  });
};

/** A fetch that hears the platform's version on every answer it brings back. */
export const versionedFetch =
  <Init>(fetchImpl: (input: URL | RequestInfo, init?: Init) => Promise<Response>) =>
  async (input: URL | RequestInfo, init?: Init): Promise<Response> => {
    const response = await fetchImpl(input, init);
    const current = response.headers.get(CURRENT_HEADER);
    if (current) {
      hearPlatform({ kind: 'behind', current });
    }

    return response;
  };

/**
 * A request of the builder's to the platform's API: it says which builder it is, as its GraphQL link does, and hears
 * the platform's version on the answer — every call the builder makes past GraphQL goes through it.
 */
export const platformFetch = versionedFetch(async (input: URL | RequestInfo, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  headers.set(CLIENT_HEADER, clientHeaderValue('builder', packageSettings.version));
  const response = await fetch(input, { ...init, headers });
  // Older than the platform takes: what the caller reads is refused, and the builder says to reload — as over GraphQL.
  if (response.status === 426) {
    const body: unknown = await response
      .clone()
      .json()
      .catch(() => undefined);
    hearPlatform({
      kind: 'outdated',
      message:
        isRecord(body) && typeof body.error === 'string' ? body.error : 'This builder is older than Plitzi takes.'
    });
  }

  return response;
});
