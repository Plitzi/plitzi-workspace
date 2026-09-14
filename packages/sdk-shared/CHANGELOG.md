# @plitzi/sdk-shared

## 0.35.4

### Patch Changes

- v0.35.4

## 0.35.3

### Patch Changes

- 0211dc4: A form speaks the site's language when it refuses a value.

  - **Every rule of a `formControl` can say what it wants to say.** `requiredMessage`, `minLengthMessage`,
    `maxLengthMessage` and `formatMessage` join `patternMessage` and `matchesMessage`; left empty, each falls back to
    the English sentence it said before. `formatMessage` is said when the value does not have the shape the control's
    type asks for — an address, for an `email` — one attribute for every type that has a shape. Offered in the builder under the rule they belong to.
  - **A `form` can turn the browser's own checks off (`noValidate`, "Skip Browser Validation" in the builder).** Left on
    — the default, as before — the browser answers first for a blank required field and a malformed address, in a
    bubble no style reaches and in the browser's language, while every other rule answers under the control. Turned
    on, the form's rules are the only ones, and all of them answer under the control.
  - **An `email` control checks the address itself,** by the same definition the browser uses, so the format is still
    asked for when the browser's checks are off.

## 0.35.2

### Minor Changes

- 470aaf8: The theme is a data source, and a binding reads every source its template names.

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

### Patch Changes

- v0.35.2

## 0.35.1

### Patch Changes

- v0.35.1

## 0.35.0

### Minor Changes

- v0.35.0

## 0.34.1

### Patch Changes

- v0.34.1

## 0.34.0

### Minor Changes

- 5aceda0: `authorSpace` returns test handles, and every element carries its id in the DOM.

  An end-to-end suite had nothing stable to address a rendered element by: a class is a styling decision that
  changes with the design, a text match breaks when the copy is edited, and an `nth-child` chain is invalidated by
  inserting a section above. What does not move is the element's id — which is also its name, chosen by whoever
  authored it and unique across the document.

  ```ts
  const { schema, style, handles } = authorSpace(spec);
  const el = locate(page, handles);

  await expect(el('hero-title')).toBeVisible();
  await page.goto(handles.page('pricing').path);
  ```

  Elements now render `data-plitzi-el="<id>"`. It ships by default — the ids are already in the page, since the
  schema the browser hydrates from carries every one of them — and a deployment turns it off with
  `render.testAttributes: false`.

  Each handle reports whether the AUTHOR wrote the id or authoring derived a positional `<type>-<n>`, which is
  what makes one generic assertion possible for any space: everything a space names must be on screen. A name that
  does not exist throws at author time with a suggestion, rather than resolving to an empty locator at test time.

- v0.34.0
- 5aceda0: Draft previews you can iterate against, and a `DraftStore` contract that says so.

  A preview token was one-shot: spent by the render that used it. That is right for a capture and wrong for a
  person — reloading showed the saved space again, so "look at the change, adjust it, look again" meant minting a
  new token for every look. `POST /__preview` now takes `mode: 'session'`, which mints a token that stays
  resolvable until it expires (`preview.sessionTtlMs`, 15 minutes by default) or until `POST /__preview/end` ends
  it. The token is remembered in an `HttpOnly` cookie on the first render, so the draft follows a navigation —
  the page after a link carries no query parameter.

  A draft render, either mode, is never cached, never metered and answers `Cache-Control: no-store` plus
  `X-Robots-Tag: noindex`. Data refreshes (`/_rsc`) made from inside a session are excluded from metering and
  caching too — without that, an open preview tab would be billed as live traffic.

  **Breaking, for anyone who implements `DraftStore`** (a shared store for a multi-replica deployment). The
  default in-memory store is unaffected; a custom one needs three changes:

  ```ts
  // before
  put(token, data, ttlMs)
  take(token): OfflineDataRaw | undefined

  // after
  put(token, data, { ttlMs, reusable })      // `reusable` is a session; absent is one-shot
  take(token): { data, reusable } | undefined // consume unless reusable — and say which it was
  drop(token)                                 // end a session before its TTL
  ```

  `take` reports which kind it resolved because the render that resolves a session is the one that has to remember
  it for the rest of the visit, and only the store knows whether the token survived the read.

## 0.33.2

### Patch Changes

- v0.33.2

## 0.33.1

### Patch Changes

- v0.33.1

## 0.33.0

### Minor Changes

- v0.33.0

## 0.32.25

### Patch Changes

- v0.32.25

## 0.32.24

### Patch Changes

- v0.32.24

## 0.32.23

### Patch Changes

- v0.32.23

## 0.32.22

### Patch Changes

- v0.32.22

## 0.32.21

### Patch Changes

- v0.32.21

## 0.32.20

### Patch Changes

- v0.32.20

## 0.32.19

### Patch Changes

- v0.32.19

## 0.32.18

### Patch Changes

- v0.32.18

## 0.32.17

### Patch Changes

- v0.32.17

## 0.32.16

### Patch Changes

- v0.32.16

## 0.32.15

### Patch Changes

- v0.32.15
- Updated dependencies
  - @plitzi/nexus@0.32.15

## 0.32.14

### Patch Changes

- v0.32.14
- Updated dependencies
  - @plitzi/nexus@0.32.14

## 0.32.13

### Patch Changes

- v0.32.13
- Updated dependencies
  - @plitzi/nexus@0.32.13

## 0.32.12

### Patch Changes

- v0.32.12
- Updated dependencies
  - @plitzi/nexus@0.32.12

## 0.32.11

### Patch Changes

- v0.32.11
- Updated dependencies
  - @plitzi/nexus@0.32.11

## 0.32.10

### Patch Changes

- v0.32.10
- Updated dependencies
  - @plitzi/nexus@0.32.10

## 0.32.9

### Patch Changes

- v0.32.9
- Updated dependencies
  - @plitzi/nexus@0.32.9

## 0.32.8

### Patch Changes

- v0.32.8
- Updated dependencies
  - @plitzi/nexus@0.32.8

## 0.32.7

### Patch Changes

- v0.32.7
- Updated dependencies
  - @plitzi/nexus@0.32.7

## 0.32.6

### Patch Changes

- v0.32.6
- Updated dependencies
  - @plitzi/nexus@0.32.6

## 0.32.5

### Patch Changes

- v0.32.4
- Updated dependencies
  - @plitzi/nexus@0.32.5

## 0.32.4

### Patch Changes

- v0.32.4
- Updated dependencies
  - @plitzi/nexus@0.32.4

## 0.32.3

### Patch Changes

- v0.32.3
- Updated dependencies
  - @plitzi/nexus@0.32.3

## 0.32.2

### Patch Changes

- v0.32.2
- Updated dependencies
  - @plitzi/nexus@0.32.2

## 0.32.1

### Patch Changes

- v0.32.1
- Updated dependencies
  - @plitzi/nexus@0.32.1

## 0.32.0

### Minor Changes

- v0.32.0

### Patch Changes

- Updated dependencies
  - @plitzi/nexus@0.32.0

## 0.31.2

### Patch Changes

- v0.31.2
- Updated dependencies
  - @plitzi/nexus@0.31.2

## 0.31.1

### Patch Changes

- v0.31.1
- Updated dependencies
  - @plitzi/nexus@0.31.1

## 0.31.0

### Minor Changes

- v0.31.0

### Patch Changes

- Updated dependencies
  - @plitzi/nexus@0.31.0

## 0.30.19

### Patch Changes

- v0.30.19
- Updated dependencies
  - @plitzi/nexus@0.30.19

## 0.30.18

### Patch Changes

- v0.30.18
- Updated dependencies
  - @plitzi/nexus@0.30.18

## 0.30.17

### Patch Changes

- v0.31.0
- Updated dependencies
  - @plitzi/nexus@0.30.17

## 0.30.16

### Patch Changes

- v0.30.16

## 0.30.15

### Patch Changes

- v0.30.15

## 0.30.14

### Patch Changes

- v0.30.14

## 0.30.13

### Patch Changes

- v0.30.13

## 0.30.12

### Patch Changes

- v0.30.12

## 0.30.11

### Patch Changes

- v0.30.11

## 0.30.10

### Patch Changes

- v0.30.10

## 0.30.9

### Patch Changes

- v0.30.9

## 0.30.8

### Patch Changes

- v0.30.8

## 0.30.7

### Patch Changes

- v0.30.7

## 0.30.6

### Patch Changes

- v0.30.6

## 0.30.5

### Patch Changes

- v0.30.5

## 0.30.4

### Patch Changes

- v0.30.4

## 0.30.3

### Patch Changes

- v0.30.3

## 0.30.2

### Patch Changes

- v0.30.2

## 0.30.1

### Patch Changes

- v0.30.1

## 0.30.0

### Minor Changes

- v0.30.0

## 0.29.0

### Minor Changes

- v0.29.0

## 0.28.14

### Patch Changes

- v0.28.14

## 0.28.13

### Patch Changes

- v0.28.13

## 0.28.12

### Patch Changes

- v0.28.12

## 0.28.11

### Patch Changes

- v0.28.11

## 0.28.10

### Patch Changes

- v0.28.10

## 0.28.9

### Patch Changes

- v0.28.9

## 0.28.8

### Patch Changes

- v0.28.8

## 0.28.7

### Patch Changes

- v0.28.7

## 0.28.6

### Patch Changes

- v0.28.6

## 0.28.5

### Patch Changes

- v0.28.5

## 0.28.4

### Patch Changes

- v0.28.4

## 0.28.3

### Patch Changes

- v0.28.3

## 0.28.2

### Patch Changes

- v0.28.2

## 0.28.1

### Patch Changes

- v0.28.1

## 0.28.0

### Minor Changes

- v0.28.0

## 0.27.23

### Patch Changes

- v0.27.23

## 0.27.22

### Patch Changes

- v0.27.22

## 0.27.21

### Patch Changes

- v0.27.21

## 0.27.20

### Patch Changes

- v0.27.20

## 0.27.19

### Patch Changes

- v0.27.19

## 0.27.18

### Patch Changes

- v0.27.18

## 0.27.17

### Patch Changes

- v0.27.17

## 0.27.16

### Patch Changes

- v0.27.16

## 0.27.15

### Patch Changes

- v0.27.15

## 0.27.14

### Patch Changes

- v0.27.14

## 0.27.13

### Patch Changes

- v0.27.13

## 0.27.12

### Patch Changes

- v0.27.12

## 0.27.11

### Patch Changes

- v0.27.11

## 0.27.10

### Patch Changes

- v0.27.10

## 0.27.9

### Patch Changes

- v0.27.9

## 0.27.8

### Patch Changes

- v0.27.8

## 0.27.7

### Patch Changes

- v0.27.7

## 0.27.6

### Patch Changes

- v0.27.6

## 0.27.5

### Patch Changes

- v0.27.5

## 0.27.4

### Patch Changes

- v0.27.4

## 0.27.3

### Patch Changes

- v0.27.3

## 0.27.2

### Patch Changes

- v0.27.2

## 0.27.1

### Patch Changes

- v0.27.1

## 0.27.0

### Minor Changes

- v0.27.0

## 0.26.5

### Patch Changes

- v0.26.5

## 0.26.4

### Patch Changes

- v0.26.4

## 0.26.3

### Patch Changes

- v0.26.3

## 0.26.2

### Patch Changes

- v0.26.2

## 0.26.1

### Patch Changes

- v0.26.1

## 0.26.0

### Minor Changes

- v0.26.0

## 0.25.12

### Patch Changes

- v0.25.12

## 0.25.11

### Patch Changes

- v0.25.11

## 0.25.10

### Patch Changes

- v0.25.10

## 0.25.9

### Patch Changes

- v0.25.9

## 0.25.8

### Patch Changes

- v0.25.8

## 0.25.7

### Patch Changes

- v0.25.7

## 0.25.6

### Patch Changes

- v0.25.6

## 0.25.5

### Patch Changes

- v0.25.5

## 0.25.4

### Patch Changes

- v0.25.4

## 0.25.3

### Patch Changes

- v0.25.3

## 0.25.2

### Patch Changes

- v0.25.2

## 0.25.1

### Patch Changes

- v0.25.1

## 0.25.0

### Minor Changes

- v0.25.0

## 0.24.12

### Patch Changes

- v0.24.12

## 0.24.11

### Patch Changes

- v0.24.11

## 0.24.10

### Patch Changes

- v0.24.10

## 0.24.9

### Patch Changes

- v0.24.9

## 0.24.8

### Patch Changes

- v0.24.8

## 0.24.7

### Patch Changes

- v0.24.7

## 0.24.6

### Patch Changes

- v0.24.6

## 0.24.5

### Patch Changes

- v0.24.5

## 0.24.4

### Patch Changes

- v0.24.4

## 0.24.3

### Patch Changes

- v0.24.3

## 0.24.2

### Patch Changes

- v0.24.2

## 0.24.1

### Patch Changes

- v0.24.1

## 0.24.0

### Minor Changes

- v0.24.0

## 0.23.24

### Patch Changes

- v0.23.24

## 0.23.23

### Patch Changes

- v0.23.23

## 0.23.22

### Patch Changes

- v0.23.22

## 0.23.21

### Patch Changes

- v0.23.21

## 0.23.20

### Patch Changes

- v0.23.20

## 0.23.19

### Patch Changes

- v0.23.19

## 0.23.18

### Patch Changes

- v0.23.18

## 0.23.17

### Patch Changes

- v0.23.17

## 0.23.16

### Patch Changes

- v0.23.16

## 0.23.15

### Patch Changes

- v0.23.15

## 0.23.14

### Patch Changes

- v0.23.14

## 0.23.13

### Patch Changes

- v0.23.13

## 0.23.12

### Patch Changes

- v0.23.12

## 0.23.11

### Patch Changes

- v0.23.11

## 0.23.10

### Patch Changes

- v0.23.10

## 0.23.9

### Patch Changes

- v0.23.9

## 0.23.8

### Patch Changes

- v0.23.8

## 0.23.7

### Patch Changes

- v0.23.7

## 0.23.6

### Patch Changes

- v0.23.6

## 0.23.5

### Patch Changes

- v0.23.5

## 0.23.4

### Patch Changes

- v0.23.4

## 0.23.3

### Patch Changes

- v0.23.3

## 0.23.2

### Patch Changes

- v0.23.2

## 0.23.1

### Patch Changes

- v0.23.1

## 0.23.0

### Minor Changes

- v0.23.0

## 0.22.20

### Patch Changes

- v0.22.20

## 0.22.19

### Patch Changes

- v0.22.19

## 0.22.18

### Patch Changes

- v0.22.18

## 0.22.17

### Patch Changes

- v0.22.17

## 0.22.16

### Patch Changes

- v0.22.16

## 0.22.15

### Patch Changes

- v0.22.15

## 0.22.14

### Patch Changes

- v0.22.14

## 0.22.13

### Patch Changes

- v0.22.13

## 0.22.12

### Patch Changes

- v0.22.12

## 0.22.11

### Patch Changes

- v0.22.11

## 0.22.10

### Patch Changes

- v0.22.10

## 0.22.9

### Patch Changes

- v0.22.9

## 0.22.8

### Patch Changes

- v0.22.8

## 0.22.7

### Patch Changes

- v0.22.7

## 0.22.6

### Patch Changes

- v0.22.6

## 0.22.5

### Patch Changes

- v0.22.5

## 0.22.4

### Patch Changes

- v0.22.4

## 0.22.3

### Patch Changes

- v0.22.3

## 0.22.2

### Patch Changes

- v0.22.2

## 0.22.1

### Patch Changes

- v0.22.1

## 0.22.0

### Patch Changes

- v0.22.0

## 0.22.0

### Minor Changes

- v0.22.0-rc1

## 0.21.1

### Patch Changes

- v0.21.1

## 0.21.0

### Minor Changes

- v0.21.0

## 0.20.24

### Patch Changes

- v0.20.24

## 0.20.23

### Patch Changes

- v0.20.23

## 0.20.22

### Patch Changes

- v0.20.22

## 0.20.21

### Patch Changes

- v0.20.21

## 0.20.20

### Patch Changes

- v0.20.20

## 0.20.19

### Patch Changes

- v0.20.19

## 0.20.18

### Patch Changes

- v0.20.18

## 0.20.17

### Patch Changes

- v0.20.17

## 0.20.16

### Patch Changes

- v0.20.16

## 0.20.15

### Patch Changes

- v0.20.15

## 0.20.14

### Patch Changes

- v0.20.14

## 0.20.13

### Patch Changes

- v0.20.13

## 0.20.12

### Patch Changes

- v0.20.12

## 0.20.11

### Patch Changes

- v0.20.11

## 0.20.10

### Patch Changes

- v0.20.10

## 0.20.9

### Patch Changes

- v0.20.9

## 0.20.8

### Patch Changes

- v0.20.8

## 0.20.7

### Patch Changes

- v0.20.7

## 0.20.6

### Patch Changes

- v0.20.6

## 0.20.5

### Patch Changes

- v0.20.5

## 0.20.4

### Patch Changes

- v0.20.4

## 0.20.3

### Patch Changes

- v0.20.3

## 0.20.2

### Patch Changes

- v0.20.2

## 0.20.1

### Patch Changes

- v0.20.1

## 0.20.0

### Minor Changes

- v0.20.0

## 0.19.3

### Patch Changes

- v0.19.3

## 0.19.2

### Patch Changes

- v0.19.2
