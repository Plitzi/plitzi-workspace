---
'@plitzi/cli': patch
---

An authored request connects to the address its name was judged to, and the advised dependencies are moved off.

## Kernel

- `fetchOutbound` closes DNS rebinding: every hop's socket connects to the addresses the guard judged the name to, and
  never resolves it again — a name whose DNS answered a public address to the guard and a private one a moment later
  reached the private one. A name the guard could not resolve is not found when the socket opens, rather than resolved
  then. The deployment's own origins (`privateOrigins`) are reached as before. `undici` is still loaded only when the
  first guarded request is sent.
- A server stopping (`watchConnections().drain`) no longer throws on an upgrade it refused: a socket answered `401`
  with `socket.end` and held open by its client was told "going away" after its end — a `write after end` nobody
  listened to, an uncaught exception in the middle of the shutdown — and held the shutdown for the whole grace. It is
  closed once its refusal is out. The functions runner and every server that refuses an upgrade without the secret met
  it.

## Runtime

- The functions runner's own tests are in `@plitzi/sdk-runtime`: its limits, its threads, what the code finds in an
  isolate, what the runner keeps, the guest's `fetch` and `crypto`, the driver, the service's admission, queue and stop
  — and a suite of what a guest tries against the sandbox (constructors, ctx's methods, module loading, the network,
  CPU, memory, timers, calls, a second invocation, the top level). A limit broken in the runner fails this package's
  suite, with no engine built.

## Server

- Realtime over Server-Sent Events works behind a balancer with no affinity. A page publishes with `POST /_realtime`
  and its stream's token, which only the replica holding the stream knew: one that reached another replica was
  answered `401 not_connected`. It is relayed over the shared `pubsub` to the replica holding the stream and answered
  as that one answers its own — its rate and presence there; with no replica answering, `401` as before.
- The sign-in throttle's counts are a store a deployment chooses: `createRateLimit({ counts })` holds the policy (the
  account from an address, the address over accounts, the account's ceiling, what a success gives back), and its
  counts are this process's memory (`memoryThrottleCounts`, the default) or a Redis the replicas share
  (`redisThrottleCounts(redis, { prefix })`) — each attempt one Lua script over its counts, so a burst sent at once
  cannot read an empty window together. **Rename:** `createMemoryRateLimit()` is `createRateLimit()`.
- Signing in is throttled by the address as well as the account: ten failures from one address refuse that address on
  that account, not its owner signing in from theirs; one address is slowed past 30 failures over any accounts (a
  password sprayed over usernames); and an account holds a ceiling of 100 from anywhere, so an `X-Forwarded-For` the
  client spells cannot buy unlimited tries. The address is what a session's device records (`req.ip`, then
  `X-Forwarded-For` and the headers an edge sets); with none, the account alone, as before.

## SDK

- The build writes `dist/build.json` with the mode it was made in (`{ "mode": "production" }`): what packs the `dist` —
  a server image — reads it rather than guessing a development build by its size.

## CLI

- The `plitzi-cli` skill's description fits the 1,024 characters the skills format allows (it was 1,221), held by a
  test; `plugins.md` names `plugin add`, not the `add plugin` that no longer exists.
- `plitzi verify` on a project nothing serves serves it for its page checks and stops it after, and says so: on a fresh
  `create` it passed every check but the last until `npm start` was run by hand.
- A new project installs with no advisory: the scaffold moves `minimatch` past its advisory (`overrides` for npm,
  `resolutions` for Yarn, `overrides` in pnpm's `pnpm-workspace.yaml`) — `create` ended on "10 moderate severity
  vulnerabilities", one advisory of eslint's counted ten times. A test holds every `plitzi …` command the skills write
  to one the CLI has.

## Builder

- A builder that cannot open its space says why and where to go — a session that ended (sign in again), a space out of
  reach (back to your spaces), a platform that does not answer (try again) — where it drew the bare words of the error
  on an empty page.
- The top bar fits from 1280 px: Snapshot and Publish were past the window's right edge at 1440 (the bar needed 1,564
  px). Under 1,536 px the search and Export are their icons (their names kept as title and accessible name), the
  element count its figure, the canvas's width reading left out; the actions never shrink, and where the window is still
  too narrow the left side scrolls inside itself. Nothing is taken out of the bar (`e2e/tests/builder/bar.spec.ts`).

## Space document

- A page for signed-in visitors (`accessLevel: 'authenticated'`) is withheld from the signed out — sent empty, its
  redirect kept — as a page for some permissions already was. Only the ones answering as if they did not exist were:
  a visitor of a public page downloaded every page of a dashboard its own visit redirects away from (Plitzi's website:
  151 → 99 KB compressed for a guest).

## AI crawlers, by kind

- `settings.blockAiCrawlers` is the list of the kinds of AI crawler a space keeps out — `training`, `assistants`
  (fetching a page for a person), `search` — each its owner's to decide, in the builder (**Settings → Sharing**), in
  code and through the MCP (`AI_CRAWLERS`, `@plitzi/sdk-shared/schema`). One switch kept them all out.

## security.txt

- A space says its `/.well-known/security.txt` (RFC 9116) in `settings.securityTxt` — the builder's Sharing settings,
  code or the MCP — and the page server answers it as written; a space that says nothing answers 404 there.

## Elements

- A form control's `autoComplete` takes what the field holds — `username`, `current-password`, `new-password`,
  `one-time-code`, `email`… (`AUTOFILL_FIELDS`) — beside `true` and `false`. A password field said `off` on every space,
  so no password manager filled a sign-in or offered to save a new password: left on `true` it is now the account's
  `current-password`. Nothing is filled in the builder's canvas.

## Dependencies

- `body-parser` 2.4, `qs` 6.17, `fast-uri` 3.1.9, `ip-address` 10.7.6, `zod` 4.6.7 and `launch-editor` 2.14.2 in the
  tree: no high or critical advisory is left, and CI's `audit` job holds it there.

## To do when you upgrade

- `createMemoryRateLimit()` → `createRateLimit()`. A deployment of several replicas passes
  `api.rateLimit: createRateLimit({ counts: redisThrottleCounts(redis, { prefix: '{auth-throttle}:' }) })`.

- A space that said `blockAiCrawlers: true` says which kinds now — `['training']` for what it kept out before —
  and `false` is left out. A `true` keeps nobody out any more.

- A caller of `fetchOutbound` whose `base` builds its own request hands `init` on to Node's `fetch` as it got it: the
  `dispatcher` in it is what connects each hop to what was judged.
