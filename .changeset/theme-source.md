---
'@plitzi/sdk-elements': minor
'@plitzi/sdk-shared': minor
'@plitzi/sdk-authoring': minor
---

The theme is a data source, and a binding reads every source its template names.

- **`theme` global source.** `GlobalSources` publishes `runtime.sources.theme` as `{ mode, resolved }` for the area
  the space paints in. `resolved` is always `light` or `dark`, so `{{ theme.resolved }}` is what a URL or a `when`
  rule wants — a dashboard asking the API for a thumbnail in the visitor's scheme, for one. The comments that promised
  `{{ theme.resolved }}` through the app store's `theme` mirror were wrong: nothing a binding reads lives there.
- **A binding subscribes to the roots of its `twigTemplate`.** It used to get only the head of its `source`, so a
  binding on `list_spaces.item.id` whose template also said `{{ theme.resolved }}` or `{{ state.scope }}` resolved the
  second name to nothing, silently. The names are read off the parsed template (`templateRootNames`, exported from
  `@plitzi/sdk-shared/helpers/twigWrapper`). A name that is not a source is left out of the map rather than set to
  `undefined`, so `{{ source }}` and the variables lifted to the template's root are never shadowed.
- **Authoring.** `theme` joins `GLOBAL_SOURCES`: `bind: { src: 'theme.resolved' }` is accepted, and an element can no
  longer be named `theme`.
