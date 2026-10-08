---
'@plitzi/sdk-authoring': patch
'@plitzi/sdk-elements': patch
'@plitzi/cli': patch
'@plitzi/plitzi-sdk': patch
'@plitzi/sdk-server': patch
'@plitzi/sdk-shared': patch
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
- **A page's title can say its record** (`@plitzi/sdk-shared`, `@plitzi/sdk-server`, `@plitzi/sdk-elements`,
  `@plitzi/sdk-authoring`): `seoTitle` and `seoDescription` may be templates over the page's `runtime: 'server'`
  providers (its layouts' too) and `navigation` — `'{{ apiContainer_post.title }} — Blog'`. The server evaluates them
  as it writes the head, from the answers it already has; the browser evaluates the same over `rsc.data`, so the tab
  follows a navigation from record to record. One that reads anything else — a browser provider, `state` — is refused
  (`page-template`): it was written into the head as it was, braces included. A declaration's `serverTemplates` names
  the attributes the page server evaluates against a context of its own (a page's title and description, a provider's
  `notFound`): the element runtime leaves them as written — interpolated where the page renders, a `|default(…)`
  resolved to its fallback before the head could read the providers — and the authoring lint reads the same list.
- **A page says when its address shows nothing** (`@plitzi/sdk-server`, `@plitzi/sdk-authoring`): `notFound` on the
  page, one expression over the same answers its title reads — `"{{ not (apiContainer_feed.topics|find('slug',
  navigation.routeParams.slug)) }}"` — sends it with status 404, rendered as written. A provider's own `notFound` reads
  only its answer, and one in a layout is every page's: a record read from the layout had no way to say it was not
  there, and the page answered 200.
- **The Export keeps the flows of a plugin hosted by `custom`** (`@plitzi/sdk-authoring`): `specFromSpace` judged such
  an element by `custom`'s own triggers and callbacks, and dropped a flow on the component's event (`onChange` on an
  editor) as one "a custom never fires" — the space read back was not the space written.
- **`page check` reads every word on the page, in the colour the browser paints it** (`@plitzi/sdk-authoring`): what a
  plugin draws inside an element of the space is measured too, named by the element and a selector; the measure is
  WCAG's contrast (under 2:1 is unreadable), not "nearly the same colour"; and a colour the browser answers as
  `oklch()`, `oklab()` or `color(srgb …)` — every token and every `color-mix()` — is read as that, where it was read as
  `rgb()` numbers and came out near black. A plugin's dark-on-dark status line passed as "nothing wrong".
- **`verify` checks every theme the space can be painted in** (`@plitzi/cli`): light and dark, unless the space says
  light only — "48 checks at 1440 and 390 px, light and dark". A page unreadable in the dark theme passed in the light
  one; a failure names the theme it was found in.
- **`plitzi upgrade` says where fields became optional** (`@plitzi/cli`): for a project last upgraded before 0.38.9,
  each `formControl(…)` with no `required`, at its file and line — said, never written. And a `.gitkeep` is asked for
  only in a folder with nothing else in it: `upgrade` wrote one beside code, and `doctor` called it missing once deleted
  as AGENTS.md asks ("nothing unused") — the three now say the same.
- **`devMode` and `devReload` are the project's** (`@plitzi/sdk-server`): `src/config/serverOptions.ts` may set them,
  over `NODE_ENV`, which they still follow when left out. A deployment started without `NODE_ENV` (a container's `CMD`)
  says `devMode: false`, and a public action answers with its output alone.
- **`page shot --from load`** (`@plitzi/cli`): `--frames` start as soon as the page's HTML is in, not once it settles —
  an entrance that plays while the page loads had ended before the first picture.
- **`heavy-animation` says where each animation is** (`@plitzi/sdk-authoring`): the class and its variant, state or
  slot — or the `customCss` rule — and writes the fix against that selector. It said "in `customCss`" for an animation
  declared on a class's variant, and offered `.glow`, a class no space has.
- **`page shot --steps`** (`@plitzi/cli`): an interaction played step by step — `click`, `type`, `press`, `wait`,
  `wait-for`, `shot [label]`, `frames <n> [ms]`, separated by `;` or written in a file (`@file`) — each picture labelled
  with its step and the time since the first, and said when nothing changed since the one before. A queue filling, a
  restart, an opening frame by frame took a Playwright script of the project's own. Targets take Playwright's selectors
  too (`text=Saved`).
- **A space's task may take a `number` param** (`@plitzi/sdk-server`): saved functions refused it ("a type the builder
  cannot draw") while a project's server ran it, so code that worked self-hosted failed on the platform — and the
  builder draws one, a callback's. A step's params now arrive as the types the task declares, on every server: a
  `number` written as text is the number, a `boolean` written `'true'` is `true`, as the browser reads a callback's.
- **`page shot --as <username>`** (`@plitzi/cli`): signs in first, as `page check --as` does, the password from
  `PLITZI_CHECK_PASSWORD` in `.env`. A page for signed-in visitors was pictured as the sign-in page it sent the browser
  to, without a word; `page shot` now says when the page sent it elsewhere, and that the picture is of that page.
