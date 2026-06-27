import { useCallback, useEffect, useMemo, useState } from 'react';

import { COMMIT_ORIGIN_LABEL } from '../../helpers';
import DetailSidebar from '../DetailSidebar';
import DurationLegend from '../DurationLegend';
import FlameFrame, { ROW_HEIGHT } from './FlameFrame';

import type { CommitOrigin, FlameModel, FlameNode } from '../../helpers';
import type { CommitEntry } from '@plitzi/sdk-shared';

export type FlamegraphProps = {
  commit: CommitEntry;
  model: FlameModel;
  active: FlameNode | undefined;
  origin: CommitOrigin;
  onSelectElement: (id: string | undefined) => void;
};

// Float slack for the subtree-containment test (a child's span can land a hair outside its parent's after division).
const EPS = 1e-6;

// A shadow-DOM-native flamegraph: every frame is an absolutely-positioned DOM box sized by the layout fractions on each
// `FlameNode`, so clicks, theming and Tailwind all work inside the shadow root (no library injecting styles into
// `document.head`, no canvas). Clicking a frame zooms to it; its ancestors stay as full-width bars above to zoom back.
const Flamegraph = ({ commit, model, active, origin, onSelectElement }: FlamegraphProps) => {
  const [focusId, setFocusId] = useState<string | undefined>();

  useEffect(() => setFocusId(undefined), [commit.commitId, model]);

  const byId = useMemo(() => {
    const map = new Map<string, FlameNode>();
    for (const node of model.nodes) {
      map.set(node.id, node);
    }

    return map;
  }, [model]);

  const focus = focusId ? byId.get(focusId) : undefined;
  const focusX = focus ? focus.x : 0;
  const focusWidth = focus ? focus.width : 1;
  const focusDepth = focus ? focus.depth : 0;

  const ancestors = useMemo(() => {
    if (!focus) {
      return [];
    }

    const chain: FlameNode[] = [];
    let parentId = focus.parentId;
    while (parentId !== undefined) {
      const parent = byId.get(parentId);
      if (!parent) {
        break;
      }

      chain.push(parent);
      parentId = parent.parentId;
    }

    return chain.reverse();
  }, [focus, byId]);

  // The focused frame plus its subtree, selected by horizontal containment (children always nest within their parent).
  const frames = useMemo(
    () =>
      model.nodes.filter(
        node => node.depth >= focusDepth && node.x >= focusX - EPS && node.x + node.width <= focusX + focusWidth + EPS
      ),
    [model, focusX, focusWidth, focusDepth]
  );

  const maxDepth = useMemo(
    () => frames.reduce((max, node) => Math.max(max, node.depth), focusDepth),
    [frames, focusDepth]
  );

  // Clicking the selected frame clears the selection AND zooms out a level, so re-clicking the page resets the view.
  const handleFrameClick = useCallback(
    (node: FlameNode) => {
      onSelectElement(node.id === active?.id ? undefined : node.id);
      setFocusId(node.id === focusId ? node.parentId : node.id);
    },
    [focusId, active, onSelectElement]
  );

  const handleAncestorClick = useCallback(
    (node: FlameNode) => {
      onSelectElement(node.id === active?.id ? undefined : node.id);
      setFocusId(node.id);
    },
    [active, onSelectElement]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200 px-2 py-1 text-[10px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        <span className="font-medium text-zinc-700 dark:text-zinc-200">Commit #{commit.commitId}</span>
        {origin !== 'update' && (
          <span className="rounded bg-violet-100 px-1 text-[9px] font-medium text-violet-700 uppercase dark:bg-violet-500/20 dark:text-violet-300">
            {COMMIT_ORIGIN_LABEL[origin]}
          </span>
        )}
        <span className="opacity-60">click a frame to zoom · click the focused frame to zoom out</span>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-h-0 flex-1 overflow-auto p-1">
          <div className="relative w-full" style={{ height: (maxDepth + 1) * ROW_HEIGHT }}>
            {ancestors.map(node => (
              <FlameFrame
                key={node.id}
                node={node}
                left={0}
                width={100}
                top={node.depth * ROW_HEIGHT}
                selected={node.id === active?.id}
                onClick={handleAncestorClick}
              />
            ))}
            {frames.map(node => (
              <FlameFrame
                key={node.id}
                node={node}
                left={((node.x - focusX) / focusWidth) * 100}
                width={(node.width / focusWidth) * 100}
                top={node.depth * ROW_HEIGHT}
                selected={node.id === active?.id}
                onClick={handleFrameClick}
              />
            ))}
          </div>
        </div>
        {active && <DetailSidebar node={active} commit={commit} model={model} />}
      </div>

      <DurationLegend />
    </div>
  );
};

export default Flamegraph;
