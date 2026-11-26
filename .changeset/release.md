---
'@plitzi/cli': patch
---

A tab back after its token's life is renewed, not answered "Authentication required".

## A refused credential renews the session

- **The builder** said every refusal of its GraphQL server as a toast: a tab left in the background past its token's
  life asked everything again at once with the old token, and each query answered "Authentication required" over a
  session one renewal fixed. The server's 401 carries its errors rather than a transport failure, so it was never said
  to auth either. Every request of the builder now says a refused credential to auth and, renewed because of it, is
  asked again once with the new one. Its client reads the credential as each request leaves, so a renewal no longer
  makes the client again — which dropped its cache and its subscriptions.
- **The `webHook` step** says a 401 to auth too, and asks the request again, once, when the session renewed because
  of it and its credential is the session's cookie. One that carries its own token (`authorizationToken`) is answered
  as it was.
