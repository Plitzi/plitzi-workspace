import Button from '@plitzi/plitzi-ui/Button';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

  // LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0) as number[]);
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrack from bottom-right to top-left
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

// ─── Visible sections builder ─────────────────────────────────────────────────

function buildSections(diff: DiffLine[], hunks: Hunk[], contextLines: number): Section[] {
  if (hunks.length === 0) {
    return diff.map((line, i) => ({ kind: 'line', line, diffIndex: i, hunkIndex: null }));
  }

  const sections: Section[] = [];
  let lastEnd = -1;

  hunks.forEach((hunk, hunkIdx) => {
    const ctxStart = Math.max(0, hunk.start - contextLines);
    const ctxEnd = Math.min(diff.length - 1, hunk.end + contextLines);

    // Separator when there's a gap between previous context and this one
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

const LogStoreBody = ({ path, prev, next, contextLines = 3 }: LogStoreBodyProps) => {
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

  // Reset and scroll to first hunk when diff changes
  useEffect(() => {
    if (!hasDiffs) {
      return;
    }

    setActiveHunk(0);
    scrollToHunk(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diff]);

  return (
    <div className="m-2 flex flex-col gap-3 font-mono text-xs">
      <div className="flex gap-1">
        <span className="font-bold text-gray-500">Path:</span>
        <span className="text-gray-700">{path ?? '(full state)'}</span>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="font-bold text-gray-600">
            Diff
            {hasDiffs && (
              <span className="ml-1 font-normal text-gray-400">
                ({activeHunk + 1} / {hunks.length})
              </span>
            )}
          </span>
          <div className="flex gap-2">
            <Button onClick={() => navigate(-1)} disabled={!hasDiffs || isFirst} size="xs">
              Prev
            </Button>
            <Button onClick={() => navigate(1)} disabled={!hasDiffs || isLast} size="xs">
              Next
            </Button>
          </div>
        </div>

        <pre ref={containerRef} className="max-h-60 overflow-auto rounded bg-gray-100 p-2 text-xs leading-relaxed">
          {!hasDiffs && <div className="text-gray-400 italic">No changes</div>}

          {sections.map((section, idx) => {
            if (section.kind === 'separator') {
              const isActive = section.hunkIndex === activeHunk;

              return (
                <div
                  key={`sep-${idx}`}
                  data-hunk={section.hunkIndex}
                  className={`my-0.5 rounded px-1 text-blue-500 ${isActive ? 'bg-blue-100' : 'bg-gray-200'}`}
                >
                  @@ hunk {section.hunkIndex + 1} / {section.total} @@
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
                  className={`bg-red-100 text-red-700 ${isActiveHunkLine ? 'bg-red-200' : ''}`}
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
                  className={`bg-green-100 text-green-700 ${isActiveHunkLine ? 'bg-green-200' : ''}`}
                >
                  {'+ '}
                  {line.text}
                </div>
              );
            }

            return (
              <div key={diffIndex} className="text-gray-400">
                {'  '}
                {line.text}
              </div>
            );
          })}
        </pre>
      </div>
    </div>
  );
};

export default LogStoreBody;
