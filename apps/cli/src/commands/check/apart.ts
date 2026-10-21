import fs from 'node:fs/promises';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { copyOf, runPaths, taskPaths } from '../../runs/paths';
import { taskParts } from '../../runs/taskParts';

import type { CheckReport } from './types';
import type { TaskParts } from '../../runs/taskParts';

/**
 * A page checked inside a task's copy is held to that task's part of it: a finding on an element another task writes —
 * a stub of theirs, a label they own — is said apart and fails nothing, as `task look` sets it apart. A task's
 * acceptance runs `page check` on a page several tasks build, and failed on what none of its own files write (la-velada:
 * four tasks on the home's label-wraps of another's). The finish checks the whole result again, so nothing is lost:
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

  const issues = report.issues.filter(issue => !theirs.includes(issue));
  const failedOnlyOnIssues =
    report.consoleErrors.length === 0 &&
    report.failedRequests.length === 0 &&
    !report.clicked?.problem &&
    (report.clicked?.failed.length ?? 0) === 0;

  return {
    ...report,
    issues,
    problems: issues.map(issue => issue.message),
    apart: theirs.map(issue => issue.message),
    ok: report.ok || (issues.length === 0 && failedOnlyOnIssues)
  };
};
