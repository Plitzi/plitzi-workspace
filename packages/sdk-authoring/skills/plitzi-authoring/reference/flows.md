# Flows

```ts
button({
  id: 'cta',
  content: 'Get a quote',
  flows: [
    [
      onClick(),
      named('quote', runServerAction({ actionId: 'shipping-quote', input: { city: 'Berlin' }, mode: 'await' })),
      whenSucceeded('quote', setState({ key: 'quote', type: 'text', value: '{{ quote.output.summary }}' })),
      whenFailed('quote', addNotification({ content: 'Could not reach the courier', appearance: 'danger' }))
    ]
  ]
});
```

A flow is a list: a trigger, then steps in order. "Only if" is on the step (`when`, `whenSucceeded`, `whenFailed`),
never a nested tree. A step that belongs to a feature still behind a [feature flag](feature-flags.md) reads it like any
source — `when({ field: 'flags.newCheckout', operator: '=', value: true }, …)` — and a server action's steps see the
same flags, decided on the server. Use the step builders — they fill in where a step runs and what it takes:

- **Where it runs.** A global callback registers under its source MODULE (`state`, `auth`, `actions`), an element
  callback under an element's id, a utility under nothing. Either half named wrong is a control that silently does
  nothing.
- **Which `setState`.** `setState({ key })` writes `runtime.state.<key>` and is read as `state.<key>`; never put
  `state.` in the key. `updateElement(…)` changes one element's own attribute or state.
- **Flip in one step.** `toggleState({ key })` for app state, `toggleElement({ category: 'state', key: 'visibility' },
'panel')` to show/hide an element. Never two branches under opposite `when` guards — the second reads what the
  first just wrote and flips it back. A key never set toggles to `true`, so for something shown by default name the
  key for hiding it (`sidebarCollapsed`).
- **A trigger fired again while its flow runs is IGNORED** (`skip`, the default — no double submit). For a stream of
  events that must each run, wrap the trigger: `whileRunning('queue', on('onArrival'))` (in order) or `'parallel'`.
  Where only the newest firing matters — a search as you type — `whileRunning('latest', …)`: the run in progress
  stops (no further step; its server action or request is cancelled) and the new one runs. With a `delay(450)` first
  it is a debounce: each firing stops the one still waiting, and only the last gets past the wait.
- **Each step reads the page as it is when it runs.** A `when` or a `{{ state.x }}` after a `setState` sees the new
  value, and one after a `delay` or a server action sees whatever changed meanwhile. To act on the value from BEFORE
  a write, put the step that reads it first.
- **Keys are flat names.** A dotted key (`docsClosed.start`) is split into a path; use `docsClosedStart`.
- **`setState` types**: `text`, `number` (decimals kept), `boolean` (the word or a real boolean), and `json` for an
  object or a list — `value: '{{ list_rows.item }}'` stores the row itself; JSON text is parsed, and text that is not
  JSON fails the step (the dev tools log it) instead of storing the text.

## What a trigger hands the flow

Name the trigger (`named('changed', on('onChange'))`) and read its payload as `{{ changed.<field> }}`:

| Trigger                                                                                                | Payload                                                 |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| `onChange` (formControl)                                                                               | `value` (a boolean for a checkbox or switch), `name`    |
| `onSubmit` (form)                                                                                      | `values` (by control `name`), `actionUrl`, `method`     |
| `onPageLoad` (page)                                                                                    | `pageId`, `routeParams`, `queryParams`                  |
| `onApiSuccess` / `onApiError` (apiContainer)                                                           | `url`, `method`, `status`, `data`                       |
| `onModalOpen` / `onModalClose`, `onDialogOpen` / `onDialogClose` / `onDialogAccept` / `onDialogReject` | `metadata` — what `openModal` / `openDialog` was handed |
| `onPageChange` (pagination)                                                                            | `page`                                                  |
| `onThemeChange` (themeToggle)                                                                          | `theme`                                                 |

## Reading what came before

`named('quote', step)` is how a later step reads an earlier one: `{{ quote.output.total }}`. The trigger too:
`named('submitted', onSubmit())` → `{{ submitted.values.email }}`. Unnamed steps get ids nothing can refer to.

`whenSucceeded` / `whenFailed` read a server action's `status` (`runServerAction` only); any other step is asked what
it publishes (`npx @plitzi/cli explain login` lists it) — after `named('signedIn', authLogin(…))`,
`when({ field: 'signedIn.ok', operator: '=', value: true }, …)`.

A step's params are templates, evaluated in full (conditions, loops, filters). A source in them is named in full:
a row's button posts `{ jobId: '{{ list_jobRows.item.id }}' }` — the row that was clicked; the short name is refused.

**Pass objects, not JSON text.** `input: { title: '{{ form.values.title }}' }` rather than `input: '{"title": …}'`:
each value keeps its own type, and nothing depends on the quoting.

**A field left empty is not in `values`.** A form sends what was typed, and a field nobody typed in sends nothing —
so `when({ field: 'sent.values.code', operator: '=', value: '' }, …)` never holds for it. Ask
`operator: 'empty'` / `'notEmpty'` (no `value`), which treat missing and `''` alike.

## Writes and what they refresh

`webHook` (not GET) refreshes every request to its own site when it succeeds; `runServerAction` refreshes
everything, server-driven providers included. Say what it should refresh — `invalidateQueries: 'elements', invalidateElements: ['orders']` — or
`'none'` for a step that only reads, or when a refresh would make the page act on the new answer mid-flow.

## Triggers belong to the element that fires them

Every element fires `onClick`, `onPointerDown` (the press, before it is a click — where a drag away from it starts),
`onLoad`, `onHover`, `onMouseEnter`/`onMouseLeave`, `onFocus`/`onBlur` and the ends of a
server action it started (`onFlowEnd`, `onFlowError`, `onFlowProgress`). A `page` fires `onPageLoad`, a `form`
`onSubmit`, a `formControl` `onChange`, an `apiContainer` `onApiSuccess`/`onApiError` (each answer, either runtime,
each refresh), a `modalContainer` `onModalOpen`/`onModalClose`, a `pagination` `onPageChange`. A flow on an element
that never fires its trigger is refused, naming the type that does.

**Keyboard shortcuts** are a trigger every element has: `onKey('f')`, `onKey('shift+f')`, `onKey('mod+k')` (⌘ on a
Mac, Ctrl elsewhere), several with commas (`onKey('plus, =')`). Heard on the whole page while the element is mounted,
so put it on the element whose flows it drives — `onKey('plus'), declaredCallback(map, 'zoomIn', { on: 'map' })` — or
on the page. A press while typing in a field is the field's, unless Ctrl/⌘/Alt is held or the key is Escape.
`{{ <step>.key }}` is the key pressed (`shift+f`). A shortcut that cannot fire (`'ctrl+shift'`, `'arrowupp'`) is refused
where it is written.

**Something every few seconds** — an autoplay, a clock — is `onInterval(ms)`, a trigger every element has:
`[[onInterval(5000), cycleState({ key: 'slide', length: 4 })]]`. It
ticks while the element is mounted and the tab is in view, never in the builder outside preview, at least every 250 ms
(`trigger-interval` otherwise). To pause it, give its steps a condition — a state that `on('onMouseEnter')` sets and
`on('onMouseLeave')` clears. `{{ <step>.count }}` is how many times it has ticked. No plugin needed.

**A number that goes round, or stops:** `cycleState({ key: 'slide', length: 4 })` is "next" — after the last the first
— and `by: -1` "previous"; `stepState({ key: 'shown', by: 40, max: 'apiContainer_site.data.total' })` adds and stops
at the bound.

**Scrolling** is a step on the element whose box scrolls (`overflow-x: auto` on a row of cards): `scrollBy('cards',
{ x: '80%' })` moves it by most of what it shows (`'-80%'` back, `'240'` pixels), `scrollTo('cards', { x: 'end' })`
to an end or a place, and `scrollIntoView('answer', { block: 'center' })` brings an element into view. `onScroll()`
fires as the box moves and once on mount, with `{ x, y, atStart, atEnd }` — what an arrow that hides at the end reads
(recipes/scroll-a-row.ts). A link to a section needs none of this: an `anchor` and a link's `hash`.

**A form's flow goes on the `form`**, which hands its submit over with `managedByInteractions: true`
(`FORM_SUBMIT_UNMANAGED` otherwise — the browser submits it natively and `onSubmit` never fires):

```ts
form({
  id: 'signup',
  managedByInteractions: true,
  flows: [
    [named('submitted', onSubmit()), setState({ key: 'email', type: 'text', value: '{{ submitted.values.email }}' })]
  ],
  children: [
    formControl({ id: 'email', name: 'email', label: 'Email', subType: 'email' }),
    button({ content: 'Sign up', subType: 'submit' })
  ]
});
```

A `formControl` is optional unless it says `required: true`, as an HTML field is. A required field that is empty stops
the submit, and the browser says which.

## Notifications

`addNotification({ content: 'Saved', appearance: 'success' })` — `appearance` is `success`, `danger`, `warning` or
`info`. They follow the page's theme; how they look is the space's `notifications` — colours (`background`, `text`,
`success`, `danger`, `warning`, `info`), shape (`radius`, `font`, `fontSize`, `fontWeight`, `lineHeight`, `minHeight`,
`border`, `shadow`, `padding`) and the parts inside (`iconSize`, `iconGap`, `closeColor`, `closeOpacity`,
`progressHeight`), one CSS value each: `notifications: { background: 'var(--card)', radius: '12px', iconSize: '18px' }`.
The toast carries no class of the space's, so this — not a `.Toastify__*` rule in `customCss` — is where it is
dressed.

Copy link: `copyToClipboard('{{ navigation.href }}')`, then the toast — it fails with no clipboard.

## Modals, dropdowns, tabs

- A modal or dialog is declared `visible: false` and driven with `openModal('credits')` / `closeModal('credits')`
  (`openDialog` / `closeDialog`). `openModal`'s second argument is the modal's data: a JSON object is read by its
  fields (`{{ modalContainer_credits.title }}`); anything else — a row's id, a number, a word — as
  `{{ modalContainer_credits.content }}`. The close control is a real button, reachable by keyboard.
- A `dropdown`'s label is a child and its `dropdownPopup` sits inside it; a `tabContainer`'s header and body are held
  inside it too. Outside, they are refused.

## Realtime channels

Pages that see each other — cursors, presence, a shared board — talk over a channel: see [realtime](realtime.md).

## Lists as state

`toggleInState({ key: 'picks', value })` keeps a list; `when({ field: 'state.picks', operator: 'contains', value })`
asks it. `appendState({ key, value, withId: true })` stores `{ id, value }` — bind `.value`, address by `.id`.
`whenFailed` matches every outcome that is not `completed` (also `skipped`, `aborted`). A failed run gives `reason`,
and `error` only when the server or a step wrote one for the caller (a task throwing `ActionRefusal`, `flow.fail` with
`tellCaller`) — so show `{{ saved.error ? saved.error : "…" }}`, never the bare `error`. That pair is one call:
`...runServerActionOrNotify('saved', { actionId, input }, 'Could not save')` — the named run, then that toast
(`{ appearance, placement }` fourth).

`when(rule, step)` around a step that already has a `when` adds to it: both must hold.
