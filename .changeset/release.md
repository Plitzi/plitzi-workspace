---
'@plitzi/cli': patch
---

`@plitzi/sdk-server` and `@plitzi/sdk-shared` install what they use: no optional peers to add beside them.

## Packages

- `@plitzi/sdk-server` depends on `@plitzi/sdk-actions`, and `@plitzi/sdk-shared` on `@plitzi/nexus`: no longer optional
  peers to install beside them. A page server installs the actions engine and never loads it (an import test holds
  it); every `@plitzi/*` is published at one version, so a project with its own `@plitzi/sdk-actions` holds one copy.
