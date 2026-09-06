---
'@plitzi/sdk-authoring': minor
---

**Page folders, which are a routing decision and not a filing one.**

`authorSpace` wrote `pageFolders: []` on every document it produced, so a space authored in code could not put a
page under a path prefix at all — and a folder's slug is what turns `quickstart` into `/docs/quickstart`. The
builder's page tree was the visible half; the URL was the half that could not be expressed.

```ts
const space: SpaceSpec = {
  name: 'My Site',
  permanentUrl: 'my-site',
  pageFolders: [
    { id: 'docs', name: 'Docs', slug: 'docs' },
    { id: 'api', name: 'API', slug: 'reference', parent: 'docs' }
  ],
  pages: [
    { id: 'guide', name: 'Guide', slug: 'quickstart', folder: 'docs', body: [] },  // → /docs/quickstart
    { id: 'ref', name: 'Elements', slug: 'elements', folder: 'api', body: [] }     // → /docs/reference/elements
  ]
};
```

`name` and `slug` default to the id. `handles.page(id).path` is the route the page answers at, prefix included, so
a test navigates to what the router will actually serve rather than to the slug.

Refused where it is written, not discovered as a page answering at the wrong URL: a page naming a folder the space
does not declare (with the name you probably meant), a folder inside a folder that is not there, and a folder
declared inside itself.

A section's own landing page sits **beside** its folder rather than inside it. A folder contributes one path
segment and a page contributes another, so there is no way to spell "the folder itself" from within one — a page
with an empty slug inside `docs` falls back to its id and answers at `/docs/docs-index`. Give it the folder's slug
and no folder, and it answers at `/docs`.
