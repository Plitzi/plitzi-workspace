---
'@plitzi/sdk-shared': minor
'@plitzi/sdk-authoring': minor
'@plitzi/sdk-elements': minor
---

`authorSpace` returns test handles, and every element carries its id in the DOM.

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
