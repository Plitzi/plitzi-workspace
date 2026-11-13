import clsx from 'clsx';
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';

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

  // A new diff starts at its first change; nothing else that changes moves the reader.
  const showFirstHunk = useEffectEvent(() => {
    if (!hasDiffs) {
      return;
    }

    setActiveHunk(0);
    scrollToHunk(0);
  });

  useEffect(() => showFirstHunk(), [diff]);

  const handleClickPrevious = useCallback(() => navigate(-1), [navigate]);

  const handleClickNext = useCallback(() => navigate(1), [navigate]);

  return (
    <div className="border-ui-line bg-ui-raised mx-2 my-1.5 flex flex-col gap-2 rounded border font-mono">
      {/* Header */}
      <div className="border-ui-line flex items-center justify-between border-b px-2 py-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="text-ui-fg-subtle shrink-0">path</span>
          <span className="text-ui-fg-subtle truncate">{path ?? '(full state)'}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {hasDiffs && (
            <span className="text-ui-fg-subtle tabular-nums">
              {activeHunk + 1}/{hunks.length}
            </span>
          )}
          <button
            className={clsx(
              'bg-ui-active text-ui-fg-muted hover:bg-ui-hover rounded px-2 py-0.5 text-xs transition-colors',
              { 'cursor-not-allowed opacity-30 dark:cursor-not-allowed dark:opacity-30': !hasDiffs || isFirst }
            )}
            disabled={!hasDiffs || isFirst}
            onClick={handleClickPrevious}
          >
            ↑ Prev
          </button>
          <button
            className={clsx(
              'bg-ui-active text-ui-fg-muted hover:bg-ui-hover rounded px-2 py-0.5 text-xs transition-colors',
              { 'cursor-not-allowed opacity-30 dark:cursor-not-allowed dark:opacity-30': !hasDiffs || isLast }
            )}
            disabled={!hasDiffs || isLast}
            onClick={handleClickNext}
          >
            ↓ Next
          </button>
        </div>
      </div>

      {/* Diff content */}
      <pre ref={containerRef} className="bg-ui-raised max-h-64 overflow-auto text-xs leading-5">
        {!hasDiffs && <div className="text-ui-fg-subtle px-3 py-2 italic">No changes</div>}

        {sections.map((section, idx) => {
          if (section.kind === 'separator') {
            const isActive = section.hunkIndex === activeHunk;

            return (
              <div
                key={`sep-${idx}`}
                data-hunk={section.hunkIndex}
                className={clsx('px-3', {
                  'bg-violet-50 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400': isActive,
                  'text-ui-fg-subtle': !isActive
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
            <div key={diffIndex} className="text-ui-fg-subtle px-3">
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
