import chalk from 'chalk';

import { projectRun } from '../../../scaffold/packageManager';
import { list } from '../text';

import type { ReviewedTask } from '../../../runs/tasks';

/** An approval, as the reviewer reads it: what went in, what it handed on, and what did not go as asked. */
export const approvedText = (taskId: string, reviewed: ReviewedTask): string =>
  [
    `${taskId} approved: ${list(reviewed.merged ?? [])} in the run's work.`,
    ...(reviewed.with
      ? [`  ${reviewed.with.task} approved beside it, as one change: ${list(reviewed.with.merged)} in too`]
      : []),
    ...((reviewed.joined ?? []).length > 0
      ? [`  Put together with the change made in the project meanwhile: ${list(reviewed.joined ?? [])}`]
      : []),
    ...((reviewed.fulfilled ?? []).length > 0
      ? [`  Its requests went in: ${list(reviewed.fulfilled ?? [])} — a holder's copy brings them`]
      : []),
    ...(reviewed.unmerged
      ? [
          chalk.yellow(
            `  ⚠ Its request on ${list(reviewed.unmerged.files)} did not go in — ${reviewed.unmerged.reason}: an integration task applies it`
          )
        ]
      : []),
    ...((reviewed.granted ?? []).length > 0 ? [`  Handed on: ${list(reviewed.granted ?? [])}`] : []),
    ...((reviewed.ready ?? []).length > 0 ? [`  Ready now: ${list(reviewed.ready ?? [])}`] : []),
    ...(reviewed.previewProblem
      ? [
          chalk.yellow(
            `  ⚠ The run's preview did not take it in: ${reviewed.previewProblem} — restart it (p in plitzi run monitor, or ${projectRun('start:preview')})`
          )
        ]
      : []),
    ...notReviewedText(reviewed.notReviewed, 'approve'),
    ...(reviewed.copyLeft === undefined
      ? []
      : [
          `  This shell is in its copy, which is done with now: left in place for it, it goes with the run — go back to the project before the next command: cd ${reviewed.copyLeft}`
        ])
  ].join('\n');

/** What its copy holds that the review did not see — written after `complete`: kept out, and said. */
export const notReviewedText = (files: readonly string[] | undefined, verdict: 'approve' | 'changes'): string[] =>
  files && files.length > 0
    ? [
        `  ⚠ Written in its copy after it went to review, so not what you reviewed: ${list(files)} — ${
          verdict === 'approve'
            ? 'what went to review is what was merged; that went with its copy'
            : 'it stays in its copy, and goes to review with its next complete'
        }`
      ]
    : [];
