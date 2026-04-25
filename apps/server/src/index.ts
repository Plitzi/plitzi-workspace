export { createSSRServer } from './core/createServer';
export { createJsonAdapters } from './adapters/jsonAdapters';

export type { JsonAdaptersConfig } from './adapters/jsonAdapters';

export type {
  SSRAdapters,
  SSRServerConfig,
  SSRRequest,
  SSRResponseHelpers,
  SSRMiddleware,
  SSRMiddlewareNext,
  SSRContext,
  SSRSpaceDeployment,
  SSRTemplateProps,
  SSRTemplateFn,
  SSRCredential,
  SSRUser,
  SSRHeaders,
  SSRRscData,
  SSRRscConfig,
  SSRServer,
  PluginSource,
  PluginSourceFile,
  PluginSourceComponent,
  PluginAction,
  PluginEntry,
  PluginRegistry,
  CacheFilter,
  CacheManager
} from '@plitzi/sdk-shared';
