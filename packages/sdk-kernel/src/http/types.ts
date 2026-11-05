import type { RawResponse } from './buildResponseHelpers';
import type { UpgradeRequest } from './socketResponse';
import type { SSRRequest, SSRResponseHelpers } from '../types';
import type { ServerBaseConfig } from '../types';
import type { IncomingMessage } from 'node:http';

// The minimum every stage can rely on: the request/response and the server's config. MCP-only servers run on
// nothing more than this.
export interface BaseContext {
  raw: IncomingMessage;
  rawRes: RawResponse;
  req: SSRRequest;
  res: SSRResponseHelpers;
  config: ServerBaseConfig;
  port: number;
  /** Set by the stage that answers when the path alone does not identify the work (the MCP endpoint serves every
   *  JSON-RPC method on the same URL). The dispatcher folds it into the access log. */
  operation?: string;
  /**
   * Aborted when the client goes away.
   *
   * The pipeline had no request lifecycle at all before this: a stage that kept working after the socket closed
   * had no way to find out, which is affordable for a page render and is not for anything long-lived. Stages that
   * spend real work on behalf of a caller should hand this to whatever they call.
   */
  signal: AbortSignal;
  /**
   * Present when the request asks to switch protocols (a WebSocket). The stage that takes it performs the switch on
   * the socket and marks it `taken`; any other answer is written to the socket as HTTP and closes it.
   */
  upgrade?: UpgradeRequest;
}

// One step of the request pipeline. Returns true when it has answered the request (the dispatcher stops), or
// false to fall through. Parameterised by the context its server provides: stages that only need `BaseContext`
// run in any server, stages typed to `SSRContext` only in the SSR pipeline.
export type Stage<C extends BaseContext = BaseContext> = (ctx: C) => boolean | Promise<boolean>;
