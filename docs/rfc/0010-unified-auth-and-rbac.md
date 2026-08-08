# RFC 0010 — Unified auth kernel, scoped tokens, and space RBAC

- **Status:** Implemented
- **Author:** Carlos Rodriguez
- **Date:** 2026-08-08
- **Scope:** `plitzi-sdk-server`, `apps/server` (`@plitzi/sdk-server`), `apps/mcp`, `apps/builder`, `apps/sdk`, `@plitzi/sdk-shared`

---

## 1. Summary

The token a customer's site embeds to **render** a space is the same token that authorizes
**writing** to it. Anyone who views the page source of a published Plitzi site can lift that
token and rewrite the space through two independent doors — GraphQL mutations and the MCP
write tools. Neither door asks who is holding the token.

The reason it is one token is the same reason it is hard to fix in one place: authentication
is re-implemented in five modules with five different sets of rules, and authorization —
"may *this* principal do *this* to *this* space" — is implemented nowhere except the `api`
role's REST routes.

This RFC replaces both with one auth kernel:

> A credential says **who** you are. A grant says **which space** you are talking about.
> A role says **what you may do there**. No endpoint may skip the third question.

Concretely: typed and scoped tokens, one identity resolver, and one RBAC check reused by
every chokepoint (Express, GraphQL, WebSocket, MCP, SSR, analytics ingest).

---

## 2. The problem

### 2.1 The render token is a write credential

`generateSpaceToken` issues a JWT whose entire payload is `{ data: { spaceId } }`
(`plitzi-sdk-server/src/services/api/auth/tokens.ts`). Nothing in it states what the holder
may do. That single token is:

- returned by `GET /api/spaces/:spaceId/token` to the builder,
- embedded in every published site so the SDK can call `serverUrl`,
- accepted as the sole authorization for **every GraphQL mutation**,
- accepted as the sole authorization for **every MCP write tool**.

The GraphQL context is built from the token alone:

```ts
// src/services/graphql/index.ts
spaceId: get(req, 'jwtPayload.spaceId', 0),
user:    req.user ? { id, username, email, status: 0 } : null
```

`user` is threaded into the mutations only to render the audit-log sentence
(`'Page … was added by {{user.username}}'`). No mutation consults `SpaceUser`. A holder of
the token can call `SpaceUpdateElement`, `SpaceRemovePage`, `SpaceDeploy`, or read
`SpaceCredentials` — the space's third-party secrets.

The MCP is the second door and it is wider, because the MCP is deliberately stateless:

```ts
// src/services/ssr/mcpAdapters.ts
const getSpaceId = async req => {
  const token = (req.headers['x-access-token'] || req.headers.authorization).replace(/^Bearer\s+/i, '');
  const result = await checkToken(token, origin, true);   // skipOrigin = true

  return result.isValid ? result.spaceId : undefined;
};
```

`skipOrigin: true` is correct for the MCP's transport, but it means the render token
authorizes `saveSchema` / `saveStyle` / `saveConnector` with no further question asked.

**The `Origin` check is not a mitigation.** `checkToken` compares the request's `Origin`
header against the token's `aud`. `Origin` is imposed by browsers on cross-site requests; it
is a free-text header for anything else. It stops a hostile *page*, never a stolen *token*.
Two settings disable even that: `JWT_ALLOW_WITHOUT_ORIGIN`, and an `aud` containing `*`.

A related smell: `aud` currently mixes API audiences (`https://api.plitzi.com`) with allowed
browser origins (`https://site.example.com`) and is compared against both. Two concepts, one
claim.

### 2.2 Authentication is implemented five times

| Module | Credential | Validates | Misses |
|---|---|---|---|
| `services/jwt/withJwt` | space token (`x-access-token` / `Authorization`) | signature, `version`, `SpaceToken` row, issuer, origin | scope (there is none) |
| `services/user/withUser` | user token (`plitzi-access-token` / cookie) | expiry | **`status`**, roles, permissions |
| `api/middleware/withOAuth2` | user token (`Authorization: Bearer` / cookie) | expiry, `status`, roles, permissions | — |
| `ssr/ssrAdapters.findValidUser` | user token (header / cookie) | expiry | **`status`** (returned as a `verified` flag, never enforced) |
| `ssr/mcpAdapters.getSpaceId` | space token | signature, row, issuer | scope, origin (by design) |

Plus `realTimeWS` and `subscriptionsWS`, which call `checkToken` themselves, and
`analytics/ingestKey`, which calls it with a third combination of flags.

Consequences visible today:

- A **deactivated account still authenticates** on the `server` role and in SSR. Only the
  `api` role checks `status`.
- `Authorization: Bearer` means *user token* in the `api` role and *space token* in the
  `server` role. The two token kinds share one secret and have no claim distinguishing them;
  only the accidental shape of `data` (`{ id }` vs `{ spaceId }`) tells them apart.
- The session cookie is resolved by exact name in `api/auth/cookies.ts`
  (`plitzi_auth`, `_local`, `_dev`, `_stg`, derived from the host) but by fuzzy
  `key.includes('plitzi_auth')` in `withUser` and in `ssrAdapters`.
- Cache and revocation are per-module: `User.find().cache()`, a separate `ssr-user-*` Redis
  key with its own 5-minute TTL, and no shared invalidation.

### 2.3 There is no space-level authorization

The data model for RBAC already exists and is unused outside REST:

```
User ─< UserRole >─ Role ─< RolePermission >─ Permission     (global capability)
Space ─< SpaceUser >─ SpaceRole ─ Role                        (membership + role in a space)
```

The `api` role uses both halves correctly — `requirePermission('spaceUpdate')` for the global
capability and `requireSpaceMember()` for membership. GraphQL, the WS layers, and the MCP use
neither.

---

## 3. Threat model

| # | Attacker | Has | Can do today | Must become |
|---|---|---|---|---|
| T1 | Anyone who loads a published site | render token | Full write via GraphQL mutations | Read published content only |
| T2 | Same | render token | Full write via MCP tools | Refused — MCP write needs an `agent` grant |
| T3 | Same | render token | Read `SpaceCredentials`, `SpaceConnectors` | Refused — builder-only queries need a session |
| T4 | Ex-employee, account deactivated | valid session token | Full access on `server` + SSR roles | Refused everywhere |
| T5 | Space member with a read-only space role | session + token | Full write (role never consulted) | Limited to their role's permissions |
| T6 | MCP OAuth client after consent | agent token | Writes forever, membership checked only at issue time | Dies when the granting member loses access |

---

## 4. Design

### 4.1 Three principals

| Principal | Credential | Represents |
|---|---|---|
| **Actor** | user token (`scope: 'user'`) — cookie or `plitzi-access-token` | A Plitzi account acting for itself |
| **Grant** | space token (`scope: 'space:render' \| 'space:agent'`) | A space, and what the bearer may do with it |
| — | none | Anonymous |

A request may carry both. **They compose: the grant names the space, the actor supplies the
authority.** Neither alone is enough for a write.

### 4.2 Space token scopes

| Scope | Issued to | May | Public |
|---|---|---|---|
| `render` | Every space (the `isDefault` row) | Read published schema/style/segments; SSR preview; analytics ingest; subscribe to its own space | **Yes** — embedded in sites |
| `agent` | MCP OAuth clients, after a member consents | Everything `render` may, plus MCP writes, bounded by the granting member's space role | No |

**A `render` token MAY live forever, and defaults to it.** It is embedded in a published site — often a
SPA deployed once and left alone — so an expiry is a scheduled outage: the site breaks weeks
later with nobody having touched anything. What the deadline buys is close to nothing, because
the token is public by construction; anyone who wanted it had it long before. What actually
limits it is what it may do (read published content), where it may be presented (§4.3.2), and
the row behind it. Revocation, not expiry, is the control: `POST /spaces/:id/token/rotate`
replaces it and the previous one dies that instant — after which every site embedding it must
be redeployed, which is exactly why this is an act rather than a timer.

A space that wants a deadline gets one anyway — a campaign page meant to go quiet, a token
handed to an agency for a fixed engagement — through `PUT /spaces/:id/token/expiry`
(`{ expiresInDays: n | null }`). The lifetime is a signed claim, so setting it re-mints the
token; it is also stored on `space_token.expires_at`, so a later rotation or domain change
carries the choice forward instead of quietly resetting it to never. Only this scope gets the
choice: an `agent` grant always carries a lifetime — it writes, it is held by a third-party
host, and OAuth hosts renew on `expires_in`.

**Lifetimes follow one rule**: how much damage the credential can do, and whether anything can
renew it. The public token is the only one that may live forever; everything else expires at a
30-day baseline; and the credential that rides on every request — the session access token — is
the shortest at 24 h, which costs nobody anything because the refresh token renews it. That
pairing is precisely what lets it be that short.

Expiry is not what protects any of them, though — every credential can be cut off the moment it
leaks:

| Credential | Expires | Revoked by |
|---|---|---|
| `space:render` | never (default) or a date the space sets | `POST /spaces/:id/token/rotate` — replaced; the old one dies at once |
| `space:agent` | 30 d | `DELETE /spaces/:id/tokens/:tokenId`; also dies when the member who authorized it loses access |
| `user` / `refresh` | 24 h / 30 d | `POST /auth/sessions/revoke` (by account, from a device that still has a good session) or `/auth/logout` (by credential) |
| `widget` | 30 d | Reaches no space, so nothing to revoke it from |

Two of those did not exist before: an `agent` grant — the only bearer that writes with no
session behind it — could not be revoked by any endpoint, and a leaked session could only be
killed by whoever held the leaked copy. `GET /spaces/:id/tokens` lists what a space holds, and
deliberately never returns an agent secret: that would turn a read permission into a way to
obtain one. Deleting the public token is refused (it would leave the site with no credential at
all) and points at `rotate` instead.

An `agent` token is **bound to the granting user**: the `space_token` row stores `user_id`.
Its authority is computed from that user's live membership on every request, so losing access
to the space revokes every agent token they authorized (T6). `oauthAdapters` already
re-verifies membership when issuing; this makes the check continuous rather than one-shot.

The builder deliberately gets **no privileged token**. It keeps using the `render` token to
*address* the space and derives all authority from the user session it already sends
(`apps/builder/src/App.tsx` sends `plitzi-access-token` alongside `Authorization: Bearer`).
One less secret that can leak.

### 4.3 Token format: registered claims only

**Every** credential in the system is a JWT — session, refresh, space and the MCP widgets-only
bearer alike — built from claims registered in RFC 7519, plus `scope` from RFC 6749. There are
no bespoke `typ` / `data` / `version` claims: anyone who has read a JWT before can read one of
these.

| Claim | Meaning here |
|---|---|
| `iss` | Which deployment minted it — **the environment boundary** (§4.3.1) |
| `sub` | Who or what it is about: the user id, or the space id |
| `aud` | The API audiences it is meant for |
| `scope` | What it is and what it may do: `user`, `refresh`, `widget`, `space:render`, `space:agent` |
| `exp` / `iat` / `nbf` / `jti` | Lifetime and identity, as usual |
| `origins` | **The one custom claim.** The web origins this credential may be presented from — JWT registers nothing for it (§4.3.2) |

- `scope` is checked against what each call site expects, so a session token presented where a
  space token belongs is a hard failure rather than a shape mismatch that falls through.
- For space tokens it is also cross-checked against the `space_token.scope` column. The JWT
  cannot be forged; the row is the revocation and downgrade switch. Disagreement ⇒ reject.
- A pre-RFC-0010 token is recognised by its shape (`data` / `version` present) and reported as
  **outdated**, which is what puts it on the re-issue path instead of failing as garbage.
  Every token in circulation stops working. Intended: pre-release, no legacy shims. Sites
  re-fetch from `GET /spaces/:id/token`; MCP clients re-run the OAuth flow.

#### 4.3.1 Environments

Environment isolation needs no claim of its own. `iss` is the standard claim for *which
deployment minted this*, and each environment already issues under its own hosts
(`JWT_DEFAULT_ISSUER`). It is verified centrally, for every token kind — previously only the
space-token path looked at it, so a dev **session** would have been a staging session had the
secret been shared.

Each environment must therefore keep both its own `JWT_DEFAULT_ISSUER` and its own
`JWT_ACCESS_TOKEN_SECRET`. The issuer check is what makes the second one failing (a copied
`.env`) fail closed instead of silently granting access.

#### 4.3.2 Domain binding

A render token ships in the clear inside every page it renders, so the only thing that keeps a
copied one from working elsewhere is **where it is presented**:

- The request **host** — where the request was actually routed — must match a domain the token
  declares, or one of the platform's own hosts. This is not waived by the Origin opt-out, and
  applies to the render scope on every transport.
- The `Origin` header is still checked on top for browser traffic.

An `agent` grant is exempt: it is not a browser credential and reaches no domain.

**What this does and does not buy.** It stops a token being embedded on another site — the
browser sends the real `Origin` and the request is refused. It cannot stop a stolen token
replayed by a non-browser client with a forged `Origin`; nothing header-based can, for a
credential that is public by construction. That residual case is bounded by the scope: the
token is read-only over published content.

Domains are the space owner's to set (§4.6). `*` is accepted, because embedding on domains
that cannot be known up front is a real case, but it turns the binding off and the API says so
in its response rather than silently.

### 4.4 The auth kernel

Everything that today decides "who is this" moves into one module in `plitzi-sdk-server`,
which is the only tier that owns both the JWT secret and the database:

```
src/services/auth/
  tokens.ts        issue + verify typed tokens (absorbs api/auth/tokens.ts)
  credentials.ts   the ONLY place that reads headers/cookies/query for a credential
  actor.ts         user token -> Actor  (expiry + status + roles + permissions, one cache)
  grant.ts         space token -> Grant (signature + row + scope + issuer + origin)
  rbac.ts          can(actor, spaceId, permission)
  policy.ts        declarative per-route/per-operation requirements
  middleware.ts    withAuth(policy) — replaces withUser + withJwt + withOAuth2
```

Deleted: `services/jwt/`, `services/user/`, `api/middleware/oauth2.ts`,
`api/auth/tokens.ts`, and the private user lookup in `ssrAdapters`. `express-jwt` goes with
them — it verified the token a second time with different rules than `checkToken`, and
`issuer: ''` meant its issuer check never ran.

`@plitzi/sdk-server` and `apps/mcp` stay database-agnostic. Their adapter contract widens
from "give me a spaceId" to "give me a grant":

```ts
// @plitzi/sdk-shared
export type SpaceScope = 'render' | 'agent';
export interface SpaceGrant { spaceId: number; scope: SpaceScope; userId?: number }

// SSRAdapters
getGrant(req: SSRRequest): Promise<SpaceGrant | undefined>;   // replaces getSpaceId
```

The MCP handler refuses any write tool unless `grant.scope === 'agent'` **and** the bound
user still holds the matching space permission.

### 4.5 RBAC

Two halves, both already modelled, both required:

```
can(actor, spaceId, permission) =
      actor.permissions.has(permission)                 // global capability  (UserRole)
  &&  membership(actor, spaceId).permissions.has(permission)   // space role  (SpaceUser)
```

`SpaceUser` is **membership, not ownership**: people collaborate on spaces they do not own, and
each membership carries its own role — the same account can be an editor on one space,
read-only on a second, and a stranger to a third. The global half is a *capability the platform
granted the account*, never a statement about a particular space; the space half is what says
where it applies. Both are read live, so adding, narrowing or removing a collaborator takes
effect on their next request rather than at their next sign-in.

Membership resolves `SpaceUser → SpaceRole → Role → RolePermission`, cached briefly and
invalidated on membership writes.

Exactly one membership is the **owner**. Whoever creates a space owns it, and may hand it to a
member who is already accredited there — `PUT /spaces/:id/users/:userId/ownership`. Targeting an
existing member is deliberate: a space cannot be given to a stranger by mistyping an id, and the
new owner has already accepted being there. The two writes are one transaction, because a space
with two owners or none is not a state anything else knows how to read — every
`requireSpaceMember({ owner: true })` and every "cannot remove the owner" guard assumes exactly
one. The new owner takes the space's admin role with the title; the previous owner stays a
member, since handing a space over is not leaving it.

**One correction this forced.** `spaceManage` was, in practice, the guard on the *plugin
catalog* routes — a platform-wide catalog, not a space — and the ordinary `user` role therefore
did not have it. Requiring it for deploys, settings and the domains API would have meant a
space's own owner could not deploy their space. The catalog routes moved to `adminManage`
(which only `admin` holds, and which nothing used), and `spaceManage` joined the `user` role,
where its name is now true: a capability whose reach is decided by the space role. With the seeded `admin` space role granting everything,
today's behaviour for owners is unchanged; a narrower space role now actually narrows
(T5).

Permission vocabulary stays as seeded — `spaceCreate`, `spaceIndex`, `spaceView`,
`spaceUpdate`, `spaceDelete`, `spaceManage`. No new names.

### 4.6 The space owner sets the domains

A space's public token is only as bound as its domain list, and that list belongs to the person
who owns the space, not to a deployment config:

| Route | |
|---|---|
| `GET /spaces/:id/token` | the public token, re-minted if it no longer verifies |
| `GET /spaces/:id/token/domains` | the domains it is currently valid on |
| `PUT /spaces/:id/token/domains` | replace them — needs `spaceManage` + membership |

Because the domains are a signed claim, changing them **re-mints the token**: the response
carries the new one, and the previous token stops working immediately. The space's own
`<permanentUrl>.plitzi.app` is always merged in, so a member cannot lock their published site
out of its own token.

### 4.6.1 Chokepoints

Every entry point states its requirement declaratively. There is no "authenticated therefore
authorized" path left.

| Entry point | Requirement |
|---|---|
| GraphQL `Space`, `Segment`, `Segments` | valid grant (`render` suffices) — these are the only three operations the public SDK issues |
| All other GraphQL queries | actor + `can(actor, space, 'spaceView')` |
| **All GraphQL mutations** | actor + `can(actor, space, 'spaceUpdate')`; `SpaceDeploy` / settings require `spaceManage` |
| GraphQL subscriptions (WS handshake) | valid grant; actor required for any space-scoped stream |
| `realTimeWS` (collaborators) | actor + membership — it broadcasts editor presence and element state |
| MCP read tools | valid grant |
| MCP write tools | `agent` grant + `can(bound user, space, 'spaceUpdate')` |
| SSR public render | domain-resolved; no token |
| SSR builder preview (`?access-token=`) | valid grant |
| Analytics ingest | `render` grant (unchanged) |
| REST `/api/*` | actor + existing `requirePermission` + `requireSpaceMember` |
| `/ai/*` (co-worker) | actor + `can(actor, space, 'spaceUpdate')`; the space comes from the grant, never the request body |

The mutation guard is applied once, in `graphql/schema/index.ts`, by wrapping the field map —
not by editing seventy resolver files.

### 4.6.2 Iframes

Domain binding stops a stolen token being *used* elsewhere. It does not stop someone framing the published page
itself, which needs no token at all — the page is served by domain. So the same declared-domain list drives a
second policy: the CSP `frame-ancestors` the renderer sends with every page, resolved per space
(`SSRSpaceDeployment.frameAncestors`).

The platform's own hosts are the floor, because the builder previews every space in an iframe; each space widens
it with what its owner declared, and a space that opted into `*` is framable anywhere. This one is enforced by
the browser rather than the server, which is why it works at all against embedding: the attacker's page never
gets to paint.

The server-wide `frameOptions` default cannot answer this — one static list cannot know which sites a given
space's owner allowed — so the per-space policy overrides it once the deployment resolves.

### 4.6.3 Self-hosting

A customer can run `sdk-server` and the SDK on their own infrastructure, with their own MySQL,
Mongo and Redis, and render their space from it. Nothing in the model changes shape — scopes,
domain binding, RBAC and framing are properties of the code, not of who deployed it. What
changes is **who issues**: their deployment has its own `JWT_ACCESS_TOKEN_SECRET` and its own
`JWT_DEFAULT_ISSUER`, so it is its own credential universe. Nothing minted on either side
verifies on the other, by the same mechanism that keeps dev out of production (§4.3.1).

A self-hosted deployment is therefore not a *client* of the hosted platform; it **is** a
platform, with its own accounts, spaces and tokens. The only thing that crosses the boundary is
the space's content, carried by a deploy.

Such a deployment must set, at minimum: its own secret and issuer, plus
`JWT_DEFAULT_ALLOWED_ORIGIN` and `SSR_DEFAULT_DOMAINS_ALLOWED` naming its own hosts — those are
the platform floor for both domain binding and framing.

### 4.7 Sessions and cookies

The session cookie is one thing in one place. Its name and attributes are host-derived
(`plitzi_auth` / `_local` / `_dev` / `_stg`; `SameSite=None; Secure` with a parent `Domain` off
local) and live in the kernel, because the `api` role **sets** it and SSR **reads and clears**
it. They used to disagree: SSR wrote `SameSite=Lax` with no `Domain` and read cookies back by
fuzzy name match, so a session established through the api role was invisible to SSR on any
real deployment.

SSR keeps rendering for an account that has not verified its email and exposes `verified` so a
page can gate on it; what it no longer does is disagree about whether the session is valid.

### 4.8 Who a user is

Users sign in through the `api` role, by password or through a social provider (Google,
GitHub — a provider is enabled purely by having its client id and secret configured). Every
route ends in the same place: `issueSession` mints the access + refresh pair, and the refresh
token is stored on the user row so issuing a new pair invalidates the previous one.

That session is the **only** thing that authorizes an edit, anywhere: the builder, the
GraphQL mutations, the WebSocket channels, the co-worker. A space token says which space is
being talked about; it never says the caller may change it.

**Plitzi's own website is a Plitzi space.** It is rendered by the same `ssr` service as every
customer's, and it is the surface where people sign in — which makes it the platform's
first-party client: it holds a session, it hosts the builder, and `ssr` reads the same session
cookie the `api` role sets. SSR's own `onLogin` / `onLogout` therefore run the same rules as
`POST /auth/login` (inactive accounts refused; an account with no password hash, created
through a social provider, stays closed to password login) and share one `revokeSession`, so
signing out on a rendered page is as revoked as signing out through the API. Before this they
were a stub that always failed and a cookie clear that left the token live.

---

## 5. Migration

No compatibility layer, per the project's pre-release stance.

1. Prisma migrations: `space_token.scope` (`render` | `agent`, default `render`) and
   `space_token.user_id` (nullable, set for `agent` rows); `user.refresh_token` widened to
   `VarChar(512)` now that it is a JWT; `space_token.version` dropped — the claim it mirrored
   no longer exists.
2. Every existing token stops working the moment the new build ships: the old claim shape is
   refused. `JWT_VERSION_ALLOWED` is **retired** — there is no knob, the shape says it.
3. Re-issue: `GET /spaces/:id/token` re-mints on demand (it rotates on *outdated*, not only on
   expired — without that a site on an old token would have no way back); the seed regenerates
   its space tokens; MCP connectors re-run OAuth.
4. Every environment must have its own `JWT_DEFAULT_ISSUER` **before** this ships, or two
   environments keep accepting each other's credentials.
5. Builder: no change beyond re-fetching its token — it already sends the session header.
6. Published sites: pick up the new token on their next deploy; until then they render from
   the domain-resolved SSR path, which never needed a token.

**Locally**, a seeded token declares its space's published domain, so presenting it from
`localhost` is refused — correctly, and confusingly. `yarn token <space>` re-mints one for the
hosts a local stack actually serves from and writes the row, replacing the habit of copying a
value out of the database into an `index.html`.

**Deployment order matters.** Step 2 invalidates tokens the moment it ships, so the token
endpoint (step 3) must be live first.

---

## 6. Impact by repository

| Repo / package | Change |
|---|---|
| `plitzi-sdk-server` | New `services/auth/`; delete `services/jwt`, `services/user`, `api/middleware/oauth2.ts`; GraphQL guard; WS handshakes; `mcpAdapters.getGrant`; Prisma migration; token issuance |
| `apps/server` (`@plitzi/sdk-server`) | `SSRAdapters.getSpaceId` → `getGrant`; MCP handler enforces scope on write tools |
| `apps/mcp` | Write tools declare the permission they need; OAuth issues `agent` scope bound to the consenting user |
| `@plitzi/sdk-shared` | `SpaceScope`, `SpaceGrant` types; `SSRUser` carries real roles/permissions |
| `apps/builder` | None functionally — re-fetches its token |
| `apps/sdk` | None — its three queries stay `render`-reachable |

---

## 6.1 Test coverage

The surface is wide enough that prose alone would not hold it, so each property has a test that
fails if it is undone:

| Suite | Holds |
|---|---|
| `auth/tokens.test.ts` | Registered-claim shape, `scope` keeping the five kinds apart, per-issuer environments, what is re-mintable |
| `auth/grant.test.ts` | Row-vs-claim agreement, revocation, origin and domain binding, agent grants exempt |
| `auth/domains.test.ts` | Canonicalising what a person typed; sub-domains are not the same host |
| `auth/rbac.test.ts` | Both halves required, collaborators, agent grants dying with membership |
| `graphql/authorize.test.ts` | Grant-only reads, session-required writes, per-operation overrides, subscriptions |
| `apps/server` `spaceDeployment.test.ts` | Per-space `frame-ancestors` overriding the server-wide default |
| E2E `auth/space-grants` | The real token a space is created with: read-only, domain-bound, revoked with its row |
| E2E `auth/write-authorization` | The real schema's fields: a render token cannot write or read credentials |
| E2E `auth/ai-authorization` | `/ai/*` needs both credentials; the space comes from the grant, not the body |
| E2E `spaces/space-ownership` | Creator owns it; transfer only by the owner, only to a member, exactly one owner after |

**One thing the e2e suite needed first.** It could not run at all: `@plitzi/plitzi-ui`'s barrel
was imported in three places purely for a lodash helper (`omit`, `pick`, `get`/`set`/`camelCase`)
— in `sdk-shared`, `sdk-elements` and this server — which dragged a React component library, its
Markdown component and a syntax highlighter into every server process that resolved a binding.
Node's ESM resolver then refused one of that library's extensionless imports. All three now use
the leaf `@plitzi/plitzi-ui/helpers/lodash` subpath (or `lodash-es`), and the UI library is out
of the server's import graph.

## 7. Open questions

1. **Space-role vocabulary.** Global and space roles currently draw from one `Role` table.
   Should space roles get their own permission set (`editor`, `viewer`, `deployer`) rather
   than reusing the global `space*` names?
2. **Render token lifetime.** 30 days with rotation-on-expiry. A public read-only token could
   safely live longer; a short one only adds re-fetch traffic. Worth revisiting once scopes
   land.
3. **Analytics ingest** accepts a `render` token with `skipOrigin`, which is inherent to
   collecting from arbitrary customer domains. It writes only counters, so the blast radius
   is quota inflation — accepted, noted here so it is a decision rather than an oversight.
