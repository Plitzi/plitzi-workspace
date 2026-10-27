import type { Finding } from './types';
import type { RunReport } from '../report';

/**
 * What the run came to that needs a look — a task not finished, a file written over, an estimate far off — read off
 * the report's own facts, each said once with what it is about.
 */
/**
 * How long the run took of what is the run's: from its open to ready to apply — its work and the lead's close — or to
 * now while it is not ready; never the person's wait after.
 */
const ranMinutes = (report: Pick<RunReport, 'minutes' | 'metrics'>): number => {
  const { workMinutes, closeMinutes } = report.metrics;

  return workMinutes !== undefined && closeMinutes !== undefined
    ? Math.round((workMinutes + closeMinutes) * 10) / 10
    : report.minutes;
};

export const factFindings = (
  report: Pick<
    RunReport,
    'tasks' | 'events' | 'overwrites' | 'joined' | 'stops' | 'proposals' | 'minutes' | 'estimate' | 'metrics'
  >
): Finding[] => {
  const each = (
    kind: Finding['kind'],
    items: readonly { subject: string; title: string; evidence?: string[] }[],
    fix?: string
  ): Finding[] =>
    items.map(item => ({
      kind,
      owner: 'lead' as const,
      title: item.title,
      evidence: item.evidence ?? [],
      times: 1,
      ...(fix ? { fix } : {}),
      subject: `${kind}:${item.subject}`
    }));
  const { tasks } = report;

  return [
    ...each(
      'unfinished',
      tasks
        .filter(task => task.status !== 'done')
        .map(task => ({ subject: task.id, title: `${task.id} did not finish: ${task.status}` }))
    ),
    ...each(
      'blocked',
      // One still blocked as the run ends: an escalation the lead answered was a step of the flow (the rehearsal's).
      tasks.flatMap(task =>
        task.blocked && task.status !== 'done'
          ? [{ subject: task.id, title: `${task.id} was blocked`, evidence: [task.blocked] }]
          : []
      )
    ),
    ...each(
      'cut',
      tasks
        .filter(task => task.cuts > 0)
        .map(task => ({ subject: task.id, title: `${task.id} was cut ${String(task.cuts)} time(s) and started again` }))
    ),
    // To ready to apply: what waits on the person after is never the run's (a run's read 96 min of 51, 48 of them
    // the person's wait — the work took 36).
    ...(ranMinutes(report) > report.estimate.wallMinutes * 1.5
      ? each('over-estimate', [
          {
            subject: 'run',
            title: `The run took ${String(ranMinutes(report))} min to ready of an estimated ${String(report.estimate.wallMinutes)}`
          }
        ])
      : []),
    ...(report.events.conflicts > 0
      ? each(
          'conflict',
          [{ subject: 'run', title: `${String(report.events.conflicts)} conflict(s) between tasks on the same lines` }],
          'a file many tasks add to — an index, a list — split so each task writes its own (pagesIn, actionsIn)'
        )
      : []),
    ...each(
      'overwrite',
      report.overwrites.map(item => ({
        subject: item.file,
        title: `${item.file} was written over a change made outside the run`,
        evidence: [`${item.task}, decided by ${item.by}`]
      }))
    ),
    ...each(
      'joined',
      report.joined.map(item => ({
        subject: item.file,
        title: `${item.file} was changed outside the run too: both kept, line by line`,
        evidence: [`${item.task}, decided by ${item.by}`]
      }))
    ),
    ...each(
      'stopped',
      report.stops.map(stop => ({
        subject: stop.at,
        title: `The run stopped at ${stop.at.slice(11, 16)} UTC`,
        evidence: [
          `${stop.reason}${stop.resumedAt ? `, resumed by ${String(stop.by)} at ${stop.resumedAt.slice(11, 16)} UTC` : ''}`
        ]
      }))
    ),
    ...each(
      'unanswered-proposal',
      report.proposals
        .filter(item => item.answer === undefined)
        .map(item => ({
          subject: item.id,
          title: `${item.id} was never answered`,
          evidence: [`${item.from} → ${item.to}: ${item.change}`]
        }))
    )
  ];
};
