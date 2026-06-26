import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { buildFlameLayout, durationColor, elementName, formatMs, formatPercent } from '../../helpers';
import DurationLegend from '../DurationLegend';

import type { FlameNode } from '../../helpers';
import type { CommitEntry, Element } from '@plitzi/sdk-shared';
import type { KeyboardEvent } from 'react';

const ROW_HEIGHT = 22;
const EPS = 1e-6;
// Floor on a frame's width so its label + timing stay readable even when its proportional slice is tiny.
const MIN_WIDTH_PX = 56;
// Share of the width the focused subtree expands to; the rest (out-of-focus context) compresses into the remainder.
const FOCUS_SPAN = 0.88;

export type FlamegraphProps = {
  commit: CommitEntry;
  flat: Record<string, Element> | undefined;
};

const Flamegraph = ({ commit, flat }: FlamegraphProps) => {
  const [focusId, setFocusId] = useState<string | undefined>();
  const [activeId, setActiveId] = useState<string | undefined>();

  const renderedIds = useMemo(() => new Set(commit.elements.map(entry => entry.id)), [commit]);
  // Always the FULL tree, so positions stay stable while zooming/focusing.
  const { nodes, maxDepth } = useMemo(() => buildFlameLayout(commit, flat), [commit, flat]);
  const focus = useMemo(() => nodes.find(node => node.id === focusId), [nodes, focusId]);
  const active = useMemo(() => {
    if (nodes.length === 0) {
      return undefined;
    }

    return nodes.find(node => node.id === activeId) ?? nodes[0];
  }, [nodes, activeId]);

  // A node belongs to the focused subtree when it sits within the focus node's x-range and at or below its depth.
  const inFocus = useCallback(
    (node: FlameNode): boolean =>
      !focus ||
      (node.depth >= focus.depth && node.x >= focus.x - EPS && node.x + node.width <= focus.x + focus.width + EPS),
    [focus]
  );

  // Monotonic piecewise remap of the [0..1] axis: the focused range expands to FOCUS_SPAN of the width, the left and
  // right context compress into the rest. Applied to a node's edges it scales it without breaking nesting, so the
  // focused subtree grows and everything else shrinks horizontally — staying visible, never relayouting vertically.
  const project = useMemo(() => {
    if (!focus || focus.width <= EPS) {
      return (x: number): number => x;
    }

    const { x: fx, width: fw } = focus;
    const left = fx;
    const right = 1 - (fx + fw);
    const context = left + right;
    const focusDisp = context > EPS ? FOCUS_SPAN : 1;
    const leftDisp = context > EPS ? (1 - FOCUS_SPAN) * (left / context) : 0;
    const rightDisp = context > EPS ? 1 - FOCUS_SPAN - leftDisp : 0;

    return (x: number): number => {
      if (x <= fx) {
        return left > EPS ? (x / left) * leftDisp : 0;
      }

      if (x >= fx + fw) {
        return leftDisp + focusDisp + (right > EPS ? ((x - (fx + fw)) / right) * rightDisp : 0);
      }

      return leftDisp + ((x - fx) / fw) * focusDisp;
    };
  }, [focus]);

  // Rendered ancestors of the focused node (outermost → focus) for the breadcrumb. Names come from the schema, not
  // the layout, so they resolve even for ancestors outside a deep focus.
  const trail = useMemo(() => {
    const chain: { id: string; name: string }[] = [];
    let current = focusId;
    while (current) {
      if (renderedIds.has(current)) {
        chain.unshift({ id: current, name: elementName(current, flat) });
      }

      current = flat?.[current]?.definition.parentId;
    }

    return chain;
  }, [focusId, flat, renderedIds]);

  const zoomOutTarget = useMemo(() => {
    let parent = focusId ? flat?.[focusId]?.definition.parentId : undefined;
    while (parent) {
      if (renderedIds.has(parent)) {
        return parent;
      }

      parent = flat?.[parent]?.definition.parentId;
    }

    return undefined;
  }, [focusId, flat, renderedIds]);

  useEffect(() => {
    setFocusId(undefined);
    setActiveId(undefined);
  }, [commit.commitId]);

  const handleNodeClick = useCallback(
    (node: FlameNode) => () => setFocusId(node.id === focusId ? zoomOutTarget : node.id),
    [focusId, zoomOutTarget]
  );
  const handleNodeHover = useCallback((id: string) => () => setActiveId(id), []);

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

      {active && (
        <div className="flex shrink-0 items-center gap-2 px-2 py-1 text-[10px] dark:text-zinc-300">
          <span className={clsx('h-2 w-2 rounded-sm', durationColor(active.selfDuration))} />
          <span className="truncate font-medium text-zinc-700 dark:text-zinc-200">{active.name}</span>
          <span className="text-zinc-400 dark:text-zinc-500">{active.type}</span>
          <span className="ml-auto shrink-0 text-zinc-500 tabular-nums dark:text-zinc-400">
            {formatMs(active.selfDuration)} self · {formatMs(active.actualDuration)} total ·{' '}
            {formatPercent(active.actualDuration / commit.duration)}
          </span>
        </div>
      )}

      <div
        role="tree"
        aria-label="Flamegraph — width is total time, color is self time. Click a frame to focus, the top frame to zoom out."
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="min-h-0 flex-1 overflow-auto p-1 outline-none focus-visible:ring-1 focus-visible:ring-violet-400"
      >
        <div className="relative w-full" style={{ height: (maxDepth + 1) * ROW_HEIGHT }}>
          {nodes.map(node => {
            const isActive = node.id === active?.id;
            const dimmed = !inFocus(node);
            const left = project(node.x);
            const width = project(node.x + node.width) - left;

            return (
              <button
                key={node.id}
                role="treeitem"
                aria-label={`${node.name}, ${formatMs(node.selfDuration)} self of ${formatMs(node.actualDuration)} total`}
                onClick={handleNodeClick(node)}
                onMouseEnter={handleNodeHover(node.id)}
                onFocus={handleNodeHover(node.id)}
                style={{
                  left: `${left * 100}%`,
                  width: `calc(${width * 100}% - 2px)`,
                  minWidth: MIN_WIDTH_PX,
                  top: node.depth * ROW_HEIGHT + 1,
                  height: ROW_HEIGHT - 3
                }}
                className={clsx(
                  'absolute flex items-center justify-between gap-1 overflow-hidden rounded-sm border px-1 text-left text-[10px] text-white transition-all',
                  durationColor(node.selfDuration),
                  {
                    'border-white ring-1 ring-violet-500 dark:border-zinc-900': isActive,
                    'border-white/30 dark:border-black/20': !isActive,
                    'opacity-30 hover:opacity-70': dimmed,
                    'opacity-100': !dimmed
                  }
                )}
              >
                <span className="truncate">{node.name}</span>
                <span className="shrink-0 tabular-nums opacity-90">
                  {formatMs(node.selfDuration)} / {formatMs(node.actualDuration)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <DurationLegend />
    </div>
  );
};

export default Flamegraph;
