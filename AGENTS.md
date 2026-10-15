<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

# plitzi-workspace

Turborepo monorepo with every Plitzi frontend app, the self-hostable server and the shared packages. This file is
for any agent (Claude Code, OpenCode, Codex…) working here; `claude.md` only imports it. Human guides:
[docs/en/](./docs/en/README.md) · [docs/es/](./docs/es/README.md).

## What Plitzi is

A visual platform for building web apps ("spaces"): a person edits a space in the **builder**, an agent edits it
through the **MCP** or as code with **sdk-authoring** + the **CLI**, and the **SDK** renders it — in the browser, or
server-side by **sdk-server**, which anyone can self-host. A space is a JSON document (`schema.flat`, `components`,
style, variables, interactions/flows, data bindings) plus optional plugins, server actions, functions and a runtime.

Five repositories, one product (all under `/Users/Carlos/htdocs/`):

| Repo | What it is | Relation |
| --- | --- | --- |
| `plitzi-workspace` (here) | Builder, SDK, sdk-server, MCP, CLI, desktop, the `@plitzi/sdk-*` packages | Publishes every `@plitzi/*` package at one version |
| `plitzi-sdk-server` | Plitzi's own deployment: MySQL/Mongo/Redis, accounts, workspaces, billing, seeds, the website | **Consumes** `@plitzi/sdk-server` and the rest from npm (or portals) |
| `nexus` | `@plitzi/nexus`, the state store the SDK and builder run on | Consumed from npm (or a portal) |
| `plitzi-ui` | `@plitzi/plitzi-ui`, the React component library + design tokens of the builder/dashboard | Consumed from npm (or a portal) |
| `plitzi-platform` | k3s + Argo CD GitOps cluster (dev on a Raspberry Pi), screenshot service, old Terraform | Deploys `plitzi-sdk-server`'s image |

**The line between the two servers:** `@plitzi/sdk-server` (`apps/server`) is the **mechanism** — what everybody runs,
self-hosters included; `plitzi-sdk-server` is **Plitzi's data and policy**. A self-hoster must get the full cycle
without reimplementing anything, so reusable logic goes up into `apps/server`, never into `plitzi-sdk-server`.

**AI features are for external agents over the MCP** (their own harness: Claude Code, OpenCode…), not an in-builder
chat (retired 2026-10-06). The agent-facing half of a feature goes in `apps/mcp` (tools, `plitzi://` resources, apply
ops); the person-facing half in the builder.

## How we work

The owner of these rules is this section; the other four repos restate them in a line each. Change them here and in
the four `AGENTS.md` in the same change. The person you work with is Carlos (the maintainer).

**Communication**

- Talk to Carlos in **Spanish**, always — including the summary after a long English-only tool run. Code, comments,
  docs, RFCs and commit messages are in **English**.
- Report what happened, not what you hoped: failing tests with their output, steps skipped, things not verified.
- Before changing an API/interface, confirm it. Do not modify anything beyond the target of the change.

**Quality**

- **Code quality and zero tech debt come first**, ahead of speed. No TODOs, hacks, half-done work or quick patches;
  if the right fix is bigger, do it or surface the trade-off before proceeding. Readable over clever.
- **Type-safe always**: no `any`, no `as` unless unavoidable (with a comment saying why).
- **One source of truth.** Every concern (code, contract, config, validation, catalogue, limit) has ONE home; the rest
  import it. No second copy, no parallel path that does the same thing.
- **No legacy shims.** There is no production yet: when a contract changes, change it everywhere (types, presets,
  tests, docs) and say which stored records must be redone. No normalisers, silent migrators or dual reads unless
  Carlos asks. Validating user input is not legacy and stays.
- **Nothing silent.** Errors, changes, no-ops, things not saved, things reached beyond what was asked: every write
  answers with what it actually did (read off before/after state), refuses what it cannot honour, and every message
  names the fix in the docs' terms. Agents (and small models) build on whatever they believe — a silent failure becomes
  a workaround. Write defensive code: validate at runtime against what the type declares.
- **Platform ≠ use case.** Do not change the platform just to make a seed or example work. Fix the seed first; touch
  the platform only when the bug is general (reproducible by a platform test without the seed), and then present the
  evidence to Carlos *before* changing it. When fixing a report, find the general rule that produced it and fix that —
  if it fits Plitzi's model.
- Defaults that cost differently per element (e.g. `loadStrategy`) are declared per type after auditing which need
  them; never flip a global default "to save resources".
- **Backend in UTC.** Every `Intl.DateTimeFormat`/`toLocale*` in server code passes `timeZone: 'UTC'` and says "UTC".
- **Light and dark from the first commit.** Every colour token is declared for both themes; never theme-aware text on
  a fixed background. Builder pairs: `border-gray-200 dark:border-zinc-700`, `text-gray-500 dark:text-zinc-400`
  (`grayviolet-*` has no dark variant). When fixing a panel, review all of its colour classes.
- UI is product: check desktop **and** 390 px (`scrollWidth` vs `innerWidth`), grid tracks `minmax(0, 1fr)`, every
  control in an example actually works, and design from the point of view of someone who only has a browser.

**Safety in a shared working tree** (Carlos and other sessions work in these repos at the same time)

- Never `git stash`, `git checkout -- <path>`, `git restore`, `git reset --hard` or `git clean` unless asked: they
  destroy uncommitted work that is not yours. To compare with the base, copy *your* file aside
  (`git show HEAD:<file>`) and restore from that copy. Before instrumenting a file, copy it to a scratch dir.
- Temporary scripts live outside the repo (scratch dir; import packages by absolute path). If something must be
  created in the repo, delete it in the same command and check `git status` at the end.
- **Confirm before deleting** anything not on the agreed list, even if it looks dead. A published package's export is
  never deleted just because no repo of ours imports it (barrels `export *`, `generate-exports.mjs` publishes every
  module). Grep a file's name as text, not only as an import — some code is referenced by path.
- Commit, push, publish or release only when asked. Carlos publishes the packages himself.
- Kill a server by port with `lsof -ti tcp:PORT -sTCP:LISTEN | xargs kill` — never without `-sTCP:LISTEN` (it kills
  every client of the port, other agents' sessions included).
- One Playwright invocation at a time per repo (a second one empties the shared `outputDir`; the ENOENT on trace
  artifacts that follows looks like a flake and is not).
- Do not spawn sub-agents / parallel agent workflows unless Carlos authorizes it (current instruction, 2026-10).

**Verifying**

- Verify with the repo's own scripts: `yarn typecheck` / `yarn lint` of the package (its `typecheck` is
  `tsc -p tsconfig.app.json`, which includes the tests — `tsc -p .` does not), or at the root
  `yarn typecheck --continue` so the first failure does not hide the rest.
- "Local green, CI red" on dev-only behaviour is almost always prod vs dev build: CI runs `yarn build:prod` +
  `build-vendor:dev` + `build-vendor:prod` and serves the SDK in production mode.
- After `yarn bench`, summarize and point at `bench/results/report.md`; do not copy numbers into docs or seeds.

**Process**

- RFCs (`docs/rfc/`) are always English. A shipped RFC is **deleted**: first move what stays true into a `docs/en`
  guide (and `docs/es` if translated) and the why of each rule next to the code; remove "RFC NNNN §x" citations.
- After finishing, add new durable learnings to this file when they apply to whoever works here next.

## Stack

- **Language**: TypeScript + React 19
- **Build**: Vite (per package/app), Turborepo for orchestration
- **Testing**: Vitest + `@testing-library/react`; Playwright for `e2e/`
- **Styling**: Tailwind CSS v4
- **Package manager**: Yarn 4 (workspaces)
- **Storybook**: for UI component development

## Commands

```bash
# Workspace-level (Turbo)
yarn start                  # start all apps in parallel
yarn build:dev              # dev build (refreshes every dist other repos may consume through portals)
yarn build:prod             # prod build
yarn build-vendor:dev / build-vendor:prod   # plitzi-sdk-vendor.js; without it every SSR page fails ("MIME type text/html")
yarn test                   # run all tests
yarn lint                   # lint all packages
yarn typecheck --continue   # typecheck all packages, reporting every failure
yarn e2e                    # Playwright (e2e/launch.ts starts the servers in parallel); CI=1 yarn e2e:ci for fresh servers
yarn bench                  # load + footprint benchmarks of the self-hosted servers

# Per-package (cd into app/package first)
yarn start                  # start that app
yarn test                   # vitest run
yarn test:coverage          # vitest + coverage
yarn lint                   # eslint ./src
yarn typecheck              # tsc -p tsconfig.app.json --noEmit (tests included)
yarn build:dev / build:prod # vite build (+ generate-exports.mjs)
```

## Project Structure

```
apps/
  builder/          # Plitzi visual builder (main app)
  sdk/              # Plitzi SDK app (@plitzi/plitzi-sdk): renders a space; plitzi-sdk.css loads on EVERY published page
  server/           # @plitzi/sdk-server: SSR/RSC, auth kernel, server actions, functions, realtime — the mechanism
  mcp/              # @plitzi/sdk-mcp: MCP server for AI agents (tools, plitzi:// resources, the guide)
  cli/              # @plitzi/cli: projects, plugins, push/pull, doctor/lint/check; owns the project scaffold + skills
  desktop/          # Desktop client (frozen with RFC 0017 until the web product has traction)
bench/              # Benchmarks of the self-hosted servers under hardware limits (`yarn bench`)
e2e/                # Playwright suites (builder, SDK, examples); lint/typecheck run from e2e/
examples/           # browser/ and self-hosting/ examples (each lints with examples/eslint.config.mjs)
docs/               # en/ (contributor guides), es/ (8 translated), rfc/ (only NOT-yet-implemented proposals)
packages/
  sdk-shared/       # Shared ESLint + TSConfig + Vite base configs, store hooks, schema/style helpers, sharedContext
  sdk-auth/
  sdk-authoring/    # The ONLY writer/validator of space documents in code: authorSpace, lintSpace, the skill
  sdk-dev-tools/
  sdk-elements/
  sdk-event-bridge/
  sdk-interactions/
  sdk-navigation/
  sdk-plugins/
  sdk-schema/
  sdk-style/        # Includes the builder's StyleInspector
  sdk-variables/
```

## Code Style

### Formatting (Prettier — `.prettierrc`)

- `printWidth`: 120
- `tabWidth`: 2, spaces (no tabs)
- `semi`: true
- `singleQuote`: true
- `trailingComma`: none
- `arrowParens`: avoid (omit parens for single-arg arrows: `x => x + 1`)
- Plugin: `prettier-plugin-tailwindcss`

### Linting (ESLint — `packages/sdk-shared/eslint.config.mjs` as base)

- TypeScript strict mode + `typescript-eslint` strict type-checked rules
- `prefer-const` enforced — never use `let` when value doesn't change
- `no-var` enforced
- `curly` enforced — always use braces for `if`/`else`/`for`/`while` bodies
- `quotes`: single
- `linebreak-style`: unix
- Type imports: always use `import type` when importing only types
- Import order enforced alphabetically: builtin → external → internal (`@plitzi/sdk-*`, `@pmodules/*`, `@pcomponents/*`) → parent/sibling → type
- Always a blank line between import groups (`newlines-between: always`)

### TypeScript (base: `packages/sdk-shared/tsconfig.app.json`)

- `strict: true`, `strictNullChecks: true`
- `noUnusedLocals: true`, `noUnusedParameters: true`
- `noFallthroughCasesInSwitch: true`
- Target: `ES2023`, module: `ESNext`, moduleResolution: `bundler`
- `isolatedModules: true`
- `emitDeclarationOnly: true` — Vite handles JS output
- `jsx: react-jsx`

## Spacing Conventions

These are enforced by convention, not lint rules:

**After an `if` block**: leave one blank line before the next statement when more code follows.

**Before `return`**: leave one blank line when there is any code above it in the same block.

**Around `useCallback`**: leave one blank line above and below every `useCallback` declaration when there is other code in the same block.

```ts
// Correct
if (condition) {
  doSomething();
}

const result = computeValue();

return result;

// Wrong — missing blank lines
if (condition) {
  doSomething();
}
const result = computeValue();
return result;
```

```tsx
// Correct
const [open, setOpen] = useState(false);

const handleToggle = useCallback(() => setOpen(o => !o), []);

const handleConfirm = useCallback(() => {
  doSomething();
}, [doSomething]);

return <div />;

// Wrong — missing blank lines around useCallback
const [open, setOpen] = useState(false);
const handleToggle = useCallback(() => setOpen(o => !o), []);
const handleConfirm = useCallback(() => {
  doSomething();
}, [doSomething]);
return <div />;
```

## General Rules

- No comments unless the WHY is non-obvious (hidden constraint, workaround, subtle invariant).
- Never explain WHAT the code does — identifiers do that.
- No unused variables, parameters, or imports (enforced by TS + ESLint).
- Prefer `const` over `let`; never use `var`.
- Arrow functions: omit parens for single parameter.
- No trailing commas.
- Semicolons required.
- Always use braces for control flow bodies.
- Use `import type` for type-only imports.
- Avoid `any` in public APIs — only in implementation bodies with `// eslint-disable-next-line`.
- **Code quality and avoiding tech debt are the top priority** — do not leave shortcuts, hacks, or half-finished implementations.
- **Code must be readable and easy to follow.** Prefer clarity over brevity; if a line takes effort to read, refactor it.
- **Type-safe always.** TypeScript strict mode is enabled — every value, parameter, return type, and generic must be properly typed. No `any`, no `as` casts unless there is no alternative (and even then, add a comment explaining why). Let the compiler catch errors, not runtime.

### File & Folder Structure

**A folder per component.** Every component lives in its own PascalCase folder. Sub-components go in a `components/`
subfolder, each following the same pattern (its own folder with `index.ts`):

```
WorkflowNode/
  WorkflowNode.tsx
  index.ts
  WorkflowNode.test.tsx
  WorkflowNode.stories.tsx
  components/
    NodeBody/
      NodeBody.tsx
      index.ts
    NodeHeader/
      NodeHeader.tsx
      index.ts
```

**PascalCase** for component and feature files and folders — never kebab-case or camelCase for these.

**`index.ts` is the barrel.** Every folder exposes one, at minimum:

```ts
import ComponentName from './ComponentName';

export * from './ComponentName';

export default ComponentName;
```

The first and third lines expose the named default (IDE autocomplete); the second re-exports the rest (types, named
exports).

**Exported props type** named `ComponentNameProps`:

```tsx
export type ButtonProps = {
  label: string;
  onClick: () => void;
};

const Button = ({ label, onClick }: ButtonProps) => { ... };
```

**Co-located tests and stories.** `Component.test.tsx` and `Component.stories.tsx` sit next to `Component.tsx`, never
in a separate `__tests__` folder.

### Component Rules

**Split large components.** When a render grows, break it into focused sub-components — the signal is distinct visual
or logical blocks that can be named and reasoned about independently, not a line count. Each goes in its own folder
under `components/`; the parent becomes a thin orchestrator.

**At most 2 levels of nesting.** A sub-component may have its own `components/` subfolder, but the components inside
that second level may not have another one.

```
// Correct — up to 2 levels (modules/Space in the builder)
Space/                                    ← root
  components/
    SpaceIssues/                          ← level 1
      SpaceIssues.tsx
      index.ts
      components/
        IssueGroup/                       ← level 2 ✓
          IssueGroup.tsx
          index.ts

// Wrong — 3 levels
Space/
  components/
    SpaceIssues/                          ← level 1
      components/
        IssueGroup/                       ← level 2
          components/
            IssueRow/                     ← level 3, NOT allowed
```

Exception: tiny sub-components (a few lines, self-contained, no logic) do not need their own folder unless reused.

**No inline arrow functions in JSX event handlers.** Every handler is a named `useCallback`. In a `.map()` where each
item captures its own value, extract the item into a sub-component that owns its `useCallback`:

```tsx
// Wrong — inline arrow, new reference every render
<button onClick={() => setOpen(o => !o)} />
{items.map(item => (
  <button key={item.id} onClick={() => onSelect(item.id)}>{item.label}</button>
))}

// Correct
const handleToggle = useCallback(() => setOpen(o => !o), []);
<button onClick={handleToggle} />

type SelectItemProps = { id: string; label: string; onSelect: (id: string) => void };
const SelectItem = ({ id, label, onSelect }: SelectItemProps) => {
  const handleClick = useCallback(() => onSelect(id), [id, onSelect]);

  return <button onClick={handleClick}>{label}</button>;
};
```

**No helpers inside component files.** Helpers, constants and utilities go in `helpers.ts` or a `helpers/` folder.
A component file holds the component and its props/types only.

**No ternaries for rendering complex JSX.** Multi-line or structurally different branches become explicit `&&`
conditionals; a one-liner primitive (`{open ? '▲' : '▼'}`) may stay a ternary.

```tsx
// Correct
{isLoading && <div className="spinner">...</div>}
{!isLoading && <div className="data">...</div>}

// Wrong
{isLoading ? (
  <div className="spinner">...</div>
) : (
  <div className="data">...</div>
)}
```

### Styling — Tailwind CSS

Tailwind classes for all styling. `style` only for a truly dynamic value (a computed pixel value, a runtime CSS
variable) — never as a shortcut.

Conditional classes with `clsx`, using the object syntax for the logic part
(`clsx('base', someVar && 'extra', { active: isActive })`); never string concatenation or ternaries in `className`.

**No Tailwind string constants** (`const iconBtn = 'w-6 h-6 …'`): inline the classes; if a set is genuinely shared,
extract a component.

### After-change Verification

After finishing any set of code changes, always run:
1. `yarn typecheck` — fix all TypeScript errors before considering the task done.
2. `yarn lint` — fix all ESLint errors (warnings are acceptable).
3. The tests of what you touched; for documentation, the checks in § Documentation.

## Platform rules that go wrong most

- **Packages build their own `exports`.** `scripts/generate-exports.mjs` runs only in `build:dev`/`build:prod` (not
  `build:dev-watch`): a new module is not importable by subpath (`TS2307`) until built. A subpath added to `exports`
  must also be in `files` (check with `npm pack --dry-run`) — 0.38.12 shipped broken that way.
- **A package imports only what it declares.** Portals hide undeclared dependencies (0.37.3 broke consumers without
  `@apollo/client`); nothing with an optional peer in a root barrel.
- **Runtime contexts use `sharedContext(name, default)`** (`@plitzi/sdk-shared/helpers/sharedContext`), never
  `createContext`: the builder bundles its own runtime while remote plugins import `@plitzi/plitzi-sdk` through the
  import map, and only a shared registry lets both see the same context.
- **Plugins must behave in the builder**: inert outside preview (`settings.previewMode`), and never the global
  `window`/`document` (plugin JS runs in the builder's realm, its DOM in the canvas iframe) — use the node's
  `ownerDocument.defaultView` or `utils.getWindow()`.
- **nexus `StoreProvider` without `inherit` is isolated**: one that overrides a key uses `inherit="live"`.
- **Every element has a `Settings.tsx`** registered in `sdk-elements/src/elements/settings.ts`, even an empty one.
- **sdk-authoring is defensive**: every field validated at runtime against its declaration, refusals say exactly what
  to write instead (did-you-mean), the skill's recipes author with zero warnings (`recipes.test.ts`). After
  tightening, author the `plitzi-sdk-server` seeds and the examples to separate false positives from real bugs.
- **One linter, four consumers**: a document rule goes in `packages/sdk-authoring/src/schema/lint/` and is seen by
  `authorSpace`, the MCP, the builder's Space Issues and the publish gate. One test per code (a meta-test enforces it).
- **Four checks, never confused**: `author` (the document), `lint` (how the source is written), `check` (a rendered
  page), `doctor` (the CLI project, never the space). Each report states its scope and names the others.
- **An MCP tool answers in one JSON reply** (`enableJsonResponse`, stateless): it cannot send progress, so a call that
  waits stays under what clients and gateways hold a request for (`ACTIVITY_WAIT_MAX_SECONDS`, 50 s), and a tool that
  reads none of the space declares `documents: false` so the host loads nothing for it.
- **The MCP shows the agent everything it can write.** A new capability goes into the op schema + guide even if the
  token budget test fails (raise it and say so; trim redundancy, never what is missing). `tests/guide.test.ts` fails
  when an op, resource or global source is missing from the guide.
- **StyleInspector** (`packages/sdk-style`) is where users spend their time: a redesign changes presentation, never the
  surface — inventory every control per category before, and walk the inventory after.
- The builder loads **Font Awesome 7** (FA6 names render empty); `Alert` from plitzi-ui is soft by default — use
  `size="xs" solid={false}`, never `text-white` on it.
- Design tokens of Plitzi's own UI live in plitzi-ui's `theme.css`, **never** in `apps/sdk/src/assets/tailwind.css`
  (it ships on every customer page).
- An editor that shows several documents takes `key={document}` (own undo history).

## Local packages from other repos (portals)

`@plitzi/plitzi-ui` and `@plitzi/nexus` come from npm. `resolutions` in the root `package.json` may point one at
`portal:../plitzi-ui` or `portal:../nexus` while an unpublished change is being tried — **check, never assume**. With a
portal: build the other repo (`yarn build:dev`), restart Vite with `--force` (optimizeDeps serves the old dist), and
keep `resolve.dedupe` for react (+ `@codemirror/*`, `@lezer/*` for plitzi-ui) or you get two Reacts. When Carlos
publishes, raise the ranges, remove the portal and `yarn install`. `plitzi-sdk-server` may portal packages of this
repo the same way: after changing a package it consumes, `yarn build:dev` (and `build-vendor:dev`) here.

## Releases

All public `@plitzi/*` packages release together at one version (`.changeset/config.json` `fixed`). Add notes to the
single pending `.changeset/release.md` under the right `## <area>` heading — never a new changeset file per change; if
it does not exist, create it with every public package in the front matter. Private workspaces (examples, e2e,
desktop) are never versioned. See `docs/en/releases.md`.

## Testing gotchas

- Tests that go through the outbound fetch guard mock DNS (`vi.mock('node:dns/promises', …)`); CI has slow/no DNS.
- Multi-worker (fleet) tests start every worker and wait until all listen (`startServing(n)`); loops that ask workers
  are bounded by time, never by a request count. Fix the helpers, not one test.
- A test listens on `await unusedPort()` (`@plitzi/sdk-server`): a free port BELOW the ephemeral range. Never a fixed
  number nor `listen(0)`'s — another worker's outgoing connection takes ports from that range, and the listen then
  fails `EADDRINUSE` (a server without `onListenError` ends the process).
- A sleep is safe only where lateness helps (TTL past expiry); where an upper bound must hold, wait on the event.
- Whole-app renders (desktop) take `{ timeout: 10_000 }`.
- `e2e/mock/graphql.ts` answers `true` to unknown operations: a new query the builder reads on boot needs a handler.
- `--repeat-each` on specs whose `beforeAll` runs a skip-mode action needs `--workers=1`.

## Documentation — one owner per fact

The same behaviour is described to several readers in several places, and every place grows. Two that disagree
cost more than one that is missing: an agent reads both, cannot tell which is right, and writes the wrong one. So
every fact has ONE owner that states it in full; every other place says it in a line, points to the owner, or is
generated from it.

| Surface | Reader | Owns | Where |
| --- | --- | --- | --- |
| The code | everyone | what is true: behaviour, defaults, names, messages | `AUTHORING_CODES` (`sdk-authoring/src/schema/codes.ts`), the `explain` catalogues, JSDoc, constants (`MOTION_*`, breakpoints) |
| Authoring skill | an agent writing a space in code | how to write a space | `packages/sdk-authoring/skills/plitzi-authoring/` — `SKILL.md` (rules), `CHEATSHEET.md`, `reference/*` (one subject each), `recipes/*` (whole tested files) |
| CLI skill | an agent using the CLI | what each command is for, when to use it | `apps/cli/skills/plitzi-cli/` |
| `AGENTS.md` of a generated project | an agent in a generated project | that project's port, data, checks — and the few rules that go wrong most, in a line each | `apps/cli/src/scaffold/project.ts` |
| `AGENTS.md` of a repo | an agent working on Plitzi itself | how we work and that repo's traps | this file (owner of § How we work) and the other four repos' |
| CLI README | a person | every command and option | `apps/cli/README.md` |
| MCP guide | an agent editing a live space through JSON ops | the ops and their JSON shapes | `apps/mcp/src/modules/mcp/helpers/guide.ts` |
| `docs/en` | a contributor | why it is built the way it is, internals | `docs/en/*.md`; `docs/es` translates 8 of them — change both |
| Package READMEs | someone configuring a package | its configuration (`createServer` options…) | `apps/server/README.md` and the rest |
| Website docs | a public user of Plitzi | the product, explained | `plitzi-sdk-server/prisma/seeds/spaces/platform/website/pages/docs-*.ts` |

Rules:

- **Change the behaviour, then every surface, in the same change.** Before finishing, search all of them for the old
  name, value or wording (this repo and `plitzi-sdk-server`'s website pages) and fix each, or delete what restates it.
- **Code is the source of truth.** Read the code before writing what it does — follow the chain down to the hook that
  produces a shape before stating it. When a doc and the code disagree, decide which one is wrong — when the doc
  describes what should happen, fix the code, not the doc.
- **Generate before you repeat.** A list the code already has (codes, presets, elements, steps, options) is generated
  or checked against the code (`authoringCodesTable`, `generate:authoring-errors`, `explain`, `motionProblems`),
  never typed out again. A table of codes in prose names only the codes of its own subject.
- **Restate in one line, with the owner's words.** Outside its owner a rule is a sentence and a pointer, using the same
  terms and the same example; never a second explanation of its edge cases.
- **Messages are documentation.** A refusal, a warning, `explain` and a CLI line are read before any page: they say
  the fix in the terms the docs use, and a hint applies to the field it is about.
- **Budgets are part of the design.** Skills are held to token budgets (`apps/cli/src/scaffold/skills.test.ts`):
  `SKILL.md` 1500 (a core: what it is for, the rules that go wrong most, a table routing each task to its one file),
  `CHEATSHEET.md` 2500, a reference 3000, a recipe 1500. Over budget, cut what another surface owns
  — never the rule itself.
- **Run the checks the docs have:** `apps/cli` `skills.test.ts` (budgets, links), `packages/sdk-authoring`
  `recipes.test.ts` and `codesPage.test.ts`, `apps/mcp` guide tests, and in `plitzi-sdk-server`
  `yarn vitest run prisma/seeds/spaces/platform/website` (`docsAccuracy.test.ts`: imports resolve, links exist, the
  catalogue is whole).

## Work Preferences

- Incremental changes: share file → analyze → propose → implement.
- Always confirm the API/interface before implementing changes to it.
- Do not modify anything beyond the target of the change.
- After finishing, update this file with new learnings when applicable.
- Tests: exhaustive edge cases, re-renders, memory leaks, performance.
