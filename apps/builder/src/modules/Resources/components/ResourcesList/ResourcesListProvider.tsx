import { createContext, useMemo, useState } from 'react';

import type { ResourceType } from '@plitzi/sdk-shared';
import type { Dispatch, ReactNode, SetStateAction } from 'react';

type ResourceDragging = { id: string; type: ResourceType; directoryName: string };

export type ResourcesListContextValue = {
  draggingFile?: ResourceDragging;
  isFileMoving: boolean;
  setDraggingFile: Dispatch<SetStateAction<ResourceDragging | undefined>>;
  setIsFileMoving: Dispatch<SetStateAction<boolean>>;
};

const ResourcesListContext = createContext<ResourcesListContextValue>({} as ResourcesListContextValue);
ResourcesListContext.displayName = 'ResourcesListContext';

export type ResourcesListProviderProps = { children: ReactNode };

const ResourcesListProvider = ({ children }: ResourcesListProviderProps) => {
  const [draggingFile, setDraggingFile] = useState<ResourceDragging | undefined>();
  const [isFileMoving, setIsFileMoving] = useState<boolean>(false);
  const contextValue = useMemo(
    () => ({ draggingFile, isFileMoving, setDraggingFile, setIsFileMoving }),
    [draggingFile, isFileMoving]
  );

  return <ResourcesListContext value={contextValue}>{children}</ResourcesListContext>;
};

export { ResourcesListContext };

export default ResourcesListProvider;
