---
'@plitzi/sdk-server': patch
---

**A replica that is told to stop finishes the jobs it is running — and only those.** `server.close()` (and the job
worker's `stop()`) now waits for every running job to end however long past its lease that is, and keeps renewing
their claims while it waits. It used to stop renewing the moment the drain began and give up at the lease: a job longer
than its lease was taken over by another replica and run a second time while the first was still finishing it, and the
process exited in the middle of it. What is still waiting is not touched — it stays in the shared queue for the replica
that is staying or the one the deploy starts — and a job claimed in the instant the stop arrived is handed back with its
attempt refunded, never started. A run is bounded by its own timeout, which is the number an orchestrator's grace period
has to cover.
