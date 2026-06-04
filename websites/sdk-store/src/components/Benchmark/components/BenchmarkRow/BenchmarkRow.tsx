export type BenchmarkRowProps = {
  name: string;
  wakes: number;
  ms: number;
  min: number;
  maxMs: number;
  highlight: boolean;
};

const BenchmarkRow = ({ name, wakes, ms, min, maxMs, highlight }: BenchmarkRowProps) => {
  const width = maxMs > 0 ? Math.max(2, (ms / maxMs) * 100) : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className={`text-xs font-medium ${highlight ? 'text-brand-300' : 'text-zinc-300'}`}>{name}</span>
        <span className="font-mono text-[11px] text-zinc-500">
          {wakes.toLocaleString()} wakes · {ms.toFixed(2)} ms{' '}
          <span className="text-zinc-600">(best {min.toFixed(2)})</span>
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded bg-ink-800">
        <div
          className={`h-full rounded ${highlight ? 'bg-brand-500' : 'bg-zinc-600'}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
};

export default BenchmarkRow;
