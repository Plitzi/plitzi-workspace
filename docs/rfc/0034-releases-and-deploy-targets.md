# RFC 0034 — Releases and deploy targets: snapshot, publish, deploy, roll back

- **Status:** Proposal — for review; no work started
- **Author:** Plitzi
- **Date:** 2026-11-16
- **Scope:** `plitzi-sdk-server` (a space's targets, its release history, the deploy jobs, the providers' credentials,
  snapshot pruning), `@plitzi/sdk-server` (the builders — SPA shell, static prerender, SSR bundle — and the generic
  uploaders), the builder (`apps/builder`: the snapshot modal, a publish panel, the targets' settings), the CLI
  (`apps/cli`) and the MCP (`apps/mcp`)

---

## 1. Summary

Today a space reaches the world in two steps the builder names badly: **Make a snapshot** freezes the draft as a
revision of an environment, and **Publish a snapshot** points a domain at a revision. For the domains Plitzi serves
itself — `*.plitzi.app` and a custom domain whose CNAME points at Plitzi's page servers — that is the whole of it, and
it is the right model: a publish moves a pointer to something immutable, so it is instant and it can be undone.

What is missing is everything around that pointer, and every place the site may live that is not Plitzi:

- **No history and no way back.** A publish overwrites the domain's row; the revision it served before is gone from the
  record, so "go back to what worked" is a guess at a number.
- **One dialog for three decisions.** Environment, domain, credential and revision in four selects, with the draft
  (`main`) presented as an environment like the others, and nothing that says what changes for the visitor.
- **Hosting elsewhere barely exists.** The static path writes an empty shell that renders in the browser, loads React
  from a third-party CDN at run time, uploads in three steps that can half-fail, and does so only for `plitzi.app`
  addresses — a custom domain on S3 or R2 gets its row updated and nothing uploaded.

This RFC keeps the pointer model and builds on it:

1. **Snapshot** — freeze the draft as `rN`. Unchanged.
2. **Publish** — tell a target which revision it serves. Always a pointer move, always recorded, always reversible.
3. **Deploy** — build and ship what a target serves, for the targets that hold a copy of the site (GitHub Pages, S3 +
   CloudFront, Amplify, R2, FTP, a self-hosted server…). A publish that needs one **says so before it happens**.
4. **Roll back** — always one action away, on every target, to the release before. **Manual only**: nothing rolls back
   by itself.
5. **Stay current** — a target that holds a copy runs the versions it was built with (the SDK, `@plitzi/sdk-server`);
   when Plitzi releases newer ones, the target says it should be redeployed, and refuses a snapshot it can no longer
   run, with the fix (§5.2).

Each kind of deploy is a capability of the space's plan, gated, sold and locked as every other one is (§8).

```
dev.example.com   environment development   GitHub Pages     (static)
example.com       environment production    AWS Amplify      (static)
shop.example.com  environment production    Plitzi SSR       (CNAME → Plitzi)
acme.plitzi.app   the draft                 Plitzi SSR
```

## 2. What exists already

| Piece | Where | What it is today |
| --- | --- | --- |
| Make a snapshot | builder `models/PublishForm.tsx` → `SpacePublish` | Freezes the draft as the next revision of `development`, `staging` or `production` (the plan decides which), with a description. Feature flags are sent to the environment, kept apart from the snapshot. |
| Snapshot retention | `src/services/versions/pruneSnapshots.ts` | The plan keeps `keep` revisions; never one a domain serves, never an environment's latest. Nothing protects the revision a domain served *before*. |
| Publish a snapshot | builder `models/DeployForm/DeployForm.tsx` → `SpaceDeploy` | Sets a domain's `environment` and `revision` (and an access credential). Refused when the revision's own space tests fail (`testsRefusal`), when the plan lacks the environment or a custom domain. |
| The domain row | `space_deployment` (`prisma/schema.prisma`) | `domain`, `environment`, `revision` (NULL = the environment's latest), verification, HSTS / script policy / framing, `provider` (`ssr`, `s3`, `r2`) and `providerId` → a customer bucket. |
| Serving a domain | `src/services/ssr/spaceResolution.ts` | A verified `provider: 'ssr'` row is resolved by host to its space, environment and revision; `<permanentUrl>.plitzi.app` serves the draft. Caches dropped on publish (`spaces.invalidate.resolution`). |
| The static shell | `src/services/deployment/templates/index.hbs`, `SpaceDeployMutation` | `index.html` with the space's fonts, its environment, revision and web key baked in; React from esm.sh; the SDK files beside it. Uploaded only when the domain contains `plitzi.app`; CloudFront invalidated on Plitzi's own distribution. |
| Customer storage | `space_cdn`, `space_cdn_bucket`, `space_credential` | A space's own S3/R2 accounts and buckets, with their credentials encrypted. |
| A space's runtime | `src/services/runtimes` | One process per **environment**, at that environment's current revision — not per domain. |
| The publish gate | space tests (`spaceTestsOf`) | A revision whose own tests fail is never published. |

## 3. The flow

1. **Snapshot.** The person finishes their changes and makes a snapshot: the draft frozen as `production r12`, with what
   it holds (pages, actions, functions, plugins) and a description. Nothing a visitor sees changes.
2. **Publish.** The person tells a target which revision it serves — `example.com → production r12`. For a target Plitzi
   serves, that is the whole publish: the pointer moves and the next request renders r12.
3. **Deploy, when the target needs one.** A target that holds a copy of the site (§5) may need that copy rebuilt for r12 —
   a new font, a newer SDK, every page's HTML for a prerendered site. The publish panel says so *before* the person
   confirms ("example.com needs a deploy: the fonts changed and the SDK is newer"), and offers **Publish and deploy**;
   a target that needs nothing says nothing.
4. **Deploy to many places.** A space has as many targets as it needs, each its own domain, environment, mode and
   provider. Publishing r12 to staging's target does not touch production's.
5. **Roll back.** Every target shows the release before the live one, and pressing it publishes that revision again —
   with its deploy, if the target needs one, from the artifact kept for it (§7).

## 4. Concepts

- **Snapshot** — `environment rN`, immutable. As today.
- **Target** — where a space is reachable and how: a domain, the environment it follows, a **mode** (§5), a
  **provider** (§6) with its credential, and its settings (HSTS, script policy, access credential). Today's
  `space_deployment` row, widened.
- **Release** — a pointer move on a target: `example.com` from `production r11` to `production r12`, by whom, when, why
  (`publish` or `rollback`). Append-only; the target's current release is its live revision.
- **Deploy** — a build of a revision for a target and its upload: status (queued, building, uploading, live, failed),
  log, size, duration, the **fingerprint** of what it baked in (§5.1), and the artifact kept for a rollback.

A release always exists; a deploy exists only when the target holds a copy.

## 5. Modes: how a target serves the space

| Mode | What is on the host | Publish needs a deploy when | Server features (actions, functions, sign-in, realtime) |
| --- | --- | --- | --- |
| **Plitzi SSR** | Nothing: `*.plitzi.app`, or a CNAME to Plitzi's page servers resolved by host (today's `ssr`) | Never | Plitzi's, as today |
| **SPA** | A shell (`index.html` + the SDK); the browser renders | The shell's fingerprint changed (§5.1) — not on content alone | Plitzi's API, cross-origin (the space token's origins name the host) |
| **Static** | Every page prerendered as HTML at build time, hydrated in the browser | Always: the pages are the content | Plitzi's API, cross-origin, as SPA |
| **Self-hosted SSR** | A server of the customer's running `@plitzi/sdk-server` (`plitzi build --ssr`: a Node bundle or an image) | *Connected*: when the bundle's fingerprint changed. *Baked*: always | *Connected*: the customer's server asks Plitzi for the space and runs its server code. *Baked*: the server's own |

### 5.1 The fingerprint: "does this publish need a deploy?"

Each mode that holds a copy computes a **fingerprint** of what its artifact bakes in, for a revision, without building
it. The publish panel compares the revision's fingerprint with the target's last deploy and lists what differs:

| Baked in | SPA | Static | Self-hosted, connected |
| --- | --- | --- | --- |
| The SDK and React versions the build uses | ✓ | ✓ | ✓ |
| The `@plitzi/sdk-server` version (§5.2) | — | — | ✓ |
| The space's fonts and head (favicon, meta, analytics tag) | ✓ | ✓ | — |
| Its plugins' bundles (content-addressed digests) | ✓ | ✓ | ✓ |
| Its routes (pages added, removed, re-slugged) | — | ✓ | — |
| Its content (any element, style, data) | — | ✓ | — |
| The space's runtime bundle | — | — | ✓ |

The SPA shell stops baking the revision: it asks Plitzi which revision its host serves (one cached request beside the
space document it already loads), so publishing to an SPA target is a pointer move like Plitzi SSR's, and a deploy is
needed only when the shell itself changed. A static target cannot avoid one.

### 5.2 When Plitzi moves on: versions

A target that holds a copy runs the versions it was built with — the SDK and React in an SPA or a static site, and
`@plitzi/sdk-server` itself in a self-hosted server. Plitzi keeps releasing; such a target stays where it was until it is
redeployed, and it must say so rather than drift silently.

- **Each deploy records its versions** (`space_deploy.versions`: SDK, React, `@plitzi/sdk-server`, the document schema
  it reads). A self-hosted server built by the CLI records them in its bundle, and a *connected* one reports them to
  Plitzi when it asks for the space (a header beside its space token), so Plitzi knows what each target really runs —
  also one redeployed by hand.
- **Plitzi publishes what it supports**: the newest versions, and the oldest `@plitzi/sdk-server` and document schema
  its API still answers (a support window, announced with each release as `docs/upgrading.md` does for the platform).
- **Three states, on the target's card, in the publish panel, in `plitzi releases` and to the space's owners:**

  | State | When | What it says | Publishing |
  | --- | --- | --- | --- |
  | Up to date | The target runs the newest versions | Nothing | As usual |
  | Update available | A newer SDK or `@plitzi/sdk-server` exists, the target's still supported | "sdk-server 2.4 is out (this target runs 2.1): redeploy to update — what changes", with the release notes | As usual; **Redeploy** offered beside it |
  | Redeploy required | The snapshot being published needs a newer version than the target runs (a document schema, an element, an SDK feature), or the target's version leaves the support window | "r12 needs sdk-server ≥ 2.3; this target runs 2.1: redeploy first", and the date a version leaves support well before it does | Refused for that target with the fix — **Redeploy and publish** (Plitzi builds it) or the CLI command (the customer builds it) |

- **Never an upgrade by surprise.** Plitzi does not redeploy a target because a version came out: the person presses
  Redeploy, as they press Roll back. A redeploy is a deploy like any other — recorded, logged, and rolled back from if
  the new version misbehaves (the artifact before it is kept, §7).
- **Plitzi SSR targets need none of this**: they run Plitzi's own page servers, updated with the platform.

### 5.3 Server features off Plitzi

A static or SPA site still runs the space's actions, functions, sign-in and realtime **on Plitzi**, cross-origin: the
host joins the space token's origins when the target is created, and the pre-publish checks list what the site uses
that way ("this site signs visitors in and calls 2 actions: they run on Plitzi"). A feature that cannot work
cross-origin is named as a refusal with its fix, never left to fail at the visitor.

## 6. Providers

| Provider | Modes | Credential | Atomic switch | Rollback without rebuild |
| --- | --- | --- | --- | --- |
| Plitzi (`*.plitzi.app`, CNAME) | Plitzi SSR | — (domain verification, as today) | ✓ pointer | ✓ pointer |
| GitHub Pages | SPA, Static | A GitHub App installation (preferred) or a fine-grained token; repo + branch | ✓ one commit | ✓ the kept artifact as a new commit |
| AWS S3 + CloudFront | SPA, Static | Access key or role; bucket; distribution | ✓ a versioned prefix, then the distribution's origin path | ✓ point back at the previous prefix |
| AWS Amplify (hosting) | SPA, Static | Access key or role; app + branch | ✓ Amplify's own deployment | ✓ redeploy the kept zip |
| Cloudflare R2 / Pages | SPA, Static | API token; bucket or Pages project | ✓ Pages deployments; R2 by prefix | ✓ |
| Netlify / Vercel (static) | SPA, Static | API token; site | ✓ their deploys | ✓ their own rollback |
| FTP / SFTP | SPA, Static | Host, user, password or key | ✗ said before the first deploy: files are replaced one by one | Re-upload the kept artifact |
| Download | SPA, Static, Self-hosted | — | — | — |
| A server of the customer's | Self-hosted SSR | — (the CLI builds it; Plitzi only issues its space token) | the customer's | the customer's |

Credentials are `space_credential` rows (encrypted), one kind per provider, created from the target's settings.

## 7. Rollback

- **Manual, always.** Nothing rolls back by itself: a person decides. Each target's card shows the live release and the
  one before it, with how long that one was live — "Roll back to r11 (live 3 days, until 2 h ago)" — and older releases
  in its history, each with the same action.
- **Instant on a pointer.** Plitzi SSR, SPA and self-hosted *connected*: a rollback is a release, and the caches drop as
  a publish's do.
- **Without rebuilding on a copy.** Static, and an SPA whose shell changed: the deploy of the previous release left its
  artifact; a rollback ships it again (or switches back to its prefix, §6). Each target keeps the artifacts of its
  live release and the one before at least (`keepArtifacts`, plan-sized).
- **Never pruned away.** `prunableSnapshots` protects, besides what is live, the revision of each target's previous
  release — the rollback offered is always there.
- **What it does not undo, said.** Feature flags are per environment, not per snapshot (as the snapshot modal already
  says); a space's data (`kv`, tables) is not versioned. The rollback confirmation names both.
- **Information, not automation.** After a publish the card shows what the target reports — page errors, failed runs —
  since the release, beside the rollback. It decides nothing.

## 8. Plans

What a space may deploy, and where, is its plan's — the same catalogue every other gate reads
(`src/services/entitlements/catalog.ts`, `SPACE_CAPABILITIES`): a refusal names the plan that includes it, the builder
locks what the plan lacks and says with which, and the pricing page lists it under going live. A space's plan is the
higher of its site plan and its workspace's, as for every capability (`entitlementsOfSpace`).

**Capabilities** (new rows of the catalogue, group `live`; the tiers are a proposal):

| Capability | What it opens | From |
| --- | --- | --- |
| — | Plitzi SSR on `<space>.plitzi.app` (the draft) | Free |
| `customDomain` (exists) | Plitzi SSR on a domain of its own, by CNAME | Site |
| `snapshots` (exists) | Snapshots, publish, the release history and rollback | Site |
| `deployDownload` | The site as a zip (SPA or static), to host anywhere by hand | Site |
| `deploySpa` | SPA targets on a provider (GitHub Pages, S3 + CloudFront, Amplify, R2, Netlify, Vercel, FTP) | App |
| `deployStatic` | Static (prerendered) targets on those providers | App |
| `deploySelfHosted` | Self-hosted SSR (`@plitzi/sdk-server`), connected or baked | Growth |
| `deployAutomation` | Deploy hooks, a publish scheduled for later, production protected (who may publish) | App+ |

**Limits** (plan figures, as page views and runs are):

| Limit | Meaning |
| --- | --- |
| `deployTargets` | Targets a space may have besides its `plitzi.app` address |
| `keptArtifacts` | Deploys kept per target for a rollback without rebuilding — never under 2 (the live one and the one before, §7) |
| `deployMinutes` | Build time a month, counted as server work is (`analytics/serverWork.ts`): a static prerender of a large site is real CPU |

**When a plan changes.** A downgrade never takes a site down: every target keeps serving what it serves, and its
rollback stays available (rolling back is never refused by plan). What the plan no longer includes is refused from then
on — creating such a target, deploying to it, publishing a revision that needs a deploy there — with the plan that
includes it, and the target's card says so. A target over `deployTargets` is kept, not deleted; a new one is refused.

## 9. Where the code lives

| Piece | Repo | Why there |
| --- | --- | --- |
| The builders — SPA shell, static prerender (the page server's render run over every route), SSR bundle — and their fingerprints | `@plitzi/sdk-server` | A self-hoster needs them without Plitzi; the CLI runs the same ones in a customer's CI |
| Generic uploaders: S3/CloudFront, R2, FTP/SFTP, a folder, a zip | `@plitzi/sdk-server` | Mechanism; credentials passed in |
| Targets, releases, deploys, the deploy jobs (the worker's queue), provider credentials, plan gates, `plitzi.app`, GitHub App / Amplify / Netlify / Vercel adapters | `plitzi-sdk-server` | Plitzi's data and accounts |
| Snapshot modal, publish panel, target settings, deploy log | builder | — |
| `plitzi snapshot`, `plitzi publish`, `plitzi rollback`, `plitzi releases`, `plitzi deploy`, `plitzi build --spa\|--static\|--ssr` | CLI | One API for every surface |
| `plitzi_publish`, `plitzi_rollback`, `plitzi_releases` | MCP | An agent publishes as a person does, held to the same gate |

## 10. Data

- **`space_deployment` → a target.** Adds `mode` (`ssr`, `spa`, `static`, `selfHosted`), widens `provider`, adds
  `config` (the provider's own: repo and branch, bucket and distribution, app id), `deployedRevision`,
  `deployedFingerprint` and `runningVersions` (what the target last reported or was last built with, §5.2). Today's
  rows map: `ssr` → Plitzi SSR; `s3`/`r2` → SPA on that provider.
- **`space_release`** (new): `targetId`, `environment`, `revision`, `previousRevision`, `kind` (`publish`, `rollback`),
  `deployId` (nullable), `by`, `at`. Append-only; the history and the rollback read it.
- **`space_deploy`** (new): `targetId`, `revision`, `fingerprint`, `versions` (SDK, React, `@plitzi/sdk-server`,
  document schema), `status`, `log` (bounded), `artifactKey`, `size`, `startedAt`, `finishedAt`, `by`. Artifacts in
  the space's private bucket by content hash.

No legacy shims: the SPA shell that bakes its revision is replaced, and every published static site is redeployed once
by the migration's release notes.

## 11. The builder

- **Make a snapshot** — kept, polished: what it freezes, the environment, a description; after it, "Publish r12 now".
- **Publish** — a panel, not a four-select modal: one card per target (domain, mode and provider, live release, who and
  when, needs-a-deploy badge, and its versions' state: up to date, update available, redeploy required — §5.2). Pick
  a snapshot from a list that says, for each, its description, author, date, its tests' result and what changes
  against the target's live revision ("3 pages changed, 1 new"). The checks (space
  tests, Space Issues, cross-origin features for SPA/static), then **Publish** or **Publish and deploy**, and **Roll
  back to rN** always beside them.
- **A deploy** — its live log and status in a drawer, reachable from the target's card and from the activity feed.
- **Targets** — in the space's settings, with the domains (they are the same rows): add a target, pick a mode and a
  provider, connect its credential, verify the domain.

## 12. CLI and MCP

```
plitzi snapshot --env production -m "Spring menu"
plitzi publish example.com r12            # --latest; deploys when the target needs it, after saying so (--yes in CI)
plitzi rollback example.com               # to the previous release; --to r9
plitzi releases example.com               # the history, each release's deploy, and the versions the target runs
plitzi deploy example.com                 # rebuild and ship the live revision (a new version, a provider changed, a failed deploy)
plitzi build --spa|--static|--ssr --out dist/   # the same builders, in the customer's own CI
```

## 13. Phases

| Phase | What | Why first |
| --- | --- | --- |
| **F0** | The current dialogs made right: colours, the disabled environment, the notice, button weight, copy; what is live now on the chosen domain | Small, independent, visible today |
| **F1** | `space_release`; the publish panel over Plitzi SSR targets; rollback (manual) with its pruning protection; `plitzi publish / rollback / releases`; the MCP tools | The pointer model already exists: history and rollback are most of the value at the least cost |
| **F2** | Targets and modes, gated by `deployDownload`, `deploySpa` and the `deployTargets` limit; `space_deploy` and the deploy job; the SPA shell that reads its revision; fingerprints and the "needs a deploy" warning; the versions each deploy records and the update-available state (§5.2); GitHub Pages, S3 + CloudFront, Amplify, download | The two examples of §1 |
| **F3** | Static prerender (`deployStatic`, `deployMinutes`); R2 / Cloudflare Pages, Netlify / Vercel; FTP / SFTP; kept artifacts for rollback | Builds on F2's pipeline |
| **F4** | Self-hosted SSR (`deploySelfHosted`; `plitzi build --ssr`, connected and baked) with its reported versions, the support window and redeploy-required refusals (§5.2); deploy hooks, a publish scheduled for later, production protected (`deployAutomation`) | The rest |

## 14. Open questions

1. **A space's runtime is per environment, not per revision.** Publishing an older revision to one target while the
   environment's runtime runs the latest serves that page with a newer runtime. Per-revision runtimes, or the publish
   panel refuses (or warns) when the revision's runtime bundle differs from the environment's?
2. **Static routes with parameters.** A prerender needs every value of `/menu/:dish`: from the space's data, a provider
   declared enumerable, or a list in the target's settings?
3. **The SPA's revision lookup** is one more request per page view: cached at the edge with the space document (and
   dropped on publish), or the host's revision handed to the shell by the provider (a `_redirects`/header rule)?
4. **Plans.** The tiers of §8 are a proposal: which plan each deploy capability starts at, and the figures of its
   limits.
5. **The support window.** How long Plitzi's API keeps answering an older `@plitzi/sdk-server` (a number of minor
   releases, or months), how far ahead a version's end is announced, and who is told (the space's owners, the
   workspace's admins).
6. **Preview addresses.** `r12--acme.plitzi.app` serving any snapshot before it is published — cheap with SSR; wanted
   in F1?

## 15. Not in this RFC

- Rolling back by itself on errors (decided against: rollbacks are manual).
- Versioning a space's data or its feature flags with its snapshots.
- Building a customer's own code beyond what a space already holds (its plugins and runtime bundle are built by the CLI
  as today).
