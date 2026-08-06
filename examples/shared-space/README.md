# @plitzi/example-space

The sample space the examples render: one page with a handful of elements, plus three RSC elements
(`rsc-server`, `rsc-client`, `rsc-shared`) that [`03-ssr-rsc`](../03-ssr-rsc) feeds from the server.

It lives here so every example shows its own wiring instead of a copy of the same 33 KB of JSON. Examples that
write to the space (the MCP ones) copy it to a temp file first, so a session never dirties this fixture.

```js
import { offlineDataPath, readOfflineData } from '@plitzi/example-space';
```
