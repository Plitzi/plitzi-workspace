import type { SSRRequest, SSRResponseHelpers } from './ServerTypes';

/** A key/value store with per-entry expiry, backing the OAuth layer's short-lived protocol state (registered
 *  clients, authorization codes, refresh grants). Values are opaque strings the SDK serialises itself. A
 *  multi-replica deployment MUST inject a shared implementation — a code minted on one replica is redeemed on
 *  whichever replica the token request lands on. */
export type OAuthStore = {
  put: (key: string, value: string, ttlSeconds: number) => void | Promise<void>;
  get: (key: string) => (string | undefined) | Promise<string | undefined>;
  drop: (key: string) => void | Promise<void>;
};

/** Someone who got through {@link OAuthAdapters.authenticate}. `id` is what the other adapters key off; `label`
 *  is shown back on the consent screen so the user can see who they are about to grant access as. */
export type OAuthUser = {
  id: string;
  label: string;
};

/** One thing the user may grant the client access to — a Plitzi space, or whatever else a deployment scopes its
 *  tokens by. `value` is the opaque handle the SDK round-trips back to {@link OAuthAdapters.issueToken}; only the
 *  consumer interprets it. A deployment whose public surface is useful on its own (plitzi_render needs no space)
 *  can offer a target that grants nothing, so the user is never forced to pick one. */
export type OAuthGrantTarget = {
  value: string;
  label: string;
  description?: string;
};

/** What the OAuth layer cannot resolve on its own: who the user is, what they may grant, and the bearer to mint
 *  for them. The SDK owns the protocol (discovery, registration, PKCE, code exchange); the consumer owns identity
 *  and issues a token its own `adapters.getGrant` will accept back. */
export type OAuthAdapters = {
  /**
   * Who the browser making this request already is, from whatever session it carries.
   *
   * This server has no sign-in of its own: it reads an existing session and sends anyone it cannot identify to
   * {@link OAuthConfig.signInUrl}, which brings them back. That is what lets a deployment have ONE sign-in screen
   * for every surface — and it is what makes SSO somebody else's problem, because whatever established the
   * session is no longer this flow's business.
   *
   * It replaced a username/password form this server used to render and check itself. Two sign-ins against one
   * account store is two places to add a provider, to rate-limit, and to get a password check subtly wrong.
   *
   * Return undefined for "nobody is signed in". Never throw for that — an unreadable session is the ordinary
   * first visit.
   */
  identify: (req: SSRRequest) => Promise<OAuthUser | undefined>;
  /**
   * What this user may grant access to. An empty list ends the flow with `access_denied`.
   *
   * `request.scope` is what the client asked for, so one deployment can offer different choices to different
   * clients — a native client signing in as the person, and the same client asking which space to work in.
   */
  grantTargets: (user: OAuthUser, request: { scope?: string }) => Promise<OAuthGrantTarget[]>;
  /**
   * End whatever session {@link OAuthAdapters.identify} was reading, so the person can connect as somebody else.
   *
   * Optional, and its absence is what takes the offer off the grant screen: a deployment that cannot end a session
   * from here should not show a button that pretends to. Clear the cookies on `res` and revoke at the source —
   * forgetting the cookie alone leaves the credential working for anyone who already copied it.
   *
   * Whoever reaches that screen arrived from another application, so this is the only way out of the wrong account
   * that does not mean abandoning the connection and starting over from the host.
   */
  signOut?: (req: SSRRequest, res: SSRResponseHelpers) => void | Promise<void>;
  /** Mint the bearer the client will send on every request. Return undefined to deny the grant. */
  issueToken: (
    user: OAuthUser,
    target: OAuthGrantTarget,
    context: OAuthIssueContext
  ) => Promise<{ token: string; expiresInSeconds?: number } | undefined>;
  /**
   * End a credential {@link OAuthAdapters.issueToken} minted, when its grant is revoked (RFC 7009).
   *
   * Optional, for a credential that ends on its own. Without it, revoking a grant stops it being RENEWED, and what
   * was already issued keeps working until it expires — which a person who just signed a device out reads as the
   * sign-out not having happened, because the device is still there in their list.
   */
  revokeToken?: (credential: string) => Promise<void>;
  store: OAuthStore;
};

/**
 * Who a credential is being issued to, beyond the person: which application, from where, and — on a renewal — which
 * credential it takes the place of.
 *
 * This is what lets a deployment tell its user WHICH of their devices a credential lives on. The application names
 * itself when it registers (RFC 7591 `client_name`, `software_id`); the request is the one the credential is being
 * issued on — at consent, the person's browser, which for a loopback client is the same machine.
 */
export type OAuthIssueContext = {
  client: {
    clientId: string;
    /** What the application registered as: `Plitzi CLI on carlos-mbp`, `Claude`. */
    name: string;
    /** RFC 7591 `software_id`, when it sent one: a stable name for the SOFTWARE, the same on every machine. */
    softwareId?: string;
  };
  request?: { userAgent?: string; ip?: string };
  /**
   * Where the code of THIS grant is sent: the `redirect_uri` of the authorization request, at consent. A deployment
   * whose credential is only good at certain addresses checks it here — registering a client is open to anybody, and
   * the address it names is the one thing that says who will receive what the person agreed to. Absent on a renewal.
   */
  redirectUri?: string;
  /**
   * The credential this grant last issued, on a renewal. A deployment that keeps a row per credential updates that
   * row rather than adding one, so a device renewing every hour stays one device.
   */
  replaces?: string;
};

/** A connection a visitor may take WITHOUT signing in, for a server whose public surface needs no identity — the
 *  MCP App, the tool and resource listings, the guide. The consent screen offers it as a second button beside the
 *  sign-in, and the grant is whatever `target` grants: point it at a target that carries no space, never at one
 *  that does, since nobody proved who they are. */
export type OAuthGuestConfig = {
  /** Handed straight to {@link OAuthAdapters.issueToken} when a visitor takes the guest connection. */
  target: OAuthGrantTarget;
  /** Button text. Defaults to 'Continue without an account'. */
  label?: string;
  /** Who the grant is issued as. Defaults to `{ id: 'guest', label: 'Guest' }`. */
  user?: OAuthUser;
};

/** What the grant screen shows around the form. */
export type OAuthBranding = {
  /** Shown as the heading, e.g. 'Plitzi'. Defaults to 'Plitzi'. */
  productName?: string;
  /** Absolute or same-origin URL of a logo to show above the heading. */
  logoUrl?: string;
  /** Extra CSS appended to the page's own, for a deployment that wants its own look without replacing the page. */
  css?: string;
};

/**
 * Everything the GRANT screen needs to render itself.
 *
 * One screen, and deliberately only one: this server asks what to connect, never who somebody is. Signing in
 * happens on {@link OAuthConfig.signInUrl}, wherever the deployment keeps it.
 */
export type OAuthConsentView = {
  /** Where the form must POST to (the authorize endpoint). */
  action: string;
  /** Hidden fields the form MUST round-trip verbatim, or the flow cannot be resumed. */
  hidden: Record<string, string>;
  /** What this account may grant. Empty for a visitor who has not signed in, who is offered `guest` instead. */
  targets: OAuthGrantTarget[];
  /**
   * Offered when the deployment allows a guest connection. The form submits a `guest` field for it (any non-empty
   * value), which is what tells the server to grant the guest target rather than a chosen one.
   *
   * It is the reason an unidentified visitor is shown this screen at all rather than being sent straight to
   * sign-in: a guest has no session and never will, so a redirect they cannot come back from would take the
   * option away entirely.
   */
  guest?: { label: string; description?: string };
  /** Who is signed in. Absent for a visitor taking the guest connection. */
  user?: OAuthUser;
  /** Where to send somebody who wants to sign in first. Shown when `user` is absent. */
  signInUrl?: string;
  /**
   * Whether to offer "use another account" — shown only when the deployment can act on it, which means it supplied
   * {@link OAuthAdapters.signOut}.
   *
   * A submit BUTTON in the same form rather than a link, and that is not decoration. Ending a session is a state
   * change, so it may not hang off a URL anything can navigate to: a `<img src>` on any page on the internet would
   * then be able to sign a visitor out. Posting it here keeps it a same-origin form submission carrying the request
   * back, exactly like granting does.
   */
  canSwitchUser?: boolean;
  /** A message to show the user. */
  error?: string;
  /**
   * Who is asking, and where the grant goes if the person says yes.
   *
   * Anybody can register a client, call it anything and send somebody this screen on the deployment's own domain, so
   * the name alone proves nothing. The host the code is sent back to is the one fact the requester cannot choose
   * freely, and it is what tells "the app I just opened" apart from a stranger's server.
   */
  client: {
    /** What the client registered itself as. Chosen by the client, so it is shown as a claim. */
    name: string;
    /** The host of the `redirect_uri` the grant is delivered to. */
    redirectHost: string;
    /** The grant goes back to an app listening on this computer (RFC 8252 loopback), not to a server. */
    loopback: boolean;
  };
  branding: OAuthBranding;
};

/** OAuth 2.1 authorization for the MCP server (RFC 9728 discovery + RFC 7591 dynamic client registration +
 *  authorization code with PKCE). ENTIRELY OPTIONAL: without this config no endpoint is mounted, discovery keeps
 *  answering 404 and the server stays anonymous, which is a working setup — the public surface (handshake, tool
 *  and resource listing, the guide, plitzi_render) never needed a token. Configure it only to let a remote host
 *  that cannot send custom headers — Claude Desktop, ChatGPT — obtain a space-scoped one.
 *
 *  Configuring it also protects the MCP endpoint: a JSON-RPC call that presents no verifiable bearer is answered
 *  with RFC 6750's 401 challenge rather than the anonymous surface, because that 401 is the only thing a host runs
 *  its flow off — it ignores a `WWW-Authenticate` header on a 200, and a server that never sends one is treated as
 *  needing no authorization at all, leaving a completed grant with nowhere to attach. Offer a grant target that
 *  carries no space ({@link OAuthGrantTarget}) so the public surface stays one consent away. */
export type OAuthConfig = {
  adapters: OAuthAdapters;

  /** The issuer/resource identifier published in the metadata documents. Defaults to the origin the request came
   *  in on, which is correct whenever the server owns its sub-domain; set it when a proxy rewrites the host. */
  issuer?: string;
  /** Scope names advertised and echoed back on the token. Defaults to ['plitzi']. */
  scopes?: string[];
  /** How long an authorization code stays redeemable, in seconds. Default 60 — codes are one-shot and redeemed
   *  immediately. */
  codeTtlSeconds?: number;
  /** How long a refresh grant lives, in seconds. Default 30 days. Set 0 to issue no refresh tokens. */
  refreshTtlSeconds?: number;
  /** Offer a connection that needs no account — see {@link OAuthGuestConfig}. Omit to require sign-in. */
  guest?: OAuthGuestConfig;
  branding?: OAuthBranding;
  /**
   * The sign-in screen this server sends unidentified visitors to.
   *
   * The whole authorization request rides along as a `redirect` query param, so signing in is an ordinary
   * navigation that lands back on the `/authorize` it left — this server keeps no session of its own for a flow
   * that is one page long.
   *
   * Required, because {@link OAuthAdapters.identify} is: a server that does not check passwords and has nowhere
   * to send somebody who has not signed in cannot start the flow at all.
   */
  signInUrl: string;
  /**
   * Hand the client the credential `issueToken` minted, instead of an opaque handle to it.
   *
   * Off by default, which is right whenever the credential is worth more than the connection — a space token
   * reaches the platform, and a client that never holds one cannot leak one. Turn it ON when the credential IS
   * what the client should hold: a native app granted the person's own session is holding exactly what a browser
   * holds, and wrapping it costs a store read on every request and gives a second thing to revoke.
   */
  directTokens?: boolean;
  /**
   * Accept only loopback `redirect_uri`s (`http://127.0.0.1:<port>/…`, RFC 8252 §7.3), at registration and again at
   * `/authorize`.
   *
   * Turn it on when every client is a native app on the person's own machine — a CLI, a desktop app — and above all
   * with {@link directTokens}, where the grant IS the person's session. Registration is open to anybody, so with https
   * redirects allowed a stranger's server can register, send somebody the link, and collect what they approve.
   */
  loopbackRedirectsOnly?: boolean;
};
