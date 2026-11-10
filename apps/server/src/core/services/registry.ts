import { crossSiteWritesStage } from '@plitzi/sdk-kernel/http';
import { healthStage } from '@plitzi/sdk-kernel/http';
import { createMiddlewaresStage } from '@plitzi/sdk-kernel/http';
import { configStaticStage, publicDirStage, wellKnownStage } from '@plitzi/sdk-kernel/http';
import { statsStage } from '@plitzi/sdk-kernel/stats';

import { robotsTxtStage } from './robotsTxt';
import { rscStage } from './rsc';
import { securityTxtStage } from './securityTxt';
import { sitemapXmlStage } from './sitemapXml';
import { spaceDocumentStage } from './spaceDocument';
import { notFoundStage, ssrStage } from './ssr';
import { styleSheetStage } from './styleSheet';
import { authRoutesStages } from '../http/stages/authRoutes';
import { cspReportStage } from '../http/stages/cspReport';
import { defaultFaviconStage } from '../http/stages/defaultFavicon';
import { fontAssetsStage } from '../http/stages/fontAssets';
import { googleFontsStage } from '../http/stages/googleFonts';
import { imagesStage } from '../http/stages/images';
import { pluginAssetsStage } from '../http/stages/pluginAssets';
import { sdkAssetsStage } from '../http/stages/sdkAssets';

import type { ResolvedServices } from './resolve';
import type { PipelineExtensions, SSRContext } from '../http/pageContext';
import type { PageEngine } from '@plitzi/sdk-kernel/engine';
import type { Stage } from '@plitzi/sdk-kernel/http';

// The page-serving pipeline. This is the single place that decides which stages a page server runs, so no
// stage — and not the dispatcher — branches on which services are enabled. Order matters: static assets first,
// then the self-gating extensions before the auth middleware chain, then the data services.
export const buildPagePipeline = (
  services: ResolvedServices,
  extensions: PipelineExtensions = {},
  engine?: PageEngine
): Stage<SSRContext>[] => {
  const stages: Stage<SSRContext>[] = [
    healthStage,
    statsStage,
    publicDirStage,
    defaultFaviconStage,
    cspReportStage,
    // Before the reservation of `/.well-known/` (which answers 404 for the rest of it): the one file of it a space says.
    ...(services.ssr ? [securityTxtStage] : []),
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

  // The engine's endpoints sit with the data services and after the auth middleware chain: a write may depend on who
  // the visitor is.
  stages.push(...(engine?.endpoints ?? []));

  stages.push(...(extensions.data ?? []));

  // After the deployment's own data stages, so a route of its own under `/api/` is its own; before the pages, which
  // never own `/api` (its slug is refused).
  stages.push(...(engine?.routes ?? []));

  if (services.ssr) {
    stages.push(spaceDocumentStage);
    stages.push(styleSheetStage);
    stages.push(robotsTxtStage);
    stages.push(sitemapXmlStage);
  }

  stages.push(services.ssr ? ssrStage : notFoundStage);

  return stages;
};
