---
'@plitzi/sdk-authoring': minor
'@plitzi/sdk-elements': patch
'@plitzi/plitzi-builder': patch
'@plitzi/sdk-shared': patch
'@plitzi/sdk-mcp': patch
---

- A `button` takes a `title`: shown as a tooltip, and its accessible name when it has no text of its own — an
  icon-only button without one was announced as nothing. The builder's settings offer it as "Tooltip". The JSON export
  is two files, `schema.json` and `style.json`, shown as tabs; each group of changes in the export folds away.

- `BindingTransformer.params` is `Record<string, string | number | boolean>`: a param the builder draws as a checkbox
  (`styleVariant`'s `append`) is stored as the boolean it is and read as one, so the type now says so. The MCP compares
  such a param with its catalog options as text. A `container` may be an `li`, for the rows of a list. The export
  keeps every element id with `keepIds`, and the header's Publish dialog opens wider.


- **The builder exports the space on screen — on paid plans.** **Export** in the header opens a wide dialog: the
  format as tabs (TypeScript in one file, TypeScript with a file per page as a `.zip`, or JSON), generated as soon as
  it is picked, shown read-only in CodeMirror — beside a file list when there are several — with one row of actions,
  **Copy** and **Download**. What the export tidied is a one-line note that unfolds into readable groups. On the free
  plan the dialog explains what export is instead; the server refuses the code with a 402 (`limit: 'spaceExport'`)
  whatever the builder shows. `useSpaceExport` is the one way into it, for anything else that needs the space as files.

- **A space document can be read back into code.** `specFromSpace(documents)` turns a `{ schema, style }` pair — a
  builder export, a seed checked in as JSON — into the `SpaceSpec` that authors it, and `specToSource(spec, { exportName })`
  writes that spec out as the TypeScript a person would write: one factory call per element, the attributes a type
  already defaults to left out, the longhands the document stores written back as `padding: 10px 20px`, and every class
  something names as a `styles()` declaration held in a variable. `split: true` writes one file per page and per layout.
  `compareSpaces(expected, actual)` proves the round trip: it lists every way two pairs render differently — the tree,
  the attributes, the rules that apply to each element whatever its selector is called, bindings, flows, pages, layouts
  and settings — and nothing else. A selector used by one element becomes that element's own `css`; one shared, or
  spelled out anywhere in the document (a `customCss` rule, a template), stays a class under its own name; an element id
  nothing refers to is left out and derived again.

  What an older builder left behind is repaired on the way, and every repair is reported in `corrections` rather than
  made silently: element types that no longer exist (`navbar` → a `list` laid out in a row, `navbarItem` → `listItem`),
  a hover stored as a class of its own (`card:hover`) folded into the class, fields and attributes no component reads,
  a setting nothing reads, a link `target` of `_blank` (the component adds the underscore, so it rendered as `__blank`),
  `null` or an empty list where an attribute is unset, a binding to a source nothing publishes, a flow with a step that
  runs nothing, and a global callback registered on the wrong module. A CSS property the style editor cannot hold is
  kept in `customCss` under the same selector, so the page still renders it.

- **What a spec can say grew to what a document holds.** A selector carries its states and variants beside its rules —
  `styles('card', { css, states: { hover }, variants: { active } })`, and `states` on an element's own `css` — and the
  selector cache is now written by `processSelector`, the function the style editor writes it with. An element type's
  defaults (`elements`) take states, variants, per-breakpoint rules and `slots` for its other selectors (a modal's
  `rootContainer`). A space declares `layouts` — shells that pages render inside, named by `layout: { id, slot }` on a
  page or on another layout, with the slot checked to be inside the shell — and a page takes `keepState` and
  `stateStorage`. `visible: false` starts an element hidden for a flow to reveal, and `loadStrategy` is carried through.
  An element's own selector never takes the name of a declared class any more, however that class happens to be called.

- `elementAttributeNames` lists, as data, the attributes each built-in element can be authored with — `null` for one
  that takes any. It is generated from the elements' attribute types (`yarn generate:attribute-names`) and a type test
  fails when the two disagree. `defaultAttributes(type)` and `defaultLabel(type)` expose what a factory fills in.

- `CustomAttributes` accepts any attribute, because the component a custom element's `renderType` names reads its own
  attributes off it; and `FormControlAttributes` declares `previewError`, which `withFieldValue` reads.
