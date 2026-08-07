import type { ServerServices, SSRServerConfig } from '@plitzi/sdk-shared';

export type ResolvedServices = Required<ServerServices>;

// Which request-handling services a page server mounts. Each flag decides whether that service's stage is added
// to the pipeline, so the dispatcher never branches on it. Omitted flags fall back to sensible defaults (ssr on,
// rsc from getRscData). Stages contributed by a companion package are not flags: passing them IS the decision.
export const resolveServices = (config: SSRServerConfig): ResolvedServices => {
  const services = config.services ?? {};

  return {
    ssr: services.ssr ?? true,
    rsc: services.rsc ?? !!config.adapters.getRscData
  };
};

// Where this server answers RSC refreshes, or undefined when it answers none. The client is told which of the two it
// is (`server.rscPath`), so a page rendered off any other origin never fetches an endpoint that is not there.
export const resolveRscEndpoint = (config: SSRServerConfig): string | undefined => {
  if (!resolveServices(config).rsc || !(config.rsc?.enabled ?? true) || !config.adapters.getRscData) {
    return undefined;
  }

  return config.rsc?.path ?? '/_rsc';
};
