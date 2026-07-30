import { mcpOnlyStage, mcpStage } from './mcp';
import { oauthGuardStage, oauthStage } from './oauth';
import { previewStage } from './preview';
import { rscStage } from './rsc';
import { notFoundStage, ssrStage } from './ssr';
import { authRoutesStages } from '../http/stages/authRoutes';
import { healthStage } from '../http/stages/health';
import { middlewaresStage } from '../http/stages/middlewares';
import { pluginAssetsStage } from '../http/stages/pluginAssets';
import { builtinPublicStage, configStaticStage, publicDirStage, wellKnownStage } from '../http/stages/static';

import type { ResolvedServices } from './resolve';
import type { BaseContext, SSRContext, Stage } from '../http/types';

// The page-serving pipeline. This is the single place that decides which stages a page server runs, so no
// stage — and not the dispatcher — branches on which services are enabled. Order matters: static assets first,
// then MCP (self-authenticating) before the auth middleware chain, then the data services. `services.mcp` is
// only ever set here by createServer: createSSRServer pins it off, and a dedicated MCP server runs the pipeline
// below instead.
export const buildPagePipeline = (services: ResolvedServices): Stage<SSRContext>[] => {
  const stages: Stage<SSRContext>[] = [
    healthStage,
    builtinPublicStage,
    publicDirStage,
    wellKnownStage,
    pluginAssetsStage,
    ...authRoutesStages,
    configStaticStage
  ];

  if (services.mcp) {
    stages.push(mcpStage);
  }

  // Draft-preview endpoint (self-gated on config.preview.enabled); secret-guarded, so it sits before the auth
  // middleware chain like the MCP stage.
  stages.push(previewStage);

  stages.push(middlewaresStage);

  if (services.rsc) {
    stages.push(rscStage);
  }

  stages.push(services.ssr ? ssrStage : notFoundStage);

  return stages;
};

// The lean MCP-only pipeline: an optional health endpoint (k8s probes), then any static mounts the consumer
// configured, then MCP for every other request — the server owns its whole sub-domain, so MCP is served at the
// root, not under /mcp. configStaticStage falls through (returns false) when no mount matches, so non-asset
// requests still reach MCP. oauthStage claims the discovery and grant endpoints before that catch-all, and
// oauthGuardStage challenges the JSON-RPC calls that reach it without a bearer; both are inert unless the
// deployment configured `oauth`. Static mounts stay ahead of the guard — a host fetches those assets for the
// render App with no credential to send.
export const buildMCPPipeline = (): Stage<BaseContext>[] => [
  healthStage,
  configStaticStage,
  oauthStage,
  oauthGuardStage,
  mcpOnlyStage
];
