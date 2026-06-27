import { useCallback, useMemo, useState } from 'react';

import { useCommonStore } from '@plitzi/sdk-shared/store';
import { useTracing } from '@plitzi/sdk-shared/store/tracing';

import CommitStrip from './components/CommitStrip';
import Flamegraph from './components/Flamegraph';
import HotspotsList from './components/HotspotsList';
import RankedList from './components/RankedList';
import TracingToolbar from './components/TracingToolbar';
import { buildFlameModel, commitOrigin, SSR_COMMIT_ID } from './helpers';
import useHighlightElement from './useHighlightElement';

import type { TracingView } from './helpers';
import type { CommitEntry } from '@plitzi/sdk-shared';
import type { KeyboardEvent } from 'react';

const TracingViewer = () => {
  const { enabled, hydrated, commits, tree, clear } = useTracing();
  const [flat] = useCommonStore('schema.flat');
  const [view, setView] = useState<TracingView>('ranked');
  const [selectedCommitId, setSelectedCommitId] = useState<number | undefined>();
  // The element picked in either view: drives the shared sidebar and outlines it on the page.
  const [selectedElementId, setSelectedElementId] = useState<string | undefined>();

  // Synthetic SSR baseline: when the app hydrated, the server rendered the tree FIRST, but React's Profiler emits
  // nothing for that pass — so we prepend a marker commit (#0) for it. That makes the first real client commit read
  // clearly as the hydration OF that server render, instead of looking like a from-scratch client mount.
  const ssrCommit = useMemo<CommitEntry | undefined>(() => {
    if (!hydrated || commits.length === 0) {
      return undefined;
    }

    return {
      commitId: SSR_COMMIT_ID,
      timestamp: commits[0].timestamp,
      duration: 0,
      elementCount: Object.keys(tree).length,
      elements: [],
      causes: []
    };
  }, [hydrated, commits, tree]);

  const timeline = useMemo(() => (ssrCommit ? [ssrCommit, ...commits] : commits), [ssrCommit, commits]);
  const firstRealId = commits[0]?.commitId;

  const selectedIndex = useMemo(() => {
    if (timeline.length === 0) {
      return -1;
    }

    const found = timeline.findIndex(commit => commit.commitId === selectedCommitId);

    return found === -1 ? timeline.length - 1 : found;
  }, [timeline, selectedCommitId]);
  const selectedCommit = selectedIndex === -1 ? undefined : timeline[selectedIndex];
  const isSsrCommit = selectedCommit?.commitId === SSR_COMMIT_ID;

  // The full render-tree model for the selected commit, reused by both views (built once here). The SSR marker has no
  // client profile data, so it has no model — the view shows an explanation instead.
  const model = useMemo(
    () => (selectedCommit && !isSsrCommit ? buildFlameModel(selectedCommit, tree, flat) : undefined),
    [selectedCommit, isSsrCommit, tree, flat]
  );

  // No preselection: the sidebar/outline only appear for an explicit pick (undefined ⇒ nothing selected).
  const active = useMemo(() => model?.nodes.find(node => node.id === selectedElementId), [model, selectedElementId]);
  useHighlightElement(active?.id);

  // Origin of the selected commit (ssr / hydration / mount / mixed / update) for the per-view header label.
  const origin = useMemo(
    () => (selectedCommit ? commitOrigin(selectedCommit, hydrated, selectedCommit.commitId === firstRealId) : 'update'),
    [selectedCommit, hydrated, firstRealId]
  );

  const handleSelectCommit = useCallback((commitId: number) => setSelectedCommitId(commitId), []);
  const handleSelectElement = useCallback((id: string | undefined) => setSelectedElementId(id), []);
  const handleStepCommit = useCallback(
    (delta: number) => {
      const next = selectedIndex + delta;
      if (next >= 0 && next < timeline.length) {
        setSelectedCommitId(timeline[next].commitId);
      }
    },
    [timeline, selectedIndex]
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
    <div className="flex h-full min-h-0 w-full flex-col" onKeyDown={handleKeyDown}>
      <TracingToolbar view={view} commitCount={commits.length} onClear={clear} onViewChange={setView} />
      {view !== 'hotspots' && (
        <CommitStrip
          commits={timeline}
          selectedIndex={selectedIndex}
          hydrated={hydrated}
          onSelect={handleSelectCommit}
        />
      )}
      {view !== 'hotspots' && isSsrCommit && (
        <div className="flex grow flex-col items-center justify-center gap-3 px-6 text-center text-zinc-500 dark:text-zinc-400">
          <i className="fa-solid fa-server text-3xl opacity-30" />
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Server render (SSR)</span>
          <span className="max-w-md text-xs leading-relaxed">
            This page was rendered on the server first. React&apos;s Profiler doesn&apos;t run during server rendering,
            so there&apos;s no per-element timing for it — this commit marks that baseline. Commit&nbsp;#{firstRealId}{' '}
            is the client <span className="font-medium text-violet-600 dark:text-violet-400">hydration</span> of this
            tree.
          </span>
          <span className="text-[11px] opacity-70">{selectedCommit.elementCount} elements in the rendered tree</span>
        </div>
      )}
      {view === 'ranked' && model && (
        <RankedList
          commit={selectedCommit}
          model={model}
          active={active}
          origin={origin}
          onSelectElement={handleSelectElement}
        />
      )}
      {view === 'flamegraph' && model && (
        <Flamegraph
          commit={selectedCommit}
          model={model}
          active={active}
          origin={origin}
          onSelectElement={handleSelectElement}
        />
      )}
      {view === 'hotspots' && (
        <HotspotsList
          commits={commits}
          tree={tree}
          flat={flat}
          selectedId={selectedElementId}
          onSelectElement={handleSelectElement}
        />
      )}
    </div>
  );
};

export default TracingViewer;
