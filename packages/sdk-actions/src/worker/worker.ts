import {
  createHttpServer,
  createMiddlewaresStage,
  crossSiteWritesStage,
  healthStage,
  makeHandler
} from '@plitzi/sdk-kernel/http';
import { configureServerLog, defaultLogLevel } from '@plitzi/sdk-kernel/log';
import { statsStage } from '@plitzi/sdk-kernel/stats';

import { actionOriginProblem } from './origin';
import { createPageEngine } from './pageEngine';
import { createActionCorsStage } from './stages/cors';
import { createRenderStage } from './stages/render';

import type { EngineServerConfig } from '../types';
import type { DeployedContext, DeploymentAdapters } from '@plitzi/sdk-kernel/deployment';
import type { BuildContext, HttpServer, Stage } from '@plitzi/sdk-kernel/http';
import type { RequestIdentity } from '@plitzi/sdk-kernel/identity';
import type { SSRPageAdapters } from '@plitzi/sdk-kernel/types';

/**
 * A worker's configuration: the engine's (`action`, `functions`, `connectors`, `realtime`), the server's (port, TLS,
 * `workers`, `health`, the log), what it reads of a space (`adapters`: which deployment a host is, a space's documents
 * for its channels and its calls), and who a request is (`identity`).
 */
export type WorkerConfig = Omit<EngineServerConfig, 'adapters'> & {
  adapters: DeploymentAdapters & Pick<SSRPageAdapters, 'getOfflineData'> & Partial<SSRPageAdapters>;
  /** Who a request is, as the page servers answer it (`createAuth(...).ssrIdentityAdapters`). Absent, every call is a guest's. */
  identity?: RequestIdentity;
  /**
   * The page servers' server elements resolved here (`POST /_render`), for page servers handed
   * `engineOnWorker({ render })`: `secret` is what they send, 32 characters or more. Keep the path off the public network
   * too — a gateway sends a browser nothing there — but the secret does not depend on that.
   */
  render?: { secret: string };
};

/** What no stage of a worker answers: its paths are the engine's, and nothing else is served here. */
const notFoundStage: Stage<DeployedContext> = ({ res }) => {
  res.setStatus(404);
  res.send('');

  return true;
};

/**
 * The actions engine as a server of its own (RFC 0032, D8): `/_action` and its webhooks, `/fn/` routes, `/_realtime` and
 * the job queue, on `@plitzi/sdk-kernel` alone — nothing of pages, RSC or signing in. It resolves the host's
 * deployment and who is calling with the same adapters a page server is given, so a gateway may send those paths of a
 * space's host here, beside the page servers or on another machine.
 *
 * Refused when there is nothing to run: a worker with no `action.lookups`, `connectors` or realtime would answer 404 to
 * every call with nothing said. Refused too on another origin (`action.origin`) with no `action.pageOrigins`, whose
 * pages its CORS answers with credentials and its cross-site check takes as its own.
 */
export const createWorker = ({ identity, render, ...config }: WorkerConfig): HttpServer => {
  const problem = actionOriginProblem(config.action, 'worker');
  if (problem) {
    throw new Error(`createWorker: ${problem}`);
  }

  if (render && render.secret.length < 32) {
    throw new Error(
      'createWorker: `render.secret` must be at least 32 characters — whoever holds it renders as anyone'
    );
  }

  // What the worker says — its runs, the engine's own messages — held to its own threshold, as a page server's are.
  configureServerLog({
    level: config.logLevel ?? defaultLogLevel(config.devMode),
    ...(config.logger ? { logger: config.logger } : {}),
    ...(config.slowRunMs === undefined ? {} : { slowRunMs: config.slowRunMs })
  });

  const pageOrigins = config.action?.origin ? (config.action.pageOrigins ?? []) : [];
  const served: WorkerConfig = {
    ...config,
    adapters: { ...config.adapters, ...identity },
    ...(pageOrigins.length > 0
      ? {
          crossSiteWrites: {
            ...config.crossSiteWrites,
            origins: [...(config.crossSiteWrites?.origins ?? []), ...pageOrigins]
          }
        }
      : {})
  };
  const engine = createPageEngine(served);
  if (!engine) {
    throw new Error(
      'createWorker runs the actions engine, and was given none of it: name `action.lookups` (and `functions`, ' +
        '`connectors` or `realtime` as the deployment has them)'
    );
  }

  const stages: Stage<DeployedContext>[] = [
    healthStage,
    statsStage,
    // A page server's server elements: the space and the visitor are said in the ask, so before the deployment's stage.
    ...(render && engine.resolveElement ? [createRenderStage(engine.resolveElement, render.secret)] : []),
    // The pages that call the actions from another origin (`action.origin`), answered with their own and credentials.
    ...(pageOrigins.length > 0 ? [createActionCorsStage(pageOrigins)] : []),
    // A write another site caused stops here, whoever is signed in.
    crossSiteWritesStage,
    // Which deployment the host is, its basic auth, and who is calling — what the engine's stages read off the request.
    createMiddlewaresStage(),
    ...engine.endpoints,
    ...engine.routes,
    notFoundStage
  ];
  const makeHandlerForPort = (port: number) => {
    const buildContext: BuildContext<DeployedContext> = (raw, rawRes, req, res) => ({
      raw,
      rawRes,
      req,
      res,
      config: served,
      port
    });

    return makeHandler('Worker', buildContext, stages, {
      compression: served.compression,
      ...(engine.upgrades ? { upgrades: engine.upgrades } : {})
    });
  };

  return createHttpServer(served, makeHandlerForPort, {
    label: 'Worker',
    ...(engine.listening ? { onListen: engine.listening } : {}),
    ...(engine.closing ? { onClosing: engine.closing } : {}),
    ...(engine.destroy ? { onDestroy: engine.destroy } : {}),
    ...(engine.fleetStores ? { fleetStores: engine.fleetStores } : {})
  });
};
