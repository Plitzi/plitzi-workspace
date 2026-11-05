import { webRequestOf, writeWebResponse } from '@plitzi/sdk-kernel/http';
import { reachSpaceInside } from '@plitzi/sdk-kernel/outbound';
import { endpointFor, endpointProblem, PLATFORM_HEADERS, RUNTIME_DESCRIBE_PATH } from '@plitzi/sdk-shared/functions';

import { createRuntimeRunner } from './runner';
import { describeFunctions } from '../runner/driver';
import { startFunctionsRunnerService } from '../runner/service';

import type { SpaceRuntime } from '@plitzi/sdk-shared/functions';
import type { AddressInfo } from 'node:net';

/** What the platform reads of a started runtime: its functions' manifest, and the paths it answers itself. */
export type SpaceRuntimeDescription = { functions: Record<string, unknown>; endpoints: string[] };

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
  /**
   * Where the space is reached from inside the network this runtime runs in — the platform's ingress, over plain HTTP.
   * Given, the runtime's requests to its own space go there rather than out to the edge and back (`reachSpaceInside`).
   */
  insideUrl?: string | undefined;
  /** How it stops: out of rotation for `announceMs`, then what it runs has `graceMs` to end (the runner service's). */
  shutdown?: { announceMs?: number; graceMs?: number };
};

export type SpaceRuntimeHost = {
  address: () => AddressInfo;
  close: () => Promise<void>;
};

/**
 * A space runtime, started and served: its tasks and routes over the functions runners' protocol (the platform invokes
 * them and answers every `ctx` call), and its endpoints as plain HTTP the platform forwards — both behind one secret,
 * since the only caller is the platform. The process is the space's alone: what its code can reach is this process
 * and the network it is given, never the platform's database or keys. It says nothing of itself: its caller knows which
 * space it is, and says so once it answers.
 */
export const startSpaceRuntime = async ({
  runtime,
  secret,
  port = 8791,
  host = '0.0.0.0',
  env,
  publicUrl,
  insideUrl,
  shutdown
}: SpaceRuntimeHostOptions): Promise<SpaceRuntimeHost> => {
  // Before the space's code runs: whatever it opens to its own address, from its first request, goes the inside way.
  if (insideUrl) {
    await reachSpaceInside({ publicUrl, insideUrl });
  }

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
  // The runner's own line would read as a runner's: whoever started this names the space it serves, once.
  const service = await startFunctionsRunnerService({
    secret,
    port,
    host,
    announce: false,
    // Its stats say what it is: a space's runtime, not a functions runner, whose pool the back-office shows apart.
    stats: { pool: 'runtime' },
    ...(shutdown ? { shutdown } : {}),
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
