import { DESIGNER, DEVELOPER, TESTER } from './team';

/** What a person sees: the space's document — pages, layouts, components, the theme — and the plugins drawn in it. */
const UI_FILE = /^src\/(?:space|plugins)\//;
const NOT_UI = /\.(?:test|spec)\.[cm]?[jt]sx?$|^src\/space\/data\//;

export const isUiFile = (file: string): boolean => UI_FILE.test(file) && !NOT_UI.test(file);

/** Whether a designer reviews the UI of a task of this role that writes these files: another role's, a page changed. */
export const reviewedAsUi = (role: string | undefined, files: readonly string[]): boolean =>
  ![DESIGNER, TESTER].includes(role ?? DEVELOPER) && files.some(isUiFile);
