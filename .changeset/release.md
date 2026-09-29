---
'@plitzi/sdk-auth': patch
'@plitzi/sdk-authoring': patch
'@plitzi/sdk-dev-tools': patch
'@plitzi/sdk-elements': patch
'@plitzi/sdk-event-bridge': patch
'@plitzi/sdk-interactions': patch
'@plitzi/sdk-navigation': patch
'@plitzi/sdk-plugins': patch
'@plitzi/sdk-schema': patch
'@plitzi/sdk-shared': patch
'@plitzi/sdk-style': patch
'@plitzi/sdk-variables': patch
'@plitzi/plitzi-builder': patch
'@plitzi/cli': patch
'@plitzi/sdk-mcp': patch
'@plitzi/plitzi-sdk': patch
'@plitzi/sdk-server': patch
---

## `@plitzi/sdk-shared`'s GraphQL documents are text

- **Every document is a plain string marked `/* GraphQL */`**, the builder's as the SDK's already were, and the client
  parses what it sends — the builder with Apollo's `gql`. A server importing the package no longer loads a GraphQL
  parser or parses 115 documents at boot; `graphql` and `graphql-tag` are no longer dependencies.
- `BuilderQueries` and `BuilderMutations` are typed `Record<keyof …Map, string>`, and every operation is named as its
  file is: `SpacePublish`, `SpaceDeploy`, `SpaceFixIssues`, `SpaceUpdate`, `SpaceUpdateSchema`, `SpaceUpdateElement(s)`,
  `SpaceRemoveElement`, `StyleUpdate` and `SegmentPublish` gain their `Mutation` suffix, and the space's subscription,
  anonymous until now, is `SpaceEventSubscription`.
- **Breaking:** `BuilderQueries`, `BuilderMutations` and `SpaceEventSubscription` are strings, not `DocumentNode`s —
  pass them through `gql` for Apollo.
