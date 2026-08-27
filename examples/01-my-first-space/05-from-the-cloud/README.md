# 05 — A space from the cloud

Everything before this served a space that lived in a file. This one serves a space that lives in Plitzi, from a
server that is not Plitzi's.

```bash
PLITZI_WEB_KEY=<the space key> yarn start
```

The key comes from **Credentials** in the builder; it names the space, so no space id appears in the config and
none can be reached by guessing a number.

## What this is for

Self-hosting used to be all-or-nothing: export the space to JSON and serve that (it goes stale the moment somebody
edits it), or stand up a database and own the whole authoring side. `createCloudAdapters` is the third option —
the space is authored, published and versioned in the builder as usual, and every request is served by **your**
server, on your domain, with your auth, your server actions and your logs.

## The version being served

| Config | Serves |
|---|---|
| `environment: 'main'` | the live document the builder is editing — an edit is visible after `cacheSeconds` |
| `environment: 'production', revision: 12` | that published revision, which cannot change under the deployment |

`cacheSeconds` (default 60) is how long a fetched space is reused. It caches the in-flight request, not just the
answer, so a hundred renders that start before the first fetch returns make one request rather than a hundred. A
failed fetch is never cached: one bad round trip costs one retry, not a minute of blank pages.

## What it does not do

It reads the space and nothing else. Who is looking at the page is `createAuth`'s, what a flow may run is
`action`'s, and a deployment composes them with a spread exactly as the other examples do — swapping where the
space comes from disturbs none of it.
