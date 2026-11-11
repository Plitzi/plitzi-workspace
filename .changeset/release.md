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

## Tracing

- One trace for a run, across every process it crosses (`@plitzi/sdk-kernel/trace`): a request takes its caller's W3C
  `traceparent` — or starts a trace — and answers with its own span of it; every log event carries `traceId` and
  every line ends `trace=…`; the worker opens the runner's socket with it, the runner runs the invocation in it and
  says one line of each (`debug` when it answered, `warn` when it broke); a run's record names it (`traceId`). No
  vendor and no exporter: a deployment that wants spans reads them off the log events.

## Runtime

- A runtime's functions answer as the protocol says every runner does (`createRuntimeRunner`): a task that throws ends
  as `error` with its words, where it rejected with the bare error; aborted, an invocation ends whatever its code
  waits on, where it waited on; and what it spent is said before it settles (its time and calls — a runtime is paid
  by its size, so no CPU of its own). One contract holds the sandbox, the runner service and a runtime to it
  (`runnerContract.ts` in `@plitzi/sdk-actions`'s tests).
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

- A server-rendered page carries the space's variables alone inline: its custom CSS goes in the stylesheet it links
  (`/_plitzi/style/<hash>.css`) after the compiled rules, as the page drew them, and the browser keeps it with them.
  It was most of every page's HTML — Plitzi's website carried 44.7 KB of it on each, and `/terms` is 89 → 45 KB.
  A page that cannot link its stylesheet (a draft, a space named by a token) carries both as before.
- The build writes `dist/build.json` with the mode it was made in (`{ "mode": "production" }`): what packs the `dist` —
  a server image — reads it rather than guessing a development build by its size.
- A selector's colour variable given as one value (`'#05f'`, not `{ light, dark, default }`) is written as that value,
  and a theme value with no `default` writes its schemes alone: both were written `--name:undefined;`, a variable no
  rule could use.
- A colour with a fractional or percentage alpha — `rgba(0, 0, 0, .5)`, `rgba(0, 0, 0, 50%)` — is a colour to the
  space's variables, written as it is: it was quoted, `--shade:"rgba(0, 0, 0, .5)";`, a string no `color` reads.

## CLI

- The `plitzi-cli` skill's description fits the 1,024 characters the skills format allows (it was 1,221), held by a
  test; `plugins.md` names `plugin add`, not the `add plugin` that no longer exists.
- Every command starts ~13 % sooner (`plitzi --version` 95 → 82 ms, median of ten): the bundle carried a second copy of
  `@plitzi/sdk-authoring` — its `node` entry and the chunks it shares with the root, 1 MB compiled again on every start
  beside the one loaded from `node_modules`. Only the package's root was marked external; its subpaths are too now.
- A command of one agent no longer loads the multi-agent harness: `plitzi run`, `plitzi task`, `space overview` and
  `space impact` load it when one of them runs, from a chunk of its own. What a start reads went from 3.9 MB to 1.7 MB
  — `plitzi --version` 95 → 79 ms and `plitzi explain` 92 → 79 ms with the change above; a run's commands start as
  before. No command's output or options changed.
- Every refusal of a command says its code and the step to take, on a line under the problem — `Next (exists): choose
  another name or place…` — from one list the MCP shares (`@plitzi/sdk-shared/refusals`, `docs/en/refusals.md`),
  which `plitzi explain <code>` answers along with a run's refusal codes. A command that could not answer because
  nothing did (`unanswered`) exits 2 wherever it is raised: `page shot` with no server exited 1, as if the page were
  wrong.
- A CLI out of step with the platform is told: one a minor behind is answered and told once for each version of the
  platform (and `plitzi doctor` says it again, `cli-behind-platform`); one older than the platform takes is refused
  (`outdated`) with the step that upgrades it. The CLI says its version on every request (`x-plitzi-client`).
- `plitzi verify` on a project nothing serves serves it for its page checks and stops it after, and says so: on a fresh
  `create` it passed every check but the last until `npm start` was run by hand.
- A new project installs with no advisory: the scaffold moves `minimatch` past its advisory (`overrides` for npm,
  `resolutions` for Yarn, `overrides` in pnpm's `pnpm-workspace.yaml`) — `create` ended on "10 moderate severity
  vulnerabilities", one advisory of eslint's counted ten times. A test holds every `plitzi …` command the skills write
  to one the CLI has.

## MCP

- A write sent again — a client that timed out and retried, an agent that lost the answer — changes nothing and writes
  nothing: a store a batch left as it was is no longer saved. Every write the MCP sent was saved even when it changed
  nothing, so a retried `plitzi_set_attributes`, `plitzi_apply` or `plitzi_add_page` added a second entry to the space's
  history (two, with a class in it) for an edit nobody made. The answer says `Nothing changed`, as it did.
- Every error of a refused batch carries a `code` from the list the CLI shares, beside its `path` and `hint`, and a
  tool that cannot act answers with one of the same codes: `UNKNOWN_OPERATION` is `missing`, `REPEATED_BATCH`
  `repeated`, `PREVIEW_UNAVAILABLE` `not-allowed`, a resource's `NOT_FOUND` and `MALFORMED_URI` `missing` and
  `bad-value`, the preview's `NO_DATA` and `INVALID_OPERATIONS` `missing` and `bad-value`.
- A delete of what the space does not have is refused (`missing`) for every kind: a variable, a class, a global or id
  style, a token and a font answered `Nothing changed` and counted it deleted, so a mistyped name read as done. Hints
  that named no step (`Nothing to delete`, an empty one for an invalid action) name one.
- An id style is checked as a class is — an unknown CSS property is refused with the nearest one — and a token's name
  must be one `var()` can read: `upsertIdStyle` wrote any property, and `upsertStyleVariable { name: "brand primary" }`
  wrote `--brand primary`.
- What each answer costs an agent is a table the package exports (`ANSWER_BUDGETS`, `HOST_ANSWERS`): the answers made
  from the space alone are held to it here, and a host holds the ones its adapters make — Plitzi's activity is.
- A page wears classes of its own: `upsertPage { style: { base: [...] } }` gives its root what a class says (its
  background, its padding), checked as an element's classes are. There was no way to over the MCP. The element tools
  named on a page point at it, and their refusals carry a code like every other tool's.
- The element tools named on a page or a layout say so — `"home" is a page, not an element on one` — and where to
  edit it, instead of `There is no element "home" — did you mean "home"?`. A ref nobody has is offered the nearest
  element, never a page.

## Authoring

- A page whose part of the document passes 250 KB is suggested (`heavy-page`) — every visitor downloads it before the
  page is theirs — naming the three shapes written again most inside it, by what they weigh: the rows to make one
  `list`, the blocks written per state to make one element.

## Builder

- A builder that cannot open its space says why and where to go — a session that ended (sign in again), a space out of
  reach (back to your spaces), a platform that does not answer (try again) — where it drew the bare words of the error
  on an empty page.
- The top bar fits from 1280 px: Snapshot and Publish were past the window's right edge at 1440 (the bar needed 1,564
  px). Under 1,536 px the search and Export are their icons (their names kept as title and accessible name), the
  element count its figure, the canvas's width reading left out; the actions never shrink, and where the window is still
  too narrow the left side scrolls inside itself. Nothing is taken out of the bar (`e2e/tests/builder/bar.spec.ts`).
- A builder left open across a release says so: a toast once when the platform is newer, and a **Reload** screen
  when it is older than the platform takes — where its requests would have failed one by one. It says its version as
  `x-plitzi-client` on every call — GraphQL and the API's own — in place of the `sdk-version` header nothing read.
- Deleting a class in the Style Manager takes it out of every element that wears it and keeps the element's other
  classes: an element on `card primary` kept `primary` when `primary` was deleted — a class the space no longer had —
  and only an element on `primary` alone lost it.

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
- sdk-authoring takes those tokens: an attribute whose default is a flag and that declares named values is either, and
  its refusal says both. Before, `formControl({ autoComplete: 'current-password' })` was refused as text where a boolean
  was read. The type is `AutofillField`, from `@plitzi/sdk-elements/elements/form/FormControl`.

## Dependencies

- `body-parser` 2.4, `qs` 6.17, `fast-uri` 3.1.9, `ip-address` 10.7.6, `zod` 4.6.7 and `launch-editor` 2.14.2 in the
  tree: no high or critical advisory is left, and CI's `audit` job holds it there.

## Clients and versions

- The platform judges the CLI and the builder by the version they say (`@plitzi/sdk-shared/clients`: `judgeClient`,
  `CLIENT_HEADER`, `CURRENT_HEADER`): `426 outdated` below the oldest a surface takes, `x-plitzi-current` on an answer
  to one behind. A deployment names each floor; Plitzi's default is the minor before its own
  (`CLIENT_OLDEST_CLI`, `CLIENT_OLDEST_BUILDER`).

## To do when you upgrade

- A client that read the MCP's error names reads the codes of `@plitzi/sdk-shared/refusals` (above); a host that builds
  a `ValidationError` or a `PreviewResult` gives it a `code` (`RefusalCode`). The CLI's `fail(problem)` is
  `fail(code, problem, next?)`.

- `createMemoryRateLimit()` → `createRateLimit()`. A deployment of several replicas passes
  `api.rateLimit: createRateLimit({ counts: redisThrottleCounts(redis, { prefix: '{auth-throttle}:' }) })`.

- A space that said `blockAiCrawlers: true` says which kinds now — `['training']` for what it kept out before —
  and `false` is left out. A `true` keeps nobody out any more.

- A caller of `fetchOutbound` whose `base` builds its own request hands `init` on to Node's `fetch` as it got it: the
  `dispatcher` in it is what connects each hop to what was judged.
