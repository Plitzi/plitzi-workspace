import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useDevToolsTheme } from '../../../../../../DevToolsThemeContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type DiffLine = { type: 'same' | 'added' | 'removed'; text: string };
type Hunk = { start: number; end: number };
type Section =
  | { kind: 'line'; line: DiffLine; diffIndex: number; hunkIndex: number | null }
  | { kind: 'separator'; hunkIndex: number; total: number };

// ─── Diff algorithm (LCS backtrack) ──────────────────────────────────────────

function serialize(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value === 'function') {
    return 'Function';
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    return String(value);
  }
}

function buildDiff(prev: unknown, next: unknown): DiffLine[] {
  const a = serialize(prev).split('\n');
  const b = serialize(next).split('\n');
  const m = a.length;
  const n = b.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0) as number[]);
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const lines: DiffLine[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      lines.unshift({ type: 'same', text: a[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      lines.unshift({ type: 'added', text: b[j - 1] });
      j--;
    } else {
      lines.unshift({ type: 'removed', text: a[i - 1] });
      i--;
    }
  }

  return lines;
}

// ─── Hunk detection ───────────────────────────────────────────────────────────

function buildHunks(diff: DiffLine[]): Hunk[] {
  const hunks: Hunk[] = [];
  let start = -1;

  for (let i = 0; i < diff.length; i++) {
    if (diff[i].type !== 'same') {
      if (start === -1) {
        start = i;
      }
    } else if (start !== -1) {
      hunks.push({ start, end: i - 1 });
      start = -1;
    }
  }

  if (start !== -1) {
    hunks.push({ start, end: diff.length - 1 });
  }

  return hunks;
}

// ─── Section builder ─────────────────────────────────────────────────────────

function buildSections(diff: DiffLine[], hunks: Hunk[], contextLines: number): Section[] {
  if (hunks.length === 0) {
    return diff.map((line, i) => ({ kind: 'line', line, diffIndex: i, hunkIndex: null }));
  }

  const sections: Section[] = [];
  let lastEnd = -1;

  hunks.forEach((hunk, hunkIdx) => {
    const ctxStart = Math.max(0, hunk.start - contextLines);
    const ctxEnd = Math.min(diff.length - 1, hunk.end + contextLines);

    if (ctxStart > lastEnd + 1) {
      sections.push({ kind: 'separator', hunkIndex: hunkIdx, total: hunks.length });
    }

    for (let i = Math.max(ctxStart, lastEnd + 1); i <= ctxEnd; i++) {
      const inHunk = i >= hunk.start && i <= hunk.end;
      sections.push({ kind: 'line', line: diff[i], diffIndex: i, hunkIndex: inHunk ? hunkIdx : null });
    }

    lastEnd = ctxEnd;
  });

  return sections;
}

// ─── Component ────────────────────────────────────────────────────────────────

export type LogStoreBodyProps = {
  path?: string;
  prev?: unknown;
  next?: unknown;
  contextLines?: number;
};

const LogStoreBody = ({ path, prev, next, contextLines = 10 }: LogStoreBodyProps) => {
  const { isDark } = useDevToolsTheme();
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

  // ─── Theme classes ──────────────────────────────────────────────────────────

  const codeBg = isDark ? 'bg-zinc-800' : 'bg-zinc-50';
  const pathColor = isDark ? 'text-zinc-500' : 'text-zinc-400';
  const labelColor = isDark ? 'text-zinc-400' : 'text-zinc-500';
  const hunkCountColor = isDark ? 'text-zinc-600' : 'text-zinc-400';
  const sameLineColor = isDark ? 'text-zinc-600' : 'text-zinc-400';
  const navBtnBase = clsx(
    'rounded px-2 py-0.5 text-xs transition-colors',
    isDark ? 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600' : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300'
  );
  const navBtnDisabled = isDark ? 'opacity-30 cursor-not-allowed' : 'opacity-30 cursor-not-allowed';

  return (
    <div
      className={clsx(
        'mx-2 my-1.5 flex flex-col gap-2 rounded border font-mono',
        isDark ? 'border-zinc-700 bg-zinc-800/50' : 'border-zinc-200 bg-zinc-50'
      )}
    >
      {/* Header */}
      <div
        className={clsx(
          'flex items-center justify-between border-b px-2 py-1',
          isDark ? 'border-zinc-700' : 'border-zinc-200'
        )}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={clsx('shrink-0', labelColor)}>path</span>
          <span className={clsx('truncate', pathColor)}>{path ?? '(full state)'}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {hasDiffs && (
            <span className={clsx('tabular-nums', hunkCountColor)}>
              {activeHunk + 1}/{hunks.length}
            </span>
          )}
          <button
            className={clsx(navBtnBase, (!hasDiffs || isFirst) && navBtnDisabled)}
            disabled={!hasDiffs || isFirst}
            onClick={() => navigate(-1)}
          >
            ↑ Prev
          </button>
          <button
            className={clsx(navBtnBase, (!hasDiffs || isLast) && navBtnDisabled)}
            disabled={!hasDiffs || isLast}
            onClick={() => navigate(1)}
          >
            ↓ Next
          </button>
        </div>
      </div>

      {/* Diff content */}
      <pre ref={containerRef} className={clsx('max-h-64 overflow-auto text-xs leading-5', codeBg)}>
        {!hasDiffs && <div className={clsx('px-3 py-2 italic', sameLineColor)}>No changes</div>}

        {sections.map((section, idx) => {
          if (section.kind === 'separator') {
            const isActive = section.hunkIndex === activeHunk;

            return (
              <div
                key={`sep-${idx}`}
                data-hunk={section.hunkIndex}
                className={clsx(
                  'px-3',
                  isActive
                    ? isDark
                      ? 'bg-violet-900/40 text-violet-400'
                      : 'bg-violet-50 text-violet-600'
                    : isDark
                      ? 'text-zinc-700'
                      : 'text-zinc-400'
                )}
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
                className={clsx(
                  'px-3',
                  isActiveHunkLine
                    ? isDark
                      ? 'bg-red-500/20 text-red-300'
                      : 'bg-red-100 text-red-700'
                    : isDark
                      ? 'bg-red-500/10 text-red-400'
                      : 'bg-red-50 text-red-600'
                )}
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
                className={clsx(
                  'px-3',
                  isActiveHunkLine
                    ? isDark
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-emerald-100 text-emerald-700'
                    : isDark
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-emerald-50 text-emerald-600'
                )}
              >
                {'+ '}
                {line.text}
              </div>
            );
          }

          return (
            <div key={diffIndex} className={clsx('px-3', sameLineColor)}>
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
