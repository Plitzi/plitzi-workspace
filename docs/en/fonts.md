# Fonts

How a Plitzi space loads type: what a font **is** here, where the files come from, and what a deployment has to
configure for any of it to work.

The reasoning behind each rule lives beside the code that enforces it — the RFC this grew out of was deleted when
it shipped, and is in the history (`git log -- docs/rfc`). This is how to use it.

---

## 1. A font is declared, not named

A `font-family` declaration **names** a family. Nothing about naming one loads it. So every space carries a
**manifest** — `style.fonts` — that says which families it uses, at which weights, and where the files come from.

That is the whole idea, and it is worth stating plainly because the alternative is what Plitzi did before: the
builder offered eighteen hard-coded families, the canvas loaded them, and the published page loaded none of them.
A space designed in Lato shipped in Arial, and nothing anywhere said so.

Two consequences follow:

- **The picker offers what the space declares.** Add a family in the Fonts panel and it appears in the element
  inspector; nothing else does.
- **The weight select offers the weights that family declares.** A weight nobody loaded used to be "available" and
  the browser drew a synthetic bold for it. Now a weight you have not asked for is visibly unavailable.

A family the CSS names and the manifest does not is not an error — it renders in the fallback, exactly as it would
have. It is simply now *visible*: the Fonts panel lists it, and an agent reading `plitzi://fonts/{env}` is told.

---

## 2. The four sources

| Source | Where the bytes come from | What you give it |
|---|---|---|
| `system` | The visitor's machine. Nothing is downloaded. | A family name and a fallback |
| `google` | Google Fonts, one aggregated `css2` request for every Google family in the space | Family, weights, styles |
| `remote` | Someone else's https origin — Adobe Fonts, Bunny, Fontshare, your own CDN | A stylesheet URL, or the files |
| `hosted` | This deployment's own store | An uploaded `.woff2` per weight and slant |

Every entry carries a **fallback**: what renders until the face arrives, and forever for anyone it never reaches.
It is required, because it is the text most visitors read first.

**Every weight is a file.** A family offering nine of them is nine downloads if you take the row. The panel makes
you choose.

---

## 3. The Fonts panel

Left sidebar, between Variables and Resources. It lists what the space declares — drawn in the family it names —
with the weights, the source, and how many rules use it.

Four ways to add one: **Google** (search the catalog, pick weights), **Upload** (a `.woff2` per weight and slant),
**External** (a stylesheet URL from a foundry or your own CDN), **System** (a stack you expect the visitor to have).

Removing a family in use is allowed and warned about: the rules naming it are left alone and drop to their
fallback. What they should say instead is a design decision, not a side effect of unloading a file.

### Hosting a Google family yourself

The download button on a Google row copies its files into this deployment's store and re-declares the family as
`hosted`. Three things it buys, all the same thing said differently: the visitor's browser stops telling Google
which pages they read (the German rulings on exactly that are why customers ask), the files stop depending on a
third party being up, and a self-hosted deployment with no route to the internet renders correctly.

Only `latin` and `latin-ext` are copied unless the entry names other subsets — the rest would be a file each.

---

## 4. Where the files are loaded

One resolver decides — `fontsToHead(style.fonts, resolveUrl)` in `@plitzi/sdk-shared` — and every surface reads it:

| Surface | How it arrives |
|---|---|
| Server-rendered page | In the `<head>`, before the first paint. A face requested at hydration arrives after the text was already drawn |
| Client-only render | Appended to `document.head` at boot, recognising what the server already put there |
| Widget / shadow DOM | The host document's head. A `@font-face` inside a shadow root is ignored by the browser |
| Builder canvas | The iframe's head, through the asset rail — it is a document of its own |
| Static export | Baked in at publish time. An exported site has no server to ask |
| Screenshots | Captured after `document.fonts.ready`, so a thumbnail is not a picture of the fallback |

**Never write a font URL anywhere else.** That function is the only thing that knows how to build one.

---

## 5. Configuring a deployment

| Variable | What it decides |
|---|---|
| `GOOGLE_FONTS_API_KEY` | The Google **catalog** search in the panel. Serving Google fonts never needs a key; without one the panel says so and the other three tabs work |
| `FONTS_DIR` | Keep uploaded faces on this machine, served by the page server at `/fonts/*`. The self-hosting answer: no bucket, no credentials, works offline |
| `FONTS_BUCKET_S3` | Keep them in object storage instead |
| `FONTS_BASE_URL` | Where a browser addresses them — the CDN in front of that bucket. Defaults to the page server's own `/fonts` |
| `FONTS_MAX_FILE_BYTES` | Per file. 2 MB by default: a Latin woff2 is ~30 KB, so a megabyte is a CJK face rather than a mistake |
| `FONTS_MAX_FILES_PER_SPACE` | Per space. 40 by default — several families at several weights, and not a free file host |

With neither `FONTS_DIR` nor `FONTS_BUCKET_S3`, uploading answers 503 and says which one to set. Everything else
keeps working: a space using Google, remote or system families needs no store at all.

**A manifest never holds an absolute URL for an uploaded face.** It holds a store-relative path, and the origin is
supplied at render time by whichever deployment is rendering. That is what lets one space be served from Plitzi's
CDN, from a self-hosted server's own disk, and from a static export, without carrying somebody else's origin
around. If you serve from a CDN, set `Access-Control-Allow-Origin` on it: a font is fetched in CORS mode whatever
its origin.

---

## 6. Agents

Two write operations, on the same `plitzi_apply` vocabulary as everything else:

- `upsertFont` — declare a family, or replace what an already declared one says.
- `deleteFont` — stop loading one.

And one resource, `plitzi://fonts/{env}`, which answers both halves: what the space **declares**, and what its
stylesheet **names without declaring**. The second is in the cold-start primer too, because an agent about to
write typography should know the space is already asking for something nobody loads.

The agent's schema is deliberately narrower than the manifest: `display`, `preload`, `subsets` and per-face
unicode ranges are panel tuning, and every field an operation declares is carried in four tool schemas, in the
model's context, on every request.

---

## 7. Left open

- **Fallback metrics.** `size-adjust` / `ascent-override` on a matched fallback face would take the layout shift
  to zero rather than merely shortening it. It needs the real font's `OS/2` and `head` tables, which means either
  a font-parsing dependency or a woff2 table decoder — a meaningful amount of binary code for an optimization on
  top of a correct render. The manifest has no `metrics` field until something emits one.
- **Variable fonts** are declared as the static weights they expose; a `wght` range would be one request instead
  of several.
- **Per-page subsetting** — asking only for the glyphs a page actually draws — is possible for hosted faces and
  is not done.
