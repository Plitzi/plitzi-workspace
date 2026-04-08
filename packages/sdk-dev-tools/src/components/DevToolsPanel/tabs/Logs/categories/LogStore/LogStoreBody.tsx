import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import buildDiff from './helpers/buildDiff';
import buildHunks from './helpers/buildHunks';
import buildSections from './helpers/buildSections';

export type DiffLine = { type: 'same' | 'added' | 'removed'; text: string };
export type Hunk = { start: number; end: number };
export type Section =
  | { kind: 'line'; line: DiffLine; diffIndex: number; hunkIndex: number | null }
  | { kind: 'separator'; hunkIndex: number; total: number };

export type LogStoreBodyProps = {
  path?: string;
  prev?: unknown;
  next?: unknown;
  contextLines?: number;
};

const LogStoreBody = ({ path, prev, next, contextLines = 10 }: LogStoreBodyProps) => {
  const containerRef = useRef<HTMLPreElement | null>(null);
  const [activeHunk, setActiveHunk] = useState(0);

  const diff = useMemo(() => buildDiff(prev, next), [prev, next]);
  const hunks = useMemo(() => buildHunks(diff), [diff]);
  const sections = useMemo(() => buildSections(diff, hunks, contextLines), [diff, hunks, contextLines]);

  const hasDiffs = hunks.length > 0;
  const isFirst = activeHunk === 0;
  const isLast = activeHunk === hunks.length - 1;

  const scrollToHunk = useCallback((hunkIdx: number) => {
    const el = containerRef.current?.querySelector<HTMLElement>(`[data-hunk="${hunkIdx}"]`);
    el?.scrollIntoView({ block: 'center' });
  }, []);

  const navigate = useCallback(
    (delta: number) => {
      const target = activeHunk + delta;
      if (target < 0 || target >= hunks.length) {
        return;
      }

      setActiveHunk(target);
      scrollToHunk(target);
    },
    [activeHunk, hunks.length, scrollToHunk]
  );

  useEffect(() => {
    if (!hasDiffs) {
      return;
    }

    setActiveHunk(0);
    scrollToHunk(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diff]);

  return (
    <div className="mx-2 my-1.5 flex flex-col gap-2 rounded border border-zinc-200 bg-zinc-50 font-mono dark:border-zinc-700 dark:bg-zinc-800/50">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-2 py-1 dark:border-zinc-700">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 text-zinc-500 dark:text-zinc-400">path</span>
          <span className="truncate text-zinc-400 dark:text-zinc-500">{path ?? '(full state)'}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {hasDiffs && (
            <span className="text-zinc-400 tabular-nums dark:text-zinc-600">
              {activeHunk + 1}/{hunks.length}
            </span>
          )}
          <button
            className={clsx(
              'rounded bg-zinc-200 px-2 py-0.5 text-xs text-zinc-600 transition-colors hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600',
              { 'cursor-not-allowed opacity-30 dark:cursor-not-allowed dark:opacity-30': !hasDiffs || isFirst }
            )}
            disabled={!hasDiffs || isFirst}
            onClick={() => navigate(-1)}
          >
            ↑ Prev
          </button>
          <button
            className={clsx(
              'rounded bg-zinc-200 px-2 py-0.5 text-xs text-zinc-600 transition-colors hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600',
              { 'cursor-not-allowed opacity-30 dark:cursor-not-allowed dark:opacity-30': !hasDiffs || isLast }
            )}
            disabled={!hasDiffs || isLast}
            onClick={() => navigate(1)}
          >
            ↓ Next
          </button>
        </div>
      </div>

      {/* Diff content */}
      <pre ref={containerRef} className="max-h-64 overflow-auto bg-zinc-50 text-xs leading-5 dark:bg-zinc-800">
        {!hasDiffs && <div className="px-3 py-2 text-zinc-400 italic dark:text-zinc-600">No changes</div>}

        {sections.map((section, idx) => {
          if (section.kind === 'separator') {
            const isActive = section.hunkIndex === activeHunk;

            return (
              <div
                key={`sep-${idx}`}
                data-hunk={section.hunkIndex}
                className={clsx('px-3', {
                  'bg-violet-50 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400': isActive,
                  'text-zinc-400 dark:text-zinc-700': !isActive
                })}
              >
                @@ hunk {section.hunkIndex + 1}/{section.total} @@
              </div>
            );
          }

          const { line, diffIndex, hunkIndex } = section;
          const isActiveHunkLine = hunkIndex === activeHunk;

          if (line.type === 'removed') {
            return (
              <div
                key={diffIndex}
                data-hunk={hunkIndex ?? undefined}
                className={clsx('px-3', {
                  'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300': isActiveHunkLine,
                  'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400': !isActiveHunkLine
                })}
              >
                {'- '}
                {line.text}
              </div>
            );
          }

          if (line.type === 'added') {
            return (
              <div
                key={diffIndex}
                data-hunk={hunkIndex ?? undefined}
                className={clsx('px-3', {
                  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300': isActiveHunkLine,
                  'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400': !isActiveHunkLine
                })}
              >
                {'+ '}
                {line.text}
              </div>
            );
          }

          return (
            <div key={diffIndex} className="px-3 text-zinc-400 dark:text-zinc-600">
              {'  '}
              {line.text}
            </div>
          );
        })}
      </pre>
    </div>
  );
};

export default LogStoreBody;
