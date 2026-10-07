# RFC 0024 — Import and migration: UI in, sites over

- **Status:** Proposal — wanted, not scheduled; no work started
- **Author:** Carlos Rodriguez
- **Date:** 2026-10-07
- **Scope:** a new import engine in a workspace package (`packages/sdk-authoring`, or a package of its own), its four
  consumers — the builder's Transform panel (`apps/builder`), the CLI (`plitzi import`), the MCP (`apps/mcp`) and the
  platform's endpoint (`plitzi-sdk-server` `services/transformers`) — and the screenshot service for measuring fidelity

---

## 1. Summary

Two people arrive at Plitzi with work already done somewhere else:

- **A developer with UI in hand** — a block from Tailwind UI, shadcn or Flowbite, the HTML of a template they bought,
  a section of their old site. They want it in their space as real elements and classes, not as a pasted blob.
- **A team leaving another platform** — Webflow first. They want their site over: its pages, its classes, its CMS, its
  assets, its redirects. Not a section at a time.

Plitzi has the start of the first (the builder's Transform panel) and nothing of the second. This RFC turns the
converters that exist into one engine every surface uses, holds what it produces to authoring's rules, and builds the
Webflow migration on top of it.

**The engine is deterministic; an agent is optional.** Conversion that can be done by rule is done by rule, so an
import is repeatable, testable and free. What a rule cannot decide — that these twelve divs are a card grid, that this
script is a tab switcher — is left to an agent the person already works with, through the MCP, as in RFC 0022. Plitzi
runs no model for this.

## 2. What exists already

| Piece | Where | What it gives this |
| --- | --- | --- |
| HTML / HTML+Tailwind / Webflow clipboard / JSON → schema | `plitzi-sdk-server` `src/services/transformers/helpers/naturalToSchema` (~3,000 lines: `HtmlParser` over `xmldom`, `CssParser` over `postcss` and `@csstools/css-calc`, one mode per source) | The converters themselves: elements, classes per breakpoint, keyframes, Google Fonts declared through `googleFontLookup` |
| `POST /utils/transform-to-schema` | same folder, `endpoints/transformToSchema.ts` | The one way in today: `{ body, mode, custom-css, style-mode }` → `{ schema, style }` |
| The Transform panel | `apps/builder/src/modules/Transformers` | Paste, preview, insert into the selected element |
| Fixtures | `naturalToSchema/fixtures`: 19 HTML+Tailwind, 8 Webflow, 7 JSON, 1 HTML | A starting corpus — asserted today as whole-schema equality (`naturalToSchema.test.ts`) |
| Schema → authoring code | `POST /utils/transform-to-authoring`, `helpers/authoringExport.ts`; `specFromSpace` in `sdk-authoring/decompile` | The other half of `plitzi import`: documents written out as `src/space/` TypeScript |
| `plitzi import <url>` | `apps/cli` (`importPage`) | A page of a site the person verified, measured in the project's Playwright at three widths: its tokens, an outline of its blocks per breakpoint, its repeated blocks as `data/*.json` — a place to start writing from, deliberately never its words nor a copy |
| `compareSpaces` | `sdk-authoring/decompile/compareSpaces.ts` | Proof that a round trip changed nothing observable |
| Authoring's linter and fixes | `authorSpace(...).warnings/suggestions`, `fixSpace`, `plitzi fix` | What turns a literal import into an idiomatic one: `custom-css-class`, `custom-css-slot`, lists, `class-overrides-class` |
| Components | `schema.components` (ex-RFC 0021) | Where a repeated block lands |
| Screenshots | the screenshot service, `plitzi_look` | Rendering the original and the import side by side |
| Space data and the CDN | `src/data/`, the space's bucket, connectors | Where a CMS and its assets land |

## 3. What is wrong with today's import

1. **It lives in the platform, not the SDK.** The converters are mechanism, but they sit in `plitzi-sdk-server`, so
   only the builder can reach them. The CLI, an agent through the MCP and a self-hosted server cannot import at all.
2. **It imports fragments.** The Webflow mode reads what the Designer puts on the clipboard — one section. A site is
   pages, a CMS, assets, redirects, settings; none of that has a way in.
3. **What it produces skips authoring's rules.** An import arrives as converted, never through the linter and fixes
   every hand-written space goes through: rules left in `customCss` a class could hold, divs where a list belongs, the
   same card repeated twelve times instead of a component.
4. **Its fidelity is not measured.** The tests compare schemas with what the converter produced the day they were
   written; nothing says whether the import still LOOKS like its source.

## 4. The design

### 4.1 One engine, in a package

The converters move to the workspace, as an entry of their own (`@plitzi/sdk-authoring/import`, or `@plitzi/sdk-import`
if its dependencies — `postcss`, a DOM parser — should stay out of authoring's install). The engine is pure: source in,
documents and a report out, no network and no filesystem. What needs either is an adapter the caller passes:

```ts
const { schema, style, report } = await importUi(source, {
  from: 'html' | 'tailwind' | 'webflow-clipboard' | 'json',
  styleMode, // the space's
  fonts: googleFontsCatalog // optional: without it, an unknown family arrives as a system stack, said in the report
});
```

`plitzi-sdk-server`'s endpoint becomes a thin wrapper over it, as `transform-to-authoring` already is over
`exportAuthoring`.

### 4.2 Four consumers, as the linter has

| Consumer | What it does with an import |
| --- | --- |
| The builder's Transform panel | As today — paste, preview, insert — through the engine; the report shown beside the preview |
| `plitzi import`, which takes a file besides a URL: `plitzi import ./block.html [--as component <Name>]`, `plitzi import ./webflow-export.zip` | A file the person owns is converted, not measured: authoring code into `src/space/` (or `src/components/`), then `author`, and what `fix` would change. A URL keeps today's meaning — a measured start, never a copy |
| An MCP tool (`plitzi_import`) | An agent imports a block into a page, as operations it can `dryRun` and see with `look` |
| `POST /utils/transform-to-schema` | Unchanged for its callers |

### 4.3 Everything imported goes through authoring

An import is not finished when it converts; it is finished when `authorSpace` accepts it and `fixSpace` has nothing it
can do by itself. So the engine's output goes through:

1. **Authoring** — what it refuses is a defect of the converter, reported with the source line that produced it.
2. **Fixes with one reading** — a `customCss` rule a class can hold folded into the class, a part's rule onto its slot.
3. **Structure detection** — the engine's own pass, by rule: siblings with the same shape become a `list` (from the data
   their text makes) or instances of one component; a `<nav>` of links gets `current` states; a `<form>` its controls.
4. **Suggestions left as suggestions** — what needs a decision stays in the report, for the person or an agent.

### 4.4 Importing UI (the developer's case)

Sources, in order: plain HTML with its CSS; HTML with Tailwind classes (v3 and v4: v4's CSS-first configuration and
`@theme` variables become the space's tokens); the Webflow clipboard (what exists). A page on the web is not a
source: `plitzi import <url>` already starts from one by measuring it, and copying a site the person has not handed
over is not this engine's business.

What a script did is never guessed: a dropdown, a tab set or a carousel written in JavaScript is reported with the
built-in element or the flow that does the same, and an agent can make that change.

Licences are the user's business, not the engine's: it converts what it is given and keeps nothing. Tailwind UI and its
kind forbid redistributing their blocks, never using them, so Plitzi ships no catalogue of other vendors' UI.

### 4.5 Migrating a Webflow site

**What comes in.** Webflow's code export (a ZIP of HTML, `webflow.css`, `webflow.js` and the assets) and the CSV export
of each CMS collection — or, where the plan allows, the Data API (sites, pages, collections, items, assets) with a site
token the person gives. Which plans offer which is the first thing to settle (§7).

**What it becomes:** a project, as `plitzi create --from` writes one — so the result is code the developer owns and
`plitzi push` puts on the platform.

| Webflow | Plitzi | Notes |
| --- | --- | --- |
| Pages and folders | Pages, nested layouts where the folders share chrome | The navbar and footer every page repeats become a layout |
| Classes and combo classes | Classes; a combo class a class plus a variant | Global swatches → colour tokens; the default `body` style → the space's base |
| Breakpoints (base, 991, 767, 478; 1280+ when used) | The space's desktop / tablet / mobile | Mobile landscape and portrait fold into mobile; what differs between them is reported |
| States (hover, pressed, focused, current) | The class's `states` | `w--current` → the `current` state |
| CMS collections and items | `src/data/<collection>.json`, read by a provider | Collection pages → a `pageFamily`; references and multi-references kept as ids |
| Collection lists | `list` bound to the data | Their filters and sort, as the provider's query |
| Assets | The space's CDN | Responsive `srcset` variants dropped: the image service makes its own |
| Interactions (IX2) | Motion where it maps (scroll reveals, hover transitions); reported where it does not | Never dropped in silence |
| Forms | `formControl`s and a server action that sends what the form sent | The destination (Webflow's form inbox) is the person's to choose |
| Embeds and custom code | `nodeHtml`, or reported | Analytics and tag-manager snippets become the space's settings where they have one |
| SEO and Open Graph, 301 redirects | Page settings; the space's redirects | |

**The migration report.** Like `plitzi check`'s: every page with what came over and what did not — an interaction
with no equivalent, a breakpoint difference folded away, a script left out — each with where it was in the source and
what to do. A migration that hides a loss is worse than one that fails.

### 4.6 Fidelity, measured

For every page of a migration, and every fixture of the suite: render the source and the import at the three widths
with the screenshot service, and compare. The person sees a fidelity score per page and the pages that differ most;
the engine's tests hold each fixture to a threshold, so a converter change that makes imports look worse fails in CI —
not on a customer's site.

The fixtures that exist become the start of that suite; real exports (with permission) grow it.

### 4.7 An agent finishes, if the person wants

The deterministic import is faithful; it is not always idiomatic. With the report and the screenshots, an agent —
connected through the MCP, as in RFC 0022 — can do what rules cannot: name classes for what they are, turn a scripted
widget into the built-in element and its flows, merge near-duplicate classes. Its changes arrive as a proposal the
person reviews, never as a silent rewrite.

### 4.8 Other platforms, later

Each source is a mode of the engine and a mapping table; the engine, the report and the fidelity check are shared.

- **Framer** has no code export: its import would be a crawl of the published site — lower fidelity, no CMS without its
  API. After Webflow, if users ask.
- **WordPress** is a different problem — a PHP theme, content in the block editor — closer to a CMS connector
  (`docs/en/connectors.md`) for the content plus a UI import for the theme's pages.
- **Figma** is RFC 0022's (a picture, read by an agent), not a converter's.

## 5. Phases

1. **The engine in the workspace.** Move `naturalToSchema` and its parsers into the package, behind `importUi`; the
   platform's endpoint wraps it; the fixtures move with it. No behaviour change — the existing tests prove it.
2. **Through authoring.** Authoring, fixes and structure detection after every import; the report.
3. **`plitzi import` and the MCP tool.**
4. **Fidelity.** The screenshot comparison, a threshold per fixture in CI.
5. **Tailwind v4.**
6. **Webflow migration.** The code export and CMS CSVs first; the Data API after.
7. **The agent's pass**, on RFC 0022's proposal and review.

Phases 1–3 are worth doing on their own: they put import where developers and agents work.

## 6. Decisions so far

- Import stays and grows: it was nearly cut as maintenance cost, and kept as the way in for developers with UI and for
  teams leaving another platform.
- One engine, in a workspace package, with four consumers — the linter's shape.
- Deterministic first, an agent optional, Plitzi running no model.
- Webflow is the first migration source: its model (classes, combo classes, breakpoints, a CMS) is the closest to
  Plitzi's, so it gives the most for the work.
- A migration ends as a project the developer owns, through `plitzi create --from`'s shape and `plitzi push`.

## 7. Open questions

- **Webflow's exports per plan.** Which plans include the code export, the CMS CSV export and Data API access, and what
  the Data API returns of a page's structure. Settle before phase 6 is designed further.
- **The package.** An entry of `sdk-authoring`, or `@plitzi/sdk-import` — decided by whether the parser dependencies
  should reach everyone who installs authoring.
- **The fidelity threshold.** What score a fixture must keep, and whether text rendering differences (fonts loading)
  need masking.
- **Interactions.** Which IX2 patterns map to declared motion well enough to convert, rather than report.
- **Forms.** Whether a migrated form gets a default destination (an email to the workspace owner) or none until chosen.
