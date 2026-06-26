import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { formatMs, formatPercent, frameColor, HATCH_STYLE } from '../../helpers';
import DetailSidebar from '../DetailSidebar';
import DurationLegend from '../DurationLegend';

import type { FlameModel, FlameNode } from '../../helpers';
import type { CommitEntry } from '@plitzi/sdk-shared';
import type { KeyboardEvent } from 'react';

const ROW_HEIGHT = 22;
const EPS = 1e-6;
// Below these pixel widths a frame can't fit its text, so we drop it and let the tooltip carry the detail.
const MIN_LABEL_PX = 26;
const MIN_TIME_PX = 96;

export type FlamegraphProps = {
  commit: CommitEntry;
  model: FlameModel;
  active: FlameNode | undefined;
  onSelectElement: (id: string | undefined) => void;
};

type Placed = {
  node: FlameNode;
  left: number;
  width: number;
  role: 'subtree' | 'ancestor';
};

const Flamegraph = ({ commit, model, active, onSelectElement }: FlamegraphProps) => {
  const { nodes, maxDepth } = model;
  const [focusId, setFocusId] = useState<string | undefined>();
  const [containerWidth, setContainerWidth] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }

    const observer = new ResizeObserver(entries => setContainerWidth(entries[0]?.contentRect.width ?? 0));
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  useEffect(() => setFocusId(undefined), [commit.commitId]);

  const focus = useMemo(() => nodes.find(node => node.id === focusId), [nodes, focusId]);
  // The focused range; identity ([0,1] from the top) when nothing is focused.
  const fx = focus?.x ?? 0;
  const fw = focus && focus.width > EPS ? focus.width : 1;
  const focusDepth = focus?.depth ?? 0;

  // Re-projects the full tree for the current focus, React-DevTools style: the focused subtree expands to fill the
  // width; the focus's ancestors stay as full-width bars above it (click to zoom out); everything else is hidden.
  const placed = useMemo(() => {
    const result: Placed[] = [];
    for (const node of nodes) {
      const within = node.x >= fx - EPS && node.x + node.width <= fx + fw + EPS;
      if (node.depth >= focusDepth && within) {
        result.push({ node, left: (node.x - fx) / fw, width: node.width / fw, role: 'subtree' });
      } else if (focus && node.depth < focusDepth && node.x <= fx + EPS && node.x + node.width >= fx + fw - EPS) {
        result.push({ node, left: 0, width: 1, role: 'ancestor' });
      }
    }

    return result;
  }, [nodes, focus, fx, fw, focusDepth]);

  // Focus + its ancestors, top→down, for the breadcrumb and zoom-out.
  const trail = useMemo(
    () =>
      placed
        .filter(item => item.role === 'ancestor' || item.node.id === focusId)
        .map(item => item.node)
        .sort((a, b) => a.depth - b.depth),
    [placed, focusId]
  );
  const zoomOutTarget = trail.length >= 2 ? trail[trail.length - 2].id : undefined;

  // Clicking a frame selects it (sidebar + page outline) and zooms in; clicking the already-focused frame deselects
  // and zooms back out.
  const handleNodeClick = useCallback(
    (id: string) => () => {
      if (id === focusId) {
        setFocusId(zoomOutTarget);
        onSelectElement(undefined);
      } else {
        setFocusId(id);
        onSelectElement(id);
      }
    },
    [focusId, zoomOutTarget, onSelectElement]
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
          aria-label="Flamegraph — width is base render time, color is self time this commit. Click a frame to zoom, the focused frame to zoom out."
          tabIndex={0}
          onKeyDown={handleKeyDown}
          className="min-h-0 flex-1 overflow-auto p-1 outline-none focus-visible:ring-1 focus-visible:ring-violet-400"
        >
          <div className="relative w-full" style={{ height: (maxDepth + 1) * ROW_HEIGHT }}>
            {placed.map(({ node, left, width }) => {
              const isActive = node.id === active?.id;
              const px = width * containerWidth;
              const showLabel = px >= MIN_LABEL_PX;
              const showTime = px >= MIN_TIME_PX && node.state === 'rendered';

              return (
                <button
                  key={node.id}
                  role="treeitem"
                  aria-label={`${node.name}, ${node.state}${node.visible ? '' : ', hidden'}, ${formatMs(node.selfDuration)} self of ${formatMs(node.actualDuration)} total`}
                  title={`${node.name} (${node.type})${node.visible ? '' : ' · hidden (visibility)'}\n${node.state === 'rendered' ? `rendered · ${node.phase ?? 'update'}` : node.state === 'bubbled' ? 'a descendant rendered' : 'did not render this commit'}\n${formatMs(node.selfDuration)} self · ${formatMs(node.actualDuration)} total · ${formatMs(node.baseDuration)} base\n${formatPercent(node.actualDuration / commit.duration)} of commit`}
                  onClick={handleNodeClick(node.id)}
                  onFocus={handleNodeFocus(node.id)}
                  style={{
                    left: `${left * 100}%`,
                    width: `calc(${width * 100}% - 2px)`,
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
