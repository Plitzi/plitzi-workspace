# A space as a project: `plitzi create --from` and `plitzi pull`

`plitzi create --from <space>` writes a project that runs a space on Plitzi on a server of your own, with everything
the space is made of: its pages, styles, actions, functions and runtime, the source of its plugins, and its files.
The project depends on nothing of Plitzi's, neither its servers nor its CDN. `plitzi pull` then keeps it in step with
the space as the space goes on being edited.

It closes a circle. The CLI already puts a project's work on Plitzi (`upload plugin`, `functions push`, `runtime
push`); this is the way back, for a space that moves to its own server.

```bash
plitzi create my-board --from pizarra                 # the space as code, served self-hosted
plitzi create my-board --from pizarra --source cloud  # the pages stay on Plitzi; everything else runs here
cd my-board && plitzi pull                            # later: what changed on the space, brought in
```

Pizarra is the yardstick: a board works on `localhost` from a fresh `create`, is drawn on, and is kept across a reload.

## What a project from a space holds

| Part | Where it comes from | What lands in the project | How it runs |
|---|---|---|---|
| Pages, styles, variables, settings | **local:** the saved space, decompiled. **cloud:** read live with the space's host key | **local:** `src/space/`, authoring code, a file per page (`src/space.ts` re-exports it). **cloud:** nothing; the key goes in `.env` | `createJsonAdapters` over the authored space, or `createCloudAdapters` |
| Actions | the space's action documents | `src/actions/<id>.ts`, one `defineAction` call each, where it reads back exactly; `src/actions/<id>.json` where it does not | `action.lookups` in `src/actions.ts` |
| Connectors | the space's connector manifests | `src/connectors/<id>.json` | the same lookups |
| Functions | the stored source, unchanged | `functions/` | `loadFunctions`, in the project's process |
| Runtime | its source snapshot | `src/runtime.ts` and every file it imports | `serveRuntime`, in the project's process |
| Plugins | each plugin's source snapshot | `src/plugins/<Name>/` and the shared files they import | registered with `action: 'compile'`: built here, rendered on the server, one copy of React |
| Files | the space's public buckets | `public/`, every CDN address in the code rewritten to the project's own | served by the project (`publicDir`) |
| Variables, credentials | names only | `.env.example` names them; `.env` holds a signing key made for the project | the project's environment |

Everything else is the ordinary server project `plitzi create --mode server` writes, with a `main.ts` that wires the
runtime, the actions, the functions and the plugins in. Every file is the developer's to edit.

A project made from a space is always a server project: `--mode client` is refused with `--from`.

## Source on the platform

A plugin is uploaded built and a runtime is pushed packed, so taking a space out needs what they were built **from**.
The CLI keeps it beside them.

**What is kept: a source snapshot.** The project-relative files a build reaches from its entry — nothing under
`node_modules` — plus the packages (name and range) those files import. The closure is the point: Pizarra's plugin and
its runtime both import `board/model.ts`, and a snapshot of "the plugin folder" would lose it.

**How the closure is known.** Read with the project's own TypeScript (`ts.preProcessFile`), from the entries — the
CLI's `packSource` (`apps/cli/src/pack/source.ts`). A bundler's module graph would miss what the project needs to
compile: it drops `import type`. Stylesheets are followed through `@import` and `url()`, a bundler's query (`?raw`)
is read past, and an import only its types come from (`geojson`) names the package of its declarations
(`@types/geojson`).

**Format.** `@plitzi/sdk-shared/source`: one JSON document per snapshot, `{ kind, name, entries, files, dependencies }`,
each file's bytes in base64, gzipped as it travels and as it is kept. The format, the paths a snapshot may hold and the
credential check live there alone, read by the CLI that packs one and the platform that keeps one.

**Where.** In the space's private bucket, as server code of kind `source` (`server/sources/<sha256>.json.gz`), named
by its bytes. `space_source` records the latest one of each plugin and of the runtime.

**When.**

- `plitzi pack plugin` writes the snapshot beside the zip (`<name>.source.json.gz`), and `plitzi upload plugin` keeps it
  after the plugin is installed (`PUT /spaces/:id/sources`).
- `plitzi runtime push` packs and keeps it after the runtime is pushed.
- The seeder does both for every seed, through the same CLI, with `--source-root` set to the seed's folder.
- `plitzi pack source <entries…> --kind --name -o <file>` writes one to a file, to see what would be kept.

**Guards.**

- A path outside the project, in `node_modules` or `.git`, or of a credentials file (`.env*`, `*.pem`, `*.key`) is
  refused.
- A file holding a credential by its shape — a private key, an AWS, Stripe live, GitHub or Slack token — is refused and
  named. Shapes, not names, so `PASSWORD_MIN` is never refused.
- At most 2000 files, 4 MB a file, 24 MB in all, 16 MB gzipped.
- A refused source never undoes the upload or push it rides on: the CLI says why, and the space keeps that artifact
  built only.

## The export

`GET /spaces/:spaceId/export?source=local|cloud` (`plitzi-sdk-server`'s `services/export`) takes the space's id or
permanent URL. It is for a signed-in person who may **change** the space — its owner, an administrator or a writer;
reading it is not enough. It answers `SpaceExport` (`@plitzi/sdk-shared/source`, the one shape both ends read):

- the pages as split authoring code with `.ts` imports (`specToSource`'s `importExtension`, since Node runs the project
  by stripping types and imports a file by its name), or `null` for `source=cloud`;
- the action documents and connector manifests, as they are kept;
- the functions' files and the version of them;
- the merged source tree, the packages it needs, and where the runtime and each plugin start;
- what there is no source of, built (`builtOnly`);
- the files of the space's public buckets, by address and by where they go;
- the names of its variables and credentials — never a value — and of its visitor roles;
- a report: paths two snapshots held differently, packages asked for at different ranges, what the decompiler repaired.

Credentials the space's CDNs open their buckets with are left out: they are storage Plitzi uses, and a project serving
its own files has no use for them.

**Merging snapshots.** Files are keyed by project path. Two snapshots holding one path with different content are a
conflict: the newest wins, and the report names the path and both artifacts, so nothing is replaced in silence.

## Actions as code

`@plitzi/sdk-authoring`'s `actionSpecFromEntry` reads an action document back into the `defineAction` declaration
that writes it, and `actionToSource` writes that declaration out as a module. Only when the round trip is **exact**:
the declaration is authored again and compared with the document — every step, chain link and param, the field map a
trigger declares read as JSON (the builder spaces it out), the `output` derived on save left aside. A document that
would come back any different is not read at all, and stays JSON with the reason in the report: a builder can write a
flow code has no words for (a branch, a step titled by hand), and an approximation would be a different action.

Every seed's actions read back as code (`prisma/seeds/spaces/roundTrip.test.ts` in `plitzi-sdk-server`), so an action
written with `defineAction` always does.

## `create --from`

- It needs a signed-in CLI (`plitzi login`) and asks for the export before writing anything: a space that cannot be had
  leaves no half-made project.
- It writes the server project, the source tree under `src/` (unless it already was a project's `src/`), the pages,
  actions, connectors and functions, `main.ts`, and `package.json` with every package the source imports — the SDK and
  React at this CLI's versions, since plugins are rebuilt against the project's own.
- It downloads the space's files into `public/` and rewrites every CDN address in the code to the project's root.
- It writes `.env` with a signing key made for the project (`PLITZI_SIGNING_SECRET`: what `ctx.sign` signs with — the
  space's own key stays on Plitzi) and `.env.example` naming every variable and credential.
- It installs, formats with the project's Prettier (`public/` and `vendor/` are ignored: downloads stay as they came),
  and records what the project was given in `.plitzi/space.json`, and the functions as a working copy in
  `.plitzi/functions.json` — so `plitzi functions push` works from the project too.
- It prints a report of what came across differently, or not at all.

**What came across built only.** A plugin or runtime uploaded before Plitzi kept sources has none: the plugin's files
are downloaded into `vendor/plugins/<type>/` and registered as they were built (`action: 'copy'`, rendered on the
server too), the runtime into `vendor/runtime.bundle` (loaded with `loadRuntime`). Both run and cannot be changed; the
report says to upload them again from their source, and the next `pull` brings the code.

**A plugin's source must start at `src/plugins/<Name>/index.ts`.** That is where the project registers plugins from
(`<Name>` in camelCase is the type). One that starts elsewhere is named in the report.

**`--source cloud`.** The pages stay on Plitzi and keep being edited in the builder; the project reads them with the
space's host key (`plitzi create` asks for it, or `--key`), and everything else — actions, functions, runtime, plugins,
files — runs locally. A plugin the project registers is never looked for on the space's CDN.

## `plitzi pull`

`pull`, run in the project, asks the platform for the space again and compares every file the space gives with what
`.plitzi/space.json` says it gave last time and with what is on disk now — the space's copy formatted with the
project's Prettier first, as `create` left it:

| On the space | Here | What `pull` does |
|---|---|---|
| changed, or new | unchanged | writes it |
| unchanged | changed (or deleted) | keeps the change |
| changed | changed differently | **writes nothing at all** and names the files — `--force` takes the space's copy |
| no longer given | unchanged | removes it |
| no longer given | changed | keeps it, as the project's own |

A file of the space's CDN is fetched again only when the space names another address for it. `.env` is never touched;
`package.json` only gains the packages the space's code now asks for (a range the project changed is kept, and said).
The functions' working copy is refreshed with them, unless a change here to one of them stood.

## Decided

- **Who may take a space out.** Whoever may change it: owner, administrator, writer. Signed in, always.
- **Files.** Downloaded into the project and served by it: a self-hosted project is its own server and depends on
  nothing of Plitzi's, its CDN included.
- **SDK versions.** A plugin is rebuilt by the project against the project's own `@plitzi/*`: the snapshot carries the
  ranges its source was written against, and the report lists every one that differs from the project's.

## Left open

- **Visitors and sign-in.** A space with visitor roles signs its visitors in with their Plitzi account, and gives roles
  by email; who holds them stays on Plitzi. Self-hosted, nobody signs in until the server does it itself (`createAuth`
  from `@plitzi/sdk-server/auth`, over accounts it keeps, giving each person the permissions of their roles with
  `visitorAccess`). The project's `main.ts` carries a note saying so where `auth` would be handed over, and the report
  repeats it. Writing that sign-in for the project is a separate decision.

## Where it is tested

- `apps/cli`: `pack/source.test.ts` (the closure and guards), `scaffold/fromSpace.test.ts` (what a project holds),
  `commands/createFrom.test.ts` and `commands/pull.test.ts` (against the CLI's fake platform).
- `sdk-authoring`: `decompile/actions.test.ts` (actions as code, and the module they are written as).
- `e2e`: `tests/server/fromSpace` — a small platform of its own answers the export, the built CLI writes the project
  inside the workspace (so it runs on the workspace's packages, not npm's), and the project serves the page with its
  plugin rendered on the server, its runtime's route, and its action running its function.
- `plitzi-sdk-server`: `services/export` (merging), `services/api/export`, `services/sources`, and the seeds' actions
  read back as code.
