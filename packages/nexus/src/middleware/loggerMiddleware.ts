import type { StoreChange, StoreError, StoreMiddleware } from '../types';

export type LoggerOptions<TState extends object> = {
  // Only log changes for which this returns true.
  filter?: (change: StoreChange<TState>) => boolean;
  // Where to write; defaults to `console.log`.
  sink?: (change: StoreChange<TState>) => void;
  // Where to write failures thrown by other middlewares/subscribers; defaults to `console.error`.
  errorSink?: (failure: StoreError<TState>) => void;
};

const defaultSink = <TState extends object>(change: StoreChange<TState>): void => {
  console.log('[store]', change.path ?? '(root)', change.next);
};

const defaultErrorSink = <TState extends object>(failure: StoreError<TState>): void => {
  console.error('[store]', `${failure.phase} error at`, failure.path ?? '(root)', failure.error);
};

// Logs every committed change, and any middleware/subscriber failure surfaced through `onError`. Pass a sink function
// for the common case (`loggerMiddleware(myLogFn)`), `{ filter, sink, errorSink }` for more control, or nothing.
export const loggerMiddleware = <TState extends object>(
  options: LoggerOptions<TState> | ((change: StoreChange<TState>) => void) = {}
): StoreMiddleware<TState> => {
  const {
    filter,
    sink = defaultSink,
    errorSink = defaultErrorSink
  } = typeof options === 'function' ? { filter: undefined, sink: options, errorSink: defaultErrorSink } : options;

  return () => ({
    onChange: change => {
      if (!filter || filter(change)) {
        sink(change);
      }
    },
    onError: errorSink
  });
};
