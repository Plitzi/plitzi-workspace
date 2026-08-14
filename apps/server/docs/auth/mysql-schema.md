# The auth tables

What authentication and authorization need to be able to look up, as tables.

There are two ways to read this document, and they are both intended:

- **You are using `@plitzi/sdk-server/mysql`.** Then this is the schema it creates, and you are reading it to know
  what is in your database.
- **You already have a user table.** Then this is the *contract*: not a schema to copy, but the set of questions
  your adapters have to be able to answer. The column list is one correct answer to each — map yours onto it.

Nothing outside `@plitzi/sdk-server/mysql` assumes any of this exists. The kernel only ever asks the adapters.

## The questions

Authorization is small. It is these three lookups, and nothing else touches a database:

| Adapter | The question |
|---|---|
| `findAccountByToken(token)` | Whose session is this, and what may they do globally? |
| `findSpaceToken(token)` | Which space does this credential act for, and how? |
| `findMembership(userId, spaceId)` | What may this account do *inside* that space? |

The `/auth` flows add the account half — sign in, sign up, renew, reset, verify — which is
[`AccountAdapters`](../../src/core/auth/api.ts). The space-credential lifecycle adds
[`SpaceTokenAdapters`](../../src/core/auth/spaceTokens.ts).

## The tables

Eight. Names are the kernel's vocabulary — an `AccountRecord` is stored in `account` — and every one of them takes
`tablePrefix` if this schema shares a database.

```
account          the person, their password hash, and their single-use tokens
session          one row per signed-in device
account_identity the same person at somebody else's provider — unique on (provider, subject), never on email
account_mfa      the second factor: a TOTP secret, when it was proven, and hashed recovery codes
account_otp      one-time codes, for signing in by email
account_role     which global roles an account has
role             a named bundle of permissions
permission       one capability
role_permission  which permissions a role bundles
space_member     membership of ONE space, with the role that applies inside it
space_token      a space's own credentials — for published sites, and for agents
schema_version   what version of this schema the database is at
```

Get the full DDL from code rather than from this document, which can drift:

```ts
import { mysqlSchemaStatements } from '@plitzi/sdk-server/mysql';

console.log(mysqlSchemaStatements().join(';\n\n'));
```

### `account`

| Column | Type | What it is |
|---|---|---|
| `id` | INT UNSIGNED PK | |
| `username`, `email` | VARCHAR(191) UNIQUE | Both are sign-in identifiers; both are looked up. |
| `password_hash` | VARCHAR(255) NULL | NULL for an account that only signs in through a provider. |
| `status` | ENUM active/inactive/blocked | Only `active` resolves to an actor — see below. |
| `verified` | TINYINT(1) | Confirmed their address. Separate from `status`: an unverified account may still sign in; what it may *do* is RBAC's question. |
| `reset_token`, `validation_token` | VARCHAR(191) NULL | Opaque, single-use. Deliberately VARCHAR: these are short strings this server generates, not JWTs. |

**A suspended account resolves to nothing.** `findAccountByToken` filters on `status = 'active'`, so deactivating
somebody ends the session they are already holding rather than only their next sign-in.

### `session`

| Column | Type | |
|---|---|---|
| `account_id` | INT UNSIGNED | Cascades: deleting an account deletes its sessions, so there is no window in which a deleted account still has a working credential. |
| `token` | TEXT, prefix-indexed | The session credential, **stored**. |
| `expires_at` | BIGINT | Unix seconds. |
| `refresh_token` | TEXT, prefix-indexed | |
| `refresh_expires_at` | BIGINT | Read on every renewal — see the traps. |
| `user_agent`, `ip` | VARCHAR NULL | So a device list can name a device. Nothing decides anything on them. |

**One row per device, not one per account.** A token pair on the account row is smaller and wrong in a way people
notice: signing in on a phone signs you out on a laptop, and "sign out my other devices" cannot be built at all.

**The credential is stored, and looked up by the token.** That is not an optimisation, it is the revocation
mechanism: a credential that matches no row is dead however valid its signature still is. A stateless check of the
signature alone cannot be undone before it expires.

**Rows are deleted, never flagged.** A revoked session that still exists is a row every query has to remember to
exclude, and the first one that forgets brings it back to life.

**A renewal replaces a row; a sign-in adds one.** The pair itself cannot say which, so `saveSession` is told —
see `SessionContext.replaces`. A store that inserts on renewal grows a row per refresh: a device list full of
ghosts of one browser, and a revoked session that survives because the row meant to overwrite it is still there.

### `role`, `permission`, `role_permission`, `account_role`

The ordinary shape. A **permission is a capability of the account** — `spaceUpdate` means "this account is the kind
of account that edits spaces", never "this account may edit *that* space".

### `space_member`

| Column | | |
|---|---|---|
| `space_id` | BIGINT UNSIGNED | **No foreign key.** Spaces are not this schema's — you keep them wherever you keep them. |
| `account_id` | INT UNSIGNED | |
| `role_id` | INT UNSIGNED | The role that applies *inside this space*. Same `role` table, different scope. |
| `is_owner` | TINYINT(1) | |

Membership, not ownership: an account collaborates on spaces it does not own, and each membership carries its own
role. `can(actor, spaceId, permission)` is **both halves** — the global capability *and* the space role — and
either one missing is a refusal.

### `space_token`

A space's own credentials. `scope` is `render` (public, embedded in published sites, read-only) or `agent` (an
MCP client acting for a member). `is_default` marks the public one — **exactly one row per space**; two make
`loadDefault` answer whichever the database happened to return first.

`expires_at` NULL means never, which only a `render` token may be: it is embedded in sites deployed once, where an
expiry is a scheduled outage. Stored rather than left to the JWT so that rotating, or changing the domain list,
preserves the space's choice instead of quietly resetting it.

`account_id` is set for `agent` grants only — the member who consented. Their live membership is what the grant is
worth.

## Traps

Four, each of which fails somewhere other than where it was caused.

**Credentials are `TEXT`, never `VARCHAR`.** A credential is a JWT, and a JWT's length follows its `aud` claim —
one entry per host the deployment serves. A stack with seven audiences mints a 549-character refresh token, so
`VARCHAR(512)` kills every login on the deployment that has the most environments and nowhere else. They are
prefix-indexed (`token(191)`) instead; the comparison stays exact, because MySQL rechecks the full value.

**Unix seconds are `BIGINT`, never `INT`.** A signed `INT` runs out on 19 January 2038, and a lifetime `render`
credential is precisely the row that gets written with a far-future date.

**`refreshExpiresAt` has to come off the row.** `findByRefreshToken` must report it. A store that keeps it inside a
session object and forgets to lift it out has every renewal refused as `expired` — which does not fail at login. It
fails a day later, when the access token ages out and a session that looked fine simply ends.

**A cleared single-use token is `NULL`, not `''`.** The flows clear a reset token by setting it to the empty
string. Stored as an empty string it becomes a value that *matches*, so a reset link carrying no token at all would
resolve to whichever account was cleared first.

## The account lifecycle

Everything above is what authentication reads. What it *writes* — beyond the session cycle — is the rest of the
account's life, and every one of these is an optional adapter whose absence removes the endpoint:

| Flow | Route | Adapters |
|---|---|---|
| Change username or email | `POST /auth/profile` | `updateAccount` |
| Change password | `POST /auth/password` | `findById`, `setPassword` |
| Close the account | `POST /auth/delete-account` | `deleteAccount` |
| List signed-in devices | `GET /auth/sessions` | `listSessions` |
| End one device | `POST /auth/sessions/revoke-one` | `revokeSession` |
| End the others | `POST /auth/sessions/revoke-others` | `revokeOtherSessions` |
| List / read accounts | `GET /auth/admin/accounts`, `GET /auth/admin/account` | `listAccounts`, `findById` |
| Suspend, block, restore | `POST /auth/admin/account/status` | `setStatus` |
| Set global roles | `POST /auth/admin/account/roles` | `setRoles` |
| Delete somebody's account | `POST /auth/admin/account/delete` | `deleteAccount` |
| Enrol / confirm / remove a second factor | `POST /auth/mfa/{begin,confirm,disable}`, `GET /auth/mfa` | `loadMfa`, `saveMfa`, `deleteMfa` |
| Finish a sign-in that owes one | `POST /auth/mfa/complete` | the same |
| Sign in by emailed code | `POST /auth/passwordless/{request,complete}` | `saveOtp`, `findOtp`, `consumeOtp`, `findByEmail`, `sendMail` |

### The second factor

TOTP (RFC 6238), six digits, thirty-second steps — what every authenticator app assumes. Three properties are the
server's and worth knowing:

- **An enrolment does nothing until it is confirmed with a real code.** A secret treated as active the moment it is
  generated locks out anybody whose app failed to scan it.
- **The challenge is a signed token, not a session.** Getting the password right buys five minutes and the right to
  finish that one sign-in; it verifies as nothing else.
- **Recovery codes are stored hashed and shown once**, and a used one is spent. One that survives being used is a
  password with extra steps.

### Signing in by email

The request answers identically whether the address has an account or not — anything else makes the endpoint a way
to ask which addresses do. It never creates an account, and a second factor still applies: arriving by email proves
the address, which is one factor.

Four rules are the server's, and each of them is the difference between the feature and a convincing imitation of
it:

- **A ban ends the sessions.** `setStatus` to anything but `active` clears them. A ban that leaves the credential
  working is a note in a database — the person stays signed in until their token happens to lapse.
- **A password change signs out the other devices**, and only the other ones. Changing a password is what somebody
  does when they think a credential escaped; leaving the other sessions alive does not do the thing they asked for,
  and signing out the device making the change would be absurd.
- **Closing an account asks for the password**, where there is one. It is irreversible, and a borrowed session
  should not be able to do it.
- **An administrator cannot act on their own account** through the admin routes. That is how a deployment loses its
  last administrator, and it is never what was meant.

Cross-site request forgery is on by default for cookie-authenticated writes; see the README. Nothing about it
touches these tables — the token is signed, not stored.

The admin routes check one global permission, named by `createAuth({ api: { adminPermission } })` and defaulting to
`userManage` — the server does not presume to know your vocabulary. They are otherwise ordinary `actor` routes, so a
deployment that grants that permission to nobody has them refuse everyone.

## Sharing a database with things that are not ours

This module is meant to be pointed at a database that already has other tables in it, and `role`, `permission` and
`session` are among the most ordinary names there are. So:

- **It refuses to adopt tables it did not create.** `CREATE TABLE IF NOT EXISTS` would silently take somebody
  else's `role` and fail much later, on a query against columns that are not there. Instead the first migration
  into a database that already has any of these names stops, lists them, and names the fix.
- **`tablePrefix` is the fix.** `tablePrefix: 'acme_'` gives `acme_account`, `acme_session` and so on, and the two
  schemas coexist untouched.
- **`adoptExisting: true`** is the escape hatch for the one honest case: re-attaching to tables that really are
  this schema's, after a restore that lost the `schema_version` row.

### Uninstalling

```ts
const dropped = await store.uninstall();
```

Drops **only** the nine names above, children first so the foreign keys allow it, and returns what it dropped.
It refuses a database with no `schema_version` of ours in it — without that check, a typo in `tablePrefix` turns
this into a tool that deletes somebody else's tables. `force: true` overrides, and should be rare.

## Changing the schema later

It will change. Three things make that safe:

- **Steps are append-only and versioned.** A released step is never edited: the deployments that ran it would
  never see the change.
- **The version is recorded after EACH step, not at the end.** MySQL cannot roll back DDL, so a step that fails
  halfway has already applied some of its statements. Bumping once at the end would make the retry start over and
  meet them again; recording per step means it resumes where it stopped.
- **Steps after the first are written with `addColumn`, `dropColumn` and `addIndex`**, which check
  `information_schema` and prepare either the real statement or a no-op. MySQL has no `ADD COLUMN IF NOT EXISTS`;
  this is how a step survives being run twice.

A build older than the database is refused outright, naming both versions: an older process reading rows a newer
schema wrote is worse than a process that will not start.

## Running it

```ts
const store = await createMysqlStore({
  url: process.env.DATABASE_URL,      // or host/port/user/password/database
  tablePrefix: '',                    // share a database with something else
  ensureDatabase: false,              // dev only: CREATE DATABASE IF NOT EXISTS
  autoMigrate: true                   // CREATE TABLE IF NOT EXISTS, once, under an advisory lock
});
```

`autoMigrate` is on by default so a fresh database works with no step before it. **Turn it off in production** and
apply `mysqlSchemaStatements()` through whatever you migrate with — an application that can alter its own tables is
an application that can be made to.

Migrations run under a MySQL advisory lock, because an all-in-one deployment starts several roles against one
database at the same moment. `IF NOT EXISTS` survives that race; the version bump would not.

`mysql2` is an **optional peer dependency**: this is the only part of the package that speaks to a database, and a
deployment bringing its own store should not download a driver to find that out. `yarn add mysql2`.

## Mapping an existing schema

You need three reads and a small write surface. Assuming a `users` table of your own:

```ts
const adapters: IdentityAdapters & AccountAdapters = {
  findAccountByToken: async token => {
    const row = await db.users.findFirst({ where: { sessionToken: token, active: true } });

    return row && {
      id: row.id, username: row.name, email: row.email, verified: row.emailConfirmed,
      roles: await rolesOf(row.id), permissions: await permissionsOf(row.id),
      token, expiresAt: row.sessionExpiresAt          // unix SECONDS, off the row
    };
  },
  findMembership: async (userId, spaceId) => …,       // omit → every space permission refuses
  findSpaceToken: async token => …,                   // omit → every space credential refuses

  saveSession: (userId, session) => …,                // writing the pair retires the previous one
  clearSession: target => …,                          // by userId, accessToken OR refreshToken
  loadAccess: userId => …
};
```

Everything past those three is optional, and **what you leave out decides what the deployment offers**: no
`createAccount`, no signup, and `POST /auth/signup` answers 404 rather than failing at runtime. `GET
/auth/capabilities` publishes the result, so a sign-in page can render what the backend actually answers.

Two you will want and the store does not provide, because only you can:

- **`sendMail`** — without it the reset and validation flows mint tokens nobody receives.
- **`exchangeCredential`** — turning a credential from an external identity provider into a session here.

Spread them on top: `adapters: { ...store.authAdapters, sendMail }`.

## Where to look next

- A working deployment on these tables: [`examples/02-with-users/02-mysql`](../../../../examples/02-with-users/02-mysql).
- The same pages over a store you wrote: [`examples/02-with-users/01-sessions`](../../../../examples/02-with-users/01-sessions).
- The adapter types themselves: [`src/core/auth/api.ts`](../../src/core/auth/api.ts) and
  [`src/core/auth/identity.ts`](../../src/core/auth/identity.ts).
