---
'@plitzi/sdk-authoring': patch
'@plitzi/sdk-elements': patch
'@plitzi/cli': patch
'@plitzi/plitzi-sdk': patch
'@plitzi/sdk-server': patch
---

- **`focus-on-field-box`** (`@plitzi/sdk-authoring`): a warning for a `focus` or `focus-visible` state on a text
  field's or a select's `input` slot. That slot is the box the field is drawn in, a `<div>` that never takes focus, so
  the rule was never seen and a keyboard user tabbing to the field found no ring. The fix it names: `'focus-within'` on
  the same class, or the state on the `field` slot.
- **`modalContainer` says how it is laid out** (`@plitzi/sdk-elements`): its description now names its slots and how
  they sit — the dim layer and the dialog side by side, not one inside the other; the dialog centred by `top`/`left`
  50% and a `translate`. A space styled the dim layer as a flex container to place the dialog, which moved nothing.
- **A field shows where the keyboard is** (`@plitzi/plitzi-sdk`, `@plitzi/sdk-elements`): a text field's or a select's
  box is ringed (`2px solid currentColor`) while the field inside has keyboard focus, and a textarea while it has. No
  text field or select showed any focus at all: the box had `outline: none`, and the field inherited it. One class of
  specificity, so whatever a space writes about the outline wins; never in the builder's canvas, where the selection is
  the ring. The field no longer inherits the box's outline — the box draws it.
- **The dim layer of a modal and a dialog is `rgb(0 0 0 / 50%)`** (`@plitzi/plitzi-sdk`, `@plitzi/sdk-elements`), not
  black at `opacity: 0.5`: the default looks the same, and a colour a space gives the layer is drawn as it is — it was
  halved. A space that set its own colour sees it darker: the one it wrote.
- **`required-message-unused`** (`@plitzi/sdk-authoring`): a warning for a `requiredMessage` on a field nothing requires —
  since 0.38.9 a field is optional unless `required: true`, so the message is never shown and an empty answer is sent.
  The formControl's description, the cheat sheet and the forms recipe say the default.
- **`seo-template`** (`@plitzi/sdk-authoring`): a template in a page's `seoTitle` or `seoDescription` is refused. It was
  written into the head as it was, braces included, on the server and in the browser.
- **`plitzi upgrade` says where fields became optional** (`@plitzi/cli`): for a project last upgraded before 0.38.9,
  each `formControl(…)` with no `required`, at its file and line — said, never written. And a `.gitkeep` is written only
  in a folder with nothing else in it (`src/functions/` with code got one).
- **`devMode` and `devReload` are the project's** (`@plitzi/sdk-server`): `src/config/serverOptions.ts` may set them,
  over `NODE_ENV`, which they still follow when left out. A deployment started without `NODE_ENV` (a container's `CMD`)
  says `devMode: false`, and a public action answers with its output alone.
- **`page shot --from load`** (`@plitzi/cli`): `--frames` start as soon as the page's HTML is in, not once it settles —
  an entrance that plays while the page loads had ended before the first picture.
- **`page shot --as <username>`** (`@plitzi/cli`): signs in first, as `page check --as` does, the password from
  `PLITZI_CHECK_PASSWORD` in `.env`. A page for signed-in visitors was pictured as the sign-in page it sent the browser
  to, without a word; `page shot` now says when the page sent it elsewhere, and that the picture is of that page.
