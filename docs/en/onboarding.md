# Onboarding

Your first day. This guide is the map: what exists, why it is split the way it is, and how to get a stack
running end to end. Once it makes sense, the other guides fill in the detail.

## What Plitzi is, concretely

A **space** is the unit of everything. It is a tree of elements (its *schema*), a set of styles, and the data
bindings between them — versioned, owned by a user, and shared with collaborators.

Four surfaces act on that same space, and every repository here exists to serve one of them:

| Surface | What it does |
|---|---|
| **Builder** | A person edits the space visually |
| **SDK** | The space renders in a browser |
| **SSR** | The space is served publicly, rendered on the server |
| **MCP** | An AI agent reads and edits the space |

The rest is plumbing. When you are lost in a call stack, ask which of the four you are in.

## The map

Plitzi is **not one repository**. The monorepo you are reading is the frontend and the page/AI servers; the
backend — the database, the API, and every credential — is a separate repo. This is the single most common
source of "where does this code live?".

Clone them as **siblings in one directory** (see [Portals](#portals-and-the-sibling-layout) below — the links
between them are absolute paths).

| Repository | Owns | You touch it when |
|---|---|---|
| **plitzi-workspace** (this one) | Builder, SDK, SSR/RSC server, MCP server, and the `sdk-*` packages | Editing, rendering, elements, styles, interactions |
| **plitzi-sdk-server** | REST API, GraphQL, the auth kernel and RBAC, Prisma/MySQL, MongoDB, Redis, and the local dev gateway | Persistence, permissions, tokens, anything returning 401/403 |
| **plitzi-ui** | The design system the builder is built from | Shared UI components |
| **nexus** | The state store (`@plitzi/nexus`), its own repository | Store internals, reactivity, performance |
| **plitzi-cli** | Command-line tooling | Scaffolding and local workflows |
| **plitzi-plugin-template** | Starting point for a third-party plugin | Writing or debugging a plugin |
| **plitzi-platform** | Cluster (k3s + ArgoCD) and Terraform | Deploying, cluster config, secrets |

## Inside the monorepo

```
apps/
  builder/   @plitzi/plitzi-builder   the visual editor
  sdk/       @plitzi/plitzi-sdk       the runtime that renders a space
  server/    @plitzi/sdk-server       page server: SSR, RSC, plugins, connectors
  mcp/       @plitzi/sdk-mcp          the AI surface, built on top of apps/server
packages/
  sdk-*                               shared libraries, consumed by the apps and by each other
```

`apps/mcp` builds on `apps/server`: a deployment that only renders pages never installs it. That separation is
deliberate — keep it when adding code.

The packages are easier to hold in mind grouped by what they are *for* than alphabetically:

| Group | Packages | Concern |
|---|---|---|
| The space itself | `sdk-schema`, `sdk-style`, `sdk-elements` | What a space *is*: its tree, its styles, its components |
| Behaviour at runtime | `sdk-interactions`, `sdk-variables`, `sdk-navigation`, `sdk-auth` | What a rendered space *does* |
| Plumbing | `sdk-shared`, `sdk-plugins`, `sdk-event-bridge`, `sdk-dev-tools` | Types and utilities, the plugin system, cross-frame messaging, debugging |

## Day one

### Path A — contributor

If you are working on UI, elements, or SDK packages, you do **not** need a local backend. The apps point at
shared development servers in dev mode. Follow [Getting started](./getting-started.md) and
[Local setup](./local-setup.md), and stop there.

### Path B — full local stack

Needed to work on persistence, auth, the API, or anything that must survive a reload. Start with the backend,
because it owns the databases and mints the credentials the frontend needs.

**1. Backend** — in [plitzi-sdk-server](https://github.com/plitzi/plitzi-sdk-server), follow its README: mkcert
certificates, `/etc/hosts` entries, `yarn db:up`, then schema and seed data. Then:

```bash
sudo yarn start          # gateway on :443, routing every role by sub-domain
```

| URL | Role |
|---|---|
| `https://server.plitzi.local` | GraphQL, subscriptions, realtime WS — what the builder talks to |
| `https://api.plitzi.local` | REST API |
| `https://mcp.plitzi.local` | MCP and AI |
| `https://ssr.plitzi.local` | SSR |

Binding `:443` needs privileges; `GATEWAY_PORT=8443 yarn start` avoids `sudo` at the cost of a port in every URL.

**2. Credentials** — still in `plitzi-sdk-server`:

```bash
yarn token                     # lists the spaces, with the owner of each
yarn token 1 --user admin      # prints both credentials for space 1
```

Paste the two values into `apps/builder/index.html` (`webKey` and `userKey`). See
[The two credentials](#the-two-credentials).

**3. Frontend** — back in this repository:

```bash
yarn install
yarn start                     # Turborepo starts every app in parallel
```

| URL | App |
|---|---|
| `https://app.plitzi.local:3000` | Builder |
| `https://app.plitzi.local:3001` | SDK |

## The two credentials

The builder needs two, and they answer different questions:

- **`webKey`** is a *space token*. It names the space, and it is bound to the domains it declares. A public
  render token is read-only by construction — it is embedded in published sites, so it can be no stronger.
- **`userKey`** is a *session*. It is the **actor**, and every write goes through
  `can(actor, space, permission)`. With only a `webKey`, the builder loads and can save nothing.

Three things trip people up on day one:

1. **The `--user` must be a member of the space.** Otherwise the session authenticates and every write is then
   refused — which reads as a broken token rather than as the wrong account. `yarn token` prints the owner of
   each space next to it; pair them.
2. **Seed first, mint second.** Seeding rewrites the `space_token` rows with production domains only, so a
   token minted before a seed stops working from `localhost`.
3. **A token minted in one environment is refused in another.** Each deployment signs under its own issuer.
   That is the design, not a bug — see the auth documentation.

The full model — the five credential kinds, RBAC, domain binding, iframes, environments, and self-hosting —
lives in [RFC 0010](../rfc/0010-unified-auth-and-rbac.md), and as a diagram-first read in
`docs/auth/ecosystem.html` of the server repository (open it in a browser; it is self-contained).

## Portals and the sibling layout

Inside this monorepo, packages resolve through Yarn `workspace:*`: edit a package and the apps see it
immediately.

**Across repositories it is different.** `plitzi-sdk-server` consumes every `sdk-*` package, both server apps,
the SDK, the builder and `plitzi-ui` through Yarn **portals** — direct links to the folders on disk, so there is
no publish step while developing. Two consequences:

- The portal paths are **absolute**. Keep every repository as a sibling in one parent directory, or edit the
  `resolutions` block in `plitzi-sdk-server/package.json` to match your layout.
- A portal links the package's **build output**, not its source. After changing a package that
  `plitzi-sdk-server` consumes, run `yarn build:dev` (in the monorepo) or the server will keep running the old
  code — a confusing few minutes the first time it happens.

## Conventions

Code and comments are written in **English**; team discussion may be in Spanish. Documentation defaults to
English, and RFCs are always English.

The rules that matter — formatting, imports, TypeScript strictness, component layout — are in
[claude.md](../../claude.md) at the repository root, summarised in [Development](./development.md). Each
repository carries its own `CLAUDE.md`; read it before your first commit there, because the conventions are not
identical (the server has its own spacing and typing rules).

Before opening a PR: `yarn typecheck`, `yarn lint`, and tests for changed behaviour.

## What to read next

| When you want | Read |
|---|---|
| To run something | [Getting started](./getting-started.md) · [Local setup](./local-setup.md) |
| The layout in detail | [Repository structure](./repository-structure.md) |
| Commands and style | [Development](./development.md) |
| Why the architecture is the way it is | [RFCs](../rfc/README.md) — those marked *Implemented* describe the system as it is today |
| To publish a change | [Releases](./releases.md) |
| The page server's API | [apps/server/README.md](../../apps/server/README.md) |
| The AI surface | [apps/mcp/README.md](../../apps/mcp/README.md) |

Start with the implemented RFCs. [0008](../rfc/0008-data-providers-and-collections-removal.md) explains how data
reaches a space, [0009](../rfc/0009-cms-presentation-elements.md) how it is presented, and
[0010](../rfc/0010-unified-auth-and-rbac.md) who is allowed to do any of it. Between them they cover most of
what a new developer would otherwise learn by surprise.
