---
'@plitzi/cli': patch
---

What a space's code set aside goes back in the queue when the code changes.

## Server actions

- **`resumeAfterCodeChange(queue, spaceId)`**: a deployment calls it when a space's functions or actions are saved, and
  every job of that space set aside for what its code did — stopped at a limit its run reached, or failing every
  attempt — goes back in the queue to run as the code now is (`setAsideByItsCode` says which). A schedule waiting on one
  fires again with it, instead of waiting a day or for somebody to resume it by hand; one that meets the same limit is
  set aside again, one run rather than a fire a minute. What was set aside by hand, at the plan's allowance or for a
  larger worker stays where it is.
