import { tokensText } from './runMetrics';

import type { AgentHarness, RunMetrics } from './runMetrics';

/**
 * A run's metrics, as its report reads them (`runMetrics.ts`): where its time went, task by task and agent by agent;
 * what failed, by step and by code; and what it cost — what the CLI printed to each agent, and the calls repeated.
 */

const num = (value: number | undefined): string => (value === undefined ? '—' : String(value));
const listed = (values: readonly number[]): string => (values.length === 0 ? '—' : values.join(', '));
/** Each step said, in order: its wait for a reviewer → its reviewer's time at it (`—` said untaken). */
const stepsText = (steps: RunMetrics['tasks'][number]['steps']): string =>
  steps.length === 0 ? '—' : steps.map(each => `${each.step} ${num(each.waited)}→${num(each.said)}`).join(', ');
const byStepText = (counts: Readonly<Record<string, number>>): string =>
  Object.keys(counts).length === 0
    ? '0'
    : Object.entries(counts)
        .map(([step, times]) => `${step} ${String(times)}`)
        .join(', ');
const harnessCells = (harness: AgentHarness | undefined): string =>
  harness === undefined
    ? '— | — | —'
    : `${tokensText(harness.processed)} | ${tokensText(harness.contextMax)} | ${tokensText(harness.reread)}`;

const reviewsText = (byStep: Readonly<Record<string, { said: number; changes: number }>>): string =>
  Object.keys(byStep).length === 0
    ? '0'
    : Object.entries(byStep)
        .map(([step, each]) => `${step} ${String(each.said)} (${String(each.changes)})`)
        .join(', ');

export const flowText = (metrics: RunMetrics): string[] => {
  const { checks, refusals, questions, cost } = metrics;
  const rate = checks.run === 0 ? 0 : Math.round((checks.failed / checks.run) * 100);

  return [
    '## Flow — where the time went',
    '',
    ...(metrics.workMinutes === undefined
      ? []
      : [
          `Worked ${String(metrics.workMinutes)} min, from the open to every task approved; then ${metrics.closeMinutes === undefined ? '' : `${num(metrics.closeMinutes)} min to the finish's dry run passing (the lead's close), and `}${num(metrics.afterMinutes === undefined ? undefined : Math.round((metrics.afterMinutes - (metrics.closeMinutes ?? 0)) * 10) / 10)} min to this report (the finish is a person's).`,
          ''
        ]),
    'Minutes. Each review step says its wait for a reviewer — from the complete, or the step before approved — then its reviewer’s time at it; a rework, from the changes asked to an agent at it again.',
    '',
    '| Task | Agents | To take | Worked | Rounds, by step | Review steps (wait→review) | Rework waited | Checks failed |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...metrics.tasks.map(
      task =>
        `| ${task.task} | ${task.agents.join(', ') || '—'} | ${num(task.toTake)} | ${String(Math.round(task.worked * 10) / 10)} | ${byStepText(task.rounds)} | ${stepsText(task.steps)} | ${listed(task.reworkWaits)} | ${String(task.checks.failed)} of ${String(task.checks.run)} |`
    ),
    '',
    '| Agent | Joined | Stopped | Tasks | Completes | Checks failed | Refused | Waited for work | Reviews by step (changes), median | Calls | Read (≈tokens) | Harness read | Largest context | Read again (≥) |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...metrics.agents.map(
      agent =>
        `| ${agent.agent} | ${agent.joinedAt?.slice(11, 16) ?? '—'} | ${agent.stoppedAt?.slice(11, 16) ?? '—'} | ${agent.tasks.join(', ') || '—'} | ${String(agent.completes)} | ${String(agent.checks.failed)} of ${String(agent.checks.run)} | ${String(agent.refused)} | ${String(agent.waited)} | ${reviewsText(agent.reviews.byStep)}, ${num(agent.reviews.medianMinutes)} | ${String(agent.calls)} | ${tokensText(agent.readTokens)} | ${harnessCells(agent.harness)} |`
    ),
    '',
    `- Checks: ${String(checks.failed)} of ${String(checks.run)} failed (${String(rate)}%)${
      Object.keys(checks.byStep).length > 0
        ? ` — ${Object.entries(checks.byStep)
            .sort((a, b) => b[1] - a[1])
            .map(([step, times]) => `${step} ${String(times)}`)
            .join(', ')}`
        : ''
    }`,
    `- Refusals: ${String(refusals.total)}${
      Object.keys(refusals.byCode).length > 0
        ? ` — ${Object.entries(refusals.byCode)
            .map(
              ([code, each]) =>
                `${code} ${String(each.times)} (${each.by.join(', ')}${each.name ? `; ${each.name}` : ''})`
            )
            .join(' · ')}`
        : ''
    }`,
    `- Questions: ${String(questions.asked)} asked, ${String(questions.answered)} answered${questions.waits.length > 0 ? `, in ${questions.waits.join(', ')} min` : ''}`,
    '',
    '## Cost — what the CLI made the agents read',
    '',
    `${String(cost.calls)} commands printed ≈${tokensText(cost.readTokens)} tokens to the agents${cost.harness === undefined ? ' — no harness session was read for their rounds' : `; their harnesses read ${tokensText(cost.harness.processed)} in all, ${tokensText(cost.harness.reread)} of it results read again on later turns at the least`}.`,
    '',
    `The agents spent ${String(cost.cliMinutes)} min inside the CLI's commands, waits left out — every second there is theirs times their calls.`,
    '',
    ...(cost.byCommand.length > 0
      ? [
          '| Command | Calls | Time (s) | Median call (s) | Read (≈tokens) | Each |',
          '| --- | --- | --- | --- | --- | --- |',
          ...cost.byCommand
            .slice(0, 12)
            .map(
              each =>
                `| ${each.command} | ${String(each.calls)} | ${String(each.seconds)} | ${String(each.medianSeconds)}${each.overBudget === undefined ? '' : ` ⚠ over ${String(each.overBudget)}`} | ${tokensText(each.readTokens)} | ${tokensText(Math.round(each.readTokens / each.calls))} |`
            ),
          ''
        ]
      : []),
    ...(cost.repeated.length > 0
      ? [
          'Called again and again — the same command, by the same agent, within 10 minutes: a loop, or an answer it could not use.',
          '',
          ...cost.repeated
            .slice(0, 10)
            .map(each => `- ${each.by}: ${String(each.times)}× in ${String(each.within)} min — \`${each.command}\``),
          ''
        ]
      : [])
  ];
};
