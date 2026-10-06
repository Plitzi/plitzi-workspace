# Efficiency: the same page with fewer elements

Every element is a node the page renders, the builder lists, the document stores and the next reader has to read. A
space written the long way still renders — nothing in it is wrong — but it is two or three times the size it needs,
and every copy is a place the next edit has to be made again. The platform has a short way for each of the long ones
below. Use it from the start; `authorSpace` points out the ones you missed.

## Read the suggestions

`authorSpace` returns `suggestions` beside `warnings` — the ones that save the most elements first, each with its code,
what to write instead, the elements it is about and how many it would save:

```ts
const { warnings, suggestions } = authorSpace(space);
// [{ code: 'repeated-on-pages', saves: 57, at: 'src/pages/docs.ts:291', elementIds: [...], message: '4 pages carry…' }]
```

`npm run author` prints them under the warnings (`[suggest]`), and `npm run author -- --json` carries them. A warning
is a bug to fix; a suggestion is a shorter way to the same page — take it unless you have a reason not to, and the
reason is usually that the copies are about to diverge. `npx @plitzi/cli explain repeated-on-pages` explains any code.

Left on purpose, say so where it is written — `quiet` on an element it is about (a component's instance too:
`component(id, { quiet })`), and it is not offered again, in the builder or over MCP either (it is kept in the
document):

```ts
const includes = (words: string) => container({ class: row, quiet: ['repeated-shape'], children: [tick, text(words)] });
```

Only a suggestion's code: a problem is never quieted (`quiet-unknown`).

## The long way, and the short one

| Written the long way | The short way | Suggestion |
| --- | --- | --- |
| The same header, footer or sidebar in every page | A **layout** holding it once; each page names it (`layout: { id, slot }`) — [layouts](layouts.md) | `repeated-on-pages` |
| A header copied per page so one link can be styled "active" | The link marks its own page: `states: { current: { … } }` on its class; `activeOn` for an entry lit on several pages | `repeated-on-pages` |
| The same card, row or tile written again with other words | A **component** with props, placed with `component(id, { props })` — [components](components.md) | `repeated-shape` |
| Rows of data written one by one, side by side | One `list` over the rows — `items: [ … ]` fixed, or bound to a source — with its row written once — [lists](lists.md). Data is the test: three cards a person rewords on the canvas read better as three cards. Copies that read different sources or write different state keys are controls written alike, and not offered | `repeated-shape` |
| `button({ children: [text('Save')] })`, `link({ children: [text('Docs'), fontAwesome({ icon })] })` | `button({ content: 'Save' })`, `link({ href, content: 'Docs', icon, iconPlacement: 'after' })` — the icon's class on the `icon` slot; what the text's class adds (`whiteSpace: 'nowrap'`) moves to the box's class — never the class itself, whose `inherit` would then point past the box and whose `pointerEvents: 'none'` would switch the box off | `content-attribute` |
| `.card:hover { … }`, `.card .icon { … }` in `customCss` | The class's own `states` and `ancestors` | `custom-css-class` |
| A reduced-motion reset, or rules showing one icon of the theme toggle, in `customCss` | Nothing: the SDK does both for every space | `custom-css-sdk-default` |
| `.Toastify__toast { font-family: …; border: … }` in `customCss` | `notifications: { font, fontSize, border, shadow, padding, … }` | `custom-css-notifications` |
| Keyframes animating `width`, `top`, `filter: blur()`, `box-shadow`, a colour in a loop | `opacity` and `transform`; decoration held until `[data-hydrated]` — [motion](colours-and-motion.md) | `heavy-animation` |

## What it declares and never uses

A big space gathers what nothing reads any more: the class kept after the last element wearing it went, the token
nobody points at, the component no page places — and the colour typed out where its token was meant. Each is one more
thing the next reader has to check is safe to change. `authorSpace` names them too:

| What it found | What to do | Suggestion |
| --- | --- | --- |
| A class in `classes` that no element, binding, flow or other class's `ancestors` names | Remove it — or wear it where it was meant to go | `unused-class` |
| A token in `variables` that no `var(--…)` reads — not a class, an element, `customCss` nor another token | Remove it, or write it where its colour is typed out | `unused-token` |
| A component that no page, layout or other component places | Remove it, or place it where it was meant to go | `unused-component` |
| A colour typed out in a class painted from the palette, equal to a token's light value | `var(--token)` when it should follow the scheme; a token of one value of its own when it must stay the same in both (dark words on a light chip) | `literal-colour` |

They are read generously, so they are never wrong: a name counts as used wherever it appears as a word, and a class
written all in literals — a sticker's paper and ink, a swatch — is a palette of its own and not named.

And a few the suggestions do not count, because they cost styles rather than elements:

- **A look used twice is a class**, written once with `styles()`; every element of a TYPE dressed the same way is the
  space's `elements` defaults (`elements: { heading: { color: 'var(--fg)' } }`), not a class on each.
- **Inner parts are slots.** A form control's input, a modal's backdrop, a theme toggle's icons: style them with
  `slots: { input: inputClass }` on the element, or the type's `slots` in `elements` — never a `customCss` rule reaching
  into the element.
- **A container with one child and nothing of its own** — no class, no flow, no condition — is an element for nothing:
  put what it was for on the child.
- **A wrapper that only marks where something goes** inside a parent that lays its children out takes
  `css: { display: 'contents' }` (a layout's slot, a layout itself in a page that is a column): no box, so the layout
  around it is what it was.

## Measured

On the seeded spaces, taking these suggestions removed a third of a restaurant site (2,533 → 1,697 elements: header
and footer into a layout), two fifths of a blog (353 → 210: the per-page header provider into the layout) and of a
sign-in space (848 → 530: the split screen into a layout) — and rendered every page pixel for pixel the same.
