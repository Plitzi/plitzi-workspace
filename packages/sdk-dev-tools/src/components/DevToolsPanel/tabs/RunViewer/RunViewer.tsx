import RunTaskRow from './RunTaskRow';

import type { RunSnapshot } from '@plitzi/sdk-shared/runs';

const hhmm = (iso: string): string => `${iso.slice(11, 16)} UTC`;

/**
 * The run of agents this preview serves (`plitzi run preview`): what the page is being built by — each task, who has it
 * and who reviews it, and what needs someone. The page shows the approved work as each task is approved; this says what
 * is coming. Read only: the run is worked from the terminal.
 */
const RunViewer = ({ snapshot }: { snapshot?: RunSnapshot }) => {
  if (!snapshot) {
    return (
      <div className="py-4 text-center text-xs text-zinc-400 italic dark:text-zinc-600">
        No run of agents behind this page: only a run's preview (npm run start:preview) has one
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 overflow-y-auto p-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
          <i className="fa-solid fa-people-group mr-2" />
          Run {snapshot.runId} · {snapshot.status}
        </span>
        <span className="text-zinc-700 dark:text-zinc-200">{snapshot.goal}</span>
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
          {snapshot.done} of {snapshot.total} tasks approved
          {snapshot.expectedEnd ? ` · expected end ${hhmm(snapshot.expectedEnd)}` : ''} · as of {hhmm(snapshot.at)}
        </span>
      </div>
      <div className="w-full overflow-hidden rounded border border-zinc-200 dark:border-zinc-700">
        {snapshot.tasks.map(task => (
          <RunTaskRow key={task.id} task={task} />
        ))}
      </div>
      {snapshot.attention.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
            Needs attention
          </span>
          {snapshot.attention.map(item => (
            <span key={item.text} className="text-[11px] text-amber-700 dark:text-amber-400">
              {item.who === 'person' ? '■' : '⚠'} {item.text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default RunViewer;
