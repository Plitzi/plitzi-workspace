---
'@plitzi/sdk-authoring': patch
'@plitzi/cli': patch
---

- **A new space starts on a page worth keeping.** The space `POST /spaces` and `plitzi create` both begin from is
  redesigned: a top bar with the theme switch, a hero with two calls to action, and six guides — each a card linking to
  its page of the docs (`https://plitzi.com/docs/…`). Every link used to be `#`, and one promised a course that does
  not exist. The palette is a set of light/dark tokens in Geist, the guides are one list mapped to one card, and the
  bands of the page share a `shell` class — the page is written the way the authoring skill asks a space to be.
- **The copy `plitzi create` writes passes its own project's lint.** An import of the package that would not fit
  120 columns is wrapped one name per line, as the project's formatter would wrap it.
