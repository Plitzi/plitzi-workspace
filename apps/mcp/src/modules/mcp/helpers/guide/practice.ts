import { MOTION_ENTERS, MOTION_LOOPS } from '@plitzi/sdk-authoring';

/** Good practice: motion, accessibility and semantics. */
export const practiceGuide = `## Motion — good practices
A preset first: an element's \`motion\` field (\`upsertElement\`/\`patchElement\`) —
\`{ "enter": "fade-up", "on": "view" }\`, \`"stagger": 60\` for its children one by one, \`"easing"\`/\`"distance"\` (px) for a reference's own curve and travel, \`"loop": "float"\` — is
played by the SDK, cheap and stilled for reduced motion. \`on\`: \`load\` (default), \`view\` (once, the first time it
comes into view, then it stays) or \`scroll\` (follows the scroll both ways — it fades back out as the reader scrolls
up past it; only for an effect that is about the scroll itself). Enters: ${MOTION_ENTERS.join(', ')}; loops:
${MOTION_LOOPS.join(', ')}. Beyond them, keyframes go in \`customCss\` (\`patchSettings\`), a
definition names them (\`animation\`). Only \`opacity\` and
\`transform\` (\`translate\`, \`scale\`, \`rotate\`) animate off the main thread: they stay smooth while the page
hydrates and on a slow phone. Anything else repaints or lays the page out again on every frame, and freezes while the
page's scripts run.
- Slide, grow, fade with \`transform\` and \`opacity\` — never \`left\`, \`top\`, \`width\`, \`height\` or
  \`margin\`. Something travelling across a box is \`transform: translate(%)\` on an element as large as the box.
- No animated blur: no \`filter: blur()\` in an entrance or a loop, no \`backdrop-filter\` over moving content. A soft
  shape is a \`radial-gradient\` fading to transparent.
- Fake the expensive ones: a growing shadow is a second shadow on a pseudo-element whose \`opacity\` changes; a
  pulsing glow is a static gradient whose \`opacity\` or \`scale\` changes.
- Decoration that must animate something else (a custom property, \`background-position\`) starts paused and runs
  once the page is hydrated: \`.glow { animation: glow 8s linear infinite paused; } [data-hydrated] .glow {
  animation-play-state: running; }\` in \`customCss\`. That is for loops: an entrance of its own that plays once
  (\`transform\`/\`opacity\` only) plays from the first paint with \`backwards\`, never gated on \`[data-hydrated]\`.
- Entrances: \`opacity\` + a small \`translateY\`, under ~600ms, staggered by tens of ms.
- One slow ambient loop per screen at most — not one per card: \`infinite\` runs on every visitor's battery.
- Name what transitions (\`transition: transform 200ms, opacity 200ms\`), never \`all\`; \`will-change\` only on the
  few elements about to move.
- Reduced motion is the SDK's: it cuts every animation to an instant for whoever asks — never write that reset.

## Accessibility — pages people, screen readers and browser agents can all use
A page is read three ways: seen, heard through a screen reader, and worked by a **browser agent** (Claude in Chrome)
— which finds the controls it can press in the same **accessibility tree** a screen reader walks. A control that
tree names nothing is invisible to both, however it looks. So build every page to be operable without sight:
- **Every control has words.** A \`button\` is named by its \`content\` and the words inside it; an icon-only one needs a
  \`title\` (also its tooltip), and one whose words do not say what it does (a key hint, a count) a \`label\`. A \`link\` is named by what it holds, or \`label\` (set it on a link wrapping a whole card).
  A \`formControl\` is named by its \`label\` — keep it and set \`hideLabel: true\` when the design shows what the field
  is (a swatch, a search box); a \`placeholder\` names only a field typed into, and only until something is typed.
- **Every picture says what it shows** (\`alt\`), or is marked \`decorative: true\` when the words beside it already say
  it. A \`fontAwesome\` icon is decoration (hidden) unless its \`label\` gives it a meaning of its own.
- **Only controls are clicked.** A click flow belongs on a \`button\` (it holds children — a whole card can be one) or
  a \`link\` when it goes somewhere — never on a \`container\`, \`text\` or \`image\`: a keyboard cannot reach those and
  no agent finds them. An empty backdrop that closes a panel is the exception (the panel's close button and Escape
  are the ways everyone has).
- **State is said, not only styled.** A toggle sets \`ariaPressed\`, a button that opens a panel \`ariaExpanded\`
  (bind them like any attribute) — an "active" class alone is invisible to both readers. A button that shows and
  hides a panel names it in \`controls\` (\`aria-controls\`, the panel's anchor), and words that change while a
  visitor reads them — a count, a total, a status — sit in a \`container\` with \`live: "polite"\` (\`aria-live\`).
- **A dropdown opens from a \`button\`** among its children, outside the popup (an avatar, a "⋯": the button holds it and
  has a \`title\`). The dropdown marks it and moves the focus in and out; a box or an icon alone opens nothing from a
  keyboard.
- **An illustration** built from elements (a mock of a page, art) is a \`container\` with \`decorative: true\`: both
  readers skip it. Keep controls out of it.
- **The page has an outline.** Headings go down one level at a time (h1 → h2 → h3; size them with their class, not
  their level). Landmarks are containers with a tag — \`header\`, \`nav\`, \`main\`, \`aside\`, \`footer\` — and a
  \`label\` when a page has two of one kind; a \`section\` with a \`label\` is a region an assistant can jump to.
- **What comes built in:** modals and dialogs are \`dialog\`s named by their title, take the focus, keep Tab inside
  and close on Escape; tabs are a tab list worked with the arrow keys; a field that breaks a rule is marked invalid and
  described by its message; the pager marks the current page. Nothing to add for those.
- **A canvas is a picture** to both readers. A plugin that draws (a chart, a board, a map) also renders what it shows
  as real elements — a list, a table — with a button for every action; one hidden until focused cannot be clicked by an
  agent that clicks by position, so offer a visible "list view".
The linter warns about these (\`control-without-name\`, \`image-without-alt\`, \`click-on-static-element\`,
\`dropdown-without-control\`, \`heading-level-skipped\`, \`label-ignored\`, \`control-in-decorative\`) on every element
you touch; fix them in the same batch. Then look:
\`plitzi_look\` shows the page as those readers get it, and lists what has no name.

## Semantics
- **props are fully replaced** on \`upsertElement\`: send every prop you want to keep. To change only some props,
  use **\`patchElement\`** — it merges \`props\`/\`style\` onto the existing element (listed keys change, \`null\` unsets
  a key, everything else is preserved) and never creates. Combined with \`plitzi_search\` (which returns the ref +
  stateVersion), a targeted edit is two calls with no read.
- **definition CSS is fully replaced** on \`upsertDefinition\`: send every property you want to keep. To change only
  some declarations, use **\`patchDefinition\`** — it merges CSS per breakpoint/state/variant/slot onto the existing
  definition (listed keys change, \`null\` removes a property, everything else is preserved) and never creates.
  Example — recolor one definition without resending it: \`{ "type": "patchDefinition", "ref": "btn-x",
  "desktop": { "background-color": "#111" } }\`.
- **Atomic batches**: if any operation fails, \`plitzi_apply\` persists nothing.
- **Every element you touch must be malformation-free — pre-existing errors block the save.** When your batch edits
  an element, the result is read by the same linter every writer of a space is held to, and the element's **current
  stored content** with it — a broken transformer action, a malformed step, an attribute it never reads — even in
  parts your edit does not touch. Such a finding is reported as a \`Pre-existing malformation in element …\` **error**, and
  \`plitzi_apply\` rejects the batch until it is fixed. These are **not caused by your change** (the message says so)
  — do not be confused; fix them **in the same batch** and re-apply. Because the check runs on the resulting state,
  including the fix in your batch is exactly what unblocks the save. (Advisory issues — an unobserved source/action
  name that may still be a valid plugin, a binding target a plugin manifest does not list — come back as
  \`Pre-existing issue …\` **warnings** and do not block.) Elements you do not touch are not held against you — except
  that a broken tree your batch leaves anywhere (an element orphaned by a delete) is refused.
- **Optimistic concurrency — read before you write, and prove your read is current.** Editing a resource means you
  read it first, so you hold its \`stateVersion\`. **Always pass \`expectedResourceVersions\`** (URI → the stateVersion
  you read) for every resource your batch changes. If another agent edited it in the meantime, the live version no
  longer matches and apply is **rejected with a conflict** — nothing persists. Then re-read the reported resources
  (their new content + version) and retry on top of the fresh state. This is exactly how a file editor forces a
  re-read after a stale write: it is what keeps concurrent agents from silently overwriting each other's changes, so
  never omit it "to save a call".

## The space's own tests — \`plitzi_test\`
A space keeps its tests in its document, and **a snapshot and a publish wait for them**: what you change must leave them
passing. Two kinds — the builder calls them **element checks** (unit) and **journeys** (e2e: what a visitor does, from
start to end — not an interaction's flow). \`plitzi_test { action: 'list' }\` says them and how the element checks
stand; \`run\` plays the journeys on the draft, where the deployment has a browser — one play at a time per space, each
journey counted against the plan's month (a refusal says why, and when it comes back). Write them whole with \`set\`:
- \`unit\`: \`{ id, title, element, given: { state, sources }, expect: [{ kind: 'visible' | 'attribute' | 'style' |
  'variant' | 'state', … }] }\` — one element resolved for a state, no browser.
- \`e2e\`: \`{ id, title, page, width, steps: [{ kind: 'click', element }, { kind: 'expectText', element, text }, …] }\`
  — a visitor's steps on a page, elements by id (a list's copy \`row:3\`), what must hold between them; \`type\` names
  a form control and writes in its field; \`page\` may be a wrong address the space's own not-found page answers.
  \`{ kind: 'expectCheck', check: '<unit id>' }\` holds an element check for the state the journey reached;
  \`given: { state: { … } }\` starts it with a state; \`as: '<account>'\` plays it signed in as a test account.
- \`accounts\`: \`{ id, email?, roles?, permissions? }\` — who a journey plays as, declared here alone: no real account
  and no password, so what the page asks the API it asks as a guest — a page for signed-in visitors, a role's view.
The primer names both kinds' ids and titles.
A batch that leaves a test unreadable — an element it presses removed, the page it starts on renamed — says so in its
warnings ("This change leaves a test of the space unreadable…"): fix the test in the same batch, or say why.
When a test fails over a change the user asked for, say so and fix the test with them — never delete it to pass.
The plan keeps a number of journeys per space (Free one): a \`set\` that adds past it is refused, naming the plan that
keeps more — tell the user; never remove a journey of theirs to make room.
`;
