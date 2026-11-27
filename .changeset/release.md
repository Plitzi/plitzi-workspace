---
'@plitzi/cli': patch
---

The builder's production build keeps its warnings and errors.

## What tells somebody something is wrong stays in the build

- **The builder** was built with every `console` call dropped, so its warnings never reached a browser: 0.39.18's
  checks on the auth failure channel — a refusal nobody heard, a renewal that never reached the builder — were cut out
  of the build that runs. The builder and both vendor bundles now drop `log`, `info` and `debug` alone, as the SDK
  already did; `warn` and `error` stay. The builder grows about 10 KB.
