---
'@plitzi/sdk-shared': patch
'@plitzi/sdk-authoring': patch
'@plitzi/sdk-server': patch
'@plitzi/sdk-mcp': patch
'@plitzi/plitzi-sdk': patch
---

- **A server element inside a layout is resolved.** `collectServerElements` walked the page alone, so a
  `runtime: 'server'` provider in a layout — a dashboard's sidebar, a section's header — was never resolved: the RSC
  payload came back empty and the element rendered with nothing. It now walks the page and every shell in its layout
  chain.
- **The twig `date` filter reads an epoch.** `new Date("1790143200000")` is Invalid Date, so an epoch in milliseconds
  handed over as text — how an attribute passes one — formatted as nothing. A number, or a string of digits, is now
  read as milliseconds.
- **An action is called by its name, not by its trigger kind.** `actionName` took the first trigger's title, and a
  trigger nobody named is titled with its kind — so every rendered action in a workspace read "render" and every clock
  "schedule". A title that only repeats the kind is no longer a name, and `defineAction` titles each trigger with the
  action's name.
- **`variant` on an element that wears a class is that class's variant** when the class declares it and the type does
  not. Keyed by the type, `text({ class: avatar, variant: 'violet' })` named `text--violet`, a selector nothing wears,
  and rendered with no variant at all. Exporting a document back to authoring reads the same key back into `variant`.
- **`variantFrom` takes `{ slot, template }`**, where `template` turns a value into a variant name for data that does
  not already speak in them — `"{{ source == 'code' ? 'on' : '' }}"`. The third argument was the slot name alone.
- **Entry declarations no longer alternate with `export {}`.** In `@plitzi/sdk-server` and `@plitzi/sdk-mcp` a repeated
  `build:dev` left some `dist/<entry>.d.ts` as a ten-byte `export {}`, and consumers saw "has no exported member". The
  cause was `insertTypesEntry` writing a types entry over the real declaration of the same path; it is gone.
- **Signing in keeps what a guest was doing.** `runtimeStatePersist` reset `runtime.state` whenever its owner changed,
  and a guest becoming a user is a change — so a sign-in screen that remembered where to send somebody (`?redirect=`)
  forgot it the moment the session arrived, and the sign-in ended on the fallback page instead. Only a change FROM an
  account resets now: one account's state still never reaches the next, and a guest has no account to protect.
