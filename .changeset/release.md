---
'@plitzi/cli': patch
---

A space's credentials stored under a key pair the deployment no longer holds are re-minted where they are read.

## Kernel

- `needsRotation` is true for a JWT that none of this deployment's keys checks — another `kid`, or the shared secret
  that came before the pair — as it was for an expired, pre-registered-claims or foreign-issuer one. After a deployment
  changed its key pair, every stored public credential read as `malformed` and was never re-minted: the space token
  endpoint (`createSpaceTokenApi().read`) now rotates it in place. A value that is not a JWT at all is still not
  re-minted.

## To do when you upgrade

- Nothing to change. A host that reads a space's public credential off its own store for its own use (a thumbnail, an
  analytics key, a publish) reads it through `createSpaceTokenApi().read` to get one that verifies.
