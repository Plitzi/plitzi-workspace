export { createServer, resolveServices } from './core/createServer';
export { createCloudAdapters } from './adapters/cloudAdapters';
export { createJsonAdapters } from './adapters/jsonAdapters';
export { createAuthAdapters } from './adapters/authAdapters';
export {
  authoringPreview,
  createMemoryCache,
  createSpaceAdapters,
  fixedSpace,
  presentsCredential,
  refuse,
  renderGrant,
  verifiedDomain,
  wildcardSubdomain
} from './adapters/space';
// Draft-preview primitives: the default store (the token's carrier is the kernel's, `@plitzi/sdk-kernel/identity`). The
// endpoint that MINTS a draft lives in `@plitzi/sdk-mcp` — applying unsaved operations is the tool engine's job.
export { createLocalFontStore, hostedPathsOf } from './core/fontStore';
export { createMemoryDraftStore, takeDraftOverride } from './modules/ssr/preview';
export { createAuthoringHost } from './hosts/authoringHost';
// The pages several replicas keep in step: the bus an invalidation travels on is the realtime one (`createRedisPubSub`,
// `@plitzi/sdk-kernel/pubsub`);
// these are the store they share and what a process that serves no pages says an invalidation with.
export { createRedisPageStore } from './modules/ssr/redisPageStore';
export { createCacheInvalidator, DEFAULT_IGNORED_QUERY_PARAMS } from './helpers/cache';
export { resolveRscData } from './modules/rsc/resolveRscData';

export type { CloudAdaptersConfig, CloudSpaceCache } from './adapters/cloudAdapters';
export type { RedisPageStoreClient, RedisPageStoreOptions } from './modules/ssr/redisPageStore';
export type { CacheSharing } from './helpers/cache';
export type { JsonAdaptersConfig, OfflineDataSource } from './adapters/jsonAdapters';
export type { AuthAdapters, AuthAdaptersConfig } from './adapters/authAdapters';
export type {
  AuthoringPreviewOptions,
  DeploymentRow,
  FrameAncestorsConfig,
  RenderGrantOptions,
  SpaceAdapters,
  SpaceAdaptersConfig,
  SpaceCache,
  SpaceRefusal,
  SpaceResolution,
  SpaceResolver,
  WildcardSubdomainOptions
} from './adapters/space';
export type { ResolveRscDataOptions } from './modules/rsc/resolveRscData';
export type { FontStore, StoredFont } from './core/fontStore';
export type { PubSubAdapter, SSRRealtimeConfig } from '@plitzi/sdk-shared';
export type { ResolvedServices, ServerConfig } from './core/createServer';
export type { AuthoringHost, AuthoringHostConfig } from './hosts/authoringHost';
export type { PipelineExtensions, SSRContext } from './core/http/pageContext';
export type {
  CacheFilter,
  CacheManager,
  PluginRegistry,
  SSRCacheConfig,
  SSRFontsConfig,
  SSRImagesConfig,
  SSRPageServerConfig,
  SSRPlugin,
  SSRRenderLimitConfig,
  SSRRscConfig,
  SSRServer,
  SSRServerConfig,
  SSRSignInConfig,
  SSRTemplateFn,
  SSRVisitorCredentialsConfig,
  ServerServices,
  SharedPage,
  SharedPageFacts,
  SharedPageStore
} from './types';
