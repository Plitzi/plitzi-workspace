import { buildHealthPayload } from '../../health';

import type { Stage } from '../types';

/**
 * Liveness/readiness endpoint for standalone servers (k8s probes). Always answers at /health so every server built
 * on sdk-server has one without the consumer wiring it. The body is the generic identity payload (from
 * `config.health.name/version/role`) unless `payload` overrides it entirely.
 *
 * `check` is what makes it a readiness probe: it reports live state — the stores this process depends on, most
 * often — and `healthy: false` answers 503 so an orchestrator stops routing to a replica that cannot serve. A
 * server that answered 200 while its database was gone is one an orchestrator keeps sending traffic to.
 */
export const healthStage: Stage = async ctx => {
  const health = ctx.config.health;
  if (ctx.req.path !== (health?.path ?? '/health')) {
    return false;
  }

  const payload = health?.payload ?? buildHealthPayload(health);
  let live: Record<string, unknown> = {};

  if (health?.check) {
    try {
      live = await health.check();
    } catch (error: unknown) {
      // A check that throws has answered the question. Reporting it as a 500 would read as "the health endpoint is
      // broken" when what is broken is the thing it was asked about.
      live = { healthy: false, reason: error instanceof Error ? error.message : String(error) };
    }
  }

  ctx.res.setHeader('Content-Type', 'application/json');
  ctx.res.setStatus(live.healthy === false ? 503 : 200);
  ctx.res.send(JSON.stringify({ ...payload, ...live }));

  return true;
};
