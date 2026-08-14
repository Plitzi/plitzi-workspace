# My space with users

The space knows who is looking at it: someone signs in, stays signed in, and signs out.

| | Example | What it is | Port |
|---|---|---|---|
| 01 | [sessions](./01-sessions) | Sign in, renew, sign out — over an account store you provide | 4007 |
| 02 | [mysql](./02-mysql) | The same, over a MySQL of your own — tables and adapters included | 4008 |

The two are the same pages and differ only in where the people come from, which is the choice actually in front of
you. **Already have a user table?** Implement the adapters against it — that is `01`, and the store there is two
rows in an array on purpose, because the shape is the same whether your accounts live in Postgres, MySQL, Mongo or
an identity service. **Standing one up?** `02` hands you the schema and every adapter already written, so it is a
connection string rather than sixteen functions and a migration.

Everything else is already decided: how a session travels, when it renews, what a `401` means, and how signing out
in one place ends it everywhere. That is the part nobody should be reimplementing.

## Next

Give the space data: [`03-with-data`](../03-with-data).
