import chalk from 'chalk';

import { HARNESSES } from '../../../runs/agents/agentPrompt';
import { harnessOf, launchAgent, launchHarness, promptAgent } from '../../../runs/agents/launchAgent';
import { readTeam } from '../../../runs/agents/team';
import { act, runOf } from '../shell';

import type { NoResume } from '../../../runs/agents/launch';
import type { RunCommandOptions } from '../shell';

/**
 * `plitzi run agent <name>`: an agent of the run's team, started — its prompt written in its scratch, and the command
 * line that starts it headless in a harness; with `--launch`, started now, its output kept beside its prompt. What
 * every lead wrote by hand for each agent of each run, and a person new to Plitzi had no way to.
 */

export interface AgentOptions extends RunCommandOptions {
  harness?: string;
  launch?: boolean;
}

/** Why an agent the team asks to resume started on a fresh session, said — nothing when the team does not ask it. */
const freshSaid = (fresh: { not: NoResume; bytes?: number }): string[] => {
  const why: Record<NoResume, string | undefined> = {
    'not-asked': undefined,
    harness: 'its harness keeps no session to resume (Claude Code does)',
    'no-session': 'its last launch kept no session',
    'not-mid-task': 'it was not cut off mid-task',
    gone: 'its session is no longer there',
    'too-large': `its session is ${String(Math.round((fresh.bytes ?? 0) / 1024 / 1024))} MB — reading it again would cost more than starting over`
  };
  const said = why[fresh.not];

  return said === undefined || fresh.not === 'not-mid-task' ? [] : [chalk.yellow(`  On a fresh session: ${said}.`)];
};

export const runAgent = (agent: string, options: AgentOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      const runId = await runOf(ctx, options);

      // The team's own harness unless another is named: a run's lead was refused "Which harness" for one team.json named.
      const harness = launchHarness(options.harness, await readTeam(ctx.root).catch(() => undefined));

      return options.launch ? launchAgent(ctx, runId, agent, await harnessOf(harness)) : promptAgent(ctx, runId, agent);
    },
    answer =>
      'running' in answer
        ? `${answer.agent} runs already (pid ${String(answer.running.pid)}, ${answer.running.harness}, started ${answer.running.startedAt}): it goes on by itself — nothing started. To start it over: kill ${String(answer.running.pid)}, then this again.`
        : 'launched' in answer
          ? [
              chalk.green(
                `${answer.agent} started in ${answer.launched.harness} (pid ${String(answer.launched.pid)})${answer.model ? ` on ${answer.model}` : ''}${answer.effort ? `, ${answer.effort} effort` : ''}: it works until task next tells it to stop.`
              ),
              ...(answer.modelNotRun
                ? [
                    chalk.yellow(
                      `  The team names ${answer.modelNotRun}, which ${answer.launched.harness} does not run: it started on ${answer.launched.harness}'s own default (.plitzi/team.json, or --harness)`
                    )
                  ]
                : []),
              ...(answer.resumed && answer.rework
                ? [
                    `  It reworks ${answer.rework} in the session it worked it in (${answer.resumed}): what it read and knew of it, kept.`
                  ]
                : answer.resumed
                  ? [
                      `  It resumes its own session (${answer.resumed}): it went down mid-task, and goes on where it was.`
                    ]
                  : answer.fresh
                    ? freshSaid(answer.fresh)
                    : []),
              `  Its output: ${answer.launched.log} — its prompt: ${answer.promptFile}`,
              `  Follow the run: plitzi run monitor ${answer.runId} (a person) · plitzi run watch ${answer.runId} (the lead)`
            ].join('\n')
          : [
              `${answer.agent}'s prompt for run "${answer.runId}": ${answer.promptFile}`,
              '  Start it as a subagent of your harness with that prompt — or headless, in a terminal of its own:',
              ...('commands' in answer ? answer.commands : []).map(each => `    ${each.line}`),
              `  …or let the CLI start it: plitzi run agent ${answer.agent} --launch --harness <${HARNESSES.join('|')}>`
            ].join('\n')
  );
