import { createContext } from 'react';

import type { Dispatch, SetStateAction } from 'react';

export type TabContainerContextValue = {
  /** What the tabs' and the panels' ids start with, so each tab can name the panel it shows and each panel its tab. */
  baseId: string;
  tabSelected: number;
  onSelect: Dispatch<SetStateAction<number>>;
};

// No default: a tab is drawn only inside its container, and a default would hide one that is not.
const TabContainerContext = createContext<TabContainerContextValue>(undefined as unknown as TabContainerContextValue);
TabContainerContext.displayName = 'TabContainerContext';

export default TabContainerContext;
