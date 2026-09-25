# Flows

```ts
button({
  id: 'cta',
  content: 'Get a quote',
  flows: [[
    onClick(),
    named('quote', runServerAction({ actionId: 'shipping-quote', input: { city: 'Berlin' }, mode: 'await' })),
    whenSucceeded('quote', setState({ key: 'quote', type: 'text', value: '{{ quote.output.summary }}' })),
    whenFailed('quote', addNotification({ content: 'Could not reach the courier', appearance: 'danger' }))
  ]]
})
```

A flow is a list: a trigger, then steps in order. "Only if" is on the step (`when`, `whenSucceeded`, `whenFailed`),
never a nested tree. Use the step builders — they fill in where a step runs and what it takes:

- **Where it runs.** A global callback registers under its source MODULE (`state`, `auth`, `actions`), an element
  callback under an element's id, a utility under nothing. Naming either half wrong is a control that does nothing,
  with no error — which is why the builders exist.
- **Which `setState`.** `setState({ key })` writes `runtime.state.<key>` and is read as `state.<key>`; never put
  `state.` in the key. `updateElement(…)` changes one element's own attribute or state.
- **Flip in one step.** `toggleState({ key })` for app state, `toggleElement({ category: 'state', key: 'visibility' },
  'panel')` to show/hide an element. Never two branches under opposite `when` guards — the second reads what the
  first just wrote and flips it back. A key never set toggles to `true`, so for something shown by default name the
  key for hiding it (`sidebarCollapsed`).
- **Each step reads the page as it is when it runs.** A `when` or a `{{ state.x }}` after a `setState` sees the new
  value, and one after a `delay` or a server action sees whatever changed meanwhile. To act on the value from BEFORE
  a write, put the step that reads it first.
- **Keys are flat names.** A dotted key (`docsClosed.start`) is split into a path; use `docsClosedStart`.
- **`setState` types**: `text`, `number` (decimals kept), `boolean` (the word or a real boolean), and `json` for an
  object or a list — `value: '{{ list_rows.item }}'` stores the row itself; JSON text is parsed, and text that is not
  JSON fails the step (the dev tools log it) instead of storing the text.

## What a trigger hands the flow

Name the trigger (`named('changed', onChange())`) and read its payload as `{{ changed.<field> }}`:

| Trigger | Payload |
| --- | --- |
| `onChange` (formControl) | `value` (a boolean for a checkbox), `name` |
| `onSubmit` (form) | `values` (by control `name`), `actionUrl`, `method` |
| `onPageLoad` (page) | `pageId`, `routeParams`, `queryParams` |
| `onApiSuccess` / `onApiError` (apiContainer) | `url`, `method`, `status`, `data` |
| `onModalOpen` / `onModalClose`, `onDialogOpen` / `onDialogClose` / `onDialogAccept` / `onDialogReject` | `metadata` — what `openModal` / `openDialog` was handed |
| `onPageChange` (pagination) | `page` |
| `onThemeChange` (themeToggle) | `theme` |

## Reading what came before

`named('quote', step)` is how a later step reads an earlier one: `{{ quote.output.total }}`. The trigger too:
`named('submitted', onSubmit())` → `{{ submitted.values.email }}`. Unnamed steps get ids nothing can refer to.

A step's params are templates, evaluated in full (conditions, loops, filters). A source in them is named in full:
a row's button posts `{ jobId: '{{ list_jobRows.item.id }}' }` — the row that was clicked; the short name is refused.

**Pass objects, not JSON text.** `input: { title: '{{ form.values.title }}' }`, never `input: '{"title": …}'` — a
value with a quotation mark or a newline makes the text unparseable, and unparseable input posts `{}`.

## Writes and what they refresh

`webHook` (not GET) refreshes every request to its own site when it succeeds; `runServerAction` refreshes
everything. Say what it should refresh — `invalidateQueries: 'elements', invalidateElements: ['orders']` — or
`'none'` for a step that only reads, or when a refresh would make the page act on the new answer mid-flow.

## Triggers belong to the element that fires them

Every element fires `onClick`, `onLoad`, `onHover`, `onMouseEnter`/`onMouseLeave`, `onFocus`/`onBlur` and the ends of a
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

**A form's flow goes on the `form`**, which hands its submit over with `managedByInteractions: true`
(`FORM_SUBMIT_UNMANAGED` otherwise — the browser submits it natively and `onSubmit` never fires):

```ts
form({
  id: 'signup',
  managedByInteractions: true,
  flows: [[named('submitted', onSubmit()), setState({ key: 'email', type: 'text', value: '{{ submitted.values.email }}' })]],
  children: [formControl({ id: 'email', name: 'email', label: 'Email', subType: 'email' }), button({ content: 'Sign up', subType: 'submit' })]
})
```

A `formControl` is `required` by default: an optional field says `required: false`, or an empty one stops the submit
without a word.

## Notifications

`addNotification({ content: 'Saved', appearance: 'success' })` — `appearance` is `success`, `danger`, `warning` or
`info`. They follow the page's theme and font; their colours are the space's `notifications`:
`notifications: { background: 'var(--card)', text: 'var(--foreground)', success: 'var(--accent)', radius: '12px' }`.

## Modals, dropdowns, tabs

- A modal or dialog is declared `visible: false` and driven with `openModal('credits')` / `closeModal('credits')`
  (`openDialog` / `closeDialog`). `openModal`'s second argument is the modal's data: a JSON object is read by its
  fields (`{{ modalContainer_credits.title }}`); anything else — a row's id, a number, a word — as
  `{{ modalContainer_credits.content }}`. The close control is a real button, reachable by keyboard.
- A `dropdown`'s label is a child and its `dropdownPopup` sits inside it; a `tabContainer`'s header and body are held
  inside it too. Outside, they are refused.

## Lists as state

`toggleInState({ key: 'picks', value })` keeps a list; `when({ field: 'state.picks', operator: 'contains', value })`
asks it. `appendState({ key, value, withId: true })` stores `{ id, value }` — bind `.value`, address by `.id`.
`whenFailed` matches every outcome that is not `completed` (also `skipped`, `aborted`).
