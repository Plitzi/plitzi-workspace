# RFC 0033 — Audit and hardening: the website and sign-in, page weight, the gates, the agent surface and server work

- **Status:** Proposal
- **Author:** Plitzi
- **Date:** 2026-11-10
- **Scope:** an audit of code, design and product across `plitzi-workspace` (every app and package) and
  `plitzi-sdk-server` (the hosted platform, its `website` and `auth` seeds), turned into work. It covers:
  - the public website and the sign-in space: layout, content, accessibility, phone widths, both themes;
  - what every published page weighs, which is the platform's and every customer's;
  - the gates: dependency advisories, the server's CI, budgets that ratchet;
  - code quality and what is left half-moved;
  - `sdk-authoring`, `apps/mcp` (`@plitzi/sdk-mcp`) and `apps/cli`: reliability and cost for an agent;
  - server actions, functions and runtimes, with the worker, the runner and a space's runtime;
  - the product: what a first visitor, a first customer and a self-hoster still miss.

  Each task is sized for one agent working alone. §7 says how they are taken.

---

## 1. Summary

The code is in better shape than its age suggests: both repositories type-check and lint clean, the hosted server's
1,666 unit tests pass in 27 s, there is no `TODO`, and casts outside tests are few (40 `as unknown as` in ~370k lines of
the workspace, 20 in the server). The debt is not in the lines. It is in four places the checks do not look at:

1. **What a page costs.** A legal page of 9 KB of content makes the browser download ~0.9 MB: one SDK bundle
   (948 KB minified), two whole icon fonts (232 KB) and the space's entire document (2.7 MB raw, 183 KB compressed) — the
   signed-in dashboard included. It is the same for every customer's space.
2. **What is not gated.** The server's 85 e2e files and 260 visual tests never run in CI; nothing audits dependencies,
   and the server carries two packages with critical advisories (`xmldom`, `handlebars`); no test holds a page to a size
   or to a layout-shift figure.
3. **The front door on a phone.** The home page is 27,747 px tall at 390 px (33 screens), has no menu, clips text and
   code in three places, leaves 450–550 px voids inside showcase cards, and 104 of its 120 controls are under 40 px on
   a side. Its proof is weak where it is loudest: a GitHub count of 6 shown four times, a "Most chosen" plan with no
   customers, legal pages that say they are drafts.
4. **What the split left behind.** The sandbox's tests live in another package than the sandbox; the pools' service
   file is also the back-office's view model (1,296 lines); a plan document from September still reads as open work.

Nothing here calls for a rewrite. The plan is seven workstreams, ordered so that the gates land first and everything
after them is measured against a number.

## 2. How the audit was done

- **Static:** line and test counts per package, markers of debt (`any`, casts, `eslint-disable`, `@ts-`, skips,
  `console.*`, environment reads outside the settings), the largest files, the CI workflows, `yarn npm audit` in both
  repositories, the structure of the seeds.
- **Checks:** `yarn typecheck`, `yarn lint` and `yarn test` in `plitzi-sdk-server` (all green, 2026-11-10).
- **Rendered:** the visual suite's own screenshots of 2026-11-09 (122, three widths), and a read-only pass of the
  public pages — 15 pages, desktop 1440 and phone 390, light and dark, 35 loads — drawn with reduced motion so that
  scroll-driven reveals rest at their end, cut in chunks a GPU texture holds. Each load recorded its requests and
  bytes, layout shift, heading outline, control sizes, text sizes and what overflowed. No form was sent and no account
  was used.
- **Read:** the landing's composition and CSS, the sign-in space, the isolate runner, the pools service, the memory of
  past decisions (load rounds, pool sizing, quotas, runtimes).

- **Signed in:** a second pass with the seeded `demo` and `admin` accounts — the console's 13 pages, the account's
  four, the back-office's nine, 62 loads at 1440 and 390 — reading only; each session was ended at the close.
- **Timed:** `authorSpace` on the website's seed (3.1 MB of schema: 1.0 s; its lint 0.22 s), the CLI's start (0.15 s).
- **Run:** the workspace's `yarn test` (20 packages, green), the server's `yarn test:e2e` (771 of 775; G6), the visual
  suite on its own stack (255 of 260; G6) and a load round on it (§ 3.6).
- **Elsewhere:** the dev cluster's public pages as a throttled phone (W34), in WebKit (desktop and iPhone) and in
  Firefox (W33).
- **Design:** every page again on a production build in four modes, with contrast, type and radii measured (§ 3.1.1).
- **Security:** an active pass on the visual stack (§ 3.3.1).
- **Used:** the public pages by keyboard and by click (the hero's studio, the questions, X-ray, the theme, the price of
  a plan), a wrong sign-in, a new project from `plitzi create` through `verify` and `doctor`.
- **Read whole:** the CLI's twelve skill files, the API's 157 routes for the guard each carries, the answer's headers,
  `robots.txt` and the sitemap.

**Not done, and said so:** no real phone; the security pass (§ 3.3.1) is a review with active checks, not a
certificate;
`plitzi-ui` was looked at for its shape and its CI, not read; the builder's code was
not read, only used; the signed-in pages of the dev cluster were not opened. Local figures come from an image that carried a development build of the SDK
(§3.2, P0), so every byte figure below is taken from the published packages instead.

## 3. Findings

Severity: **A** blocks a launch or is a risk today · **B** costs users or the team every day · **C** worth doing.

### 3.1 Website and sign-in (seeds — `plitzi-sdk-server/prisma/seeds/spaces/platform/{website,auth}`)

What works, so it is not undone: the hero hands over a working studio above the fold; the order of the page is an
argument; both themes hold (artwork fixed, content themed); reveals are CSS `animation-timeline: view()` behind
`@supports` and `prefers-reduced-motion`, so nothing depends on a script; every page has one `h1`, a title, a
description, a canonical and a share image; no image lacks `alt`; sign-in is calm and complete (SSO, reset, 2FA).

| # | Sev | Finding | Evidence |
|---|---|---|---|
| W1 | A | Legal pages carry "Draft — this text is being reviewed by our lawyers". A payment provider reviews the site before approving the account | `landing/legal/kit.ts:209`; `/terms`, `/privacy`, `/cookies` |
| W2 | A | No menu on a phone: the bar keeps Docs, the theme, Sign in and Start free; Product, Showcase, Templates and Pricing are reachable only by scrolling | `/` at 390 px |
| W3 | B | Showcase cards on a phone hold 450–550 px of empty space between their chips and "Open it live"; two of five cards are not shown | `sections/showcase.ts:242` — the `lead` variant's `mobile: {}` leaves `gridColumn: span 2` from `desktop` in a one-column grid (a style's `mobile` is laid over `desktop` alone) — to confirm |
| W4 | B | Text and code clipped at the right edge on a phone: the roles table ("…its spaces and its pla"), the functions snippet, the cookie policy's table (third column) | `/` § 03 and § 04, `/cookies` at 390 px |
| W5 | B | The home is 16,741 px on a desktop and 27,747 px on a phone: 13 bands, 1,972 nodes, 140 controls. § 04 is nine stacked cards (~6,000 px); § 01 leaves ~450 px of empty scroll between steps | capture report |
| W6 | B | Controls under 40 px on a side: 104 of 120 on the phone home. Bar links are 32 px tall, footer links 16 px, the terms checkbox 13 px | capture report (`smallTargets`) |
| W7 | B | Text under 12 px: 173 of 664 text nodes on the desktop home, down to 9.5 px, most of it in the product mock-ups | capture report (`tinyText`) |
| W8 | B | The cookie notice covers what the page is for: the plan summary on `/pricing`, the studio on the phone home, half the screen on a phone | `/pricing` 1440, `/` 390 |
| W9 | B | Proof that argues against itself: the GitHub count (6) in the bar, the hero, the questions and the footer; "Most chosen" on a plan nobody has chosen yet | `brand/community.ts`, `sections/pricing.ts:245` |
| W10 | B | Two names for one plan: "Solo" on the home, "Free" on `/pricing` | `sections/pricing.ts:192`, `pricingPage.ts` |
| W11 | B | `/pricing` asks three questions at once — six site plans, capacity packs, four team plans — before a visitor has seen one price in full; its outline jumps `h1` → `h3` | `/pricing` |
| W12 | B | Templates: 4 of the 6 the landing shows and 4 of 13 in the gallery are the Academy's café at four lesson levels — tutorial steps, which have no place in the product's shop window; two have no description; one is described in Spanish on an English page | `/templates` |
| W13 | B | Layout shift: 0.33–0.35 on `/templates`, the same on the dev cluster (good is ≤ 0.1). The home's 0.18 was the local development build's: 0.001 on the cluster (W34) | capture report (`cls`); lab pass |
| W14 | C | Sign-up asks for a username without saying why (an account signs in with it or with its address, and it is to be its handle); the strength line reads "too short" before a key is pressed | `/signup` |
| W15 | C | Sign-in pages have no share image and descriptions of 31–52 characters; `/sso` and `/forgot-password` centre vertically on a phone while `/` and `/signup` start at the top | capture report |
| W16 | C | A page named "Test" (slug `test`, empty) ships in the public website's document | the space document's page list |
| W17 | C | Full-page captures leave everything below the first screens blank (reveals not yet scrolled to), and Chromium paints nothing past 16,384 px: the suite's home screenshot shows half a page; any thumbnail of a space that uses scroll-driven reveals has the same hole | `visual/screenshots/*/website-home-guest*.png` |

The console, the account pages and the back-office (signed in) are the calmest part of the product: one layout, plain
words, a "Needs attention" list that names what to look at, a Pools screen that answers "do we keep up?" in one line.
What they still carry:

| # | Sev | Finding | Evidence |
|---|---|---|---|
| W18 | B | Two marks for one brand: the landing, the sign-in and the account pages wear the stacked-layers mark in white; the console, the back-office and the builder wear a violet comet | any public page beside `/` signed in |
| W19 | B | The console on a phone spends its first 170 px on three rows (mark and workspace, a sideways menu whose third label is cut — "Automa…", search and New space); the cookie notice then covers the middle of every page, signed in | `/` signed in, 390 px |
| W20 | B | Layout shift signed in: 0.18 on the home, 0.53 on `/logs` on a phone, 0.11 on a workspace's page, 0.18–0.51 on the back-office's Pools (6,825 nodes) | signed-in capture report |
| W21 | C | The audit log is one page of 7,068 px (13,745 px on a phone): every line, no pages | `/workspace/:id/audit` |
| W22 | C | The builder opens on a phone as the desktop's, cut at the right edge, with nothing saying it needs a wider screen | `visual/screenshots/mobile/website-builder.png` |
| W23 | C | The back-office's links are in the page of an account that is not staff — hidden, not absent — to confirm against the markup | links read from `demo`'s home |
| W24 | C | The demo account's most visible spaces are its weakest: "Coming Soon Demo" (rainbow letters, "-_Notify me when App is launched_-") is what the builder's own screenshot opens on | `visual/screenshots/desktop/website-builder.png` |
| W25 | C | "Strength: too short" before a key is pressed, again, in the account's password form | `/account/security` |
| W26 | A | The terms carry unfilled placeholders: "[Plitzi's company name, registered address and registration number]", "[the law of the country where Plitzi is established]" | `/terms` § 1 and § 12 |
| W27 | B | No page has a landmark — no `main`, `nav`, `header` or `footer` on the home, `/pricing` or the sign-in — and no skip link. A screen-reader user cannot jump to the content, and a space authored the same way has the same gap | landmark and keyboard pass |
| W28 | B | The sign-in's error ("That email or password was not right.") is drawn outside any live region — the page's one `aria-live` stays empty — and the fields say `autocomplete="on"` and `"off"` where a password manager reads `username`, `current-password` and `new-password`. The fields' focus draws no outline (a border may carry it: to confirm) | the auth space's `/` and `/signup` |
| W29 | B | The website's `robots.txt` turns away the assistants' crawlers and fetchers (`GPTBot`, `ChatGPT-User`, `OAI-SearchBot`, `ClaudeBot`, `anthropic-ai`…): a product whose way in is an agent cannot be read by one. The docs do not block them; neither site has an `llms.txt` | `website/index.ts:406`, `blockAiCrawlers: true` |
| W30 | C | The sitemap lists nine pages: no template's page, no showcase chapter, no `lastmod`. `/.well-known/security.txt` answers 404 | `/sitemap.xml` |
| W31 | C | From "Start free" to a first space: five fields and a checkbox, a confirmation email, then four onboarding steps (each can be skipped) | the suite's `auth-*` screenshots |
| W32 | C | A builder that cannot read its space draws the words "Authentication required" on an empty page, with no way back and no link to sign in | the running image, whose credential predates today's key-pair fix |
| W33 | A | On the dev cluster the home throws React's hydration error (#418) in Chromium and WebKit, and the browser refuses a script the page never asked for: the edge's email obfuscation rewrites every address in the HTML (five in `/terms`) and injects `email-decode.min.js`, which the page's script policy blocks. The page is then drawn again in the browser | `https://dev.plitzi.com/`, console; `/terms` HTML holds `__cf_email__` |
| W34 | B | As a mid-range phone on slow 4G (CPU ×4, 1.6 Mbps), on the dev cluster: `/terms` reaches its largest paint at 12.1 s and `/templates` at 12.6 s (first byte 3.8 s, shift 0.33); the home at 2.4 s with 369 ms blocked; `/pricing` and the sign-up under 1.7 s. The home's shift there is 0.001 — the 0.18 of W13 was the local development build's | lab pass, 2026-11-10 |
| W35 | B | The ten account emails are fragments — an `h1` and paragraphs, no layout, no mark, no footer, no plain-text part, no language — written inside the Brevo provider, so another provider or a self-hoster has none of them. Their subjects mix cases ("Password Reset Request", "Validate your account"); the welcome says "You can now start creating amazing websites!" | `src/services/api/email/BrevoProvider.ts:72`, `index.ts` |
| W36 | A | The builder's top bar needs 1,564 px: at 1440 **Snapshot** and **Publish** are past the window's right edge, at 1280 **Export** and the theme switch too, and the page does not scroll to them. Whole only from 1728 | the builder at 1280, 1440 and 1728, visual stack |
| W37 | B | A click on the builder's rail adds its panel as a closed strip at the foot of the column while **Elements** stays open above: after five clicks there are five strips and nothing of what was asked for on screen. The rail's eleven buttons are icons with no words; the dev-tools launcher sits over the last strip's title | the rail, clicked top to bottom |
| W38 | C | In the builder: classes are shown as `container-2f16`; the style note reads "Keep on mind"; the server panel's empty state is cut at the right edge | inspector, Settings → General, Actions |
| W39 | C | The docs' CLI reference is one page of 28,933 px and the authoring errors one of 24,363 px (3,085 and 2,518 nodes). On a phone the docs' bar cuts its last control; "Sign in" wraps to two lines | `docs.plitzi.local/reference/cli`, `/reference/authoring-errors` |
| W40 | C | Ceniza is in Spanish and says `lang="en"`. Showcase spaces weigh 1.9–3.4 MB a first visit (Inkwell 3.1–3.4 MB) | the showcase's own hosts |
| W41 | C | The clearest sentence about the product is the docs' first paragraph — "a platform for building websites and web apps. You make them in a visual builder, ask an AI agent for them, or write them as code — and you choose where they run" — and the home never says it that plainly | `docs.plitzi.local/` beside `/` |
| W42 | C | An account's sessions only go when they expire: the seeded demo account holds 605 across five devices. Development's database still holds one probe account from September (`probe…@example.com`, unconfirmed) and its workspace | `/account/devices`; **Back-office → Accounts** |

### 3.1.1 Design review: what represents Plitzi

Every public page, the console's fourteen, the account's and the back-office's were drawn again on a production build
in four modes — 1440 and 390, light and dark — with the cookie choice made, and measured: the contrast of every text
against what is behind it (WCAG AA: 4.5:1, 3:1 for large), the sizes of type, the radii, the colours.

**What is good, and should set the standard for the rest.** The showcase page is the best piece of design the product
has: one idea (six live sites, fanned as phones), a headline with weight, a tint per chapter, the same composition in
both themes. The pricing page is clear and identical in light and dark. The console is calm: one layout, one card, one
way to say a number. Dark mode is real everywhere — no page falls back to light, no artwork flips. The sign-in pages
are the cleanest screens in the product.

**What is systemic.** These are not page bugs; they are the absence of a scale, and they are why the home feels busier
than the console though both come from one brand.

| # | Sev | Finding | Evidence |
|---|---|---|---|
| DS1 | B | No type scale. The home sets text in 30 sizes (12.5 px ×119, 12 ×87, 11 ×81, 14 ×71, 15, 11.5, 14.5, 13.5, 10.5, 13, 17, 19…), the console's home in 17, down to 8 px. Half-pixel sizes are steps nobody chose | design pass, `sizes` |
| DS2 | B | No radius scale. Sixteen radii on the home — 6, 7, 8, 9, 10, 12, 18 px and the pill — eleven in the console (4, 6, 7, 8, 10, 14, pill written as 999 and as 9999) | design pass, `radii` |
| DS3 | B | Three tokens fail AA wherever they are text. The success green (`#12a150`) on a light ground: 3.0–3.4 ("Live", "Online", "Active", "+11 %": 25 on the back-office's Spaces, 17 on the console's home). The brand violet (`#6e52f7`) as text on a dark ground: 3.6–4.0 (links, "Open it live", every address in `/terms`). The muted grey (`#6b7280`): 4.44 on the light ground, 3.9 on the dark — form labels, the roles' list. Beside them a raw red asterisk (`#ff0000`, 3.67) and the hero's code (3.21, 42 lines). The suite holds text to 3:1, so none of it is caught | design pass, `worst` |
| DS4 | B | Monospace is 41 % of the home's text (262 of 631 text nodes): labels, kickers, chips, captions and every mock-up. It reads as a developer tool to the marketing person the headline is written for | design pass, `families` |
| DS5 | C | Three headline treatments for one brand: white with lilac on the home, a violet-pink-green gradient on the showcase, plain on pricing and templates. And 41–45 text colours on the home | the three pages side by side |
| DS6 | B | A template's card shows the top of its page at a size nothing can be read at: four of thirteen are the same near-empty beige rectangle (the café's four levels), two more are white. The gallery is the product's shop window. The space's own page crops its picture mid-sentence | `/templates`, a space's Overview |
| DS7 | C | On a phone the console's Traffic and Needs-attention cards run edge to edge while the cards above keep their margins. The roles page lists its permissions as native checkboxes with grey bold labels (3.9:1) that read as disabled, under a title 60 px away from its first line | console at 390; `/workspace/:id/roles` dark |
| DS8 | C | 18–30 controls on every public page are under 24 px on a side — the minimum WCAG 2.2 AA asks (2.5.8), below the 44 px of § 5 | design pass, `under24` |

**By surface.**

- **Home.** Its art is the dark violet ground with the lit grid, and it is strong. Its weakness is density: thirteen
  bands, each with a kicker, a two-tone headline, a paragraph and a mock-up, in the same rhythm — nothing is larger than
  anything else after the hero, so nothing is remembered. Cut to seven (§ 4, D3), let one band be an image and nothing
  else, and say the docs' first sentence (W41) under the headline.
- **Pricing, templates, showcase.** Pricing: sound. Templates: a designed cover per template (DS6), the café once.
  Showcase: keep; its headline's gradient is the one flourish worth making the brand's (DS5).
- **Sign-in, account.** Keep. The brand panel's mock-up is the home's density again in miniature (27 text nodes under
  12 px); a single sentence and the mark would say more.
- **Console and back-office.** Keep the calm. Fix what the scale fixes (DS1–DS3), the phone's gutters and header (W19,
  DS7), and give the empty first run a picture — today a new account's home is a grid of placeholders.
- **Builder.** Not a design finding first: W36 (Publish out of the window) and W37 (the rail) come before any polish.

### 3.1.2 The widths between a phone and a laptop

The first passes drew 1440 and 390, and the suite draws 1440, 900 and 390. Nothing looked at what lies between — an
iPad either way up, a laptop window at half the screen, a 13-inch at 1280. A sweep of 16 pages at 768, 834, 900, 1024,
1100, 1180 and 1280 (the public ones on the dev cluster, the console signed in) found the range where the site is
neither of its two designs.

| # | Sev | Finding | Evidence |
|---|---|---|---|
| RS1 | A | The public bar needs 1,069 px and folds only under ~834. Between them its right end is outside the window, on every public page: at 1024 **Start free** — the page's one call to action — is cut after "Start"; at 900 **Sign in** is gone too; at 834 so are Discord and the theme switch. There is no sideways scroll to reach them | sweep: `CUT Start free (right 1069)` at 1024 on `/`, `/pricing`, `/templates`, `/showcase`, `/terms` |
| RS2 | B | At 1024 the pages wear the phone's layout pulled wide. The hero is one column with its right half empty; `/pricing` drops its two columns, so the plans are rows 830 px wide and the summary of what was chosen moves to the foot of the page; the showcase is one card to a row | `/` and `/pricing` at 1024 |
| RS3 | B | `/pricing`'s sticky bar ("Free · €0 / month") lies over the plan rows as they pass: at 1024 and on a phone the name of the row under it cannot be read | `/pricing` at 1024 and 390 |
| RS4 | B | "X-ray this page" is drawn twice at 1024: in the hero's row, and floating over the studio's Design / Code / Agent tabs | `/` at 1024 |
| RS5 | C | The console's bar loses the theme switch and the account between 834 and 928 (fine from 1024). Its run lines are cut harder at 1100–1280 (179–359 px of the 390 they need) than at 1024, where the layout changes: the column does not grow with the window | sweep: console's space page at 834 and 900; `/automations` |
| RS6 | C | The showcase's first and last "read how it is built" links are cut from 834 to 1180 | `/showcase` |

The sign-in, the sign-up and the docs were clean at all seven widths.

### 3.1.3 Past the faults: what would make each surface better

Not defects — what separates a site that works from one that represents the product. By surface, in the order of what
each would move.

| Surface | Design and art | UI and UX | Content and marketing | SEO |
|---|---|---|---|---|
| **Landing** | One visual idea carried through: the lit grid and the fan of phones are the brand's; six of the bands show a UI mock-up in the same frame, and the eye stops telling them apart. Alternate mock-ups with a full-bleed picture of a real site and one drawn diagram ("one document, three ways in"). An icon set of the brand's own as a sprite (it is also 232 KB less: P3) | Fold the bar by what fits, not by a width (RS1). The hero's studio is the best idea on the page — say what to do with it in one line and reward the first change ("you just changed a live page"). A second, quieter call to action for who is not ready: watch 90 seconds, or leave an address | Say who it is for in the first screen (studios and agencies that keep other people's sites), and say what it is in the docs' own sentence (W41). Proof that exists: sites live, the licence, the open repository — and, as the beta gives them, two studios in their own words. A page per reader (agencies, developers, marketing) and honest comparisons (Webflow, Framer, WordPress with a page builder, a headless CMS) | `FAQPage` data for the questions; a share image per page; the pages above are each a search someone makes |
| **Pricing** | Sound | Three plans first (D6); the sticky summary clear of what it summarises (RS3) | One line against what a site costs elsewhere (X7); what happens at the limit, said before it is asked | `Product` and `Offer` data per plan |
| **Templates and showcase** | A cover per template (T2.26); the showcase's fan is the model | Filter by what the site does, preview at three widths before signing up, "use this" straight into a new space | Tutorial levels out of the shop window (W12); each template says who it is for and what is already wired (forms, bookings, sign-in) | Each template and each showcase chapter in the sitemap with `lastmod`, its own title and picture, `ItemList` data — "restaurant website template" is a search |
| **Console** | Covers for spaces; one empty state that draws what will be there | A first run that walks to the first publish, the steps ticking as they are done; names renamed in place; several spaces acted on at once; what needs attention as a count on the bar; every table sorted and paged the same way; loading drawn at its final size (W20) | Plain words stay; a line under each figure saying what moves it | Not indexed, rightly |
| **Docs** | Sound; the two long references in parts (T2.22) | "Copy as Markdown" and "open in my assistant" on every page — the readers are agents as often as people; "was this useful" with one field; an "edit this page" link (the repository is open); what people searched and did not find, kept | A part for whoever builds in the builder and never opens the code: today the Academy teaches it and no reference holds it. The REST and MCP surfaces as generated references | Descriptions of 140–160 characters (78–89 today), the large share card, `BreadcrumbList` and `TechArticle` data, `lastmod`, `llms.txt` (T2.18) |

### 3.2 Page weight (the platform's — `apps/sdk`, `apps/server`, and every space)

Measured on `/terms`, whose own content is 9 KB of document. Sizes of the published 0.39.3 packages.

| What the browser asks for | Raw | Compressed | Needed by this page |
|---|---|---|---|
| `plitzi-sdk.js` | 948 KB | ~310 KB gzip | a fraction: headings, paragraphs, links, a list |
| `plitzi-sdk-vendor.js` | 221 KB | 69 KB gzip | yes (React) |
| The space document `/_plitzi/space/<hash>.json` | 2,720 KB | 183 KB br | 9 KB of it |
| Font Awesome solid + brands (`.woff2`) | 232 KB | 232 KB | a dozen glyphs |
| Geist + Geist Mono | 52 KB | 52 KB | yes |
| The space's stylesheet | — | 45 KB br | part |
| The HTML | 104 KB (62 KB of it inline style) | 20 KB br | yes |

| # | Sev | Finding | Evidence |
|---|---|---|---|
| P0 | B | `yarn docker:up` built its image from a development build of the SDK and said nothing: `plitzi-sdk.js` was 2,474 KB unminified (566 KB br) in a container run as production | `plitzi-ssr` container, `node_modules/@plitzi/plitzi-sdk/dist`; `scripts/docker-workspace.ts` copies whatever `dist` the portal holds |
| P1 | A | One document for the whole space. The website's is 4,370 elements over 30 pages; the pricing page is 691 KB of it, the guest home 525 KB, a space's console page 299 KB. A visitor of any public page downloads all of it, the signed-in pages' structure included | `/_plitzi/space/…json`; `apps/server/src/modules/ssr/spaceDocument.ts` |
| P2 | A | One SDK bundle for every element: a page of text pays for charts, forms, tabs, lists and the rest | `apps/sdk/dist/plitzi-sdk.js` |
| P3 | B | Two whole icon fonts for the icons a space uses | `sdk-assets/webfonts/fa-solid-900.woff2`, `fa-brands-400.woff2` |
| P4 | B | 62 KB of inline style in a page that also links the space's stylesheet | `/terms` HTML |
| P5 | B | Nothing holds a page to a size or a shift: `screens.spec.ts` ratchets wasted renders, not bytes | `plitzi-sdk-server/visual/screens.spec.ts` |

### 3.3 Gates and dependencies

| # | Sev | Finding | Evidence |
|---|---|---|---|
| G1 | A | `xmldom@0.6.0` (unscoped, abandoned): 1 critical and 12 high advisories. It parses HTML that users bring in | `yarn npm audit` in `plitzi-sdk-server`; `src/services/transformers/helpers/HtmlParser/HtmlParser.ts` |
| G2 | A | `handlebars` ≤ 4.7.9 through `hbs`: 2 critical advisories | `src/services/deployment/helpers/HandlebarsWrapper.ts` |
| G3 | B | `body-parser` < 2.4 (high) in both repositories; `zod` (high) and `launch-editor` (high) in the workspace's tree | `yarn npm audit` |
| G4 | A | Neither CI audits dependencies | `.github/workflows/*.yml` |
| G5 | A | The server's CI runs lint, types and unit tests. The 85 e2e files and the visual suite — the only ones that saw the sign-in loop of September — run on a laptop | `plitzi-sdk-server/.github/workflows/deployment.yml`; already agreed as block 3 of the CI plan, not started |
| G6 | B | Tests that fail in a full run and pass alone: 4 of 775 e2e, all in `test/e2e/resilience/job-queue.e2e.test.ts` (alone: 12 of 12), and 3 of 260 visual — the account's wrong-password message, Inkwell's Studio, a Pizarra tracker (alone: 3 of 3). They are sensitive to what else the machine is doing, which is what a CI runner is | `yarn test:e2e` and `yarn visual`, 2026-11-10, each beside other work |
| G7 | C | 10 of the API's 157 routes (account, devices, profile) check `req.user` by hand instead of naming a guard. The rest carry one (134), are covered by their mount, a secret or a signature, or are public on purpose. No hole was found; nothing would catch the next route written without one | `src/services/api`, route by route |
| G8 | C | A project made by `plitzi create` installs with "10 moderate severity vulnerabilities" as its first words (`minimatch` among them) | first-run trial |
| G9 | C | `plitzi-ui` (25k lines, 50 components, 38 test files) has one workflow, the publish, whose install is not frozen (`yarn install # --frozen-lockfile`) | `plitzi-ui/.github/workflows/npm-publish.yml` |

### 3.3.1 Security pass (active, on the visual stack, with the maintainer's leave)

Asked of the running platform, as nobody, as an account outside the workspace (`academy`) and as a member (`elena`):
152 reads and 140 writes over the API's 153 routes, forged session tokens, redirects, GraphQL, the MCP, paths that
climb, markup stored and shown to others, and the outbound guard's addresses in process.

**Held:** every read and write of another workspace's was refused (two reads answered 200 with the caller's own, empty
lists); a member could not change, delete or audit the workspace nor reach the back-office (404); the profile takes no
role or staff field; a token with `alg: none`, a changed payload or an HS256 signature is refused (sessions are ES256
with a key id); a signed-out token is refused; sign-in and forgot-password say the same for a known and an unknown
account; seven redirect targets all ended at the platform's own page; introspection and batching are off; the MCP asks
for a token; no path climbed out; an odd query answered no stack; a 2 MB body is 413; the session cookies are
`HttpOnly; Secure; SameSite=Lax`; markup in a workspace's name is shown as text in the console and the back-office and
a template in it is not evaluated; mail escapes what it interpolates; the outbound guard refused every literal and
every name resolving to a private address (decimal, hex, octal, mapped IPv6, userinfo, full-width digits).

| # | Sev | Finding | Evidence |
|---|---|---|---|
| S1 | B | The kernel says a CSRF token is "demanded whenever a session cookie is present". The API does not ask for it: `PATCH /profile` with the session cookie and no token, a wrong token, or no CSRF cookie at all reaches its handler. What stands between a foreign page and a write is the origin check (a space's own origin on the same site is refused, 403) and `SameSite=Lax` | `tmp/audit/csrf.mjs`: nine cases |
| S2 | B | Sign-in is throttled by the username alone, ten tries in five minutes, counted in each replica's memory. A stranger who knows a username keeps its owner out — after ten wrong passwords the right one answers 429 — and one password tried over many usernames from one address is never slowed | `core/auth/throttle.ts`; `session.ts:78` |
| S3 | C | The API answers any `Origin` — `https://evil.example`, `null` — with itself in `Access-Control-Allow-Origin` (no credentials header, so a cookie's answer is not readable; it is `*` by another name) | `GET /profile` with three origins |
| S4 | C | GraphQL takes a query of 3,000 aliases: no limit on depth, aliases or cost | `server.plitzi.local` |
| S5 | C | A workspace's name takes any text of any shape (`"><img …><script>…`). Nothing runs it; it travels into every list, mail and log | `PATCH /workspaces/:id` |
| S6 | C | A space id past the integer's range answers 500 ("Internal server error") where every other odd id answers 404 | `GET /spaces/99999999999999999999` |

**A second pass, on reaching up.** Four ordinary accounts — a member, a billing role, a workspace admin, an outsider —
against the back-office and against a higher role: each of the back-office's 10 routes, read and written (404); its
pages (404, none of its words in the answer); 60 writes on another's workspace and space with a body asking for
everything (`role: owner`, `permissions: [adminManage]`, `isStaff`…) — the only ones that went through were a member
removing *itself*; a workspace admin trying to make itself owner, demote or remove the owner, mint a role with a
platform permission, change the plan or delete the workspace (all refused, each in words that name the rule); another
account's session ended by its id; a body reaching for the prototype; the id said twice; method-override and forwarded
headers; the published page's public key used as a bearer on the API (401 each); 25 reports from one address (5 taken,
then 429). Nothing reached up. What it confirmed instead is W23: an ordinary account's home carries ten back-office
addresses in its markup.

With R10 (rebinding) and G1–G2 (the two packages), these are what a review found. It is not a certificate: no fuzzing,
no review of the cluster's network policy, nothing against the payment providers' sandboxes.

### 3.4 Code quality and what is half-moved

Counts, tests excluded unless said: workspace ~370k lines, 21 packages; server ~66k lines of `src`, 211k lines of seeds.

| # | Sev | Finding | Evidence |
|---|---|---|---|
| Q1 | B | The sandbox's tests are not where the sandbox is. `sdk-runtime` (3,609 lines) holds 458 lines of tests; `runner/guest/fetch.ts`, `guest/crypto.ts`, `service.ts` and `driver.ts` have none beside them. The isolate suite stayed in `sdk-actions/src/functions/isolate*.test.ts` | both packages |
| Q2 | B | `runner/isolate.ts`'s `session` is one closure of ~400 lines and some 25 `let`s: CPU, wall, waits, lateness, turns and stops accounted in the same scope. Each rule is commented and none can be tested without an isolate | `packages/sdk-runtime/src/runner/isolate.ts:375` |
| Q3 | B | `services/pools/index.ts` (1,296 lines) is the pools' service and the back-office screen's view model at once (`ScreenPool`, `ScreenRow`, labels, gauge levels, a 315-line `poolsReport`) | `plitzi-sdk-server/src/services/pools/index.ts` |
| Q4 | C | `config/settings.ts` is 1,267 lines; 13 reads of `process.env` bypass it (email sender and API key, `MAX_TRACKED_PATHS`, `NODE_ENV` in four files) | `grep process.env src` outside `config/` |
| Q5 | C | 90 `console.*` in the server's `src`: lines the per-process log (its last 1,000 lines, **Back-office → Pools → Logs**) never keeps | `src/services/{ServerHelpers,realTimeWS,redis,mongo,gateway,…}` |
| Q6 | B | Builder modules with no test: Connectors (1,740 lines), Actions (1,176), Fonts (891), Elements (460), Transformers (449), Variables (396), Visitors (301). The builder is 48k lines to 84 test files | `apps/builder/src/modules` |
| Q7 | C | Thin tests elsewhere: `sdk-variables` (1,375 lines, 1 test), `sdk-plugins` (none), `sdk-dev-tools` (12.8k lines, 24), `sdk-style` (16k, 22) | per-package counts |
| Q8 | C | 196 `eslint-disable` in the workspace: 57 are `react-refresh/only-export-components` written file by file, 21 `no-unsafe-return`, 16 `exhaustive-deps`. 73 `any` outside tests (CLI 15, authoring 14, shared 13) | grep |
| Q9 | C | Documents that read as plans for work that shipped or moved: `plitzi-sdk-server/docs/agent-workflow-improvements.md` (2026-09-12; its check names exist nowhere), RFC 0032 with phases done and one left | both files |
| Q10 | C | The server's unit run spends 65 % of its time importing: 2,466 modules evaluated 19,779 times | `yarn test` summary |
| Q11 | C | Half of `apps/cli` is the multi-agent harness: 52k of 99k lines (`src/runs`, `src/commands/runs`), in one 3.7 MB bundle every command parses (start is 0.15 s with V8's compile cache) | `apps/cli/src`, `dist/index.js` |
| Q12 | C | Seeds are three times the server: showcase 110k lines, platform 79k, demos 20k. They type-check and lint with the server on every change | `prisma/seeds/spaces` |

### 3.4.1 nexus (the store everything runs on)

Read: the core (`createStore`, the write path, the trie, the subscribers), the caches, persistence, history, async, the
path types, the React binding, the CI. 6,052 lines, 56 test files, green in 4.8 s. It is the most finished code of the
five repositories: bounded caches, a writer with a fallback for pages that forbid code generation, subscribers that
survive an unsubscribe mid-notification, listeners isolated from each other's errors, a prototype key refused, contexts
shared between copies. The improvements are few and specific.

**The rule over all of them: none may cost the store speed.** nexus is the hot path of every page, the builder and the
dev tools. Each task below is written so that the path that runs today runs the same instructions after — the new work
sits on a miss, on an option, or in the type checker — and each is held to the repository's benchmark (`website`,
`npm run bench`), every case, before and after, on the same machine: a case slower than its own noise means the change
is redesigned or dropped, never merged with a reason. The benchmark as a CI gate (T3.12) lands first, so the others are
measured by it and not by a hand.

| # | Sev | Finding | Evidence |
|---|---|---|---|
| N1 | B | `PathOf` recurses as deep as the state goes — only a cycle stops it. For a deep state it is a union of every path at every depth, and every `setState`, `getPath` and `subscribePath` checks against it. The workspace's type-check needs 8 GB of heap | `src/types/StoreTypes.ts:10` |
| N2 | C | The path caches fill and stop: `parsePath` and `getByPath` keep their first 4,096 paths and never let one go, so in a builder with thousands of element ids every path met after that is parsed on every read while cold ones hold the room. The writer's cache (256) drops the oldest written, not the least used | `helpers/parsePath.ts`, `helpers/getByPath.ts`, `createStore/helpers/writeByPath.ts:120` |
| N3 | C | `persistMiddleware` serialises and writes the whole persisted state on every change, at once: a burst of writes (typing, a drag) is a burst of `JSON.stringify` and `setItem` on the main thread | `middleware/persistMiddleware.ts:109` |
| N4 | C | `createAsync` lets the latest call win by ignoring an older answer. The older request is never told: no `AbortSignal` reaches the fetcher, two identical calls in flight are two requests | `async/createAsync.ts` |
| N5 | C | The benchmark the rules ask for before and after any change to `createStore/` is run by hand; nothing in CI holds a number, nor the bundle's size | `AGENTS.md` § Rules; `.github/workflows/ci.yml` |
| N6 | C | Every test file starts a jsdom (56 of them, 75 % of the run's time) though the core is framework-free | `yarn test` summary |
| N7 | C | `docs/agnostic-core-migration.md` says "Status: Implemented": a plan that shipped, still read as a plan | the file's header |

### 3.5 Authoring, MCP and CLI

The loop that improves them exists and is good: one linter with four consumers, refusals that name the fix, runs that
report what of Plitzi was in the way (`docs/en/improving-the-cli.md`), a `bench` package. What is missing is a number
that says whether last week's changes made an agent more or less likely to finish.

| # | Sev | Finding |
|---|---|---|
| A1 | B | No standing score of agent work: the same tasks, run on a schedule, with their success, calls, tokens and time kept beside the commit |
| A2 | B | No test enumerates the refusals of the three surfaces and holds each to a code and a fix. `silentCases.test.ts` does it for authoring |
| A3 | B | No stated contract for versions out of step — a CLI or an agent's MCP session older than the server it writes to |
| A4 | C | No budget per MCP tool on the size of what it answers for a fixture space, the way `wasted` is ratcheted for renders |
| A5 | C | Whether a write retried after a timeout applies twice is not pinned by a test (`space push` has its digest and 409s; `plitzi_apply` to be checked) |
| A6 | B | A space is written in three vocabularies: the builder's mutations, the MCP's own shapes (`AI*` types, ~50 operations) and authoring's `SpaceSpec` (~250 codes). One linter judges all three, but an agent that learned one has not learned the others, and each new capability is written three times |
| A7 | C | The multi-agent harness is most of what the CLI says: 48 `run` and `task` commands against ~35 for everything else; `plitzi run --help` is 10 KB. An agent working alone reads past all of it |
| A8 | B | The lead of a run reads ~38 KB of skill — `runs.md` 13 KB, `runs-lead.md` 19.5 KB (past the 3,500 tokens the skills hold a reference to), `runs-plan.md` 4.5 KB — and rereads it every turn. Most of `runs-lead.md` is what went wrong once ("Where leads went wrong", 27 entries): each true, none ranked, many already enforced by a refusal or said by `--dry-run` |
| A9 | B | The run skills are written as compressed prose: one bullet of `runs.md` ("Any other file") holds six commands and five conditions. The run's own words — card, line, stage, copy, look, brake, hold, step — are defined nowhere in one place |
| A10 | C | `plitzi-cli`'s description is 1,221 characters, past the 1,024 the skills format allows: a harness may cut or refuse it. `plugins.md` names a command that no longer exists (`add plugin <name>`; it is `plugin add`), and no test holds a skill's commands to the CLI's |
| A11 | C | `plitzi verify` on a new project fails its last check until a server is started by hand. It says so and how, but the skill's "leave it passing" reads as one command |

### 3.6 Server work: actions, functions, runtimes

What works, so it is not undone: one isolate per invocation with its own limits; admission by memory and CPU; a fair
share per space; quotas as a paywall and never as a silent drop; three queue backends under one contract test; the
load rounds that drove all of it.

| # | Sev | Finding |
|---|---|---|
| R1 | A | No adversarial suite owns the sandbox: what a guest must not reach is asserted by functional tests in another package (Q1) |
| R2 | B | The load probe that decided the scheduling lives in a git-ignored `tmp/load/`. Its estimate, its band (103–150 %) and its baseline are in nobody's repository — and it has drifted: the round of 2026-11-10 (1,000 actions in 240 s, 139 % of the estimate; 1,050 calls answered; nothing lost, no worker down) could not run its limit cases, whose actions its set-up no longer makes (40 jobs "the action this job belongs to no longer exists", 8 calls 404). Under that load a 200 ms call answered in 5.8 s at the median and 8.6 s at p95 |
| R3 | B | Runners have no contract test. `createIsolateRunner`, `createRemoteRunner` and a runtime's native runner are held together by the engine's tests; a request/response runner (a function service of a cloud) would have nothing to pass. `ctx` calls assume the runner's socket |
| R4 | B | Run records are written in bursts and a failed write logs how many it lost. Nothing retries, and nobody who owns the space is told |
| R5 | B | Open since September: with two page-server replicas and no affinity, realtime over SSE answered 401 on the other replica. To confirm closed, with a test in the split topology |
| R6 | C | What the owner of a space sees when work is set aside (quota, size, a runner that never had room) is in the console's pages; whether they are told without opening them is to be checked |
| R7 | C | Which part of `services/pools` (8,004 lines in the hosted platform) a self-hoster needs — the decision engine, the local supervisor — against what RFC 0032 § 7 moved into the packages |
| R8 | B | A run crosses four processes — the page server, a worker, a runner, sometimes a runtime — and no standard trace follows it: there is a request id and a run's outline, each read in its own screen |
| R9 | B | Q2's shape is the engine's too: `runAction` is one function of ~450 lines and `createJobWorker` one closure of ~700. They are the three places a scheduling or metering rule is hardest to change |
| R10 | A | The outbound guard judges the addresses a name resolves to and then lets the transport resolve it again: DNS rebinding is open, and the file says so ("closed only by resolving and connecting to the same address, and that belongs in the transport"). A space's own code, a connector or an `http.request` step reaches hosts its author names — whose DNS is theirs | `packages/sdk-kernel/src/outbound/outboundGuard.ts:139` |

### 3.6.1 plitzi-platform (the dev cluster's repository)

Read: its rules, the production-readiness record, the databases and their backups, the network policies, monitoring,
the old Terraform stack. It says what it lacks better than an audit could — backups on the node they protect, one node,
no disruption budgets, a build's page hydrated by another during a rollout — and it holds no secret or state in git.
The functions runner is given no egress at all, which is the right default. What the record does not say:

| # | Sev | Finding | Evidence |
|---|---|---|---|
| PL1 | A (before customers) | The backups' other half is still a recommendation: nightly dumps of MySQL and Mongo, kept seven days, on a volume of the same single node. And no restore has a date on it | `gitops/databases/*/backup-cronjob.yaml`, `docs/04-backup-restore.md` § Offsite |
| PL2 | B | Nothing tells a person. Alertmanager is installed with no receiver, and the only alert rules (9) are the logging charts' own: none on a failed backup, a full disk, a certificate, a pool that does not keep up or a queue that waits — the figures the back-office's Pools draws | `gitops/infrastructure/monitoring/kustomization.yaml:124` |
| PL3 | B | With R10 open, the door that matters is the worker's: it makes the requests a space's steps author, its egress is open, and it shares a namespace with MySQL, Mongo and Redis | `gitops/infrastructure/platform/networkpolicy.yaml` |
| PL4 | C | The cluster's Mongo is 7.0; a laptop's is 8.0 (and the backup job's image is 8.0). Third-party images are pinned by tag, not by digest | `gitops/databases/mongodb/statefulset.yaml:21` |
| PL5 | C | `terraform/` is the previous AWS stack, "not what runs today", with two state files on disk beside it (ignored by git) | `terraform/` |

### 3.7 Product

| # | Sev | Finding |
|---|---|---|
| X1 | A | A page built on Plitzi starts ~0.9 MB behind a hand-written one. For a product whose customers build sites for others, this is the first thing a prospect's Lighthouse run says |
| X2 | B | Activation is defined (published to a working address and edited again within 7 days) and not shown anywhere as a funnel |
| X3 | B | Pricing is right in its model (free to build, pay to go live) and heavy in its telling: ten plans and packs on one screen |
| X4 | B | What a buyer checks before paying is missing: final legal text, a status page, a changelog, a security page and `security.txt` |
| X5 | C | The page's own analytics could say what a customer's pages weigh and how they shift: the platform serves every page and already meters it |
| X6 | C | The wedge is the agent inside the customer's own assistant; `AI_ENABLED` is off by default. Open since August |
| X7 | C | Against what a site costs elsewhere (third-party figures of November 2026, not checked on the vendors' pages: about $10–30 a site at one builder, $15–25 at another, $49 an editor at a third), Site at €19 with VAT is inside the range and App at €39 is the only one with server code, visitors and staging in the price. The page never draws that comparison |

## 4. Decisions

Answered by the maintainer on 2026-11-10. Where the answer was "what is best", the choice made and its reason are
written here so it can be overruled in one line.

| # | Question | Decided |
|---|---|---|
| D1 | May a page's part of the space document be fetched on navigation? | **Yes, with three conditions.** A page brings its **layouts**, which are parts of their own (several pages share one). **Rendering with the SDK alone, as a single-page app with no page server, must not change at all** — it keeps receiving the document as it does today. And **navigation must not get worse where there is a page server either**: no wait a visitor can see that is not there today |
| D2 | Does a visitor who is not signed in receive the signed-in pages' structure? | **No** |
| D3 | The home's length on a phone: cut bands, or fold them? | **Fold. No content is lost**, and it must still look good and work — a fold that reads as a compromise is not done |
| D4 | The GitHub count and "Most chosen" | **Yes:** the count hidden under a threshold (250); the badge reads "Recommended" until there is data |
| D5 | "Solo" or "Free" | Left to what markets best → **"Free"**. The page's promise is "Build free. Pay when it goes live", and a visitor scanning prices looks for that word; "Solo" also reads as a limit on people, which belongs to the team axis ("Just me"). Its line stays "Free, for good" |
| D6 | How `/pricing` opens | Left to what serves the visitor → **three plans in full first** (Free, Site, App), the rest one click away, the configurator below. A first-time visitor should read one price in full before being asked three questions |
| D7 | Sign-up without a username | **No — the username stays.** An account signs in with either its address or its username, and usernames are meant to become handles (`@username`). The form says why it asks |
| D8 | Seeds of the showcase in a package of their own | Measure first (T3.9); decided on the figure |
| D9 | `AI_ENABLED` by default | Outside this RFC; listed so it is not forgotten |
| D10 | `blockAiCrawlers` on the platform's own website | **Off for Plitzi's website.** And for every space it becomes a real choice: **the space's owner decides what to block**, by kind, not one switch |
| D11 | Which mark is the brand's (two are in use) | **The home's** — the stacked layers. The console, the back-office and the builder take it |
| D12 | The CSRF token the API does not ask for | Left to judgement → **the API asks for it** on every write carried by a session cookie. It is the rule the kernel already states; the origin check stays as the second lock; and a deployment that sets `SameSite=None` — a space embedded in another site — has only the token. A request with a bearer is exempt, as the kernel says |

## 5. Targets

A task is done against one of these, and each becomes a test that ratchets: lowered when beaten, never raised.

| Target | Today | After |
|---|---|---|
| JavaScript for a page of text (compressed) | ~380 KB | ≤ 150 KB |
| Space document for a public page of the website (compressed) | 183 KB | ≤ 25 KB + the page's own |
| Icon bytes for a page | 232 KB | ≤ 15 KB |
| Layout shift, every key screen | 0.18 / 0.35 | ≤ 0.1 |
| Home height at 390 px | 27,747 px | ≤ 16,000 px |
| Controls outside the window, 768 to 1280 px | **Start free** cut from 834 to 1068 | none, at seven widths |
| Controls under 44 px on a phone (links inside a paragraph apart) | 104 of 120 | 0 |
| Text under 12 px outside `aria-hidden` artwork | 173 nodes | 0 |
| Critical or high advisories in either repository | 19 | 0, held by CI |
| Server CI | lint, types, unit | + e2e, + visual `@smoke` |

## 6. Work

**Each row below is a summary. The instruction is the task's brief**, in
[`0033-audit-and-hardening/`](0033-audit-and-hardening/): what to read first, the steps in order, what not to do, the
commands that verify it, when it is done and when to stop and ask — one file per workstream, and
[`00-how-to-work.md`](0033-audit-and-hardening/00-how-to-work.md) for what holds for all of them. An agent works from
the brief, never from the row alone.

Each task: where, the steps, and when it is done. **Step 0 of every task is to read the files named and say what is
already there** — several findings end in "to confirm", and a task whose finding is already covered ends with a line
saying so, not with code. Sizes: **S** hours, **M** a day or two, **L** a week.

### WS0 — Gates (first; everything after is measured through them)

| Task | Where | Steps | Done when | Size |
|---|---|---|---|---|
| **T0.1** `xmldom` out | `plitzi-sdk-server` `src/services/transformers/helpers/HtmlParser` | Replace with `@xmldom/xmldom` (same API) or the parser the transformers already use elsewhere; add a test with the advisories' shapes (deep nesting, repeated attributes, malformed recovery) bounded in time and memory | `yarn npm audit` names no `xmldom`; `yarn vitest run src/services/transformers` green | S |
| **T0.2** `handlebars` out or current | `src/services/deployment/helpers/HandlebarsWrapper.ts` | Read what the templates need. If it is substitution of known fields, write it without a template engine; else move to a release with no advisory. Remove `hbs` | No `hbs`/`handlebars` advisory; the static deploy's test renders the same bytes as before (snapshot taken first) | S–M |
| **T0.3** The rest of the advisories | both | `yarn up` / `yarn dedupe` for `body-parser`, `qs`, `fast-uri`, `ip-address`, `minimatch`, `zod`, `launch-editor`; a resolution only with a comment naming the advisory | `yarn npm audit --all --recursive --severity high` exits 0 in both | S |
| **T0.4** Audit in CI | both workflows | A job `audit` running the command of T0.3; an advisory with no fix is listed by id in one file with its reason and a date to look again | A branch that adds a vulnerable version fails | S |
| **T0.5** The image says what it was built from | `plitzi-sdk-server/scripts/docker-workspace.ts` | Before copying a portal's `dist`, read whether it is a production build (the builds write their mode — add it to the manifest the build emits if it does not). A development build is refused with the fix (`yarn build:prod && yarn build-vendor:prod` in the workspace), or accepted with `--dev` and one line that says so | `yarn docker:up` over a `build:dev` stops and names the command; a unit test of the check | S |
| **T0.6** Server CI runs what protects | `plitzi-sdk-server/.github/workflows` | This is block 3 of the agreed CI plan: e2e with service containers (MySQL, Mongo, Redis, SeaweedFS), visual `@smoke` per pull request, the full suite nightly. Start it from that plan, not from here | A pull request that breaks a route or the sign-in page fails | L |
| **T0.7** A page's budget | `plitzi-sdk-server/visual/screens.spec.ts`, `visual/helpers.ts` | Per key screen, record compressed bytes by kind (script, font, document, space document, style) and the layout shift; assert against a table beside `wasted`, set at today's figures. Draw with the published build (T0.5) | The table exists; raising a figure needs a reason in the diff; § 5's rows are its first entries | M |
| **T0.8** Captures that show the page | `visual/helpers.ts` (`shoot`), the screenshot service, `@plitzi/sdk-mcp`'s capture client | Full-page captures drawn with reduced motion (reveals at their end state) and cut in chunks under 16,384 px, joined or kept as parts. General: a customer's thumbnail has the same hole | The suite's home screenshot shows its footer; a fixture page with `animation-timeline: view()` is whole in a thumbnail | M |
| **T0.9** The tests that need a quiet machine | G6 | For the e2e file and the three visual tests. Reproduce: the file beside a second e2e run, or a CPU hog. Name each wait that is wall-clock and each assertion that reads a state before the queue says it settled; wait on the queue's own state, clocks injected where a deadline is the subject | Twenty full runs in a row green on a busy machine; the cause said in the pull request | M |
| **T0.10** Every route names its guard | G7 | A test walks the API's routers: each route carries a guard, or is in a list of public ones with its reason. The ten hand-checked routes take `authenticated` | The test; it fails on a route added without a guard | S |
| **T0.11** A new project installs clean | G8 | The scaffold's dependencies moved off the advised versions; a nightly check makes a project and runs `npm audit --audit-level=moderate` on it | `create` ends with no advisory line | S |
| **T0.12** The edge leaves the HTML alone | W33, W34 | Email obfuscation off for the zones the platform serves (the platform repository's Cloudflare role; anything that changes Cloudflare needs the maintainer's go). A check in the visual suite's remote mode that a page's console holds no hydration error and no refused script. A line in the self-hosting guide for whoever puts a rewriting proxy in front. Then the lab pass again: `/terms` and `/templates` | No #418 and no blocked script on `dev.plitzi.com`; `/terms`' largest paint under 2.5 s in the lab | S |
| **T0.13** The CSRF token, asked | S1, D12 | Step 0: every first-party caller that writes with the session cookie (the `website` and `auth` seeds' flows, the console, the builder) and whether it sends `x-csrf-token` today. Make each send it. Then the API refuses a cookie-carried write with no token or a wrong one; a bearer is exempt; the origin check stays | The nine cases of the audit as an e2e, each with the status the rule gives; the whole visual suite green — no first-party flow lost | M |
| **T0.14** A throttle a stranger cannot use | S2 | Counted by the address and by the account, apart: an address is slowed over any usernames; an account's limit slows only the addresses that failed, so its owner signs in from theirs. The store shared between replicas (the kernel's seam; Redis here). Clocks injected | A test: ten failures from one address do not refuse the right password from another; one password over fifty usernames from one address is slowed | M |
| **T0.15** Small doors | S3, S4, S5, S6 | `Access-Control-Allow-Origin` only for the deployment's own origins, with `Vary: Origin`. A depth, alias and cost limit on GraphQL (the builder's largest real query measured first, the limit set above it). Names of workspaces, teams and spaces held to a length and to no markup, refused with the fix | Three tests, each failing before | S |

### WS1 — Page weight (general: every space gains; evidence is § 3.2)

Order: T1.1 measures and designs, then T1.2–T1.4 in parallel, T1.5–T1.6 after.

| Task | Where | Steps | Done when | Size |
|---|---|---|---|---|
| **T1.1** Design note, with figures | `apps/sdk`, `apps/server/src/modules/ssr/spaceDocument.ts`, this RFC | With `yarn build:prod-analyze`: what `plitzi-sdk.js` is made of, by element and by package. For three spaces (the website, the docs, one showcase) and three of their pages each: bytes of the document the page needs against the whole. Write § 8 of this RFC from it: the document's parts, the bundle's parts, what the server already knows at render time (the element types on the page) | § 8 holds the tables and the two contracts; the maintainer has answered D1 and D2 | M |
| **T1.2** The space document in parts | `apps/server` (`spaceDocument.ts`, its stage), `apps/sdk` (the store's load and `navigation.navigate`), `sdk-schema` | A shell (definition, settings, variables, the page list with slugs and access), **a part per layout** and a part per page (its subtree, the components it alone uses, the names of the layouts it needs), each content-named and immutable. The page server puts the rendered page's parts within the first paint; a link in view prefetches its page's part and its layouts'. A part of a guarded page is served as the page is (D2). **A space rendered by the SDK alone, with no page server, receives what it receives today, unchanged** (D1). The builder and the MCP keep reading the whole | § 5's document row; a visitor not signed in cannot fetch a guarded page's part (e2e); the client-only examples' e2e unchanged and green; navigation between two pages no slower than today at p95 and with no new loading state; `wasted` unchanged | L |
| **T1.3** The SDK in parts | `apps/sdk` (`vite.config.ts`, the element registry), `sdk-elements` | A core (store, navigation, the elements nearly every page has) and a chunk per heavy element or family (chart, form controls, tabs, list, markdown, map…), named by content. The page server writes `modulepreload` for the chunks of the element types it rendered. A space's own plugins keep the import map they have | § 5's script row on `/terms`; hydration of the dashboard no slower (measure, `NODE_ENV=production`, as AGENTS.md says); no element drawn late that was drawn at once before (the flicker check) | L |
| **T1.4** Icons by use | `apps/sdk` (`plitzi-sdk-icons.css`, webfonts), `sdk-elements` Icon, `apps/server` | At publish or first render, the glyphs a space uses (its documents and its plugins' declared icons) as a subset font or a sprite, content-named; the whole fonts only in the builder | § 5's icon row; an icon chosen in the builder appears on the page without a republish step the author must know | M |
| **T1.5** One stylesheet, said once | `apps/server` SSR head | Find what the 62 KB of inline style on `/terms` is and what of it the linked stylesheet repeats; keep inline only what paints the first screen | Inline style on `/terms` ≤ 15 KB; no flash of unstyled content (the theme and flicker tests) | M |
| **T1.6** Shift | the seeds first, the platform if general | With `layout-shift` entries and their sources, name what moves on the home and on `/templates`. Fix in the seed (reserved sizes, a skeleton of the final height). If the cause is general — a provider's list arriving in the browser — fix the rule (`runtime: 'server'` where the page may, or a reserved box the element declares) and show the evidence | § 5's shift row, in T0.7's table | M |
| **T1.7** A heavy page is said | `sdk-authoring` (lint), the seed | A suggestion when one page's subtree passes a size (start at 250 KB), naming the largest repeated shapes. Then the pricing page (691 KB): its plans, packs and comparison rows from data through a `list` and components, not written out per state | `plitzi lint` says it for the pricing page before the fix and not after; the page under 200 KB with the same pixels (diff of renders, both themes) | M |

### WS2 — Website and sign-in (seed work; one visual lane, see § 7)

Every task: both themes, 1440 and 390, `yarn vitest run prisma/seeds/spaces/platform`, the visual tests of the page,
0 warnings and 0 suggestions from authoring, and a render diff of the pages it did not mean to change.

| Task | Covers | Steps | Done when | Size |
|---|---|---|---|---|
| **T2.1** A menu on a phone | W2 | A disclosure in the bar under the tablet width: Product, Showcase, Templates, Pricing, Docs, CLI, Agents, the community links; focus kept inside, Escape closes, the page behind does not scroll | A `@responsive` test opens it, reaches `/pricing`, and reads its name and state as a screen reader would | M |
| **T2.2** Showcase cards | W3 | Confirm the cause (the `lead` variant's `mobile`); say `gridColumn` again for `mobile`; decide whether five cards or three show on a phone and say why in a comment | No card on a phone has more than 32 px between its last content and its link; a test measures it | S |
| **T2.3** Nothing clipped | W4 | The roles table wraps or stacks; code samples scroll inside their box with a visible edge; the cookie table becomes rows of label and value under 600 px (the markdown table's style in `brand/`, so the docs gain it) | A `@responsive` check that no text node's box crosses its scroll container's edge without a scrollbar, on `/`, `/pricing`, `/cookies`, `/terms` | M |
| **T2.4** The home on a phone | W5, D3 | **Nothing is cut.** § 01 without the sticky stage under the tablet width (each step with its own picture, no empty scroll); § 04's nine cards as a horizontal scroller with snap, every card reachable by touch and by keyboard, its position shown. Looked at on a phone before it is called done | § 5's height row; every text of the desktop home present in the phone's document; the desktop render unchanged (diff) | M |
| **T2.5** Sizes that can be touched and read | W6, W7 | Bar and footer links, chips and the checkbox to 44 px of target on a phone (padding, not type); text under 12 px either raised or, where it is a picture of a product, inside artwork marked `aria-hidden` with a caption that says what it shows. Add both counts to `screens.spec.ts` as ratchets | § 5's two rows | M |
| **T2.6** The cookie notice | W8 | A bar along the bottom on a phone (one line, two buttons, "Settings" as a link), a card in the corner on a desktop that never covers a page's first control; on `/pricing`, placed clear of the summary | A test that, on first load of `/` and `/pricing` at both widths, the primary call to action is not under it | S |
| **T2.7** Proof that holds | W9, W10, D4, D5 | The star count shown from 250 (the action already answers `hasStars`); "Most chosen" → "Recommended"; the free plan is "Free" on the home as on `/pricing`, both read from `services/pricing`, with a test that they name the same plans | The tests; one name per plan in the space's document | S |
| **T2.8** `/pricing` | W11, D6 | Opens on three plans in full (Free, Site, App), the rest one click away, the configurator below; headings in order; the plan summary visible while choosing on a phone | Outline `h1 → h2 → h3`; a first screen at 1440 and at 390 holds one plan's price in full; a `@responsive` test picks a plan and reads its monthly price without scrolling back | M |
| **T2.9** Templates | W12 | Tutorial templates (the category `Learning`) never among the landing's six nor in the gallery's first view: they are reached from the Academy and from the gallery's Learning filter, as one entry ("Café Lumen — the Academy's site") with its levels inside; a description and a language required by the review (`docs/templates.md`, `services/templates`) and refused without; thumbnails checked on the dev cluster (locally they are placeholders by a known cause) | The gallery's test: no two cards with the same picture and description; every card described | M |
| **T2.10** Sign-up and the sign-in pages | W14, W15, D7 | **The username stays** (D7). The form says why it asks: you sign in with it or with your address, and it is your handle. The strength line neutral until a key is pressed; one vertical rhythm for every sign-in page on a phone; a share image and fuller descriptions; the checkbox's target | `auth` tests and the visual journey; signing in with the username and with the address both covered by a test | S |
| **T2.12** One mark | W18, D11 | The home's mark — the stacked layers — is the brand's (D11). It lives in `brand/`; the console, the back-office, the emails and the builder's bar read it from there, and the violet comet goes | One mark on every screen, both themes; a test that the three platform spaces and the builder's bar draw the same one | S |
| **T2.13** The console on a phone | W19, W21, W22 | The bar in two rows with a menu that names every section whole; the audit log in pages of 50, by the cursor its API already has; under 900 px the builder says it needs a wider screen and offers the space's page and its console instead | `@responsive` tests of the menu and the audit log; the builder's notice at 390 | M |
| **T2.14** Shift, signed in | W20 | As T1.6, for the home, `/logs`, a workspace's page and Pools: name what moves, reserve it. Pools' 6,825 nodes: draw only the tab that is open | Each under 0.1 in T0.7's table; Pools under 2,500 nodes on its first tab | M |
| **T2.15** What the demo shows | W23, W24, W25 | Confirm W23 and, if the links are in the markup, leave them out for who may not open them (`visible` on the server). Replace or retire "Coming Soon Demo" with a space that looks like the templates beside it (ask before deleting). The strength line as T2.10, in the account's form too | The markup of `demo`'s home names no `/admin` address; the builder's screenshot opens on a space worth showing | S–M |
| **T2.16** Landmarks and a skip link | W27 | Step 0: how the docs and the showcase spaces say theirs (they have three to six a page; the website, the sign-in and Pizarra have none). The bar as `header` and `nav`, the content as `main`, the footer as `footer`, a skip link first in the tab order — in `website`, `auth` and `docs`. If authoring cannot say one of them, that is general: show the evidence, then add it, with a suggestion for a page that has no `main` | One `main` on every page of the three spaces; the first Tab stop is the skip link; the lint says it for a page without one | M |
| **T2.17** Sign-in, said to everyone | W28, W31 | The error in a `role="alert"` region; `autocomplete` of `username`, `current-password`, `new-password`, `email` and `one-time-code` on the auth fields (if the form control cannot say it: general, with evidence); a focus ring on the fields, measured in both themes | A test reads the alert after a wrong password; the attribute values asserted; the ring's contrast at 3:1 | S |
| **T2.18** Read by assistants, by the owner's choice | W29, W30, D10 | Plitzi's website stops blocking (`blockAiCrawlers` off). **For every space, a setting that says what to block by kind** — crawlers that train models, assistants fetching a page for a person, AI search — each on its own, written into `robots.txt` by the platform and editable in the builder's settings, by an agent and in code (a platform change, decided by D10; today's boolean becomes that list, no shim). An `llms.txt` for the website and the docs; the sitemap with each template and showcase chapter and a `lastmod` | `robots.txt` of the website names no assistant; a space that blocks one kind lists only that kind's agents; authoring, the builder and the MCP all write the setting (tests in each); `/llms.txt` answers; the sitemap's test | M |
| **T2.19** A builder that cannot open says where to go | W32 | The builder's refusal states — not signed in, no access, a credential the server no longer takes — as a page with the reason and its way out (sign in, back to the console) | A visual test of each state | S |
| **T2.20** Emails worth opening | W35 | The ten templates out of the provider into one place the kernel's mail seam reads, each with a layout (the mark, a footer, the address it was sent to), a plain-text part, `lang`, and subjects in one case; drawn in light and dark and checked in the suite through Mailpit. The provider only sends | A test renders each template to HTML and text; a provider with no templates of its own sends them | M |
| **T2.21** The builder's bar and rail (`apps/builder` — general, shown here because the console opens it) | W36, W37, W38 | In `modules/App/components/AppHeader` and `AppDirectory`. The bar fits from 1280: the page name and the widths fold into menus before **Snapshot** and **Publish** ever leave the window (they are the last to go). A click on the rail shows that panel open, with the choice of stacking kept for whoever pins one. The rail's buttons carry their names (a label on hover and for a screen reader). The class chip shows the name the author gave, the hash only when there is none. The dev-tools launcher clear of the panels | A test at 1280 and 1440 finds **Publish** inside the window; a click on each rail button shows its panel's content; the builder's e2e green | M |
| **T2.22** Long reference pages and a Spanish site | W39, W40, W41 | The CLI reference and the authoring errors by section (a page each, the search finding them), or one page that draws only the section in view; the docs' bar whole at 390. Ceniza's `settings.language` as `es`, and a lint suggestion when a page's text and its language disagree. The home's first paragraph taken from the docs' | Neither page over 6,000 px; `lang="es"` on Ceniza; the suggestion's test | M |
| **T2.23** Sessions with an end | W42 | Step 0: confirm how many live sessions an account may hold and what removes them. A cap on an account's sessions (the oldest go first, said in the devices page), and the September probe account removed from development's database by the maintainer | A sign-in past the cap ends the oldest; the devices page says how many it shows of how many | S |
| **T2.24** A scale for type, radii and the three colours | DS1, DS2, DS3, DS8 | In `brand/`: eight type steps (no half pixels), four radii and the pill, written once. Three text tokens that pass AA on their grounds — the success green for text on light, the violet for text on dark, the muted grey in both — beside the fills they have today; the asterisk and the hero's code on tokens. Every class of the three platform spaces moved onto them, by render diff. The suite's contrast check raised to AA (4.5:1, 3:1 large) and two ratchets added: distinct sizes and distinct radii per page | Under 10 sizes and 5 radii on every page; no text under AA in either theme; the diffs show nothing else moved | L |
| **T2.25** One voice for the brand | DS4, DS5, W18 | With T2.12's mark (the home's, D11): one headline treatment (still the maintainer's pick; the showcase's gradient is the proposal), mono kept for code and what is typed, sans for labels and kickers; the sign-in panel's mock-up replaced by a sentence and the mark | Mono under 15 % of the home's text nodes; one treatment on every `h1`; both themes | M |
| **T2.26** Covers that sell | DS6, W12 | A cover per template — its own first screen at a readable crop, or a designed card from its palette and name — made at publish and reviewed with the template (`docs/templates.md`); the same crop rule for a space's Overview | No two cards alike; text in a cover readable at the card's size (a test measures its smallest type) | M |
| **T2.27** The console's finish | DS7 | The phone's gutters equal on every card; the roles' permissions as the form's own checkboxes with labels at full contrast; a first-run home that shows what to do instead of placeholders | `@responsive` test of the gutters; the roles page's contrast in the suite | S |
| **T2.28** The widths between | RS1–RS6 | The public bar folds when its items do not fit — measured, or a breakpoint above what it needs (today 1,069 px) — and **Start free** is the last thing to leave it. From 1024 the two-column layouts hold (the hero's, `/pricing`'s with its summary beside the plans); the sticky summary sits clear of the rows; X-ray is drawn once; the console's bar keeps its controls from 768; the run lines' column grows with the window. Then the sweep as a test of the visual suite, on the key screens at 768, 834, 900, 1024, 1100, 1180 and 1280: no control past the window's edge outside a scroller that says it is one, no sideways scroll, no control over another | The test, failing today at 834–1068; **Start free** whole at every width from 320 | M |
| **T2.11** Loose ends | W1, W16 | W16: confirm with the maintainer, then remove the `test` page. W1 is not an agent's: it is listed so the launch list has it — the notice comes out when counsel returns the text, and `TERMS_VERSION` moves with it | The page gone; W1 tracked in § 9 | S |

### WS3 — Code quality and what is half-moved

| Task | Covers | Steps | Done when | Size |
|---|---|---|---|---|
| **T3.1** The sandbox's tests with the sandbox | Q1 | Move the tests of the runner itself (`isolate.test.ts`, `isolate.limits.test.ts`, `isolate.cores.test.ts`, what of `native.test.ts` is the runner's) to `sdk-runtime`; what tests the engine through a runner stays. Add tests beside `guest/fetch.ts`, `guest/crypto.ts`, `service.ts`, `driver.ts` for what they alone decide | `sdk-runtime`'s suite fails when a limit, a guest API or the service's drain is broken, with `sdk-actions` not built | M |
| **T3.2** `session` in parts | Q2 | Extract, with no change of behaviour: the run's clock (own time, awaited, late, charged CPU — pure, clocks injected), the turn holder, the stop reasons. `session` composes them. Each rule in the comments becomes a test of the part | The existing suites pass unchanged; the clock's tests run with no isolate; a load round within its band (T5.2) | M |
| **T3.3** Pools: the service and its screen apart | Q3 | `services/pools/report/` holds the view model (`Screen*` types, labels, levels, `poolsReport`, `instanceLogs`); `index.ts` keeps what other services call. No change in what the back-office reads | `index.ts` under 400 lines; `api/admin/pools.ts`'s tests and the back-office visual pass | M |
| **T3.4** One place for the environment | Q4 | The 13 reads into `settings` (email, `MAX_TRACKED_PATHS`, the `isDev` checks through one helper); a lint rule refusing `process.env` outside `src/config` and the entrypoints. `settings.ts` split by domain only if it reads better: files under `config/settings/` composed into the one object | The rule is on; `yarn lint` clean | S |
| **T3.5** Lines that reach the log | Q5 | Each `console.*` in `src` through the logger at its level, or removed; the rule `no-console` on for `src` (scripts and seeds keep it) | `yarn lint` clean with the rule | S |
| **T3.6** Builder modules with tests | Q6 | For Connectors, Actions, Fonts, Variables, Visitors, Elements and Transformers: unit tests of their helpers and reducers, and one journey each in the workspace's e2e where a person uses it. A test must fail on the bug it names: break the code once to see it | Each module has tests that failed against a deliberate break (said in the pull request) | L (one agent per two modules) |
| **T3.7** Thin packages | Q7 | `sdk-variables` and `sdk-plugins` first (small, read by everything), then the uncovered halves of `sdk-style` and `sdk-dev-tools` by what changed most in three months (`git log`) | Coverage of the files touched in three months above 70 % of lines, measured before and after | M |
| **T3.8** Exceptions, counted and explained | Q8 | `react-refresh/only-export-components` set per folder in the shared config instead of 57 comments; every remaining `eslint-disable`, `any` and cast outside tests either removed or carrying its reason; a test that counts them per package and ratchets | The counts in a table in the repo; none without a comment | M |
| **T3.9** Plans that are not plans any more | Q9, Q12, D8 | `agent-workflow-improvements.md`: for each of its eight items, find what shipped under which name; what did, delete; what did not, one line in this RFC's § 9. RFC 0032: finish phase 11 or cut it with its reason, then delete it by its own rule. Measure what the seeds cost `yarn typecheck` and `yarn lint` (cold and warm) for D8 | The September document gone or one page; RFC 0032 gone, its knowledge in `docs/en`; D8's figure in § 4 | M |
| **T3.10** The unit run's imports | Q10 | Try `isolate: false` for the projects whose tests share no module state; keep it where the suite is green three times in a row and faster | The run's time before and after, in the pull request | S |
| **T3.11** The CLI's two halves | Q11 | A boundary a lint rule holds: `src/commands/*` (other than `runs`) and `src/doctor`, `src/lint`, `src/scaffold` do not import `src/runs/*`. The harness as its own chunk, loaded by the commands that use it. Measure `plitzi --version`, `plitzi lint` and `plitzi page shot` before and after | The rule is on; a single-agent command does not load the harness's chunk; no command slower | M |
| **T3.12** The benchmark holds the line (`nexus`) | N5, N6 | First of the four. The benchmark as a CI job on every pull request, against `main` on the same runner, each case with a tolerance taken from its measured noise (ten runs); the bundle's size beside it. The core's tests in a node environment, jsdom for the bindings alone | A pull request that slows any case past its tolerance, or grows the bundle, fails; the figures printed in the job | S |
| **T3.13** A path type with a floor (`nexus`) | N1 | In the type checker only — no line of what runs changes. Measure first: `tsc --extendedDiagnostics` on `apps/builder` and `apps/sdk`, the time and memory under `PathOf`. Then a depth the type stops at (past it, `string`), the default chosen from the figures, a type parameter for who needs more. If the figures show `PathOf` is not what costs, the task ends there | Type-check time and heap of the two apps before and after; the built `dist` byte-identical but for its `.d.ts`; nexus's type tests green | M |
| **T3.14** Caches that forget the right thing (`nexus`) | N2 | A hit must cost what it costs today: one `Map.get`. So not a classic LRU, which rewrites the map on every hit. Two generations: reads hit the young map; a miss looks in the old one and promotes; when the young one is full the old is dropped and the two swap. Below today's limits nothing changes at all. The benchmark gains a case of 10,000 distinct paths read in rotation, where today's cache stops helping | Every existing case within its tolerance (T3.12); the new case faster; if a hit cannot be kept at one lookup, dropped | S |
| **T3.15** Persistence that waits for the burst, an async that can cancel, a plan retired (`nexus`) | N3, N4, N7 | Persistence: an option, off by default — writes gathered into one per tick, flushed on `pagehide` and on `destroy`. It only removes work (N writes become one), but it moves *when* storage is written, so whoever wants it asks. Async: the `AbortSignal` only for a fetcher that asks for it (an option), so a `run` that does not allocates nothing more than today. The migration plan deleted, what it knew in the README | With the options off, the benchmark and the allocation count of `run` unchanged; with them on, 1,000 writes in a tick make one `setItem` and a superseded call is aborted | M |

### WS4 — Authoring, MCP and CLI

| Task | Covers | Steps | Done when | Size |
|---|---|---|---|---|
| **T4.1** A standing score | A1 | Inventory `bench/` (`agents`, `targets`, `baseline`, `results`) and say what it already scores. Fix a set of twelve tasks over three project shapes — add a page from a brief, wire a form to an action, change a style across breakpoints, fix a seeded lint finding, add a function and call it, a `space push` after a remote edit… — each with a check a script runs. Run it on a schedule with one model per tier, alone and as a team; keep success, calls, tokens, wall time and the refusals met, by commit | A table per week in `bench/results`; a change that drops success by more than its noise is named by the report | L |
| **T4.2** Every refusal has a code and a fix | A2 | Extend what `silentCases.test.ts` does to the CLI's commands and the MCP's tools: enumerate the refusals each can give (their constructors are few), and assert a code from the shared list and a sentence that names what to do. A refusal with no fix fails | The test; the list of codes generated into `docs/en` from it | M |
| **T4.3** Versions out of step | A3 | Inventory what each surface sends of its version and what the server does with it. Then one rule: the server names the oldest client it accepts per surface; older is refused with the command that upgrades; `plitzi doctor` and the MCP's first answer say when they are behind | An e2e with a client one minor behind (accepted, told) and one below the floor (refused, with the fix) | M |
| **T4.4** A budget per tool | A4 | For the fixture spaces, the size of each tool's answer (`plitzi_read`, `plitzi_look`, `plitzi_search`, `plitzi_activity`, `plitzi_render`…) in tokens, ratcheted. Never by dropping a field an agent needs: by default depth and by saying how to ask for more | The table and its test; `docs/en/mcp.md` says the defaults | S |
| **T4.5** A write sent twice | A5 | Read how `plitzi_apply`, `plitzi_set_*` and `plitzi_add_page` behave when the same call arrives again after a timeout. If twice is possible: an operation id from the client, remembered for a few minutes, answers the first result | A test that sends each write twice and finds one change in the history | M |
| **T4.7** One vocabulary, measured before decided | A6 | A note, no code: for ten capabilities (an element, a class with states, a binding, a flow, a page, a component, a flag, an action, a function file, a setting), how each is said in a builder mutation, an MCP operation and an authoring spec, and what each surface's skill spends teaching it. Then the proposal the figures support — most likely the MCP taking an authoring snippet where it takes its own shapes today (`authorSnippet` exists), its `AI*` shapes kept for reading | The table and the proposal in § 8; nothing changed | M |
| **T4.8** The harness out of a lone agent's way | A7 | With T3.11's boundary: `plitzi --help` names `run` and `task` in one line each and leaves their commands to `plitzi run --help`; the lone agent's skill does not load the run references. Measure what a first session reads before and after | Bytes of help and skill a lone agent reads, before and after, in the pull request | S |
| **T4.9** The run skills, on a diet | A8, A9 | For every sentence of `runs.md`, `runs-lead.md`, `runs-plan.md`, `runs-review.md`, `runs-designer.md` and `runs-scout.md`: is it enforced by a refusal, said by a command when it matters (`--dry-run`, `task next`, `run watch`), or only here? The first two leave the skill — the command teaches it. What stays is ordered by how often runs met it (the reports' findings), one rule a line, with a glossary of the run's words opening `runs.md`. Then T4.1's score, as a team, before and after | `runs-lead.md` under 3,500 tokens; a test lists each rule taken out beside the refusal or output that carries it; the team's score no lower | L |
| **T4.10** Skills held to the CLI | A10 | A test reads every `plitzi …` command written in a skill or a reference and asks the CLI for its `--help`; descriptions asserted under 1,024 characters; `add plugin` corrected | The test, failing on the stale command before the fix | S |
| **T4.11** `verify` on a cold project | A11 | When nothing serves the project, `verify` serves it for its page check — as `page check` does in a run's copy — stops it after, and says it did | `plitzi verify` passes on a fresh `create` with no other command | S |
| **T4.6** What a refusal cost | A1 | From T4.1's records: the ten refusals and lints agents meet most, and for each whether the message alone was enough (the next call fixed it). The ones that were not go through `improving-the-cli.md`'s line — a task only when it is Plitzi's | A list with counts; no change made by this task | S |

### WS5 — Server work

| Task | Covers | Steps | Done when | Size |
|---|---|---|---|---|
| **T5.1** The sandbox, attacked | R1 | In `sdk-runtime`: a suite of what a guest tries — reaching the host's globals through prototypes, errors and thrown values; the callbacks' references; memory by string, array buffer and regular expression; timers and microtask floods; `fetch` to a host not declared, by redirect, by an address in another notation, by a name that resolves inside (`outboundGuard`); a second invocation reading the first's state; the bundle's top level doing any of it. Each ends in the stop reason or the refusal the contract names | The suite runs in CI with the package alone; each case named after what it tries; anything it finds is reported to the maintainer before it is written anywhere public | L |
| **T5.2** The load round, kept | R2 | Move the probe and its cycle script from `tmp/load/` to `plitzi-sdk-server/test/load/` with the estimate, the band and how to read `/_stats` refusals; it runs against the visual stack only and refuses any other; a nightly run keeps its result | `yarn load` documented in `docs/`; a round's result in a file by date; the AGENTS trap about the Docker VM's memory linked from it | M |
| **T5.3** A contract for runners | R3 | `functionRunnerContract` beside `jobQueueContract`: what any runner does with limits, stops, `ctx` calls, logs, usage and `busy`. The isolate, remote and native runners pass it. Then the `ctx` channel behind an interface with two transports — the socket of today and request/response (a signed address per run) — the second proven by a test runner that has no socket. No cloud's runner is written here | The three runners pass; the test runner passes on request/response; no engine file names the socket | L |
| **T5.4** Run records that are not lost quietly | R4 | A failed burst is kept and retried with back-off up to a bound of records and minutes; past it, the loss is counted in the process's stats and shown in **Back-office → Health**. Clocks injected | A test with a store that fails three times and loses nothing; one that fails for ever and reports the number | M |
| **T5.5** Realtime across replicas | R5 | Reproduce with two page servers and no affinity in the split-topology e2e, over SSE and over WebSocket. If it still answers 401: the channel's grant checked against the shared store, not the replica's memory | The e2e, green on both transports | M |
| **T5.6** Work set aside is said | R6 | Inventory what the owner is shown and sent when runs are refused for quota or jobs set aside. If nothing reaches them unasked: one calm notice in the console's home and one email per period, naming what is not affected (pages keep being served) | A visual test of the notice; an e2e that the email is sent once | M |
| **T5.8** One trace for a run | R8 | The W3C `traceparent` taken at the edge (or made there), carried on every hop — the page server's call to the worker, the worker's to the runner, the runner's `ctx` calls back, a runtime's — and written on the run's record and every log line of it. No vendor: an exporter is a deployment's choice, off by default. The run's page links its lines by it | An e2e in the split topology reads one id on the request, the run, the runner's log and the answer | M |
| **T5.9** The engine's two closures | R9 | After T3.2 has shown the way: `runAction` and `createJobWorker` in parts with injected clocks — admission, the claim loop, slices, endings — composed as today. No change of behaviour | Their suites unchanged and green; a load round within its band (T5.2) | L |
| **T5.10** One resolution, one connection | R10 | The guarded fetch connects to the address it judged: a dispatcher whose lookup answers only the vetted addresses (undici's `connect.lookup`), for the first request and every redirect. A test with a resolver that answers a public address first and a private one after | The test, failing before; functions, connectors and `http.request` all through it (a lint rule refuses a bare `fetch` to an authored host) | M |
| **T5.11** Backups somewhere else, and a restore with a date (`plitzi-platform`) | PL1 | The maintainer names the bucket and the credential. Then each dump copied off the node after it is made, encrypted with the cluster's age key, its retention said; a monthly Job that restores the latest into a scratch database and counts rows, and says so in the log the alerts read | A dump listed in the bucket; the restore Job green once, by hand first | M |
| **T5.12** Somebody is told (`plitzi-platform`, `plitzi-sdk-server`'s chart) | PL2 | A receiver the maintainer chooses (mail, a chat webhook). Rules for: a backup Job that failed or did not run, a volume past 85 %, a certificate 14 days from its end, a pod restarting, and the platform's own figures — work waiting past its limit, a pool full for ten minutes, runs failing above a rate — exported from what `/_stats` already holds | Each rule fired once on purpose in the cluster and received | M |
| **T5.13** Small drifts (`plitzi-platform`) | PL4, PL5 | Mongo on the cluster moved to the version a laptop runs, by the upgrade path the server repository already has; third-party images by digest; `terraform/` archived or deleted (ask first), its state files with it | `make test` green; one Mongo version in both places | S |
| **T5.7** Pools: mechanism or data | R7 | A table of `services/pools/*` by who needs it: any deployment, or Plitzi's. No move: the table and a recommendation, to the maintainer | The table in § 8 | S |

### WS6 — Product

| Task | Covers | Steps | Done when | Size |
|---|---|---|---|---|
| **T6.1** The funnel | X2 | Inventory the back-office's overview. Add, from events the platform already records: signed up → confirmed → first space → first publish → edited again within 7 days, by week of sign-up, with the median time between steps | **Back-office → Overview** shows it for the seeded data; its API has an e2e | M |
| **T6.2** Time to a first published page | X2 | A journey in the visual suite from sign-up to a page answering on its address, timed, with each wait named. Then remove the largest wait | The journey's time in T0.7's table, ratcheted | M |
| **T6.3** What a buyer checks | X4 | A changelog page fed from the releases; a security page and `/.well-known/security.txt` (a platform route, not a file in the page server's `public/`); a status page's address in the footer once there is one | The pages exist, linked from the footer, in both themes | M |
| **T6.4** A page's weight, shown to its owner | X5 | After WS1: in a space's analytics, per page, the bytes by kind and the layout shift, measured by the page server and the collector the page already loads. A design note first | The note, then the screen | L, after WS1 |
| **T6.5** The landing says who and proves it | § 3.1.3 | The first screen names its reader and uses the docs' sentence; a quieter second call to action (a 90-second recording of the studio, an address kept — a real form of the platform's own); proof that exists today in place of the star count; pages per reader and the comparisons, each from one shared frame so a claim is written once; the bands' art alternated (a real site full-bleed, one diagram), the brand's own icons | Each new page in the sitemap and linked from the bar or the footer; both themes, every width of T2.28; the home's weight not above its budget (T0.7) | L |
| **T6.6** Found by a search | § 3.1.3, W30 | Structured data where the page is one: `FAQPage` (the questions), `Product`/`Offer` (each plan, from `services/pricing`), `ItemList` (templates, showcase), `BreadcrumbList` and `TechArticle` (docs) — written from the same data the page draws, never by hand. A share image per page, made at publish (a template's cover, a doc's title). Docs' descriptions to length; the large card on the docs. General where it can be: what a space's settings offer every customer | A validator of structured data green on each page type; the sitemap's test (T2.18) | M |
| **T6.7** Docs for both readers | § 3.1.3 | A reference part for the builder (panels, the inspector, publishing, domains, people and plans), written from the builder's own names (`ui(…)`); "Copy as Markdown" and "edit this page" on every page; "was this useful"; searches with no result kept and listed for whoever writes; the REST routes and the MCP's tools as generated pages | `yarn vitest run prisma/seeds/spaces/platform/docs` green with the new part; a page's Markdown is what an agent receives | L |
| **T6.8** A console that walks you in | § 3.1.3 | A first run to the first publish (the checklist the home already has, as the page's main thing until it is done); renaming in place; acting on several spaces; one way to sort and page every table; a count of what needs attention on the bar; loading at its final size | The journey of T6.2 shorter; the tables' behaviour in one shared component | L |

## 7. How agents take this

The full procedure — the worktree, which stack, changing a seed, what "done" means, the pull request, when to stop —
is [`0033-audit-and-hardening/00-how-to-work.md`](0033-audit-and-hardening/00-how-to-work.md). In short:

- **One agent, one task, one branch**, named `rfc-0033/<task>`, in a git worktree of its own. The working trees of both
  repositories are shared with the maintainer: no `stash`, `checkout --`, `restore`, `reset --hard` or `clean`, ever.
- **No sub-agents** unless the maintainer has said so for that session.
- **Before code:** read the repository's `AGENTS.md`, this RFC's finding and task, and the files named. Run step 0 and
  write what was found. A finding that is already covered ends the task there.
- **Platform ≠ use case.** A task in WS2 changes seeds. If the fix seems to belong in a package, stop and show the
  evidence to the maintainer first.
- **A fix carries the test that would have caught it**, proven against the old code once.
- **Done means:** `yarn typecheck`, `yarn lint` and the tests of what was touched, in the repository touched; for seeds,
  authoring at 0 warnings and 0 suggestions; for anything drawn, light and dark, 1440 and 390; for a moved figure, the
  figure before and after in the pull request. A failure or a skipped step is reported as it is.
- **One Playwright run at a time, per machine.** Tasks that need the visual stack go through one lane: WS2, T0.7,
  T0.8, T1.6 and T6.2 are taken one after another, never beside each other. Nothing an agent runs by hand touches
  development's databases.
- **Nothing is deleted that was not agreed** (T2.11, T3.9 name what is).
- **Commit and push only when asked.** The pull request says: the finding, what changed, the figure, what was not done.
- **When a task ships,** its row leaves this RFC and what it taught goes where it stays true: a guide, a comment, a
  line in `AGENTS.md`.

### Order

| Wave | Tasks | Beside each other? |
|---|---|---|
| 1 | T0.1–T0.5, T0.10–T0.15, T3.12, T5.10, T5.11, T3.1, T3.3, T3.4, T3.5, T3.9, T4.10, T4.11, T5.7 | Yes: disjoint files |
| 2 | T0.6, T0.7, T0.8, T0.9, T1.1, T4.1 (inventory), T5.2 | T0.7 and T0.8 in the visual lane |
| 3 | T1.2, T1.3, T1.4, T2.1–T2.28, T3.2, T4.2–T4.5, T4.7, T5.1 | WS2 in the visual lane, in the order written; T1.2 and T1.3 by different agents who read each other's contract in § 8 |
| 4 | T1.5–T1.7, T3.6–T3.8, T3.10, T3.11, T3.13–T3.15, T4.8, T5.12, T5.13, T5.3–T5.6, T5.8, T5.9, T6.1–T6.3 | Yes, the visual lane apart |
| 5 | T4.6, T4.9, T6.4–T6.8 | After their inputs exist |

## 8. Design notes (written by T1.1 and T5.7)

Empty until then. T1.1 writes the document’s parts and the bundle’s chunks here, with the figures that chose them; T4.7 the three vocabularies side by side;
T5.7 the pools table.

## 9. Not an agent's, tracked here

- **W1, W26:** final legal text from counsel, its placeholders filled (the company's name, address and registration, the governing law); the draft notice out; `TERMS_VERSION` moved.
- **X3:** how many plans are sold at all is a product decision; D6 only settles how the page opens.
- **X6 / D9:** `AI_ENABLED` by default.
- **Thumbnails on the dev cluster** (T2.9): to be looked at by whoever can reach it.

## 10. Costs and risks

- **WS1 changes what every space loads.** A split that draws an element late is a regression customers see. The
  flicker and theme tests, `wasted`, and T0.7's budget are the net; both splits keep a whole mode until three releases
  have gone by without a report.
- **A part per page moves a request to navigation.** Prefetch on view covers it; a space with hundreds of small pages
  may be better whole — hence the setting.
- **WS2 is twenty-eight changes to the same few pages.** Done beside each other they would merge badly: one lane, one after another,
  each with its render diff.
- **T5.1 may find something.** Found privately first; fixed before it is described.
- **The gates slow a red day.** That is their job; T0.6 follows the CI plan's rule that an unchanged thing is not rebuilt.

## 11. When this ships

This file is deleted. The targets of § 5 live on as the tables their tests read; the rules agents followed are
already `AGENTS.md`'s; whatever was decided in § 4 is a comment beside the code that enforces it.
