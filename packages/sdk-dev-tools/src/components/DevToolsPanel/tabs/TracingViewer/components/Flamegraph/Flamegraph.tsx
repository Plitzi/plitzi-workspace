import clsx from 'clsx';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { COMMIT_ORIGIN_LABEL, formatMs, formatPercent, frameColor, HATCH_STYLE } from '../../helpers';
import DetailSidebar from '../DetailSidebar';
import DurationLegend from '../DurationLegend';

import type { CommitOrigin, FlameModel, FlameNode } from '../../helpers';
import type { CommitEntry } from '@plitzi/sdk-shared';
import type { KeyboardEvent } from 'react';

const ROW_HEIGHT = 22;
const EPS = 1e-6;
// Below these pixel widths a frame can't fit its text, so we drop it and let the tooltip carry the detail.
const MIN_LABEL_PX = 26;
const MIN_TIME_PX = 96;
// Frames narrower than this are not drawn: their `calc(w% - 2px)` body collapses to nothing while their 1px borders
// remain, so on a large tree hundreds of them stack into what looks like overlapping boxes. Culling them (their whole
// subtree is at most this wide too) keeps the picture clean — zoom in to resolve detail.
const MIN_FRAME_PX = 2;
// When zoomed, the focused range fills this fraction of the width; the rest is the budget the siblings shrink into.
const FOCUS_FRACTION = 0.82;

export type FlamegraphProps = {
  commit: CommitEntry;
  model: FlameModel;
  active: FlameNode | undefined;
  origin: CommitOrigin;
  onSelectElement: (id: string | undefined) => void;
};

type Placed = {
  node: FlameNode;
  left: number;
  width: number;
};

const Flamegraph = ({ commit, model, active, origin, onSelectElement }: FlamegraphProps) => {
  const { nodes, maxDepth } = model;
  const [focusId, setFocusId] = useState<string | undefined>();
  const [trackWidth, setTrackWidth] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Measure the actual positioning track in pixels (before paint, so frames don't flash unpositioned). Frame edges are
  // snapped to this integer pixel grid — see the layout in the render below.
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) {
      return;
    }

    setTrackWidth(el.clientWidth);
    const observer = new ResizeObserver(entries => setTrackWidth(entries[0]?.contentRect.width ?? 0));
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  useEffect(() => setFocusId(undefined), [commit.commitId]);

  const focus = useMemo(() => nodes.find(node => node.id === focusId), [nodes, focusId]);
  // The focused range; identity ([0,1] from the top) when nothing is focused.
  const fx = focus?.x ?? 0;
  const fw = focus && focus.width > EPS ? focus.width : 1;

  // Fisheye remap of the x-axis: the focused range is magnified to FOCUS_FRACTION of the width and everything outside
  // is COMPRESSED into the margins (split by how much sits left vs right of the focus) — so siblings shrink but never
  // disappear, keeping the surrounding tree as context. Identity when nothing is focused. Monotonic ⇒ frames can't
  // overlap (disjoint input intervals stay disjoint).
  const project = useMemo(() => {
    const outsideLeft = fx;
    const outsideRight = Math.max(0, 1 - (fx + fw));
    // Nothing sits outside the focus (e.g. a full-width root is focused) ⇒ magnifying would just waste the margins,
    // so fall back to identity.
    if (!focus || outsideLeft + outsideRight <= EPS) {
      return (x: number): number => x;
    }

    const rest = 1 - FOCUS_FRACTION;
    const leftBudget = (rest * outsideLeft) / (outsideLeft + outsideRight);
    const rightBudget = rest - leftBudget;
    const focusEnd = leftBudget + FOCUS_FRACTION;

    return (x: number): number => {
      if (x <= fx) {
        return outsideLeft > EPS ? (x / outsideLeft) * leftBudget : 0;
      }

      if (x >= fx + fw) {
        return outsideRight > EPS ? focusEnd + ((x - (fx + fw)) / outsideRight) * rightBudget : focusEnd;
      }

      return leftBudget + ((x - fx) / fw) * FOCUS_FRACTION;
    };
  }, [focus, fx, fw]);

  // Every node is always placed (no hiding) — the projection just magnifies the focus and compresses the rest.
  const placed = useMemo<Placed[]>(() => {
    return nodes.map(node => {
      const left = project(node.x);

      return { node, left, width: Math.max(0, project(node.x + node.width) - left) };
    });
  }, [nodes, project]);

  // Focus + its ancestors (the nodes whose range contains the focus), top→down, for the breadcrumb and zoom-out.
  const trail = useMemo(() => {
    if (!focus) {
      return [];
    }

    return nodes
      .filter(
        node =>
          node.depth <= focus.depth && node.x <= focus.x + EPS && node.x + node.width >= focus.x + focus.width - EPS
      )
      .sort((a, b) => a.depth - b.depth);
  }, [nodes, focus]);
  const zoomOutTarget = trail.length >= 2 ? trail[trail.length - 2].id : undefined;

  // Single click selects a frame (sidebar + page outline) WITHOUT zooming, and clicking the already-selected frame
  // deselects it; double click zooms. Double-clicking the already-focused frame zooms back out to its parent.
  const handleNodeClick = useCallback(
    (id: string) => () => onSelectElement(id === active?.id ? undefined : id),
    [active, onSelectElement]
  );
  const handleNodeDoubleClick = useCallback(
    (id: string) => () => {
      setFocusId(current => (current === id ? zoomOutTarget : id));
      onSelectElement(id);
    },
    [zoomOutTarget, onSelectElement]
  );
  const handleNodeFocus = useCallback((id: string) => () => onSelectElement(id), [onSelectElement]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if ((event.key === 'Escape' || event.key === 'Backspace') && focusId) {
        event.preventDefault();
        setFocusId(zoomOutTarget);
      }
    },
    [focusId, zoomOutTarget]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-zinc-200 px-2 py-1 text-[10px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        <button
          onClick={() => setFocusId(undefined)}
          className={clsx('shrink-0 rounded px-1 hover:bg-zinc-100 dark:hover:bg-zinc-800', {
            'font-medium': !focusId
          })}
        >
          Commit #{commit.commitId}
        </button>
        {origin !== 'update' && (
          <span className="shrink-0 rounded bg-violet-100 px-1 text-[9px] font-medium text-violet-700 uppercase dark:bg-violet-500/20 dark:text-violet-300">
            {COMMIT_ORIGIN_LABEL[origin]}
          </span>
        )}
        <span className="shrink-0 text-[9px] opacity-50">double-click a frame to zoom</span>
        {trail.map((node, index) => (
          <span key={node.id} className="flex shrink-0 items-center gap-1">
            <i className="fa-solid fa-chevron-right text-[7px] opacity-50" />
            <button
              onClick={() => setFocusId(node.id)}
              className={clsx('max-w-28 truncate rounded px-1 hover:bg-zinc-100 dark:hover:bg-zinc-800', {
                'font-medium text-violet-600 dark:text-violet-400': index === trail.length - 1
              })}
            >
              {node.name}
            </button>
          </span>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div
          ref={scrollRef}
          role="tree"
          aria-label="Flamegraph — width is base render time, color is self time this commit. Click a frame to inspect it, double-click to zoom, the focused frame to zoom out."
          tabIndex={0}
          onKeyDown={handleKeyDown}
          className="min-h-0 flex-1 overflow-auto p-1 outline-none focus-visible:ring-1 focus-visible:ring-violet-400"
        >
          <div ref={trackRef} className="relative w-full" style={{ height: (maxDepth + 1) * ROW_HEIGHT }}>
            {placed.map(({ node, left, width }) => {
              const isActive = node.id === active?.id;
              // Snap BOTH edges to the same integer pixel grid: a frame's right edge `x1` and the next sibling's left
              // edge are the identical rounded value (the sibling's `left` equals this frame's `left + width`), so they
              // meet exactly and can never round into an overlap — regardless of how many frames there are.
              const x0 = Math.round(left * trackWidth);
              const x1 = Math.round((left + width) * trackWidth);
              const wpx = x1 - x0;
              // Cull frames too thin to render as a body (their whole subtree is at most this wide); keep the selected
              // one so it can't vanish under the cursor.
              if (wpx < MIN_FRAME_PX && !isActive) {
                return null;
              }

              const showLabel = wpx >= MIN_LABEL_PX;
              const showTime = wpx >= MIN_TIME_PX && node.state === 'rendered';

              return (
                <button
                  key={node.id}
                  role="treeitem"
                  aria-label={`${node.name}, ${node.state}${node.visible ? '' : ', hidden'}, ${formatMs(node.selfDuration)} self of ${formatMs(node.actualDuration)} total`}
                  title={`${node.name} (${node.type})${node.visible ? '' : ' · hidden (visibility)'}\n${node.state === 'rendered' ? `rendered · ${node.phase ?? 'update'}` : node.state === 'bubbled' ? 'a descendant rendered' : 'did not render this commit'}\n${formatMs(node.selfDuration)} self · ${formatMs(node.actualDuration)} total · ${formatMs(node.baseDuration)} base\n${formatPercent(node.actualDuration / commit.duration)} of commit`}
                  onClick={handleNodeClick(node.id)}
                  onDoubleClick={handleNodeDoubleClick(node.id)}
                  onFocus={handleNodeFocus(node.id)}
                  style={{
                    left: x0,
                    // Stop 1px shy of the shared boundary so neighbours read as separate without ever overlapping.
                    width: Math.max(1, wpx - 1),
                    top: node.depth * ROW_HEIGHT + 1,
                    height: ROW_HEIGHT - 3,
                    ...(node.state === 'hatched' ? HATCH_STYLE : {})
                  }}
                  className={clsx(
                    'absolute flex items-center gap-1 overflow-hidden rounded-sm border px-1 text-left text-[10px] transition-[filter] hover:brightness-110',
                    frameColor(node),
                    node.state === 'rendered' ? 'text-white' : 'text-zinc-600 dark:text-zinc-300',
                    node.state === 'hatched'
                      ? 'border-dashed border-zinc-400/50'
                      : 'border-black/10 dark:border-white/10',
                    { 'brightness-125 saturate-150': isActive }
                  )}
                >
                  {node.trigger && <i className="fa-solid fa-bolt shrink-0 text-[8px] text-violet-200" />}
                  {!node.visible && <i className="fa-solid fa-eye-slash shrink-0 text-[8px] opacity-70" />}
                  {showLabel && <span className="min-w-0 truncate">{node.name}</span>}
                  {showTime && (
                    <span className="ml-1 shrink-0 tabular-nums opacity-80">
                      {formatMs(node.selfDuration)} / {formatMs(node.actualDuration)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {active && <DetailSidebar node={active} commit={commit} model={model} />}
      </div>

      <DurationLegend />
    </div>
  );
};

export default Flamegraph;
