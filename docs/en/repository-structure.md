# Repository structure

Turborepo monorepo: frontend apps and shared SDK packages.

```
plitzi-workspace/
├── apps/
│   ├── builder/     # Visual builder (@plitzi/plitzi-builder)
│   ├── sdk/         # Plitzi SDK app (@plitzi/plitzi-sdk)
│   └── server/      # SSR / RSC / MCP server (@plitzi/sdk-server)
├── packages/
│   ├── sdk-auth/
│   ├── sdk-collections/
│   ├── sdk-data-source/
│   ├── sdk-dev-tools/
│   ├── sdk-elements/
│   ├── sdk-event-bridge/
│   ├── sdk-interactions/
│   ├── sdk-navigation/
│   ├── sdk-plugins/
│   ├── sdk-schema/
│   ├── sdk-shared/      # Shared ESLint, TSConfig, types, utilities
│   ├── sdk-state/
│   ├── sdk-store/     # React store (useSyncExternalStore)
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

## Packages

Packages under `packages/sdk-*` are workspace libraries imported by apps and by each other. They are versioned and published together via [Changesets](./releases.md).

## Documentation map

| Topic | Location |
|-------|----------|
| Monorepo guides | `docs/en/` or `docs/es/` |
| SSR server API | `apps/server/README.md` |
| Store API | `packages/sdk-store/README.md` |
| Code conventions | `claude.md` |
