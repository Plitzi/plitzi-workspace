import { round } from './stats';

import type { PhaseResult, TargetResult } from './measure';

export type Change = {
  target: string;
  /** The scenario and concurrency, for a per-phase metric; absent for one about the whole target. */
  phase?: string;
  metric: string;
  baseline: number;
  current: number;
  /** Relative change, signed so that positive is always worse. */
  worseBy: number;
  verdict: 'regression' | 'improvement';
};

type Metric<T> = {
  name: string;
  read: (value: T) => number | undefined;
  higherIsBetter: boolean;
  /** Below this absolute difference the change is noise, whatever the percentage says. */
  floor: number;
};

const TARGET_METRICS: Metric<TargetResult>[] = [
  // Starting a container varies by most of a second from one run to the next on the same machine.
  { name: 'boot ms', read: target => target.bootMs, higherIsBetter: false, floor: 500 },
  { name: 'idle MB', read: target => target.idleMb, higherIsBetter: false, floor: 2 },
  { name: 'retained MB', read: target => target.retainedMb, higherIsBetter: false, floor: 2 },
  { name: 'peak MB', read: target => target.peakMb, higherIsBetter: false, floor: 2 }
];

const PHASE_METRICS: Metric<PhaseResult>[] = [
  { name: 'req/s', read: phase => phase.rps, higherIsBetter: true, floor: 1 },
  { name: 'p50 ms', read: phase => phase.latencyMs.p50, higherIsBetter: false, floor: 1 },
  { name: 'p99 ms', read: phase => phase.latencyMs.p99, higherIsBetter: false, floor: 2 },
  { name: 'CPU ms/req', read: phase => phase.cpuMsPerRequest, higherIsBetter: false, floor: 0.05 },
  { name: 'max MB', read: phase => phase.memoryMb.max, higherIsBetter: false, floor: 2 }
];

const phaseKey = (phase: PhaseResult): string => `${phase.scenario} c=${phase.concurrency}`;

const compareMetrics = <T>(
  metrics: Metric<T>[],
  baseline: T,
  current: T,
  tolerance: number,
  where: { target: string; phase?: string }
): Change[] =>
  metrics.flatMap(metric => {
    const before = metric.read(baseline);
    const after = metric.read(current);
    if (before === undefined || after === undefined || Math.abs(after - before) < metric.floor || before === 0) {
      return [];
    }

    const change = (after - before) / before;
    const worseBy = metric.higherIsBetter ? -change : change;
    if (Math.abs(worseBy) < tolerance) {
      return [];
    }

    return [
      {
        ...where,
        metric: metric.name,
        baseline: round(before, 2),
        current: round(after, 2),
        worseBy: round(worseBy, 3),
        verdict: worseBy > 0 ? 'regression' : 'improvement'
      }
    ];
  });

/**
 * What moved beyond `tolerance` (a fraction: 0.1 is 10%) between a baseline and this run, target by target and
 * phase by phase. A target that ran before and fails now is always a regression, whatever its numbers were.
 */
export const compareRuns = (baseline: TargetResult[], current: TargetResult[], tolerance: number): Change[] =>
  current.flatMap(target => {
    const before = baseline.find(candidate => candidate.target === target.target);
    if (!before) {
      return [];
    }

    if (before.status === 'ok' && target.status === 'failed') {
      return [
        {
          target: target.target,
          metric: `status (${target.failure ?? 'failed'})`,
          baseline: 1,
          current: 0,
          worseBy: 1,
          verdict: 'regression' as const
        }
      ];
    }

    const phases = target.phases.flatMap(phase => {
      const previous = before.phases.find(candidate => phaseKey(candidate) === phaseKey(phase));

      return previous
        ? compareMetrics(PHASE_METRICS, previous, phase, tolerance, { target: target.target, phase: phaseKey(phase) })
        : [];
    });

    // Peak and retained memory are the whole run's: they only compare when both runs did the same work.
    const samePhases = before.phases.map(phaseKey).join('|') === target.phases.map(phaseKey).join('|');
    const whole = samePhases
      ? compareMetrics(TARGET_METRICS, before, target, tolerance, { target: target.target })
      : [];

    return [...whole, ...phases];
  });
