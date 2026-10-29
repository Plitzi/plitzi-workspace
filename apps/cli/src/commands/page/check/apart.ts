import fs from 'node:fs/promises';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { copyOf, runPaths, taskPaths } from '../../../runs/core/paths';
import { labelsWrappedInReference, wrapsAsReference } from '../../../runs/plan/reference';
import { taskParts } from '../../../runs/plan/taskParts';

import type { CheckIssue, CheckReport } from './types';
import type { TaskParts } from '../../../runs/plan/taskParts';

/**
 * A page checked inside a task's copy is held to that task's part of it: a finding on an element another task writes —
 * a stub of theirs, a label they own — is said apart and fails nothing, as `task look` sets it apart. A task's
 * acceptance runs `page check` on a page several tasks build, and failed on what none of its own files write (* four tasks on the home's label-wraps of another's). The finish checks the whole result again, so nothing is lost:
 * a finding apart is the other task's to fix, and the run's to hold at the end. A task that writes the page's root, or a
 * check outside a copy, keeps every finding.
 */
export const keptToTask = async (root: string, reports: CheckReport[]): Promise<CheckReport[]> => {
  const copy = copyOf(root);
  if (!copy) {
    return reports;
  }

  const definition: unknown = await fs
    .readFile(taskPaths(runPaths(copy.root, copy.run), copy.task).definition, 'utf-8')
    .then(text => JSON.parse(text) as unknown)
    .catch(() => undefined);
  const files =
    isRecord(definition) && Array.isArray(definition.files)
      ? definition.files.filter((file): file is string => typeof file === 'string')
      : [];
  const parts = files.length > 0 ? await taskParts(root, files) : undefined;
  if (!parts || parts.ownsRoot) {
    return reports;
  }

  return reports.map(report => keptToParts(report, parts));
};

/** One report's findings kept to a task's parts: the ones on another task's elements set apart, its verdict again. */
export const keptToParts = (report: CheckReport, parts: Pick<TaskParts, 'ids' | 'all'>): CheckReport => {
  const theirs = report.issues.filter(
    issue => issue.elementId !== undefined && parts.all.has(issue.elementId) && !parts.ids.has(issue.elementId)
  );
  if (theirs.length === 0) {
    return report;
  }

  return {
    ...without(report, theirs),
    apart: theirs.map(issue => ({ elementId: issue.elementId ?? '', message: issue.message }))
  };
};

/**
 * What a page's issues are that a check with `--expect` does not ask: everything but the expectations themselves, what
 * was asked of how it is sent (`--status`, `--redirects-to`), the steps and the sign-in — and the findings on an
 * expected element, which are its own.
 */
const ASKED_CODES: ReadonlySet<CheckIssue['code']> = new Set([
  'expected-text',
  'page-status',
  'redirected',
  'steps-failed',
  'state-unheld',
  'not-signed-in',
  'no-answer',
  'no-page',
  'server-render-failed'
]);

/**
 * A check that expects is held to what it expects: the page's other findings, its console's errors and refused
 * requests are said beside it and fail nothing. An acceptance line `page check / --expect layer-quakes` could not pass on
 * a space whose page had problems before the run — a pulled Tremor's empty list, its hidden texts — and every page line
 * of a plan was rewritten as `--json | jq`. `page check` with no `--expect` holds the page whole, as the finish does.
 */
export const keptToExpectations = (report: CheckReport, expected: ReadonlySet<string>): CheckReport => {
  const besides = report.issues.filter(
    issue => !ASKED_CODES.has(issue.code) && (issue.elementId === undefined || !expected.has(issue.elementId))
  );
  const errors = [
    ...report.consoleErrors.map(error => `console: ${error}`),
    ...report.failedRequests.map(request => `request refused: ${request}`)
  ];
  if (besides.length === 0 && errors.length === 0) {
    return report;
  }

  const kept = without({ ...report, consoleErrors: [], failedRequests: [] }, besides);

  return { ...kept, besides: [...besides.map(issue => issue.message), ...errors] };
};

/** A report with `moved` taken out of its issues, and its verdict again: passed once nothing else failed it. */
const without = (report: CheckReport, moved: readonly CheckIssue[]): CheckReport => {
  const issues = report.issues.filter(issue => !moved.includes(issue));
  const failedOnlyOnIssues =
    report.consoleErrors.length === 0 &&
    report.failedRequests.length === 0 &&
    !report.clicked?.problem &&
    (report.clicked?.failed.length ?? 0) === 0;

  return {
    ...report,
    issues,
    problems: issues.map(issue => issue.message),
    ok: report.ok || (issues.length === 0 && failedOnlyOnIssues)
  };
};

/**
 * In a run that keeps a reference, a label the original itself wraps at that width is wrapped on purpose: its
 * `label-wraps` is said, as the original's, and fails nothing — a copy is held to the original, not to a rule the
 * original breaks. Anywhere else, every finding stays.
 */
export const keptToReference = async (root: string, reports: CheckReport[]): Promise<CheckReport[]> => {
  const wrappedBy = new Map<string, ReadonlySet<string>>();

  return Promise.all(
    reports.map(async report => {
      const wraps = report.issues.filter(issue => issue.code === 'label-wraps' && issue.label !== undefined);
      if (wraps.length === 0) {
        return report;
      }

      const key = `${report.path} ${String(report.width)}`;
      const wrapped = wrappedBy.get(key) ?? (await labelsWrappedInReference(root, report.path, report.width));
      wrappedBy.set(key, wrapped);
      const asOriginal = wraps.filter(issue => wrapsAsReference(wrapped, issue.label ?? ''));
      if (asOriginal.length === 0) {
        return report;
      }

      return {
        ...without(report, asOriginal),
        asTheOriginal: asOriginal.map(
          issue => `"${issue.label ?? ''}" wraps as the original's does at ${String(report.width)} px`
        )
      };
    })
  );
};
