# Repository structure

Turborepo monorepo: frontend apps and shared SDK packages.

```
plitzi-workspace/
├── apps/
│   ├── builder/     # Visual builder (@plitzi/plitzi-builder)
│   ├── sdk/         # Plitzi SDK app (@plitzi/plitzi-sdk)
│   ├── server/      # Page server: SSR / RSC (@plitzi/sdk-server)
│   └── mcp/         # AI surface: MCP server (@plitzi/sdk-mcp)
├── packages/
│   ├── sdk-auth/
│   ├── sdk-dev-tools/
│   ├── sdk-elements/
│   ├── sdk-event-bridge/
│   ├── sdk-interactions/
│   ├── sdk-navigation/
│   ├── sdk-plugins/
│   ├── sdk-schema/
│   ├── sdk-shared/      # Shared ESLint, TSConfig, types, utilities
│   ├── sdk-style/
│   └── sdk-variables/
├── docs/
│   ├── en/            # English documentation
│   └── es/            # Spanish documentation
├── claude.md
├── CODE_OF_CONDUCT.md
├── CONTRIBUTOR_TOS.md / CONTRIBUTOR_TOS.es.md
├── COMMERCIAL_LICENSE.md / COMMERCIAL_LICENSE.es.md
├── LICENSE            # AGPL-3.0 (legal text, English)
└── package.json       # Workspace scripts (Turbo + Yarn)
```

## Apps

| Path | Role |
|------|------|
| `apps/builder` | Main UI to design and edit Plitzi spaces |
| `apps/sdk` | SDK bundle consumed by spaces and the SSR server |
| `apps/server` | HTTP server for SSR, RSC, plugins, and static assets |
| `apps/mcp` | MCP server and AI tooling, built on `apps/server` — a page-only deployment never installs it |

## Packages

Packages under `packages/sdk-*` are workspace libraries imported by apps and by each other. They are versioned and published together via [Changesets](./releases.md).

## Documentation map

| Topic | Location |
|-------|----------|
| Monorepo guides | `docs/en/` or `docs/es/` — new here? [Onboarding](./onboarding.md) |
| Design decisions | `docs/rfc/` |
| SSR server API | `apps/server/README.md` |
| MCP / AI surface | `apps/mcp/README.md` |
| Backend: API, auth, database | [Plitzi/plitzi-sdk-server](https://github.com/plitzi/plitzi-sdk-server) (separate repository) |
| Store API (Nexus) | [Plitzi/nexus](https://github.com/Plitzi/nexus) (separate repository) |
| Code conventions | `claude.md` |
