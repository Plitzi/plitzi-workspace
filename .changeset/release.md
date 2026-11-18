---
'@plitzi/cli': patch
---

A dedicated MCP server says what it is told to, where it is told to.

## Server

- **The MCP server applies its `logLevel` and `logger`.** `createServer` of `@plitzi/sdk-mcp/server` never did: it kept
  the process's default — errors alone, on the console, in production — whatever it was given. Its log showed nothing
  as it started, and no refusal after. It now says what a page server and a worker say, at the level and to the sink
  of its config (`slowRunMs` too).

## Server actions

- **A queue is read as groups.** `JobQueue.listJobGroups(query)` answers the jobs `listJobs` would list, one
  `JobGroup` per space, work (`target.kind` and `target.name`) and status — its `latest` job (without the `state` a
  job of the functions saved), how many it holds (`count`) and the earliest and latest `dueAt` among them — the group
  of the most recently touched job first, paged by groups, with `total` counting them and `jobs` the jobs they hold. A screen that folded alike
  jobs within a page of `listJobs` said "25 like it" of a schedule with 995 set aside, and its pager counted the 995
  as 40 pages of the same row. A group is what `cancelWaiting` drops when narrowed to it.

## To do when you upgrade

- A job store of your own (`JobQueue`) needs `listJobGroups`. The stores of `@plitzi/sdk-actions` (memory, file,
  SQLite, Mongo, MySQL) have it.
