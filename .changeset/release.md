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

## Server code on a private CDN

- **A CDN has a visibility**: `public` (the default — its files served at its domain: plugins, images, templates) or
  `private` (no domain, read only by the platform with its credential). The builder's CDN form asks for it, and every
  CDN now has **Settings** in Resources to change its configuration — until now a CDN could not be edited at all.
- **A space's server code is kept on its private CDN**, not in the platform's database: its functions' source and
  bundle, and its runtime's packed code, named by what they hold. Saving functions or pushing a runtime to a space with
  no private CDN is refused with how to add one (`FunctionsRefusal.limit: 'storage'`). Resources lists them under
  **Server code** with the versions that run each (`Resource.usedBy`, `ResourceType` `server`); one in use cannot be
  removed. A private CDN cannot take a page's file, and `plitzi upload plugin` offers only public CDNs.
- **A space made from a template** gets the template's functions as an offer (`FunctionsDraft.offer`): the Functions
  panel installs them (`SpaceInstallTemplateFunctions`) once the space has a private CDN.
- Types: `Cdn.visibility`, `CdnVisibility`; `SpaceAddCdn` / `SpaceUpdateCdn` take `visibility` and a nullable `domain`.
