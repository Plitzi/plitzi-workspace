import { createContext } from 'react';

import type { Space } from './space';

export type SpacesState = {
  owned: Space[];
  guest: Space[];
  loading: boolean;
  /** `'offline'` when nothing answered; otherwise whatever the API said. Absent means the list is good. */
  error?: string;
};

export type SpacesContextValue = SpacesState & {
  activeSpace?: Space;
  setActiveSpace: (space: Space | undefined) => void;
  getSpace: (permanentUrl: string) => Space | undefined;
  getWebKey: (spaceId: number) => Promise<string | undefined>;
  reload: () => Promise<void>;
};

const SpacesContext = createContext<SpacesContextValue | undefined>(undefined);

export default SpacesContext;
