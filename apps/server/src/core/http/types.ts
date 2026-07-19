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

// A pipeline entry pairs a stage with the SERVICE category it belongs to (e.g. 'ssr', 'rsc', 'mcp', 'health').
// The dispatcher reads it to tag the request log event with the service that actually answered — so logging is
// consolidated in one place instead of each stage emitting its own, and every service is a distinct category.
export interface PipelineStage<C extends BaseContext = BaseContext> {
  service: string;
  stage: Stage<C>;
}
