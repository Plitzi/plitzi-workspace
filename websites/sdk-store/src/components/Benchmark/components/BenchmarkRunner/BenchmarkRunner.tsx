import { useCallback, useEffect, useRef, useState } from 'react';

import ScenarioBlock from '../ScenarioBlock';

import type { BenchmarkResult, BenchmarkWorkerMessage, ScenarioResult } from '../../bench/shared';

const REPS = 9;

const BenchmarkRunner = () => {
  const [scenarios, setScenarios] = useState<ScenarioResult[]>([]);
  const [running, setRunning] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const runOnMainThread = useCallback(() => {
    void import('../../benchmarkEngine').then(({ runBenchmark }) => {
      requestAnimationFrame(() => {
        setScenarios(runBenchmark(REPS).scenarios);
        setRunning(false);
      });
    });
  }, []);

  const handleRun = useCallback(() => {
    setRunning(true);
    setScenarios([]);

    if (typeof Worker === 'undefined') {
      runOnMainThread();

      return;
    }

    workerRef.current?.terminate();
    const worker = new Worker(new URL('../../bench/worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<BenchmarkWorkerMessage>) => {
      const message = event.data;
      if (message.type === 'scenario') {
        setScenarios(prev => [...prev, message.scenario]);

        return;
      }

      setRunning(false);
      worker.terminate();
      workerRef.current = null;
    };

    worker.onerror = () => {
      worker.terminate();
      workerRef.current = null;
      runOnMainThread();
    };

    worker.postMessage({ reps: REPS });
  }, [runOnMainThread]);

  const result: BenchmarkResult | null = scenarios.length > 0 ? { scenarios } : null;

  return (
    <div className="flex flex-col rounded-2xl border border-ink-700 bg-ink-900/50 p-6">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-white">Live benchmark</h3>
        <span className="rounded-full border border-ink-600 bg-ink-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
          runs in a Web Worker
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-zinc-500">
        Seven workloads, seven stores, run on a background thread so the page never freezes — results stream in as each
        finishes. Each wake does the same small render-sized work, so time tracks both how many subscribers wake and how
        much the store has to copy.
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
            path/selector). Lower is faster; numbers vary by machine. One worker, not many: benchmarks can’t run in
            parallel without contending for cores and skewing the timings.
          </p>
        </>
      )}
    </div>
  );
};

export default BenchmarkRunner;
