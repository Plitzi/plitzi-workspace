# Whole things

The examples before this one each show a single decision and stop. These are the other kind: a small product,
built out of those decisions, so you can see how they fit and how much of it you end up writing.

| | Example | What it is | Port |
|---|---|---|---|
| 01 | [blog](./01-blog) | Posts, a home page, a post page, sessions, and who may publish | 4013 |

A full example is allowed to be opinionated where the others are not — it picks a route shape, a permission name,
a place to keep its data — because a product has to. What it may not do is hide a step: everything it configures
is configured the way the single-decision examples show it.

## Next

Nothing after this. The mechanisms are documented in [`@plitzi/sdk-server`](../../apps/server/README.md) and in
[`docs/en/`](../../docs/en/README.md).
