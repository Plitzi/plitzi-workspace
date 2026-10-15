# Space activity

What happened on a space after a point in time — its draft changed, a version went out, a server action failed — read
in order and **waited for** when nothing has happened yet. It is how an agent follows a space it works on with other
people, instead of reading the whole space again to find out whether anything moved.

| Reader | Asks with |
| --- | --- |
| An agent over MCP | `plitzi_activity { after, wait, limit, mine }` |
| An agent or a person with the CLI | `plitzi space activity [--follow] [--after <cursor>] [--mine] [--json]` |
| Any client, as the person | `GET /spaces/:spaceId/activity?after=&wait=&limit=&mine=` (Plitzi's API, `spaceView`) |

Every command and option is in [`apps/cli/README.md`](../../apps/cli/README.md); the tool's JSON shape in the MCP
guide. This page is why it is built the way it is.

## The vocabulary: one, shared

`@plitzi/sdk-shared/activity` owns it: `SpaceActivity` is a `change`, a `publish` or an `action`; a read answers a
`SpaceActivityPage` — `{ activity, cursor, more, waitedMs, skippedMine }`, oldest first. `activityLine` says one in a
line, in the words the builder's history and activity use, and `isSpaceActivityPage` is what a client checks an answer
against before reading it. The limits are its constants too: a wait of 45 s by default and 50 at most, 20 a page and
100 at most, 20 ids of what a change touched.

## Read off the records the platform keeps — never a second log

Each kind is a record the platform already writes, for its own reasons:

| Kind | Read off | Position |
| --- | --- | --- |
| `change` | the draft's [change history](./history.md) (`space_changes`) | its `seq` |
| `publish` | the space's log, the `space-change` lines a version, its flags or a deployment write | the row's `id` |
| `action` | the action runs that need attention — a run that did not complete, a refusal | when it was recorded, and its id |

A feed written beside them would be a second copy that could disagree with the first, written on every save. So the
cursor is one position **per record**, opaque to the reader (base64 JSON, refused unless this server gave it out), and
a page merges the three in time order without ever reading a record out of its own order: a cursor moved past an entry
never skips one before it. A record that holds more than a page is not read past its last entry read, and the page says
`more`.

The log counts in seconds and the others in milliseconds, so a change and a publish of the same second may come in
either order. Nothing else depends on their order.

## Waiting

With nothing after the cursor, a read waits — up to `wait` seconds — and answers the moment something is there:

- **An edit wakes it at once.** The builder's and the MCP's saves are announced on the space's pub/sub channel (the one
  open builders live-update from); the wait listens there, and reads again a moment after the announcement, when the
  change is surely written.
- **The rest within three seconds.** A version going out and an action failing announce nothing on that channel, so a
  wait reads again every three seconds. Without Redis it still answers, only on that clock.
- **The client going ends it.** The REST route ends the wait when its response closes; the MCP passes the call's abort
  signal to the adapter.

50 seconds at most, because most clients and gateways cut a request at 60, and the MCP answers in JSON — it cannot
send progress to keep a longer call alive. A follower (`--follow`) asks again as soon as it is answered.

## Whose writes are left out

A reader is a person and the channel they write through: the MCP's writes are recorded as `mcp`, the CLI's pushes as
`api`. Their own writes through that channel are left out — they did them — and counted (`skippedMine`), so leaving
them out is never silent; `mine` keeps them. The same person's edits in the builder are not left out: an agent acting for
somebody who is editing at the same time is exactly who needs to hear of them. The cursor moves past what was left out,
and a wait is not woken by it.

## Who may read it

Who edits a space and which of its actions fail is its members' to know. Over the API it is `spaceView` on a space the
caller belongs to. Over MCP it takes an `agent` grant — a member's consent: a site's `render` token is in every
published page, and a `host` key is a server rendering the space, so both are refused (`MEMBER_GRANT_REQUIRED`).

## Where it lives

The vocabulary and the `getActivity` adapter are `@plitzi/sdk-shared`'s; the tool, `@plitzi/sdk-mcp`'s; the command,
`@plitzi/cli`'s. Reading the records and waiting is the deployment's, since the records are: Plitzi's is
`plitzi-sdk-server`'s `services/activity`, which both its REST route and its MCP adapter call. A deployment without
it has no `plitzi_activity` (the tool says so).
