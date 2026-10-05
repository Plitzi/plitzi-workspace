/**
 * What a suite needs from an authored space, beyond the handles `authorSpace` returns.
 *
 * Driver-agnostic like `locate`: `inspectPage` takes anything with an `evaluate`, and the rest is data over specs and
 * handles — so this stays a package that installs nothing and touches no browser until a test hands it one.
 */
export { answerAction } from './answerAction';
export type { ActionAnswer, AnsweredRequest, AnsweredRoute, AnswerActionOptions, RoutingPage } from './answerAction';
export { dataIssues } from './dataIssues';
export type { DataIssue, DataIssueCode, DataReport } from './dataIssues';
export { failedFlowText, readDevTools, readDevToolsInPage } from './devTools';
export type { DevToolsDriver, DevToolsFlow, DevToolsFlowStep, DevToolsInput, DevToolsReport } from './devTools';
export { inspectDocument, inspectPage } from './inspect';
export type { DocumentChecks, InspectOptions, PageEvaluator, PageIssue, PageIssueCode, PageReport } from './inspect';
export { onScreen } from './onScreen';
export { loadImages, unrollPage } from './images';
export type { LoadedImages } from './images';
export { alignPictures, comparePictures, diffPictures, pageRegions, profilePictures } from './pictures';
export type {
  CompareOptions,
  PictureAlignment,
  PictureDiff,
  PictureDiffInput,
  PictureDriver,
  PictureRegion,
  RowProfile
} from './pictures';
export { compareTexts, PAGE_TEXT_LIMIT, pageTexts } from './texts';
export type { PageText, TextComparison, TextDifference } from './texts';
export { inspectRenders, summariseRenders } from './renders';
export type { ElementRenders, RenderEvaluator, RenderOptions, RenderReport } from './renders';
export type { OnScreenOptions } from './onScreen';
export type { ProbeFindings, ProbeInput } from './probe';
export { openPage } from './settle';
export type { OpenPageOptions, SettlingEvent, SettlingPage, SettlingRequest } from './settle';
export { pressShortcut, shortcutKey } from './shortcut';
export type { KeyboardDriver } from './shortcut';
export { singlePageSpace, withElement } from './variants';
export type { ElementPatch } from './variants';
