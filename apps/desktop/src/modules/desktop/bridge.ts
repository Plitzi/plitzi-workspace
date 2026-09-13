/**
 * What the renderer expects to find on `window.plitziDesktop`.
 *
 * Declared here, on the renderer's side, because the renderer is the one with a requirement: the preload exists
 * to satisfy it. Keeping it in `electron/` made the app's type surface depend on a directory the app is never
 * compiled with, and TypeScript said so.
 */
/** What a sign-in through the browser answers with. Declared here for the reason {@link DesktopBridge} is: the
 *  renderer is the side with a requirement, and the preload exists to satisfy it. */
export type SignInReply =
  | { ok: true; clientId: string; accessToken: string; refreshToken?: string; expiresIn?: number }
  | { ok: false; reason: 'cancelled' | 'timeout' | 'refused'; error?: string };

export type DesktopBridge = {
  platform: NodeJS.Platform;
  version: string;
  /** The stored session, as it was written. `undefined` when there is none, or when it could not be decrypted. */
  readSession: () => Promise<string | undefined>;
  writeSession: (value: string) => Promise<void>;
  clearSession: () => Promise<void>;
  /**
   * Sign in through the person's browser, and come back with a session.
   *
   * It lives on the bridge rather than in the window because the flow needs a loopback listener and the system
   * browser — and because the window is then a place a password never reaches.
   */
  signIn: (apiUrl: string) => Promise<SignInReply>;
  /** Renew, at the same endpoint. `clientId` is part of it: a native client registers per flow, so renewing
   *  needs the registration the session was granted to. */
  renewSession: (apiUrl: string, clientId: string, refreshToken: string) => Promise<SignInReply>;
  /** End the grant, not just the session: the refresh token outlives a sign-out otherwise. */
  revokeSession: (apiUrl: string, clientId: string, refreshToken: string) => Promise<void>;
};
