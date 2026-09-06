# RFC 0015 — Font management

- **Status:** Phases 1–3 implemented; phase 4 outstanding
- **Author:** Carlos Rodriguez
- **Date:** 2026-09-06
- **Scope:** `@plitzi/sdk-shared`, `@plitzi/sdk-style`, `apps/sdk`, `apps/builder`, `apps/server`
  (`@plitzi/sdk-server`), `plitzi-sdk-server` (API, CDN, deployment, MCP), `plitzi-ui`

---

## 1. Summary

A font in Plitzi is not a resource. It is the string value of a `font-family` declaration
buried inside `Style.cache`, and nothing in the system can answer *"which families, at which
weights, does this space use?"*. Every symptom below follows from that one fact.

This RFC makes a font a **declared resource of the space** (`style.fonts`), resolved to head
markup by **one pure function**, consumed by **every render surface**, and backed by a
**storage adapter** with two implementations — object storage + CDN for Plitzi's cloud, and
the local filesystem for a self-hosted server. Fonts may equally come from somebody else's
origin: Google Fonts, or any external CDN or foundry kit the customer names. The builder's font
picker stops being a hard-coded list and shows what the space actually has.

---

## 2. What was wrong

Verified against the code before any of it was changed, and kept because it is the argument for the design rather
than a description of the present. Every item is fixed unless it says otherwise.

### 2.1 A published page loads no web font at all

The only place a family is ever requested is the SDK asset rail —
`apps/sdk/src/modules/Plugins/PluginsContextProvider.tsx:130`, duplicated verbatim in
`apps/builder/src/modules/Plugins/PluginsContextProvider.tsx:256`. That rail is applied by
`IframeMode` and `ShadowMode` only. `RawMode` — the mode used for SSR and for production —
ignores `assets` entirely. The SSR template
(`apps/server/src/modules/ssr/views/template.ejs`) only *preconnects* to `fonts.googleapis.com`
and loads Material Icons; it never asks for a family. The static export template
(`plitzi-sdk-server/src/services/deployment/templates/index.hbs`) does the same.

> The builder canvas (an iframe) shows Lato. The published page shows the system fallback.
> That mismatch is the whole complaint.

### 2.2 The list is hard-coded three times and out of sync

`defaultFonts` in `packages/sdk-style/src/components/StyleInspector/categories/Typography/TypographyConstants.ts`
lists 18 families **with their weights**; the two provider files list the same families in a URL
**without** them. `TypographyFont.tsx` accepts a `fonts` prop that no call site in the workspace
ever passes — the extension point was designed and never wired.

### 2.3 The Google URL is HTML-escaped, and that bug is what makes the builder work

The href contains `&amp;text=…` inside a JS string that reaches the DOM through `setAttribute`
/ JSX, so it is never unescaped. Google sees an unknown `amp;text` param and ignores the
subsetting:

```
…&amp;text=RubikLato  → 200,  3381 bytes   (full families; param ignored)
…&text=RubikLato      → 200,   572 bytes   (real subset)
```

The `text=` was only ever meant to render family *names* in the dropdown. Broken, it serves the
full families — **at weight 400 only**. Hence faux bold everywhere: `font-weight: 700` over Lato
is synthesized by the browser because 700 was never requested. The weight `<option>` is already
disabled when the family does not declare the weight (`Typography.tsx:126`) — driven by the
hard-coded `defaultFonts`, so the mechanism exists and is fed the wrong data.

### 2.4 Shadow DOM never applies a web font

`ContainerShadow.Link` inserts the `<link>` *inside* the shadow root, and `@font-face` in a
shadow tree is ignored per spec. Every widget/embed surface (MCP render, plugin embeds) is
fontless by construction.

### 2.5 Screenshots inherit the fallback

Thumbnails and MCP previews render through the SSR draft — the surface of §2.1 — and nothing
awaits `document.fonts.ready` before capturing.

### 2.6 The AI proposes fonts nobody installs

`styleGuideTool.ts` and `brandTool.ts` take a family name; `AIStyleGuidePreview/helpers.ts:64`
writes `--font-heading` / `--font-body` as style variables. The name is stored, the file never
arrives.

### 2.7 The self-host path cannot serve a font file

`serveStatic` (`apps/server/src/core/staticFiles.ts`) ends in
`res.send(content.toString('utf-8'))`, and `SSRResponseHelpers.send` is typed `(body: string)`.
Any binary served through it is mangled. `MIME_TYPES` already knows `.woff2` and marks it
immutable, so the intent was there; the transport is not. Nothing binary is served through this
path today, so it is a latent limitation rather than a live bug — and it blocks §6.2.

---

## 3. The model: a font is declared by the space

`Style` gains one key, next to `variables` and `platform` — the document SSR and the SDK already
load and the builder already writes (`packages/sdk-shared/src/types/StyleTypes.ts:55`):

```ts
export type FontSource = 'system' | 'google' | 'remote' | 'hosted';

/** One face of a family: the file that carries a given weight and slant. */
export type FontFace = {
  weight: number;
  style: 'normal' | 'italic';
  format: 'woff2' | 'woff';
  /** Limits the face to the code points it covers, so the browser fetches it only when needed. */
  unicodeRange?: string;
};

type FontBase = {
  /** What `font-family` names. Unique within a space. */
  family: string;
  /** Appended to the stack: `'Lato', sans-serif`. Always present, `system` included. */
  fallback: string;
  /** The weights the family really provides — what the picker offers, and disables against. */
  weights: number[];
  styles: ('normal' | 'italic')[];
  display?: 'swap' | 'optional' | 'block' | 'fallback';
  /** Worth a `<link rel="preload" as="font">`. The body family, and at most one more. */
  preload?: boolean;
  /** Metrics for the fallback face, so layout holds while the real one loads (§8.4). */
  metrics?: { sizeAdjust: string; ascentOverride: string; descentOverride: string };
};

/** Installed nowhere: a stack the visitor's OS already has. Zero bytes. */
export type SystemFont = FontBase & { source: 'system' };

/** Google Fonts, reached through one aggregated `css2` request the resolver builds. */
export type GoogleFont = FontBase & { source: 'google'; subsets?: string[] };

/**
 * Anything else on someone else's origin — Adobe Fonts, Bunny, Fontshare, the customer's own CDN,
 * a foundry's hosted kit. Either a stylesheet that declares the faces, or the files directly.
 */
export type RemoteFont = FontBase & {
  source: 'remote';
  /** Absolute https URL of a CSS that declares the `@font-face` rules. Linked as-is. */
  stylesheet?: string;
  /** Absolute https URLs of the files, when there is no stylesheet to link. */
  files?: (FontFace & { url: string })[];
};

/** Uploaded to this deployment's store. `path` is store-relative, NEVER absolute — see §6.3. */
export type HostedFont = FontBase & { source: 'hosted'; files: (FontFace & { path: string })[] };

export type SpaceFont = SystemFont | GoogleFont | RemoteFont | HostedFont;
```

A discriminated union rather than one wide optional-everything object: `hosted` addresses its
files by store-relative path and `remote` by absolute URL, and those two must never be confused
by the resolver (§6.3). `google` is not folded into `remote` for the same reason it gets its own
picker: it has a catalog to search, a URL shape we own, and it can be mirrored (§6.4).

`--font-heading` / `--font-body` stay variables. **The variable names the font; the manifest
installs it.** A variable pointing at a family absent from `fonts` is a warning the builder and
the MCP both surface.

`Style.defaultProps` (`plitzi-sdk-server/src/services/mongo/models/Style/Style.ts`) seeds `fonts`
with the system stacks only — no download, no third party, correct on a machine with no network.

---

## 4. One resolver

`@plitzi/sdk-shared` exports one pure function. No React, no DOM, no fetch:

```ts
export type FontHead = {
  preconnect: string[];
  /** Stylesheets to link, in order. */
  links: { href: string; rel: 'stylesheet' | 'preload'; as?: 'style'; crossorigin?: boolean }[];
  /** `@font-face` blocks for hosted families, as CSS text. */
  faces: string;
  /** woff2 URLs worth a `<link rel="preload" as="font">` — the primary family only. */
  preload: string[];
};

export const fontsToHead = (fonts: SpaceFont[], resolveUrl: (path: string) => string): FontHead;
```

What each source contributes:

| Source | Contribution |
|---|---|
| `system` | nothing — the stack is already in `font-family` |
| `google` | **one** aggregated `css2` link for every google family (all weights, italics, subsets, `display`), plus the two `preconnect`s |
| `remote` + `stylesheet` | that URL linked as-is, plus a `preconnect` to its origin |
| `remote` + `files` | `@font-face` blocks pointing at the absolute URLs, plus a `preconnect` to their origin |
| `hosted` | `@font-face` blocks whose `src` is `resolveUrl(path)` |

`resolveUrl` is what makes one manifest work from the CDN, from a local disk and from a static
export (§6.3). Family names are CSS-escaped on the way into a `@font-face` block, and every
absolute URL is checked to be `https:` before it is emitted — both of these strings reach the
document, and one of them can be typed by a user (§6.6).

Every surface below calls this and **no surface builds a font URL of its own again**.

| Surface | Where the head comes from |
|---|---|
| SSR (`template.ejs`) | new `SSRTemplateProps.fonts: FontHead`, emitted in `<head>` before first paint — kills FOUT and CLS |
| CSR boot (`render()`) | injected into `document.head` from `offlineData`, not through the asset rail |
| `ShadowMode` | faces hoisted to the **host** `document.head`; only the `font-family` usage stays in the shadow (§2.4) |
| `IframeMode` (canvas) | stays on the asset rail, fed by the manifest instead of the 18-family blob |
| Static export (`index.hbs`) | the same head, baked in at publish time |
| Screenshot / thumbnail | as SSR, plus `await document.fonts.ready` before capture |

---

## 5. The builder

### 5.1 A Fonts panel at space level

Next to Variables/Theme. Three ways in:

- **Google** — search the catalog (§6.1), pick weights, styles and subsets. The dialog states the
  weight cost in KB, because that is the decision being made.
- **Upload** — one or more `.woff2`, mapped to weight/style (§6.2).
- **External URL** — an Adobe Fonts / Bunny / Fontshare / own-CDN stylesheet, or the font files
  themselves. The dialog asks for the family name and the weights the URL provides, because
  nothing on our side can read them out of someone else's kit; that declaration is what the
  picker and the weight select go by (§6.6).
- **System stack** — a name plus a fallback chain, zero bytes.

Removal is guarded: a family still named by a selector or a variable cannot be dropped silently;
the panel lists the uses.

### 5.2 The picker shows what the space has

`TypographyFont` stops merging a hard-coded list. The families come from `style.fonts` read off
the store (not prop-drilled through `StyleInspector` → `Categories` → `Typography`, which is why
the existing `fonts` prop never got wired), plus an "Add font…" entry that opens §5.1.

Two consequences fall out for free:

- The weight select (`Typography.tsx:126`) already disables weights the family does not declare.
  Fed by the manifest, faux bold disappears — and the disabled option offers "add 700 to Lato".
- Rendering each name in its own typeface keeps the subset trick, done right: one request, real
  `&`, `text=` built from the family names actually listed. Catalog search results subset lazily,
  per visible page.

---

## 6. Storage

### 6.1 The Google catalog

`GET /fonts/catalog?q=` in `plitzi-sdk-server`, proxying the Google Fonts Developer API, cached
in Redis (the catalog changes weekly; a 24h TTL is generous). The API key stays server-side —
the builder must never call Google directly, for the key, for CORS, and for rate limiting.

### 6.2 Uploaded files

`POST /spaces/:spaceId/fonts` — the **first media upload endpoint in this repo**, which is the
largest single piece of work in this RFC. Rules:

- **Magic-number validation**, not the extension or the declared MIME: `wOF2` for woff2, `wOFF`
  for woff. A file that does not match is rejected.
- Size cap per file and count cap per space, metered against the plan through the existing
  quota plane, so a space cannot turn its font store into free hosting.
- The family name is taken from the uploader's declaration but **checked against the font's own
  `name` table** where a parser is available; a mismatch is a warning, not a rejection (legally
  renamed licensed fonts are a real case).
- Licensing is the customer's responsibility and the upload dialog says so — Plitzi stores and
  serves what it is given.

### 6.3 The store adapter, and why the manifest holds no URLs

Mechanism in `@plitzi/sdk-server`, data in `plitzi-sdk-server` — the same line as everywhere else:

```ts
export type FontStore = {
  list: (spaceId: string) => Promise<StoredFont[]>;
  put: (spaceId: string, file: { name: string; body: Buffer; format: 'woff2' | 'woff' }) => Promise<StoredFont>;
  remove: (spaceId: string, path: string) => Promise<void>;
  /** store-relative path → absolute URL, per environment. */
  url: (spaceId: string, path: string) => string;
};
```

- `createLocalFontStore({ dir, publicPath })` — writes under a directory, served by a static
  stage at `/fonts/*`. **The self-host default**: no S3, no CDN, no account, works offline.
- `createS3FontStore({ …aws, cdnBaseUrl })` — `plitzi-sdk-server`'s, reusing `AwsWrapper`
  (`uploadFile`, `deleteFile`, CloudFront invalidation) under `fonts/<spaceId>/<hash>.woff2`,
  served from `cdn.plitzi.com`.

`SpaceFont.files[].path` is **store-relative**. If the manifest held `https://cdn.plitzi.com/…`,
then exporting a space to a self-hosted server, or moving a bucket, would bake in an origin that
is not the server's — the whole point of the self-host path. The absolute URL is produced at
render time by `url()`, which is also what lets a static export emit CDN URLs while the same
space renders from disk in development.

`createServer({ fonts })` takes the store plus the resolver; a self-hoster who passes nothing
gets the local store rooted in the public dir.

`send` takes a `Buffer` and sends it untouched — never compressed, since what a Buffer holds is compressed
already — and `serveStatic` hands it the bytes it read rather than a UTF-8 round trip of them (§2.7).

The store deliberately cannot READ: a local store's files are served off disk by the `/fonts/*` stage and a
cloud store's by its CDN, so a method to pull bytes back through the abstraction would have had no caller.

### 6.4 Mirroring Google

A publish-time (and on-demand) step that downloads the woff2 files of a `google` family, puts
them in the store and flips the entry to `hosted`. It buys three things: no third-party request
(the German Google Fonts rulings under GDPR are a live sales objection), a cache we control, and
fonts that work in an air-gapped self-host and in the screenshot browser.

### 6.5 CORS and CSP

Font files are CORS-checked when loaded cross-origin, so the `/fonts/*` stage answers
`Access-Control-Allow-Origin: *` (as the other asset mounts do) and every font preload carries
`crossorigin`. A deployment serving from a bucket has to set the same header on its CDN
distribution; that is configuration, not code.

For MCP widgets the answer turned out to be the proxy that already exists rather than a CSP list:
`proxifyResources` now rewrites a `remote` font's stylesheet and file URLs to this server's
`/__proxy`, which is declared. `google` entries are left alone and cannot be otherwise — the
resolver builds one `css2` URL from the families at render time, and which files that stylesheet
then names is Google's answer, not something stored anywhere we could rewrite.

`FontHead.origins` is still produced for a host that wants the list.

### 6.6 Trusting a remote URL

A `remote` entry is a URL a user typed, and it ends up in the document as a `<link href>` or
inside a `@font-face` `src`. Three rules, enforced where the manifest is written and again in
the resolver, since a document from Mongo is not a validated input:

- **`https:` only.** No `http:`, no protocol-relative, no `javascript:`/`data:`.
- **No credentials in the URL**, and the host must parse — a value that does not survive `new URL()`
  never reaches the page.
- **The origin is recorded**, so §6.5 can build the CSP and the preconnects from the manifest
  rather than from a list someone has to remember to update.

Plitzi does not proxy, cache or rewrite a remote font: linking it is exactly as private as the
customer's choice of CDN, and a space that wants none of that uses `hosted` (§6.2) or mirrors
(§6.4). The Fonts panel says so where the URL is entered.

---

## 7. MCP and the AI

- `list_fonts` / `add_font` (system | google | remote | hosted) on the style toolset, so
  `design_style_guide` proposing "Playfair Display" can actually install it instead of writing a
  name nobody honours.
- A resource exposing the space's manifest, so the agent reads before it writes.
- Validation warns when a `font-family` value names a family absent from the manifest — the same
  shape as the existing unknown-type warning.

---

## 8. Migration and follow-ups

### 8.1 One-shot migration

A script in `plitzi-sdk-server` scans `style.platform.*.*.cache` and `style.variables` for
`font-family` values, splits each stack into candidates, matches them against the Google catalog
and a table of known system stacks, and writes `style.fonts`. Unmatched names become
`source: 'system'` with a sensible fallback. Then `refreshCache()`.

The heuristic is `fontsFromCss`, and it did NOT stay in the migration as first planned. An import
faces the same problem continuously — somebody else's stylesheet naming families that say nothing
about where they come from — so the two share one implementation, with tests, rather than the
importer growing a second one (§8.5). What stayed private to the migration is the table of what the
old picker could possibly have handed a space.

What was rejected is the other thing: an emitter that works the fonts out of the CSS at RENDER
time. That would be a second source of truth for exactly what the manifest exists to be.

### 8.5 An import declares what it imports

`naturalToSchema` derives the manifest from the stylesheet it produced, so a page brought in from HTML, Tailwind or
Webflow arrives with its families declared instead of naming faces nothing loads. One the Google catalog recognises
is declared as a Google font at the weights the imported CSS actually uses; anything else is declared as a system
stack — which renders exactly as it would have, and is visible in the Fonts panel rather than being an invisible
name in a stylesheet.

Only the family each declaration LEADS with. The rest of a stack is its fallback chain, and importing
`ui-monospace, SFMono-Regular, Menlo, monospace` must not leave a space declaring three families nobody chose.

### 8.2 No compatibility layer

Pre-release: the hard-coded `defaultFonts` list, both `static-2` provider entries and the
`&amp;` URL are deleted, not deprecated.

### 8.3 The two one-liners ride along in phase 1

Fixing `&amp;` and awaiting `document.fonts.ready` are independent of everything else and land
first — they cost nothing and they make the phase-1 result visible.

### 8.4 Later

`size-adjust` / `ascent-override` metrics on the fallback face for zero CLS; per-page subsetting
based on the glyphs a page actually renders; variable-font axes (`wght` as a range instead of a
weight list).

---

## 9. Phases

| # | Delivers | Repos | Status |
|---|---|---|---|
| 1 | `style.fonts` + `fontsToHead` + SSR/CSR/shadow/iframe/export wiring + migration + the §8.3 fixes | workspace, plitzi-sdk-server | **Done** |
| 2 | Fonts panel, picker fed by the manifest, weights honoured, `parseSpaceFont`, the three GraphQL mutations, the catalog proxy (§6.1, pulled forward — the panel needs something to search) and the importer declaring what it imports (§8.5) | `apps/builder`, `sdk-style`, `sdk-shared`, plitzi-sdk-server | **Done** |
| 3 | `FontStore` (local + S3), upload endpoint and Upload tab, binary `send` (§2.7), `/fonts/*` serving stage, `fontsBaseUrl` on the endpoint set, manifest URLs through the widget proxy | `apps/server`, `apps/builder`, `apps/mcp`, plitzi-sdk-server | **Done** |
| 4 | Google mirroring, MCP ops, fallback metrics | plitzi-sdk-server, workspace | Outstanding |

Phase 1 alone closed the reported problem: what the builder shows is what the visitor gets. Phase 2 is what makes
it a feature rather than a fix — a space can say which families it wants, and is shown what it is asking for.

---

## 10. Open questions

- **Weight budget.** Should a plan cap the number of families/weights a space may load? A page
  pulling six families at five weights is a performance problem the platform can see coming.
- **Mirroring by default?** §6.4 as the default for every google family (privacy and performance
  win, more storage and a publish-time step) or opt-in per space.
- **Font licensing on export.** A self-hosted export carries the uploaded files. Nothing in the
  product tracks whether the customer may redistribute them; the position is that it is theirs
  to answer, and this RFC assumes that stays true.
