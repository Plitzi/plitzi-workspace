# 05 — A space from the cloud

Everything before this served a space that lived in a file. This one serves a space that lives in Plitzi, from a
server that is not Plitzi's.

```bash
PLITZI_WEB_KEY=<the space key> yarn start
```

The key comes from **Credentials** in the builder; it names the space, so no space id appears in the config and
none can be reached by guessing a number.

> **Pointing at a local Plitzi** (`PLITZI_SERVER_URL=https://server.plitzi.local`): the dev stack serves TLS with a
> mkcert certificate, which browsers trust but Node's `fetch` does not. The `start` scripts already set
> `NODE_OPTIONS=--use-system-ca` so Node reads the system trust store — plain `yarn start` works. That flag needs
> Node 22+; on Node 20/21 set `NODE_EXTRA_CA_CERTS=$(mkcert -CAROOT)/rootCA.pem` instead.

## What this is for

Self-hosting used to be all-or-nothing: export the space to JSON and serve that (it goes stale the moment somebody
edits it), or stand up a database and own the whole authoring side. `createCloudAdapters` is the third option —
the space is authored, published and versioned in the builder as usual, and every request is served by **your**
server, on your domain, with your auth, your server actions and your logs.

## The version being served

```bash
PLITZI_WEB_KEY=<key> yarn start                              # the live document
PLITZI_ENVIRONMENT=production PLITZI_WEB_KEY=<key> yarn start # latest published, releases itself
PLITZI_ENVIRONMENT=production PLITZI_REVISION=12 …            # exactly revision 12
```

| Config | Serves | Asks Plitzi |
|---|---|---|
| `environment: 'main'` | the document the builder is editing | **every request** — no cache |
| `environment: 'production'` | the **latest** published revision | a revision NUMBER every `cacheSeconds`; the space only when that number moves |
| `environment: 'production', revision: 12` | exactly that revision | **once**, ever |

The three are deliberate, not three settings for one thing.

`main` does not cache because a cached answer there is a wrong one: the point of pointing at `main` is to see the
edit. (Concurrent requests still share one in-flight fetch — that is not caching, it is not asking the same
question twice at once.)

A **pinned** revision never expires. A published revision cannot change, so expiring it on a timer would be paying
for a question whose answer is already known.

**Latest** is the one `cacheSeconds` (default 60) applies to, and what it paces is the cheap "which revision is
current" probe — not the space. A deployment that publishes once a week asks for a number every minute and for a
space once. Publishing from the builder is then all it takes to release, and the release lands within one window
rather than whenever a blanket TTL happened to fall.

None of it sits in front of a visitor: the copy already held is served while the probe runs behind it. And a probe
or fetch that fails changes nothing — the last good copy keeps serving, because a self-hosted site going blank
over somebody else's bad minute is not a trade worth making.

## Sharing the cache across replicas

`cache: { get, set }` takes strings and obeys no rules of its own — Redis, a table, a directory. With one, a whole
cluster costs a single fetch per version instead of one per replica, and it survives a restart.

## What it does not do

It reads the space and nothing else. Who is looking at the page is `createAuth`'s, what a flow may run is
`action`'s, and a deployment composes them with a spread exactly as the other examples do — swapping where the
space comes from disturbs none of it.
