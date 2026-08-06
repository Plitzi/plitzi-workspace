import { actionStage } from './action';
import { rscStage } from './rsc';
import { notFoundStage, ssrStage } from './ssr';
import { authRoutesStages } from '../http/stages/authRoutes';
import { healthStage } from '../http/stages/health';
import { middlewaresStage } from '../http/stages/middlewares';
import { pluginAssetsStage } from '../http/stages/pluginAssets';
import { builtinPublicStage, configStaticStage, publicDirStage, wellKnownStage } from '../http/stages/static';

import type { ResolvedServices } from './resolve';
import type { PipelineExtensions, SSRContext, Stage } from '../http/types';

// The page-serving pipeline. This is the single place that decides which stages a page server runs, so no
// stage — and not the dispatcher — branches on which services are enabled. Order matters: static assets first,
// then the self-gating extensions before the auth middleware chain, then the data services.
export const buildPagePipeline = (
  services: ResolvedServices,
  extensions: PipelineExtensions = {}
): Stage<SSRContext>[] => {
  const stages: Stage<SSRContext>[] = [
    healthStage,
    builtinPublicStage,
    publicDirStage,
    wellKnownStage,
    pluginAssetsStage,
    ...authRoutesStages,
    configStaticStage
  ];

  stages.push(...(extensions.preAuth ?? []));

  stages.push(middlewaresStage);

  if (services.rsc) {
    stages.push(rscStage);
  }

  // Sits with the data services and after the auth middleware chain: a write may depend on who the visitor is.
  stages.push(actionStage);

  stages.push(...(extensions.data ?? []));

  stages.push(services.ssr ? ssrStage : notFoundStage);

  return stages;
};
