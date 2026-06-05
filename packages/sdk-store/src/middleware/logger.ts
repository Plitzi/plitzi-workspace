import type { StoreChange, StoreMiddleware } from '../types';

export type LoggerOptions<TState extends object> = {
  // Only log changes for which this returns true.
  filter?: (change: StoreChange<TState>) => boolean;
  // Where to write; defaults to `console.log`.
  sink?: (change: StoreChange<TState>) => void;
};

const defaultSink = <TState extends object>(change: StoreChange<TState>): void => {
  console.log('[store]', change.path ?? '(root)', change.next);
};

// Logs every committed change. Pass a sink function for the common case (`logger(myLogFn)`), `{ filter, sink }` for
// more control, or nothing to log to the console.
export const logger = <TState extends object>(
  options: LoggerOptions<TState> | ((change: StoreChange<TState>) => void) = {}
): StoreMiddleware<TState> => {
  const { filter, sink = defaultSink } = typeof options === 'function' ? { filter: undefined, sink: options } : options;

  return () => ({
    onChange: change => {
      if (!filter || filter(change)) {
        sink(change);
      }
    }
  });
};
