# RFC 0033 — WS2 briefs: the website, the sign-in, the console, the docs

> Section numbers here are the full RFC's, `git show c29db583b:docs/rfc/0033-audit-and-hardening.md`: its § 3 holds the
> findings, § 4 the decisions (§ 2 now), § 8 the design notes (§ 4 now). A task named here that is no longer in the RFC
> has shipped: what it made is in the code.

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
  5. The sitemap stays what the schema says — its pages, their folders and visibility (`sitemapPaths`): a template's
     page has an address the schema cannot name, and is reached through the gallery's links and `ItemList`.
- **Do not:** let `settings.robotsTxt` (a space's own rules) be overwritten by the new setting — say in the docs how
  the two combine; block a search engine's ordinary crawler under any of the kinds.
- **Verify:** in the workspace: tests of the stage for each kind alone and together, of authoring, the builder's
  panel and the MCP operation; `yarn turbo run test lint typecheck`. In the server: `robots.txt` of the website names
  no assistant; a seeded space that blocks one kind lists only that kind's agents; `/llms.txt` answers on both hosts;
  a sitemap test; `yarn vitest run prisma/seeds/spaces/platform/docs`.

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
