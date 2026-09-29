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

## CDNs with several buckets

A CDN is the customer's own storage account — S3 or R2, which they run and pay for — and now holds any number of
buckets, each with its own configuration: its name at the provider, its region, `public` (served at its domain) or
`private` (no domain, read only by the platform with the CDN's credential).

- `Cdn` carries `buckets: CdnBucket[]`; `domain`, `visibility`, `bucketName` and `region` moved from the CDN to its
  buckets. `Resource.bucketIdentifier` names the bucket a file is in.
- `SpaceAddCdn(name, provider, endpoint, buckets)` creates the account with its buckets; `SpaceUpdateCdn` changes the
  account only. New `SpaceAddCdnBucket`, `SpaceUpdateCdnBucket` and `SpaceRemoveCdnBucket`.
- `SpaceResources`, `SpaceAddResource`, `SpaceRemoveResource` and `SpaceMoveResource` take `bucketIdentifier`.
- Server code — functions and runtime — goes in the space's oldest private bucket. A bucket that keeps code a version
  runs can be neither made public, pointed at another bucket nor removed, and neither can its CDN.
- Builder: Resources shows each CDN with its buckets — add, edit and remove buckets, upload and browse per bucket; the
  account (name, provider, endpoint, credential) is edited apart. Saving an element as a template picks a public
  bucket (`elementAsTemplate({ cdnIdentifier, bucketIdentifier }, …)`).
- CLI: `plitzi upload plugin --bucket <identifier>` (with `--cdn` to narrow); only public buckets are offered, a private
  one is refused.
