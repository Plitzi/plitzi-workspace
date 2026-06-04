import { useCallback, useState } from 'react';

import ScenarioBlock from '../ScenarioBlock';

import type { BenchmarkResult } from '../../benchmarkEngine';

const BenchmarkRunner = () => {
  const [result, setResult] = useState<BenchmarkResult | null>(null);
  const [running, setRunning] = useState(false);

  const handleRun = useCallback(() => {
    setRunning(true);
    // Code-split the engine (and zustand / jotai) so they only load when a visitor runs the benchmark.
    void import('../../benchmarkEngine').then(({ runBenchmark }) => {
      requestAnimationFrame(() => {
        setResult(runBenchmark());
        setRunning(false);
      });
    });
  }, []);

  return (
    <div className="flex flex-col rounded-2xl border border-ink-700 bg-ink-900/50 p-6">
      <h3 className="text-sm font-semibold text-white">Live benchmark</h3>
      <p className="mt-1 text-xs leading-relaxed text-zinc-500">
        Six workloads, seven stores, run in your browser. Each wake does the same small render-sized work, so time
        tracks both how many subscribers wake and how much the store has to copy.
      </p>

      <button
        onClick={handleRun}
        disabled={running}
        className="mt-4 self-start rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:opacity-50"
      >
        {running ? 'Running…' : result ? 'Run again' : 'Run benchmark'}
      </button>

      {result && (
        <>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {result.scenarios.map(scenario => (
              <ScenarioBlock
                key={scenario.id}
                label={scenario.label}
                description={scenario.description}
                results={scenario.results}
              />
            ))}
          </div>

          <p className="mt-4 border-t border-ink-800 pt-3 text-[11px] leading-relaxed text-zinc-600">
            <span className="text-zinc-400">Notify-all</span> isn’t a library — it’s a baseline that wakes every
            subscriber on any change (React Context, or any store subscribed to whole state instead of a
            path/selector). Lower is faster; numbers vary by machine.
          </p>
        </>
      )}
    </div>
  );
};

export default BenchmarkRunner;
