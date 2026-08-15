import type { OfflineDataRaw } from '@plitzi/sdk-shared';

/** What a spec drives the harness through. Deliberately tiny: hand it a space, get a promise that settles once
 *  React has committed the render, then assert against the page like any other. */
export type HarnessApi = {
  render: (offlineData: OfflineDataRaw) => Promise<void>;
  reset: () => Promise<void>;
};

declare global {
  interface Window {
    plitziHarness?: HarnessApi;
  }
}

export type HarnessState = {
  /** Bumped on every render so React remounts the SDK instead of reconciling into the previous space. */
  nonce: number;
  offlineData: OfflineDataRaw;
};
