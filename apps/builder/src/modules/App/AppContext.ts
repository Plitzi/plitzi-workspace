import { createContext } from 'react';

import type { DisplayMode } from '@plitzi/sdk-shared';
import type { Dispatch, SetStateAction } from 'react';

export type AppContextValue = {
  previewMode: boolean;
  debugMode: boolean;
  setPreviewMode: Dispatch<SetStateAction<boolean>>;
  displayBorderComponents: 'black' | 'white' | 'none';
  setDisplayBorderComponents: Dispatch<SetStateAction<'black' | 'white' | 'none'>>;
  /** The layout grid over the canvas: the columns a page is laid out on, to line an element up by eye. */
  displayGrid: boolean;
  setDisplayGrid: Dispatch<SetStateAction<boolean>>;
  zoom: number;
  setZoom: Dispatch<SetStateAction<number>>;
  displayMode: DisplayMode;
  setDisplayMode: Dispatch<SetStateAction<DisplayMode>>;
  mobilePreview: boolean;
  setMobilePreview: Dispatch<SetStateAction<boolean>>;
  /** Where the Functions panel's TypeScript worker is served; empty when the host serves none. */
  functionsWorkerUrl: string;
};

const appContextDefaultValue: AppContextValue = {} as AppContextValue;

const AppContext = createContext(appContextDefaultValue);
AppContext.displayName = 'AppContext';

export default AppContext;
