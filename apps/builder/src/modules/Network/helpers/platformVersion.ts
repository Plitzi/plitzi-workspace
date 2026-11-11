import { CURRENT_HEADER } from '@plitzi/sdk-shared/clients';

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
