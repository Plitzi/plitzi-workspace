import type { Environment, SSRMeterDecision, SSRPageServerConfig, SSRRequest } from '@plitzi/sdk-shared';

// Metering a page must never be able to fail one. An adapter that throws (its store is down, its tables are
// missing) leaves the request uncounted and the render untouched, which is the only acceptable direction for
// the error: the alternative trades revenue accounting for an outage. Reporting it belongs to the adapter,
// which knows what went wrong and has the deployment's logger; here it is simply not fatal.
export const meterPage = async (
  req: SSRRequest,
  config: SSRPageServerConfig,
  spaceId: number,
  environment: Environment,
  revision: number,
  cached: boolean
): Promise<SSRMeterDecision | undefined> => {
  if (!config.adapters.meter) {
    return undefined;
  }

  const started = config.devMode ? performance.now() : 0;
  try {
    return await config.adapters.meter({ kind: 'page_view', cached, req, spaceId, environment, revision });
  } catch {
    return undefined;
  } finally {
    if (config.devMode) {
      req.ctx.timings = [...(req.ctx.timings ?? []), { name: 'meter', dur: Math.round(performance.now() - started) }];
    }
  }
};
