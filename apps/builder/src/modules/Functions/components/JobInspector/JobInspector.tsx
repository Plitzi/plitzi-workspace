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
    <aside className="border-ui-line bg-ui-backdrop flex w-80 shrink-0 flex-col overflow-auto border-l">
      <header className="border-ui-line flex flex-col gap-1 border-b px-4 py-4">
        <div className="flex items-center gap-2">
          <span className="bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-200 flex size-6 shrink-0 items-center justify-center rounded-md">
            <i className="fa-solid fa-layer-group text-[11px]" />
          </span>
          <code className="text-ui-fg truncate text-sm font-semibold">{job.name}</code>
          {!job.saved && (
            <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
              Not saved
            </span>
          )}
        </div>
        <p className="text-ui-fg-muted mt-1 text-xs leading-relaxed">
          Long work of the space’s code: it runs on the server in slices, keeps what it saves, and can be paused.
        </p>
      </header>
      <InspectorSection title="Start it" hint="From a task or a route of these functions.">
        <code className="bg-ui-raised text-ui-fg rounded-sm px-1.5 py-1 text-[11px] break-all">{start}</code>
      </InspectorSection>
      <InspectorSection title="Runs for" hint="Every slice together — never past what the plan allows.">
        <span className="text-ui-fg text-xs">{runsFor}</span>
      </InspectorSection>
      <InspectorSection title="Who may watch it" hint="Its progress on a page: useJob(id), or a channel on $job:<id>.">
        <span className="text-ui-fg text-xs">{watchLabel(job.watch)}</span>
        {job.watch && <span className="text-ui-fg-subtle text-[11px]">And whoever started it.</span>}
      </InspectorSection>
      <InspectorSection title="Runs" hint="This space’s, newest first — live while one moves.">
        {error && <Notice tone="danger">{error}</Notice>}
        {!job.saved && <span className="text-ui-fg-subtle text-xs">Save the code, and the code can start it.</span>}
        {job.saved && !isLoading && jobs.length === 0 && !error && (
          <span className="text-ui-fg-subtle text-xs">
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
          <span className="text-ui-fg-subtle text-[11px]">
            {`+ ${String(more)} older — every one is in the dashboard’s Queue.`}
          </span>
        )}
      </InspectorSection>
    </aside>
  );
};

export default JobInspector;
