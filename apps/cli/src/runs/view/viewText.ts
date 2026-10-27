import { waitingText } from './view';

import type { RunView, TaskLine } from './view';
import type { TaskStatus } from '../core/model';

/** A run in words: the board of its tasks, and the run as `plitzi run watch` and `run status` print it. */

const ICON: Record<TaskStatus, string> = {
  pending: '·',
  ready: '○',
  'in-progress': '▶',
  waiting: '…',
  'in-review': '◎',
  'changes-requested': '↺',
  done: '✓',
  blocked: '■',
  failed: '✗'
};

const hhmm = (iso: string): string => `${iso.slice(11, 16)} UTC`;

/** Where a card's review stands, in a line: the step it is at, and who has it — or who may take it. */
const reviewText = (review: NonNullable<TaskLine['review']>): string =>
  `${review.steps.length > 1 ? `${review.role}'s review (${String(review.step + 1)}/${String(review.steps.length)})` : `${review.role}'s review`} · ${
    review.by !== undefined
      ? `${review.by} reviews it`
      : review.lead
        ? 'the lead’s (nobody else may)'
        : `not taken yet — ${review.reviewers.join(' or ')}`
  }`;

/**
 * The board, a line per task: where each stands and who has it — what a run's status says of its tasks, and what a
 * lead's watch says with what woke it (a run's lead ran `run status` after each of its watches, 8 times in 10 minutes).
 */
export const boardLines = (view: Pick<RunView, 'tasks' | 'reviewers'>): string[] => {
  const lines: string[] = [];
  for (const task of view.tasks) {
    const progress = task.fraction === undefined ? '' : ` · ${String(Math.round(task.fraction * 100))} %`;
    const step = task.step ? ` · ${task.step}` : '';
    const agent = task.agent ? `${task.agent}: ` : '';
    const extra =
      task.status === 'waiting' && task.waitingFor
        ? ` · waits for ${task.waitingFor.task} ${waitingText(task.waitingFor)}`
        : task.waitsOn
          ? ` · after ${task.waitsOn.join(', ')}`
          : task.leadFindsOut
            ? ' · yours to find out (no scout in the team)'
            : task.status === 'blocked' && task.blockedBy
              ? ` · ${task.blockedBy.reason}`
              : task.status === 'changes-requested'
                ? ` · changes requested (round ${String(task.round)})`
                : task.status === 'in-review' && task.proposed
                  ? ` · ${task.proposed.by} found it out: the lead decides`
                  : task.status === 'in-review' && task.review
                    ? ` · ${reviewText(task.review)}`
                    : '';
    lines.push(
      `  ${ICON[task.status]} ${task.id.padEnd(18)} ${task.role === 'developer' ? '' : `[${task.role}] `}${agent}${task.title}${step}${progress}${extra}${task.noSignal ? ' · no signal' : ''}`
    );
  }

  return lines;
};

/** A run as `plitzi run watch` prints it: the run, a line per task, then what needs attention. */
export const runText = (view: RunView): string => {
  const head = `${view.goal} · ${view.status} · ${String(view.done)} of ${String(view.total)} tasks${view.expectedEnd ? ` · expected end ${hhmm(view.expectedEnd)}${view.pace ? ` (at this ${view.pace.from}'s pace, ${String(Math.round(view.pace.ratio * 100))}% of the estimates)` : ''}` : ''}`;
  const lines = [head];
  view.milestones.forEach(milestone =>
    lines.push(`  ${milestone.name}: ${String(milestone.done)} of ${String(milestone.total)}`)
  );
  lines.push(...boardLines(view));

  if (view.attention.length > 0) {
    lines.push('Needs attention');
    view.attention.forEach(item => lines.push(`  ${item.who === 'person' ? '■' : '⚠'} ${item.text}`));
  }

  if (view.status === 'open' || view.status === 'stopping') {
    lines.push(
      view.previewPort === undefined
        ? 'In a browser, as the tasks are approved: p in plitzi run monitor, or npm run start:preview — the project itself is untouched until the finish'
        : `In a browser, as the tasks are approved: http://127.0.0.1:${String(view.previewPort)} (the run's preview)`
    );
  }

  if (view.merges.length > 0) {
    lines.push(
      `Written into the project: ${view.merges.map(merge => `${merge.id} ${merge.kind} (${String(merge.files)} files)`).join(', ')}`
    );
  }

  return lines.join('\n');
};
