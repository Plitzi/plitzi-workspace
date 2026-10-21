import chalk from 'chalk';

import { cell } from './monitorCells';

import type { TaskLine } from '../../runs/view';

/** The width of one stage of the flow: its name, its count, its tasks. */
const STAGE_WIDTH = 22;

/**
 * The run as a flow, from to-do to approved: each stage with how many tasks stand in it and which, what holds an agent
 * back (held), the review split in its UI's and the lead's, and what is sent back looping to the work.
 */
export const flowLines = (tasks: readonly TaskLine[], width: number): string[] => {
  const of = (status: TaskLine['status']) => tasks.filter(task => task.status === status);
  const uiReview = of('in-review').filter(task => task.design?.status === 'due');
  const leadReview = of('in-review').filter(task => task.design?.status !== 'due');
  const stages: {
    name: string;
    tone: (text: string) => string;
    tasks: TaskLine[];
    who?: (task: TaskLine) => string;
    /** Not a step after the one before it: drawn past a bar, not an arrow. */
    apart?: boolean;
  }[] = [
    { name: '· pending', tone: chalk.dim, tasks: of('pending') },
    { name: '○ ready', tone: text => text, tasks: of('ready') },
    {
      name: '▶ at work',
      tone: chalk.cyan,
      tasks: of('in-progress').filter(task => !task.asking),
      who: task => task.agent ?? ''
    },
    // What holds an agent back: a block, a file another task has, a question to the lead, a failure.
    {
      name: '■ held',
      tone: chalk.yellow,
      tasks: [...of('blocked'), ...of('waiting'), ...tasks.filter(task => task.asking), ...of('failed')],
      who: task =>
        task.asking
          ? `asks lead (${task.asking.id})`
          : task.status === 'blocked'
            ? `blocked: needs ${task.blockedBy?.needs ?? 'someone'}`
            : task.status === 'waiting'
              ? `waits ${task.waitingFor?.task ?? 'a file'}`
              : 'failed'
    },
    { name: '◎ UI review', tone: chalk.magenta, tasks: uiReview, who: task => task.design?.by ?? 'nobody yet' },
    { name: '◎ lead review', tone: chalk.magenta, tasks: leadReview, who: task => task.reviewer ?? 'no lead yet' },
    { name: '✓ approved', tone: chalk.green, tasks: of('done') },
    // Sent back by a review: no step toward approved, but back to the work of the same agent — set apart.
    {
      name: '↺ sent back',
      tone: chalk.yellow,
      tasks: of('changes-requested').filter(task => !task.asking),
      who: task => `${task.agent ?? ''} r${String(task.round)}`,
      apart: true
    }
  ];
  const fit = (text: string) => cell(text, STAGE_WIDTH);
  const arrow = chalk.dim(' ─▶ ');
  const bar = chalk.dim('  │ ');
  // Each stage after the first, past an arrow — or a bar, for one that is no step after the one before it.
  const joined = (cells: string[], edge: (apart: boolean) => string) =>
    cells.map((each, index) => (index === 0 ? each : `${edge(stages[index].apart === true)}${each}`)).join('');
  const head = joined(
    stages.map(stage => fit(stage.tone(chalk.bold(`${stage.name} (${String(stage.tasks.length)})`)))),
    apart => (apart ? bar : arrow)
  );
  const deepest = Math.min(8, Math.max(0, ...stages.map(stage => stage.tasks.length)));
  const rows = Array.from({ length: deepest }, (_, index) =>
    stages
      .map(stage => {
        const task = stage.tasks.at(index);
        if (!task) {
          return ' '.repeat(STAGE_WIDTH);
        }

        return fit(`${stage.tone(task.id)}${stage.who ? chalk.dim(` ${stage.who(task)}`) : ''}`);
      })
      .map((each, index) => (index === 0 ? each : `${stages[index].apart === true ? bar : '    '}${each}`))
      .join('')
  );
  const more = stages.some(stage => stage.tasks.length > deepest)
    ? [
        chalk.dim(
          stages
            .map(stage => fit(stage.tasks.length > deepest ? `  + ${String(stage.tasks.length - deepest)} more` : ''))
            .map((each, index) => (index === 0 ? each : `${stages[index].apart === true ? bar : '    '}${each}`))
            .join('')
        )
      ]
    : [];
  return [
    chalk.bold('FLOW') + chalk.dim('  f closes it · a task goes left to right'),
    '',
    cell(head, width),
    ...rows.map(row => cell(row, width)),
    ...more.map(row => cell(row, width)),
    '',
    cell(
      chalk.dim(
        '  ↺ sent back: to the same agent, who redoes it on what the run approved meanwhile — another takes it only if its agent goes silent'
      ),
      width
    )
  ];
};
