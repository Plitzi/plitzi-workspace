import type { OfflineDataRaw, ThemeScope } from '@plitzi/sdk-shared';

/** How the SDK is mounted, beyond which space it shows. Every field left out is the SDK's own default. */
export type HarnessRenderOptions = {
  /** `container` mounts the space the way an application with a theme of its own does — the desktop window. */
  themeScope?: ThemeScope;
};

/** What a spec drives the harness through. Deliberately tiny: hand it a space, get a promise that settles once
 *  React has committed the render, then assert against the page like any other. */
export type HarnessApi = {
  render: (offlineData: OfflineDataRaw, options?: HarnessRenderOptions) => Promise<void>;
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
  options: HarnessRenderOptions;
};
