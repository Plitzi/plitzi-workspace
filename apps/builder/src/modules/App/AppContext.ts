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
  /**
   * Whether the canvas plays the elements' declared motion. Still by default — what is edited is shown as it ends up,
   * rather than arriving again on every change — and played on asking.
   */
  motionPlaying: boolean;
  setMotionPlaying: Dispatch<SetStateAction<boolean>>;
  /** Plays every motion from its start: off for a frame, then on, which is what makes an animation begin again. */
  replayMotion: () => void;
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
