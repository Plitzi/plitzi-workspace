---
'@plitzi/sdk-shared': patch
'@plitzi/sdk-interactions': patch
'@plitzi/sdk-authoring': patch
'@plitzi/cli': patch
'@plitzi/plitzi-sdk': patch
'@plitzi/sdk-server': patch
---

- **A step's params are templates in full.** Only a bare name (`{{ post.slug }}`) used to be recognised, so a
  condition or a loop in a `setState` or a webhook body was handed on as its own text — a flag set to
  `{% if … %}1{% endif %}` stored the template, a non-empty string every later check read as true. Any `{{ }}` or
  `{% %}` in a param is now evaluated; what it resolves to is data and is not evaluated again.
- **Twig tests work.** `x is defined`, `is empty`, `is null`, `is iterable`, `is even`, `is odd` (and `is not …`) used
  to be read as comparisons with a variable of that name — `x is defined` answered true exactly when `x` was not
  defined. Anything else on the right of `is` still compares.
- **A group takes an access chain.** `(rows|find('id', 3)).title` read the whole row; the key after the parenthesis
  was never parsed.
- **An expression that chose to be empty renders empty** under `keepEmptyTokens`. A kept token is for a name still
  waiting for a value; `{{ on ? 'active' : '' }}` said "nothing" on purpose, and handing back its text made the
  empty branch a non-empty string.
- **Checkbox params written as text are booleans.** `dateConverter({ isUnix: 'false' })` read `'false'` as yes and
  gave an ISO date back raw. Every utility's checkbox params are normalised before its callback runs.
- **`condition-starts-visible`** warns about a visibility computed from data on an element that starts on screen: it
  is drawn until its provider answers and then hidden — an empty state or a "get started" card flashing past on
  every load. `visible: false` makes it wait hidden. The export reads a visibility binding back in its place, so a
  space whose condition is not its last binding round-trips unchanged.
- **A source named by its short id inside a binding's template is refused** with the full name, as it already was in
  a flow: `{{ stats.total }}` resolved to nothing and the element showed its empty branch.
- **`activeOn(class, pageIds)`** marks a menu's current entry from `navigation.currentPageId` — one binding for a menu
  kept in a layout. `variantFrom` now says `append: 'true'`, which is what it did.
- **Two elements with one id** name where the first one was written. **`template-never-resolved`** warns about a
  condition left in an attribute, which only resolves `{{ name|filter }}` tokens.
- **The authoring skill is a folder**: `SKILL.md` plus references for layouts, data and visibility, templates,
  flows, structure, testing and a review checklist. `plitzi create` copies all of it, and writes an `AGENTS.md`
  (imported by `CLAUDE.md`) pointing any agent at it.
