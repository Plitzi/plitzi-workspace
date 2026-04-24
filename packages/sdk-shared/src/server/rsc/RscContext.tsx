import { createContext } from 'react';

import type { SSRRscData } from '../../types';

export type RscContextValue = {
  /** Whether RSC is enabled for the current schema. */
  enabled: boolean;
  /** Global server-side data returned by getRscData. */
  serverData?: SSRRscData['serverData'];
  /** Re-fetch RSC data from the server.
   *  Pass `ids` to refresh only specific elements and merge into existing data.
   *  Omit `ids` for a full refresh (replaces all serverData). */
  refresh?: (ids?: string[]) => Promise<void>;
};

const RscContext = createContext<RscContextValue>({ enabled: false });

export default RscContext;
