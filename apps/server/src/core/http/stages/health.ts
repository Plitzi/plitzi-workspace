import { buildHealthPayload } from '../../health';

import type { Stage } from '../types';

// Liveness/readiness endpoint for standalone servers (k8s probes). Always responds at /health so every server
// created via sdk-server gets one without the consumer wiring it. The body is the generic identity payload
// (built from config.health.name/version/role) unless config.health.payload overrides it entirely.
export const healthStage: Stage = ctx => {
  const health = ctx.config.health;
  if (ctx.req.path !== (health?.path ?? '/health')) {
    return false;
  }

  ctx.res.setHeader('Content-Type', 'application/json');
  ctx.res.setStatus(200);
  ctx.res.send(JSON.stringify(health?.payload ?? buildHealthPayload(health)));

  return true;
};
