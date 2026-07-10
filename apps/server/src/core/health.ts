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

// Attach the generic /health endpoint to an Express-style app (the api/server roles, which do not run on the
// sdk-server http pipeline). Servers built through createSSRServer/createMCPServer get the same payload from
// healthStage instead.
export const registerHealthCheck = (app: HealthCheckApp, identity: HealthIdentity): void => {
  const payload = buildHealthPayload(identity);

  app.get('/health', (_req: unknown, res: ServerResponse) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
  });
};
