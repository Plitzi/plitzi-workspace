---
'@plitzi/cli': patch
---

Variants are a Structure element; a new `disclosure` opens and closes what it holds, a `countdown` says how long is
left, and a new User category holds `avatar`, `account` and `signInForm`.

## Elements

- **`variants` and `variantItem` are in the builder's Structure category**, beside `timeWindow` (`market.category:
  'structure'`): by rules a `variants` is personalisation as much as a test. The Testing category, which held only them,
  is gone. `plitzi_render`'s widgets still leave them out — by type now: a widget in a chat has no visit to choose by.
- **`disclosure`, with its `disclosureSummary`: a summary that shows or hides what follows it** — a question and its
  answer, a menu, "show more". It is a `<details>`: it opens before the page's script, find-in-page opens it, and what is
  closed stays in the page. `name` groups disclosures into an accordion; Escape closes it, `closeOnClickOutside` and
  `closeOnNavigate` (on by default) too; the `openDisclosure`/`closeDisclosure`/`toggleDisclosure` steps drive it. The
  summary draws a marker that turns as it opens (`marker: false` for a sign of your own), and lights a class's
  `expanded` state — which now matches an open `<details>`'s summary as well as `aria-expanded`.
- **`container` no longer takes `subType: 'details'` / `'summary'` nor `open`**: a document that used them is refused
  (`attribute-value`, `unknown-attribute` for `open`); write a `disclosure`.
- **`countdown`: how long is left until an instant** — `to`, or the `endsAt` of the `timeWindow` it is in. Days to
  seconds (`largest`, `smallest`), its units named in the space's language (`labels`: long, short or none; `locale`).
  Drawn by the server at the instant it renders and counting on in the browser; at zero it runs `onCountdownEnd`
  (`onCountdownEnd()` in authoring). Its `unit`, `value` and `label` slots style it. The lint refuses a `to` without
  its offset (`countdown-to`) and warns of one with nothing to count to (`countdown-without-end`).
- **`image` takes a `fallbackSrc`**: shown when `src` is empty or does not load, before the SDK's own placeholder; a
  failed `src` is still said on the image (`data-plitzi-failed`).
- **A User category: `avatar`, `account` and `signInForm`.** `avatar` shows a person by their picture, or their
  initials on a colour of their own (`name`). `account` is a top bar's corner: "Sign in" for a guest (to `signInHref`
  with `?redirect=`, or the provider's own sign-in), and for a visitor with a session a menu with their name, address,
  its children and "Sign out". `signInForm` is the sign-in: one button through Plitzi's provider, an email and a password
  against a space's own (`basic`), the second factor's code when the account has one, and each refusal said for what it
  is. `account-sign-in-unreachable` warns of an `account` with nowhere to sign in on a `basic` space.
- **`share` and `fullscreen` steps.** `share({ url?, title?, text? })` opens the device's sheet for an address (this
  page's by default), or copies it where there is none, and answers `{ shared, copied }`. `fullscreen('element-id',
  mode?)` shows any element on the whole screen and back (`toggle`, `enter`, `exit`), failing into `onFailure` where the
  browser cannot.
- **`visitor.country` in a variant's rules**: ISO 3166-1 alpha-2 (`ES`), read by the page server off the header the
  CDN in front says it in (Cloudflare's, CloudFront's, Vercel's); empty with none, and with no server. It decides what a
  page shows, never who may see it — any visitor can send the header to a server with no CDN in front. The builder's
  Visitor tab simulates it, and a page reading it is kept apart by it in the page cache.
