import { allowAgents, holdAgents } from '../../../runs/agents/holdAgents';
import { holdReason } from '../../../runs/agents/startHold';
import { act, runOf } from '../shell';

import type { RunCommandOptions } from '../shell';

/**
 * `plitzi run hold` / `plitzi run allow`: agents of the run stopped and held — the lead's or a person's — and let start
 * again, each said.
 */

export const runHold = (agents: string[], options: RunCommandOptions): Promise<void> =>
  act(
    options,
    async ctx => holdAgents(ctx, await runOf(ctx, options), agents),
    done =>
      [
        ...done.held.map(
          each =>
            `${each.agent}: ${each.ended ? 'stopped' : 'was not running'}, and held — ${each.holds.length > 0 ? `${each.holds.join(', ')} ${each.holds.length === 1 ? 'stays' : 'stay'} in its hands, its copy as it is` : 'it holds no task'}`
        ),
        ...(done.already.length > 0 ? [`Held already: ${done.already.join(', ')}`] : []),
        done.held.length > 0
          ? `The run starts ${done.held.length === 1 ? 'it' : 'them'} no more until allowed: plitzi run allow ${done.held.map(each => each.agent).join(' ')}`
          : 'Nothing changed.'
      ].join('\n')
  );

export const runAllow = (agents: string[], options: RunCommandOptions): Promise<void> =>
  act(
    options,
    async ctx => allowAgents(ctx, await runOf(ctx, options), agents),
    done =>
      [
        ...done.allowed.map(
          hold =>
            `${hold.agent} may start again — it was ${holdReason(hold)}${hold.why === 'quick-ends' ? ': one more try, held again if it ends as it starts' : ''}`
        ),
        ...(done.notHeld.length > 0 ? [`Not held: ${done.notHeld.join(', ')}`] : []),
        done.allowed.length > 0
          ? `The run's keeper starts ${done.allowed.length === 1 ? 'it' : 'them'} as the run asks for ${done.allowed.length === 1 ? 'it' : 'them'}.`
          : agents.length === 0
            ? 'Nothing is held: the run starts its agents as it asks.'
            : 'Nothing changed.'
      ].join('\n')
  );
