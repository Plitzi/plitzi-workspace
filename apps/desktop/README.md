# @plitzi/plitzi-desktop

The Plitzi desktop client: sign in, browse the spaces the account can reach, and open one in a window of its own.

It replaces the standalone `plitzi-desktop` repository (Electron 22, webpack, plain JS, `@plitzi/plitzi-sdk` 0.6,
`@plitzi/plitzi-ui-components`). Same screens, rewritten against the stack this repository actually ships.

```
yarn workspace @plitzi/plitzi-desktop start     # Vite on :5180 + an Electron window over it
yarn workspace @plitzi/plitzi-desktop test
yarn workspace @plitzi/plitzi-desktop package   # a signed-off installer, via electron-builder
```

It is deliberately **not** part of the root `yarn start`: a window that opens itself every time somebody starts the
web dev loop is a window nobody asked for.

## The one thing a deployment has to be told

`PLATFORM_ORIGINS` must name the origins this app presents from:

```
plitzi-app://home        # the packaged window
http://localhost:5180    # `vite dev`, while developing
```

That list is what the sign-in CSRF rule, the CORS answer **and** a space token's origin allowlist are all matched
against — `originAllowed` counts a platform origin as valid for every space, which is what lets this window render
a space it did not host.

The 2023 build got there by forcing an `Origin: plitzi-desktop` header on the way out. That worked because the
value was in the same list, and it stopped being tenable the moment the server started believing `Sec-Fetch-Site`:
a header a client sets for itself proves nothing. A real origin is now the whole mechanism.

## How it differs from the 2023 build

| | Then | Now |
|---|---|---|
| Session | `access_token` in `localStorage` | Encrypted by the OS keyring (`safeStorage`), reached through a three-call preload bridge |
| Auth | `POST /auth/login` with a cookie and a bearer | Bearer only, with the CSRF echo `GET /auth/csrf` publishes. A desktop origin makes the session cookie a third-party cookie, and those are not something to build on |
| Renewal | A `setTimeout` that signed you out on expiry | `POST /auth/refresh`, one renewal at a time, ahead of the request that would have failed |
| Spaces | `GET /spaces`, split by comparing `owner.id` | `?scope=owned` and `?scope=guest`, because reach is now a workspace role, a team, or a direct grant |
| Credential | `default_token.token` off the list row | `GET /spaces/:id/token` when a space is opened — it expires, and this window stays open for days |
| Renderer origin | `file://` (opaque) | `plitzi-app://home`, a real origin a deployment can name |
| Preload | none; `nodeIntegration` implicit | `contextIsolation`, `sandbox`, and exactly three calls exposed |
| Build | webpack 5 + Babel, JS | Vite 8 + TypeScript, three builds (renderer, main, preload) |
| Tests | jest, none written | vitest, 39 covering the session store, the API client, the session shape and the environment |

## Layout

```
electron/
  main.ts          window, menu, the plitzi-app:// handler, the session IPC
  preload.ts       the bridge, as a classic script (a sandboxed preload is not a module)
  secretStore.ts   one string, encrypted at rest
src/
  config/          which deployment this build talks to
  modules/
    network/       the API client: bearer, CSRF, and failures that are values
    auth/          session, provider, the /auth flows, the sign-in screens
    spaces/        the list, the credential, the two pages
    desktop/       the bridge, and a browser-shaped stand-in for it
  Layout/          the shell: main, login, empty
  components/      PlitziSdkWrapper
```

## Known gaps

- **MFA.** `POST /auth/mfa/complete` exists on the server and this app does not call it, so an account with a second
  factor is told to sign in on the web. The sign-in screen says so rather than failing silently.
- **Social sign-in.** The 2023 screens had Google and Facebook buttons that were never wired to anything; they are
  gone rather than reproduced. The flows are `/auth/oauth/*` and need a browser round trip the shell has to broker.
- **Deep links.** `plitzi://` is not registered yet, so a password-reset link from an email opens in the browser.
  The routes that handle those links (`/auth/reset-password`, `/auth/validate-account`) are already reachable with a
  session, which is what a deep link would need.
