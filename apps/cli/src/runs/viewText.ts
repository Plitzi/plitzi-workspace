import { designSkipText } from './designSkip';
import { waitingText } from './view';

import type { DesignReview, TaskStatus } from './model';
import type { RunView } from './view';

/** A run in words: the board of its tasks, and the run as `plitzi run watch` and `run status` print it. */

const ICON: Record<TaskStatus, string> = {
  pending: '·',
  spike: '◇',
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

/** Where a task's UI review is, in a line. */
const designText = (design: DesignReview): string =>
  design.status === 'due'
    ? `its UI with ${design.by ?? 'a designer, not taken yet'}`
    : design.status === 'approved'
      ? `UI approved by ${design.by ?? 'a designer'}`
      : designSkipText(design.why);

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
          : task.status === 'spike'
            ? task.spikedBy
              ? ` · ${task.spikedBy} finds it out`
              : ' · not taken yet'
            : task.status === 'blocked' && task.blockedBy
              ? ` · ${task.blockedBy.reason}`
              : task.status === 'changes-requested'
                ? ` · changes requested (round ${String(task.round)})`
                : task.status === 'in-review' && task.design?.status === 'due'
                  ? ` · ${designText(task.design)}`
                  : task.status === 'in-review' && task.proposed
                    ? ` · ${task.proposed.by} found it out: the lead decides`
                    : task.status === 'in-review'
                      ? `${task.design ? ` · ${designText(task.design)}` : ''}${task.reviewer ? ` · ${task.reviewer} reviews it` : task.spareReviewers ? ` · ${task.spareReviewers.join(' or ')} reviews it (each tester worked it)` : task.leadReviews ? ' · the lead’s to review (nobody else may: each worked it, or what it tests)' : view.reviewers.length > 0 ? ' · no tester took it yet' : ''}`
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
