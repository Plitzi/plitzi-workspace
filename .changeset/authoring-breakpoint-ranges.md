---
'@plitzi/sdk-authoring': minor
---

Authoring catches the tablet-only rule, declares fonts, and tells a test which pages and elements a visit can see.

- **`tablet-rule-skips-mobile` warning.** `tablet` compiles to 48–64rem and `mobile` to below 48rem, and each
  inherits only from `desktop`. So a rule written for tablet and not for mobile hands phones the desktop value back —
  a layout that collapsed at tablet came back as desktop columns on a phone, with every check passing. `authorSpace`
  now warns, naming the class or element and the properties. The skill and `ResponsiveCss` say the same, and the
  blank space every new space starts from — which had exactly this bug on its page and its cards — now carries
  mobile rules.
- **`fonts` on `SpaceSpec`.** The page server loads only the faces `style.fonts` lists, and a space authored in code
  had no way to list one, so a `font-family` silently rendered in its fallback. `fonts` goes through the same
  `parseSpaceFont` as any manifest, and a malformed face is refused by index and family. `SpaceFont` is exported.
- **Handles for a suite that only opens pages.** `PageHandle` gains `accessLevel` and `params` (the route params its
  slug declares), and `ElementHandle` gains `conditional` — true when the element, or anything above it, has a
  `visible` condition. `plitzi create`'s visual test uses them to skip what a bare visit cannot show.
