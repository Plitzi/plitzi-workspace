import { DESIGNER, DEVELOPER, TESTER } from './team';

/**
 * What a person sees: the space's document — pages, layouts, components, the theme — and what a plugin draws, its
 * components and styles. A plugin's other modules — loading a script, a client, its declaration — draw nothing: a card
 * that only made a player's loader retry was told it changes what a visitor sees, and asked for a designer.
 */
const UI_FILE = /^src\/space\/|^src\/plugins\/.+\.(?:[cm]?[jt]sx|css|scss)$/;
const NOT_UI = /\.(?:test|spec)\.[cm]?[jt]sx?$|^src\/space\/data\//;

export const isUiFile = (file: string): boolean => UI_FILE.test(file) && !NOT_UI.test(file);

/** Whether a designer reviews the UI of a task of this role that writes these files: another role's, a page changed. */
export const reviewedAsUi = (role: string | undefined, files: readonly string[]): boolean =>
  ![DESIGNER, TESTER].includes(role ?? DEVELOPER) && files.some(isUiFile);
