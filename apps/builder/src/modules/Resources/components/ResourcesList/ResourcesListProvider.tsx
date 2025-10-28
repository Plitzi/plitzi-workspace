import { createContext, useMemo, useState } from 'react';

import type { ResourceType } from '@plitzi/sdk-shared';
import type { Dispatch, ReactNode, SetStateAction } from 'react';

type ResourceDragging = { id: string; type: ResourceType; directoryName: string };

export type ResourcesListContextValue = {
  draggingFile?: ResourceDragging;
  setDraggingFile: Dispatch<SetStateAction<ResourceDragging | undefined>>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const ResourcesListContext = createContext<ResourcesListContextValue>({} as ResourcesListContextValue);

export type ResourcesListProviderProps = { children: ReactNode };

const ResourcesListProvider = ({ children }) => {
  const [draggingFile, setDraggingFile] = useState<ResourceDragging | undefined>();
  const contextValue = useMemo(() => ({ draggingFile, setDraggingFile }), [draggingFile, setDraggingFile]);

  return <ResourcesListContext value={contextValue}>{children}</ResourcesListContext>;
};

export default ResourcesListProvider;
