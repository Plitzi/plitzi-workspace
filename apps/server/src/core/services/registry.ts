import { mcpOnlyStage, mcpStage } from './mcp';
import { previewStage } from './preview';
import { rscStage } from './rsc';
import { notFoundStage, ssrStage } from './ssr';
import { authRoutesStages } from '../http/stages/authRoutes';
import { healthStage } from '../http/stages/health';
import { middlewaresStage } from '../http/stages/middlewares';
import { pluginAssetsStage } from '../http/stages/pluginAssets';
import { builtinPublicStage, configStaticStage, publicDirStage, wellKnownStage } from '../http/stages/static';

import type { ResolvedServices } from './resolve';
import type { BaseContext, PipelineStage, SSRContext } from '../http/types';

// The full page-serving pipeline. This is the single place that decides which stages a page server runs, so no
// stage — and not the dispatcher — branches on which services are enabled. Order matters: static assets first,
// then MCP (self-authenticating) before the auth middleware chain, then the data services. Each entry names the
// SERVICE it belongs to (the category the dispatcher tags its request log with).
export const buildSSRPipeline = (services: ResolvedServices): PipelineStage<SSRContext>[] => {
  const stages: PipelineStage<SSRContext>[] = [
    { service: 'health', stage: healthStage },
    { service: 'static', stage: builtinPublicStage },
    { service: 'static', stage: publicDirStage },
    { service: 'static', stage: wellKnownStage },
    { service: 'plugin-assets', stage: pluginAssetsStage },
    ...authRoutesStages.map(stage => ({ service: 'auth', stage })),
    { service: 'static', stage: configStaticStage }
  ];

  if (services.mcp) {
    stages.push({ service: 'mcp', stage: mcpStage });
  }

  // Draft-preview endpoint (self-gated on config.preview.enabled); secret-guarded, so it sits before the auth
  // middleware chain like the MCP stage.
  stages.push({ service: 'preview', stage: previewStage });

  stages.push({ service: 'middlewares', stage: middlewaresStage });

  if (services.rsc) {
    stages.push({ service: 'rsc', stage: rscStage });
  }

  stages.push(services.ssr ? { service: 'ssr', stage: ssrStage } : { service: 'not-found', stage: notFoundStage });

  return stages;
};

// The lean MCP-only pipeline: an optional health endpoint (k8s probes) then MCP for every other request — the
// server owns its whole sub-domain, so MCP is served at the root, not under /mcp. No static, auth-routes,
// middlewares or render stages: a dedicated MCP server carries none of that.
export const buildMCPPipeline = (): PipelineStage<BaseContext>[] => [
  { service: 'health', stage: healthStage },
  { service: 'mcp', stage: mcpOnlyStage }
];
