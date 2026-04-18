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
  SSRHeaders,
  PluginSource,
  PluginSourceFile,
  PluginSourceComponent,
  PluginAction,
  PluginEntry,
  CacheFilter,
  CacheManager,
  SSRUser
} from './types';
