/** Styling: classes and selectors, variants and state, variables, tokens and fonts. */
export const stylingGuide = `## Styling (crosses both schemas)
- **Mind the type's intrinsic default style.** A type renders with a base CSS *before* any class is attached — read
  it from \`defaultStyle\` on the type in \`plitzi://types\` (the primer includes it). Do not assume \`display: block\`:
  \`text\`, for one, defaults to \`display: inline\`, so margins/width/vertical padding behave differently. If you need
  block/flex layout on such an element, set \`display\` explicitly in your definition rather than relying on a default.
- **Images: preserve aspect ratio.** Setting only \`width\` and \`height\` (or forcing both) distorts an image. Change
  one dimension and let the other be \`auto\`, or set \`aspect-ratio\` with \`object-fit: cover\`/\`contain\`, so the
  image scales without stretching.
- **Font size and line height move together.** When you change \`font-size\`, set \`line-height\` in the same edit
  (prefer a unitless ratio like \`1.5\`, which tracks the font size). Changing one without the other leaves cramped or
  loosely-spaced text — they are a joint change, not two separate ones.
- A definition lives in the **style schema**; an element's \`style.base\` (element schema) is the link that applies
  it. Styling an element = upsertDefinitions + upsertElement with that ref in \`style.base\`, in one batch.
- **Repeating siblings**: when a set of siblings shares a shape and differs only in data (a list, cards, rows,
  steps), use \`repeatElement\` — the template once with \`{{item.field}}\` placeholders plus \`items\`, which
  creates the wrapper and numbers each row's refs (\`step-1\`, \`step-2\`…). A list inside each row is the same op:
  the wrapping node carries \`repeat: { items: "{{item.<list>}}", template: … }\` and its refs number both levels
  (\`blk-2-3\`). Copy-pasting the subtree N times costs N times the tokens and drifts.
- CSS keys are **kebab-case** (\`background-color\`). camelCase is rejected — read \`plitzi://css-properties\`.
- **Write normal CSS — shorthands are accepted and expanded for you.** \`border\`, \`border-{side}\`,
  \`border-width\`/\`-color\`/\`-style\`, \`border-radius\`, \`padding\`, \`margin\`, \`inset\`, \`gap\`, \`overflow\`,
  \`flex\`, \`flex-flow\`, \`background\`, \`font\`, \`transition\`, \`animation\`, \`grid\`, \`grid-template\`,
  \`grid-area\`, \`grid-row\`, \`grid-column\`, \`place-content\`, \`place-items\`, \`place-self\`, \`outline\`,
  \`columns\`, \`list-style\`, \`text-decoration\` — the full list is in \`plitzi://css-properties\` under
  \`shorthands\`. They **persist as longhand keys** (that is what a read gives back), so a breakpoint/state/variant
  can still override one property at a time.
  - \`border: 1px solid red\` → \`border-top-width: 1px\`, \`border-top-style: solid\`, \`border-top-color: red\`, …
    for all four sides. A shorthand also RESETS what it omits, so \`border: none\` clears a width a previous
    definition set.
  - Comma-separated layers are kept per longhand: \`transition: opacity 200ms, transform 300ms\` →
    \`transition-property: opacity, transform\` + \`transition-duration: 200ms, 300ms\`.
  - A \`background\` with a bare \`var(--x)\` part is refused: what the variable holds decides the longhand —
    \`background-color\` for a colour, \`background-image\` for a gradient or a picture. A var() inside one
    (\`linear-gradient(…, var(--x))\`) is read as it is.
  - In a **patch**, a shorthand replaces the longhands it controls (\`padding: 8px\` overwrites a previous
    \`padding-left\`), and \`"border": null\` removes all twelve border longhands.
- **Flex layout is not a \`flex\` value**: set \`display: flex\` **plus** \`flex-direction\`, \`align-items\`,
  \`justify-content\` as separate properties.
- CSS is grouped by breakpoint: \`desktop\`, \`tablet\`, \`mobile\`.
- Reference a style variable in CSS as \`var(--name)\`; a schema variable in a prop as \`{{name}}\`.
- \`element.style.base\` is a **list** of definition refs; other slots go under \`element.style.slots\` — the slots
  \`plitzi://explain/{type}\` lists, never custom CSS on the SDK's own class names. A \`markdown\` or a \`richText\`
  has a slot per part of the document it writes (\`heading\`, \`heading2\`, \`paragraph\`, \`link\`, \`code\`,
  \`codeBlockFrame\`…); a \`formControl\` its \`input\` box, the \`field\` inside it, \`label\`, \`requiredMark\`, \`error\`;
  a \`pagination\` its \`previous\`, \`page\`, \`next\` (the page shown is the class's \`current\` state).
- **An element can attach SEVERAL classes at once, and they all apply.** \`style.base\` holds a list, and each
  non-base slot holds its own — every attached definition contributes CSS, and they **cascade** (a later class, then a
  global/id rule, overrides an earlier one on the same property). So when a style looks wrong, the culprit may be
  ANY attached class, not the one you just edited: read the element's \`resolvedStyle\` (it inlines the CSS of every
  class it attaches, keyed by ref) together with its \`globalStyles\`/\`idStyle\` and the type's \`defaultStyle\`, and
  fix the class that actually sets the property — do not just pile another class on top.
- **Three kinds of style live in the style schema — do not confuse them:**
  - **Definitions** = reusable CSS **classes** (\`upsertDefinition\`/\`patchDefinition\`/\`deleteDefinition\`, keyed by a
    class \`ref\`). Attach one to an element via \`style.base\` to style **that** element (and anything else that opts in).
    This is the **default** way to style one element. Declaring MORE than one class in a batch? Use
    \`upsertDefinitions\` — one op carrying \`{ "<class>": { desktop: … }, … }\`, same result as the run of
    \`upsertDefinition\` it replaces, without repeating the envelope once per class.
  - **Global styles** = the CSS equivalent of a bare element selector like \`button { … }\`
    (\`upsertGlobalStyle\`/\`patchGlobalStyle\`/\`deleteGlobalStyle\`, keyed by \`componentType\`). They style **every**
    element of that type at once. Use these for site-wide intent — e.g. "all buttons rounded":
    \`{ "type": "upsertGlobalStyle", "componentType": "button", "desktop": { "border-radius": "9999px" } }\`.
  - **Id styles** = the CSS equivalent of an id selector like \`#hero { … }\`
    (\`upsertIdStyle\`/\`patchIdStyle\`/\`deleteIdStyle\`, keyed by \`targetId\`). They style the **single** element whose
    DOM \`id\` attribute equals \`targetId\` — so the element must carry that \`id\` (set it in its props). Prefer a
    **definition** for one element; reach for an id style only when a specific, uniquely-identified node must be
    targeted by id: \`{ "type": "upsertIdStyle", "targetId": "hero", "desktop": { "min-height": "100vh" } }\`.
  - The three share one name space, so an op refuses a name held by another kind (guards against a typo silently
    rewriting every element of a type, or converting a class into an id rule). If refused, you targeted the wrong
    kind — switch tools or rename.

## Style variants & element state
A **variant** is a named CSS override on a definition (e.g. a button class with a \`primary\` variant). It takes two
steps across the two schemas:
- **Declare** the variant CSS on the class (style schema): \`upsertDefinition\`/\`patchDefinition\` with
  \`variants: { "primary": { "desktop": { "background-color": "#111" } } }\` (per slot under \`slots.<slot>.variants\`).
- **Apply** it to an element (element schema): \`initialState.styleVariant\` =
  \`{ "<class-ref>": { "base": "primary" } }\` — a slot name instead of \`base\` targets that slot; an array applies
  several. Set it via \`upsertElement\`/\`patchElement\`.
An element read reports \`availableVariants\` (which variant each attached class offers) and the element's current
\`initialState\`, so you can see a button **has** a \`primary\` variant and whether it uses it. If the user asks for a
variant that does not exist yet, **create it (upsertDefinition variants) and apply it in the same batch**.
- \`initialState.visibility\` (boolean) sets whether the element starts shown or hidden.
- The \`hidden\` state of a class is how it looks while hidden — where it goes and where it comes from. With a
  \`transition\` that includes \`display 200ms allow-discrete\`, it fades or slides in and out instead of blinking.

**Ancestor conditions** — a class that changes inside an ANCESTOR (\`.toolbar .icon\`), or while that ancestor is
hovered or in a variant (\`.card:hover .icon\`, a collapsed sidebar hiding its labels) is \`ancestors\` on that class,
keyed by a class the ancestor wears: \`ancestors: { "toolbar": { "desktop": { … } }, "card": { "states": { "hover":
{ "desktop": { … } } } }, "sidebar": { "variants": { "collapsed": … } } }\`.
Any ancestor counts, not only the parent; the class's own states and variants win over these. Never customCss for it.
\`">"\` keys the parent, whatever it wears — a component's part reacting to what it sits in.

**Pseudo-elements and conditions** sit beside \`states\` in a definition and in each of its variants:
\`pseudos: { "after": { "desktop": { "content": "\\"→\\"" }, "states": { "hover": { "desktop": { … } } } } }\`
(\`before\`/\`after\` are drawn only with a quoted \`content\`; also \`selection\`, \`marker\`, \`placeholder\`,
\`first-letter\`, \`first-line\`), and \`conditions: { "motion-reduce": { "desktop": { … } }, "container (max-width:
30rem)": { … } }\` (the nearest ancestor whose class sets \`container-type\`). A patch keeps the ones it does not name;
\`null\` removes one. A state beyond \`hover\`/\`focus-visible\`/\`current\`: \`expanded\` (an open trigger), \`first\`,
\`last\`, \`odd\`, \`even\`.

## Variables, design tokens and fonts
- **Schema variables** are space-wide values a prop reads as \`{{name}}\`: \`upsertVariable { name, variableType,
  value, category?, subValues? }\` (\`variableType\` is the runtime type — \`text\`, \`number\`, … — not the op's
  \`type\`), \`deleteVariable { name }\`.
- **Design tokens** are CSS values a definition reads as \`var(--name)\`: \`upsertStyleVariable { category, name,
  value }\` with \`category\` one of \`color\`, \`spacing\`, \`shadow\`, \`custom\` and \`name\` without the \`--\`. A
  \`value\` may be one string or \`{ light, dark }\`, so a colour follows the theme. \`deleteStyleVariable\` removes one.
  Reach for a token whenever a value repeats across classes — a hardcoded colour is a colour the theme cannot change.
- **Fonts**: a \`font-family\` only renders in its face when the space loads that family. \`upsertFont { family,
  source, fallback, weights? }\` declares one — \`source\` \`google\` needs nothing else, \`remote\` a \`stylesheet\` or
  \`files\` URL, \`system\` loads nothing. \`deleteFont { family }\` stops loading it; rules that still name it render
  in their fallback.

`;
