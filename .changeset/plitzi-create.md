---
'@plitzi/sdk-authoring': minor
'@plitzi/plitzi-sdk': minor
'@plitzi/cli': minor
---

`plitzi create` — a project that renders a space, with nothing to sign up for.

```bash
npx @plitzi/cli create my-site
```

Two decisions shape it: `--mode server|client` (a page server of your own, or the SDK in the browser with no
server at all) and `--source local|cloud` (the space travels in the project, or is read live out of Plitzi). It
installs the project and leaves it ready to start.

**`--package-manager npm|yarn|pnpm`** says which one the project is written for — what it installs with, and what
every command in its README and its Playwright config names. Omitted, it is taken from the one that invoked the
CLI, but that is a guess about the *invocation*: running `npx` once to scaffold a project you then work in with
Yarn is exactly the case it gets wrong. A Yarn project also gets a `.yarnrc.yml` pinning `nodeLinker:
node-modules` — Yarn 4 installs Plug'n'Play by default and a server-mode project cannot start under it, since
`node --import tsx` dies resolving its own entry.

**The blank space moved into `@plitzi/sdk-authoring` as a declaration.** It was checked-in JSON inside the
platform's seeds, which meant anything else that wanted it kept a copy — and a copy of a fixture is a fixture
that is wrong six months later with nothing to say so. `blankSpaceSpec` is now the source both the platform's
`POST /spaces` and `plitzi create` author from; `blankSpace()` returns the documents, and `blankSpaceSource()`
returns the declaration as a file a project can own and edit.

A local project therefore gets `src/space.ts` — its own copy of that declaration, complete and self-contained —
rather than an import. It exports `space`, not `blankSpaceSpec`: whoever receives it is looking at their own site,
not at Plitzi's blank one.

`blankSpaceSource(name)` takes the name the copy should carry, so the scaffold no longer knows which literals the
declaration happens to contain — a rename that finds nothing to replace throws instead of quietly handing back a
space still called "New space", and `permanentUrl` is slugged, since it is a DNS label at the platform and what
every element id and style selector is derived from. The import rewrite reads the block one statement at a time
rather than by single-line regex (Prettier wraps a long import, and the old one read that as no import at all,
dropping names the copy uses), and refuses to return a file that still points at anything relative.

A browser-rendered project also serves the dev tools' stylesheet. They draw into a shadow root, which cannot see
the page's styles, so they fetch `/plitzi-sdk-devtools.css` — a path that exists on a server serving the SDK's
assets and nowhere else, which left the panel unstyled in a Vite app. The generated `vite.config.ts` serves it
from `node_modules` in development, so it cannot go stale and nothing is copied into the project.

**A plugin of the project's own.** `src/plugins/StatCard` is a React component the generated space renders
through a `custom` element — the one thing about Plitzi a page of built-in elements cannot show, and a project
with no example of it leaves people assuming the catalogue is the ceiling. A plugin's props ARE the hosting
element's attributes, so a data source pointed at that element later reaches the component with nothing in
between; it renders `RootElement`, so the element's id, classes and authored CSS land on what it draws. Server
mode registers it with `action: 'compile'` and activates it through the deployment's `pluginNames` — registering
a plugin says it exists, the deployment says which ones a space renders with, and leaving the second half out
renders "Custom Component … Not Found" with no error anywhere. The blank space in `@plitzi/sdk-authoring` is
unchanged: `blankSpaceSource({ plugin })` adds the host element only for callers that carry a component to fill
it, because the platform authors new spaces from the same declaration and hosts nobody's plugins.

**`render()`'s third argument takes a component, not a decorated one.** It asked for `ComponentPlugin` — the type
carrying `type`, `assets`, `origin` and `content`, all of which `App` stamps on itself from the keys of that very
object. Nobody registering a component of their own could satisfy it without a cast, which is also why
`<Sdk.Plugin component>` already declared the plain one.

**Prettier and ESLint in the generated project**, configured rather than mentioned: type-checked rules scoped to
the files a type checker can see, Prettier owning layout, and `eslint-config-prettier` last so the two do not
argue on save. `lint` and `format` are scripts from the first commit, which is the only moment a repository's
style is cheap to decide.

**`render()` now returns `{ unmount }`.** A second `render()` into the same element used to create a second React
root over the first: two live trees on one node, neither aware of the other. Anything that re-renders on its own
needs to take the first one down, and hot module replacement is the case that forced it — a generated client
project swaps the space module and remounts, so a save updates the page without reloading it.
