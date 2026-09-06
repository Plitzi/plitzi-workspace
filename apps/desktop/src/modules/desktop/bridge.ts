/**
 * What the renderer expects to find on `window.plitziDesktop`.
 *
 * Declared here, on the renderer's side, because the renderer is the one with a requirement: the preload exists
 * to satisfy it. Keeping it in `electron/` made the app's type surface depend on a directory the app is never
 * compiled with, and TypeScript said so.
 */
export type DesktopBridge = {
  platform: NodeJS.Platform;
  version: string;
  /** The stored session, as it was written. `undefined` when there is none, or when it could not be decrypted. */
  readSession: () => Promise<string | undefined>;
  writeSession: (value: string) => Promise<void>;
  clearSession: () => Promise<void>;
};
