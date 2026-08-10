import BasicAuthProvider from './providers/BasicAuthProvider';

import type AuthProvider from './AuthProvider';
import type { AuthBootstrap, AuthEventListener } from './AuthProvider';
import type { AuthProviderSettings } from './types';
import type { AuthFailureReason, AuthState, TokenResult } from '@plitzi/sdk-shared';

export type AuthProviderFactory<U = Record<string, unknown>> = (settings: AuthProviderSettings) => AuthProvider<U>;

// A factory rather than a constructor, so a provider that needs something the settings do not carry — an SDK client,
// a shared instance — closes over it instead of forcing it into everyone else's signature.
const providers = new Map<string, AuthProviderFactory>([['basic', settings => new BasicAuthProvider(settings)]]);

/**
 * Adds an auth provider a space can then select by name in its settings. Spaces run against whichever backend their
 * owner has — `basic` covers any HTTP+JSON API by configuration alone, and this is the way out for the ones it does
 * not: register before the SDK mounts, and `userProvider: '<name>'` picks it up.
 */
export const registerAuthProvider = <U = Record<string, unknown>>(
  name: string,
  factory: AuthProviderFactory<U>
): void => {
  providers.set(name, factory as AuthProviderFactory);
};

export const getAuthProviderNames = (): string[] => [...providers.keys()];

/**
 * Holds the provider a space selected and forwards to it. Its reason for existing is that the provider is chosen at
 * runtime from the schema: everything above this line talks to one object whether the space authenticates against
 * Plitzi, against Auth0, or against something the customer registered.
 */
export class AuthManager<U = Record<string, unknown>> {
  private readonly providerType: string;
  private readonly provider?: AuthProvider<U>;
  private readonly settings: AuthProviderSettings;

  private readonly listeners: AuthEventListener[];

  constructor(
    providerType: string,
    listeners: AuthEventListener | AuthEventListener[],
    settings: AuthProviderSettings
  ) {
    this.providerType = providerType;
    this.settings = settings;
    this.listeners = Array.isArray(listeners) ? listeners : [listeners];
    const factory = providers.get(providerType) as AuthProviderFactory<U> | undefined;
    if (factory) {
      this.provider = factory(settings);
      this.provider.on(this.listeners);
    }
  }

  // Reads

  getProviderType(): string {
    return this.providerType;
  }

  getProvider(): AuthProvider<U> | undefined {
    return this.provider;
  }

  getState(): AuthState {
    return this.provider?.getState() ?? 'guest';
  }

  /**
   * What this browser can be seen to hold before anything has run.
   *
   * Answered even when no provider has been named yet, which is the state every page is in while its schema loads:
   * where the credential is kept is a matter of settings — the storage key, the hint cookie — and not of which
   * provider will end up using it, so it can be read now. Doing that read only after the schema arrived is what
   * made a signed-in page paint its signed-out version first on every reload.
   */
  peekState(): AuthState {
    return this.peek().state;
  }

  peek(): { state: AuthState; user?: U; token?: TokenResult } {
    return (this.provider ?? new BasicAuthProvider<U>(this.settings)).peek();
  }

  can(permission: string): boolean {
    return this.provider?.can(permission) ?? false;
  }

  // Actions

  /**
   * A space that names no provider — a widget, an offline render, anything that does not sign people in — has no
   * session to settle, and must say so. Without this it never reports a state at all, and a caller waiting for one
   * (the SDK holds its whole tree back until auth has decided) waits forever and renders nothing.
   *
   * What it must not say is that nobody is signed in when the server just rendered this page for somebody. There are
   * two ways to arrive here holding a bootstrap: a space that genuinely names no provider, and — the common one — a
   * space whose schema has not loaded yet, because `userProvider` is read from it and is empty for the first render
   * of every page that fetches its schema over the network. Answering `guest` there contradicted the HTML that had
   * just been sent: the page flipped to its signed-out version, then back once the schema arrived and a real
   * provider adopted the same identity. The server's answer stands until something that can actually check it
   * disagrees.
   */
  init(bootstrap?: AuthBootstrap<U>): Promise<void> {
    if (!this.provider) {
      // Nothing here can confirm a session, but it can still see one. The order is what the page must not
      // contradict: what the server resolved for this request, then what this browser demonstrably holds, and only
      // failing both, nobody. A flat `guest` here claimed the last of those on the strength of the first two never
      // having been looked at.
      const seen = this.peekState();
      const state: AuthState = bootstrap?.user || seen === 'authenticated' ? 'authenticated' : 'guest';
      this.listeners.forEach(listener => listener({ type: 'state', state, reason: 'no-provider' }));

      return Promise.resolve();
    }

    return this.provider.init(bootstrap);
  }

  login(...args: Parameters<AuthProvider<U>['login']>): Promise<TokenResult | undefined> {
    return this.provider?.login(...args) ?? Promise.resolve(undefined);
  }

  refresh(): Promise<TokenResult | undefined> {
    return this.provider?.refresh() ?? Promise.resolve(undefined);
  }

  revalidate(force?: boolean): Promise<boolean> {
    return this.provider?.revalidate(force) ?? Promise.resolve(false);
  }

  invalidate(reason?: AuthFailureReason): void {
    this.provider?.invalidate(reason);
  }

  logout(): Promise<void> {
    return this.provider?.logout() ?? Promise.resolve();
  }

  dispose(): void {
    this.provider?.dispose();
  }

  on(listener: AuthEventListener): (() => void) | undefined {
    return this.provider?.on(listener);
  }
}
