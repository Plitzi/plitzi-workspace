import type { AuthoringCodeEntry } from './entry';

/** Suggestions: nothing is wrong, and the same page can be written with fewer elements or less CSS. */
export const SUGGESTION_CODES = {
  'repeated-on-pages': {
    kind: 'suggested',
    means: 'the same block — a header, a footer, a side panel — written into several pages',
    fix: 'a layout holding it once (`layouts`, and `layout: { id, slot }` on each page) — a component when only some pages of a layout carry it, written in its area’s folder and listed in the space’s `components`; a link marks its own page with the `current` state'
  },
  'repeated-shape': {
    kind: 'suggested',
    means:
      'the same structure written again and again with different words — cards, rows, tiles; copies that bind different data, read their own template or render on the server are controls, not repeats',
    fix: 'a component with props (`components`, `component(id, { props })`), or one `list` when they are rows of data side by side — a few cards a person rewords on the canvas can stay cards'
  },
  'element-color-inherited': {
    kind: 'suggested',
    means:
      "`elements` giving a type — a heading, a text, a link — `color: inherit` or the page's own colour, which it takes by itself",
    fix: 'remove it, and name the colour once on `elements.page`: every element reads in the page’s colour, a link’s words included'
  },
  'plugin-custom-host': {
    kind: 'suggested',
    means: 'a `custom` element naming, by `renderType`, a plugin whose declaration the space was handed',
    fix: 'place it from its declaration — `const seatPicker = defineElement(declaration)`, then `seatPicker({ id, … })`: typed by what it declares (a `definePlugin` declaration carries its attributes), the element the builder adds too'
  },
  'content-attribute': {
    kind: 'suggested',
    means:
      'a button or a link whose children are only its words and an icon — a `text`, a `fontAwesome` — elements more than it needs',
    fix: "its own `content` and `icon` (`link({ href, content: 'Docs', icon: 'fa-solid fa-arrow-right', iconPlacement: 'after' })`); the icon's class goes on the `icon` slot, and what the text's class adds on the box's class, never the class itself"
  },
  'custom-css-class': {
    kind: 'suggested',
    means: 'a `customCss` rule a class can hold — `.card:hover`, `.panel .icon`',
    fix: "the class's own `states` or `ancestors`, where the style editor reads it back and a breakpoint can change it"
  },
  'custom-css-sdk-default': {
    kind: 'suggested',
    means:
      '`customCss` repeating what the SDK already does for every space — less motion when asked, the theme toggle showing one icon',
    fix: 'nothing: remove it'
  },
  'custom-css-slot': {
    kind: 'suggested',
    means:
      "a part of a built-in element dressed in `customCss` by the SDK's markup — a form control's `<input>`, a pager's buttons, a heading inside a markdown",
    fix: 'a class on the slot of that part — `slots: { field: input }`, `elements.<type>.slots` — with its states'
  },
  'custom-css-notifications': {
    kind: 'suggested',
    means: 'the toasts or their icon, close button or progress bar dressed with `.Toastify__*` rules in `customCss`',
    fix: '`notifications: { font, fontSize, fontWeight, minHeight, iconSize, closeColor, progressHeight, … }`'
  },
  'heavy-animation': {
    kind: 'suggested',
    means:
      'keyframes animating what the browser repaints or lays out again on every frame — a size, a position, a blur, a shadow, or a colour in a loop — which stutters whenever the page is busy, most of all while it loads',
    fix: '`opacity` and `transform`: a size or a position is `translate`/`scale`, a blur or a shadow is the `opacity` of a layer carrying it; a loop that must animate anything else starts `paused` and runs under `[data-hydrated]`'
  },
  'unused-class': {
    kind: 'suggested',
    means: 'a class declared in `classes` that no element, binding, flow or other class names',
    fix: 'remove it from `classes` — or wear it where it was meant to go'
  },
  'unused-token': {
    kind: 'suggested',
    means: 'a token of `variables` no `var(--…)` reads — not a class, an element, `customCss` nor another token',
    fix: 'remove it, or write it where its colour is written out'
  },
  'literal-colour': {
    kind: 'suggested',
    means:
      'a colour written out in a class where the space has a token of that value — it stays put in the dark scheme',
    fix: '`var(--token)` when it should follow the scheme; a token of one value of its own when it must stay the same in both'
  },
  'not-found-page': {
    kind: 'suggested',
    means:
      'a space with no page of its own for an address no other page answers — a plain one was added, in the home page’s layout, sent with status 404',
    fix: "a page whose slug is `'*'`: `{ id: 'not-found', name: 'Not found', slug: '*', layout: …, body: [...] }`"
  },
  'unused-component': {
    kind: 'suggested',
    means: 'a component no page, layout or other component places',
    fix: 'remove it from `components`, or place it where it was meant to go'
  },
  'class-overrides-class': {
    kind: 'suggested',
    means:
      "one class's shorthand erasing the longhand another class on the same element writes out — `padding` over `padding-top` — because the stylesheet writes it later: classes in the order they are first met, a breakpoint's rules after the base, never the order of a class list",
    fix: "the longhands the shorthand means instead of it (`padding-left`, `padding-right`), so it leaves the other class's alone — or `quiet: ['class-overrides-class']` when the shorthand is meant to win"
  }
} as const satisfies Record<string, AuthoringCodeEntry>;
