---
'@plitzi/cli': patch
---

A server action's call whose answer was lost on the way back runs once, not twice.

## SDK

- A server action's call is sent with one key from its first try: a connection lost after a worker began the run — the
  request went out, the answer never came back — is kept for later under that same key, so the run it began answers
  for it (or refuses it while it still runs). Kept under a key of its own, it ran a second time. A key the call names
  is still its own.
