import { onAuthFailure, sameRegistrableDomain } from '@plitzi/sdk-shared/auth';

import { readSessionHint } from './helpers/sessionHint';
import SessionStore from './helpers/SessionStore';
import { nowInSeconds, toSeconds, tokenExpiresAt } from './helpers/tokenClaims';

import type { SessionHint } from './helpers/sessionHint';
import type { StoredSession } from './helpers/SessionStore';
import type { AuthFailureReason, AuthResult, AuthState, Schema, TokenResult } from '@plitzi/sdk-shared';

export type AuthEvent =
  | { type: 'state'; state: AuthState }
  | { type: 'login'; token?: TokenResult }
  | { type: 'logout' }
  | { type: 'expired'; reason: AuthFailureReason };

export type AuthEventListener = (event: AuthEvent) => void;

/** What the rendering server already knows about this visitor, handed over so the browser does not re-ask. */
export type AuthBootstrap<U> = {
  user?: U;
  accessToken?: string;
  expiresAt?: number;
  skipAuth?: boolean;
};

export type AuthProviderProps = {
  tokenStorage?: Schema['settings']['tokenStorage'];
  sessionHintCookie?: Schema['settings']['sessionHintCookie'];
  sessionGate?: Schema['settings']['sessionGate'];
  sessionRevalidateSeconds?: Schema['settings']['sessionRevalidateSeconds'];
  storageKey?: string;
};

/** Renew this long before the token dies, so a request never leaves with a credential that expires in flight. */
const RENEWAL_SKEW_SECONDS = 60;

const DEFAULT_REVALIDATE_SECONDS = 300;

/** setTimeout truncates past this, firing immediately instead of in a month. */
const MAX_TIMEOUT_MS = 2_147_483_647;

/**
 * Everything about a session that does not depend on how a particular backend is spoken to: what is known, how long
 * it stays true, when to renew it, and what to do when it stops being true. A subclass supplies only the four
 * requests, so an auth backend is described rather than reimplemented.
 *
 * The design goal is that knowing whether someone is signed in should normally cost nothing. Three sources answer it
 * without a request — a server-rendered page's own answer, a stored session whose token has not lapsed, and the
 * session hint cookie — and the backend is asked only when none of them can, or when what they say has gone stale.
 */
abstract class AuthProvider<U = Record<string, unknown>> {
  abstract readonly name: string;

  protected state: AuthState = 'init';
  private session: { user?: U; token?: TokenResult; validatedAt: number } = { validatedAt: 0 };
  private readonly store: SessionStore<U>;
  private readonly gate: 'optimistic' | 'strict';
  private readonly hintCookie?: string;
  private readonly revalidateSeconds: number;
  private readonly listeners = new Set<AuthEventListener>();
  private renewal?: Promise<boolean>;
  private renewalTimer?: ReturnType<typeof setTimeout>;
  private detachListeners?: () => void;
  /** Set when a request failed to reach the backend, so the next `online` event retries instead of waiting. */
  private offline = false;

  constructor({
    tokenStorage = 'localStorage',
    sessionHintCookie,
    sessionGate = 'optimistic',
    sessionRevalidateSeconds = DEFAULT_REVALIDATE_SECONDS,
    storageKey = 'plitzi_auth_session'
  }: AuthProviderProps = {}) {
    this.store = new SessionStore<U>(tokenStorage, storageKey);
    this.gate = sessionGate;
    this.hintCookie = sessionHintCookie;
    this.revalidateSeconds = sessionRevalidateSeconds;
  }

  // What a backend has to be able to do. Everything above adapts to what is actually declared: a space that names no
  // refresh endpoint simply never renews, and one that names no identity endpoint relies on its grants to say who
  // signed in.
  protected abstract get capabilities(): { renew: boolean; identity: boolean };

  /** The backend's endpoints. Refusals reported from elsewhere are matched against these, so a session only reacts
   *  to the API that issued it. Empty means "unknown", and then every refusal is taken as ours. */
  protected get endpoints(): string[] {
    return [];
  }

  protected abstract requestLogin(params: Record<string, unknown>): Promise<AuthResult<U>>;
  protected abstract requestRenewal(refreshToken?: string): Promise<AuthResult<U>>;
  protected abstract requestIdentity(): Promise<AuthResult<U>>;
  protected abstract requestLogout(): Promise<void>;

  // Reads

  get user(): U | undefined {
    return this.session.user;
  }

  get token(): TokenResult | undefined {
    return this.session.token;
  }

  getState(): AuthState {
    return this.state;
  }

  can(permission: string): boolean {
    const permissions = (this.session.user as { permissions?: unknown } | undefined)?.permissions;

    return Array.isArray(permissions) && permissions.includes(permission);
  }

  // Lifecycle

  /**
   * Decides what this page already knows and what, if anything, it has to ask. Resolves once the answer is good
   * enough to render with — which under the default gate means as soon as a stored session says so, with the
   * confirmation happening behind the render rather than in front of it.
   */
  async init(bootstrap: AuthBootstrap<U> = {}): Promise<void> {
    this.attach();

    if (bootstrap.skipAuth) {
      this.setState('guest');

      return;
    }

    // The page was rendered by a server that resolved this visitor's identity for this very request. Asking again
    // would be putting the same question to the same authority a few milliseconds later.
    if (bootstrap.user) {
      this.adopt({
        ok: true,
        user: bootstrap.user,
        token: bootstrap.accessToken
          ? { accessToken: bootstrap.accessToken, expiresAt: bootstrap.expiresAt ?? null, refreshToken: null }
          : this.session.token
      });

      return;
    }

    const stored = this.store.read();
    const hint = readSessionHint(this.hintCookie);
    this.session = { user: stored?.user, token: stored?.token, validatedAt: stored?.validatedAt ?? 0 };

    // A configured hint is the browser's own answer about whether a session cookie lives here, and it outranks
    // storage in both directions: it appears when a sibling app signs in, and it is gone the moment one signs out.
    if (this.hintCookie && !hint) {
      this.endSession();

      return;
    }

    if (this.hasLiveToken() && this.session.user) {
      this.setState('authenticated');
      this.scheduleRenewal();

      const confirmation = this.isFresh() && this.gate !== 'strict' ? undefined : this.revalidate(true);
      if (this.gate === 'strict') {
        await confirmation;
      }

      return;
    }

    if (!this.sessionMayExist(hint)) {
      this.endSession();

      return;
    }

    this.setState('initLoading');

    // A live token with no user is the cheaper repair: identity reads, renewal rotates. Otherwise renewal is both
    // the repair and the answer, because a grant response says who it was granted to.
    if (this.hasLiveToken() && this.capabilities.identity) {
      await this.loadIdentity();

      return;
    }

    if (this.capabilities.renew) {
      await this.renew();

      return;
    }

    if (this.capabilities.identity) {
      await this.loadIdentity();

      return;
    }

    this.endSession();
  }

  /** Drops timers and window listeners. Called when the provider is replaced, so a re-configured space leaves none behind. */
  dispose(): void {
    clearTimeout(this.renewalTimer);
    this.renewalTimer = undefined;
    this.detachListeners?.();
    this.detachListeners = undefined;
  }

  // Actions

  async login(params: Record<string, unknown>): Promise<TokenResult | undefined> {
    this.setState('authenticating');
    const result = await this.requestLogin(params);
    if (!result.ok) {
      this.endSession(result.reason);

      return undefined;
    }

    this.adopt(result);

    if (!this.session.user && this.capabilities.identity) {
      await this.loadIdentity();
    }

    this.emit({ type: 'login', token: this.session.token });

    return this.session.token;
  }

  async refresh(): Promise<TokenResult | undefined> {
    await this.renew();

    return this.session.token;
  }

  /**
   * Confirms the session against the backend. Skipped when the last confirmation is recent enough and the token has
   * not lapsed, unless forced — which is what a caller does before an action it cannot take back.
   */
  async revalidate(force = false): Promise<boolean> {
    if (!force && this.isFresh() && this.hasLiveToken()) {
      return this.state === 'authenticated';
    }

    if (this.hasLiveToken() && this.capabilities.identity) {
      return this.loadIdentity();
    }

    if (this.capabilities.renew) {
      return this.renew();
    }

    if (this.capabilities.identity) {
      return this.loadIdentity();
    }

    // Nothing to ask: the token's own claim is the whole truth available here.
    if (!this.hasLiveToken()) {
      this.endSession('expired');
    }

    return this.state === 'authenticated';
  }

  /**
   * What an app calls when the backend refused a credential it just used. `expired` is renewable and silently is;
   * anything terminal ends the session here and now, without waiting for a timer to notice.
   */
  invalidate(reason: AuthFailureReason = 'expired'): void {
    if (reason === 'network') {
      this.offline = true;

      return;
    }

    if (reason === 'expired' && this.capabilities.renew) {
      void this.renew();

      return;
    }

    this.endSession(reason);
  }

  async logout(): Promise<void> {
    await this.requestLogout();
    this.endSession();
    this.emit({ type: 'logout' });
  }

  // Events

  on(listeners: AuthEventListener | AuthEventListener[]): () => void {
    const added = Array.isArray(listeners) ? listeners : [listeners];
    added.forEach(listener => this.listeners.add(listener));

    return () => added.forEach(listener => this.listeners.delete(listener));
  }

  protected emit(event: AuthEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  protected setState(state: AuthState): void {
    if (this.state !== state) {
      this.state = state;
      this.emit({ type: 'state', state });
    }
  }

  // Session bookkeeping

  /** Single-flight: a timer firing while a 401 is being handled must not rotate the refresh token twice. */
  private async renew(): Promise<boolean> {
    this.renewal ??= this.performRenewal().finally(() => {
      this.renewal = undefined;
    });

    return this.renewal;
  }

  private async performRenewal(): Promise<boolean> {
    const result = await this.requestRenewal(this.session.token?.refreshToken ?? undefined);
    if (!result.ok) {
      this.handleFailure(result.reason);

      return false;
    }

    this.adopt(result);

    // A backend that renews without saying who it renewed for leaves a live token and no identity behind it.
    if (!this.session.user && this.capabilities.identity) {
      return this.loadIdentity();
    }

    return this.state === 'authenticated';
  }

  private async loadIdentity(): Promise<boolean> {
    const result = await this.requestIdentity();
    if (!result.ok) {
      // `this.renewal` guards the one loop this could enter: a renewal that asks for identity, whose refusal asks
      // for a renewal.
      if (result.reason === 'expired' && this.capabilities.renew && !this.renewal) {
        return this.renew();
      }

      this.handleFailure(result.reason);

      return false;
    }

    this.adopt(result);

    return this.state === 'authenticated';
  }

  private handleFailure(reason: AuthFailureReason): void {
    // Nothing was answered, so nothing was learned. Signing someone out because their connection dropped is a bug
    // wearing the costume of a safety measure; hold what we have and retry when the browser says it is back.
    if (reason === 'network') {
      this.offline = true;

      return;
    }

    this.endSession(reason);
  }

  /** Takes on what a grant or an identity call returned, and records that the backend confirmed it just now. */
  private adopt(result: AuthResult<U> & { ok: true }, persist = true): void {
    this.session = {
      user: result.user ?? this.session.user,
      token: result.token ?? this.session.token,
      validatedAt: nowInSeconds()
    };
    this.offline = false;

    if (persist) {
      this.store.write(this.session);
    }

    this.scheduleRenewal();
    this.setState(this.session.user || this.hasLiveToken() ? 'authenticated' : 'guest');
  }

  /**
   * Ends the session locally. `reason` distinguishes an expiry the client discovered from a sign-out the person
   * asked for; both clear the same state, but only the first is something the app may want to react to.
   *
   * The cleared entry is written back rather than removed, because "nobody is signed in, confirmed just now" is
   * worth remembering: it is what keeps a signed-out visitor from paying for the same refused request on every load.
   */
  private endSession(reason?: AuthFailureReason): void {
    clearTimeout(this.renewalTimer);
    this.renewalTimer = undefined;
    this.session = { validatedAt: nowInSeconds() };
    this.store.write(this.session);
    this.setState('guest');

    if (reason) {
      this.emit({ type: 'expired', reason });
    }
  }

  // Local knowledge

  /** Unix seconds this session's access token dies at, from what the backend said or, failing that, from the token. */
  private expiresAt(): number | undefined {
    return toSeconds(this.session.token?.expiresAt) ?? tokenExpiresAt(this.session.token?.accessToken);
  }

  private hasLiveToken(): boolean {
    if (!this.session.token?.accessToken) {
      return false;
    }

    const expiresAt = this.expiresAt();

    // A token whose lifetime nobody states is taken at face value; the backend will say if it disagrees.
    return expiresAt === undefined || expiresAt - RENEWAL_SKEW_SECONDS > nowInSeconds();
  }

  private isFresh(): boolean {
    return nowInSeconds() - this.session.validatedAt < this.revalidateSeconds;
  }

  /** Whether asking the backend could plausibly turn up a session. When it could not, nothing is asked at all. */
  private sessionMayExist(hint?: SessionHint): boolean {
    // Configured, the hint is authoritative in both directions — and the caller already handled its absence.
    if (this.hintCookie) {
      return true;
    }

    if (this.session.token?.accessToken || this.session.token?.refreshToken) {
      return true;
    }

    // Nothing stored and no hint published: the browser may still hold a session cookie, and only the backend can
    // say. Ask — but no more often than the revalidate window, so being signed out costs one request, not one per
    // page load. Publishing a hint cookie removes even that one.
    return !this.isFresh() || !!hint;
  }

  // Renewal timing

  private scheduleRenewal(): void {
    clearTimeout(this.renewalTimer);
    this.renewalTimer = undefined;

    const expiresAt = this.expiresAt();
    if (expiresAt === undefined || typeof window === 'undefined' || this.state === 'guest') {
      return;
    }

    const delay = Math.min((expiresAt - RENEWAL_SKEW_SECONDS - nowInSeconds()) * 1000, MAX_TIMEOUT_MS);
    if (delay <= 0) {
      this.onRenewalDue();

      return;
    }

    this.renewalTimer = setTimeout(() => this.onRenewalDue(), delay);
  }

  // Expiry is not a reason to sign anyone out when something can renew it — which is the whole point of a short
  // access token. Only a session nothing can renew actually ends here.
  private onRenewalDue(): void {
    if (this.capabilities.renew) {
      void this.renew();

      return;
    }

    this.endSession('expired');
  }

  // Reacting to the world outside this tab

  private attach(): void {
    if (typeof window === 'undefined' || this.detachListeners) {
      return;
    }

    // A backgrounded tab has its timers throttled and a laptop that slept ran none at all, so the moment a page is
    // looked at again is the moment its session is most likely to be stale.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void this.revalidate();
      }
    };

    const onOnline = () => {
      if (this.offline) {
        void this.revalidate(true);
      }
    };

    const unsubscribe = this.store.subscribe(stored => this.adoptFromStorage(stored));
    // Whatever request just got refused knows about this session sooner than any timer does.
    const unsubscribeFailures = onAuthFailure(({ reason, url }) => {
      const endpoints = this.endpoints.filter(Boolean);
      if (endpoints.length === 0 || endpoints.some(endpoint => sameRegistrableDomain(endpoint, url))) {
        this.invalidate(reason);
      }
    });
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);

    this.detachListeners = () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
      unsubscribe();
      unsubscribeFailures();
    };
  }

  /**
   * Another tab changed the session. Adopting it rather than re-checking is the point: two tabs that each renewed on
   * their own would rotate the refresh token out from under each other, and the one that lost would sign its user
   * out over nothing.
   */
  private adoptFromStorage(stored?: StoredSession<U>): void {
    if (!stored?.token && !stored?.user) {
      clearTimeout(this.renewalTimer);
      this.renewalTimer = undefined;
      this.session = { validatedAt: nowInSeconds() };
      this.setState('guest');
      this.emit({ type: 'logout' });

      return;
    }

    this.adopt({ ok: true, user: stored.user, token: stored.token }, false);
  }
}

export default AuthProvider;
