import { createContext } from 'react';

/** The room the preview's visitor panel takes beside the canvas: its width and the gutter around it. */
export const PANEL_WIDTH = 360;
export const GUTTER = 16;

/** Whether the preview's visitor choices are docked beside the canvas — then the address bar only says who it is. */
export const PreviewDockContext = createContext(false);
PreviewDockContext.displayName = 'PreviewDockContext';
