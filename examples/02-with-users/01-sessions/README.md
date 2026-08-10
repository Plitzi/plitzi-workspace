# A space with users

A server-rendered space that knows who is looking at it. Sign in, stay signed in across a restart of the browser,
renew before the credential lapses, and sign out everywhere.

```bash
yarn workspace @plitzi/example-with-users start
# http://127.0.0.1:4007
```

Open it and you get a sign-in form. Sign in as **ada / password** and the page becomes the signed-in one, with your
name and email in it and a sign-out button. Sign out and you are back at the form.

All three renders come from the server: the name is in the HTML before any JavaScript runs.

## What you write

Three things, and the first one is yours already.

**An account store** ([`src/accounts.ts`](./src/accounts.ts)) — here two rows in an array, because an example should
not make you install a database to see the shape. Swap it for Postgres, MySQL, Mongo or an identity service and
nothing else in this example changes: the server never learns which you chose.

**Two pages** ([`src/space.ts`](./src/space.ts)) — the sample space plus a page to sign in on and a page you only
see once you have. They share one path and differ by `accessLevel`, and the router picks between them from whether
the visitor is signed in; neither page contains a condition. The signed-in one binds `{{user.*}}`, the auth data
source the SDK publishes from whoever is signed in.

**One call** ([`src/main.ts`](./src/main.ts)):

```ts
const auth = createAuth({
  tokens: { secret, issuer: 'https://acme.test' },
  cookie: { name: 'example_session' },
  adapters: accounts,
  api: { verifyPassword }
});

const server = createServer({ port, adapters: space, auth });
```

`auth` on the server is the whole of the wiring. It mounts the `/auth` flows, fills in the three adapters a page
server asks about identity, and carries the cookie naming with it — so there is no second place to keep in step.

## Try it in a browser

http://127.0.0.1:4007 — sign in as `ada / password`, or as `grace / password` to see the other half of the model:
both are signed in, only `ada` holds `spaceUpdate`. A credential says **who** you are; what you may do is a separate
question.

## Try it from the command line

```bash
# nobody is signed in — no request needed to know that, but here is the endpoint
curl -s localhost:4007/auth/session                       # 401 {"reason":"missing"}

# sign in
curl -sc jar -X POST localhost:4007/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"ada","password":"password"}'

# who am I? — costs no database query: the guard already resolved it
curl -sb jar localhost:4007/auth/session

# renew. The answer carries the new credential AND the identity, so a returning
# visitor is restored in one request rather than two
curl -sb jar -c jar -X POST localhost:4007/auth/refresh

# sign out. The credential itself stops working, not just this browser's copy
curl -sb jar -X POST localhost:4007/auth/logout
curl -sb jar localhost:4007/auth/session                  # 401
```

## What the server decided for you

- **The credential is renewed, not re-issued.** A renewal stores a new pair, and storing it is what retires the
  previous one — so the old token stops working the moment the new one is minted. That is the whole of rotation, and
  the reason the store looks accounts up *by token* rather than by id.
- **Sign-out revokes at the source.** Clearing the cookie alone would leave the credential working for anyone who had
  already copied it.
- **A readable hint cookie rides beside the session**, holding only expiry timestamps. It grants nothing, and it is
  what lets a page answer "nobody is signed in" — the common case — without asking the server at all.
- **Every refusal names a reason.** `expired` means renew; `revoked`, `inactive` and `missing` mean the session is
  over. Without that a client either signs people out on a hiccup or retries forever.

## What this deployment does *not* offer

```bash
curl -s localhost:4007/auth/capabilities
```

```json
{"features":{"passwordLogin":true,"refresh":true,"signup":false,
             "passwordReset":false,"emailVerification":false,"exchange":false}}
```

Nobody configured that. The store above implements no `createAccount`, so there is no signup — and the route answers
404 rather than failing at runtime. Add the adapter and the flow appears. A sign-in page reads this endpoint and
renders what the backend actually answers, instead of a button that dead-ends.

Declining a flow is one act: do not implement its adapter. There is no second switch that could disagree with it.

## Next

A browser-side identity provider (Auth0, Cognito, Entra) signs people in without the server seeing it, which leaves
SSR rendering a guest page that changes as it hydrates. `sessionExchangeUrl` and the `exchangeCredential` adapter
close that: the browser hands its credential over once and the server issues a session of its own.
See [`docs/auth/provider-contract.md`](../../../../plitzi-sdk-server/docs/auth/provider-contract.md).
