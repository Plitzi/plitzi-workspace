import { createContext } from 'react';

import type { SSRRscData } from '../../types';

export type RscContextValue = {
  /** Whether RSC is enabled for the current schema. */
  enabled: boolean;
  /** Global server-side data returned by getRscData. */
  serverData?: SSRRscData['serverData'];
  /** Re-fetch RSC data from the server (e.g. after SPA navigation). */
  refresh?: () => Promise<void>;
};

const RscContext = createContext<RscContextValue>({ enabled: false });

export default RscContext;
