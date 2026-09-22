# Development

## Stack

| Area | Technology |
|------|------------|
| Language | TypeScript + React 19 |
| Build | Vite (per app/package), Turborepo |
| Tests | Vitest + Testing Library |
| Styles | Tailwind CSS v4 |
| Package manager | Yarn 4 workspaces |
| UI docs | Storybook |

## Workspace commands

```bash
yarn start                  # all apps in parallel
yarn build:dev              # dev build
yarn build:prod             # prod build
yarn test                   # all tests
yarn lint                   # ESLint
yarn typecheck              # tsc --noEmit (all packages)
```

## Per-package commands

From `apps/<app>` or `packages/<package>`:

```bash
yarn start
yarn test
yarn test:coverage
yarn lint
yarn typecheck
yarn build:dev
yarn build:prod
```

## After changing a package

Apps, examples and the e2e suite consume the workspace packages as **built output** (`dist/`), so a change in
`src/` is invisible to them until its package — and every package that bundles it — is rebuilt:

```bash
yarn turbo build:dev --filter=...@plitzi/sdk-elements   # the package AND everything that depends on it
```

The dots go **before** the name. `--filter=@plitzi/sdk-elements...` is the opposite — the package and what IT
depends on — and it quietly leaves the dependents stale, which is exactly the half that needed the change.

Two places a change has to reach that are easy to miss:

- **The browser runs `apps/sdk`'s bundle.** A server-rendered page loads `/sdk-assets/plitzi-sdk.js`, which is
  `@plitzi/plitzi-sdk`'s `dist`. An element change reaches a page only once that is rebuilt (the filter above
  includes it). `build-vendor:*` is the third-party half — React and friends — and never carries workspace code.
- **An element's props are listed in `@plitzi/sdk-authoring`.** Adding or renaming one makes
  `attributeNames.test.ts` fail until the list is regenerated:
  `yarn workspace @plitzi/sdk-authoring generate:attribute-names`.

## Before opening a PR

1. Run `yarn typecheck` and fix TypeScript errors.
2. Run `yarn lint` and fix ESLint errors (warnings are acceptable where already present).
3. Add or update tests when behaviour changes.
4. Update documentation if setup, APIs, or workflows change.

## Code style (summary)

Full rules live in [claude.md](../../claude.md) at the repository root. Highlights:

- **Prettier**: 120 columns, 2 spaces, semicolons, single quotes, no trailing commas.
- **ESLint**: strict TypeScript, `prefer-const`, `curly`, ordered imports with blank lines between groups.
- **TypeScript**: `strict`, unused locals/parameters forbidden, `import type` for type-only imports.
- **React**: named `useCallback` handlers in JSX (no inline arrows in props); Tailwind for styles; `clsx` for conditional classes.
- **Components**: one folder per component (PascalCase), `index.ts` barrel, co-located tests and stories.

Code identifiers and comments are in **English**; team discussion may be in Spanish.

Yarn workspaces resolve `workspace:*` dependencies automatically in dev mode — no manual package linking is required.

## Contributing

- Read [CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md) and [CONTRIBUTOR_TOS.md](../../CONTRIBUTOR_TOS.md).
- Open an issue for significant changes when possible.
- Target the `main` branch; contributions are under AGPL-3.0.
- Security: see the repository [security policy](https://github.com/plitzi/plitzi-workspace/security/policy) and `apps/builder/SECURITY.md` / `apps/sdk/SECURITY.md`.

## See also

- [Getting started](./getting-started.md)
- [Local setup](./local-setup.md)
- [Releases](./releases.md)
