import type { ServerCaches } from '../../helpers/cache';
import type { PluginManager } from '../../plugins/manager';
import type { SSRPageServerConfig } from '../../types';
import type { SSRTemplateFn } from '../../types';
import type { PageEngine } from '@plitzi/sdk-kernel/engine';
import type { BaseContext, Stage } from '@plitzi/sdk-kernel/http';

// The richer context an SSR server builds: the render template, caches and plugin manager that the page/RSC and
// plugin-asset stages need, and a config whose adapters answer for a page request. A leaner server (e.g.
// MCP-only) never constructs these — which is exactly why the page adapters are narrowed here and optional on
// `BaseContext`: a stage that runs in any server cannot assume them.
export interface SSRContext extends BaseContext {
  config: SSRPageServerConfig;
  /** What this server was handed of the actions engine (`createPlatform`): absent, it runs no actions. */
  engine?: PageEngine;
  renderFn: SSRTemplateFn;
  caches: ServerCaches;
  pluginManager: PluginManager;
}

/** Where a package built on this one hands its stages to a page server. Slots, not a list, because the ORDER is
 *  the pipeline's invariant and cannot be expressed across a package boundary: a stage's slot states what it
 *  needs from the pipeline, and the pipeline decides where that lands. `@plitzi/sdk-mcp` is the in-tree
 *  consumer. Declared here, with the context types, so the kernel entry can carry it without reaching into the
 *  registry — which imports every page stage. */
export type PipelineExtensions = {
  /** Stages that gate themselves — on a shared secret, a bearer token, or nothing at all — and so must run
   *  BEFORE the auth middleware chain. The MCP endpoint, the widget proxy and the draft-preview endpoint. */
  preAuth?: Stage<SSRContext>[];
  /** Stages serving data to an already-identified visitor: after the auth chain, before the page render. */
  data?: Stage<SSRContext>[];
};
