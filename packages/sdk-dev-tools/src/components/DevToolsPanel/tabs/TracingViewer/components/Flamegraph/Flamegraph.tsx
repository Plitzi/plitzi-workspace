import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { COMMIT_ORIGIN_LABEL, formatMs, formatPercent, frameColor, frameTextColor, HATCH_STYLE } from '../../helpers';
import DetailSidebar from '../DetailSidebar';
import DurationLegend from '../DurationLegend';

import type { CommitOrigin, FlameModel, FlameNode } from '../../helpers';
import type { CommitEntry } from '@plitzi/sdk-shared';
import type { CSSProperties } from 'react';

export type FlamegraphProps = {
  commit: CommitEntry;
  model: FlameModel;
  active: FlameNode | undefined;
  origin: CommitOrigin;
  onSelectElement: (id: string | undefined) => void;
};

const ROW_HEIGHT = 18;

// Float slack: a child's [x, x+width] can land a hair outside the parent's after the proportional layout's divisions,
// so the containment test that selects the focused subtree is widened by this much.
const EPS = 1e-6;

// A self-contained, shadow-DOM-native flamegraph: every frame is an absolutely-positioned DOM box sized by the layout
// fractions already on each `FlameNode` (`x`, `width`, `depth`), so there is no library injecting styles into
// `document.head` and no canvas — clicks, theming and the panel's Tailwind all work inside the shadow root directly.
// Clicking a frame zooms to it (its span fills the width); its ancestors stay as full-width bars above so you can
// click back out; clicking the focused frame zooms out one level.
const Flamegraph = ({ commit, model, active, origin, onSelectElement }: FlamegraphProps) => {
  const [focusId, setFocusId] = useState<string | undefined>();

  // A new commit/model is a different tree — drop any zoom so we don't strand the view on a now-absent frame.
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

  // The focused frame's ancestor chain (root → parent), shown as full-width bars above so every zoom level stays
  // reachable with one click.
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

  // The focused frame plus its subtree — selected by horizontal containment (children always nest inside their
  // parent's span by construction), drawn at their real depth scaled into the focused span's width.
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

  // Clicking the already-selected frame clears the selection AND zooms out one level, so re-clicking the page resets
  // back to the full, unselected view.
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

type FlameFrameProps = {
  node: FlameNode;
  left: number;
  width: number;
  top: number;
  selected: boolean;
  onClick: (node: FlameNode) => void;
};

const FlameFrame = ({ node, left, width, top, selected, onClick }: FlameFrameProps) => {
  const style: CSSProperties = {
    left: `${left}%`,
    width: `${width}%`,
    top,
    height: ROW_HEIGHT,
    // The diagonal stripes alone vanish on tiny frames, so non-rendered nodes also get a faint fill below them.
    ...(node.state === 'hatched' && !selected ? HATCH_STYLE : undefined)
  };

  // Selection is signalled by a solid violet fill (the panel's accent), not a border — so adjacent frames keep their
  // 1px neutral separator and the active frame still reads at any width.
  const background = selected
    ? 'bg-violet-600'
    : node.state === 'hatched'
      ? 'bg-zinc-200 dark:bg-zinc-800'
      : frameColor(node);

  return (
    <button
      type="button"
      onClick={() => onClick(node)}
      title={`${node.name} (${node.type})${node.visible ? '' : ' · hidden'}\n${formatMs(node.selfDuration)} self · ${formatMs(node.actualDuration)} total · ${formatPercent(node.baseDuration > 0 ? node.width : 0)} width`}
      style={style}
      className={clsx(
        'absolute flex cursor-pointer items-center gap-1 overflow-hidden rounded-[1px] border border-zinc-50 px-1 text-left text-[11px] leading-none whitespace-nowrap dark:border-zinc-900',
        background,
        selected ? 'z-10 text-white' : clsx(frameTextColor(node), 'hover:brightness-110')
      )}
    >
      {node.trigger && <i className="fa-solid fa-bolt shrink-0 text-[8px] text-violet-200" />}
      {!node.visible && <i className="fa-solid fa-eye-slash shrink-0 text-[8px] opacity-80" />}
      <span className="truncate">{node.name}</span>
    </button>
  );
};

export default Flamegraph;
