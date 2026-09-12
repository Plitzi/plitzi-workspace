import { createContext } from 'react';

export type BuilderSearchContextValue = {
  openSearch: () => void;
};

// Outside a `BuilderSearch` there is no search to open, so asking for one does nothing rather than throwing.
const BuilderSearchContext = createContext<BuilderSearchContextValue>({ openSearch: () => undefined });

export default BuilderSearchContext;
