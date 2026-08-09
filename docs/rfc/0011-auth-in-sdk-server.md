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

### Stage 2 — the credential kernel

`tokens.ts` (minting and verification, scopes, lifetimes) and `credentials.ts` (where a credential may ride) are pure
functions with no database behind them, which makes them the easiest real move. `settings.jwt` becomes configuration:
secret, issuer, audiences, lifetimes.

Resolution splits. `sdk-server` gets `resolveActor(token, adapters)`; the adapters are `findUserByToken` and
`findSpaceToken`, which is exactly the part that touches Plitzi's tables.

### Stage 3 — the guard and the RBAC contract

`authGuard`, `AuthPolicy` and `Requirement` move. The guard is Express-shaped today and the server's own pipeline is
not, so it needs a transport-neutral core with a thin Express binding.

RBAC moves as a **contract**: `can(actor, spaceId, permission)` with a `getMembership` adapter. The tables it reads
(`space_user`, `role`, `role_permission`) stay Plitzi's — they are data, and data is the other side of the line.

### Stage 4 — the REST API

The `/auth/*` router becomes a mountable router in `sdk-server`, driven by adapters for users, identities and email:
login, refresh, logout, signup, password reset, `sessions/revoke`, `GET /auth/session`, and the social OAuth flow
(the registry, PKCE state, redirects — all generic; the provider adapters and their credentials are configuration).

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
