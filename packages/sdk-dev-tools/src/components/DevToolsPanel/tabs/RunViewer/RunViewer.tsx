import clsx from 'clsx';
import { Fragment } from 'react';

import RunTaskRow from './RunTaskRow';

import type { RunSnapshot, RunSnapshotAgent, RunSnapshotTask } from '@plitzi/sdk-shared/runs';
import type { ReactNode } from 'react';

const hhmm = (iso: string): string => `${iso.slice(11, 16)} UTC`;

/** The tasks by where they stand, in the order a person reads a run: what moves first, the approved — done — last. */
const GROUPS: { label: string; statuses: string[] }[] = [
  { label: 'At work', statuses: ['in-progress', 'changes-requested', 'waiting'] },
  { label: 'In review', statuses: ['in-review'] },
  { label: 'Blocked', statuses: ['blocked', 'failed'] },
  { label: 'To do', statuses: ['ready', 'pending'] },
  { label: 'Approved', statuses: ['done'] }
];
const GROUPED = new Set(GROUPS.flatMap(group => group.statuses));

const AGENT_TONE: Record<string, string> = {
  working: 'bg-sky-500',
  reviewing: 'bg-violet-500',
  blocked: 'bg-amber-500',
  asking: 'bg-amber-400',
  waiting: 'bg-sky-300',
  'no-signal': 'bg-red-500'
};

const Section = ({ title, count, children }: { title: string; count?: number; children?: ReactNode }) => (
  <section className="flex min-w-0 flex-col gap-1">
    <h3 className="text-[10px] font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
      <span>
        {title}
        {count !== undefined && <span className="ml-1 font-normal">({count})</span>}
      </span>
    </h3>
    {children}
  </section>
);

const Rows = ({ children }: { children: ReactNode }) => (
  <div className="w-full overflow-hidden rounded border border-zinc-200 dark:border-zinc-700">{children}</div>
);

const AgentRow = ({ agent }: { agent: RunSnapshotAgent }) => (
  <div className="flex items-center gap-2 px-2 py-1">
    <span
      className={clsx('h-2 w-2 shrink-0 rounded-full', AGENT_TONE[agent.status] ?? 'bg-zinc-300 dark:bg-zinc-600')}
      title={agent.status}
    />
    <span className="w-20 shrink-0 font-medium">{agent.agent}</span>
    <span className="w-28 shrink-0 truncate text-[10px] text-zinc-400">{agent.model ?? 'harness model'}</span>
    <span className="min-w-0 grow truncate text-zinc-600 dark:text-zinc-300">{agent.doing}</span>
  </div>
);

/**
 * The run of agents this preview serves (`plitzi run preview`): what the page is being built by — how far it is, each
 * task by where it stands, who has it and who reviews it, every agent, and what happened last. The page shows the
 * approved work as each task is approved; this says what is coming. Read only: the run is worked from the terminal.
 */
const RunViewer = ({ snapshot }: { snapshot?: RunSnapshot }) => {
  if (!snapshot) {
    return (
      <div className="py-4 text-center text-xs text-zinc-400 italic dark:text-zinc-600">
        No run of agents behind this page: only a run's preview (npm run start:preview) has one
      </div>
    );
  }

  const percent = snapshot.total === 0 ? 0 : Math.round((snapshot.done / snapshot.total) * 100);
  // A status this tab does not know yet (a newer CLI's) is listed apart, never dropped.
  const byGroup = [
    ...GROUPS.map(group => ({
      label: group.label,
      tasks: snapshot.tasks.filter((task: RunSnapshotTask) => group.statuses.includes(task.status))
    })),
    { label: 'Other', tasks: snapshot.tasks.filter(task => !GROUPED.has(task.status)) }
  ].filter(group => group.tasks.length > 0);
  const feed = snapshot.feed ?? [];

  return (
    <div className="@container flex h-full min-h-0 w-full flex-col gap-3 overflow-y-auto p-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-semibold">
            <i className="fa-solid fa-people-group mr-2 text-violet-500" />
            {snapshot.runId}
            <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 uppercase dark:bg-zinc-800 dark:text-zinc-400">
              {snapshot.status}
            </span>
          </span>
          <span className="shrink-0 text-[10px] text-zinc-400">as of {hhmm(snapshot.at)}</span>
        </div>
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{snapshot.goal}</span>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Tasks approved"
        >
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${String(percent)}%` }} />
        </div>
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
          {snapshot.done} of {snapshot.total} tasks approved
          {snapshot.expectedEnd ? ` · expected end ${hhmm(snapshot.expectedEnd)}` : ''}
        </span>
      </div>

      {/* Side by side when the panel is wide: the tasks, and who is at work. */}
      <div className="grid grid-cols-1 items-start gap-3 @2xl:grid-cols-2">
        {snapshot.tasks.length > 0 && (
          <Section title="Tasks" count={snapshot.tasks.length}>
            {/* Eight rows tall below its group's heading, scrolled on its own: a long run does not push the agents and the activity down. */}
            <div className="max-h-62 w-full overflow-y-auto rounded border border-zinc-200 dark:border-zinc-700">
              {byGroup.map(group => (
                <Fragment key={group.label}>
                  <div className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500">
                    {group.label} <span className="font-normal">({group.tasks.length})</span>
                  </div>
                  {group.tasks.map(task => (
                    <RunTaskRow key={task.id} task={task} />
                  ))}
                </Fragment>
              ))}
            </div>
          </Section>
        )}
        {/* Who is at work, and below it what needs someone. */}
        <div className="flex min-w-0 flex-col gap-3">
          {snapshot.agents && snapshot.agents.length > 0 && (
            <Section title="Agents" count={snapshot.agents.length}>
              <Rows>
                {snapshot.agents.map(agent => (
                  <AgentRow key={agent.agent} agent={agent} />
                ))}
              </Rows>
            </Section>
          )}
          {snapshot.attention.length > 0 && (
            <Section title="Needs attention" count={snapshot.attention.length}>
              {/* As tall as a few notices, scrolled on its own: a long one, or many, never push the activity away. */}
              <div className="flex max-h-48 flex-col gap-1 overflow-y-auto pr-1">
                {snapshot.attention.map(item => (
                  <span
                    key={item.text}
                    className="shrink-0 rounded-r border-l-2 border-amber-500 bg-amber-50 px-2 py-1 text-[11px] break-words text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                  >
                    {item.text}
                  </span>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>

      {feed.length > 0 && (
        // The room left under the run, grown with the panel: the newest first, scrolled on its own.
        <section className="flex min-h-32 flex-1 flex-col gap-1">
          <h3 className="text-[10px] font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
            Activity <span className="ml-1 font-normal">({feed.length})</span>
          </h3>
          <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto rounded border border-zinc-200 p-1.5 dark:border-zinc-700">
            {feed.map(event => (
              <div key={`${event.at}-${event.by}-${event.text}`} className="flex gap-2 text-[11px]">
                <span className="shrink-0 text-zinc-400">{event.at.slice(11, 16)}</span>
                <span className="w-24 shrink-0 truncate font-medium">{event.by}</span>
                <span
                  className={clsx(
                    'min-w-0 grow',
                    event.kind === 'problem' ? 'text-red-600 dark:text-red-400' : 'text-zinc-600 dark:text-zinc-300'
                  )}
                  title={event.detail}
                >
                  {event.text}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default RunViewer;
