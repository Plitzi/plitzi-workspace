import { useRef, useState, useEffect, useCallback } from 'react';
export type LogStoreBodyProps = {
  path?: string;
  prev?: unknown;
  next?: unknown;
};

const stringify = (value: unknown) => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const getDiffLines = (prev: unknown, next: unknown) => {
  const prevStr = stringify(prev ?? '').split('\n');
  const nextStr = stringify(next ?? '').split('\n');
  const max = Math.max(prevStr.length, nextStr.length);
  const lines = [];
  for (let i = 0; i < max; i++) {
    const p = prevStr[i];
    const n = nextStr[i];

    if (p === n) {
      lines.push({ type: 'same', value: p });
    } else {
      if (p) {
        lines.push({ type: 'removed', value: p });
      }

      if (n) {
        lines.push({ type: 'added', value: n });
      }
    }
  }

  return lines;
};

const scrollToIndex = (el: HTMLPreElement | null, idx: number) => {
  if (!el) {
    return;
  }

  const line = el.children[idx] as HTMLElement | undefined;
  if (line) {
    line.scrollIntoView({ block: 'center' });
  }
};

const LogStoreBody = ({ path, prev, next }: LogStoreBodyProps) => {
  const diff = getDiffLines(prev, next);
  const containerRef = useRef<HTMLPreElement | null>(null);
  const diffIndexes = diff.map((line, i) => (line.type === 'same' ? -1 : i)).filter(i => i !== -1);
  const [currentIndex, setCurrentIndex] = useState(0);

  const hasDiffs = diffIndexes.length > 0;
  const isSingle = diffIndexes.length === 1;
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === diffIndexes.length - 1;

  const handleNext = useCallback(() => {
    if (!hasDiffs || isLast) {
      return;
    }

    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    scrollToIndex(containerRef.current, diffIndexes[nextIndex]);
  }, [currentIndex, diffIndexes, hasDiffs, isLast]);

  const handlePrev = useCallback(() => {
    if (!hasDiffs || isFirst) {
      return;
    }

    const prevIndex = currentIndex - 1;
    setCurrentIndex(prevIndex);
    scrollToIndex(containerRef.current, diffIndexes[prevIndex]);
  }, [currentIndex, diffIndexes, hasDiffs, isFirst]);

  useEffect(() => {
    if (!hasDiffs) {
      return;
    }

    // always ensure index is valid
    if (currentIndex > diffIndexes.length - 1) {
      setCurrentIndex(0);
      return;
    }

    // if only one diff, auto focus it
    if (isSingle) {
      setCurrentIndex(0);
      scrollToIndex(containerRef.current, diffIndexes[0]);
      return;
    }
  }, [currentIndex, diffIndexes, hasDiffs, isSingle]);

  return (
    <div className="m-2 flex flex-col gap-3 font-mono text-xs">
      <div className="flex gap-1">
        <span className="font-bold text-gray-500">Path:</span>
        <span className="text-gray-700">{path ?? '(full state)'}</span>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="font-bold text-gray-600">Diff</span>
          <div className="flex gap-2">
            <button
              onClick={handlePrev}
              disabled={!hasDiffs || isFirst}
              className="rounded bg-gray-200 px-2 py-0.5 text-xs hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Prev
            </button>
            <button
              onClick={handleNext}
              disabled={!hasDiffs || isLast}
              className="rounded bg-gray-200 px-2 py-0.5 text-xs hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
        <pre ref={containerRef} className="max-h-60 overflow-auto rounded bg-gray-100 p-2 text-xs">
          {diff.map((line, i) => {
            if (line.type === 'same') {
              return <div key={i}>{line.value}</div>;
            }

            if (line.type === 'removed') {
              return (
                <div key={i} className="bg-red-100 text-red-700">
                  - {line.value}
                </div>
              );
            }

            return (
              <div key={i} className="bg-green-100 text-green-700">
                + {line.value}
              </div>
            );
          })}
        </pre>
      </div>
    </div>
  );
};

export default LogStoreBody;
