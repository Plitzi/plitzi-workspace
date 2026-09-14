---
'@plitzi/sdk-server': minor
'@plitzi/sdk-shared': minor
'@plitzi/plitzi-sdk': minor
'@plitzi/sdk-authoring': patch
---

A flow can ask what time it is where it matters, and send the mail that confirms what it did.

- **`now` in every server action's scope.** The moment the run started, as an ISO string, and the same moment for
  every step — a check that asks the time and the write it guards cannot straddle midnight. A step may not take the
  name `now`, like the other keys the run publishes.
- **`| date(format, timeZone)`.** The twig `date` filter reads the parts in the zone it is given
  (`{{ now|date('Y-m-d H:i', 'Europe/Madrid') }}`), and in the zone the code runs in when it is given none, as
  before. A bare `YYYY-MM-DD` is midnight UTC, so a calendar date is read with `'UTC'`. New tokens: `w` (weekday,
  0 = Sunday), `N` (ISO weekday), `j` and `n` (day and month without padding), `G` (hour without padding) and `U`
  (Unix seconds). An unknown zone formats to `''`. A format that used one of those letters as a literal now gets the
  value instead.
- **`email.send`, over a transport the deployment supplies.** `createServer({ action: { email } })` takes an
  `ActionEmailAdapter` — one `send({ spaceId, to, subject, text, replyTo })` — and only then is the task offered.
  The task checks what is the same everywhere (exactly one recipient, a one-line subject, plain text, sane sizes);
  the adapter owns the sender, the domain and any sending cap, so no flow can choose who its mail comes from.
- **`Rule` and `RuleGroup` are exported from `@plitzi/sdk-authoring`.** A step's `when` is one, so a project that
  exports an action or a flow with a condition — and emits declarations for it — failed to build with "cannot be
  named".
- **`createTaskRegistry(tasks, { db, email })`.** The second argument is now an options object naming which of the
  shipped tasks that need a deployment's driver or transport to offer; it was a boolean for `db.query` alone.
