# RFC 0033 — WS2 briefs: the website, the sign-in, the console, the docs

Read [`00-how-to-work.md`](00-how-to-work.md) first — **§ 4 "Changing a seed without breaking it" is the procedure of
every brief here** and is not repeated in each. Unless a brief says otherwise:

- **Repo:** `plitzi-sdk-server`. **Root of the seeds:** `prisma/seeds/spaces/platform/` — `website/`, `auth/`, `docs/`,
  and the shared `brand/` and `environments.ts`. A token, a tier or a shared class changes in `brand/`, never in one
  space.
- **Visual lane:** one WS2 task at a time, in the order of the RFC's table.
- **Every task is checked** in light and dark, at 1440, 1024 and 390, with a render diff of the pages it did not mean
  to change, and ends with `yarn vitest run prisma/seeds/spaces/platform`, `yarn typecheck`, `yarn lint` and the visual
  spec of the surface (`visual/website.spec.ts`, `visual/auth.spec.ts`, `visual/docs.spec.ts`, `visual/screens.spec.ts`).
- **A new check joins the journey that already has its setup** as a `test.step`; a width other than desktop is tagged
  `@responsive`. Addresses come from `visual/hosts.ts`, never by hand.
- **To find an element** the capture named: `grep -rn "'<data-plitzi-el name>'" prisma/seeds/spaces/platform`.

---

## T2.3 — Nothing clipped

- **Finding:** W4. **Size:** M.
- **Where:** the roles table in `website/landing/sections/collab.ts` ("…its spaces and its pla"); the functions
  snippet in `sections/capabilities.ts` / `sections/backend.ts`; the cookie policy's table (`landing/legal/cookies.ts`,
  styled by `landing/legal/kit.ts` and the markdown table's classes).
- **Steps:** the roles table wraps its text or stacks label over value under 600 px; code samples scroll sideways
  inside their own box, with a visible fade or edge so the reader knows; the markdown table becomes rows of label and
  value under 600 px — put that in `brand/` so the docs gain it too.
- **Verify:** a `@responsive` check on `/`, `/pricing`, `/cookies`, `/terms`: no text node's box crosses the right
  edge of its nearest scroll container unless that container scrolls sideways.

## T2.4 — The home on a phone

- **Finding:** W5. **Decided (D3):** fold, never cut — **no content is lost**, and it must still look good and work.
  **Size:** M.
- **Read first:** `website/landing/index.ts` (the thirteen bands in order), `sections/story.ts` (§ 01, the sticky
  stage), `sections/capabilities.ts` (§ 04, nine cards).
- **Steps:** under the tablet width: § 01 drops the sticky stage — each step carries its own picture, no empty scroll
  between steps (today ~450 px each); § 04's nine cards become a sideways scroller with snap: each card a full width
  minus a peek of the next, every card reachable by touch **and** by keyboard, the scroller labelled, its position
  shown (dots or "3 of 9"). Every card keeps all of its text and its mock-up. Measure the page's height before and
  after.
- **Do not:** remove a band, a card, a sentence or a mock-up; hide content behind a control that a search engine or
  a screen reader cannot open; change the desktop render (diff at 1440 and 1024 must be empty).
- **Verify:** home height at 390 ≤ 16,000 px (RFC § 5), as a ratchet in `visual/screens.spec.ts`; a test that every
  text node of the desktop home is in the phone's document; screenshots of the two folded sections at 390 in both
  themes **in the pull request, for the maintainer to look at** — "looks good" is his call, not a metric.
- **Stop and ask if:** 16,000 px cannot be reached without losing content — say what the page measures with
  everything kept, and let the maintainer move the target.

## T2.5 — Sizes that can be touched and read

- **Findings:** W6, W7, DS8. **Size:** M. **After T2.24** (the scale) if both are open.
- **Steps:** on a phone, bar links, footer links, chips and the terms checkbox get a 44 px target (padding or
  min-height, not larger type); footer links are 16 px tall today. Text under 12 px: raise it, or — where it is a
  picture of a product (the hero's studio, the mock-ups) — put the mock-up in an element marked `aria-hidden="true"`
  with a caption beside it that says what it shows. Add two ratchets to `visual/screens.spec.ts`: controls under 44 px
  on a phone (links inside a paragraph excepted), text nodes under 12 px outside `aria-hidden`.
- **Verify:** both counts 0 on the public pages at 390.

## T2.8 — `/pricing`

- **Finding:** W11. **Decided (D6):** whatever serves the visitor best — three plans in full first, the rest one
  click away, the configurator below. If, building it, another order clearly reads better, show both to the
  maintainer rather than choosing alone. **Size:** M. **After T1.7** if both are open (the same file).
- **Read first:** `website/landing/pricingPage.ts`, `pricingChooser.ts`, `pricingFigures.ts`.
- **Steps:** the page opens on three plans in full (Free, Site, App) with the rest one click away; the configurator
  stays below; headings in order (`h1` → `h2` → `h3`; today `h1` → `h3`); on a phone the summary of what was chosen is
  visible while choosing without lying over the rows (RS3 is T2.28's — coordinate).
- **Verify:** the accessibility tree's outline; a `@responsive` step picks a plan and reads its monthly price without
  scrolling back.

## T2.9 — Templates

- **Finding:** W12. **Size:** M.
- **Read first:** `website/landing/sections/templates.ts` (the landing's six), `landing/templatesPage.ts`,
  `website/templates.ts`, `src/services/templates/` (`review.ts`, `manage.ts`, `catalogue.ts`), `docs/templates.md`.
- **Steps:** templates of the category `Learning` never appear among the landing's six nor in the gallery's first
  ("All") view; they are reached from the Academy and from the gallery's Learning filter, as one entry ("Café Lumen —
  the Academy's site") with its levels inside. The review refuses a template with no description or no language, with
  the fix in its words (a platform rule: it is in `src/services/templates`, general). Fix the two seeded templates
  with no description and the one described in Spanish (give it a language, T2.22 handles `lang`).
- **Verify:** `src/services/templates/review.test.ts` gains the two refusals; a test that the landing's six hold no
  `Learning` template; the gallery's visual test.

## T2.10 — Sign-up and the sign-in pages

- **Findings:** W14, W15, W25. **Decided (D7): the username stays.** An account signs in with its address **or** its
  username, and usernames are meant to become handles (`@username`). **Size:** S.
- **Read first:** `auth/signIn.ts` (the pages; sign-up's fields at ~1563–1640; sign-in's field is already labelled
  "Email or username"), `auth/theme.ts`, `auth/account/security.ts` (the same strength line), `docs/auth/README.md`.
- **Steps:** the username field gets one line of help that says why it is asked — you can sign in with it or with
  your address, and it is how others will find you; the strength line is neutral until a key is pressed (sign-up and
  the account's password form); one vertical rhythm on a phone for `/`, `/signup`, `/sso`, `/forgot-password`; a
  share image and descriptions of 120–160 characters for the auth pages.
- **Do not:** remove or make optional the username field; change the sign-up API's contract; promise `@username`
  mentions in the copy as if they existed — say only what works today.
- **Verify:** `yarn vitest run prisma/seeds/spaces/platform/auth`; `yarn playwright test visual/auth.spec.ts`
  (sign-up, onboarding, mismatch journeys); a test that signs in once with the username and once with the address.

## T2.11 — Loose ends

- **Findings:** W1, W16, W26. **Size:** S.
- **Steps:** W16: `website/pages/test.ts` is an empty page shipped in the public document — **ask the maintainer**,
  then remove it and its registration in `website/index.ts`. W1/W26 are not yours: the draft notice
  (`landing/legal/kit.ts:209`) and the terms' placeholders wait for counsel's text; when it arrives, `TERMS_VERSION`
  (`src/config/legal.ts`) moves with it.

## T2.12 — One mark

- **Finding:** W18. **Decided (D11): the home's mark — the stacked layers — is the brand's.** **Size:** S.
- **Steps:** Step 0: find every place a mark is drawn — the stacked layers (landing, sign-in, account) and the violet
  comet (console, back-office, builder): `grep -rn "favicon\|logo" prisma/seeds/spaces/platform/brand prisma/seeds/spaces/platform/website/layouts`,
  and in `plitzi-workspace/apps/builder` (`grep -rn "logo\|Logo" apps/builder/src/modules/App`). List them in the pull
  request. The stacked layers live once in `brand/`; the console, the back-office, the emails (T2.20) and the
  builder's bar read them from there. The comet is removed from the seeds; in the builder, replace it and **ask before
  deleting its asset** if anything else may use it (a published package: check its exports). The favicon and the
  share image follow the same mark.
- **Do not:** redraw the mark; introduce a third variant for dark — the mark has a light and a dark form in `brand/`,
  nothing more.
- **Verify:** a test that the three platform spaces' bars and the builder's bar draw the same mark; both themes;
  render diff of the console's and the back-office's header.

## T2.13 — The console on a phone

- **Findings:** W19, W21, W22. **Size:** M.
- **Read first:** `website/layouts/sidebar.ts`, `layouts/navGroup.ts` (the console's frame), `pages/workspace-audit.ts`.
- **Steps:** the phone's header in two rows (today three: 170 px), with a menu that names every section whole (today
  "Automa…" is cut); the audit log in pages of 50 using the cursor its API already has (today one page of 7,068 px,
  13,745 px on a phone); the builder opened under 900 px says it needs a wider screen and offers the space's page and
  its console (that notice is in the console's `space-record-builder.ts` page, before the builder loads).
- **Verify:** `@responsive` steps in `visual/website.spec.ts` for the menu and the audit log; the notice at 390.

## T2.14 — Shift, signed in

- **Finding:** W20. **Size:** M.
- **Steps:** on a production build of the visual stack, record `layout-shift` with sources for the console's home,
  `/logs` at 390 (0.53 measured), a workspace's page (0.11) and the back-office's Pools (0.18–0.51; 6,825 nodes).
  Re-measure first — the home's figure may be a development build's, like the public home's. Reserve what moves.
  Pools: draw only the open tab's content (`pages/admin/pools*.ts`).
- **Verify:** each ≤ 0.1 in T0.7's table; Pools under 2,500 nodes on its first tab.

## T2.15 — What the demo shows

- **Findings:** W23, W24. **Size:** S–M.
- **Steps:** W23: an ordinary account's home carries ten back-office addresses in its markup (hidden by `shownTo:
  staffOnly` in `layouts/sidebar.ts`). Make them absent, not hidden, for who may not open them — the `visible` rule
  resolved on the server; check how `staffOnly` is written in `layouts/navGroup.ts`. W24: "Coming Soon Demo" is the
  space the builder's screenshot opens on; replace it with a space that looks like the templates beside it, or point
  the screenshot at a better seeded space — **ask before deleting a seeded space**.
- **Verify:** as `elena` on the visual stack, `curl` of the home holds no `/admin` address; the builder's visual test.

## T2.16 — Landmarks and a skip link

- **Finding:** W27. **Size:** M.
- **Steps:** Step 0: how the docs and the showcase spaces say their landmarks (they have 3–6 a page; `website`,
  `auth` and Pizarra have none): compare a docs layout with `website/landing/site.ts`. Then: the bar as `header` and
  `nav`, the content as `main`, the footer as `footer`, in `website`, `auth` and the console's layouts; a skip link
  ("Skip to content") as the first Tab stop, visible on focus. If authoring has no way to say one of them, stop and
  show the evidence; then add a suggestion to authoring's accessibility lint
  (`plitzi-workspace/packages/sdk-authoring/src/schema/lint/accessibility.ts`) for a page with no `main`.
- **Verify:** one `main` per page on the three spaces; the first Tab stop is the skip link; a suite step.

## T2.17 — Sign-in, said to everyone

- **Findings:** W28, W31. **Size:** S.
- **Steps:** the sign-in's error ("That email or password was not right.") in a `role="alert"` region (today the
  page's one `aria-live` stays empty); `autocomplete` values on the auth fields — `username`, `current-password`,
  `new-password`, `email`, `one-time-code` (today `on` and `off`); a focus ring on the fields measured at 3:1 in both
  themes (today `outline: none`). If the form control cannot say `autocomplete`, that is the element's gap
  (`plitzi-workspace/packages/sdk-elements`): show the evidence first.
- **Verify:** a test reads the alert after a wrong password; the attribute values asserted; the ring's contrast.

## T2.18 — Read by assistants, by the owner's choice

- **Findings:** W29, W30. **Decided (D10):** Plitzi's own website stops blocking; and **for every space the owner
  decides what to block, by kind** — it is configurable, not one switch. **Size:** M. **Part of it is a platform
  change, decided by the maintainer** — in `plitzi-workspace`.
- **Read first — every place `blockAiCrawlers` lives today** (`grep -rn "blockAiCrawlers" apps packages` in the
  workspace): the stage that writes `robots.txt`, `apps/server/src/core/services/robotsTxt.ts`; the setting's type
  and defaults, `packages/sdk-shared/src/types/SchemaTypes.ts` and `packages/sdk-shared/src/schema/schemaSettings.ts`
  (a boolean, beside `settings.robotsTxt`); where the builder edits it,
  `apps/builder/src/modules/App/AppContainer/containers/SharingSettings.tsx`; the MCP's
  `apps/mcp/src/modules/mcp/tools/operations/schema/settings/patchSettings.ts`; authoring's settings in
  `packages/sdk-authoring`; and the docs page that explains it
  (`plitzi-sdk-server/prisma/seeds/spaces/platform/docs/pages/docs-routing.ts`, ~line 240).
- **Steps:**
  1. **The setting (platform).** Replace the boolean with a list of what the space blocks, by kind: at least
     **training** (crawlers that collect pages to train models), **assistants** (an assistant fetching a page because a
     person asked it to), **AI search** (indexes that answer with links). One table in one place maps each kind to its
     user agents — the place the stage reads. No shim for the old boolean: migrate what stored spaces hold (`true` →
     the three kinds, `false` → none) in a migration of the CLI/authoring kind the repository already has
     (`apps/cli/src/migrations`), and say in the pull request what must be re-authored.
  2. **Every way to write it:** authoring (`settings`), the builder's space settings (three checkboxes with one plain
     line each saying what it stops and what it does not), the MCP's settings operation, and the docs page. One
     owner per fact: the kinds and their agents are defined once and the four surfaces read them.
  3. **Plitzi's website:** blocks nothing (`website/index.ts`, ~line 406). The docs already block nothing.
  4. An `llms.txt` for the website and the docs, written from their page lists — a route of the platform (like
     `robots.txt`), **never a file in `src/services/ssr/public/`**.
  5. The sitemap gains each template's page and each showcase chapter, with `lastmod` (the sitemap is derived from
     pages: find its stage in `apps/server`).
- **Do not:** let `settings.robotsTxt` (a space's own rules) be overwritten by the new setting — say in the docs how
  the two combine; block a search engine's ordinary crawler under any of the kinds.
- **Verify:** in the workspace: tests of the stage for each kind alone and together, of authoring, the builder's
  panel and the MCP operation; `yarn turbo run test lint typecheck`. In the server: `robots.txt` of the website names
  no assistant; a seeded space that blocks one kind lists only that kind's agents; `/llms.txt` answers on both hosts;
  a sitemap test; `yarn vitest run prisma/seeds/spaces/platform/docs`.

## T2.20 — Emails worth opening

- **Finding:** W35. **Size:** M.
- **Read first:** `src/services/api/email/BrevoProvider.ts` (`renderTemplate`, the ten templates inline, escaped by
  `escapeHtml`), `email/index.ts` (`SUBJECTS`, `REDEEM`, `withRedemptionLink`), `email/EmailProvider.ts`.
- **Steps:** move the ten templates out of the provider into one module the mail seam reads (a self-hoster's
  provider gets them too — if that module belongs in `@plitzi/sdk-server`, show the evidence first); each with a
  layout (the mark, a footer naming the address it was sent to and why), a plain-text part, `lang`, both colour
  schemes; subjects in one case (sentence case); the welcome's "amazing websites" line rewritten in the product's
  voice. The provider only sends (`htmlContent` **and** `textContent`).
- **Do not:** stop escaping interpolated values; put a destination nobody vetted into a link (`redirect` never
  reaches a template).
- **Verify:** `yarn vitest run src/services/api/email`: each template renders to HTML and text, with a markup payload
  as the username shown as text; one journey in `visual/auth.spec.ts` reads the mail in Mailpit.

## T2.21 — The builder's bar and rail

- **Repo:** `plitzi-workspace` — `apps/builder/src/modules/App/components/AppHeader/AppHeader.tsx` and
  `…/AppDirectory/`. **Findings:** W36, W37, W38. **Size:** M. **A platform change, general.**
- **Steps:** the top bar needs 1,564 px today: at 1440 **Snapshot** and **Publish** are outside the window, at 1280
  **Export** and the theme switch too. Make it fit from 1280: the page name, the widths and zoom fold into menus
  first; **Snapshot** and **Publish** are the last to leave. A click on a rail button shows that panel's content
  (today it is added as a closed strip under an open **Elements**); stacking stays for whoever pins a panel. Rail
  buttons carry their names (visible on hover, and as the accessible name). The class chip shows the author's name
  for a class, the hash only when there is none. "Keep on mind" → "Keep in mind". The dev-tools launcher clear of the
  panels.
- **Do not:** lose a control (inventory the bar's controls before and after — the maintainer's rule for inspector
  redesigns).
- **Verify:** the builder's tests (`yarn turbo run test --filter=@plitzi/plitzi-builder`); the workspace's e2e; a
  test at 1280 and 1440 that **Publish** is inside the window; in the server, `visual/screens.spec.ts`
  (`website-builder`).

## T2.22 — Long reference pages and a Spanish site

- **Findings:** W39, W40, W41. **Size:** M.
- **Steps:** the docs' CLI reference (`docs/pages/docs-cli.ts`, 28,933 px) and authoring errors
  (`docs/pages/docs-authoring-errors.ts`, 24,363 px) split by section — a page each, found by the docs' search — or
  drawn section by section; keep every anchor that other pages link (`yarn vitest run prisma/seeds/spaces/platform/docs`
  checks links). The docs' bar whole at 390. Ceniza's `settings.language` as `es` (it says `lang="en"`); a suggestion
  in authoring when a page's text and its language clearly disagree is a platform idea — propose it, do not build it
  here. The home's first paragraph takes the docs' sentence ("a platform for building websites and web apps…").
- **Verify:** neither page over 6,000 px; `lang="es"` on Ceniza's pages; the docs' tests.

## T2.24 — A scale for type, radii and the three colours

- **Findings:** DS1, DS2, DS3. **Size:** L.
- **Read first:** `brand/index.ts`, `brand/styles.ts` (tokens, type, element defaults), `website/styles.ts` (2,433
  lines of classes), `auth/theme.ts`, `website/style.test.ts` (it enforces both themes).
- **Steps:**
  1. In `brand/`: eight type steps (no half pixels — today 12.5, 11.5, 13.5, 14.5, 10.5 are in use), four radii and
     the pill, written once as tokens.
  2. Three text tokens that pass AA on their grounds: the success green **as text on light** (`#12a150` measures
     3.0–3.4 today), the violet **as text on dark** (`#6e52f7`: 3.6–4.0), the muted grey in both (`#6b7280`: 4.44 on
     light, 3.9 on dark). Keep the fills. The required asterisk (`#ff0000`) and the hero's code colour move onto tokens.
  3. Move every class of the three platform spaces onto the scale, one space at a time, each by render diff. A size
     that changes by a pixel is expected; a layout that moves is a bug.
  4. Raise the suite's contrast check from 3:1 to AA (4.5:1, 3:1 for large text) and add two ratchets per page:
     distinct font sizes and distinct radii.
- **Do not:** change a colour's meaning; touch the artwork that is fixed across themes (hero, closing band, footer).
- **Verify:** under 10 sizes and 5 radii per page; no text under AA in either theme; `website/style.test.ts`;
  the whole of `visual/website.spec.ts`.

## T2.25 — One voice for the brand

- **Findings:** DS4, DS5, W18. **Size:** M. **After T2.12 and T2.24.**
- **Steps:** one treatment for every page's headline (the maintainer picks; the showcase's gradient is the
  proposal); monospace kept for code and what is typed — labels, kickers, chips and captions move to the sans (mono
  is 41 % of the home's text nodes today); the sign-in's brand panel becomes a sentence and the mark instead of the
  mock-up (27 text nodes under 12 px).
- **Verify:** mono under 15 % of the home's text nodes (count as the design pass did: text nodes by computed
  `font-family`); one treatment on every `h1`.

## T2.26 — Covers that sell

- **Findings:** DS6, W12. **Size:** M.
- **Read first:** how a template's and a space's thumbnail is made (`src/services/preview/`, `docs/screenshot-service.md`,
  `src/services/templates/`).
- **Steps:** a cover per template made at publish: the page's first screen at a crop where its smallest text is
  readable at the card's size, or a designed card from the template's palette, name and category when the first
  screen is nearly empty. The same crop rule for a space's Overview picture (today cut mid-sentence).
- **Verify:** no two cards alike in the gallery; a test measures the smallest type in a cover at the card's width.

## T2.27 — The console's finish

- **Finding:** DS7. **Size:** S.
- **Steps:** on a phone every card of the console's home has the same gutter (Traffic and Needs attention run edge to
  edge today — `website/pages/home-authenticated.ts`); the roles' permissions (`pages/workspace-roles.ts`) as the
  form's own checkboxes with labels at full contrast and the title next to its first line; a first-run home that
  shows what to do instead of placeholder cards (`website/homeChecklist.ts` exists — read it first).
- **Verify:** a `@responsive` test of the gutters; the roles page in the suite's contrast check.

## T2.28 — The widths between

- **Findings:** RS1–RS6. **Size:** M. **With T2.1.**
- **Facts (swept at 768, 834, 900, 1024, 1100, 1180, 1280):** the public bar needs 1,069 px and folds only under
  ~834; at 1024 **Start free** is cut, at 900 **Sign in** too, at 834 Discord and the theme switch too. At 1024 the
  hero is one column with its right half empty and `/pricing` is one column with its summary at the foot. The sticky
  "Free · €0 / month" bar lies over the plan rows. "X-ray this page" is drawn twice at 1024. The console's bar loses
  the theme switch and the account between 834 and 928.
- **Steps:**
  1. The public bar folds when its items do not fit: set the fold above what it needs (measure it — do not guess),
     and keep **Start free** in the bar at every width.
  2. From 1024 the two-column layouts hold: the hero's, and `/pricing`'s with the summary beside the plans. Check the
     breakpoints in `brand/` — a layout meant for a phone must not apply up to 1280.
  3. The sticky summary sits clear of the rows it summarises (under them, or with the list padded by its height).
  4. X-ray once; the console's bar keeps its controls from 768; the automations' run line grows with the window.
  5. Add the sweep to the visual suite as a `@responsive`-independent test on the key screens at the seven widths:
     no control's box past the window's edge unless inside a container that scrolls sideways; no sideways scroll of
     the page; no two controls of the bar overlapping.
- **Verify:** the new test fails on `main` at 834–1068 and passes after; **Start free** whole at every width from 320.
