import { DEFAULT_TTL_MS } from './defaults';
import { TtlCache } from './TtlCache';

export type ServerCaches = {
  html: TtlCache<string> | undefined;
  rsc: TtlCache<string> | undefined;
};

export const createServerCaches = (
  htmlTtlMs = DEFAULT_TTL_MS.html,
  rscTtlMs = DEFAULT_TTL_MS.rsc
): ServerCaches => ({
  html: htmlTtlMs > 0 ? new TtlCache<string>(htmlTtlMs) : undefined,
  rsc: rscTtlMs > 0 ? new TtlCache<string>(rscTtlMs) : undefined
});

export const destroyServerCaches = ({ html, rsc }: ServerCaches): void => {
  html?.destroy();
  rsc?.destroy();
};
