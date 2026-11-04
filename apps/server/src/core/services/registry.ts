import { actionStage } from './action';
import { functionRoutesStage } from './functionRoutes';
import { realtimeStage } from './realtime';
import { robotsTxtStage } from './robotsTxt';
import { rscStage } from './rsc';
import { sitemapXmlStage } from './sitemapXml';
import { spaceDocumentStage } from './spaceDocument';
import { notFoundStage, ssrStage } from './ssr';
import { styleSheetStage } from './styleSheet';
import { authRoutesStages } from '../http/stages/authRoutes';
import { crossSiteWritesStage } from '../http/stages/crossSiteWrites';
import { cspReportStage } from '../http/stages/cspReport';
import { defaultFaviconStage } from '../http/stages/defaultFavicon';
import { fontAssetsStage } from '../http/stages/fontAssets';
import { googleFontsStage } from '../http/stages/googleFonts';
import { healthStage } from '../http/stages/health';
import { imagesStage } from '../http/stages/images';
import { createMiddlewaresStage } from '../http/stages/middlewares';
import { pluginAssetsStage } from '../http/stages/pluginAssets';
import { configStaticStage, publicDirStage, sdkAssetsStage, wellKnownStage } from '../http/stages/static';

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
    publicDirStage,
    defaultFaviconStage,
    cspReportStage,
    wellKnownStage,
    pluginAssetsStage,
    fontAssetsStage,
    googleFontsStage,
    imagesStage,
    ...authRoutesStages,
    configStaticStage,
    sdkAssetsStage
  ];

  stages.push(...(extensions.preAuth ?? []));

  // Every stage from here on writes for whoever reaches it, cookie or none: a write another site caused stops here.
  stages.push(crossSiteWritesStage);

  stages.push(createMiddlewaresStage());

  if (services.rsc) {
    stages.push(rscStage);
  }

  // Sits with the data services and after the auth middleware chain: a write may depend on who the visitor is.
  stages.push(actionStage);
  stages.push(realtimeStage);

  stages.push(...(extensions.data ?? []));

  // After the deployment's own data stages, so a route of its own under `/api/` is its own; before the pages, which
  // never own `/api` (its slug is refused).
  stages.push(functionRoutesStage);

  if (services.ssr) {
    stages.push(spaceDocumentStage);
    stages.push(styleSheetStage);
    stages.push(robotsTxtStage);
    stages.push(sitemapXmlStage);
  }

  stages.push(services.ssr ? ssrStage : notFoundStage);

  return stages;
};
