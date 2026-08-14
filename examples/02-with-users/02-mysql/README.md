# A space with your own users, in your own MySQL

The same space as [`01-sessions`](../01-sessions), and the same two pages. What changes is where the people come
from: not an array in a file, but a database you own — with the tables created for you.

```bash
yarn workspace @plitzi/example-with-users-mysql start
# http://127.0.0.1:4008
```

Sign in as **ada / password** or **grace / password**. Both are real rows. **root / password** is the third, and
the only one that may administer the others.

## What you write

```ts
const store = await createMysqlStore({
  host: '127.0.0.1',
  port: 33006,
  user: 'user',
  password: 'password',
  database: 'plitzi_example',
  ensureDatabase: true
});

const auth = createAuth({
  tokens: { secret, issuer },
  adapters: store.authAdapters,
});

createServer({ adapters: space, auth }).listen(PORT);
```

That is the whole of it. In the sibling example `adapters` is a file you maintain — sixteen functions over your own
tables, one of which has a trap in it. Here it is a connection string.

Nothing is hidden by that: `store.authAdapters` is the same `IdentityAdapters & AccountAdapters` the other example
writes by hand, and you can still spread your own on top of it —

```ts
adapters: { ...store.authAdapters, sendMail }
```

— which is how you add what only you can answer. `sendMail` is the one worth knowing about: without it the
password-reset flow still mints a token and nobody ever receives it.

## The connection is asked for, not assumed

Every field reads from the environment, so the same code runs against the MySQL in this repository's docker and
against somebody else's server:

```bash
MYSQL_HOST=db.internal MYSQL_PORT=3306 MYSQL_USER=app MYSQL_PASSWORD=… MYSQL_DATABASE=acme \
  yarn workspace @plitzi/example-with-users-mysql start

# or, as one string
DATABASE_URL=mysql://app:secret@db.internal:3306/acme yarn workspace @plitzi/example-with-users-mysql start
```

The defaults point at `plitzi-db-1` on `:33006` — the same MySQL server the platform uses in development, in a
**separate database** (`plitzi_example`). Nothing here reads or writes anything in `project`.

## The tables

Twelve, created on first run and documented in
[`apps/server/docs/auth/mysql-schema.md`](../../../apps/server/docs/auth/mysql-schema.md):

```
account          the person, their password hash, and their single-use tokens
session          one row per signed-in device
account_identity the same person at another provider — unique on (provider, subject), never on email
account_mfa      a TOTP secret, when it was proven, and hashed recovery codes
account_otp      one-time codes, for signing in by email
account_role     which global roles an account has
role             a named bundle of permissions
permission       one capability
role_permission  which permissions a role bundles
space_member     membership of ONE space, with the role that applies inside it
space_token      a space's own credentials, for published sites and agents
schema_version   what version of this schema the database is at
```

Every one of them is **prefixed**, and `tablePrefix` is required. `account`, `role` and `session` are names
anything might already have; a prefix you chose is what makes a collision mean a real collision rather than a
coincidence. Point a second install at the same database under another prefix and the two coexist untouched.

`space_id` carries no foreign key on purpose: spaces are not this schema's to own — you keep them wherever you keep
them, and auth only ever asks who belongs to one.

### On the first run

The example passes `ensureDatabase: true` and `autoMigrate: true`. Both are development conveniences and both are
off by default, because neither creating a database nor altering tables is a right a production application should
hold. If your database user cannot create databases — the one in this repository cannot — you get told exactly
that, along with the statement to run:

```sql
CREATE DATABASE plitzi_example CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON plitzi_example.* TO 'user'@'%';
```

In production, leave `autoMigrate` off and apply `mysqlSchemaStatements()` through whatever you migrate with.

## Two halves of one permission

Both accounts are signed in; only `ada` may change the space. That takes two facts, and the seed
([`src/seed.ts`](./src/seed.ts)) sets them separately:

- a **global** capability her account holds — `spaceUpdate`, via the `editor` role;
- her **membership** of this space, with a role that applies inside it.

Neither is enough alone. A capability is a property of the account and never a claim about a particular space,
which is what lets somebody edit one space and only read another.

## Try it from the command line

```bash
curl -s localhost:4008/auth/session                       # 401 {"reason":"missing"}

curl -sc jar -X POST localhost:4008/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"ada","password":"password"}'

curl -sb jar localhost:4008/auth/session
curl -sb jar -c jar -X POST localhost:4008/auth/refresh   # rotates: the old token dies now, not at expiry
curl -sb jar -X POST localhost:4008/auth/logout
curl -sb jar localhost:4008/auth/session                  # 401 {"reason":"revoked"}
```

`revoked`, not `expired` — signing out deleted the row the token is looked up by, so the credential stops working
for anyone who copied it, not just for this browser.

## Signed in on more than one device

The sessions are rows, so signing in twice is two of them — and signing in on a phone does not sign you out on a
laptop:

```bash
curl -sc laptop -X POST localhost:4008/auth/login -H 'content-type: application/json' \
  -H 'user-agent: Firefox/laptop' -d '{"username":"ada","password":"password"}'
curl -sc phone  -X POST localhost:4008/auth/login -H 'content-type: application/json' \
  -H 'user-agent: Safari/phone'  -d '{"username":"ada","password":"password"}'

curl -sb laptop localhost:4008/auth/sessions
# { "sessions": [ { "id": 1, "userAgent": "Firefox/laptop", "current": true  },
#                 { "id": 2, "userAgent": "Safari/phone",   "current": false } ] }

curl -sb laptop -X POST localhost:4008/auth/sessions/revoke-one \
  -H 'content-type: application/json' -d '{"sessionId":2}'      # the phone is out
curl -sb laptop -X POST localhost:4008/auth/sessions/revoke-others   # everything but this one
```

`current` is there so a device list cannot invite somebody to revoke the one they are looking at it from.

**Renewing does not add a session.** A refresh replaces the row it names, so the laptop stays one device however
many times its credential rotates — which is what makes the list mean anything a day later.

## Managing your own account

```bash
curl -sb laptop -X POST localhost:4008/auth/profile \
  -H 'content-type: application/json' -d '{"email":"ada@newmail.test"}'

curl -sb laptop -X POST localhost:4008/auth/password \
  -H 'content-type: application/json' -d '{"currentPassword":"password","password":"newpass"}'
# { "success": true, "message": "Password changed. Other sessions were signed out." }

curl -sb laptop -X POST localhost:4008/auth/delete-account \
  -H 'content-type: application/json' -d '{"password":"newpass"}'
```

Three decisions the server made, and each is the difference between the feature and an imitation of it: a password
change **signs out the other devices and not this one**; closing an account **asks for the password**, because it
is irreversible and a borrowed session should not be able to do it; and a username or email that is taken comes
back as a `409` rather than as a driver error from a unique index.

## Administering other accounts

Only `root` — it is the one seeded with `userManage`, the permission `createAuth({ api: { adminPermission } })`
names. `ada` is an editor and gets a flat `403`.

```bash
curl -sc root -X POST localhost:4008/auth/login -H 'content-type: application/json' \
  -d '{"username":"root","password":"password"}'

curl -sb root 'localhost:4008/auth/admin/accounts?search=ada&limit=10'
curl -sb root 'localhost:4008/auth/admin/account?id=2'

curl -sb root -X POST localhost:4008/auth/admin/account/status \
  -H 'content-type: application/json' -d '{"userId":2,"status":"blocked"}'
curl -sb root -X POST localhost:4008/auth/admin/account/roles \
  -H 'content-type: application/json' -d '{"userId":2,"roles":["editor"]}'
curl -sb root -X POST localhost:4008/auth/admin/account/delete \
  -H 'content-type: application/json' -d '{"userId":2}'
```

**A ban ends the sessions.** Setting a status to anything but `active` clears them, so the person is signed out
now rather than whenever their token happens to lapse. A ban that leaves the credential working is a note in a
database.

**An administrator cannot act on their own account here.** Banning or deleting yourself through the admin routes is
how a deployment loses its last administrator; closing your own account is the self-service flow above, which asks
for a password.

Never returned, to anyone, including an administrator: password hashes and session credentials.

## A second factor

```bash
curl -sb jar -X POST localhost:4008/auth/mfa/begin      # → { secret, uri }  — the URI is what an app scans
curl -sb jar -X POST localhost:4008/auth/mfa/confirm \
  -H 'content-type: application/json' -d '{"code":"123456"}'   # → { recoveryCodes: [ …ten… ] }
```

From then on signing in is two steps: the password answers `{ mfaRequired: true, mfaToken }` and no session, and
`POST /auth/mfa/complete` with the app's code finishes it. A recovery code works too, once — it is spent when it is
used, because one that survives being used is a password with extra steps.

Three things the server decided: an enrolment does nothing until a real code confirms it (a scan that failed must
not lock you out); the challenge is a signed token that verifies as nothing else, not a session; and the recovery
codes are stored hashed and shown once, so reading the database is not a way around the factor.

## Signing in without a password

```bash
curl -s -X POST localhost:4008/auth/passwordless/request \
  -H 'content-type: application/json' -d '{"email":"grace@example.test"}'
# { "message": "If that address has an account, a sign-in link is on its way" }
```

The code goes to `sendMail`, which in this example prints to the console — that is the one adapter the store cannot
supply, and supplying it is what turns this flow on. Then:

```bash
curl -s -X POST localhost:4008/auth/passwordless/complete \
  -H 'content-type: application/json' -d '{"email":"grace@example.test","code":"…"}'
```

The request answers **identically for an address with no account**, or the endpoint becomes a way to ask which
addresses have one. It never creates an account, and a second factor still applies: arriving by email proves the
address, which is one factor.

## Watching what happens

`api.onEvent` is every act worth recording in one feed — sign-ins and failed ones, password changes, admin
actions. An audit trail, a webhook and an alert are the same thing, so the server emits and never decides which.
The example prints them; it is never awaited and never able to fail a request.

## What this deployment offers

```bash
curl -s localhost:4008/auth/capabilities
```

Every flow above appears there as `true` **because an adapter implements it**, and that is the only switch there
is. The MySQL store implements them all; a deployment mapping its own tables turns a flow off by not writing its
adapter, and the route answers 404 rather than failing at runtime.

## Seeding

Nothing a visitor can do creates the first account with any authority — signing up creates an ordinary one. So the
roles, the permissions and the memberships come from somewhere else, and `store.admin` is that somewhere:

```ts
await admin.ensureRole('editor', { permissions: ['spaceRead', 'spaceUpdate'] });
const ada = await admin.ensureAccount({ username: 'ada', email: '…', password: '…', roles: ['editor'] });
await admin.addMember(1, ada, 'editor', { owner: true });
```

Every call is idempotent, so restarting the server is not a way to break it. `ensureRole` is declarative — the
permission list you pass is the list the role ends up with, so taking one away works.

## Already have a user table?

Then you do not want any of this. Implement the adapters against your own schema — that is
[`01-sessions`](../01-sessions), and the schema document lists what each adapter has to be able to answer, so you
can map an existing table onto it without reading the source.
