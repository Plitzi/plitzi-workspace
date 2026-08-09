import { onAuthFailure, sameRegistrableDomain } from '@plitzi/sdk-shared/auth';

import { readSessionHint } from './helpers/sessionHint';
import SessionStore from './helpers/SessionStore';
import { nowInSeconds, toSeconds, tokenExpiresAt } from './helpers/tokenClaims';

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
  /** The credential naming the space this SDK instance renders, forwarded on requests made on the space's behalf —
   *  the exchange is one, since only the space can say which identity provider its credentials may come from. */
  spaceKey?: string;
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

  protected readonly spaceKey: string;

  constructor({
    spaceKey = '',
    tokenStorage = 'localStorage',
    sessionHintCookie,
    sessionGate = 'optimistic',
    sessionRevalidateSeconds = DEFAULT_REVALIDATE_SECONDS,
    storageKey = 'plitzi_auth_session'
  }: AuthProviderProps = {}) {
    this.spaceKey = spaceKey;
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

  /**
   * Hands the credential this browser just obtained to the rendering server, so it can establish a session of its
   * own — see `handOffToServer`. Returning undefined, the default, means this provider's grants already come from
   * the server and there is nothing to hand over.
   */
  protected requestExchange(): Promise<AuthResult<U> | undefined> {
    return Promise.resolve(undefined);
  }

  /**
   * A grant waiting in the current URL, for providers whose sign-in is a redirect rather than a request: OAuth and
   * OIDC (Auth0 among them) send the browser away and bring it back with a code to exchange. That is the freshest
   * evidence a page can have, so it is consulted before anything stored — and it is the provider's job to clean the
   * code out of the URL once taken.
   *
   * Returning undefined, the default, means this provider does not sign in by redirect.
   */
  protected consumeRedirect(): Promise<AuthResult<U> | undefined> {
    return Promise.resolve(undefined);
  }

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
    await this.decide(bootstrap);
    this.settle();
  }

  /**
   * No path may leave a page waiting. Every branch below either settles the state itself or comes back through here,
   * so a backend that answers something nobody anticipated costs a visitor a wrong guess about their session — never
   * a page that renders nothing at all.
   */
  private settle(): void {
    if (this.state === 'init' || this.state === 'initLoading') {
      this.setState(this.session.user || this.hasLiveToken() ? 'authenticated' : 'guest');
    }
  }

  private async decide(bootstrap: AuthBootstrap<U>): Promise<void> {
    if (bootstrap.skipAuth) {
      this.setState('guest');

      return;
    }

    // Coming back from an identity provider outranks everything below, including a server-rendered answer: the page
    // was rendered before this person finished signing in.
    const redirected = await this.consumeRedirect();
    if (redirected) {
      if (redirected.ok) {
        this.adopt(redirected);
        await this.handOffToServer();
        this.emit({ type: 'login', token: this.session.token });
      } else {
        this.endSession(redirected.reason);
      }

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

    if (!this.hasEvidence()) {
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
    await this.handOffToServer();

    // The hand-off can end the session outright — the server refused the credential — and there is then nothing
    // left to fill in and nobody to ask about.
    if (this.state === 'guest') {
      return undefined;
    }

    if (!this.session.user && this.capabilities.identity) {
      await this.loadIdentity();
    }

    this.emit({ type: 'login', token: this.session.token });

    return this.session.token;
  }

  /**
   * A credential obtained in the browser — by a client-side identity provider, or by a redirect coming back from
   * one — is unknown to the server that renders the pages. It therefore renders every one of them as a guest while
   * the browser knows perfectly well who this is, and the page changes under the visitor the moment it hydrates.
   *
   * Handing the credential over closes that gap: the server verifies it with the provider and establishes its own
   * session, cookie and all, so the next server-rendered page already knows. Providers whose grants came from that
   * same server return undefined here and nothing happens.
   */
  private async handOffToServer(): Promise<void> {
    const exchanged = await this.requestExchange();
    if (!exchanged) {
      return;
    }

    if (exchanged.ok) {
      // The server's own session supersedes: it is the one its cookies and its renderer will honour.
      this.adopt(exchanged);

      return;
    }

    // Nothing was learned — try again on the next revalidation rather than throwing away a good sign-in.
    if (exchanged.reason === 'network') {
      this.offline = true;

      return;
    }

    // The server will not accept this credential. Whatever the identity provider thinks, a session the backend
    // refuses cannot load a page or call an API, so it ends here instead of failing on every later request.
    this.endSession(exchanged.reason);
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
    // No sign of a session, so there is nothing to confirm and nobody worth asking. This is the guard that keeps a
    // signed-out visitor from firing a refused request every time they come back to the tab.
    if (!this.hasEvidence()) {
      if (this.state !== 'guest') {
        this.endSession();
      }

      return false;
    }

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

  /**
   * Whether this browser shows any sign of holding a session: a stored credential, or the hint cookie the backend
   * publishes beside its httpOnly one.
   *
   * **Nothing is ever asked without it.** A page that calls an API "just in case" gets a 401 for every signed-out
   * visitor on every load and every tab focus — noise in the logs that says nothing, and a request that could never
   * have succeeded. Evidence is cheap to produce and the backend decides whether it is any good.
   *
   * The hint is read live rather than at boot, so a sign-in that happened in another app on this domain is picked
   * up by the next revalidation instead of waiting for a reload.
   */
  private hasEvidence(): boolean {
    if (this.session.token?.accessToken || this.session.token?.refreshToken) {
      return true;
    }

    return !!readSessionHint(this.hintCookie);
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
