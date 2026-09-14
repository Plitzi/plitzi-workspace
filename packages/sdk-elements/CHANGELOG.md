# @plitzi/sdk-elements

## 0.35.7

### Patch Changes

- An SMTP failure says which credential it was, and a credential's values can be replaced from the builder.

  - **`email.send` names the credential it could not send through:** `Could not send through the SMTP credential
"ceniza-smtp": its SMTP host is on a private network…`. The host used to be in the sentence, and a run's trace
    redacts every value of a credential it resolved, so the message read `The SMTP host "«redacted»"…`.
  - **Credentials can be edited in the builder.** A pencil on each row opens the form with the name and the provider
    fixed and nothing it holds shown: every value is entered again, and saving replaces all of them. SMTP credentials
    are also labelled in the list.

- Updated dependencies
  - @plitzi/sdk-auth@0.35.7
  - @plitzi/sdk-dev-tools@0.35.7
  - @plitzi/sdk-event-bridge@0.35.7
  - @plitzi/sdk-interactions@0.35.7
  - @plitzi/sdk-navigation@0.35.7
  - @plitzi/sdk-schema@0.35.7
  - @plitzi/sdk-shared@0.35.7

## 0.35.6

### Patch Changes

- A failed server action can give back what it already did.

  - **`flow.onFailure` ("On Failure") marks where the undo begins.** A run that reaches it has succeeded and ends there.
    A run whose step failed jumps to it and runs the steps after it, in order, each still asking its own `when` — the
    failure may have come before the thing to undo was ever done — with `{{ failure.step }}` and `{{ failure.message }}`
    in scope. The run still ends failed, with the failure it had; an undo step that fails too is added to it.
  - **The undo runs on its own clock and budget:** 5 seconds (or the run's own timeout if shorter) and its own outbound
    request budget, because the run's may be exactly what ran out, and a caller closing the connection does not stop it.
    A run that hit its deadline is undone too.
  - **`defineAction` writes it from `onFailure: [...]`**, after the answer. `validateActionDocument` refuses an output
    step or a second handler after one, warns about a handler with nothing to undo or nothing that undoes, and reserves
    `failure` as a step id. `FAILURE_HANDLER_TASK` is exported from `@plitzi/sdk-shared/actions`.

- Updated dependencies
  - @plitzi/sdk-auth@0.35.6
  - @plitzi/sdk-dev-tools@0.35.6
  - @plitzi/sdk-event-bridge@0.35.6
  - @plitzi/sdk-interactions@0.35.6
  - @plitzi/sdk-navigation@0.35.6
  - @plitzi/sdk-schema@0.35.6
  - @plitzi/sdk-shared@0.35.6

## 0.35.5

### Patch Changes

- v0.35.5
- Updated dependencies
  - @plitzi/sdk-auth@0.35.5
  - @plitzi/sdk-dev-tools@0.35.5
  - @plitzi/sdk-event-bridge@0.35.5
  - @plitzi/sdk-interactions@0.35.5
  - @plitzi/sdk-navigation@0.35.5
  - @plitzi/sdk-schema@0.35.5
  - @plitzi/sdk-shared@0.35.5

## 0.35.4

### Patch Changes

- v0.35.4
- Updated dependencies
  - @plitzi/sdk-auth@0.35.4
  - @plitzi/sdk-dev-tools@0.35.4
  - @plitzi/sdk-event-bridge@0.35.4
  - @plitzi/sdk-interactions@0.35.4
  - @plitzi/sdk-navigation@0.35.4
  - @plitzi/sdk-schema@0.35.4
  - @plitzi/sdk-shared@0.35.4

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

- Updated dependencies [0211dc4]
  - @plitzi/sdk-auth@0.35.3
  - @plitzi/sdk-dev-tools@0.35.3
  - @plitzi/sdk-event-bridge@0.35.3
  - @plitzi/sdk-interactions@0.35.3
  - @plitzi/sdk-navigation@0.35.3
  - @plitzi/sdk-schema@0.35.3
  - @plitzi/sdk-shared@0.35.3

## 0.35.2

### Minor Changes

- 470aaf8: A booking form can ask for a date, and a toggle can say it is one.

  - **`formControl` accepts `subType: 'date'`.** It renders the browser's own date picker and submits `YYYY-MM-DD`, so
    a flow or a server action reads one format whatever the visitor's locale. Until now a date was a free text field
    and every form that needed one parsed whatever somebody typed. Offered in the builder's Input Type list.
  - **`button` accepts `ariaExpanded` and `ariaPressed`.** A button that opens a menu or an answer, or one that stays on
    like a filter, can tell assistive technology so — statically, or bound to the state it flips
    (`bind: { ariaExpanded: 'state.menuOpen' }`). Left out, neither attribute is rendered: an ordinary button does not
    claim to control anything.

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
- Updated dependencies
- Updated dependencies [470aaf8]
  - @plitzi/sdk-auth@0.35.2
  - @plitzi/sdk-dev-tools@0.35.2
  - @plitzi/sdk-event-bridge@0.35.2
  - @plitzi/sdk-interactions@0.35.2
  - @plitzi/sdk-navigation@0.35.2
  - @plitzi/sdk-schema@0.35.2
  - @plitzi/sdk-shared@0.35.2

## 0.35.1

### Patch Changes

- v0.35.1
- Updated dependencies
  - @plitzi/sdk-auth@0.35.1
  - @plitzi/sdk-dev-tools@0.35.1
  - @plitzi/sdk-event-bridge@0.35.1
  - @plitzi/sdk-interactions@0.35.1
  - @plitzi/sdk-navigation@0.35.1
  - @plitzi/sdk-schema@0.35.1
  - @plitzi/sdk-shared@0.35.1

## 0.35.0

### Minor Changes

- v0.35.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-auth@0.35.0
  - @plitzi/sdk-dev-tools@0.35.0
  - @plitzi/sdk-event-bridge@0.35.0
  - @plitzi/sdk-interactions@0.35.0
  - @plitzi/sdk-navigation@0.35.0
  - @plitzi/sdk-schema@0.35.0
  - @plitzi/sdk-shared@0.35.0

## 0.34.1

### Patch Changes

- v0.34.1
- Updated dependencies
  - @plitzi/sdk-auth@0.34.1
  - @plitzi/sdk-dev-tools@0.34.1
  - @plitzi/sdk-event-bridge@0.34.1
  - @plitzi/sdk-interactions@0.34.1
  - @plitzi/sdk-navigation@0.34.1
  - @plitzi/sdk-schema@0.34.1
  - @plitzi/sdk-shared@0.34.1

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

### Patch Changes

- Updated dependencies [5aceda0]
- Updated dependencies
- Updated dependencies [5aceda0]
  - @plitzi/sdk-shared@0.34.0
  - @plitzi/sdk-auth@0.34.0
  - @plitzi/sdk-dev-tools@0.34.0
  - @plitzi/sdk-event-bridge@0.34.0
  - @plitzi/sdk-interactions@0.34.0
  - @plitzi/sdk-navigation@0.34.0
  - @plitzi/sdk-schema@0.34.0

## 0.33.2

### Patch Changes

- v0.33.2
- Updated dependencies
  - @plitzi/sdk-auth@0.33.2
  - @plitzi/sdk-dev-tools@0.33.2
  - @plitzi/sdk-event-bridge@0.33.2
  - @plitzi/sdk-interactions@0.33.2
  - @plitzi/sdk-navigation@0.33.2
  - @plitzi/sdk-schema@0.33.2
  - @plitzi/sdk-shared@0.33.2

## 0.33.1

### Patch Changes

- v0.33.1
- Updated dependencies
  - @plitzi/sdk-auth@0.33.1
  - @plitzi/sdk-dev-tools@0.33.1
  - @plitzi/sdk-event-bridge@0.33.1
  - @plitzi/sdk-interactions@0.33.1
  - @plitzi/sdk-navigation@0.33.1
  - @plitzi/sdk-schema@0.33.1
  - @plitzi/sdk-shared@0.33.1

## 0.33.0

### Minor Changes

- v0.33.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-auth@0.33.0
  - @plitzi/sdk-dev-tools@0.33.0
  - @plitzi/sdk-event-bridge@0.33.0
  - @plitzi/sdk-interactions@0.33.0
  - @plitzi/sdk-navigation@0.33.0
  - @plitzi/sdk-schema@0.33.0
  - @plitzi/sdk-shared@0.33.0

## 0.32.25

### Patch Changes

- v0.32.25
- Updated dependencies
  - @plitzi/sdk-auth@0.32.25
  - @plitzi/sdk-dev-tools@0.32.25
  - @plitzi/sdk-event-bridge@0.32.25
  - @plitzi/sdk-interactions@0.32.25
  - @plitzi/sdk-navigation@0.32.25
  - @plitzi/sdk-schema@0.32.25
  - @plitzi/sdk-shared@0.32.25

## 0.32.24

### Patch Changes

- v0.32.24
- Updated dependencies
  - @plitzi/sdk-auth@0.32.24
  - @plitzi/sdk-dev-tools@0.32.24
  - @plitzi/sdk-event-bridge@0.32.24
  - @plitzi/sdk-interactions@0.32.24
  - @plitzi/sdk-navigation@0.32.24
  - @plitzi/sdk-schema@0.32.24
  - @plitzi/sdk-shared@0.32.24

## 0.32.23

### Patch Changes

- v0.32.23
- Updated dependencies
  - @plitzi/sdk-auth@0.32.23
  - @plitzi/sdk-dev-tools@0.32.23
  - @plitzi/sdk-event-bridge@0.32.23
  - @plitzi/sdk-interactions@0.32.23
  - @plitzi/sdk-navigation@0.32.23
  - @plitzi/sdk-schema@0.32.23
  - @plitzi/sdk-shared@0.32.23

## 0.32.22

### Patch Changes

- v0.32.22
- Updated dependencies
  - @plitzi/sdk-auth@0.32.22
  - @plitzi/sdk-dev-tools@0.32.22
  - @plitzi/sdk-event-bridge@0.32.22
  - @plitzi/sdk-interactions@0.32.22
  - @plitzi/sdk-navigation@0.32.22
  - @plitzi/sdk-schema@0.32.22
  - @plitzi/sdk-shared@0.32.22

## 0.32.21

### Patch Changes

- v0.32.21
- Updated dependencies
  - @plitzi/sdk-auth@0.32.21
  - @plitzi/sdk-dev-tools@0.32.21
  - @plitzi/sdk-event-bridge@0.32.21
  - @plitzi/sdk-interactions@0.32.21
  - @plitzi/sdk-navigation@0.32.21
  - @plitzi/sdk-schema@0.32.21
  - @plitzi/sdk-shared@0.32.21

## 0.32.20

### Patch Changes

- v0.32.20
- Updated dependencies
  - @plitzi/sdk-auth@0.32.20
  - @plitzi/sdk-dev-tools@0.32.20
  - @plitzi/sdk-event-bridge@0.32.20
  - @plitzi/sdk-interactions@0.32.20
  - @plitzi/sdk-navigation@0.32.20
  - @plitzi/sdk-schema@0.32.20
  - @plitzi/sdk-shared@0.32.20

## 0.32.19

### Patch Changes

- v0.32.19
- Updated dependencies
  - @plitzi/sdk-auth@0.32.19
  - @plitzi/sdk-dev-tools@0.32.19
  - @plitzi/sdk-event-bridge@0.32.19
  - @plitzi/sdk-interactions@0.32.19
  - @plitzi/sdk-navigation@0.32.19
  - @plitzi/sdk-schema@0.32.19
  - @plitzi/sdk-shared@0.32.19

## 0.32.18

### Patch Changes

- v0.32.18
- Updated dependencies
  - @plitzi/sdk-auth@0.32.18
  - @plitzi/sdk-dev-tools@0.32.18
  - @plitzi/sdk-event-bridge@0.32.18
  - @plitzi/sdk-interactions@0.32.18
  - @plitzi/sdk-navigation@0.32.18
  - @plitzi/sdk-schema@0.32.18
  - @plitzi/sdk-shared@0.32.18

## 0.32.17

### Patch Changes

- v0.32.17
- Updated dependencies
  - @plitzi/sdk-auth@0.32.17
  - @plitzi/sdk-dev-tools@0.32.17
  - @plitzi/sdk-event-bridge@0.32.17
  - @plitzi/sdk-interactions@0.32.17
  - @plitzi/sdk-navigation@0.32.17
  - @plitzi/sdk-schema@0.32.17
  - @plitzi/sdk-shared@0.32.17

## 0.32.16

### Patch Changes

- v0.32.16
- Updated dependencies
  - @plitzi/sdk-auth@0.32.16
  - @plitzi/sdk-dev-tools@0.32.16
  - @plitzi/sdk-event-bridge@0.32.16
  - @plitzi/sdk-interactions@0.32.16
  - @plitzi/sdk-navigation@0.32.16
  - @plitzi/sdk-schema@0.32.16
  - @plitzi/sdk-shared@0.32.16

## 0.32.15

### Patch Changes

- v0.32.15
- Updated dependencies
  - @plitzi/nexus@0.32.15
  - @plitzi/sdk-auth@0.32.15
  - @plitzi/sdk-dev-tools@0.32.15
  - @plitzi/sdk-event-bridge@0.32.15
  - @plitzi/sdk-interactions@0.32.15
  - @plitzi/sdk-navigation@0.32.15
  - @plitzi/sdk-schema@0.32.15
  - @plitzi/sdk-shared@0.32.15

## 0.32.14

### Patch Changes

- v0.32.14
- Updated dependencies
  - @plitzi/nexus@0.32.14
  - @plitzi/sdk-auth@0.32.14
  - @plitzi/sdk-dev-tools@0.32.14
  - @plitzi/sdk-event-bridge@0.32.14
  - @plitzi/sdk-interactions@0.32.14
  - @plitzi/sdk-navigation@0.32.14
  - @plitzi/sdk-schema@0.32.14
  - @plitzi/sdk-shared@0.32.14

## 0.32.13

### Patch Changes

- v0.32.13
- Updated dependencies
  - @plitzi/nexus@0.32.13
  - @plitzi/sdk-auth@0.32.13
  - @plitzi/sdk-dev-tools@0.32.13
  - @plitzi/sdk-event-bridge@0.32.13
  - @plitzi/sdk-interactions@0.32.13
  - @plitzi/sdk-navigation@0.32.13
  - @plitzi/sdk-schema@0.32.13
  - @plitzi/sdk-shared@0.32.13

## 0.32.12

### Patch Changes

- v0.32.12
- Updated dependencies
  - @plitzi/nexus@0.32.12
  - @plitzi/sdk-auth@0.32.12
  - @plitzi/sdk-dev-tools@0.32.12
  - @plitzi/sdk-event-bridge@0.32.12
  - @plitzi/sdk-interactions@0.32.12
  - @plitzi/sdk-navigation@0.32.12
  - @plitzi/sdk-schema@0.32.12
  - @plitzi/sdk-shared@0.32.12

## 0.32.11

### Patch Changes

- v0.32.11
- Updated dependencies
  - @plitzi/nexus@0.32.11
  - @plitzi/sdk-auth@0.32.11
  - @plitzi/sdk-dev-tools@0.32.11
  - @plitzi/sdk-event-bridge@0.32.11
  - @plitzi/sdk-interactions@0.32.11
  - @plitzi/sdk-navigation@0.32.11
  - @plitzi/sdk-schema@0.32.11
  - @plitzi/sdk-shared@0.32.11

## 0.32.10

### Patch Changes

- v0.32.10
- Updated dependencies
  - @plitzi/nexus@0.32.10
  - @plitzi/sdk-auth@0.32.10
  - @plitzi/sdk-dev-tools@0.32.10
  - @plitzi/sdk-event-bridge@0.32.10
  - @plitzi/sdk-interactions@0.32.10
  - @plitzi/sdk-navigation@0.32.10
  - @plitzi/sdk-schema@0.32.10
  - @plitzi/sdk-shared@0.32.10

## 0.32.9

### Patch Changes

- v0.32.9
- Updated dependencies
  - @plitzi/nexus@0.32.9
  - @plitzi/sdk-auth@0.32.9
  - @plitzi/sdk-dev-tools@0.32.9
  - @plitzi/sdk-event-bridge@0.32.9
  - @plitzi/sdk-interactions@0.32.9
  - @plitzi/sdk-navigation@0.32.9
  - @plitzi/sdk-schema@0.32.9
  - @plitzi/sdk-shared@0.32.9

## 0.32.8

### Patch Changes

- v0.32.8
- Updated dependencies
  - @plitzi/nexus@0.32.8
  - @plitzi/sdk-auth@0.32.8
  - @plitzi/sdk-dev-tools@0.32.8
  - @plitzi/sdk-event-bridge@0.32.8
  - @plitzi/sdk-interactions@0.32.8
  - @plitzi/sdk-navigation@0.32.8
  - @plitzi/sdk-schema@0.32.8
  - @plitzi/sdk-shared@0.32.8

## 0.32.7

### Patch Changes

- v0.32.7
- Updated dependencies
  - @plitzi/nexus@0.32.7
  - @plitzi/sdk-auth@0.32.7
  - @plitzi/sdk-dev-tools@0.32.7
  - @plitzi/sdk-event-bridge@0.32.7
  - @plitzi/sdk-interactions@0.32.7
  - @plitzi/sdk-navigation@0.32.7
  - @plitzi/sdk-schema@0.32.7
  - @plitzi/sdk-shared@0.32.7

## 0.32.6

### Patch Changes

- v0.32.6
- Updated dependencies
  - @plitzi/nexus@0.32.6
  - @plitzi/sdk-auth@0.32.6
  - @plitzi/sdk-dev-tools@0.32.6
  - @plitzi/sdk-event-bridge@0.32.6
  - @plitzi/sdk-interactions@0.32.6
  - @plitzi/sdk-navigation@0.32.6
  - @plitzi/sdk-schema@0.32.6
  - @plitzi/sdk-shared@0.32.6

## 0.32.5

### Patch Changes

- v0.32.4
- Updated dependencies
  - @plitzi/nexus@0.32.5
  - @plitzi/sdk-auth@0.32.5
  - @plitzi/sdk-dev-tools@0.32.5
  - @plitzi/sdk-event-bridge@0.32.5
  - @plitzi/sdk-interactions@0.32.5
  - @plitzi/sdk-navigation@0.32.5
  - @plitzi/sdk-schema@0.32.5
  - @plitzi/sdk-shared@0.32.5

## 0.32.4

### Patch Changes

- v0.32.4
- Updated dependencies
  - @plitzi/nexus@0.32.4
  - @plitzi/sdk-auth@0.32.4
  - @plitzi/sdk-dev-tools@0.32.4
  - @plitzi/sdk-event-bridge@0.32.4
  - @plitzi/sdk-interactions@0.32.4
  - @plitzi/sdk-navigation@0.32.4
  - @plitzi/sdk-schema@0.32.4
  - @plitzi/sdk-shared@0.32.4

## 0.32.3

### Patch Changes

- v0.32.3
- Updated dependencies
  - @plitzi/nexus@0.32.3
  - @plitzi/sdk-auth@0.32.3
  - @plitzi/sdk-dev-tools@0.32.3
  - @plitzi/sdk-event-bridge@0.32.3
  - @plitzi/sdk-interactions@0.32.3
  - @plitzi/sdk-navigation@0.32.3
  - @plitzi/sdk-schema@0.32.3
  - @plitzi/sdk-shared@0.32.3

## 0.32.2

### Patch Changes

- v0.32.2
- Updated dependencies
  - @plitzi/nexus@0.32.2
  - @plitzi/sdk-auth@0.32.2
  - @plitzi/sdk-dev-tools@0.32.2
  - @plitzi/sdk-event-bridge@0.32.2
  - @plitzi/sdk-interactions@0.32.2
  - @plitzi/sdk-navigation@0.32.2
  - @plitzi/sdk-schema@0.32.2
  - @plitzi/sdk-shared@0.32.2

## 0.32.1

### Patch Changes

- v0.32.1
- Updated dependencies
  - @plitzi/nexus@0.32.1
  - @plitzi/sdk-auth@0.32.1
  - @plitzi/sdk-dev-tools@0.32.1
  - @plitzi/sdk-event-bridge@0.32.1
  - @plitzi/sdk-interactions@0.32.1
  - @plitzi/sdk-navigation@0.32.1
  - @plitzi/sdk-schema@0.32.1
  - @plitzi/sdk-shared@0.32.1

## 0.32.0

### Minor Changes

- v0.32.0

### Patch Changes

- Updated dependencies
  - @plitzi/nexus@0.32.0
  - @plitzi/sdk-auth@0.32.0
  - @plitzi/sdk-dev-tools@0.32.0
  - @plitzi/sdk-event-bridge@0.32.0
  - @plitzi/sdk-interactions@0.32.0
  - @plitzi/sdk-navigation@0.32.0
  - @plitzi/sdk-schema@0.32.0
  - @plitzi/sdk-shared@0.32.0

## 0.31.2

### Patch Changes

- v0.31.2
- Updated dependencies
  - @plitzi/nexus@0.31.2
  - @plitzi/sdk-auth@0.31.2
  - @plitzi/sdk-dev-tools@0.31.2
  - @plitzi/sdk-event-bridge@0.31.2
  - @plitzi/sdk-interactions@0.31.2
  - @plitzi/sdk-navigation@0.31.2
  - @plitzi/sdk-schema@0.31.2
  - @plitzi/sdk-shared@0.31.2

## 0.31.1

### Patch Changes

- v0.31.1
- Updated dependencies
  - @plitzi/nexus@0.31.1
  - @plitzi/sdk-auth@0.31.1
  - @plitzi/sdk-dev-tools@0.31.1
  - @plitzi/sdk-event-bridge@0.31.1
  - @plitzi/sdk-interactions@0.31.1
  - @plitzi/sdk-navigation@0.31.1
  - @plitzi/sdk-schema@0.31.1
  - @plitzi/sdk-shared@0.31.1

## 0.31.0

### Minor Changes

- v0.31.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-auth@0.31.0
  - @plitzi/sdk-dev-tools@0.31.0
  - @plitzi/sdk-event-bridge@0.31.0
  - @plitzi/sdk-interactions@0.31.0
  - @plitzi/sdk-navigation@0.31.0
  - @plitzi/sdk-schema@0.31.0
  - @plitzi/sdk-shared@0.31.0
  - @plitzi/nexus@0.31.0

## 0.30.19

### Patch Changes

- v0.30.19
- Updated dependencies
  - @plitzi/sdk-data-source@0.30.19
  - @plitzi/sdk-dev-tools@0.30.19
  - @plitzi/sdk-event-bridge@0.30.19
  - @plitzi/sdk-interactions@0.30.19
  - @plitzi/sdk-schema@0.30.19
  - @plitzi/sdk-shared@0.30.19
  - @plitzi/nexus@0.30.19

## 0.30.18

### Patch Changes

- v0.30.18
- Updated dependencies
  - @plitzi/sdk-data-source@0.30.18
  - @plitzi/sdk-dev-tools@0.30.18
  - @plitzi/sdk-event-bridge@0.30.18
  - @plitzi/sdk-interactions@0.30.18
  - @plitzi/sdk-schema@0.30.18
  - @plitzi/sdk-shared@0.30.18
  - @plitzi/nexus@0.30.18

## 0.30.17

### Patch Changes

- v0.31.0
- Updated dependencies
  - @plitzi/sdk-data-source@0.30.17
  - @plitzi/sdk-dev-tools@0.30.17
  - @plitzi/sdk-event-bridge@0.30.17
  - @plitzi/sdk-interactions@0.30.17
  - @plitzi/sdk-schema@0.30.17
  - @plitzi/sdk-shared@0.30.17
  - @plitzi/nexus@0.30.17

## 0.30.16

### Patch Changes

- v0.30.16
- Updated dependencies
  - @plitzi/sdk-data-source@0.30.16
  - @plitzi/sdk-dev-tools@0.30.16
  - @plitzi/sdk-event-bridge@0.30.16
  - @plitzi/sdk-interactions@0.30.16
  - @plitzi/sdk-schema@0.30.16
  - @plitzi/sdk-shared@0.30.16

## 0.30.15

### Patch Changes

- v0.30.15
- Updated dependencies
  - @plitzi/sdk-data-source@0.30.15
  - @plitzi/sdk-dev-tools@0.30.15
  - @plitzi/sdk-event-bridge@0.30.15
  - @plitzi/sdk-interactions@0.30.15
  - @plitzi/sdk-schema@0.30.15
  - @plitzi/sdk-shared@0.30.15

## 0.30.14

### Patch Changes

- v0.30.14
- Updated dependencies
  - @plitzi/sdk-data-source@0.30.14
  - @plitzi/sdk-dev-tools@0.30.14
  - @plitzi/sdk-event-bridge@0.30.14
  - @plitzi/sdk-interactions@0.30.14
  - @plitzi/sdk-schema@0.30.14
  - @plitzi/sdk-shared@0.30.14

## 0.30.13

### Patch Changes

- v0.30.13
- Updated dependencies
  - @plitzi/sdk-data-source@0.30.13
  - @plitzi/sdk-dev-tools@0.30.13
  - @plitzi/sdk-event-bridge@0.30.13
  - @plitzi/sdk-interactions@0.30.13
  - @plitzi/sdk-schema@0.30.13
  - @plitzi/sdk-shared@0.30.13

## 0.30.12

### Patch Changes

- v0.30.12
- Updated dependencies
  - @plitzi/sdk-data-source@0.30.12
  - @plitzi/sdk-dev-tools@0.30.12
  - @plitzi/sdk-event-bridge@0.30.12
  - @plitzi/sdk-interactions@0.30.12
  - @plitzi/sdk-schema@0.30.12
  - @plitzi/sdk-shared@0.30.12

## 0.30.11

### Patch Changes

- v0.30.11
- Updated dependencies
  - @plitzi/sdk-data-source@0.30.11
  - @plitzi/sdk-dev-tools@0.30.11
  - @plitzi/sdk-event-bridge@0.30.11
  - @plitzi/sdk-interactions@0.30.11
  - @plitzi/sdk-schema@0.30.11
  - @plitzi/sdk-shared@0.30.11

## 0.30.10

### Patch Changes

- v0.30.10
- Updated dependencies
  - @plitzi/sdk-data-source@0.30.10
  - @plitzi/sdk-dev-tools@0.30.10
  - @plitzi/sdk-event-bridge@0.30.10
  - @plitzi/sdk-interactions@0.30.10
  - @plitzi/sdk-schema@0.30.10
  - @plitzi/sdk-shared@0.30.10

## 0.30.9

### Patch Changes

- v0.30.9
- Updated dependencies
  - @plitzi/sdk-data-source@0.30.9
  - @plitzi/sdk-dev-tools@0.30.9
  - @plitzi/sdk-event-bridge@0.30.9
  - @plitzi/sdk-interactions@0.30.9
  - @plitzi/sdk-schema@0.30.9
  - @plitzi/sdk-shared@0.30.9

## 0.30.8

### Patch Changes

- v0.30.8
- Updated dependencies
  - @plitzi/sdk-interactions@0.30.8
  - @plitzi/sdk-data-source@0.30.8
  - @plitzi/sdk-dev-tools@0.30.8
  - @plitzi/sdk-event-bridge@0.30.8
  - @plitzi/sdk-schema@0.30.8
  - @plitzi/sdk-shared@0.30.8

## 0.30.7

### Patch Changes

- v0.30.7
- Updated dependencies
  - @plitzi/sdk-data-source@0.30.7
  - @plitzi/sdk-dev-tools@0.30.7
  - @plitzi/sdk-event-bridge@0.30.7
  - @plitzi/sdk-interactions@0.30.7
  - @plitzi/sdk-schema@0.30.7
  - @plitzi/sdk-shared@0.30.7

## 0.30.6

### Patch Changes

- v0.30.6
- Updated dependencies
  - @plitzi/sdk-shared@0.30.6
  - @plitzi/sdk-data-source@0.30.6
  - @plitzi/sdk-dev-tools@0.30.6
  - @plitzi/sdk-event-bridge@0.30.6
  - @plitzi/sdk-interactions@0.30.6
  - @plitzi/sdk-schema@0.30.6

## 0.30.5

### Patch Changes

- v0.30.5
- Updated dependencies
  - @plitzi/sdk-data-source@0.30.5
  - @plitzi/sdk-dev-tools@0.30.5
  - @plitzi/sdk-event-bridge@0.30.5
  - @plitzi/sdk-interactions@0.30.5
  - @plitzi/sdk-schema@0.30.5
  - @plitzi/sdk-shared@0.30.5

## 0.30.4

### Patch Changes

- v0.30.4
- Updated dependencies
  - @plitzi/sdk-data-source@0.30.4
  - @plitzi/sdk-dev-tools@0.30.4
  - @plitzi/sdk-event-bridge@0.30.4
  - @plitzi/sdk-interactions@0.30.4
  - @plitzi/sdk-schema@0.30.4
  - @plitzi/sdk-shared@0.30.4

## 0.30.3

### Patch Changes

- v0.30.3
- Updated dependencies
  - @plitzi/sdk-data-source@0.30.3
  - @plitzi/sdk-dev-tools@0.30.3
  - @plitzi/sdk-event-bridge@0.30.3
  - @plitzi/sdk-interactions@0.30.3
  - @plitzi/sdk-schema@0.30.3
  - @plitzi/sdk-shared@0.30.3

## 0.30.2

### Patch Changes

- v0.30.2
- Updated dependencies
  - @plitzi/sdk-interactions@0.30.2
  - @plitzi/sdk-dev-tools@0.30.2
  - @plitzi/sdk-schema@0.30.2
  - @plitzi/sdk-shared@0.30.2
  - @plitzi/sdk-data-source@0.30.2
  - @plitzi/sdk-event-bridge@0.30.2

## 0.30.1

### Patch Changes

- v0.30.1
- Updated dependencies
  - @plitzi/sdk-event-bridge@0.30.1
  - @plitzi/sdk-interactions@0.30.1
  - @plitzi/sdk-data-source@0.30.1
  - @plitzi/sdk-dev-tools@0.30.1
  - @plitzi/sdk-schema@0.30.1
  - @plitzi/sdk-shared@0.30.1

## 0.30.0

### Minor Changes

- v0.30.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-data-source@0.30.0
  - @plitzi/sdk-dev-tools@0.30.0
  - @plitzi/sdk-event-bridge@0.30.0
  - @plitzi/sdk-interactions@0.30.0
  - @plitzi/sdk-schema@0.30.0
  - @plitzi/sdk-shared@0.30.0

## 0.29.0

### Minor Changes

- v0.29.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-data-source@0.29.0
  - @plitzi/sdk-dev-tools@0.29.0
  - @plitzi/sdk-event-bridge@0.29.0
  - @plitzi/sdk-interactions@0.29.0
  - @plitzi/sdk-schema@0.29.0
  - @plitzi/sdk-shared@0.29.0

## 0.28.14

### Patch Changes

- v0.28.14
- Updated dependencies
  - @plitzi/sdk-shared@0.28.14
  - @plitzi/sdk-data-source@0.28.14
  - @plitzi/sdk-dev-tools@0.28.14
  - @plitzi/sdk-event-bridge@0.28.14
  - @plitzi/sdk-interactions@0.28.14
  - @plitzi/sdk-schema@0.28.14

## 0.28.13

### Patch Changes

- v0.28.13
- Updated dependencies
  - @plitzi/sdk-data-source@0.28.13
  - @plitzi/sdk-dev-tools@0.28.13
  - @plitzi/sdk-event-bridge@0.28.13
  - @plitzi/sdk-interactions@0.28.13
  - @plitzi/sdk-schema@0.28.13
  - @plitzi/sdk-shared@0.28.13

## 0.28.12

### Patch Changes

- v0.28.12
- Updated dependencies
  - @plitzi/sdk-data-source@0.28.12
  - @plitzi/sdk-dev-tools@0.28.12
  - @plitzi/sdk-event-bridge@0.28.12
  - @plitzi/sdk-interactions@0.28.12
  - @plitzi/sdk-schema@0.28.12
  - @plitzi/sdk-shared@0.28.12

## 0.28.11

### Patch Changes

- v0.28.11
- Updated dependencies
  - @plitzi/sdk-data-source@0.28.11
  - @plitzi/sdk-dev-tools@0.28.11
  - @plitzi/sdk-event-bridge@0.28.11
  - @plitzi/sdk-interactions@0.28.11
  - @plitzi/sdk-schema@0.28.11
  - @plitzi/sdk-shared@0.28.11

## 0.28.10

### Patch Changes

- v0.28.10
- Updated dependencies
  - @plitzi/sdk-data-source@0.28.10
  - @plitzi/sdk-dev-tools@0.28.10
  - @plitzi/sdk-event-bridge@0.28.10
  - @plitzi/sdk-interactions@0.28.10
  - @plitzi/sdk-schema@0.28.10
  - @plitzi/sdk-shared@0.28.10

## 0.28.9

### Patch Changes

- v0.28.9
- Updated dependencies
  - @plitzi/sdk-data-source@0.28.9
  - @plitzi/sdk-dev-tools@0.28.9
  - @plitzi/sdk-event-bridge@0.28.9
  - @plitzi/sdk-interactions@0.28.9
  - @plitzi/sdk-schema@0.28.9
  - @plitzi/sdk-shared@0.28.9

## 0.28.8

### Patch Changes

- v0.28.8
- Updated dependencies
  - @plitzi/sdk-data-source@0.28.8
  - @plitzi/sdk-dev-tools@0.28.8
  - @plitzi/sdk-event-bridge@0.28.8
  - @plitzi/sdk-interactions@0.28.8
  - @plitzi/sdk-schema@0.28.8
  - @plitzi/sdk-shared@0.28.8

## 0.28.7

### Patch Changes

- v0.28.7
- Updated dependencies
  - @plitzi/sdk-data-source@0.28.7
  - @plitzi/sdk-dev-tools@0.28.7
  - @plitzi/sdk-event-bridge@0.28.7
  - @plitzi/sdk-interactions@0.28.7
  - @plitzi/sdk-schema@0.28.7
  - @plitzi/sdk-shared@0.28.7

## 0.28.6

### Patch Changes

- v0.28.6
- Updated dependencies
  - @plitzi/sdk-data-source@0.28.6
  - @plitzi/sdk-dev-tools@0.28.6
  - @plitzi/sdk-event-bridge@0.28.6
  - @plitzi/sdk-interactions@0.28.6
  - @plitzi/sdk-schema@0.28.6
  - @plitzi/sdk-shared@0.28.6

## 0.28.5

### Patch Changes

- v0.28.5
- Updated dependencies
  - @plitzi/sdk-data-source@0.28.5
  - @plitzi/sdk-dev-tools@0.28.5
  - @plitzi/sdk-event-bridge@0.28.5
  - @plitzi/sdk-interactions@0.28.5
  - @plitzi/sdk-schema@0.28.5
  - @plitzi/sdk-shared@0.28.5

## 0.28.4

### Patch Changes

- v0.28.4
- Updated dependencies
  - @plitzi/sdk-data-source@0.28.4
  - @plitzi/sdk-dev-tools@0.28.4
  - @plitzi/sdk-event-bridge@0.28.4
  - @plitzi/sdk-interactions@0.28.4
  - @plitzi/sdk-schema@0.28.4
  - @plitzi/sdk-shared@0.28.4

## 0.28.3

### Patch Changes

- v0.28.3
- Updated dependencies
  - @plitzi/sdk-data-source@0.28.3
  - @plitzi/sdk-dev-tools@0.28.3
  - @plitzi/sdk-event-bridge@0.28.3
  - @plitzi/sdk-interactions@0.28.3
  - @plitzi/sdk-schema@0.28.3
  - @plitzi/sdk-shared@0.28.3

## 0.28.2

### Patch Changes

- v0.28.2
- Updated dependencies
  - @plitzi/sdk-data-source@0.28.2
  - @plitzi/sdk-dev-tools@0.28.2
  - @plitzi/sdk-event-bridge@0.28.2
  - @plitzi/sdk-interactions@0.28.2
  - @plitzi/sdk-schema@0.28.2
  - @plitzi/sdk-shared@0.28.2

## 0.28.1

### Patch Changes

- v0.28.1
- Updated dependencies
  - @plitzi/sdk-data-source@0.28.1
  - @plitzi/sdk-dev-tools@0.28.1
  - @plitzi/sdk-event-bridge@0.28.1
  - @plitzi/sdk-interactions@0.28.1
  - @plitzi/sdk-schema@0.28.1
  - @plitzi/sdk-shared@0.28.1

## 0.28.0

### Minor Changes

- v0.28.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-data-source@0.28.0
  - @plitzi/sdk-dev-tools@0.28.0
  - @plitzi/sdk-event-bridge@0.28.0
  - @plitzi/sdk-interactions@0.28.0
  - @plitzi/sdk-schema@0.28.0
  - @plitzi/sdk-shared@0.28.0

## 0.27.23

### Patch Changes

- v0.27.23
- Updated dependencies
  - @plitzi/sdk-shared@0.27.23
  - @plitzi/sdk-data-source@0.27.23
  - @plitzi/sdk-dev-tools@0.27.23
  - @plitzi/sdk-event-bridge@0.27.23
  - @plitzi/sdk-interactions@0.27.23
  - @plitzi/sdk-schema@0.27.23

## 0.27.22

### Patch Changes

- v0.27.22
- Updated dependencies
  - @plitzi/sdk-data-source@0.27.22
  - @plitzi/sdk-dev-tools@0.27.22
  - @plitzi/sdk-event-bridge@0.27.22
  - @plitzi/sdk-interactions@0.27.22
  - @plitzi/sdk-schema@0.27.22
  - @plitzi/sdk-shared@0.27.22

## 0.27.21

### Patch Changes

- v0.27.21
- Updated dependencies
  - @plitzi/sdk-data-source@0.27.21
  - @plitzi/sdk-dev-tools@0.27.21
  - @plitzi/sdk-event-bridge@0.27.21
  - @plitzi/sdk-interactions@0.27.21
  - @plitzi/sdk-schema@0.27.21
  - @plitzi/sdk-shared@0.27.21

## 0.27.20

### Patch Changes

- v0.27.20
- Updated dependencies
  - @plitzi/sdk-data-source@0.27.20
  - @plitzi/sdk-dev-tools@0.27.20
  - @plitzi/sdk-event-bridge@0.27.20
  - @plitzi/sdk-interactions@0.27.20
  - @plitzi/sdk-schema@0.27.20
  - @plitzi/sdk-shared@0.27.20

## 0.27.19

### Patch Changes

- v0.27.19
- Updated dependencies
  - @plitzi/sdk-data-source@0.27.19
  - @plitzi/sdk-dev-tools@0.27.19
  - @plitzi/sdk-event-bridge@0.27.19
  - @plitzi/sdk-interactions@0.27.19
  - @plitzi/sdk-schema@0.27.19
  - @plitzi/sdk-shared@0.27.19

## 0.27.18

### Patch Changes

- v0.27.18
- Updated dependencies
  - @plitzi/sdk-data-source@0.27.18
  - @plitzi/sdk-dev-tools@0.27.18
  - @plitzi/sdk-event-bridge@0.27.18
  - @plitzi/sdk-interactions@0.27.18
  - @plitzi/sdk-schema@0.27.18
  - @plitzi/sdk-shared@0.27.18

## 0.27.17

### Patch Changes

- v0.27.17
- Updated dependencies
  - @plitzi/sdk-interactions@0.27.17
  - @plitzi/sdk-shared@0.27.17
  - @plitzi/sdk-data-source@0.27.17
  - @plitzi/sdk-dev-tools@0.27.17
  - @plitzi/sdk-event-bridge@0.27.17
  - @plitzi/sdk-schema@0.27.17

## 0.27.16

### Patch Changes

- v0.27.16
- Updated dependencies
  - @plitzi/sdk-shared@0.27.16
  - @plitzi/sdk-data-source@0.27.16
  - @plitzi/sdk-dev-tools@0.27.16
  - @plitzi/sdk-event-bridge@0.27.16
  - @plitzi/sdk-interactions@0.27.16
  - @plitzi/sdk-schema@0.27.16

## 0.27.15

### Patch Changes

- v0.27.15
- Updated dependencies
  - @plitzi/sdk-data-source@0.27.15
  - @plitzi/sdk-dev-tools@0.27.15
  - @plitzi/sdk-event-bridge@0.27.15
  - @plitzi/sdk-interactions@0.27.15
  - @plitzi/sdk-schema@0.27.15
  - @plitzi/sdk-shared@0.27.15

## 0.27.14

### Patch Changes

- v0.27.14
- Updated dependencies
  - @plitzi/sdk-data-source@0.27.14
  - @plitzi/sdk-dev-tools@0.27.14
  - @plitzi/sdk-event-bridge@0.27.14
  - @plitzi/sdk-interactions@0.27.14
  - @plitzi/sdk-schema@0.27.14
  - @plitzi/sdk-shared@0.27.14

## 0.27.13

### Patch Changes

- v0.27.13
- Updated dependencies
  - @plitzi/sdk-data-source@0.27.13
  - @plitzi/sdk-dev-tools@0.27.13
  - @plitzi/sdk-event-bridge@0.27.13
  - @plitzi/sdk-interactions@0.27.13
  - @plitzi/sdk-schema@0.27.13
  - @plitzi/sdk-shared@0.27.13

## 0.27.12

### Patch Changes

- v0.27.12
- Updated dependencies
  - @plitzi/sdk-data-source@0.27.12
  - @plitzi/sdk-dev-tools@0.27.12
  - @plitzi/sdk-event-bridge@0.27.12
  - @plitzi/sdk-interactions@0.27.12
  - @plitzi/sdk-schema@0.27.12
  - @plitzi/sdk-shared@0.27.12

## 0.27.11

### Patch Changes

- v0.27.11
- Updated dependencies
  - @plitzi/sdk-data-source@0.27.11
  - @plitzi/sdk-dev-tools@0.27.11
  - @plitzi/sdk-event-bridge@0.27.11
  - @plitzi/sdk-interactions@0.27.11
  - @plitzi/sdk-schema@0.27.11
  - @plitzi/sdk-shared@0.27.11

## 0.27.10

### Patch Changes

- v0.27.10
- Updated dependencies
  - @plitzi/sdk-data-source@0.27.10
  - @plitzi/sdk-dev-tools@0.27.10
  - @plitzi/sdk-event-bridge@0.27.10
  - @plitzi/sdk-interactions@0.27.10
  - @plitzi/sdk-schema@0.27.10
  - @plitzi/sdk-shared@0.27.10

## 0.27.9

### Patch Changes

- v0.27.9
- Updated dependencies
  - @plitzi/sdk-data-source@0.27.9
  - @plitzi/sdk-dev-tools@0.27.9
  - @plitzi/sdk-event-bridge@0.27.9
  - @plitzi/sdk-interactions@0.27.9
  - @plitzi/sdk-schema@0.27.9
  - @plitzi/sdk-shared@0.27.9

## 0.27.8

### Patch Changes

- v0.27.8
- Updated dependencies
  - @plitzi/sdk-shared@0.27.8
  - @plitzi/sdk-data-source@0.27.8
  - @plitzi/sdk-dev-tools@0.27.8
  - @plitzi/sdk-event-bridge@0.27.8
  - @plitzi/sdk-interactions@0.27.8
  - @plitzi/sdk-schema@0.27.8

## 0.27.7

### Patch Changes

- v0.27.7
- Updated dependencies
  - @plitzi/sdk-data-source@0.27.7
  - @plitzi/sdk-dev-tools@0.27.7
  - @plitzi/sdk-event-bridge@0.27.7
  - @plitzi/sdk-interactions@0.27.7
  - @plitzi/sdk-schema@0.27.7
  - @plitzi/sdk-shared@0.27.7

## 0.27.6

### Patch Changes

- v0.27.6
- Updated dependencies
  - @plitzi/sdk-data-source@0.27.6
  - @plitzi/sdk-dev-tools@0.27.6
  - @plitzi/sdk-event-bridge@0.27.6
  - @plitzi/sdk-interactions@0.27.6
  - @plitzi/sdk-schema@0.27.6
  - @plitzi/sdk-shared@0.27.6

## 0.27.5

### Patch Changes

- v0.27.5
- Updated dependencies
  - @plitzi/sdk-data-source@0.27.5
  - @plitzi/sdk-dev-tools@0.27.5
  - @plitzi/sdk-event-bridge@0.27.5
  - @plitzi/sdk-interactions@0.27.5
  - @plitzi/sdk-schema@0.27.5
  - @plitzi/sdk-shared@0.27.5

## 0.27.4

### Patch Changes

- v0.27.4
- Updated dependencies
  - @plitzi/sdk-data-source@0.27.4
  - @plitzi/sdk-dev-tools@0.27.4
  - @plitzi/sdk-event-bridge@0.27.4
  - @plitzi/sdk-interactions@0.27.4
  - @plitzi/sdk-schema@0.27.4
  - @plitzi/sdk-shared@0.27.4

## 0.27.3

### Patch Changes

- v0.27.3
- Updated dependencies
  - @plitzi/sdk-data-source@0.27.3
  - @plitzi/sdk-dev-tools@0.27.3
  - @plitzi/sdk-event-bridge@0.27.3
  - @plitzi/sdk-interactions@0.27.3
  - @plitzi/sdk-schema@0.27.3
  - @plitzi/sdk-shared@0.27.3

## 0.27.2

### Patch Changes

- v0.27.2
- Updated dependencies
  - @plitzi/sdk-data-source@0.27.2
  - @plitzi/sdk-dev-tools@0.27.2
  - @plitzi/sdk-event-bridge@0.27.2
  - @plitzi/sdk-interactions@0.27.2
  - @plitzi/sdk-schema@0.27.2
  - @plitzi/sdk-shared@0.27.2

## 0.27.1

### Patch Changes

- v0.27.1
- Updated dependencies
  - @plitzi/sdk-dev-tools@0.27.1
  - @plitzi/sdk-shared@0.27.1
  - @plitzi/sdk-data-source@0.27.1
  - @plitzi/sdk-event-bridge@0.27.1
  - @plitzi/sdk-interactions@0.27.1
  - @plitzi/sdk-schema@0.27.1

## 0.27.0

### Minor Changes

- v0.27.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-data-source@0.27.0
  - @plitzi/sdk-dev-tools@0.27.0
  - @plitzi/sdk-event-bridge@0.27.0
  - @plitzi/sdk-interactions@0.27.0
  - @plitzi/sdk-schema@0.27.0
  - @plitzi/sdk-shared@0.27.0

## 0.26.5

### Patch Changes

- v0.26.5
- Updated dependencies
  - @plitzi/sdk-event-bridge@0.26.5
  - @plitzi/sdk-interactions@0.26.5
  - @plitzi/sdk-data-source@0.26.5
  - @plitzi/sdk-dev-tools@0.26.5
  - @plitzi/sdk-schema@0.26.5
  - @plitzi/sdk-shared@0.26.5

## 0.26.4

### Patch Changes

- v0.26.4
- Updated dependencies
  - @plitzi/sdk-data-source@0.26.4
  - @plitzi/sdk-dev-tools@0.26.4
  - @plitzi/sdk-event-bridge@0.26.4
  - @plitzi/sdk-interactions@0.26.4
  - @plitzi/sdk-schema@0.26.4
  - @plitzi/sdk-shared@0.26.4

## 0.26.3

### Patch Changes

- v0.26.3
- Updated dependencies
  - @plitzi/sdk-data-source@0.26.3
  - @plitzi/sdk-dev-tools@0.26.3
  - @plitzi/sdk-event-bridge@0.26.3
  - @plitzi/sdk-interactions@0.26.3
  - @plitzi/sdk-schema@0.26.3
  - @plitzi/sdk-shared@0.26.3

## 0.26.2

### Patch Changes

- v0.26.2
- Updated dependencies
  - @plitzi/sdk-event-bridge@0.26.2
  - @plitzi/sdk-interactions@0.26.2
  - @plitzi/sdk-data-source@0.26.2
  - @plitzi/sdk-dev-tools@0.26.2
  - @plitzi/sdk-schema@0.26.2
  - @plitzi/sdk-shared@0.26.2

## 0.26.1

### Patch Changes

- v0.26.1
- Updated dependencies
  - @plitzi/sdk-data-source@0.26.1
  - @plitzi/sdk-dev-tools@0.26.1
  - @plitzi/sdk-event-bridge@0.26.1
  - @plitzi/sdk-interactions@0.26.1
  - @plitzi/sdk-schema@0.26.1
  - @plitzi/sdk-shared@0.26.1

## 0.26.0

### Minor Changes

- v0.26.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-data-source@0.26.0
  - @plitzi/sdk-dev-tools@0.26.0
  - @plitzi/sdk-event-bridge@0.26.0
  - @plitzi/sdk-interactions@0.26.0
  - @plitzi/sdk-schema@0.26.0
  - @plitzi/sdk-shared@0.26.0

## 0.25.12

### Patch Changes

- v0.25.12
- Updated dependencies
  - @plitzi/sdk-data-source@0.25.12
  - @plitzi/sdk-dev-tools@0.25.12
  - @plitzi/sdk-event-bridge@0.25.12
  - @plitzi/sdk-interactions@0.25.12
  - @plitzi/sdk-schema@0.25.12
  - @plitzi/sdk-shared@0.25.12

## 0.25.11

### Patch Changes

- v0.25.11
- Updated dependencies
  - @plitzi/sdk-data-source@0.25.11
  - @plitzi/sdk-dev-tools@0.25.11
  - @plitzi/sdk-event-bridge@0.25.11
  - @plitzi/sdk-interactions@0.25.11
  - @plitzi/sdk-schema@0.25.11
  - @plitzi/sdk-shared@0.25.11

## 0.25.10

### Patch Changes

- v0.25.10
- Updated dependencies
  - @plitzi/sdk-data-source@0.25.10
  - @plitzi/sdk-dev-tools@0.25.10
  - @plitzi/sdk-event-bridge@0.25.10
  - @plitzi/sdk-interactions@0.25.10
  - @plitzi/sdk-schema@0.25.10
  - @plitzi/sdk-shared@0.25.10

## 0.25.9

### Patch Changes

- v0.25.9
- Updated dependencies
  - @plitzi/sdk-data-source@0.25.9
  - @plitzi/sdk-dev-tools@0.25.9
  - @plitzi/sdk-event-bridge@0.25.9
  - @plitzi/sdk-interactions@0.25.9
  - @plitzi/sdk-schema@0.25.9
  - @plitzi/sdk-shared@0.25.9

## 0.25.8

### Patch Changes

- v0.25.8
- Updated dependencies
  - @plitzi/sdk-data-source@0.25.8
  - @plitzi/sdk-dev-tools@0.25.8
  - @plitzi/sdk-event-bridge@0.25.8
  - @plitzi/sdk-interactions@0.25.8
  - @plitzi/sdk-schema@0.25.8
  - @plitzi/sdk-shared@0.25.8

## 0.25.7

### Patch Changes

- v0.25.7
- Updated dependencies
  - @plitzi/sdk-data-source@0.25.7
  - @plitzi/sdk-dev-tools@0.25.7
  - @plitzi/sdk-event-bridge@0.25.7
  - @plitzi/sdk-interactions@0.25.7
  - @plitzi/sdk-schema@0.25.7
  - @plitzi/sdk-shared@0.25.7

## 0.25.6

### Patch Changes

- v0.25.6
- Updated dependencies
  - @plitzi/sdk-data-source@0.25.6
  - @plitzi/sdk-dev-tools@0.25.6
  - @plitzi/sdk-event-bridge@0.25.6
  - @plitzi/sdk-interactions@0.25.6
  - @plitzi/sdk-schema@0.25.6
  - @plitzi/sdk-shared@0.25.6

## 0.25.5

### Patch Changes

- v0.25.5
- Updated dependencies
  - @plitzi/sdk-data-source@0.25.5
  - @plitzi/sdk-dev-tools@0.25.5
  - @plitzi/sdk-event-bridge@0.25.5
  - @plitzi/sdk-interactions@0.25.5
  - @plitzi/sdk-schema@0.25.5
  - @plitzi/sdk-shared@0.25.5

## 0.25.4

### Patch Changes

- v0.25.4
- Updated dependencies
  - @plitzi/sdk-event-bridge@0.25.4
  - @plitzi/sdk-interactions@0.25.4
  - @plitzi/sdk-data-source@0.25.4
  - @plitzi/sdk-dev-tools@0.25.4
  - @plitzi/sdk-schema@0.25.4
  - @plitzi/sdk-shared@0.25.4

## 0.25.3

### Patch Changes

- v0.25.3
- Updated dependencies
  - @plitzi/sdk-data-source@0.25.3
  - @plitzi/sdk-dev-tools@0.25.3
  - @plitzi/sdk-event-bridge@0.25.3
  - @plitzi/sdk-interactions@0.25.3
  - @plitzi/sdk-schema@0.25.3
  - @plitzi/sdk-shared@0.25.3

## 0.25.2

### Patch Changes

- v0.25.2
- Updated dependencies
  - @plitzi/sdk-schema@0.25.2
  - @plitzi/sdk-shared@0.25.2
  - @plitzi/sdk-data-source@0.25.2
  - @plitzi/sdk-dev-tools@0.25.2
  - @plitzi/sdk-event-bridge@0.25.2
  - @plitzi/sdk-interactions@0.25.2

## 0.25.1

### Patch Changes

- v0.25.1
- Updated dependencies
  - @plitzi/sdk-event-bridge@0.25.1
  - @plitzi/sdk-interactions@0.25.1
  - @plitzi/sdk-data-source@0.25.1
  - @plitzi/sdk-dev-tools@0.25.1
  - @plitzi/sdk-schema@0.25.1
  - @plitzi/sdk-shared@0.25.1

## 0.25.0

### Minor Changes

- v0.25.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-data-source@0.25.0
  - @plitzi/sdk-dev-tools@0.25.0
  - @plitzi/sdk-event-bridge@0.25.0
  - @plitzi/sdk-interactions@0.25.0
  - @plitzi/sdk-schema@0.25.0
  - @plitzi/sdk-shared@0.25.0

## 0.24.12

### Patch Changes

- v0.24.12
- Updated dependencies
  - @plitzi/sdk-event-bridge@0.24.12
  - @plitzi/sdk-interactions@0.24.12
  - @plitzi/sdk-data-source@0.24.12
  - @plitzi/sdk-dev-tools@0.24.12
  - @plitzi/sdk-schema@0.24.12
  - @plitzi/sdk-shared@0.24.12

## 0.24.11

### Patch Changes

- v0.24.11
- Updated dependencies
  - @plitzi/sdk-data-source@0.24.11
  - @plitzi/sdk-dev-tools@0.24.11
  - @plitzi/sdk-event-bridge@0.24.11
  - @plitzi/sdk-interactions@0.24.11
  - @plitzi/sdk-schema@0.24.11
  - @plitzi/sdk-shared@0.24.11

## 0.24.10

### Patch Changes

- v0.24.10
- Updated dependencies
  - @plitzi/sdk-data-source@0.24.10
  - @plitzi/sdk-dev-tools@0.24.10
  - @plitzi/sdk-event-bridge@0.24.10
  - @plitzi/sdk-interactions@0.24.10
  - @plitzi/sdk-schema@0.24.10
  - @plitzi/sdk-shared@0.24.10

## 0.24.9

### Patch Changes

- v0.24.9
- Updated dependencies
  - @plitzi/sdk-shared@0.24.9
  - @plitzi/sdk-data-source@0.24.9
  - @plitzi/sdk-dev-tools@0.24.9
  - @plitzi/sdk-event-bridge@0.24.9
  - @plitzi/sdk-interactions@0.24.9
  - @plitzi/sdk-schema@0.24.9

## 0.24.8

### Patch Changes

- v0.24.8
- Updated dependencies
  - @plitzi/sdk-event-bridge@0.24.8
  - @plitzi/sdk-interactions@0.24.8
  - @plitzi/sdk-data-source@0.24.8
  - @plitzi/sdk-dev-tools@0.24.8
  - @plitzi/sdk-schema@0.24.8
  - @plitzi/sdk-shared@0.24.8

## 0.24.7

### Patch Changes

- v0.24.7
- Updated dependencies
  - @plitzi/sdk-data-source@0.24.7
  - @plitzi/sdk-dev-tools@0.24.7
  - @plitzi/sdk-event-bridge@0.24.7
  - @plitzi/sdk-interactions@0.24.7
  - @plitzi/sdk-schema@0.24.7
  - @plitzi/sdk-shared@0.24.7

## 0.24.6

### Patch Changes

- v0.24.6
- Updated dependencies
  - @plitzi/sdk-data-source@0.24.6
  - @plitzi/sdk-dev-tools@0.24.6
  - @plitzi/sdk-event-bridge@0.24.6
  - @plitzi/sdk-interactions@0.24.6
  - @plitzi/sdk-schema@0.24.6
  - @plitzi/sdk-shared@0.24.6

## 0.24.5

### Patch Changes

- v0.24.5
- Updated dependencies
  - @plitzi/sdk-event-bridge@0.24.5
  - @plitzi/sdk-interactions@0.24.5
  - @plitzi/sdk-data-source@0.24.5
  - @plitzi/sdk-dev-tools@0.24.5
  - @plitzi/sdk-schema@0.24.5
  - @plitzi/sdk-shared@0.24.5

## 0.24.4

### Patch Changes

- v0.24.4
- Updated dependencies
  - @plitzi/sdk-event-bridge@0.24.4
  - @plitzi/sdk-interactions@0.24.4
  - @plitzi/sdk-data-source@0.24.4
  - @plitzi/sdk-dev-tools@0.24.4
  - @plitzi/sdk-schema@0.24.4
  - @plitzi/sdk-shared@0.24.4

## 0.24.3

### Patch Changes

- v0.24.3
- Updated dependencies
  - @plitzi/sdk-schema@0.24.3
  - @plitzi/sdk-data-source@0.24.3
  - @plitzi/sdk-dev-tools@0.24.3
  - @plitzi/sdk-event-bridge@0.24.3
  - @plitzi/sdk-interactions@0.24.3
  - @plitzi/sdk-shared@0.24.3

## 0.24.2

### Patch Changes

- v0.24.2
- Updated dependencies
  - @plitzi/sdk-data-source@0.24.2
  - @plitzi/sdk-dev-tools@0.24.2
  - @plitzi/sdk-event-bridge@0.24.2
  - @plitzi/sdk-interactions@0.24.2
  - @plitzi/sdk-schema@0.24.2
  - @plitzi/sdk-shared@0.24.2

## 0.24.1

### Patch Changes

- v0.24.1
- Updated dependencies
  - @plitzi/sdk-data-source@0.24.1
  - @plitzi/sdk-dev-tools@0.24.1
  - @plitzi/sdk-event-bridge@0.24.1
  - @plitzi/sdk-interactions@0.24.1
  - @plitzi/sdk-schema@0.24.1
  - @plitzi/sdk-shared@0.24.1

## 0.24.0

### Minor Changes

- v0.24.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-data-source@0.24.0
  - @plitzi/sdk-dev-tools@0.24.0
  - @plitzi/sdk-event-bridge@0.24.0
  - @plitzi/sdk-interactions@0.24.0
  - @plitzi/sdk-schema@0.24.0
  - @plitzi/sdk-shared@0.24.0

## 0.23.24

### Patch Changes

- v0.23.24
- Updated dependencies
  - @plitzi/sdk-data-source@0.23.24
  - @plitzi/sdk-dev-tools@0.23.24
  - @plitzi/sdk-event-bridge@0.23.24
  - @plitzi/sdk-shared@0.23.24

## 0.23.23

### Patch Changes

- v0.23.23
- Updated dependencies
  - @plitzi/sdk-data-source@0.23.23
  - @plitzi/sdk-dev-tools@0.23.23
  - @plitzi/sdk-event-bridge@0.23.23
  - @plitzi/sdk-shared@0.23.23

## 0.23.22

### Patch Changes

- v0.23.22
- Updated dependencies
  - @plitzi/sdk-data-source@0.23.22
  - @plitzi/sdk-dev-tools@0.23.22
  - @plitzi/sdk-event-bridge@0.23.22
  - @plitzi/sdk-shared@0.23.22

## 0.23.21

### Patch Changes

- v0.23.21
- Updated dependencies
  - @plitzi/sdk-data-source@0.23.21
  - @plitzi/sdk-dev-tools@0.23.21
  - @plitzi/sdk-event-bridge@0.23.21
  - @plitzi/sdk-shared@0.23.21

## 0.23.20

### Patch Changes

- v0.23.20
- Updated dependencies
  - @plitzi/sdk-data-source@0.23.20
  - @plitzi/sdk-dev-tools@0.23.20
  - @plitzi/sdk-event-bridge@0.23.20
  - @plitzi/sdk-shared@0.23.20

## 0.23.19

### Patch Changes

- v0.23.19
- Updated dependencies
  - @plitzi/sdk-data-source@0.23.19
  - @plitzi/sdk-dev-tools@0.23.19
  - @plitzi/sdk-event-bridge@0.23.19
  - @plitzi/sdk-shared@0.23.19

## 0.23.18

### Patch Changes

- v0.23.18
- Updated dependencies
  - @plitzi/sdk-data-source@0.23.18
  - @plitzi/sdk-dev-tools@0.23.18
  - @plitzi/sdk-event-bridge@0.23.18
  - @plitzi/sdk-shared@0.23.18

## 0.23.17

### Patch Changes

- v0.23.17
- Updated dependencies
  - @plitzi/sdk-data-source@0.23.17
  - @plitzi/sdk-dev-tools@0.23.17
  - @plitzi/sdk-event-bridge@0.23.17
  - @plitzi/sdk-shared@0.23.17

## 0.23.16

### Patch Changes

- v0.23.16
- Updated dependencies
  - @plitzi/sdk-data-source@0.23.16
  - @plitzi/sdk-dev-tools@0.23.16
  - @plitzi/sdk-event-bridge@0.23.16
  - @plitzi/sdk-shared@0.23.16

## 0.23.15

### Patch Changes

- v0.23.15
- Updated dependencies
  - @plitzi/sdk-data-source@0.23.15
  - @plitzi/sdk-dev-tools@0.23.15
  - @plitzi/sdk-event-bridge@0.23.15
  - @plitzi/sdk-shared@0.23.15

## 0.23.14

### Patch Changes

- v0.23.14
- Updated dependencies
  - @plitzi/sdk-event-bridge@0.23.14
  - @plitzi/sdk-data-source@0.23.14
  - @plitzi/sdk-dev-tools@0.23.14
  - @plitzi/sdk-shared@0.23.14

## 0.23.13

### Patch Changes

- v0.23.13
- Updated dependencies
  - @plitzi/sdk-data-source@0.23.13
  - @plitzi/sdk-dev-tools@0.23.13
  - @plitzi/sdk-event-bridge@0.23.13
  - @plitzi/sdk-shared@0.23.13

## 0.23.12

### Patch Changes

- v0.23.12
- Updated dependencies
  - @plitzi/sdk-data-source@0.23.12
  - @plitzi/sdk-dev-tools@0.23.12
  - @plitzi/sdk-event-bridge@0.23.12
  - @plitzi/sdk-shared@0.23.12

## 0.23.11

### Patch Changes

- v0.23.11
- Updated dependencies
  - @plitzi/sdk-data-source@0.23.11
  - @plitzi/sdk-dev-tools@0.23.11
  - @plitzi/sdk-event-bridge@0.23.11
  - @plitzi/sdk-shared@0.23.11

## 0.23.10

### Patch Changes

- v0.23.10
- Updated dependencies
  - @plitzi/sdk-data-source@0.23.10
  - @plitzi/sdk-dev-tools@0.23.10
  - @plitzi/sdk-event-bridge@0.23.10
  - @plitzi/sdk-shared@0.23.10

## 0.23.9

### Patch Changes

- v0.23.9
- Updated dependencies
  - @plitzi/sdk-data-source@0.23.9
  - @plitzi/sdk-dev-tools@0.23.9
  - @plitzi/sdk-event-bridge@0.23.9
  - @plitzi/sdk-shared@0.23.9

## 0.23.8

### Patch Changes

- v0.23.8
- Updated dependencies
  - @plitzi/sdk-data-source@0.23.8
  - @plitzi/sdk-dev-tools@0.23.8
  - @plitzi/sdk-event-bridge@0.23.8
  - @plitzi/sdk-shared@0.23.8

## 0.23.7

### Patch Changes

- v0.23.7
- Updated dependencies
  - @plitzi/sdk-shared@0.23.7
  - @plitzi/sdk-data-source@0.23.7
  - @plitzi/sdk-dev-tools@0.23.7
  - @plitzi/sdk-event-bridge@0.23.7

## 0.23.6

### Patch Changes

- v0.23.6
- Updated dependencies
  - @plitzi/sdk-data-source@0.23.6
  - @plitzi/sdk-dev-tools@0.23.6
  - @plitzi/sdk-event-bridge@0.23.6
  - @plitzi/sdk-shared@0.23.6

## 0.23.5

### Patch Changes

- v0.23.5
- Updated dependencies
  - @plitzi/sdk-data-source@0.23.5
  - @plitzi/sdk-dev-tools@0.23.5
  - @plitzi/sdk-event-bridge@0.23.5
  - @plitzi/sdk-shared@0.23.5

## 0.23.4

### Patch Changes

- v0.23.4
- Updated dependencies
  - @plitzi/sdk-data-source@0.23.4
  - @plitzi/sdk-dev-tools@0.23.4
  - @plitzi/sdk-event-bridge@0.23.4
  - @plitzi/sdk-shared@0.23.4

## 0.23.3

### Patch Changes

- v0.23.3
- Updated dependencies
  - @plitzi/sdk-shared@0.23.3

## 0.23.2

### Patch Changes

- v0.23.2
- Updated dependencies
  - @plitzi/sdk-shared@0.23.2

## 0.23.1

### Patch Changes

- v0.23.1
- Updated dependencies
  - @plitzi/sdk-shared@0.23.1

## 0.23.0

### Minor Changes

- v0.23.0

### Patch Changes

- Updated dependencies
  - @plitzi/sdk-shared@0.23.0

## 0.22.20

### Patch Changes

- v0.22.20
- Updated dependencies
  - @plitzi/sdk-shared@0.22.20

## 0.22.19

### Patch Changes

- v0.22.19
- Updated dependencies
  - @plitzi/sdk-shared@0.22.19

## 0.22.18

### Patch Changes

- v0.22.18
- Updated dependencies
  - @plitzi/sdk-shared@0.22.18

## 0.22.17

### Patch Changes

- v0.22.17
- Updated dependencies
  - @plitzi/sdk-shared@0.22.17

## 0.22.16

### Patch Changes

- v0.22.16
- Updated dependencies
  - @plitzi/sdk-shared@0.22.16

## 0.22.15

### Patch Changes

- v0.22.15
- Updated dependencies
  - @plitzi/sdk-shared@0.22.15

## 0.22.14

### Patch Changes

- v0.22.14
- Updated dependencies
  - @plitzi/sdk-shared@0.22.14

## 0.22.13

### Patch Changes

- v0.22.13
- Updated dependencies
  - @plitzi/sdk-shared@0.22.13

## 0.22.12

### Patch Changes

- v0.22.12
- Updated dependencies
  - @plitzi/sdk-shared@0.22.12

## 0.22.11

### Patch Changes

- v0.22.11
- Updated dependencies
  - @plitzi/sdk-shared@0.22.11

## 0.22.10

### Patch Changes

- v0.22.10
- Updated dependencies
  - @plitzi/sdk-shared@0.22.10

## 0.22.9

### Patch Changes

- v0.22.9
- Updated dependencies
  - @plitzi/sdk-shared@0.22.9

## 0.22.8

### Patch Changes

- v0.22.8
- Updated dependencies
  - @plitzi/sdk-shared@0.22.8

## 0.22.7

### Patch Changes

- v0.22.7
- Updated dependencies
  - @plitzi/sdk-shared@0.22.7

## 0.22.6

### Patch Changes

- v0.22.6
- Updated dependencies
  - @plitzi/sdk-shared@0.22.6

## 0.22.5

### Patch Changes

- v0.22.5
- Updated dependencies
  - @plitzi/sdk-shared@0.22.5

## 0.22.4

### Patch Changes

- v0.22.4
- Updated dependencies
  - @plitzi/sdk-shared@0.22.4
