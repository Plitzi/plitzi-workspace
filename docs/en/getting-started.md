# Getting started

## Requirements

- **Node.js** ≥ 20
- **Yarn** 4 (the repo pins `yarn@4.2.2` via `packageManager` in the root `package.json`)

## Clone and install

```bash
git clone https://github.com/plitzi/plitzi-workspace.git
cd plitzi-workspace
yarn install
```

## Run locally

Start all apps in parallel (builder, SDK, server):

```bash
yarn start
```

Debug mode with higher Turbo concurrency:

```bash
yarn start:debug
```

To run a single app, go into its folder and use the same script:

```bash
cd apps/builder
yarn start
```

## Common workspace commands

```bash
yarn test          # run all tests
yarn lint          # ESLint across the monorepo
yarn typecheck     # TypeScript check
yarn build:dev     # development build
yarn build:prod    # production build
yarn storybook     # UI components (port 6006)
```

## Local environment

By default, `yarn start` uses the shared **development servers** (see [Local setup](./local-setup.md)). Custom hostnames and local HTTPS are only required for maintainers running the full stack on their machine.

## Published packages

| App / package | npm name |
|---------------|----------|
| SDK | `@plitzi/plitzi-sdk` |
| Builder | `@plitzi/plitzi-builder` |
| Server | `@plitzi/sdk-server` |

## Next steps

- [Repository structure](./repository-structure.md)
- [Development](./development.md)
- [Releases](./releases.md)
