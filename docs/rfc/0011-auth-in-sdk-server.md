# RFC 0011 — Auth belongs to sdk-server

**Status**: stage 1 implemented, stages 2–5 planned
**Supersedes the placement decisions of** [RFC 0010](./0010-unified-auth-and-rbac.md), not its design

## The problem

`@plitzi/sdk-server` is the server everyone runs — Plitzi included. `plitzi-sdk-server` is Plitzi's own deployment
of it: its databases, its accounts, its configuration.

Auth grew up on the wrong side of that line. All of it — minting and verifying credentials, resolving who a request
is from, the guard, RBAC, the `/auth/*` endpoints — lives in `plitzi-sdk-server`. So a customer self-hosting
`sdk-server` with their own space and their own identity source gets no auth cycle at all: they would reimplement
cookies, session lifetime, renewal, the hint, the login and exchange routes, and the boot contract the SDK expects,
and any drift between their version and Plitzi's is a bug the SDK cannot see.

The line this RFC draws:

> **sdk-server owns the mechanism. plitzi-sdk-server owns the data.**
> How a session is carried, renewed, ended and checked is the same everywhere and belongs to the server. Who a
> person is, what they may do, and where that is stored belongs to the deployment.

The test of whether the line is in the right place: **Plitzi builds Plitzi.** The dashboard is a Plitzi space,
self-hosted, served by `plitzi-sdk-server` consuming `sdk-server` — the same way a customer would. Anything Plitzi
can do that a customer cannot is a mistake in this split, not a feature.

## Stage 1 — the session cycle (implemented)

Moved into `sdk-server`:

- `core/auth/session.ts` — cookie naming and scope (defaults derived from the request host, overridable per host via
  `SSRServerConfig.authCookie`), writing a granted session, clearing it, reading it back, and the format of the
  readable hint cookie.
- `core/http/stages/authRoutes.ts` — login and logout write and clear cookies themselves.
- `core/http/stages/exchangeRoute.ts` — `POST /auth/exchange`, for identity providers that live in the front-end.

The adapter contract stopped being HTTP-shaped. It was:

```ts
onLogin: (req, res) => Promise<boolean>       // the consumer wrote Set-Cookie itself
onLogout: (req, res) => Promise<void>
```

and is now identity-shaped, with no `res` in sight:

```ts
authenticate: (credentials, req) => Promise<SSRSession | undefined>
endSession: (req) => Promise<void>
exchangeCredential: (provider, token, req) => Promise<{ ok: true, session, user? } | { ok: false, ... }>
```

A deployment says who someone is; the server decides how that travels. Plitzi's implementation passes its own cookie
naming (one name per environment, on the registrable domain) as configuration, so the api role, SSR and the auth
kernel still agree byte for byte.

## Stages 2–5 — planned

Roughly 3,700 lines across `src/services/auth/` and `src/services/api/auth/`, 18 consumers, 20 test files. Each stage
leaves both repositories working; none is worth starting before the previous one is green.

### Stage 2 — the credential kernel (implemented)

`createTokens(config)` in `core/auth/tokens.ts`: minting and verification, the scopes, the lifetimes. A factory
rather than a module of functions because the configuration is the deployment's — its secret, and the issuer that
separates its universe of credentials from every other's. `core/auth/credentials.ts` (where a credential may ride)
and `core/auth/domains.ts` (what a declared domain matches) went with it.

Plitzi's `services/auth/tokens.ts` is now nine lines of configuration and a re-export.

### Stage 3 — identity, RBAC and the guard (implemented)

`createIdentity({ tokens, carriers, adapters, config })` resolves actors and grants and answers `can()`. Three
adapters are the entire database surface authorization needs:

```ts
findAccountByToken(token)        // the row is the revocation switch
findSpaceToken(token)            // no row, no grant
findMembership?(userId, spaceId) // omit it and every space-level check refuses
```

`can(actor, spaceId, permission)` keeps both halves — a global capability is a property of an account and never an
assertion about a particular space — with the membership half behind the adapter. Plitzi's tables stay Plitzi's.

`createAuthorizer(identity, policy)` is the guard, transport-neutral: it answers *may this proceed, and as whom*.
Express is not a dependency of `sdk-server` and must not become one, so the api role binds it in ~15 lines that put
the result on `req` and answer in its own error shape.

The rules moved with their tests: 30 of them now run against real tokens and fake stores in `sdk-server`, instead of
against mocked Prisma in Plitzi.

**Gotcha found on the way**: `services/prisma/index.ts` also mounts the API router, so importing `getPrisma` from the
barrel — inside a module the API depends on — closes a cycle and leaves `authGuard` undefined at route-mounting
time. Import the leaf (`prisma/client`). The old code got away with it by accident of import order.

### Stage 4 — the REST API

The `/auth/*` surface becomes framework-neutral handlers in `sdk-server`, driven by adapters for accounts,
identities and email: login, refresh, logout, `GET /auth/session`, `sessions/revoke`, exchange, signup, password
reset, verification, and the social OAuth flow (registry, PKCE state, redirects — all generic; the provider
credentials are configuration).

**Not every deployment wants all of it**, and a space signing people in through an external provider wants very
little of it: signup, password login and password reset are meaningless there. So the surface is decided by two
things, in this order:

1. **What the deployment can do.** No adapter, no endpoint. A deployment that supplies no `createAccount` has no
   signup, and the route answers 404 rather than 500 — the same rule the exchange already follows.
2. **What it chooses to offer.** `auth.features` turns off what the adapters would otherwise allow:
   `{ passwordLogin, signup, passwordReset, emailVerification, exchange, social }`. Everything a self-hoster would
   plausibly want is on by default; anything they cannot serve is off without being asked.

`GET /auth/capabilities` publishes the result, so a space renders a sign-in page that matches what its backend
actually answers instead of a signup button that 404s.

Policy that is Plitzi's — role names (`user`, `unverifiedUser`), email templates, default settings — is
configuration, never code in the generic package.

### Stage 5 — plitzi-sdk-server as a data layer

What remains: Prisma/Mongo/Redis adapters, Plitzi's configuration and seeds, the roles that compose the servers, and
the parts of the product that are genuinely Plitzi's (spaces, deployments, billing, analytics).

## Consequences

- A self-hoster runs `sdk-server`, implements a handful of adapters over whatever they already have, and gets the
  whole cycle: sessions that renew, end everywhere at once, and answer the SDK's boot contract without a request.
- Plitzi stops being the reference implementation by accident and becomes one by construction — it runs the same
  code path a customer does, which is the only way that path stays honest.
- Every stage is a breaking change for anything importing `@plitzi/sdk-server` internals. Pre-release, and the
  project's rule is to break cleanly rather than carry shims.
