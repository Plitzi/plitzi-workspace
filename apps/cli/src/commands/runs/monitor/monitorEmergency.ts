import { clip, wrap } from './monitorCanvas';
import { raise } from './monitorDialogs';
import { allowAgents, holdAgents } from '../../../runs/agents/holdAgents';
import { ensureKeeper } from '../../../runs/agents/keeper';
import { resumeRun, stopRun } from '../../../runs/run';

import type { Key, Shown, Step } from './monitorInput';
import type { Dialog, MonitorUi, Paint } from './monitorModel';
import type { RunContext } from '../../../runs/run';
import type { Monitored } from '../../../runs/view/monitor';

/**
 * The emergency panel (`!`): what the person reaches for when the run goes wrong — a harness past its limit, agents
 * ending as they start, one stuck — without leaving the monitor (Carlos: "un panel de emergencia… pausar todo o
 * reanudar todo, tumbar agentes"). Each action is the command's own: `run stop`, `run resume`, `run hold`, `run allow`.
 */

/** What a row of the panel does. */
export type EmergencyAction =
  | { kind: 'pause' }
  | { kind: 'resume' }
  /** No agent named: every one — held, or allowed. */
  | { kind: 'hold'; agent?: string }
  | { kind: 'allow'; agent?: string };

export interface EmergencyRow {
  label: string;
  /** What it is at now, beside it: an agent's status and what it does. */
  about?: string;
  action: EmergencyAction;
  /** What stops work asks a second ⏎ on the same row: a slip of the key never pauses a run. */
  confirms: boolean;
}

/** The panel's rows: the run paused or resumed, the held let go, every agent stopped — then each agent, its own. */
export const emergencyRows = (data: Monitored): EmergencyRow[] => {
  const { view } = data;
  const held = Object.keys(view.held);
  const agents = data.agents.filter(each => each.kind === 'agent');
  const holdable = agents.filter(each => !held.includes(each.agent));

  return [
    view.status === 'open'
      ? {
          label: 'Pause the run — the tasks in hand finish and go to review, none starts',
          action: { kind: 'pause' as const },
          confirms: true
        }
      : {
          label: `Resume the run — it is ${view.status}: tasks can be taken, the keeper starts the agents`,
          action: { kind: 'resume' as const },
          confirms: false
        },
    ...(held.length > 0
      ? [
          {
            label: `Let every held agent start again — ${held.join(', ')}`,
            action: { kind: 'allow' as const },
            confirms: false
          }
        ]
      : []),
    ...(holdable.length > 0
      ? [
          {
            label: 'Stop every agent now and hold them — what they hold stays in their hands, their copies as they are',
            action: { kind: 'hold' as const },
            confirms: true
          }
        ]
      : []),
    ...agents.map(each =>
      held.includes(each.agent)
        ? {
            label: `${each.agent} · allow it`,
            about: view.held[each.agent],
            action: { kind: 'allow' as const, agent: each.agent },
            confirms: false
          }
        : {
            // One not running is held alone: nothing of it is stopped, the run only starts it no more.
            label: `${each.agent} · ${each.status === 'not-started' || each.status === 'stopped' ? 'hold it' : 'stop and hold it'}`,
            about: `${each.status} — ${each.doing}`,
            action: { kind: 'hold' as const, agent: each.agent },
            confirms: true
          }
    )
  ];
};

type EmergencyDialog = Extract<Dialog, { kind: 'emergency' }>;

/** ↑ ↓ a row, ⏎ does it — what stops work at the second ⏎ on the same row — esc closes. */
export const inEmergency = (ui: MonitorUi, dialog: EmergencyDialog, key: Key | undefined, shown: Shown): Step => {
  const rows = shown.data ? emergencyRows(shown.data) : [];
  const at = Math.min(dialog.at, Math.max(0, rows.length - 1));
  if (key?.name === 'escape') {
    return { ui: { ...ui, dialog: undefined }, effects: [] };
  }

  if (key?.name === 'down' || key?.name === 'up') {
    const moved = rows.length === 0 ? 0 : (at + (key.name === 'down' ? 1 : rows.length - 1)) % rows.length;

    return { ui: { ...ui, dialog: { kind: 'emergency', at: moved } }, effects: [] };
  }

  const row = rows.at(at);
  if (key?.name !== 'return' || !row) {
    return { ui, effects: [] };
  }

  if (row.confirms && dialog.armed !== at) {
    return { ui: { ...ui, dialog: { kind: 'emergency', at, armed: at }, flash: '⏎ again to do it' }, effects: [] };
  }

  return { ui: { ...ui, dialog: { kind: 'emergency', at } }, effects: [{ kind: 'emergency', action: row.action }] };
};

/** The panel: where the run stands and who is held, why — then the rows, the chosen one marked. */
export const drawEmergencyDialog = (p: Paint, data: Monitored, dialog: EmergencyDialog): void => {
  const { canvas, theme } = p;
  const rows = emergencyRows(data);
  const held = Object.entries(data.view.held);
  const width = Math.min(110, canvas.width - 4);
  const heldLines = held.flatMap(([agent, why]) => wrap(`${agent} — ${why}`, width - 10));
  const frame = raise(
    p,
    width,
    rows.length + heldLines.length + (held.length > 0 ? 9 : 8),
    'Emergency · ↑ ↓ choose · ⏎ do it (twice to stop work)'
  );
  let row = frame.top + 3;
  const status = `The run is ${data.view.status}${held.length > 0 ? ` · ${String(held.length)} held — the run starts none of them` : ' · nobody held'}`;
  canvas.put(row, frame.left + 3, clip(status, frame.width - 6), {
    fg: data.view.status === 'open' && held.length === 0 ? theme.text : theme.warning,
    bold: true
  });
  row += 1;
  for (const line of heldLines) {
    canvas.put(row, frame.left + 5, clip(line, frame.width - 8), { fg: theme.muted });
    row += 1;
  }

  row += 1;
  rows.forEach((each, index) => {
    const chosen = index === Math.min(dialog.at, rows.length - 1);
    const armed = dialog.armed === index;
    let col = canvas.put(row, frame.left + 3, chosen ? '▸ ' : '  ', { fg: theme.link, bold: true });
    col = canvas.put(row, col, clip(each.label, frame.width - 8), {
      fg: armed ? theme.danger : chosen ? theme.link : theme.text,
      bold: chosen
    });
    if (armed) {
      canvas.right(row, frame.left + frame.width - 3, '⏎ again', { fg: theme.danger, bold: true });
    } else if (each.about !== undefined) {
      canvas.put(row, col + 2, clip(each.about, Math.max(0, frame.left + frame.width - col - 6)), {
        fg: theme.subtle
      });
    }

    row += 1;
  });
  canvas.put(
    frame.top + frame.height - 2,
    frame.left + 3,
    clip(
      'The same as plitzi run stop · run resume · run hold · run allow — said in the run’s log, and to the lead',
      frame.width - 6
    ),
    { fg: theme.subtle }
  );
};

/** What the panel asked, done as its command does it — and said, for the panel's flash. */
export const runEmergency = async (ctx: RunContext, runId: string, action: EmergencyAction): Promise<string> => {
  switch (action.kind) {
    case 'pause':
      await stopRun(ctx, runId, false, 'paused from the monitor');

      return 'paused: the tasks in hand finish and go to review, none starts — ! resumes it';
    case 'resume': {
      await resumeRun(ctx, runId);
      const keeper = await ensureKeeper(ctx, runId);

      return `resumed: tasks can be taken${'none' in keeper ? ` — no keeper (${keeper.none}): start the agents yourself` : ''}`;
    }
    case 'hold': {
      const done = await holdAgents(ctx, runId, action.agent === undefined ? [] : [action.agent]);
      const held = done.held.map(each => each.agent);

      return held.length > 0
        ? `stopped and held: ${held.join(', ')} — the run starts them no more until allowed`
        : `held already: ${done.already.join(', ')}`;
    }
    case 'allow': {
      const done = await allowAgents(ctx, runId, action.agent === undefined ? [] : [action.agent]);

      return done.allowed.length > 0
        ? `allowed: ${done.allowed.map(each => each.agent).join(', ')} — the keeper starts them as the run asks`
        : 'nothing was held';
    }
  }
};
