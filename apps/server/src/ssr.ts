/** The render primitives a stage needs to produce a page, for packages that extend the page pipeline.
 *
 *  Import it as `@plitzi/sdk-server/ssr`. A stage injected into a page server receives `SSRContext` and so
 *  already holds the render singletons; this entry is what lets it USE them — `buildBody` renders offline data
 *  to HTML, `takeDraftOverride` is the read side of the draft store. `@plitzi/sdk-mcp`'s draft-preview endpoint
 *  is the in-tree consumer.
 *
 *  Separate from the root barrel on purpose: that one also pulls RSC, connectors and the adapters, none of which
 *  an injected render stage needs. */

export { buildBody } from './modules/ssr/buildBody';
export { createMemoryDraftStore, takeDraftOverride } from './modules/ssr/preview';
export { PREVIEW_TOKEN_PARAM } from './core/previewToken';

export type { PluginManager } from './plugins/manager';
export type { ServerCaches } from './helpers/cache';
export type { BaseContext, PipelineExtensions, SSRContext, Stage } from './core/http/types';
