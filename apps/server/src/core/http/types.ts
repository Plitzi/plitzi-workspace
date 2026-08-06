import type { RawResponse } from '../../helpers/buildResponseHelpers';
import type { ServerCaches } from '../../helpers/cache';
import type { PluginManager } from '../../plugins/manager';
import type { SSRRequest, SSRResponseHelpers, SSRServerConfig, SSRTemplateFn } from '@plitzi/sdk-shared';
import type { IncomingMessage } from 'node:http';

// The minimum every stage can rely on: the request/response and the server's config. MCP-only servers run on
// nothing more than this.
export interface BaseContext {
  raw: IncomingMessage;
  rawRes: RawResponse;
  req: SSRRequest;
  res: SSRResponseHelpers;
  config: SSRServerConfig;
  port: number;
  /** Set by the stage that answers when the path alone does not identify the work (the MCP endpoint serves every
   *  JSON-RPC method on the same URL). The dispatcher folds it into the access log. */
  operation?: string;
}

// The richer context an SSR server builds: the render template, caches and plugin manager that the page/RSC and
// plugin-asset stages need. A leaner server (e.g. MCP-only) never constructs these.
export interface SSRContext extends BaseContext {
  renderFn: SSRTemplateFn;
  caches: ServerCaches;
  pluginManager: PluginManager;
}

// One step of the request pipeline. Returns true when it has answered the request (the dispatcher stops), or
// false to fall through. Parameterised by the context its server provides: stages that only need `BaseContext`
// run in any server, stages typed to `SSRContext` only in the SSR pipeline.
export type Stage<C extends BaseContext = BaseContext> = (ctx: C) => boolean | Promise<boolean>;

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
