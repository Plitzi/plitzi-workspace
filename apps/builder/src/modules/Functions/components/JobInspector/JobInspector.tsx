import Notice from '@pmodules/App/components/Notice';

import JobRun from './components/JobRun';
import { durationLabel, watchLabel } from '../../helpers';
import useJobs from '../../useJobs';
import InspectorSection from '../InspectorSection';

import type { ListedJob } from '../../helpers';

export type JobInspectorProps = {
  job: ListedJob;
};

/**
 * The selected job: how long it may run and who may watch it, as its code declares, and the space's runs of it — live
 * while one moves, with the Queue's controls on each.
 */
const JobInspector = ({ job }: JobInspectorProps) => {
  const { jobs, total, error, isLoading, control } = useJobs(job.saved ? job.name : '');
  const start = `ctx.jobs.start('${job.name}', input)`;
  const runsFor =
    job.maxSeconds === undefined ? 'As long as the plan allows' : `Up to ${durationLabel(job.maxSeconds)}`;
  const more = total - jobs.length;

  return (
    <aside className="flex w-80 shrink-0 flex-col overflow-auto border-l border-gray-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <header className="flex flex-col gap-1 border-b border-gray-200 px-4 py-4 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-200 flex size-6 shrink-0 items-center justify-center rounded-md">
            <i className="fa-solid fa-layer-group text-[11px]" />
          </span>
          <code className="truncate text-sm font-semibold text-gray-900 dark:text-zinc-50">{job.name}</code>
          {!job.saved && (
            <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
              Not saved
            </span>
          )}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-zinc-300">
          Long work of the space’s code: it runs on the server in slices, keeps what it saves, and can be paused.
        </p>
      </header>
      <InspectorSection title="Start it" hint="From a task or a route of these functions.">
        <code className="rounded-sm bg-gray-100 px-1.5 py-1 text-[11px] break-all text-gray-700 dark:bg-zinc-800 dark:text-zinc-300">
          {start}
        </code>
      </InspectorSection>
      <InspectorSection title="Runs for" hint="Every slice together — never past what the plan allows.">
        <span className="text-xs text-gray-700 dark:text-zinc-200">{runsFor}</span>
      </InspectorSection>
      <InspectorSection title="Who may watch it" hint="Its progress on a page: useJob(id), or a channel on $job:<id>.">
        <span className="text-xs text-gray-700 dark:text-zinc-200">{watchLabel(job.watch)}</span>
        {job.watch && <span className="text-[11px] text-gray-500 dark:text-zinc-400">And whoever started it.</span>}
      </InspectorSection>
      <InspectorSection title="Runs" hint="This space’s, newest first — live while one moves.">
        {error && <Notice tone="danger">{error}</Notice>}
        {!job.saved && (
          <span className="text-xs text-gray-500 dark:text-zinc-400">Save the code, and the code can start it.</span>
        )}
        {job.saved && !isLoading && jobs.length === 0 && !error && (
          <span className="text-xs text-gray-500 dark:text-zinc-400">
            Not started yet. A task or a route starts it with <code>{start}</code>.
          </span>
        )}
        {jobs.length > 0 && (
          <ul className="flex flex-col gap-2">
            {jobs.map(run => (
              <JobRun key={run.id} job={run} onControl={control} />
            ))}
          </ul>
        )}
        {more > 0 && (
          <span className="text-[11px] text-gray-500 dark:text-zinc-400">
            {`+ ${String(more)} older — every one is in the dashboard’s Queue.`}
          </span>
        )}
      </InspectorSection>
    </aside>
  );
};

export default JobInspector;
