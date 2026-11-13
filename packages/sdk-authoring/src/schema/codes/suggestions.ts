import type { AuthoringCodeEntry } from './entry';

/**
 * Suggestions: nothing is wrong, and the same page can be written with fewer elements or less CSS — or read better by
 * assistive technology and search engines (its headings' outline).
 */
export const SUGGESTION_CODES = {
  'heading-level-skipped': {
    kind: 'suggested',
    means:
      'an `h4` right after an `h2` on a page as it is drawn — inside its layouts, with the headings a `markdown` writes, and without those that start hidden (`visible: false`): the outline misses a level (Lighthouse: "not in a sequentially-descending order")',
    fix: 'the next level down; size it with its class'
  },
  'page-without-main': {
    kind: 'suggested',
    means:
      'a page that draws no `main` landmark — neither it nor its layouts: a screen reader skipping to the content and a browser agent find no place where the page\'s own content starts (Lighthouse: "Document does not have a main landmark")',
    fix: "the container holding the page's content drawn as `main` (`container({ subType: 'main', children })`) — in the layout's slot when its pages share the shell — once a page"
  },
  'repeated-on-pages': {
    kind: 'suggested',
    means: 'the same block — a header, a footer, a side panel — written into several pages',
    fix: 'a layout holding it once (`layouts`, and `layout: { id, slot }` on each page) — a component when only some pages of a layout carry it, written in its area’s folder and listed in the space’s `components`; a link marks its own page with the `current` state'
  },
  'heavy-page': {
    kind: 'suggested',
    means:
      'one page whose part of the document passes 250 KB — every visitor downloads it before the page is theirs — with the shapes written again most inside it, by what they weigh',
    fix: "the rows of data as one `list` of a component, read from the data (`list({ items, row })`), and a block written per state as one element whose state picks its content: the document then holds one copy — or, for an app's page heavy for how many elements it has, `quiet: ['heavy-page']` on the page, with why"
  },
  'desktop-only': {
    kind: 'suggested',
    means:
      'a page, layout or component styled for the desktop alone where a phone (390 px) breaks — a width past 480 px with no `max-width` holding it; a grid whose fixed columns and gaps are wider than a phone, or three or more columns sharing its width a page’s parts apart (a gap of 16 px or more) and left narrower than 120 px each; type past 64 px — that no `mobile` rule of the classes on it sets again (a style’s `mobile` is laid over its `desktop` alone, so a `tablet` rule does not reach a phone). What a `mobile` rule hides is left out, as is a grid it lays out otherwise (`display: flex`), a width inside a box that clips or scrolls it sideways (`overflow-x: auto` round a table), a layout fluid on its own — wrapping flex, `%`, `min()`, `clamp()`, `repeat(auto-fit, minmax(…))` —, a row whose one column grows (`48px 1fr auto`), a dense widget’s many thin columns, and a space written mobile first',
    fix: "the phone's value in the class's `mobile` rules (`styles('card', { css: { desktop: { … }, mobile: { gridTemplateColumns: '1fr' } } })`), or a value fluid on its own — `width: 'min(960px, 100%)'`, `font-size: 'clamp(32px, 6vw, 72px)'`, `grid-template-columns: 'repeat(auto-fit, minmax(240px, 1fr))'` — or, for a surface only a desktop opens, `quiet: ['desktop-only']` on it, with why"
  },
  'heavy-layout': {
    kind: 'suggested',
    means:
      'one layout whose own part of the document passes 250 KB — every page drawn in it is downloaded with it, the first a visitor opens at least — with how many pages carry it and what 10,000 first visits move for it',
    fix: "what only some of its pages show moved into those pages, or into a component they place; rows of data as one `list` of a component (`list({ items, row })`) — or, for a shell heavy on purpose, `quiet: ['heavy-layout']` on the layout, with why"
  },
  'many-elements': {
    kind: 'suggested',
    means:
      'a page that builds more than 1,500 elements as it opens — its own, its layouts’ and its components’ once per instance, not those that start hidden with `loadStrategy` `lazy` or `visible` — with what a visit downloads for them: a phone builds, styles and lays out each before the page answers (Lighthouse flags a page past about 1,400)',
    fix: "`loadStrategy: 'lazy'` on what starts hidden until something shows it (`visible: false`) — a tab, a panel, a dialog — so it is built the first time it is shown (one a condition shows may be on screen at once, and is not named); rows of data as one `list`; a part few visitors reach as a page of its own — or, for an app's page rich on purpose, `quiet: ['many-elements']` on the page, with why"
  },
  'repeated-expression': {
    kind: 'suggested',
    means:
      'the same long expression — its numbers and words aside — written into many bindings, steps or attributes: a sum or a choice worked out again in every copy, and carried by the document once per copy',
    fix: "what the copies share as a computed value (`computed: { chosen: '{{ … }}' }`, read as `computed.chosen`), answering `null` off the page that reads it (`navigation.currentPageId`), each copy keeping what differs; copies side by side as one `list` whose rows carry what differs (`list({ items, row })`)"
  },
  'repeated-shape': {
    kind: 'suggested',
    means:
      'the same structure written again and again with different words — cards, rows, tiles. Copies that read their data in a form of their own (their template) or render on the server are no repeats, and neither are copies side by side wired to different sources or state keys — controls written alike; copies apart that read different sources are one component, each instance handed its own',
    fix: "a component with props (`components`, `component(id, { props })`) — a source a copy reads handed in as a bound `json` prop (`component(id, { bind: [{ to: 'items', source }] })`, read inside as `props.items`) — or one `list` when they are rows of data side by side; a few cards a person rewords on the canvas can stay cards"
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
    fix: "a page whose slug is `'*'`: `{ id: 'not-found', name: 'Not found', slug: '*', layout: …, body: [...] }`",
    authoringOnly: 'that the page was added: written, it is a page like any other'
  },
  'unused-plugin': {
    kind: 'suggested',
    means: 'a plugin the project declares that no page, layout or component places — built and shipped, drawn nowhere',
    fix: 'place it where it was meant to go, or remove its folder from `src/plugins/`'
  },
  'unused-component': {
    kind: 'suggested',
    means: 'a component no page, layout or other component places',
    fix: 'remove it from `components`, or place it where it was meant to go'
  },
  'class-overrides-class': {
    kind: 'suggested',
    means:
      "one class's shorthand erasing the longhand another class on the same element writes out — `padding` over `padding-top` — or the same property set over the class listed after it — `gap` over `gap` — because the stylesheet writes it later: classes in the order they are first met, a breakpoint's rules after the base, never the order of a class list",
    fix: "the longhands the shorthand means instead of it (`padding-left`, `padding-right`), so it leaves the other class's alone; the same property, left to one of the two or written on the element itself — or `quiet: ['class-overrides-class']` when the winner is meant to win",
    authoringOnly: 'the shorthand a rule was written with — the stylesheet holds the longhands it stands for'
  }
} as const satisfies Record<string, AuthoringCodeEntry>;
