---
'@plitzi/cli': patch
---

The builder's sockets come back after a renewal, and a renewal is asked for once.

## A refusal names the credential it refused

- **`reportAuthFailure` takes the refused `credential`**, and the auth provider answers a refusal of a token it has
  already replaced with the renewal that replaced it, never another. A tab back after a day asked everything at once
  with its old token: the first refusal renewed, and each later one renewed again, rotating the token the retries had
  just been handed — refused in turn, "Authentication required" again, and sometimes a trip through the sign-in page.

## The builder's sockets across a renewal

- **Presence** (`realtime-ws`): the server closes a socket whose session it refuses with `SESSION_REFUSED` (4004, the
  refusal's reason with it) instead of `NOT_AUTHORISED`; the builder renews and opens it again with the renewed
  credential, read as it opens. A renewed token no longer closes the socket that was open, nor leaves it closed.
- **Subscriptions** (`graphql-ws`): the server closes a connection whose session it refuses as `Forbidden` (4403),
  which the client answers by connecting again and asking again for every subscription it held; the builder renews
  first and connects as soon as the renewed credential reaches it. Before, each subscription was answered "Token
  expired" and ended, and live edits from others stopped until the page was loaded again.

## Presence toasts

- **"X joined" / "X left" only when someone did**: every builder that reconnected — a deploy, a server restart, a laptop
  waking — announced itself again, and was "joined" for people it never left (yourself in another tab, as "admin
  joined"). A builder instance already known is never new, and one that leaves is said to have left only if it is not
  back within ten seconds.

Upgrading: a deployment that serves the builder's sockets closes a socket whose session it refuses with these codes —
`RTEventCloseCode.SESSION_REFUSED` for presence, graphql-ws `CloseCode.Forbidden` for subscriptions — or the builder
keeps today's behaviour: the socket stays closed until the page is loaded again.
