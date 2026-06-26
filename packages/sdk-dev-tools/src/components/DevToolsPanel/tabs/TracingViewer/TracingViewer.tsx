import { useCallback, useMemo, useState } from 'react';

import { useCommonStore } from '@plitzi/sdk-shared/store';
import { useTracing } from '@plitzi/sdk-shared/store/tracing';

import CommitStrip from './components/CommitStrip';
import Flamegraph from './components/Flamegraph';
import RankedList from './components/RankedList';
import TracingToolbar from './components/TracingToolbar';
import { buildFlameModel } from './helpers';
import useHighlightElement from './useHighlightElement';

import type { TracingView } from './helpers';
import type { KeyboardEvent } from 'react';

const TracingViewer = () => {
  const { enabled, commits, tree, clear } = useTracing();
  const [flat] = useCommonStore('schema.flat');
  const [view, setView] = useState<TracingView>('ranked');
  const [selectedCommitId, setSelectedCommitId] = useState<number | undefined>();
  // The element picked in either view: drives the shared sidebar and outlines it on the page.
  const [selectedElementId, setSelectedElementId] = useState<string | undefined>();

  const selectedIndex = useMemo(() => {
    if (commits.length === 0) {
      return -1;
    }

    const found = commits.findIndex(commit => commit.commitId === selectedCommitId);

    return found === -1 ? commits.length - 1 : found;
  }, [commits, selectedCommitId]);
  const selectedCommit = selectedIndex === -1 ? undefined : commits[selectedIndex];

  // The full render-tree model for the selected commit, reused by both views (built once here).
  const model = useMemo(
    () => (selectedCommit ? buildFlameModel(selectedCommit, tree, flat) : undefined),
    [selectedCommit, tree, flat]
  );

  // No preselection: the sidebar/outline only appear for an explicit pick (undefined ⇒ nothing selected).
  const active = useMemo(() => model?.nodes.find(node => node.id === selectedElementId), [model, selectedElementId]);
  useHighlightElement(active?.id);

  const handleSelectCommit = useCallback((commitId: number) => setSelectedCommitId(commitId), []);
  const handleSelectElement = useCallback((id: string | undefined) => setSelectedElementId(id), []);
  const handleStepCommit = useCallback(
    (delta: number) => {
      const next = selectedIndex + delta;
      if (next >= 0 && next < commits.length) {
        setSelectedCommitId(commits[next].commitId);
      }
    },
    [commits, selectedIndex]
  );

  // ←/→ steps commits from anywhere focus lands inside the tab (the views let these keys bubble up here), not just on
  // the commit strip.
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
        return;
      }

      event.preventDefault();
      handleStepCommit(event.key === 'ArrowLeft' ? -1 : 1);
    },
    [handleStepCommit]
  );

  if (!enabled) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-zinc-400 dark:text-zinc-500">
        <i className="fa-solid fa-gauge-high text-3xl opacity-20" />
        <span className="text-xs">Enable debugMode to record render tracing</span>
      </div>
    );
  }

  if (!selectedCommit || !model) {
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
    <div className="flex h-full min-h-0 w-full flex-col" onKeyDown={handleKeyDown}>
      <TracingToolbar view={view} commitCount={commits.length} onClear={clear} onViewChange={setView} />
      <CommitStrip commits={commits} selectedIndex={selectedIndex} onSelect={handleSelectCommit} />
      {view === 'ranked' && (
        <RankedList commit={selectedCommit} model={model} active={active} onSelectElement={handleSelectElement} />
      )}
      {view === 'flamegraph' && (
        <Flamegraph commit={selectedCommit} model={model} active={active} onSelectElement={handleSelectElement} />
      )}
    </div>
  );
};

export default TracingViewer;
