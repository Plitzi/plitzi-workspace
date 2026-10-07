# Plitzi documentation (English)

Guides for working with the `plitzi-workspace` monorepo.

| Guide | Description |
|-------|-------------|
| [Onboarding](./onboarding.md) | **Start here.** The map: what exists, how the repositories fit together, and a stack running end to end |
| [Getting started](./getting-started.md) | Clone, install dependencies, and run apps |
| [Local setup](./local-setup.md) | Dev servers for contributors; optional local hosts/HTTPS for maintainers |
| [Repository structure](./repository-structure.md) | Apps and packages layout |
| [Development](./development.md) | Stack, commands, and contribution workflow |
| [Testing](./testing.md) | Vitest for units, Playwright for what a browser opens |
| [Releases](./releases.md) | Versioning and publishing with Changesets |
| [Components](./components.md) | Reusable subtrees: where they live in the schema, how an instance renders, the operations every writer shares, and what is left open |
| [Authoring spaces](./authoring-spaces.md) | Writing a space — or a publishable template — as TypeScript instead of exported JSON: elements, style, bindings and flows |
| [Tools for building with an agent](./agent-tooling.md) | The project's loop — author, check, fix, look, import — what each tool answers, and why each is shaped the way it is |
| [Connectors](./connectors.md) | Reading from (and writing to) a CMS or any REST API: the manifest, the provider element, paging and SSR preloading |
| [Server actions](./server-actions.md) | Work a page cannot do in the browser: authoring flows the server runs, and calling them from a page |
| [Functions](./functions.md) | A space's own server code: TypeScript tasks and `/fn/` routes the platform runs in a sandbox, written in the builder, a project or by an agent |
| [A space as a project](./projects-from-spaces.md) | Taking a space on Plitzi out as a self-hosted project of its own (`plitzi create --from`), keeping it in step (`plitzi space pull`), and putting it back (`plitzi space push`) |
| [Space runtimes](./runtimes.md) | A space's own server code as a process of its own beside the platform: Node and its packages, open connections, endpoints that stream |
| [Feature flags](./feature-flags.md) | Switching parts of a space on or off: the model, who decides each flag (space, server, SDK, tester), gating elements and pages, server actions, and publishing flags alone |
| [Realtime channels](./realtime.md) | Pages that see each other: declaring channels, the `channel` element and `useChannel`, publishing from a server action, and the pub/sub adapter a deployment picks |
| [Accessibility and browser agents](./accessibility.md) | Pages screen readers and browser agents (Claude in Chrome) can use: what the elements do, what an author says, the linter's rules, canvases, and checking a page |
| [AI agents (MCP)](./mcp.md) | Connecting Claude or any MCP client to a space: what an agent can do, how it works a space, and what the server guarantees |
| [Change history](./history.md) | Every save of a space's schema and style — who, from where, what exactly — read in the builder's timeline or over MCP |
| [Fonts](./fonts.md) | What a space loads type from: the manifest, the four sources, hosting faces yourself, and what a deployment configures |
| [Motion](./motion.md) | Good practices for animation: what moves cheaply, what stutters while a page loads, and how to keep decoration out of the way |

## Package documentation

Some packages maintain their own README next to the source:

| Package | Path |
|---------|------|
| SSR server | [apps/server/README.md](../../apps/server/README.md) |
| Store (Nexus) | Its own repository: [Plitzi/nexus](https://github.com/Plitzi/nexus) |

## Other languages

- [Documentación en español](../es/README.md)

## Related files (repository root)

| English | Español |
|---------|---------|
| [README.md](../../README.md) | [README.es.md](../../README.es.md) |
| [claude.md](../../claude.md) | — |
| [CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md) | — |
| [CONTRIBUTOR_TOS.md](../../CONTRIBUTOR_TOS.md) | [CONTRIBUTOR_TOS.es.md](../../CONTRIBUTOR_TOS.es.md) |
| [COMMERCIAL_LICENSE.md](../../COMMERCIAL_LICENSE.md) | [COMMERCIAL_LICENSE.es.md](../../COMMERCIAL_LICENSE.es.md) |
