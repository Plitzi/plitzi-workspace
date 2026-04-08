import { createContext } from 'react';

import type { DisplayMode } from '@plitzi/sdk-shared';
import type { Dispatch, SetStateAction } from 'react';

export type AppContextValue = {
  previewMode: boolean;
  debugMode: boolean;
  setPreviewMode: Dispatch<SetStateAction<boolean>>;
  displayBorderComponents: 'black' | 'white' | 'none';
  setDisplayBorderComponents: Dispatch<SetStateAction<'black' | 'white' | 'none'>>;
  zoom: number;
  setZoom: Dispatch<SetStateAction<number>>;
  displayMode: DisplayMode;
  setDisplayMode: Dispatch<SetStateAction<DisplayMode>>;
  mobilePreview: boolean;
  setMobilePreview: Dispatch<SetStateAction<boolean>>;
};

const appContextDefaultValue: AppContextValue = {} as AppContextValue;

const AppContext = createContext(appContextDefaultValue);
AppContext.displayName = 'AppContext';

export default AppContext;
