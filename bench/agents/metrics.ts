import type { RunRecord } from './events';

/**
 * One run, measured as RFC 0025 §5.4 measures it: whether it did the task, how it degraded — failing, hallucinating,
 * or getting there the long way — and what it cost, net of what the harness itself loads before the model reads a word.
 */

export interface RunMetrics {
  success: boolean;
  /** Why it failed: the task's check, or the run's ceiling. */
  failedBecause?: string;
  tokensIn: number;
  tokensOut: number;
  /** Tokens beyond the harness's own floor (`overhead` × turns): what Plitzi and the task cost. */
  netTokens: number;
  turns: number;
  refusals: number;
  hallucinations: number;
  /** The share of the run's tokens spent on turns that corrected a refused call. */
  wasteShare: number;
  ceilingHit: boolean;
}

export interface Measure {
  record: RunRecord;
  /** The task's own check of the result. */
  check: { ok: boolean; why?: string };
  /** Input tokens one turn costs before the model reads anything of the task: the harness's system prompt and tools. */
  overhead: number;
  /** Past this many net tokens the run is stopped and counted a failure — a loop is not a slow success. */
  ceiling: number;
}

export const measureRun = ({ record, check, overhead, ceiling }: Measure): RunMetrics => {
  const tokensIn = record.turns.reduce((total, turn) => total + turn.input, 0);
  const tokensOut = record.turns.reduce((total, turn) => total + turn.output, 0);
  const netTokens = Math.max(0, tokensIn - overhead * record.turns.length) + tokensOut;
  const wasted = record.turns
    .filter(turn => turn.afterRefusal)
    .reduce((total, turn) => total + Math.max(0, turn.input - overhead) + turn.output, 0);
  const ceilingHit = netTokens > ceiling;
  const success = check.ok && !ceilingHit;

  return {
    success,
    ...(success ? {} : { failedBecause: ceilingHit ? `over the ceiling of ${String(ceiling)} tokens` : check.why }),
    tokensIn,
    tokensOut,
    netTokens,
    turns: record.turns.length,
    refusals: record.tools.filter(tool => tool.refused).length,
    hallucinations: record.tools.filter(tool => tool.hallucinated).length,
    wasteShare: netTokens > 0 ? wasted / netTokens : 0,
    ceilingHit
  };
};
