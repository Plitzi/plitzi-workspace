import type { RunMetrics } from './runMetrics';

/**
 * A run's metrics, as its report reads them (`runMetrics.ts`): where its time went, task by task and agent by agent;
 * what failed, by step and by code; and what it cost — what the CLI printed to each agent, and the calls repeated.
 */

const num = (value: number | undefined): string => (value === undefined ? '—' : String(value));
const listed = (values: readonly number[]): string => (values.length === 0 ? '—' : values.join(', '));
const tokensText = (value: number): string =>
  value >= 1000 ? `${String(Math.round(value / 100) / 10)}k` : String(value);

export const flowText = (metrics: RunMetrics): string[] => {
  const { checks, refusals, questions, cost } = metrics;
  const rate = checks.run === 0 ? 0 : Math.round((checks.failed / checks.run) * 100);

  return [
    '## Flow — where the time went',
    '',
    ...(metrics.workMinutes === undefined
      ? []
      : [
          `Worked ${String(metrics.workMinutes)} min, from the open to every task approved; then ${num(metrics.afterMinutes)} min to this report (the finish is a person's).`,
          ''
        ]),
    'Minutes. Waits for a review count from when it was sent; for the lead, from the UI approved (or sent, with none); a rework, from the changes asked to an agent at it again.',
    '',
    '| Task | Agents | To take | Worked | Rounds UI / lead | Waited for UI | UI review | Waited for lead | Rework waited | Checks failed | Handed off |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...metrics.tasks.map(
      task =>
        `| ${task.task} | ${task.agents.join(', ') || '—'} | ${num(task.toTake)} | ${String(Math.round(task.worked * 10) / 10)} | ${String(task.rounds.ui)} / ${String(task.rounds.lead)} | ${listed(task.uiWaits)} | ${listed(task.uiReviews)} | ${listed(task.leadWaits)} | ${listed(task.reworkWaits)} | ${String(task.checks.failed)} of ${String(task.checks.run)} | ${String(task.handOffs)} |`
    ),
    '',
    '| Agent | Joined | Stopped | Tasks | Completes | Checks failed | Refused | Waited for work | Reviews UI (changes) / lead (changes), median | Calls | Read (≈tokens) | Harness tokens |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...metrics.agents.map(
      agent =>
        `| ${agent.agent} | ${agent.joinedAt?.slice(11, 16) ?? '—'} | ${agent.stoppedAt?.slice(11, 16) ?? '—'} | ${agent.tasks.join(', ') || '—'} | ${String(agent.completes)} | ${String(agent.checks.failed)} of ${String(agent.checks.run)} | ${String(agent.refused)} | ${String(agent.waited)} | ${String(agent.reviews.ui)} (${String(agent.reviews.uiChanges)}) / ${String(agent.reviews.lead)} (${String(agent.reviews.leadChanges)}), ${num(agent.reviews.medianMinutes)} | ${String(agent.calls)} | ${tokensText(agent.readTokens)} | ${agent.tokens === undefined ? '—' : tokensText(agent.tokens)} |`
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
                `${code} ${String(each.times)} (${each.by.join(', ')}${each.command ? `; ${each.command}` : ''})`
            )
            .join(' · ')}`
        : ''
    }`,
    `- Questions: ${String(questions.asked)} asked, ${String(questions.answered)} answered${questions.waits.length > 0 ? `, in ${questions.waits.join(', ')} min` : ''}`,
    `- Reworks handed to a free agent: ${String(metrics.handOffs)}`,
    '',
    '## Cost — what the CLI made the agents read',
    '',
    `${String(cost.calls)} commands printed ≈${tokensText(cost.readTokens)} tokens to the agents${cost.tokens === undefined ? ' — the harness’s own count was not said (plitzi run report --tokens agent=count,…)' : `; the harness counted ${tokensText(cost.tokens)} in all`}.`,
    '',
    ...(cost.byCommand.length > 0
      ? [
          '| Command | Calls | Read (≈tokens) | Each |',
          '| --- | --- | --- | --- |',
          ...cost.byCommand
            .slice(0, 12)
            .map(
              each =>
                `| ${each.command} | ${String(each.calls)} | ${tokensText(each.readTokens)} | ${tokensText(Math.round(each.readTokens / each.calls))} |`
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
