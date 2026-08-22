# @plitzi/example-space

The sample space the examples render: one page with a handful of elements, plus three RSC elements
(`rsc-server`, `rsc-client`, `rsc-shared`) that [`03-ssr-rsc`](../03-ssr-rsc) feeds from the server.

It is declared in [`space.ts`](./space.ts) as a `SpaceSpec` — a tree, some CSS and a palette — and
`offline-data.json` is written from it by `yarn author`. The JSON is checked in because two ways of reading it
cannot run TypeScript: the no-build example, and the adapters that take a path and read the file themselves.
Everything else builds on the declaration:

```ts
import { sampleSpace } from '@plitzi/example-space/space';

// An example's own page, on the sample space's palette.
authorSpace({ ...sampleSpace, name: 'My example', pages: [myPage] });
```

```js
// The same space as documents, for anything that just wants to render it.
import { offlineDataPath, readOfflineData } from '@plitzi/example-space';
```

Examples that WRITE to the space (the MCP ones) copy it to a temp file first, so a session never dirties this
fixture.
