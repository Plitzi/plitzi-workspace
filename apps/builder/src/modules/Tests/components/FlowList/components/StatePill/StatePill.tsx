import clsx from 'clsx';

import type { FlowState } from '../../../../studio/TestStudioContext';

export type StatePillProps = {
  state: FlowState;
  /** How many steps the journey has: what "Playing 3/5" counts against. */
  steps: number;
  className?: string;
};

const PILL =
  'rounded border px-1.5 py-px text-[10px] leading-4 font-semibold tracking-wide whitespace-nowrap uppercase';

/** Where a journey stands, as a pill: ready, waiting, playing and how far, passing, failing, or one only the server plays. */
const StatePill = ({ state, steps, className }: StatePillProps) => {
  switch (state.state) {
    case 'queued':
      return (
        <span className={clsx(PILL, 'border-dashed border-gray-300 text-zinc-500 dark:border-zinc-600', className)}>
          Queued
        </span>
      );
    case 'playing':
      return (
        <span
          className={clsx(PILL, 'border-primary-400 text-primary-700 dark:text-primary-200 border-dashed', className)}
        >
          Playing {state.played}/{steps}
        </span>
      );
    case 'passed':
      return (
        <span
          className={clsx(
            PILL,
            'border-emerald-500 bg-emerald-500 text-white dark:border-emerald-400 dark:bg-emerald-400 dark:text-emerald-950',
            className
          )}
        >
          Passes
        </span>
      );
    case 'failed':
      return (
        <span
          className={clsx(
            PILL,
            'border-red-500 bg-red-500 text-white dark:border-red-400 dark:bg-red-400 dark:text-red-950',
            className
          )}
        >
          Fails
        </span>
      );
    case 'stopped':
      return (
        <span className={clsx(PILL, 'border-gray-300 text-zinc-500 dark:border-zinc-600', className)}>Stopped</span>
      );
    case 'server':
      return (
        <span
          className={clsx(PILL, 'border-amber-400 text-amber-700 dark:text-amber-300', className)}
          title={state.why}
        >
          On the server
        </span>
      );
    case 'idle':
      return (
        <span className={clsx(PILL, 'border-dashed border-gray-300 text-zinc-400 dark:border-zinc-700', className)}>
          Ready
        </span>
      );
  }
};

export default StatePill;
