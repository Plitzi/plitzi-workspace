import type { ServerServices, SSRServerConfig } from '@plitzi/sdk-shared';

export type ResolvedServices = Required<ServerServices>;

// Which request-handling services a server mounts. Each flag decides whether that service's stage is added to
// the pipeline, so the dispatcher never branches on it. Omitted flags fall back to sensible defaults (ssr on,
// rsc from getRscData, mcp from mcpAi.enabled); `ai` is a reserved slot with no stage yet.
export const resolveServices = (config: SSRServerConfig): ResolvedServices => {
  const services = config.services ?? {};

  return {
    ssr: services.ssr ?? true,
    rsc: services.rsc ?? !!config.adapters.getRscData,
    mcp: services.mcp ?? config.mcpAi?.enabled ?? false,
    ai: services.ai ?? false
  };
};
