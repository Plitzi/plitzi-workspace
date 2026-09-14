---
'@plitzi/sdk-elements': minor
'@plitzi/plitzi-sdk': minor
'@plitzi/sdk-authoring': minor
---

A form speaks the site's language when it refuses a value.

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
