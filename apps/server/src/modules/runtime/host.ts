import { endpointFor, endpointProblem } from './contract';
import { createRuntimeRunner } from './runner';
import { webRequestOf, writeWebResponse } from '../../core/http/webExchange';
import { describeFunctions } from '../functions/driver';
import { startFunctionsRunnerService } from '../functions/runner/service';

import type { SpaceRuntime } from './contract';
import type { AddressInfo } from 'node:net';

/** What the platform reads of a started runtime: its functions' manifest, and the paths it answers itself. */
export type SpaceRuntimeDescription = { functions: Record<string, unknown>; endpoints: string[] };

/** Where a started runtime says what it serves — under `/_`, which no endpoint may take. */
export const RUNTIME_DESCRIBE_PATH = '/_describe';

/** The headers of the platform's, which a runtime's endpoint never sees. */
export const PLATFORM_HEADERS = ['authorization', 'cookie'];

export type SpaceRuntimeHostOptions = {
  runtime: SpaceRuntime;
  /** What the platform presents — `Authorization: Bearer <secret>` — on its calls and on the requests it forwards. */
  secret: string;
  port?: number;
  host?: string;
  /** The runtime's variables. */
  env: Readonly<Record<string, string | undefined>>;
  /** Where people reach the space. */
  publicUrl: string;
};

export type SpaceRuntimeHost = {
  address: () => AddressInfo;
  close: () => Promise<void>;
};

/**
 * A space runtime, started and served: its tasks and routes over the functions runners' protocol (the platform invokes
 * them and answers every `ctx` call), and its endpoints as plain HTTP the platform forwards — both behind one secret,
 * since the only caller is the platform. The process is the space's alone: what its code can reach is this process
 * and the network it is given, never the platform's database or keys.
 */
export const startSpaceRuntime = async ({
  runtime,
  secret,
  port = 8791,
  host = '0.0.0.0',
  env,
  publicUrl
}: SpaceRuntimeHostOptions): Promise<SpaceRuntimeHost> => {
  const parts = await runtime.start({ env, publicUrl });
  const endpoints = parts.endpoints ?? {};
  const paths = Object.keys(endpoints);
  // Refused before anything is served: an endpoint on a path of the server's would be one the platform never forwards.
  const problems = paths.flatMap(path => endpointProblem(path) ?? []);
  if (problems.length > 0) {
    await parts.close?.();
    throw new Error(problems.join('; '));
  }

  const description: SpaceRuntimeDescription = {
    functions: describeFunctions(parts.functions ?? {}),
    endpoints: paths
  };
  const service = await startFunctionsRunnerService({
    secret,
    port,
    host,
    runner: createRuntimeRunner(parts.functions),
    http: async (req, res) => {
      const url = new URL(req.url ?? '/', publicUrl);
      if (req.method === 'GET' && url.pathname === RUNTIME_DESCRIBE_PATH) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(description));

        return true;
      }

      const endpoint = endpointFor(paths, url.pathname);
      const answer = endpoint ? endpoints[endpoint] : undefined;
      if (!answer) {
        return false;
      }

      const left = new AbortController();
      res.once('close', () => left.abort());
      await writeWebResponse(res, await answer(await webRequestOf(req, url.href, PLATFORM_HEADERS)), left.signal);

      return true;
    }
  });

  return {
    address: service.address,
    close: async () => {
      await service.close();
      await parts.close?.();
    }
  };
};
