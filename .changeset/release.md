---
'@plitzi/cli': patch
---

Variants are a Structure element; a new `disclosure` opens and closes what it holds.

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
