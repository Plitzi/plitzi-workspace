---
'@plitzi/plitzi-builder': patch
'@plitzi/cli': patch
'@plitzi/sdk-mcp': patch
'@plitzi/plitzi-sdk': patch
'@plitzi/sdk-server': patch
'@plitzi/sdk-auth': patch
'@plitzi/sdk-authoring': patch
'@plitzi/sdk-dev-tools': patch
'@plitzi/sdk-elements': patch
'@plitzi/sdk-event-bridge': patch
'@plitzi/sdk-interactions': patch
'@plitzi/sdk-navigation': patch
'@plitzi/sdk-plugins': patch
'@plitzi/sdk-schema': patch
'@plitzi/sdk-shared': patch
'@plitzi/sdk-style': patch
'@plitzi/sdk-variables': patch
---

## Builder

- **Icons in the canvas again** (`@plitzi/plitzi-builder`): the canvas inlined the SDK's Font Awesome sheet into its
  `<style>`, where the sheet's `url(webfonts/…)` resolved against the editor's URL — a `srcdoc` frame takes it as its
  base — so every icon was a 404 under `/spaces/<space>/webfonts/` and drew as an empty box. Only the Vite dev server,
  which rewrites the URL, hid it. The canvas and the element preview now link the sheet from where the host serves it:
  a new prop, `sdkIconsStylePath`, the one the host already gives the pages it renders
  (`/sdk-assets/plitzi-sdk-icons.css` for sdk-server). Absent, the canvas links no icon sheet.

## Plugins

- **A plugin's other elements, hosted by `custom`** (`@plitzi/sdk-elements`): `custom({ renderType: 'jamDisc' })` on a
  space with a plugin installed whose main element is another (`plitzi plugin pack` of several folders: the first is the
  plugin, the rest go in it) rendered "Custom Component jamDisc Not Found" — the page registers only the plugin's main
  element, and a `custom` host looked nowhere else. It now loads the type from the installed plugin that packs it, as
  an element of the type itself always did, so the two ways the docs give to place a plugin's element are the same
  everywhere: in a project `plitzi create` wrote, and once the project is on Plitzi.
- **One way to place a plugin's element** (`@plitzi/sdk-authoring`, `@plitzi/cli`, docs): from its declaration,
  `const seatPicker = defineElement(declaration)` then `seatPicker({ id, … })` — typed by what it
  declares, and the element the builder adds when somebody drops it. The welcome space `plitzi create` writes, the
  plugin package's preview, `plitzi plugin add` and `plitzi explain` all write it so (the template's
  `PluginHostOptions` now takes the plugin's `type` and `declaration: { from, attributes? }`; `custom`/`element` hosting
  is gone). `pluginFolders(folder)` (`@plitzi/sdk-authoring/node`) reads each plugin with the folder it is in;
  `pluginDeclarations` is built on it. A `custom({ renderType })` naming a plugin the space was handed the declaration
  of is offered the declaration instead — suggestion `plugin-custom-host`. `custom` stays for a component registered
  by name with no declaration. The skills, the CLI README, the MCP guide, `docs/en` and the website say the same.
- **`definePlugin`** (`@plitzi/sdk-authoring/plugin`, a new entry of 3 KB with nothing else in it): a plugin's
  declaration written from what only it can say —
  `definePlugin<SeatPickerAttributes>()({ type, label, attributes, triggers, callbacks })` — and every other field
  at the default all plugins share (the builder's gestures, the catalogue entry, each attribute bindable, an empty
  style). It answers the whole declaration, branded with its attributes, so `defineElement(declaration)` is typed
  without a generic. `plitzi plugin add` and `create --plugin` write declarations with it (about a third of the lines).
- **`usePluginTrigger(declaration)`** (`@plitzi/plitzi-sdk`): fires a plugin's declared event on its element — the
  event name and what each hands a flow typed off the declaration's `preview` — on a live page only. The hook every
  plugin wrote for itself (and `plugin add` generated as `use<Name>Events`) is gone from the scaffold.
- **Attributes as the types their defaults are** (`@plitzi/sdk-elements`): a plugin's attribute bound from text — a
  state, a row, a channel message — reaches its component as the number or the flag its declared default is (`'112'`
  as 112, `'true'` as true). A plugin no longer types its props `number | string` and parses them.

## Server actions and functions

- **Task params with rules** (`@plitzi/sdk-server`, `@plitzi/sdk-shared`): a task declares `required`, a text's
  `maxLength` and a number's `min`/`max`, and the runner refuses a call that breaks any of them — every rule broken at
  once, in the words the page shows (`Title is required; Seconds is at most 300`) — before the code runs. A `text` param
  bound to a number arrives as its digits. The manifest keeps the rules, so the platform's sandbox checks the same.
- **`taskAction(task, { trigger })`** (`@plitzi/sdk-authoring`): the action that runs one of the space's tasks and
  answers its result, derived from the task — its id (`<namespace>-<action>`), name, description and input (the task's
  params, once). An action of more than one step is still `defineAction`.
- **`ctx.rateLimit(bucket, { …, refuse })`**: past the limit the call is refused with those words instead of answering
  `allowed: false` for the code to check — natively and in the sandbox.

## Authoring

- **`runServerActionOrNotify(id, params, fallback)`**: a server action run and the notice the visitor reads when it
  fails — the action's own refusal, or the fallback — as two steps to spread into a flow.
- **`repeated-shape` reads what copies bind**: copies whose bindings read their data in different forms (a count, a
  total of a quota) and copies holding a provider resolved on the server (found by its own id) are no longer offered
  as one component.
- **`element-color-inherited`** (suggestion): `elements` giving a heading, a text, a link… `color: inherit` or the
  page's own colour. **A link inherits the page's colour** (`@plitzi/plitzi-sdk`, `@plitzi/sdk-elements`) rather than
  holding the SDK's grey — the same by default, and the space's palette inside a card that is a link. The template
  every space starts from writes its colours once, on the page.

## Fixes

- **A dialog opened with an id** (`@plitzi/sdk-elements`): `openDialog('dialog', '{{ row.id }}')` reads the id as its
  `content`, as `openModal` already did — a numeric id parsed as the number and the dialog's bindings read nothing.
- **A tab header's settings** (`@plitzi/plitzi-builder`, `@plitzi/sdk-elements`): the builder found no settings for
  `tabContainerHeader`, registered under a misspelt type; the registry now accepts only element types.
