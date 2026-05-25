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

## Linking packages locally

To link the SDK into the builder during development (Yarn workspaces):

```bash
# From apps/builder — prefer workspace:* in package.json when possible
yarn link ../sdk -r
# To unlink
yarn unlink ../sdk
```

Within the monorepo, dependencies already use `workspace:*`; linking is mainly for testing against an external checkout.

## Contributing

- Read [CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md) and [CONTRIBUTOR_TOS.md](../../CONTRIBUTOR_TOS.md).
- Open an issue for significant changes when possible.
- Target the `main` branch; contributions are under AGPL-3.0.
- Security: see the repository [security policy](https://github.com/plitzi/plitzi-workspace/security/policy) and `apps/builder/SECURITY.md` / `apps/sdk/SECURITY.md`.

## See also

- [Getting started](./getting-started.md)
- [Local setup](./local-setup.md)
- [Releases](./releases.md)
