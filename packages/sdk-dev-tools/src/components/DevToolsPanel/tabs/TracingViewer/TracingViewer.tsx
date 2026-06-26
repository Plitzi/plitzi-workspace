import { useCallback, useMemo, useState } from 'react';

import { useCommonStore } from '@plitzi/sdk-shared/store';
import { useTracing } from '@plitzi/sdk-shared/store/tracing';

import CommitStrip from './components/CommitStrip';
import Flamegraph from './components/Flamegraph';
import RankedList from './components/RankedList';
import TracingToolbar from './components/TracingToolbar';

import type { TracingView } from './helpers';

const TracingViewer = () => {
  const { enabled, commits, clear } = useTracing();
  const [flat] = useCommonStore('schema.flat');
  const [view, setView] = useState<TracingView>('ranked');
  const [selectedCommitId, setSelectedCommitId] = useState<number | undefined>();

  const selectedIndex = useMemo(() => {
    if (commits.length === 0) {
      return -1;
    }

    const found = commits.findIndex(commit => commit.commitId === selectedCommitId);

    return found === -1 ? commits.length - 1 : found;
  }, [commits, selectedCommitId]);
  const selectedCommit = selectedIndex === -1 ? undefined : commits[selectedIndex];

  const handleSelectCommit = useCallback((commitId: number) => setSelectedCommitId(commitId), []);

  if (!enabled) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-zinc-400 dark:text-zinc-500">
        <i className="fa-solid fa-gauge-high text-3xl opacity-20" />
        <span className="text-xs">Enable debugMode to record render tracing</span>
      </div>
    );
  }

  if (!selectedCommit) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col">
        <TracingToolbar view={view} commitCount={commits.length} onClear={clear} onViewChange={setView} />
        <div className="flex grow flex-col items-center justify-center gap-2 text-zinc-400 dark:text-zinc-500">
          <i className="fa-solid fa-chart-column text-3xl opacity-20" />
          <span className="text-xs">No commits recorded yet — interact with the page</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <TracingToolbar view={view} commitCount={commits.length} onClear={clear} onViewChange={setView} />
      <CommitStrip commits={commits} selectedIndex={selectedIndex} onSelect={handleSelectCommit} />
      {view === 'ranked' && <RankedList commit={selectedCommit} flat={flat} />}
      {view === 'flamegraph' && <Flamegraph commit={selectedCommit} flat={flat} />}
    </div>
  );
};

export default TracingViewer;
