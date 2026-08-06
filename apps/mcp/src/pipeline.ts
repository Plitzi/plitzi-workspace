import { configStaticStage, healthStage } from '@plitzi/sdk-server/kernel';

import { mcpOnlyStage, mcpStage } from './stages/mcp';
import { oauthGuardStage, oauthStage } from './stages/oauth';
import { previewStage } from './stages/preview';
import { widgetProxyStage } from './stages/proxy';

import type { BaseContext, PipelineExtensions, Stage } from '@plitzi/sdk-server/kernel';

// The lean MCP-only pipeline: an optional health endpoint (k8s probes), then any static mounts the consumer
// configured, then MCP for every other request — the server owns its whole sub-domain, so MCP is served at the
// root, not under /mcp. configStaticStage falls through (returns false) when no mount matches, so non-asset
// requests still reach MCP. oauthStage claims the discovery and grant endpoints before that catch-all, and
// oauthGuardStage challenges the JSON-RPC calls that reach it without a bearer; both are inert unless the
// deployment configured `oauth`. Static mounts and the widget resource endpoint stay ahead of the guard — a host
// fetches those for the render App with no credential to send.
export const buildMCPPipeline = (): Stage<BaseContext>[] => [
  healthStage,
  configStaticStage,
  widgetProxyStage,
  oauthStage,
  oauthGuardStage,
  mcpOnlyStage
];

/** What this package contributes to somebody else's PAGE server: the MCP endpoint alongside SSR on one port.
 *  Every stage here gates itself — MCP is self-authenticating, the widget proxy must stay reachable without a
 *  credential, and draft-preview is off unless `config.preview.enabled` and guarded by a shared secret — so they
 *  all belong in the `preAuth` slot, ahead of the auth middleware chain.
 *
 *  A page server that never calls this loads none of it: that is the whole point of handing it over as stages
 *  instead of a config flag. */
export const mcpExtensions = (): PipelineExtensions => ({
  preAuth: [widgetProxyStage, mcpStage, previewStage]
});
