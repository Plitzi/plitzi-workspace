import { createContext } from 'react';

import type { Dispatch, SetStateAction } from 'react';

export type TabContainerContextValue = {
  tabSelected: number;
  onSelect: Dispatch<SetStateAction<number>>;
};

const TabContainerContext = createContext<TabContainerContextValue>(undefined as unknown as TabContainerContextValue);

export default TabContainerContext;
