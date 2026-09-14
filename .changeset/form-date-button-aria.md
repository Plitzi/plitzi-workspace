---
'@plitzi/sdk-elements': minor
'@plitzi/plitzi-sdk': minor
'@plitzi/sdk-authoring': minor
---

A booking form can ask for a date, and a toggle can say it is one.

- **`formControl` accepts `subType: 'date'`.** It renders the browser's own date picker and submits `YYYY-MM-DD`, so
  a flow or a server action reads one format whatever the visitor's locale. Until now a date was a free text field
  and every form that needed one parsed whatever somebody typed. Offered in the builder's Input Type list.
- **`button` accepts `ariaExpanded` and `ariaPressed`.** A button that opens a menu or an answer, or one that stays on
  like a filter, can tell assistive technology so — statically, or bound to the state it flips
  (`bind: { ariaExpanded: 'state.menuOpen' }`). Left out, neither attribute is rendered: an ordinary button does not
  claim to control anything.
