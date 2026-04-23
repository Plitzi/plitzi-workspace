import { createContext } from 'react';

export type RscContextValue = {
  /** Whether RSC is enabled for the current schema. */
  enabled: boolean;
  /** Global server-side data returned by getRscData. */
  serverData?: unknown;
  /** Per-element server data keyed by element id. null means the element exists server-side but has no extra data. */
  elements?: Record<string, unknown>;
  /** Re-fetch RSC data from the server (e.g. after SPA navigation). */
  refresh?: () => Promise<void>;
};

const RscContext = createContext<RscContextValue>({ enabled: false });

export default RscContext;
