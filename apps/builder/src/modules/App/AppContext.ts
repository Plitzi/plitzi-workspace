import { createContext } from 'react';

import type { Dispatch, SetStateAction } from 'react';

export type AppContextValue = {
  previewMode: boolean;
  debugMode: boolean;
  setPreviewMode: Dispatch<SetStateAction<boolean>>;
  displayBorderComponents: 'black' | 'white' | 'none';
  setDisplayBorderComponents: Dispatch<SetStateAction<'black' | 'white' | 'none'>>;
  zoom: number;
  setZoom: Dispatch<SetStateAction<number>>;
  displayMode: 'desktop' | 'tablet' | 'mobile';
  setDisplayMode: Dispatch<SetStateAction<'desktop' | 'tablet' | 'mobile'>>;
  mobilePreview: boolean;
  setMobilePreview: Dispatch<SetStateAction<boolean>>;
};

const appContextDefaultValue: AppContextValue = {} as AppContextValue;

const AppContext = createContext<AppContextValue>(appContextDefaultValue);

export default AppContext;
