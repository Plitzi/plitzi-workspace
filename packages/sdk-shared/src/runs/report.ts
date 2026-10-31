import { isRecord } from '../helpers';

/**
 * What the person watching a run's preview reports from its page — a bug as they see it, handed to the run's lead as it
 * is: the address, the window, the theme, the element they point at and what they did since the page loaded. The dev
 * tools' Run tab sends it to the preview's server (`RUN_REPORT_PATH`), which leaves it in the folder the CLI names
 * (`RUN_REPORTS_ENV`); the CLI hands it to the lead with the command that plays it again. A lead that got words alone
 * ("with tornadoes selected Strongest breaks") reproduced them by guessing the address, the layers and the width.
 */

/** Where the preview's page sends a report: POST, one a request. */
export const RUN_REPORT_PATH = '/__plitzi/run/report';

/** The variable that names the folder the preview's server leaves each report in, for the CLI to hand on. */
export const RUN_REPORTS_ENV = 'PLITZI_RUN_REPORTS';

/** The most steps a report keeps: the last ones, where what went wrong is. */
export const RUN_REPORT_STEPS_MOST = 40;

/** The longest text a report says. */
export const RUN_REPORT_TEXT_MOST = 2000;

/**
 * One thing the person did: a press, or what a field holds once they typed in it — an element as a step names it
 * (`bin-bar`, the third copy a list draws `bin-bar:3`). A password is never sent: `secret`, its text left out.
 */
export type RunReportStep =
  | { kind: 'click'; element: string }
  | { kind: 'type'; element: string; text: string }
  | { kind: 'type'; element: string; secret: true };

export interface RunReport {
  /** What is wrong, in the person's words. */
  text: string;
  /** The address the steps play again from — where the first was taken — or the page's, with none: path and query. */
  path: string;
  /** The address the person was on when they reported, when the steps took them away from `path`. */
  seenOn?: string;
  /** The window, as a page's breakpoints read it. */
  width: number;
  height: number;
  /** The page's own width when the dev tools' panel took part of the window. */
  pageWidth?: number;
  scheme: 'light' | 'dark';
  /** The element pointed at. */
  element?: string;
  /** What the person did since the page loaded, oldest first. */
  steps: RunReportStep[];
  /** How many steps before those were left out (`RUN_REPORT_STEPS_MOST`). */
  earlier?: number;
  /** When it was sent, ISO in UTC. */
  at: string;
}

const isStep = (value: unknown): value is RunReportStep =>
  isRecord(value) &&
  typeof value.element === 'string' &&
  value.element !== '' &&
  (value.kind === 'click' || (value.kind === 'type' && (typeof value.text === 'string' || value.secret === true)));

const isWidth = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0;

/** What is wrong with a report as sent, every problem at once — none: it is one. */
export const runReportProblems = (value: unknown): string[] => {
  if (!isRecord(value)) {
    return ['a report is a JSON object'];
  }

  return [
    ...(typeof value.text === 'string' && value.text.trim() !== '' ? [] : ['text: what is wrong, in words']),
    ...(typeof value.text === 'string' && value.text.length > RUN_REPORT_TEXT_MOST
      ? [`text: ${String(RUN_REPORT_TEXT_MOST)} characters at most`]
      : []),
    ...(typeof value.path === 'string' && value.path.startsWith('/') ? [] : ['path: the page’s path, from "/"']),
    ...(value.seenOn === undefined || (typeof value.seenOn === 'string' && value.seenOn.startsWith('/'))
      ? []
      : ['seenOn: the path they reported on, from "/"']),
    ...(isWidth(value.width) && isWidth(value.height) ? [] : ['width and height: the window, in whole pixels']),
    ...(value.pageWidth === undefined || isWidth(value.pageWidth) ? [] : ['pageWidth: whole pixels']),
    ...(value.scheme === 'light' || value.scheme === 'dark' ? [] : ['scheme: light or dark']),
    ...(value.element === undefined || (typeof value.element === 'string' && value.element !== '')
      ? []
      : ['element: the id of the element pointed at']),
    ...(Array.isArray(value.steps) && value.steps.length <= RUN_REPORT_STEPS_MOST && value.steps.every(isStep)
      ? []
      : [`steps: at most ${String(RUN_REPORT_STEPS_MOST)}, each a click or a type of an element`]),
    ...(value.earlier === undefined || (typeof value.earlier === 'number' && value.earlier > 0)
      ? []
      : ['earlier: how many steps were left out']),
    ...(typeof value.at === 'string' && !Number.isNaN(Date.parse(value.at)) ? [] : ['at: when, ISO'])
  ];
};

export const isRunReport = (value: unknown): value is RunReport => runReportProblems(value).length === 0;
