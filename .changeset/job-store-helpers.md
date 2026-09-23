---
'@plitzi/sdk-server': patch
'@plitzi/cli': patch
---

**Scheduled jobs across replicas, out of the box, on the database a deployment already runs.** The scheduler and the
workers were already the package's; where the jobs wait was left to each deployment to write — and a queue is the part
that is easiest to get subtly wrong. Two helpers now build the adapters over a store the deployment owns, without the
package opening a connection or keeping data of its own:

- `@plitzi/sdk-server/mongo` — `createMongoJobQueue({ db })` and `createMongoKv({ db })`, over a `Db` (or a getter for a
  client that reconnects). Creates the indexes its queries need; `mongodb` is an optional peer, used for its types.
- `@plitzi/sdk-server/mysql` — `createMysqlJobQueue({ pool })` and `createMysqlKv({ pool })`, over a `mysql2` pool.
  Each job is claimed by a single-row compare-and-set, so replicas claiming at once never deadlock. Creates its three
  tables on first use, or hands them to your own migrations through `mysqlJobSchemaStatements()`.

Every instant is the database server's, never a replica's. The in-process queue and both helpers pass one contract test
suite: exactly-once enqueue, atomic claims, leases that lapse and are reaped, heartbeats, settlements ignored from a
worker that lost its claim, refunded hand-backs, schedules advanced by compare-and-set, operator retry and cancel.

**`closeOnSignals(server, { afterClose })`** closes the server on SIGTERM/SIGINT and exits only once it has — so a
deploy finishes the jobs a replica is running and leaves the waiting ones for the next. A second signal exits at once.
Opt-in: a host with its own signal handling calls `server.close()` itself. Projects from `plitzi create` use it.
