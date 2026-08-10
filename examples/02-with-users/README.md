# My space with users

The space knows who is looking at it: someone signs in, stays signed in, and signs out.

| | Example | What it is | Port |
|---|---|---|---|
| 01 | [sessions](./01-sessions) | Sign in, renew, sign out — over an account store you provide | 4007 |

The store here is two rows in an array, on purpose. Whether your accounts live in Postgres, MySQL, Mongo or an
identity service, what the server needs from any of them is the same handful of functions — so the example shows
that shape rather than a database setup you would then have to undo.

Everything else is already decided: how a session travels, when it renews, what a `401` means, and how signing out
in one place ends it everywhere. That is the part nobody should be reimplementing.

## Next

Give the space data: [`03-with-data`](../03-with-data).
