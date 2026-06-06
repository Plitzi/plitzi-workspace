import { useMemo } from 'react';

import BenchmarkRow from '../BenchmarkRow';

import type { LibResult } from '../../benchmarkEngine';

export type ScenarioBlockProps = {
  label: string;
  description: string;
  results: LibResult[];
};

const ScenarioBlock = ({ label, description, results }: ScenarioBlockProps) => {
  const ranked = useMemo(() => [...results].sort((a, b) => a.ms - b.ms), [results]);
  const maxMs = useMemo(() => ranked.reduce((max, item) => Math.max(max, item.ms), 0), [ranked]);

  return (
    <div className="rounded-xl border border-ink-700 bg-ink-950/40 p-4">
      <h4 className="text-xs font-semibold text-white">{label}</h4>
      <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">{description}</p>

      <div className="mt-3 space-y-3">
        {ranked.map(item => (
          <BenchmarkRow
            key={item.name}
            name={item.name}
            wakes={item.wakes}
            ms={item.ms}
            min={item.min}
            maxMs={maxMs}
            highlight={item.name.includes('sdk-store')}
          />
        ))}
      </div>
    </div>
  );
};

export default ScenarioBlock;
