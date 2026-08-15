import type { ServerResponse } from 'node:http';

export type HealthCheckApp = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get: (path: string, handler: (...args: any[]) => void) => void;
};

export interface HealthIdentity {
  role: string;
  name?: string;
  version?: string;
}

// The one health/identity payload every server answers with, so /health looks the same whether it is served by
// the http pipeline (healthStage) or attached to a bare Express app (registerHealthCheck).
export const buildHealthPayload = (identity: Partial<HealthIdentity> = {}): Record<string, unknown> => ({
  Server: identity.name ?? 'SDK Server',
  Version: identity.version ? `v${identity.version}` : 'unknown',
  role: identity.role
});

/**
 * Attach the generic /health endpoint to an Express-style app — a deployment whose roles are not all on the sdk-server
 * http pipeline. Servers built on the pipeline get the same endpoint from `healthStage`.
 *
 * `check` is what makes it a readiness probe rather than a liveness one, and it is here for the same reason it is on
 * `healthStage`: a role reports the stores it depends on, and `healthy: false` answers 503 so an orchestrator stops
 * routing to a replica that can serve nothing. Without it the two halves of one deployment answered different
 * questions at the same path — and the Express half's real check ended up as a second, password-guarded endpoint the
 * probes were never pointed at.
 */
export const registerHealthCheck = (
  app: HealthCheckApp,
  identity: HealthIdentity,
  check?: () => Record<string, unknown> | Promise<Record<string, unknown>>
): void => {
  const payload = buildHealthPayload(identity);

  app.get('/health', (_req: unknown, res: ServerResponse) => {
    void (async () => {
      let live: Record<string, unknown> = {};

      if (check) {
        try {
          live = await check();
        } catch (error: unknown) {
          // A check that throws has answered the question. Reporting it as a 500 would read as "the health endpoint
          // is broken" when what is broken is the thing it was asked about.
          live = { healthy: false, reason: error instanceof Error ? error.message : String(error) };
        }
      }

      res.writeHead(live.healthy === false ? 503 : 200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ...payload, ...live }));
    })();
  });
};
