import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import { useCallback, useMemo, useState } from 'react';

import { cancelActionRun, useActionRuns, useCommonStore } from '@plitzi/sdk-shared/store';

import ActionsToolbar from './components/ActionsToolbar';
import DetailShell from './components/DetailShell';
import RunDetail from './components/RunDetail';
import RunList from './components/RunList';
import { filterRuns, isLive } from './helpers';

import type { RunFilter } from './helpers';

const NO_SERVER = 'This page is served without a Plitzi server: every action step is inert';

/**
 * Every server action this page caused, including the ones it never asked for.
 *
 * A `detached` run has no answer to await and a `stream` returns before its frames arrive, so neither leaves a trace
 * anywhere else; a `render` run happened before the page existed in the browser. What each shows beyond its own
 * outcome is what the server was willing to send — the steps to a page allowed to debug them, and what those steps
 * read and answered only to an authoring session or a dev server.
 */
const ActionsViewer = () => {
  const { runs, clear } = useActionRuns();
  const [endpoint] = useCommonStore('actions.endpoint');
  const [filter, setFilter] = useStorage<RunFilter>('plitzi-sdk.dev-tools.actions.filter', 'all');
  const [query, setQuery] = useState('');
  const [selectedRunId, setSelectedRunId] = useState<string | undefined>();
  const [selectedStepId, setSelectedStepId] = useState<string | undefined>();

  const visible = useMemo(() => filterRuns(runs, filter, query), [runs, filter, query]);
  const liveCount = useMemo(() => runs.filter(isLive).length, [runs]);
  // By id rather than by index: the log is capped and a new run shifts every position in it.
  const selected = useMemo(() => runs.find(run => run.id === selectedRunId), [runs, selectedRunId]);

  // Picking another run drops the picked step with it: a step belongs to the run it ran in.
  const handleSelectRun = useCallback((runId: string) => {
    setSelectedRunId(current => (current === runId ? undefined : runId));
    setSelectedStepId(undefined);
  }, []);

  const handleSelectStep = useCallback((stepId: string) => {
    setSelectedStepId(current => (current === stepId ? undefined : stepId));
  }, []);

  const handleCancel = useCallback((runId: string) => cancelActionRun(runId), []);

  const handleClear = useCallback(() => {
    clear();
    setSelectedRunId(undefined);
    setSelectedStepId(undefined);
  }, [clear]);

  return (
    <div className="flex h-full w-full flex-col">
      <ActionsToolbar
        filter={filter}
        query={query}
        liveCount={liveCount}
        runCount={runs.length}
        onFilterChange={setFilter}
        onQueryChange={setQuery}
        onClear={handleClear}
      />
      {endpoint === undefined && (
        <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
          {NO_SERVER}
        </div>
      )}
      <div className="flex min-h-0 grow">
        <RunList
          runs={visible}
          total={runs.length}
          selectedRunId={selectedRunId}
          onSelect={handleSelectRun}
          onCancel={handleCancel}
        />
        {selected !== undefined && (
          <DetailShell>
            <RunDetail run={selected} selectedStepId={selectedStepId} onSelectStep={handleSelectStep} />
          </DetailShell>
        )}
      </div>
    </div>
  );
};

export default ActionsViewer;
