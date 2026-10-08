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
  `const seatPicker = defineElement<SeatPickerAttributes>(declaration)` then `seatPicker({ id, … })` — typed by what it
  declares, and the element the builder adds when somebody drops it. The welcome space `plitzi create` writes, the
  plugin package's preview, `plitzi plugin add` and `plitzi explain` all write it so (the template's
  `PluginHostOptions` now takes the plugin's `type` and `declaration: { from, attributes }`; `custom`/`element` hosting
  is gone). `pluginFolders(folder)` (`@plitzi/sdk-authoring/node`) reads each plugin with the folder it is in;
  `pluginDeclarations` is built on it. A `custom({ renderType })` naming a plugin the space was handed the declaration
  of is offered the declaration instead — suggestion `plugin-custom-host`. `custom` stays for a component registered
  by name with no declaration. The skills, the CLI README, the MCP guide, `docs/en` and the website say the same.
