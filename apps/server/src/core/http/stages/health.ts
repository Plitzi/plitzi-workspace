import type { Stage } from '../types';

// Liveness/readiness endpoint for standalone servers (k8s probes). Off unless config.health is set, so it
// adds nothing to servers that answer health another way (e.g. SSR's static /health.json).
export const healthStage: Stage = ctx => {
  const { health } = ctx.config;
  if (!health || ctx.req.path !== (health.path ?? '/health')) {
    return false;
  }

  ctx.res.setHeader('Content-Type', 'application/json');
  ctx.res.setStatus(200);
  ctx.res.send(JSON.stringify(health.payload ?? { status: 'ok' }));

  return true;
};
